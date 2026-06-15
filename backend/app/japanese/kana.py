"""Small kana-conversion helpers shared across the Japanese-language modules."""

from __future__ import annotations


def kata_to_hira(text: str) -> str:
    """Convert katakana to hiragana, leaving the long-vowel mark (ー) untouched."""
    out = []
    for ch in text:
        code = ord(ch)
        if 0x30A1 <= code <= 0x30F6:
            out.append(chr(code - 0x60))
        else:
            out.append(ch)
    return "".join(out)
