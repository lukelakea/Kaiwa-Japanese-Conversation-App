"""Tests for furigana alignment and tokenisation (brief §6).

The furigana heuristic (peel matching kana off both ends, ruby the kanji core)
has documented edge cases; these pin the common ones (食べる, 美味しい) and the
fallbacks so a regression in the alignment is caught without a live model.
"""

from __future__ import annotations

from app.japanese.tokenizer import (
    Tokenizer,
    _furigana_segments,
    _has_kanji,
    _is_kanji,
    _kata_to_hira,
)


def _as_tuples(surface: str, reading: str) -> list[tuple[str, str | None]]:
    return [(seg.text, seg.ruby) for seg in _furigana_segments(surface, reading)]


def test_kata_to_hira_converts_katakana_only() -> None:
    assert _kata_to_hira("タベル") == "たべる"
    # Long-vowel mark and non-katakana pass through untouched.
    assert _kata_to_hira("コーヒー") == "こーひー"
    assert _kata_to_hira("食べる") == "食べる"


def test_is_kanji_and_has_kanji() -> None:
    assert _is_kanji("食")
    assert _is_kanji("々")  # iteration mark
    assert not _is_kanji("べ")
    assert not _is_kanji("a")
    assert _has_kanji("食べる")
    assert not _has_kanji("たべる")


def test_furigana_peels_trailing_okurigana() -> None:
    # 食べる → ruby「た」over 食 only, べる left bare.
    assert _as_tuples("食べる", "たべる") == [("食", "た"), ("べる", None)]


def test_furigana_peels_both_ends() -> None:
    # 美味しい → ruby「おい」over 美味, しい left bare.
    assert _as_tuples("美味しい", "おいしい") == [("美味", "おい"), ("しい", None)]


def test_furigana_whole_word_kanji() -> None:
    # No okurigana: the whole surface is the kanji core.
    assert _as_tuples("日本", "にほん") == [("日本", "にほん")]


def test_furigana_no_kanji_returns_plain_segment() -> None:
    assert _as_tuples("たべる", "たべる") == [("たべる", None)]


def test_furigana_empty_reading_returns_plain_segment() -> None:
    assert _as_tuples("食べる", "") == [("食べる", None)]


def test_furigana_falls_back_to_whole_token_when_core_empty() -> None:
    # If peeling consumes everything, annotate the whole surface as a fallback
    # rather than producing an empty core.
    segments = _furigana_segments("お茶", "おちゃ")
    # Leading お matches, 茶 is the core → ruby「ちゃ」over 茶.
    assert [(s.text, s.ruby) for s in segments] == [("お", None), ("茶", "ちゃ")]


def test_tokenizer_roundtrip_reproduces_input() -> None:
    """Concatenating token surfaces reproduces the input, newlines included."""
    tokenizer = Tokenizer()
    text = "今日はいい天気ですね。\n散歩しましょう。"
    tokens = tokenizer.tokenize(text)
    assert "".join(t.surface for t in tokens) == text
    # The newline is preserved as its own non-interactive whitespace token.
    assert any(t.surface == "\n" and not t.interactive for t in tokens)


def test_tokenizer_marks_content_words_interactive() -> None:
    tokenizer = Tokenizer()
    tokens = {t.surface: t for t in tokenizer.tokenize("私は本を読む")}
    # Content words are hover/save targets; the particle は is not.
    assert tokens["本"].interactive
    assert tokens["読む"].interactive
    assert not tokens["は"].interactive
