"""Tests for defensive feedback-response parsing (brief §8, Phase 3).

`json_mode` constrains the model to JSON, but a local model can still drift on
the schema's finer points, so the endpoint validates defensively. These pin
that contract: brace extraction, label filtering, and the rule that an
acceptable message carries no labels or correction.
"""

from __future__ import annotations

import json

from app.api.feedback import _extract_json_object, _parse_feedback


def test_parse_correction_with_labels() -> None:
    raw = json.dumps(
        {
            "acceptable": False,
            "labels": ["grammar", "naturalness"],
            "correction": "学校に行きました。",
            "explanation": "Use に for the destination.",
        }
    )
    result = _parse_feedback(raw)
    assert result is not None
    assert result.acceptable is False
    assert [label.value for label in result.labels] == ["grammar", "naturalness"]
    assert result.correction == "学校に行きました。"
    assert result.explanation == "Use に for the destination."


def test_acceptable_message_clears_labels_and_correction() -> None:
    # The model may erroneously attach labels/correction to an acceptable
    # message; the parser must drop them.
    raw = json.dumps(
        {
            "acceptable": True,
            "labels": ["grammar"],
            "correction": "something",
            "explanation": "Looks natural.",
        }
    )
    result = _parse_feedback(raw)
    assert result is not None
    assert result.acceptable is True
    assert result.labels == []
    assert result.correction is None


def test_invalid_labels_are_filtered_out() -> None:
    raw = json.dumps(
        {
            "acceptable": False,
            "labels": ["grammar", "spelling", 42, "vocabulary"],
            "correction": "x",
            "explanation": "y",
        }
    )
    result = _parse_feedback(raw)
    assert result is not None
    assert [label.value for label in result.labels] == ["grammar", "vocabulary"]


def test_extracts_json_from_surrounding_prose_and_fences() -> None:
    raw = 'Sure! ```json\n{"acceptable": true, "explanation": "Good."}\n``` done'
    result = _parse_feedback(raw)
    assert result is not None
    assert result.acceptable is True
    assert result.explanation == "Good."


def test_missing_explanation_uses_fallback() -> None:
    accepted = _parse_feedback('{"acceptable": true}')
    assert accepted is not None
    assert accepted.explanation  # non-empty fallback
    rejected = _parse_feedback('{"acceptable": false}')
    assert rejected is not None
    assert rejected.explanation


def test_malformed_json_returns_none() -> None:
    assert _parse_feedback("not json at all") is None
    assert _parse_feedback("{broken") is None
    assert _parse_feedback("") is None


def test_extract_json_object_handles_no_braces() -> None:
    assert _extract_json_object("no object here") is None
    assert _extract_json_object("}{") is None
