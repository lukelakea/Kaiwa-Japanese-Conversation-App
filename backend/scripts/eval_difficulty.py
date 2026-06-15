"""Quick check: do the four Difficulty levels actually produce different output?

Hits Ollama's /api/chat directly with the *real* composed system prompt for the
default model, running the same short conversation once per Difficulty level
(formality/initiative held at defaults). Prints replies plus rough complexity
signals (length, unique kanji, sentence count) so the levels can be compared.

Run:  uv run python scripts/eval_difficulty.py
"""

import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

from app.models.conversation import (  # noqa: E402
    ConversationMode,
    ConversationSettings,
    Difficulty,
)
from app.prompts import compose_system_prompt  # noqa: E402

OLLAMA = "http://localhost:11434"
MODEL = "gemma3:27b"
TEMPERATURE = 0.7

TURNS = [
    "こんにちは！今日は何をしましたか？",
    "週末は友達と映画を見に行く予定なんです。おすすめの映画ありますか？",
    "実は最近、仕事でちょっと困ったことがあって、誰かに相談したいんです。",
]

KANJI = range(0x4E00, 0x9FFF)


def complexity(text: str) -> str:
    kanji = {ch for ch in text if ord(ch) in KANJI}
    sentences = sum(text.count(c) for c in "。！？")
    return f"len={len(text)} chars, unique_kanji={len(kanji)}, sentences~={sentences}"


def chat(client: httpx.Client, system: str, history: list[dict]) -> str:
    payload = {
        "model": MODEL,
        "messages": [{"role": "system", "content": system}, *history],
        "stream": False,
        "options": {"temperature": TEMPERATURE},
    }
    resp = client.post(f"{OLLAMA}/api/chat", json=payload, timeout=120.0)
    resp.raise_for_status()
    return resp.json()["message"]["content"].strip()


def main() -> int:
    with httpx.Client() as client:
        for difficulty in Difficulty:
            settings = ConversationSettings(difficulty=difficulty)
            system = compose_system_prompt(settings, ConversationMode.free_talk)
            print(f"\n{'=' * 70}\nDifficulty: {difficulty.value}\n{'=' * 70}")
            history: list[dict] = []
            for turn in TURNS:
                history.append({"role": "user", "content": turn})
                reply = chat(client, system, history)
                history.append({"role": "assistant", "content": reply})
                print(f"\n  USER: {turn}")
                print(f"  AI:   {reply}")
                print(f"        [{complexity(reply)}]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
