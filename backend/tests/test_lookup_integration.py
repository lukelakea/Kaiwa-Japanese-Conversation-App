"""Integration tests for the hover-lookup pipeline against the *real* dictionary.

Unlike ``test_dictionary.py`` (which uses a tiny synthetic DB to unit-test the
suppression/ranking logic in isolation), these exercise the full path —
``Tokenizer`` → ``_merge_fused_particles`` → ``Dictionary.look_up`` — over the
compiled JMdict/KANJIDIC2 database, the way a hover actually runs.

The point is to catch the failure class that only shows up against real data and
was previously "discovered by accident in conversation": a common word that
silently returns *no* popup entry (the ます bug), or a fused particle that splits
back into a wall of single-kana homophones. The closed-class sweep
(``test_no_closed_class_token_returns_empty``) is the catch-all — it flags a new
broken grammatical token without anyone having to enumerate it in advance.

The compiled DB is gitignored and multi-MB, so the whole module skips when it
hasn't been built (e.g. in CI without the data step). Build it with
``uv run --directory backend python scripts/build_dictionaries.py``.
"""

from __future__ import annotations

import pytest

from app.config import get_settings
from app.japanese.dictionary import Dictionary
from app.japanese.tokenizer import Tokenizer

_DB_PATH = get_settings().resolved_dictionary_path

pytestmark = pytest.mark.skipif(
    not _DB_PATH.exists(),
    reason=f"compiled dictionary not built at {_DB_PATH}; run build_dictionaries.py",
)

# Closed grammatical categories: every member is in JMdict, so a real lookup of
# one should *always* return at least one entry. Content categories (noun, verb)
# are excluded — proper nouns and rare lemmas can legitimately be absent.
_CLOSED_CLASS = {"particle", "auxiliary", "pronoun", "adnominal", "conjunction", "interjection"}

# Representative free-talk replies spanning the grammar a learner meets early:
# polite/plain, questions, conditionals, fused particles, て-form chains,
# obligation, giving/receiving. The closed-class sweep runs over every token here.
_CORPUS = (
    "そうですね、難しいかな。でも頑張ってみましょう。",
    "週末は映画を見たり本を読んだりしました。",
    "日本に行ったことがありますか。",
    "もしかしたら雨が降るかもしれません。",
    "それはいいですよね。私もそう思います。",
    "最近運動するようになりました。",
    "コーヒーでもいかがですか。なんか今日は疲れました。",
    "東京とか大阪に行きたいです。この本面白いかもね。",
    "時間があればまた話しましょう。",
    "学生のときよく勉強しました。そのことについて考えています。",
    "物を大切にしてください。ところで趣味は何ですか。",
    "犬とは違って猫は静かです。気をつけてね。",
    "食べなければなりません。早く行かなきゃ。",
    "何をしているの。どこへ行くんですか。",
    "ちょっと待ってください。もう一度言ってくれませんか。",
    "たぶん大丈夫でしょう。彼女が来るだろう。",
)

# Curated strong expectations: (surface, lemma, pos) → a substring that MUST
# appear in some returned gloss. These pin the *meaning* a learner should see for
# high-frequency grammatical glue and the homophone-prone words we've fought —
# the regression backbone. Every row was hand-verified against the built DB.
_EXPECTED: tuple[tuple[str, str, str, str], ...] = (
    # Core particles.
    ("は", "は", "particle", "topic"),
    ("が", "が", "particle", "subject"),
    ("を", "を", "particle", "direct object"),
    ("に", "に", "particle", "at (place"),
    ("で", "で", "particle", "at"),
    ("の", "の", "particle", "possessive"),
    ("も", "も", "particle", "too"),
    ("か", "か", "particle", "question"),
    ("ね", "ね", "particle", "right?"),
    # よ is intentionally omitted: its only particle entry in JMdict glosses the
    # vocative "hey" sense, not sentence-final emphasis — that meaning reaches the
    # learner via the yo-assertion grammar card, not the dictionary gloss.
    # Copula / auxiliaries — the ます bug lived here.
    ("です", "です", "auxiliary", "be"),
    ("ます", "ます", "auxiliary", "politeness"),
    ("ない", "ない", "auxiliary", "not"),
    ("た", "た", "auxiliary", "did"),
    ("たい", "たい", "auxiliary", "want to"),
    # Fused particles (must merge, then resolve to the fused meaning).
    ("かな", "かな", "particle", "wonder"),
    ("かも", "かも", "particle", "may"),
    ("とか", "とか", "particle", "and the like"),
    ("でも", "でも", "particle", "but"),
    ("よね", "よね", "particle", "right?"),
    ("なんか", "なんか", "particle", "something like"),
    # Homophone-prone formal nouns — the こと/もの/とき/ところ cluster.
    ("こと", "こと", "noun", "thing"),
    ("もの", "もの", "noun", "thing"),
    ("とき", "とき", "noun", "time"),
    ("ところ", "ところ", "noun", "place"),
)


@pytest.fixture(scope="module")
def dictionary() -> Dictionary:
    return Dictionary(_DB_PATH)


@pytest.fixture(scope="module")
def tokenizer() -> Tokenizer:
    return Tokenizer()


def test_dictionary_is_available(dictionary: Dictionary) -> None:
    """Sanity check: the built DB loaded and carries the uk flag the lookup
    strategy depends on (a DB built before the uk column would silently fall
    back to the weaker suppression path)."""
    assert dictionary.available
    assert dictionary._has_uk, "rebuild the dictionary — it predates the uk flag"


@pytest.mark.parametrize("surface,lemma,pos,expected_gloss", _EXPECTED)
def test_common_token_resolves_to_expected_sense(
    dictionary: Dictionary, surface: str, lemma: str, pos: str, expected_gloss: str
) -> None:
    """Each high-frequency token returns an entry whose gloss contains the
    expected meaning — guards both 'returns nothing' and 'returns the wrong
    homophone first'."""
    result = dictionary.look_up(surface, lemma, pos)
    assert result.words, f"{surface} ({pos}) returned no entries"
    glosses = [g.lower() for w in result.words for s in w.senses for g in s.glosses]
    assert any(expected_gloss.lower() in g for g in glosses), (
        f"{surface} ({pos}) missing expected gloss '{expected_gloss}'; got {glosses[:6]}"
    )


def test_no_closed_class_token_returns_empty(tokenizer: Tokenizer, dictionary: Dictionary) -> None:
    """The catch-all: tokenise the corpus and assert every interactive
    closed-class token (particle, auxiliary, pronoun, …) resolves to at least
    one entry. A grammatical word is a closed set, all present in JMdict, so an
    empty result means a real pipeline bug (e.g. the ます suppression collision),
    not a dictionary gap. This flags new breakage without enumerating it.
    """
    empties: list[str] = []
    checked = 0
    for sentence in _CORPUS:
        for token in tokenizer.tokenize(sentence):
            if token.pos not in _CLOSED_CLASS or not token.interactive:
                continue
            checked += 1
            result = dictionary.look_up(token.surface, token.lemma or token.surface, token.pos)
            if not result.words:
                empties.append(f"{token.surface} (lemma {token.lemma}, {token.pos})")
    assert checked > 0
    assert not empties, f"closed-class tokens with no popup entry: {sorted(set(empties))}"


def test_masu_headword_is_kana_not_symbol(dictionary: Dictionary) -> None:
    """The polite auxiliary ます must show ます as its headword, not the rare 〼
    (U+303C) ligature JMdict lists as its 'kanji' form."""
    result = dictionary.look_up("ます", "ます", "auxiliary")
    assert result.words
    assert result.words[0].text == "ます"
    assert "〼" not in result.words[0].text


def test_koto_formal_noun_ranks_above_homophones(dictionary: Dictionary) -> None:
    """For a kana こと surface (the 〜たことがある case), the formal noun 事 ranks
    first and the unrelated kanji homophones (古都 'ancient city', 琴 'koto') are
    dropped as reading-noise."""
    result = dictionary.look_up("こと", "こと", "noun")
    texts = [w.text for w in result.words]
    assert texts[0] == "事"
    assert "古都" not in texts
    assert "琴" not in texts


@pytest.mark.parametrize(
    "sentence,fused_surface,expected_gloss",
    [
        ("難しいかな。", "かな", "wonder"),
        ("雨が降るかも。", "かも", "may"),
        ("東京とか大阪。", "とか", "and the like"),
        ("いいですよね。", "よね", "right?"),
        ("なんか疲れた。", "なんか", "something like"),
    ],
)
def test_fused_particle_merges_and_resolves(
    tokenizer: Tokenizer,
    dictionary: Dictionary,
    sentence: str,
    fused_surface: str,
    expected_gloss: str,
) -> None:
    """A fused particle must survive tokenisation as one token (not split into
    single-kana homophone noise) and resolve to its fused meaning."""
    tokens = tokenizer.tokenize(sentence)
    surfaces = [t.surface for t in tokens]
    assert fused_surface in surfaces, f"{fused_surface} did not merge; got {surfaces}"
    token = next(t for t in tokens if t.surface == fused_surface)
    result = dictionary.look_up(token.surface, token.lemma, token.pos)
    glosses = [g.lower() for w in result.words for s in w.senses for g in s.glosses]
    assert any(expected_gloss.lower() in g for g in glosses), (
        f"{fused_surface} missing '{expected_gloss}'; got {glosses[:6]}"
    )
