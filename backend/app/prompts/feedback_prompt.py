"""System prompt for the per-message feedback pass (brief §8, Phase 3).

Feedback is its own LLM call, independent of the conversation reply, so the two
run in parallel: the critique depends only on the user's message and the turn it
replies to, never on the assistant's answer. It evaluates the user's Japanese
against the register they are practicing and is asked to emit a single JSON
object the UI renders as a collapsible annotation.
"""

from app.models.conversation import ConversationSettings, Formality

# How the learner's *target* register is described to the critic. Phrased as the
# standard they are practicing against (distinct from app.prompts.system_prompt,
# which tells the AI how to speak) — so casual practice is never "corrected" up
# to です・ます, and vice versa.
_REGISTER_TARGET: dict[Formality, str] = {
    Formality.casual: "casual speech with close friends (友達言葉 — plain/dictionary form)",
    Formality.friendly: "a warm, friendly register for peers and acquaintances",
    Formality.polite: "polite Japanese (です・ます / 丁寧語)",
    Formality.formal: "formal, respectful Japanese (敬語)",
}

_INSTRUCTIONS = """\
You are a supportive Japanese tutor giving quick feedback on ONE message a \
learner wrote during a conversation. Judge only the learner's message. Any \
context is provided solely so you can tell whether their reply makes sense — do \
not critique the context.

Assess whether the message is natural, correct Japanese for the register the \
learner is practicing. Be encouraging and proportionate: only flag things a \
native speaker would actually notice or that impede understanding. Minor, \
acceptable stylistic choices are fine. Never ask them to switch to a different \
register than the one they are practicing.

Reply with a SINGLE JSON object with exactly these keys:
- "acceptable": boolean — true when the message is already natural and correct \
(small imperfections that don't matter still count as acceptable); false when it \
would genuinely benefit from correction.
- "labels": array — any of "grammar", "vocabulary", "phrasing", "naturalness" \
that apply (often more than one). Use [] when acceptable.
- "correction": string — when not acceptable, the corrected, natural Japanese \
in the target register. Use "" when acceptable.
- "explanation": string in ENGLISH — when not acceptable, briefly say what to \
change and why, naming the corrected phrasing; when acceptable, a short \
encouraging note. One or two sentences.

Output only the JSON object: no markdown, no code fences, no text around it. \
Write "explanation" in English even though the conversation is in Japanese."""


def compose_feedback_prompt(settings: ConversationSettings) -> str:
    """Assemble the feedback system prompt for the learner's target register."""
    target = _REGISTER_TARGET[settings.formality]
    return f"{_INSTRUCTIONS}\n\nThe learner is practicing {target}."


def format_feedback_input(text: str, context: str | None) -> str:
    """Build the user-role payload: the message to grade, with optional context."""
    replying_to = (
        context.strip() if context and context.strip() else "(this is the opening message)"
    )
    return (
        f"The learner is replying to (context only, do not critique this):\n{replying_to}\n\n"
        f"The learner's message to evaluate:\n{text.strip()}"
    )
