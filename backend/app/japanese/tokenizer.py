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

# Content categories worth a hover-lookup / save, even when written in pure kana.
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
}


def _is_kanji(ch: str) -> bool:
    code = ord(ch)
    return (
        0x3400 <= code <= 0x9FFF  # CJK ideographs (incl. Extension A)
        or 0xF900 <= code <= 0xFAFF  # CJK compatibility ideographs
        or ch == "々"  # iteration mark
    )


def _has_kanji(text: str) -> bool:
    return any(_is_kanji(ch) for ch in text)


def _kata_to_hira(text: str) -> str:
    out = []
    for ch in text:
        code = ord(ch)
        # Katakana block → hiragana, leaving the long-vowel mark (ー) untouched.
        if 0x30A1 <= code <= 0x30F6:
            out.append(chr(code - 0x60))
        else:
            out.append(ch)
    return "".join(out)


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
        and _kata_to_hira(s_chars[head]) == r_chars[head]
    ):
        head += 1

    # Peel matching kana off the back (trailing okurigana).
    tail = 0
    while (
        tail < len(s_chars) - head
        and tail < len(r_chars) - head
        and not _is_kanji(s_chars[-1 - tail])
        and _kata_to_hira(s_chars[-1 - tail]) == r_chars[-1 - tail]
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
            reading = _kata_to_hira(morpheme.reading_form())
            pos = _POS_MAP.get(morpheme.part_of_speech()[0], "other")
            interactive = pos in _INTERACTIVE_POS or _has_kanji(surface)
            tokens.append(
                Token(
                    surface=surface,
                    lemma=morpheme.dictionary_form(),
                    reading=reading,
                    pos=pos,
                    interactive=interactive,
                    furigana=_furigana_segments(surface, reading),
                )
            )
        return tokens
