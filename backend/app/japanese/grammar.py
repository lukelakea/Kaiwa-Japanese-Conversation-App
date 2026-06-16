"""Grammatical construction detection over a tokenised reply.

Japanese grammar is compositional — してない means "not doing", but no single
morpheme (し / て / ない) says so. This module scans the token stream produced
by :class:`app.japanese.tokenizer.Tokenizer` for known multi-token
constructions so the hover popup can explain the whole alongside the parts.

Deterministic and rule-based (no LLM, brief §6): each construction is a
declarative :class:`Pattern` — a sequence of per-token matchers, with optional
elements for contracted/inflected tails and bounded gaps for split patterns
like 〜ば〜ほど. Matches carry the indices of every participating token, so the
frontend shows the same construction card whichever member token is hovered.

The matchers test the fields tokens already carry (surface, lemma, pos, the
mapped conjugation-form label); the pattern data below is grounded in how
SudachiPy actually segments these constructions — notably that the contracted
forms てる/ちゃう/じゃう/とく are their own auxiliary lemmas.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models.reading import GrammarMatch, Token

# Tokens a gap may never skip over: constructions do not span sentences.
_SENTENCE_BREAKERS = {"。", "！", "？", "!", "?", "\n"}


@dataclass(frozen=True)
class M:
    """Matcher for a single token. ``None`` fields are unconstrained."""

    surface: tuple[str, ...] | None = None
    lemma: tuple[str, ...] | None = None
    pos: tuple[str, ...] | None = None
    # Mapped conjugation-form label (tokenizer._CONJUGATION_FORM_MAP values).
    form: tuple[str, ...] | None = None
    optional: bool = False

    def matches(self, token: Token) -> bool:
        return (
            (self.surface is None or token.surface in self.surface)
            and (self.lemma is None or token.lemma in self.lemma)
            and (self.pos is None or token.pos in self.pos)
            and (self.form is None or token.conjugation_form in self.form)
        )


@dataclass(frozen=True)
class Gap:
    """Skip up to ``max_tokens`` tokens, never crossing a sentence boundary."""

    max_tokens: int = 8


@dataclass(frozen=True)
class Pattern:
    """One construction: identity, learner-facing copy, and the token shape.

    ``elements`` must start with a non-optional :class:`M` — the scan anchors
    each match attempt on a token that satisfies the first matcher.
    """

    pattern_id: str
    name: str
    gloss: str
    explanation: str
    elements: tuple[M | Gap, ...]


def _is_breaker(token: Token) -> bool:
    return token.pos == "whitespace" or token.surface in _SENTENCE_BREAKERS


def _match_from(
    elements: tuple[M | Gap, ...],
    tokens: list[Token],
    token_index: int,
    element_index: int,
    matched: list[int],
) -> list[int] | None:
    """Try to satisfy ``elements[element_index:]`` starting at ``token_index``.

    Returns the participating token indices on success. Optional elements are
    matched greedily; gaps shortest-first (so a split pattern pairs with its
    nearest second half).
    """
    if element_index == len(elements):
        return matched
    element = elements[element_index]

    if isinstance(element, Gap):
        for width in range(element.max_tokens + 1):
            skipped = tokens[token_index : token_index + width]
            if len(skipped) < width or any(_is_breaker(t) for t in skipped):
                break  # ran out of tokens or hit a sentence boundary
            result = _match_from(elements, tokens, token_index + width, element_index + 1, matched)
            if result is not None:
                return result
        return None

    if token_index < len(tokens) and element.matches(tokens[token_index]):
        result = _match_from(
            elements, tokens, token_index + 1, element_index + 1, [*matched, token_index]
        )
        if result is not None:
            return result
    if element.optional:
        return _match_from(elements, tokens, token_index, element_index + 1, matched)
    return None


def detect_grammar(tokens: list[Token]) -> list[GrammarMatch]:
    """Find every known construction in ``tokens``.

    Overlapping and nested matches are all reported (seeing the layers compose
    is the point); ordering is by position, longer spans first, so the popover
    can render the most informative match at the top.
    """
    matches: list[GrammarMatch] = []
    for pattern in PATTERNS:
        anchor = pattern.elements[0]
        assert isinstance(anchor, M) and not anchor.optional  # noqa: S101 — pattern-data invariant
        for start, token in enumerate(tokens):
            if not anchor.matches(token):
                continue
            indices = _match_from(pattern.elements, tokens, start + 1, 1, [start])
            if indices is not None:
                matches.append(
                    GrammarMatch(
                        pattern_id=pattern.pattern_id,
                        name=pattern.name,
                        gloss=pattern.gloss,
                        explanation=pattern.explanation,
                        token_indices=indices,
                    )
                )
    matches.sort(key=lambda m: (m.token_indices[0], -(m.token_indices[-1] - m.token_indices[0])))
    return matches


# --- Pattern library -------------------------------------------------------
#
# Curated for conversational frequency (roughly JLPT N5–N3). Glosses are the
# one-line hover summary; explanations say *why* the pieces mean what they
# mean. Growing this list is a data change, not an engine change.

# A verb in 連用形 — the stem that て/たい/ます/た attach to.
_V_CONJ = M(pos=("verb",), form=("conjunctive",))
# A verb in 未然形 — the stem that negation attaches to.
_V_IRREALIS = M(pos=("verb",), form=("irrealis",))
# The て/で conjunctive particle (で after voiced stems: 飲んで).
_TE = M(surface=("て", "で"), pos=("particle",))

PATTERNS: tuple[Pattern, ...] = (
    Pattern(
        "te-iru",
        "〜ている",
        "ongoing action or resulting state",
        "The て-form plus いる ('to exist') literally means 'exists doing': an action in "
        "progress (is doing) or the state left by an action (is married, is open). "
        "Trailing た makes it past ('was doing'); ない negates it.",
        (
            _V_CONJ,
            _TE,
            M(lemma=("いる",), pos=("verb",)),
            M(lemma=("た", "ない", "ます"), optional=True),
        ),
    ),
    Pattern(
        "te-iru-contracted",
        "〜てる（〜ている）",
        "ongoing action or resulting state — casual contraction",
        "Casual speech drops the い of 〜ている: している→してる, していない→してない, "
        "していた→してた. Same meaning as 〜ている: an ongoing action or resulting state.",
        (_V_CONJ, M(lemma=("てる",), pos=("auxiliary",)), M(lemma=("た", "ない"), optional=True)),
    ),
    Pattern(
        "te-shimau",
        "〜てしまう",
        "do completely; do regrettably",
        "しまう ('to put away, finish') after the て-form adds finality: the action is fully "
        "done, or it happened and can't be undone — often regret. Context decides which: "
        "宿題をしてしまった (finished the homework) vs 忘れてしまった (unfortunately forgot).",
        (_V_CONJ, _TE, M(lemma=("しまう",), pos=("verb",)), M(lemma=("た",), optional=True)),
    ),
    Pattern(
        "te-shimau-contracted",
        "〜ちゃう（〜てしまう）",
        "do completely; do regrettably — casual contraction",
        "てしまう contracts to ちゃう (でしまう to じゃう) in casual speech: 食べてしまった→"
        "食べちゃった. Same nuance — the action is fully done or regrettably done.",
        (
            _V_CONJ,
            M(lemma=("ちゃう", "じゃう"), pos=("auxiliary",)),
            M(lemma=("た",), optional=True),
        ),
    ),
    Pattern(
        "te-kudasai",
        "〜てください",
        "please do",
        "The て-form plus ください (imperative of くださる, 'to give me') literally asks "
        "'give me (the favour of) doing' — the standard polite request.",
        (_V_CONJ, _TE, M(lemma=("くださる",), pos=("verb",))),
    ),
    Pattern(
        "naide-kudasai",
        "〜ないでください",
        "please don't do",
        "The negative ない plus で plus ください: 'please (be) without doing'. The polite "
        "way to ask someone not to do something.",
        (
            _V_IRREALIS,
            M(lemma=("ない",), pos=("auxiliary",)),
            M(surface=("で",), pos=("particle",)),
            M(lemma=("くださる",), pos=("verb",)),
        ),
    ),
    Pattern(
        "te-mo-ii",
        "〜てもいい",
        "may; it's OK to",
        "Literally 'even if (you) do, it is good': て-form + も ('even') + いい ('good'). "
        "Asks for or grants permission.",
        (
            _V_CONJ,
            _TE,
            M(surface=("も",), pos=("particle",)),
            M(lemma=("いい", "良い", "よい"), pos=("adjective",)),
        ),
    ),
    Pattern(
        "te-wa-ikenai",
        "〜てはいけない",
        "must not",
        "Literally 'as for doing, it cannot go': て-form + は (topic) + いけない ('won't "
        "do / no good'). A firm prohibition; いけません is the polite version.",
        (
            _V_CONJ,
            _TE,
            M(surface=("は",), pos=("particle",)),
            M(lemma=("いける", "なる"), pos=("verb",)),
            M(lemma=("ない", "ます")),
            M(lemma=("ぬ",), optional=True),
        ),
    ),
    Pattern(
        "cha-dame",
        "〜ちゃだめ",
        "must not — casual",
        "Casual contraction of 〜てはいけない／てはだめ: ては→ちゃ (では→じゃ) plus だめ "
        "('no good'). 食べちゃだめ = 'you mustn't eat (it)'.",
        (_V_CONJ, M(surface=("ちゃ", "じゃ"), pos=("particle",)), M(lemma=("だめ", "駄目"))),
    ),
    Pattern(
        "nakereba-naranai",
        "〜なければならない",
        "must; have to",
        "A double negative: なければ ('if not') + ならない／いけない ('it won't do') — "
        "'if (you) don't do it, it won't do', hence obligation. なりません／いけません "
        "are the polite forms.",
        (
            _V_IRREALIS,
            M(lemma=("ない",), form=("conditional",)),
            M(surface=("ば",), pos=("particle",)),
            M(lemma=("なる", "いける"), pos=("verb",)),
            M(lemma=("ない", "ます")),
            M(lemma=("ぬ",), optional=True),
        ),
    ),
    Pattern(
        "nakya",
        "〜なきゃ（〜なければ）",
        "gotta; have to — casual",
        "なければ contracts to なきゃ in casual speech, and the ならない ('it won't do') "
        "that completes the obligation is usually left unsaid: 行かなきゃ = 'gotta go'.",
        (_V_IRREALIS, M(surface=("なきゃ",), lemma=("ない",))),
    ),
    Pattern(
        "nakucha",
        "〜なくちゃ（〜なくては）",
        "gotta; have to — casual",
        "なくては contracts to なくちゃ, with the ならない ('it won't do') that completes "
        "the obligation left unsaid: 食べなくちゃ = 'gotta eat'.",
        (
            _V_IRREALIS,
            M(surface=("なく",), lemma=("ない",)),
            M(surface=("ちゃ",), pos=("particle",)),
        ),
    ),
    Pattern(
        "nakereba",
        "〜なければ",
        "if (one) doesn't; unless",
        "The negative ない in its conditional form plus ば: 'if not'. 行かなければ = "
        "'if (I) don't go'. Followed by ならない it becomes obligation ('must').",
        (
            _V_IRREALIS,
            M(lemma=("ない",), form=("conditional",)),
            M(surface=("ば",), pos=("particle",)),
        ),
    ),
    Pattern(
        "ba-conditional",
        "〜ば",
        "if; when",
        "The conditional form plus ば states a condition and its natural result: "
        "読めば分かる = 'if you read it, you'll understand'.",
        (
            M(pos=("verb", "adjective"), form=("conditional",)),
            M(surface=("ば",), pos=("particle",)),
        ),
    ),
    Pattern(
        "ba-hodo",
        "〜ば〜ほど",
        "the more ..., the more ...",
        "The same idea stated twice — once as a condition (〜ば) and once with ほど "
        "('extent') — means the result scales with the condition: 読めば読むほど面白い = "
        "'the more you read it, the more interesting it gets'.",
        (
            M(pos=("verb", "adjective"), form=("conditional",)),
            M(surface=("ば",), pos=("particle",)),
            Gap(4),
            M(pos=("verb", "adjective")),
            M(surface=("ほど",), pos=("particle",)),
        ),
    ),
    Pattern(
        "tari-tari",
        "〜たり〜たりする",
        "doing things like ... and ...",
        "Listing actions with たり (だり after voiced stems) presents them as examples "
        "from a larger set, not an exhaustive sequence: 読んだり聴いたりする = "
        "'(I) do things like reading and listening'.",
        (
            _V_CONJ,
            M(surface=("たり", "だり"), pos=("particle",)),
            Gap(8),
            _V_CONJ,
            M(surface=("たり", "だり"), pos=("particle",)),
            M(lemma=("する",), pos=("verb",), optional=True),
        ),
    ),
    Pattern(
        "kamoshirenai",
        "〜かもしれない",
        "might; maybe",
        "Literally 'whether (it is so) cannot be known': かも (か question + も even) "
        "+ しれない (cannot be known). States a possibility; かもしれません is polite.",
        (
            # かも is fused into one token by the tokenizer (see _FUSED_PARTICLES).
            M(surface=("かも",), pos=("particle",)),
            M(lemma=("しれる",), pos=("verb",)),
            M(lemma=("ない", "ます")),
            M(lemma=("ぬ",), optional=True),
        ),
    ),
    Pattern(
        "te-miru",
        "〜てみる",
        "try doing",
        "The て-form plus みる ('to see') means doing something to see how it goes: "
        "食べてみる = 'try eating (it and see)'.",
        (_V_CONJ, _TE, M(lemma=("みる",), pos=("verb",))),
    ),
    Pattern(
        "te-oku",
        "〜ておく",
        "do in advance; do and leave it so",
        "The て-form plus おく ('to put, place') means doing something now for later — "
        "preparation, or leaving a state in place: 買っておく = 'buy (it) in advance'.",
        (_V_CONJ, _TE, M(lemma=("おく",), pos=("verb",))),
    ),
    Pattern(
        "te-oku-contracted",
        "〜とく（〜ておく）",
        "do in advance — casual contraction",
        "ておく contracts to とく in casual speech: 買っておく→買っとく. Same meaning: "
        "do it now for later.",
        (_V_CONJ, M(lemma=("とく",), pos=("auxiliary",))),
    ),
    Pattern(
        "te-kureru",
        "〜てくれる",
        "(someone) does for me",
        "くれる ('to give me') after the て-form marks the action as a favour flowing "
        "toward the speaker: 手伝ってくれる = '(they) help me (as a favour)'.",
        (_V_CONJ, _TE, M(lemma=("くれる",), pos=("verb",))),
    ),
    Pattern(
        "te-morau",
        "〜てもらう",
        "have (someone) do; receive the favour of",
        "もらう ('to receive') after the て-form frames the action as something the "
        "subject receives from someone: 教えてもらう = 'have (someone) teach me'.",
        (_V_CONJ, _TE, M(lemma=("もらう",), pos=("verb",))),
    ),
    Pattern(
        "te-ageru",
        "〜てあげる",
        "do for (someone)",
        "あげる ('to give') after the て-form marks the action as a favour flowing away "
        "from the speaker: 買ってあげる = 'buy (it) for them'.",
        (_V_CONJ, _TE, M(lemma=("あげる",), pos=("verb",))),
    ),
    Pattern(
        "tai",
        "〜たい",
        "want to do",
        "たい on the verb stem expresses the speaker's own desire, and conjugates like "
        "an i-adjective: 食べたい 'want to eat', 行きたくない 'don't want to go'.",
        (
            _V_CONJ,
            M(lemma=("たい",), pos=("auxiliary",)),
            M(lemma=("ない", "です", "た"), optional=True),
        ),
    ),
    Pattern(
        "koto-ga-dekiru",
        "〜ことができる",
        "can; be able to",
        "Literally 'the thing of doing is possible': the verb is turned into a noun with "
        "こと, and できる ('to be possible') says it can be done. A slightly formal "
        "alternative to the potential form.",
        (
            M(pos=("verb",)),
            M(lemma=("こと", "事"), pos=("noun",)),
            M(surface=("が",), pos=("particle",)),
            M(lemma=("できる", "出来る"), pos=("verb",)),
        ),
    ),
    Pattern(
        "n-desu",
        "〜んです",
        "explanatory tone",
        "ん (a contraction of の) turns the sentence into a piece of background or "
        "explanation: 行くんです = 'the thing is, I'm going'. Common when giving reasons "
        "or inviting one.",
        (M(surface=("ん",), pos=("particle",)), M(lemma=("です", "だ"), pos=("auxiliary",))),
    ),
    Pattern(
        "you-ni-naru",
        "〜ようになる",
        "come to; reach the point where",
        "よう ('manner, state') + に + なる ('to become') marks a gradual change of state: "
        "話せるようになった = '(I) came to be able to speak'.",
        (
            M(pos=("verb",)),
            M(lemma=("よう", "様"), pos=("adjectival noun",)),
            M(surface=("に",)),
            M(lemma=("なる",), pos=("verb",)),
            M(lemma=("た",), optional=True),
        ),
    ),
    Pattern(
        "you-ni-suru",
        "〜ようにする",
        "make a point of doing; see to it that",
        "よう ('manner, state') + に + する ('to do/make') means deliberately bringing "
        "that state about: 早く寝るようにする = 'make a point of going to bed early'.",
        (
            M(pos=("verb",)),
            M(lemma=("よう", "様"), pos=("adjectival noun",)),
            M(surface=("に",)),
            M(lemma=("する",), pos=("verb",)),
        ),
    ),
    Pattern(
        "masu-polite",
        "〜ます",
        "polite style",
        "ます on the verb stem marks the polite (です/ます) register. ました is its past, "
        "ません its negative, ませんでした its negative past.",
        (_V_CONJ, M(lemma=("ます",), pos=("auxiliary",)), M(lemma=("た", "ぬ"), optional=True)),
    ),
    Pattern(
        "plain-past",
        "〜た",
        "past tense / completed action",
        "た after the verb stem marks the action as past or completed: 食べた = 'ate'. "
        "After ます it forms the polite past ました.",
        (
            M(pos=("verb", "adjective", "auxiliary"), form=("conjunctive",)),
            # Sudachi lemmatises the conditional たら/だら to the same た, so pin the
            # surface to た/だ — otherwise 〜たら ('if/when', not past) would match
            # and mislabel したら as a past tense.
            M(lemma=("た",), pos=("auxiliary",), surface=("た", "だ")),
        ),
    ),
    Pattern(
        "negative-nai",
        "〜ない",
        "plain negative",
        "ない after the verb's 未然形 stem is the plain 'not': 行かない = 'don't/won't go'. "
        "なかった is its past ('didn't go').",
        (
            _V_IRREALIS,
            M(lemma=("ない",), pos=("auxiliary",), surface=("ない", "なかっ")),
            M(lemma=("た",), optional=True),
        ),
    ),
    Pattern(
        "yo-assertion",
        "〜よ",
        "assertion — telling the listener something",
        "Sentence-final よ presents the statement as information the listener doesn't "
        "have yet — emphasis or a friendly heads-up: ですよ softly asserts; だよ is its "
        "casual equivalent. よね adds a request for agreement.",
        (
            M(pos=("verb", "adjective", "auxiliary")),
            # よ+ね is fused into よね by the tokenizer (see _FUSED_PARTICLES), so
            # the agreement-seeking variant arrives as one token, not よ then ね.
            M(surface=("よ", "よね"), pos=("particle",)),
        ),
    ),
    Pattern(
        "ne-agreement",
        "〜ね",
        "seeking agreement; softening",
        "Sentence-final ね invites the listener to agree or confirms shared ground — "
        "like a tag question: ですね = 'isn't it / right?'.",
        (M(pos=("verb", "adjective", "auxiliary")), M(surface=("ね",), pos=("particle",))),
    ),
)
