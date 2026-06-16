"""Generate candidate fused-particle surfaces for the tokenizer allowlist.

Sudachi (even in split mode C) splits some multi-kana grammatical words —
particles, conjunctions, sentence-final expressions — into their single-kana
components (とか → と+か, かな → か+な). Each component then resolves to a wall of
unrelated single-kana homophones in hover-lookup, instead of JMdict's dedicated
entry for the fused word.

``tokenizer._FUSED_PARTICLES`` re-merges a curated, human-reviewed allowlist of
these. This utility produces the *candidate* list to review: every short,
kana-only JMdict entry, tagged as a grammatical word (particle / conjunction /
interjection / auxiliary), that Sudachi actually splits. The merge is safe only
where the components essentially never occur adjacently with an unrelated
meaning — e.g. と (quotation) + も (also) collides with the fused とも, so とも is
*not* safe to auto-merge. That judgement is per-entry and can't be inferred from
the dictionary, which is why the runtime allowlist stays human-curated.

Workflow: run this after a dictionary rebuild, eyeball the output, and fold the
unambiguous rows into ``_FUSED_PARTICLES``. Reads the compiled SQLite directly,
so no re-download is needed.

    uv run --directory backend python scripts/find_fused_particles.py
"""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

from sudachipy import Dictionary, SplitMode

# Anchor to the backend root (this file lives at backend/scripts/).
BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = BACKEND_ROOT / "data" / "dictionary.sqlite"

# Ensure UTF-8 stdout so the Japanese candidate list never mojibakes on Windows.
sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]

# Only short grammatical glue is worth merging; phrasal "expression" entries and
# longer surfaces are out of scope (they aren't single hover targets a learner
# looks up). JMdict spells the category as a leading word in each POS string.
_GRAMMATICAL_PREFIXES = ("particle", "conjunction", "interjection", "auxiliary")
_MAX_LEN = 4


def _is_kana(ch: str) -> bool:
    return "぀" <= ch <= "ヿ"


def _grammatical_pos(senses: list[dict]) -> str | None:
    """Return the first grammatical POS category among ``senses``, or None."""
    for sense in senses:
        for pos in sense.get("pos", []):
            for prefix in _GRAMMATICAL_PREFIXES:
                if pos.startswith(prefix):
                    return prefix
    return None


def main() -> int:
    if not DEFAULT_DB_PATH.exists():
        print(f"No dictionary at {DEFAULT_DB_PATH}. Run build_dictionaries.py first.")
        return 1

    tokenizer = Dictionary().create()
    conn = sqlite3.connect(f"file:{DEFAULT_DB_PATH}?mode=ro", uri=True)
    try:
        rows = conn.execute("SELECT data FROM words ORDER BY priority").fetchall()
    finally:
        conn.close()

    seen: set[str] = set()
    candidates: list[tuple[str, str, list[str], list[str]]] = []
    for (data,) in rows:
        record = json.loads(data)
        if record["kanji"]:  # kana-only entries only; kanji forms tokenise fine.
            continue
        category = _grammatical_pos(record["senses"])
        if category is None:
            continue
        for surface in record["kana"]:
            if not (2 <= len(surface) <= _MAX_LEN) or surface in seen:
                continue
            if not all(_is_kana(ch) for ch in surface):
                continue
            morphemes = tokenizer.tokenize(surface, SplitMode.C)
            if len(morphemes) < 2:  # Sudachi keeps it whole — nothing to merge.
                continue
            seen.add(surface)
            parts = [m.surface() for m in morphemes]
            glosses = [g for sense in record["senses"] for g in sense["glosses"]]
            candidates.append((surface, category, parts, glosses[:3]))

    candidates.sort(key=lambda c: (c[1], c[0]))
    print(f"{len(candidates)} candidate fused surfaces (review before adding):\n")
    for surface, category, parts, glosses in candidates:
        print(f"  {surface:6} {category:13} {'+'.join(parts):12} {'; '.join(glosses)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
