"""Quick A/B harness: do models stay in Japanese, on-topic, and in-register?

Hits Ollama's /api/chat directly with the *real* composed system prompt across a
short Japanese conversation, for several (model, temperature) combinations. Flags
replies that leak non-Japanese scripts (Latin / Cyrillic / Hangul / Arabic) or
simplified-Chinese-only characters.

Run:  uv run python scripts/eval_models.py
"""

import re
import sys
from pathlib import Path

import httpx

# Make the script runnable directly (uv run python scripts/eval_models.py) by
# putting the backend root on the path, and force UTF-8 stdout so Japanese
# prints on Windows consoles (cp1252) without mojibake.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

from app.models.conversation import (  # noqa: E402 — after sys.path bootstrap above
    ConversationMode,
    ConversationSettings,
    Formality,
)
from app.prompts import compose_system_prompt  # noqa: E402

OLLAMA = "http://localhost:11434"

# A casual conversation that previously triggered Chinese leakage.
SETTINGS = ConversationSettings(formality=Formality.casual)
TURNS = [
    "昨日友達とラーメンを食べに行ったよ。すごく美味しかった！",
    "うん、とんこつラーメンが一番好きなんだ。○○さんは何が好き？",
    "へえ、いいね。週末はどこか出かけたりするの？",
]

COMBOS = [
    ("qwen2.5:32b", 0.7),
    ("qwen2.5:32b", 0.4),
    ("qwen2.5:32b", 0.2),
    ("gemma3:27b", 0.7),
    ("gemma3:27b", 0.4),
]

# Simplified-Chinese / grammatical markers that do not occur in normal Japanese.
_CHINESE_MARKERS = "了吗呢的很我们这那觉得喜欢请什么吃东西时候这个"
_LATIN_CYRILLIC_ETC = re.compile(r"[A-Za-zЀ-ӿ가-힯؀-ۿ]")
_KANA = re.compile(r"[぀-ヿ]")


def leak_flags(text: str) -> list[str]:
    flags = []
    if _LATIN_CYRILLIC_ETC.search(text):
        flags.append("latin/cyrillic/hangul/arabic")
    cn = {ch for ch in text if ch in _CHINESE_MARKERS}
    if cn:
        flags.append(f"chinese-markers:{''.join(sorted(cn))}")
    if not _KANA.search(text):
        flags.append("no-kana")
    return flags


def chat(client: httpx.Client, model: str, temperature: float, system: str, history: list[dict]):
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system}, *history],
        "stream": False,
        "options": {"temperature": temperature},
    }
    resp = client.post(f"{OLLAMA}/api/chat", json=payload, timeout=120.0)
    resp.raise_for_status()
    return resp.json()["message"]["content"].strip()


def main() -> int:
    system = compose_system_prompt(SETTINGS, ConversationMode.free_talk)
    total_leaks = 0
    with httpx.Client() as client:
        for model, temp in COMBOS:
            print(f"\n{'=' * 70}\n{model}  temp={temp}\n{'=' * 70}")
            history: list[dict] = []
            for turn in TURNS:
                history.append({"role": "user", "content": turn})
                reply = chat(client, model, temp, system, history)
                history.append({"role": "assistant", "content": reply})
                flags = leak_flags(reply)
                total_leaks += len(flags)
                marker = f"  ⚠ {flags}" if flags else "  ✓"
                print(f"\n  USER: {turn}")
                print(f"  AI:   {reply}{marker}")
    print(f"\n\nTotal leak flags across all combos: {total_leaks}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
