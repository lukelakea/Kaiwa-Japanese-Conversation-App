"""Tests for defensive scenario parsing (brief §5, Phase 4 — Generated mode).

Mirrors the feedback parser's contract: extract the JSON object even amid
prose/fences, build a valid `Scenario`, and return ``None`` on malformed output
so the endpoint can surface a clean 502 + retry.
"""

from __future__ import annotations

import json

from app.api.scenario import _parse_scenario


def test_parse_valid_scenario() -> None:
    raw = json.dumps(
        {
            "title": "At the Post Office",
            "title_ja": "郵便局で",
            "description": "Sending a parcel overseas.",
            "user_role": "Customer",
            "ai_role": "Postal clerk",
        }
    )
    scenario = _parse_scenario(raw)
    assert scenario is not None
    assert scenario.title == "At the Post Office"
    assert scenario.title_ja == "郵便局で"
    assert scenario.ai_role == "Postal clerk"


def test_parse_strips_surrounding_prose() -> None:
    raw = (
        "Here you go:\n"
        '{"title":"A","title_ja":"あ","description":"d","user_role":"u","ai_role":"a"}'
    )
    scenario = _parse_scenario(raw)
    assert scenario is not None
    assert scenario.title_ja == "あ"


def test_missing_fields_default_to_empty_strings() -> None:
    # Partial objects still parse (empty strings); the model is trusted to fill
    # them, and an empty scene degrades gracefully rather than 502-ing.
    scenario = _parse_scenario('{"title": "Only a title"}')
    assert scenario is not None
    assert scenario.title == "Only a title"
    assert scenario.description == ""


def test_malformed_json_returns_none() -> None:
    assert _parse_scenario("not json") is None
    assert _parse_scenario("{nope") is None
    assert _parse_scenario("") is None
