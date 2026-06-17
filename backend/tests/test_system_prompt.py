"""Tests for system-prompt composition (brief §4, §5).

The prompt is the single place behavior-shaping lives, so these assert that
each setting and mode contributes its fragment and that the structure is stable
across the full settings matrix — the contract feature code depends on.
"""

from __future__ import annotations

import itertools

import pytest

from app.models.conversation import (
    ConversationMode,
    ConversationSettings,
    Difficulty,
    Formality,
    Initiative,
    Scenario,
)
from app.prompts import compose_system_prompt

# Marker phrases unique to each setting's fragment, so a test asserts the right
# branch was selected rather than re-stating the full prompt text.
_DIFFICULTY_MARKERS = {
    Difficulty.beginner: "very simple Japanese",
    Difficulty.intermediate: "everyday conversational Japanese",
    Difficulty.advanced: "idiomatic expressions",
    Difficulty.near_fluent: "another fluent adult",
}
_FORMALITY_MARKERS = {
    Formality.casual: "友達言葉",
    Formality.friendly: "warm, friendly register",
    Formality.polite: "です・ます",
    Formality.formal: "敬語",
}
_INITIATIVE_MARKERS = {
    Initiative.ai_led: "Actively drive the conversation",
    Initiative.balanced: "natural give-and-take",
    Initiative.user_led: "Let the user steer",
}


def _settings(difficulty: Difficulty, formality: Formality, initiative: Initiative):
    return ConversationSettings(difficulty=difficulty, formality=formality, initiative=initiative)


@pytest.mark.parametrize("difficulty", list(Difficulty))
def test_difficulty_fragment_selected(difficulty: Difficulty) -> None:
    prompt = compose_system_prompt(
        _settings(difficulty, Formality.polite, Initiative.balanced),
        ConversationMode.free_talk,
    )
    assert _DIFFICULTY_MARKERS[difficulty] in prompt
    # No other difficulty's marker leaks in.
    for other, marker in _DIFFICULTY_MARKERS.items():
        if other is not difficulty:
            assert marker not in prompt


@pytest.mark.parametrize("formality", list(Formality))
def test_formality_fragment_selected(formality: Formality) -> None:
    prompt = compose_system_prompt(
        _settings(Difficulty.intermediate, formality, Initiative.balanced),
        ConversationMode.free_talk,
    )
    assert _FORMALITY_MARKERS[formality] in prompt


@pytest.mark.parametrize("initiative", list(Initiative))
def test_initiative_fragment_selected(initiative: Initiative) -> None:
    prompt = compose_system_prompt(
        _settings(Difficulty.intermediate, Formality.polite, initiative),
        ConversationMode.free_talk,
    )
    assert _INITIATIVE_MARKERS[initiative] in prompt


def test_full_settings_matrix_always_includes_every_section() -> None:
    """Every combination yields the base rules, all three settings, and memory."""
    for difficulty, formality, initiative in itertools.product(Difficulty, Formality, Initiative):
        prompt = compose_system_prompt(
            _settings(difficulty, formality, initiative), ConversationMode.free_talk
        )
        assert "entirely in Japanese" in prompt  # base rules
        assert _DIFFICULTY_MARKERS[difficulty] in prompt
        assert _FORMALITY_MARKERS[formality] in prompt
        assert _INITIATIVE_MARKERS[initiative] in prompt
        assert "Track what has already been discussed" in prompt  # memory (§9)
        # Each composed section keeps its labelled heading.
        headings = ("Difficulty —", "Register —", "Initiative —", "Conversation —", "Continuity —")
        for heading in headings:
            assert heading in prompt


def test_free_talk_mode_uses_free_talk_framing() -> None:
    prompt = compose_system_prompt(ConversationSettings(), ConversationMode.free_talk)
    assert "open-ended free conversation" in prompt
    assert "playing the role of" not in prompt


def test_scenario_mode_injects_roles_and_scene() -> None:
    scenario = Scenario(
        title="Ordering at a Restaurant",
        title_ja="レストランで注文する",
        description="A casual restaurant; the waiter takes the order.",
        user_role="Customer",
        ai_role="Waiter",
    )
    prompt = compose_system_prompt(ConversationSettings(), ConversationMode.scenario, scenario)
    assert "playing the role of Waiter" in prompt
    assert "A casual restaurant" in prompt
    assert "Customer" in prompt
    assert "no prior messages" in prompt  # AI opens the scene (STATE decision 7)
    assert "open-ended free conversation" not in prompt


def test_scenario_mode_without_scenario_falls_back_to_free_talk() -> None:
    """Defensive: scenario mode but no scenario object → free-talk framing."""
    prompt = compose_system_prompt(ConversationSettings(), ConversationMode.scenario, None)
    assert "open-ended free conversation" in prompt


def test_generated_mode_uses_scenario_framing() -> None:
    scenario = Scenario(
        title="t",
        title_ja="t",
        description="d",
        user_role="u",
        ai_role="Interviewer",
    )
    prompt = compose_system_prompt(ConversationSettings(), ConversationMode.generated, scenario)
    assert "playing the role of Interviewer" in prompt
