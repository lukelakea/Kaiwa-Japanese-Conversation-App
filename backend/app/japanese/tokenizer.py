"""Japanese tokenisation and furigana generation (SudachiPy).

Deterministic, no LLM (brief §6). A reply is split into morphemes; each is given
its dictionary-form lemma (for hover-lookup), a hiragana reading, and a list of
furigana segments that place readings over the kanji core only — never over the
surrounding kana (okurigana).

The :class:`Tokenizer` holds a single SudachiPy dictionary instance (loaded once
at startup) and is guarded by a lock so it can be shared across requests.
"""

from __future__ import annotations

import threading

from sudachipy import Dictionary, SplitMode

from app.japanese.kana import kata_to_hira
from app.models.reading import FuriganaSegment, Token

# Map SudachiPy's top-level (Japanese) part-of-speech to a compact English
# category for the UI. Anything unmapped falls through to "other".
_POS_MAP: dict[str, str] = {
    "名詞": "noun",
    "代名詞": "pronoun",
    "動詞": "verb",
    "形容詞": "adjective",
    "形状詞": "adjectival noun",
    "副詞": "adverb",
    "連体詞": "adnominal",
    "接続詞": "conjunction",
    "感動詞": "interjection",
    "助詞": "particle",
    "助動詞": "auxiliary",
    "接頭辞": "prefix",
    "接尾辞": "suffix",
    "数詞": "numeral",
    "記号": "symbol",
    "補助記号": "symbol",
    "空白": "whitespace",
}

# Every category worth a hover popup. Particles and auxiliaries are included so
# learners can look up は/も/に and ない/です/ます/て in context.
_INTERACTIVE_POS = {
    "noun",
    "pronoun",
    "verb",
    "adjective",
    "adjectival noun",
    "adverb",
    "adnominal",
    "conjunction",
    "interjection",
    "numeral",
    "prefix",
    "suffix",
    "particle",
    "auxiliary",
}

# Maps SudachiPy's conjugation-form field (part_of_speech()[5]) to a concise
# English label shown in the hover popup when the surface is inflected.
_CONJUGATION_FORM_MAP: dict[str, str] = {
    "終止形-一般": "plain form",
    "連体形-一般": "attributive",
    "連体形-準体": "attributive",
    "連用形-一般": "conjunctive",
    "連用形-ニ接続": "conjunctive",
    "連用形-撥音便": "conjunctive",
    "連用形-促音便": "conjunctive",
    "連用形-イ音便": "conjunctive",
    "連用形-融合": "conjunctive",
    "未然形-一般": "irrealis",
    "未然形-サ接続": "irrealis",
    "未然形-セ接続": "irrealis",
    "仮定形-一般": "conditional",
    "仮定形-融合": "conditional",
    "命令形": "imperative",
    "意志推量形": "volitional",
}

# Maps the leading segment of SudachiPy's conjugation-type field
# (part_of_speech()[4], e.g. "五段-カ行") to the conjugation class shown in the
# popover. Only verb/adjective classes a learner would recognise are mapped;
# auxiliary classes (助動詞-タ etc.) intentionally fall through to None.
_CONJUGATION_TYPE_MAP: dict[str, str] = {
    "五段": "godan",
    "上一段": "ichidan",
    "下一段": "ichidan",
    "サ行変格": "irregular (する)",
    "カ行変格": "irregular (来る)",
    "形容詞": "i-adjective",
}

# Multi-kana grammatical words that SudachiPy splits (even in split mode C) into
# single-kana components — each of which then resolves to a wall of unrelated
# homophones in hover-lookup — but that JMdict treats as one fused particle with
# a meaning the parts don't convey alone (e.g. とか "things like X" is not "and"
# (と) plus a question marker (か)). Re-merging restores the dedicated entry.
#
# This is a curated, *human-reviewed* allowlist, not the full set of fusible
# forms: a pair is safe to merge only when its components essentially never
# occur adjacently with an unrelated meaning. と (quotation) + は (topic) is
# common (「猫とは…」), so とは is excluded; か + な almost always *is* sentence-
# final かな, so it is included. Candidates are generated for review by
# scripts/find_fused_particles.py. Each maps to the POS category the merged
# token should carry so dictionary lookup filters and ranks it correctly.
_FUSED_PARTICLES: dict[str, str] = {
    "とか": "particle",
    "でも": "particle",
    "かな": "particle",
    "かも": "particle",
    "かね": "particle",
    "よね": "particle",
    "なんか": "particle",
}

# Upper bound on how many adjacent Sudachi morphemes any allowlisted form spans;
# bounds the longest-match merge scan. Today's longest (なんか) is two morphemes.
_MAX_FUSED_SPAN = 3


def _is_kanji(ch: str) -> bool:
    code = ord(ch)
    return (
        0x3400 <= code <= 0x9FFF  # CJK ideographs (incl. Extension A)
        or 0xF900 <= code <= 0xFAFF  # CJK compatibility ideographs
        or ch == "々"  # iteration mark
    )


def _has_kanji(text: str) -> bool:
    return any(_is_kanji(ch) for ch in text)


def _furigana_segments(surface: str, reading: str) -> list[FuriganaSegment]:
    """Align ``reading`` (hiragana) onto ``surface``, annotating only kanji runs.

    Strips kana shared at the start and end of both strings (okurigana), then
    places the remaining reading over the remaining kanji core. Falls back to a
    single annotated segment if alignment is ambiguous.
    """
    if not _has_kanji(surface) or not reading:
        return [FuriganaSegment(text=surface)]

    s_chars = list(surface)
    r_chars = list(reading)

    # Peel matching kana off the front (leading okurigana / shared kana).
    head = 0
    while (
        head < len(s_chars)
        and head < len(r_chars)
        and not _is_kanji(s_chars[head])
        and kata_to_hira(s_chars[head]) == r_chars[head]
    ):
        head += 1

    # Peel matching kana off the back (trailing okurigana).
    tail = 0
    while (
        tail < len(s_chars) - head
        and tail < len(r_chars) - head
        and not _is_kanji(s_chars[-1 - tail])
        and kata_to_hira(s_chars[-1 - tail]) == r_chars[-1 - tail]
    ):
        tail += 1

    lead = "".join(s_chars[:head])
    core = "".join(s_chars[head : len(s_chars) - tail])
    trail = "".join(s_chars[len(s_chars) - tail :]) if tail else ""
    core_reading = "".join(r_chars[head : len(r_chars) - tail])

    if not core or not core_reading:
        # Nothing left to annotate cleanly — annotate the whole surface.
        return [FuriganaSegment(text=surface, ruby=reading)]

    segments: list[FuriganaSegment] = []
    if lead:
        segments.append(FuriganaSegment(text=lead))
    segments.append(FuriganaSegment(text=core, ruby=core_reading))
    if trail:
        segments.append(FuriganaSegment(text=trail))
    return segments


def _merge_fused_particles(tokens: list[Token]) -> list[Token]:
    """Merge runs of adjacent tokens whose surfaces concatenate to a
    ``_FUSED_PARTICLES`` key into one token.

    Greedy longest-match: at each position the widest span (up to
    ``_MAX_FUSED_SPAN``) is tried first, so a longer fused form wins over a
    shorter prefix of it. Concatenating surfaces still reproduces the input,
    since the merged surface is just the original surfaces joined. The allowlist
    holds only all-kana forms, so the merged token's reading equals its surface
    and its furigana is a single plain segment.
    """
    merged: list[Token] = []
    i = 0
    n = len(tokens)
    while i < n:
        for span in range(min(_MAX_FUSED_SPAN, n - i), 1, -1):
            surface = "".join(t.surface for t in tokens[i : i + span])
            pos = _FUSED_PARTICLES.get(surface)
            if pos is not None:
                merged.append(
                    Token(
                        surface=surface,
                        lemma=surface,
                        reading=surface,
                        pos=pos,
                        interactive=True,
                        furigana=[FuriganaSegment(text=surface)],
                    )
                )
                i += span
                break
        else:
            merged.append(tokens[i])
            i += 1
    return merged


class Tokenizer:
    """Thread-safe wrapper over a SudachiPy tokenizer in split mode C."""

    def __init__(self) -> None:
        self._tokenizer = Dictionary().create()
        self._lock = threading.Lock()

    def tokenize(self, text: str) -> list[Token]:
        """Tokenise ``text``; concatenating token surfaces reproduces the input.

        Newlines are preserved as their own whitespace tokens so multi-line
        replies round-trip and render with their original line breaks.
        """
        tokens: list[Token] = []
        for index, line in enumerate(text.split("\n")):
            if index:
                tokens.append(
                    Token(
                        surface="\n",
                        lemma="\n",
                        reading="",
                        pos="whitespace",
                        interactive=False,
                        furigana=[FuriganaSegment(text="\n")],
                    )
                )
            if line:
                tokens.extend(self._tokenize_line(line))
        return tokens

    def _tokenize_line(self, line: str) -> list[Token]:
        with self._lock:
            morphemes = self._tokenizer.tokenize(line, SplitMode.C)

        tokens: list[Token] = []
        for morpheme in morphemes:
            surface = morpheme.surface()
            lemma = morpheme.dictionary_form()
            reading = kata_to_hira(morpheme.reading_form())
            pos_tuple = morpheme.part_of_speech()
            pos = _POS_MAP.get(pos_tuple[0], "other")
            interactive = pos in _INTERACTIVE_POS or _has_kanji(surface)
            # Conjugation form label — only useful when the surface is inflected.
            conj_raw = pos_tuple[5] if len(pos_tuple) > 5 else ""
            conjugation_form = (
                _CONJUGATION_FORM_MAP.get(conj_raw)
                if conj_raw and conj_raw != "*" and surface != lemma
                else None
            )
            # Conjugation class (e.g. "五段-カ行" → godan); keyed on the segment
            # before the dash, which names the class.
            type_raw = pos_tuple[4] if len(pos_tuple) > 4 else ""
            conjugation_type = (
                _CONJUGATION_TYPE_MAP.get(type_raw.split("-")[0]) if type_raw else None
            )
            tokens.append(
                Token(
                    surface=surface,
                    lemma=lemma,
                    reading=reading,
                    pos=pos,
                    interactive=interactive,
                    furigana=_furigana_segments(surface, reading),
                    conjugation_form=conjugation_form,
                    conjugation_type=conjugation_type,
                )
            )
        return _merge_fused_particles(tokens)
