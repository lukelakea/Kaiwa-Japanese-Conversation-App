"""API models for the Phase 3 feedback system (brief §8).

After the user sends a message, their message receives a short, non-intrusive
critique — a separate LLM call from the conversation reply. These schemas mirror
the frontend types in ``frontend/src/types/feedback.ts``; keep the two in sync.
"""

from enum import StrEnum

from pydantic import BaseModel, Field

from app.models.conversation import ConversationSettings


class FeedbackLabel(StrEnum):
    """Soft, non-exclusive tags for a correction (brief §8).

    A single correction may carry more than one — they are descriptive hints,
    not a rigid taxonomy.
    """

    grammar = "grammar"
    vocabulary = "vocabulary"
    phrasing = "phrasing"
    naturalness = "naturalness"


class FeedbackRequest(BaseModel):
    """Critique one user message, judged against the practiced register.

    ``context`` is the assistant turn the user is replying to (``None`` for the
    opening message); it is provided only so the model can judge whether the
    reply fits, never as something to critique. ``settings`` carries the target
    register/difficulty so feedback respects the level being practiced.
    """

    text: str = Field(..., min_length=1)
    context: str | None = None
    settings: ConversationSettings = ConversationSettings()


class FeedbackResponse(BaseModel):
    """A parsed, validated critique of the user's message."""

    # Whether the message is already natural and correct for the register.
    acceptable: bool
    labels: list[FeedbackLabel] = []
    # The corrected, natural Japanese. ``None`` when the message is acceptable.
    correction: str | None = None
    # Written in English (brief §8): a short confirmation, or what to change.
    explanation: str
