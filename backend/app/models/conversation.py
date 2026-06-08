"""Domain models for a conversation turn.

These Pydantic schemas define the API contract with the frontend. The string
enums mirror the labels in the project brief (§4, §5) and are kept
provider-agnostic — they describe *what the user wants*, not how any specific
model is prompted. Prompt composition lives in ``app.prompts``.
"""

from enum import StrEnum

from pydantic import BaseModel, Field


class Role(StrEnum):
    user = "user"
    assistant = "assistant"


class Difficulty(StrEnum):
    """How complex the AI's Japanese is (brief §4.1)."""

    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"
    near_fluent = "near_fluent"


class Formality(StrEnum):
    """Speech register the AI uses (brief §4.2)."""

    casual = "casual"
    friendly = "friendly"
    polite = "polite"
    formal = "formal"


class Initiative(StrEnum):
    """Who drives the conversation (brief §4.3)."""

    ai_led = "ai_led"
    balanced = "balanced"
    user_led = "user_led"


class ConversationMode(StrEnum):
    """How a conversation is framed (brief §5). Phase 1 ships free_talk only."""

    free_talk = "free_talk"
    scenario = "scenario"
    generated = "generated"


class ConversationSettings(BaseModel):
    """The three behaviour-shaping settings, adjustable mid-conversation."""

    difficulty: Difficulty = Difficulty.intermediate
    formality: Formality = Formality.polite
    initiative: Initiative = Initiative.balanced


class Message(BaseModel):
    role: Role
    content: str


class ChatRequest(BaseModel):
    """A single conversational turn request.

    The full history is sent each turn (brief §9 — history-in-context, no RAG).
    Settings are sent every turn so changes take effect on subsequent turns.
    """

    messages: list[Message] = Field(..., min_length=1)
    settings: ConversationSettings = ConversationSettings()
    mode: ConversationMode = ConversationMode.free_talk
