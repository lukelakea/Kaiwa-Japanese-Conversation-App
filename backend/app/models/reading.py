"""API models for the Phase 2 reading aids.

These mirror the frontend types in ``frontend/src/types/reading.ts`` — keep the
two in sync. They cover three features: tokenisation (with furigana segments),
dictionary hover-lookup (JMdict words + KANJIDIC2 kanji), and translation.
"""

from pydantic import BaseModel, Field


class FuriganaSegment(BaseModel):
    """A run of a token's surface, optionally annotated with a reading.

    A token is split into segments so furigana sits only over the kanji core,
    not the surrounding kana (okurigana). ``ruby`` is ``None`` for kana that
    needs no annotation; otherwise it is the hiragana reading for ``text``.
    """

    text: str
    ruby: str | None = None


class Token(BaseModel):
    """One morpheme of a tokenised reply."""

    surface: str
    lemma: str
    reading: str
    pos: str
    interactive: bool
    furigana: list[FuriganaSegment]
    # English label for the inflected form (e.g. "conjunctive", "past"), present
    # only when the surface differs from the lemma and the form is recognised.
    conjugation_form: str | None = Field(default=None, serialization_alias="conjugationForm")
    # English label for the conjugation class (e.g. "godan", "ichidan"), present
    # for verbs and i-adjectives so the popover can explain *why* a form looks
    # the way it does.
    conjugation_type: str | None = Field(default=None, serialization_alias="conjugationType")


class GrammarMatch(BaseModel):
    """A grammatical construction detected across one or more tokens.

    ``token_indices`` lists every participating token (not necessarily
    contiguous — e.g. 〜ば〜ほど) so the frontend can show the same construction
    card whichever member token is hovered.
    """

    pattern_id: str = Field(serialization_alias="patternId")
    name: str
    gloss: str
    explanation: str
    token_indices: list[int] = Field(serialization_alias="tokenIndices")


class TokenizeRequest(BaseModel):
    text: str = Field(..., min_length=1)


class TokenizeResponse(BaseModel):
    tokens: list[Token]
    # Constructions detected over the token stream, longest span first.
    grammar: list[GrammarMatch] = Field(default_factory=list)


class WordSense(BaseModel):
    # Serialised as camelCase to match the TS client (FastAPI emits response
    # models by alias). It is the one multi-word field crossing the wire.
    part_of_speech: list[str] = Field(serialization_alias="partOfSpeech")
    glosses: list[str]


class WordEntry(BaseModel):
    """A JMdict dictionary entry, trimmed for hover display."""

    text: str
    reading: str
    senses: list[WordSense]


class KanjiEntry(BaseModel):
    """A KANJIDIC2 entry for a single character."""

    literal: str
    on: list[str]
    kun: list[str]
    meanings: list[str]
    strokes: int | None = None
    grade: int | None = None
    jlpt: int | None = None


class LookupResponse(BaseModel):
    """Hover-lookup result for one token: matching words and its kanji."""

    words: list[WordEntry]
    kanji: list[KanjiEntry]


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1)


class TranslateResponse(BaseModel):
    translation: str
