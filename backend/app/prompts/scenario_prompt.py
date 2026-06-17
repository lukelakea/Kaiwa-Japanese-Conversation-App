"""Prompts for LLM-generated conversation scenarios (brief §5 — Generated mode)."""

from app.models.conversation import ConversationSettings

GENERATE_SCENARIO_SYSTEM_PROMPT = """\
You generate scenario descriptions for a Japanese conversation practice app.
Return a single JSON object with exactly these keys:
{
  "title": "English scenario title (4–8 words)",
  "title_ja": "Japanese scenario title (6–15 characters)",
  "description": "One to two sentences describing the setting and situation in English.",
  "user_role": "The learner's role — who they are playing (English, 2–5 words)",
  "ai_role": "Your role — who you will play (English, 2–5 words)"
}

Rules:
- The scenario must be realistic and useful for practicing conversational Japanese.
- Make it specific enough to have clear conversational stakes (ordering something,
  asking for something, discussing something, meeting someone, etc.).
- The ai_role should speak in a register that fits the situation naturally.
- Do not include any text outside the JSON object."""


def compose_generate_scenario_input(
    theme: str | None,
    settings: ConversationSettings,
) -> str:
    theme_line = (
        f"Theme or topic requested by the learner: {theme}"
        if theme
        else "No specific theme — choose an interesting everyday situation."
    )
    return (
        f"Generate a Japanese conversation practice scenario.\n"
        f"{theme_line}\n"
        f"Target formality level: {settings.formality} "
        f"(the AI character should speak at roughly this register)\n"
        f"Learner difficulty: {settings.difficulty}"
    )
