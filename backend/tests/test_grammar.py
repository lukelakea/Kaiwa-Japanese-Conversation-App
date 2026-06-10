"""Tests for grammatical construction detection (brief §6).

Golden sentences pin the patterns that motivated the feature (してない,
食べていた, 行かなければ…, ですよ) plus the engine behaviours that are easy to
regress: contractions, gapped patterns, entry-point invariance, and sentence
boundaries. Uses the real SudachiPy tokenizer so the patterns stay grounded in
actual segmentation.
"""

from __future__ import annotations

import pytest

from app.japanese.grammar import detect_grammar
from app.japanese.tokenizer import Tokenizer
from app.models.reading import GrammarMatch, Token


@pytest.fixture(scope="module")
def tokenizer() -> Tokenizer:
    return Tokenizer()


def _detect(tokenizer: Tokenizer, text: str) -> tuple[list[Token], list[GrammarMatch]]:
    tokens = tokenizer.tokenize(text)
    return tokens, detect_grammar(tokens)


def _by_id(matches: list[GrammarMatch], pattern_id: str) -> GrammarMatch:
    found = [m for m in matches if m.pattern_id == pattern_id]
    assert found, f"expected a {pattern_id} match, got {[m.pattern_id for m in matches]}"
    return found[0]


def _span_text(tokens: list[Token], match: GrammarMatch) -> str:
    return "".join(tokens[i].surface for i in match.token_indices)


def test_contracted_te_nai_is_te_iru(tokenizer: Tokenizer) -> None:
    # してない = し+て(lemma てる)+ない — the contracted 〜ている, negated.
    tokens, matches = _detect(tokenizer, "してない")
    match = _by_id(matches, "te-iru-contracted")
    assert _span_text(tokens, match) == "してない"


def test_tabete_ita_covers_progressive_past(tokenizer: Tokenizer) -> None:
    tokens, matches = _detect(tokenizer, "食べていた")
    match = _by_id(matches, "te-iru")
    # The trailing た is absorbed so the span reads "was eating".
    assert _span_text(tokens, match) == "食べていた"
    # The layered past-tense match (い+た) is also reported.
    assert any(m.pattern_id == "plain-past" for m in matches)


def test_obligation_chain(tokenizer: Tokenizer) -> None:
    tokens, matches = _detect(tokenizer, "行かなければならない")
    must = _by_id(matches, "nakereba-naranai")
    assert _span_text(tokens, must) == "行かなければならない"
    # The nested "if not" reading is reported too — layers are pedagogy.
    assert _span_text(tokens, _by_id(matches, "nakereba")) == "行かなければ"


def test_obligation_polite_and_casual_variants(tokenizer: Tokenizer) -> None:
    _, matches = _detect(tokenizer, "行かなければなりません")
    assert any(m.pattern_id == "nakereba-naranai" for m in matches)
    _, matches = _detect(tokenizer, "行かなきゃ")
    assert any(m.pattern_id == "nakya" for m in matches)
    _, matches = _detect(tokenizer, "食べなくちゃ")
    assert any(m.pattern_id == "nakucha" for m in matches)


def test_desu_yo_assertion(tokenizer: Tokenizer) -> None:
    tokens, matches = _detect(tokenizer, "そうですよ")
    match = _by_id(matches, "yo-assertion")
    assert _span_text(tokens, match) == "ですよ"


def test_te_shimau_and_contraction(tokenizer: Tokenizer) -> None:
    tokens, matches = _detect(tokenizer, "忘れてしまった")
    assert _span_text(tokens, _by_id(matches, "te-shimau")) == "忘れてしまった"
    tokens, matches = _detect(tokenizer, "忘れちゃった")
    assert _span_text(tokens, _by_id(matches, "te-shimau-contracted")) == "忘れちゃった"


def test_ba_hodo_long_range_with_gap(tokenizer: Tokenizer) -> None:
    tokens, matches = _detect(tokenizer, "読めば読むほど面白い")
    match = _by_id(matches, "ba-hodo")
    assert _span_text(tokens, match) == "読めば読むほど"
    # The plain conditional inside it is reported as its own layer.
    assert any(m.pattern_id == "ba-conditional" for m in matches)


def test_tari_tari_spans_listed_actions(tokenizer: Tokenizer) -> None:
    tokens, matches = _detect(tokenizer, "本を読んだり、音楽を聴いたりする")
    match = _by_id(matches, "tari-tari")
    # Non-contiguous: the gap (、音楽を) is not part of the match.
    assert _span_text(tokens, match) == "読んだり聴いたりする"
    indices = match.token_indices
    assert indices != list(range(indices[0], indices[-1] + 1))


def test_match_indices_support_any_entry_point(tokenizer: Tokenizer) -> None:
    """Every token of してない maps to the same construction match."""
    tokens, matches = _detect(tokenizer, "してない")
    match = _by_id(matches, "te-iru-contracted")
    surfaces = {tokens[i].surface for i in match.token_indices}
    assert surfaces == {"し", "て", "ない"}


def test_constructions_do_not_cross_sentence_boundaries(tokenizer: Tokenizer) -> None:
    # 読めば。読むほど — the ば〜ほど gap must not skip over the 。.
    _, matches = _detect(tokenizer, "読めば。読むほど")
    assert not any(m.pattern_id == "ba-hodo" for m in matches)


def test_common_constructions_detected(tokenizer: Tokenizer) -> None:
    cases = {
        "食べてください": "te-kudasai",
        "食べないでください": "naide-kudasai",
        "食べてもいいですか": "te-mo-ii",
        "行ってはいけない": "te-wa-ikenai",
        "食べちゃだめ": "cha-dame",
        "雨が降るかもしれない": "kamoshirenai",
        "やってみる": "te-miru",
        "買っておく": "te-oku",
        "買っとく": "te-oku-contracted",
        "手伝ってくれる": "te-kureru",
        "教えてもらう": "te-morau",
        "買ってあげる": "te-ageru",
        "行きたくない": "tai",
        "泳ぐことができる": "koto-ga-dekiru",
        "行くんです": "n-desu",
        "話せるようになった": "you-ni-naru",
        "早く寝るようにする": "you-ni-suru",
        "食べました": "masu-polite",
        "行かない": "negative-nai",
        "いいですね": "ne-agreement",
    }
    for text, pattern_id in cases.items():
        _, matches = _detect(tokenizer, text)
        assert any(m.pattern_id == pattern_id for m in matches), (
            f"{text}: expected {pattern_id}, got {[m.pattern_id for m in matches]}"
        )


def test_matches_sorted_by_position_then_length(tokenizer: Tokenizer) -> None:
    _, matches = _detect(tokenizer, "行かなければならない")
    starts = [m.token_indices[0] for m in matches]
    assert starts == sorted(starts)
    # Same start: the longer (more informative) span comes first.
    first_two = [m for m in matches if m.token_indices[0] == starts[0]]
    spans = [m.token_indices[-1] - m.token_indices[0] for m in first_two]
    assert spans == sorted(spans, reverse=True)


def test_plain_text_produces_no_matches(tokenizer: Tokenizer) -> None:
    _, matches = _detect(tokenizer, "私は学生")
    assert matches == []
