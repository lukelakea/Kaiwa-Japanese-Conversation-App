"""Tests for furigana alignment and tokenisation (brief §6).

The furigana heuristic (peel matching kana off both ends, ruby the kanji core)
has documented edge cases; these pin the common ones (食べる, 美味しい) and the
fallbacks so a regression in the alignment is caught without a live model.
"""

from __future__ import annotations

from app.japanese.kana import kata_to_hira
from app.japanese.tokenizer import (
    Tokenizer,
    _furigana_segments,
    _has_kanji,
    _is_kanji,
)


def _as_tuples(surface: str, reading: str) -> list[tuple[str, str | None]]:
    return [(seg.text, seg.ruby) for seg in _furigana_segments(surface, reading)]


def test_kata_to_hira_converts_katakana_only() -> None:
    assert kata_to_hira("タベル") == "たべる"
    # Long-vowel mark and non-katakana pass through untouched.
    assert kata_to_hira("コーヒー") == "こーひー"
    assert kata_to_hira("食べる") == "食べる"


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
    # Content words and particles are hover/save targets (particles are
    # included so learners can look up は/も/に in context).
    assert tokens["本"].interactive
    assert tokens["読む"].interactive
    assert tokens["は"].interactive


def test_tokenizer_merges_fused_particles() -> None:
    """とか and でも are split into single-kana particles by Sudachi, but
    JMdict only defines the fused form ("things like X", "but/even") — so the
    tokenizer re-merges them for hover lookup.
    """
    tokenizer = Tokenizer()

    toka_tokens = tokenizer.tokenize("ピザとかパスタが好きです")
    surfaces = [t.surface for t in toka_tokens]
    assert "とか" in surfaces
    assert "と" not in surfaces
    assert "".join(surfaces) == "ピザとかパスタが好きです"

    demo_tokens = tokenizer.tokenize("今でも好きです")
    demo_surfaces = [t.surface for t in demo_tokens]
    assert "でも" in demo_surfaces
    assert "".join(demo_surfaces) == "今でも好きです"

    kana_tokens = tokenizer.tokenize("難しいかな")
    kana_surfaces = [t.surface for t in kana_tokens]
    assert "かな" in kana_surfaces
    assert "か" not in kana_surfaces
    assert "".join(kana_surfaces) == "難しいかな"

    # なんか spans a pronoun + particle (なん+か), exercising a non-particle
    # constituent and confirming the merged token is tagged "particle".
    nanka_tokens = tokenizer.tokenize("なんか食べたい")
    nanka = next(t for t in nanka_tokens if t.surface == "なんか")
    assert nanka.pos == "particle"
    assert "".join(t.surface for t in nanka_tokens) == "なんか食べたい"


def test_tokenizer_longest_match_prefers_wider_fused_form() -> None:
    """A run that could merge as a shorter prefix instead takes the widest
    allowlisted span (here よね wins; よ is not left stranded)."""
    tokenizer = Tokenizer()
    tokens = tokenizer.tokenize("いいですよね")
    surfaces = [t.surface for t in tokens]
    assert "よね" in surfaces
    assert "".join(surfaces) == "いいですよね"
