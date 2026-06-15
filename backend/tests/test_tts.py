"""Tests for TTS mora-timing extraction (Phase 5)."""

from __future__ import annotations

from app.api.tts import _extract_mora_timings


def _mora(text: str, consonant_length: float | None, vowel_length: float) -> dict:
    return {
        "text": text,
        "consonant": "k" if consonant_length is not None else None,
        "consonant_length": consonant_length,
        "vowel": "a",
        "vowel_length": vowel_length,
        "pitch": 5.0,
    }


def test_extract_mora_timings_offsets_by_pre_phoneme_length() -> None:
    query = {
        "prePhonemeLength": 0.1,
        "accent_phrases": [
            {
                "moras": [_mora("コ", 0.05, 0.1), _mora("ン", None, 0.1)],
                "accent": 1,
                "pause_mora": None,
            }
        ],
    }

    timings = _extract_mora_timings(query)

    assert [t.text for t in timings] == ["こ", "ん"]
    assert timings[0].start == 0.1
    assert timings[0].end == 0.1 + 0.05 + 0.1
    assert timings[1].start == timings[0].end
    assert timings[1].end == timings[1].start + 0.1


def test_extract_mora_timings_folds_pause_into_previous_mora() -> None:
    query = {
        "prePhonemeLength": 0.0,
        "accent_phrases": [
            {
                "moras": [_mora("ハ", 0.05, 0.1)],
                "accent": 1,
                "pause_mora": {"text": "、", "vowel": "pau", "vowel_length": 0.3},
            },
            {
                "moras": [_mora("イ", None, 0.1)],
                "accent": 1,
                "pause_mora": None,
            },
        ],
    }

    timings = _extract_mora_timings(query)

    assert len(timings) == 2
    # The 0.3s pause is folded into the first mora's end, not emitted on its own.
    assert timings[0].end == 0.05 + 0.1 + 0.3
    assert timings[1].start == timings[0].end
