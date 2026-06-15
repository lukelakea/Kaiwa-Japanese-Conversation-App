"""Build the local reading-aids dictionary (Phase 2).

Downloads two datasets from the `jmdict-simplified` project (same maintainer,
same clean JSON schema for both) and compiles them into a single SQLite file
that the backend queries for hover-lookup:

  * **JMdict** (English) — word-level definitions, keyed by every kanji form and
    kana reading so a token can be looked up by its dictionary form, surface, or
    reading.
  * **KANJIDIC2** (English) — per-kanji on/kun readings and meanings.

Why KANJIDIC2 rather than the brief's `kanjium`: KANJIDIC2 is the canonical
source for kanji *readings and meanings* (kanjium is primarily a pitch-accent
dataset), and it ships as clean JSON from the very same release as JMdict — one
source, one format, one parsing path. See STATE.md for the full rationale.

The script is idempotent: it skips work when the existing DB was already built
from the latest release. Run it via `npm run setup:dict`, or directly:

    uv run --directory backend python scripts/build_dictionaries.py [--force]

It is a standalone dev utility (no FastAPI imports) so it can run before the app
is ever started — including from `npm run setup`.
"""

from __future__ import annotations

import argparse
import io
import json
import sqlite3
import sys
import tarfile
from collections.abc import Iterator
from pathlib import Path

import httpx

# Anchor outputs to the backend root (this file lives at backend/scripts/).
BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = BACKEND_ROOT / "data" / "dictionary.sqlite"

GITHUB_LATEST_RELEASE = "https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest"
# Asset name prefixes we want from the release (full English editions).
JMDICT_PREFIX = "jmdict-eng-"
KANJIDIC_PREFIX = "kanjidic2-en-"

# Ensure UTF-8 stdout so progress logs with Japanese never mojibake on Windows.
sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]


def log(message: str) -> None:
    print(message, flush=True)


# --------------------------------------------------------------------------- #
# Download + extract
# --------------------------------------------------------------------------- #


def fetch_latest_release() -> dict:
    """Return the latest jmdict-simplified release metadata from GitHub."""
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        response = client.get(
            GITHUB_LATEST_RELEASE,
            headers={"Accept": "application/vnd.github+json"},
        )
        response.raise_for_status()
        return response.json()


def find_asset(release: dict, prefix: str) -> dict:
    """Find the single `.json.tgz` asset whose name starts with ``prefix``."""
    for asset in release["assets"]:
        name = asset["name"]
        if name.startswith(prefix) and name.endswith(".json.tgz"):
            return asset
    raise RuntimeError(
        f"No '{prefix}*.json.tgz' asset in release {release.get('tag_name')!r}. "
        "The release layout may have changed."
    )


def download_and_extract_json(url: str, label: str) -> dict:
    """Stream a `.json.tgz` asset into memory and return the parsed JSON.

    The archives hold a single JSON file; we read it straight out of the tar
    without touching disk. The compressed assets are small (≤ ~12 MB).
    """
    log(f"  downloading {label} …")
    with httpx.Client(timeout=120.0, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        payload = response.content

    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as tar:
        member = next((m for m in tar.getmembers() if m.name.endswith(".json")), None)
        if member is None:
            raise RuntimeError(f"{label}: archive contained no .json file.")
        extracted = tar.extractfile(member)
        if extracted is None:
            raise RuntimeError(f"{label}: could not read {member.name} from archive.")
        log(f"  parsing {label} ({member.size / 1_000_000:.1f} MB uncompressed) …")
        return json.load(extracted)


# --------------------------------------------------------------------------- #
# JMdict → rows
# --------------------------------------------------------------------------- #

# jmdict-simplified collapses JMdict's old priority tags (ichi1, news1, ...)
# into a single `common` boolean per kanji/kana form, which isn't granular
# enough to rank common-but-rare-kanji homophones (e.g. 事 vs 琴, both "common")
# against each other. KANJIDIC2's per-kanji frequency rank (1-2500, lower =
# more frequent) gives that finer signal, so priority = a coarse common/uncommon
# tier plus the most-frequent kanji in the entry's kanji forms as a tiebreaker.
_COMMON_SCORE = 0
_UNCOMMON_SCORE = 5000
_DEFAULT_KANJI_FREQ = 2500  # kana-only entries / kanji outside the top 2500


def _is_kanji(ch: str) -> bool:
    code = ord(ch)
    return 0x3400 <= code <= 0x9FFF or 0xF900 <= code <= 0xFAFF or ch == "々"


def _priority_score(
    kanji_forms: list[dict], kana_forms: list[dict], kanji_freq: dict[str, int]
) -> int:
    """Return a rank score for a JMdict entry (lower = more common)."""
    common = any(form.get("common") for form in kanji_forms + kana_forms)
    base = _COMMON_SCORE if common else _UNCOMMON_SCORE

    freq = _DEFAULT_KANJI_FREQ
    for form in kanji_forms:
        for ch in form["text"]:
            if _is_kanji(ch):
                freq = min(freq, kanji_freq.get(ch, _DEFAULT_KANJI_FREQ))

    return base + freq


def _gloss_texts(sense: dict) -> list[str]:
    return [g["text"] for g in sense.get("gloss", []) if g.get("lang", "eng") == "eng"]


def jmdict_word_rows(
    jmdict: dict, kanji_freq: dict[str, int]
) -> Iterator[tuple[dict, list[str], int]]:
    """Yield ``(compact_entry, lookup_keys, priority)`` for each JMdict word.

    ``compact_entry`` is the trimmed record stored as JSON; ``lookup_keys`` is
    every kanji form and kana reading the entry can be found by; ``priority`` is
    a rank score (lower = more common, see :func:`_priority_score`).
    """
    pos_names: dict[str, str] = jmdict.get("tags", {})

    for word in jmdict["words"]:
        kanji_forms = word.get("kanji", [])
        kana_forms = word.get("kana", [])
        kanji = [k["text"] for k in kanji_forms]
        kana = [k["text"] for k in kana_forms]

        senses = []
        for sense in word.get("sense", []):
            glosses = _gloss_texts(sense)
            if not glosses:
                continue
            pos = [pos_names.get(code, code) for code in sense.get("partOfSpeech", [])]
            senses.append({"pos": pos, "glosses": glosses})

        if not senses or not (kanji or kana):
            continue

        entry = {"kanji": kanji, "kana": kana, "senses": senses}
        keys = list(dict.fromkeys(kanji + kana))  # de-duped, order-preserving
        priority = _priority_score(kanji_forms, kana_forms, kanji_freq)
        yield entry, keys, priority


# --------------------------------------------------------------------------- #
# KANJIDIC2 → rows
# --------------------------------------------------------------------------- #


def kanji_frequency_lookup(kanjidic: dict) -> dict[str, int]:
    """Map each kanji literal to its KANJIDIC2 frequency rank (1-2500, lower = more frequent)."""
    lookup: dict[str, int] = {}
    for char in kanjidic["characters"]:
        freq = char.get("misc", {}).get("frequency")
        if freq is not None:
            lookup[char["literal"]] = freq
    return lookup


def kanjidic_kanji_rows(kanjidic: dict) -> Iterator[tuple[str, dict]]:
    """Yield ``(literal, compact_entry)`` for each kanji with reading/meaning data."""
    for char in kanjidic["characters"]:
        literal = char["literal"]
        reading_meaning = char.get("readingMeaning")
        if not reading_meaning:
            continue

        on: list[str] = []
        kun: list[str] = []
        meanings: list[str] = []
        for group in reading_meaning.get("groups", []):
            for reading in group.get("readings", []):
                if reading["type"] == "ja_on":
                    on.append(reading["value"])
                elif reading["type"] == "ja_kun":
                    kun.append(reading["value"])
            meanings.extend(m["value"] for m in group.get("meanings", []) if m.get("lang") == "en")

        if not (on or kun or meanings):
            continue

        misc = char.get("misc", {})
        stroke_counts = misc.get("strokeCounts") or []
        entry = {
            "on": on,
            "kun": kun,
            "meanings": meanings,
            "strokes": stroke_counts[0] if stroke_counts else None,
            "grade": misc.get("grade"),
            "jlpt": misc.get("jlptLevel"),
            "freq": misc.get("frequency"),
        }
        yield literal, entry


# --------------------------------------------------------------------------- #
# SQLite build
# --------------------------------------------------------------------------- #

_SCHEMA = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE words (
    id INTEGER PRIMARY KEY, priority INTEGER NOT NULL DEFAULT 99, data TEXT NOT NULL
);
CREATE TABLE word_lookup (key TEXT NOT NULL, word_id INTEGER NOT NULL);
CREATE TABLE kanji (literal TEXT PRIMARY KEY, data TEXT NOT NULL);
"""

# Index created *after* bulk insert — much faster than maintaining it per row.
_INDEXES = "CREATE INDEX idx_word_lookup_key ON word_lookup (key);"


def build_database(db_path: Path, jmdict: dict, kanjidic: dict, version: str) -> None:
    tmp_path = db_path.with_suffix(".sqlite.tmp")
    tmp_path.unlink(missing_ok=True)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(tmp_path)
    try:
        conn.executescript(_SCHEMA)

        kanji_freq = kanji_frequency_lookup(kanjidic)

        log("  writing words …")
        word_count = 0
        for entry, keys, priority in jmdict_word_rows(jmdict, kanji_freq):
            cursor = conn.execute(
                "INSERT INTO words (priority, data) VALUES (?, ?)",
                (priority, json.dumps(entry, ensure_ascii=False)),
            )
            word_id = cursor.lastrowid
            conn.executemany(
                "INSERT INTO word_lookup (key, word_id) VALUES (?, ?)",
                [(key, word_id) for key in keys],
            )
            word_count += 1

        log("  writing kanji …")
        kanji_rows = [
            (literal, json.dumps(entry, ensure_ascii=False))
            for literal, entry in kanjidic_kanji_rows(kanjidic)
        ]
        conn.executemany("INSERT INTO kanji (literal, data) VALUES (?, ?)", kanji_rows)

        log("  indexing …")
        conn.executescript(_INDEXES)

        conn.executemany(
            "INSERT INTO meta (key, value) VALUES (?, ?)",
            [
                ("source_version", version),
                ("word_count", str(word_count)),
                ("kanji_count", str(len(kanji_rows))),
            ],
        )
        conn.commit()
        log(f"  built {word_count:,} words and {len(kanji_rows):,} kanji.")
    finally:
        conn.close()

    tmp_path.replace(db_path)  # atomic swap into place


def existing_version(db_path: Path) -> str | None:
    if not db_path.exists():
        return None
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        try:
            row = conn.execute("SELECT value FROM meta WHERE key = 'source_version'").fetchone()
            return row[0] if row else None
        finally:
            conn.close()
    except sqlite3.Error:
        return None


# --------------------------------------------------------------------------- #
# Entrypoint
# --------------------------------------------------------------------------- #


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_DB_PATH, help="SQLite output path.")
    parser.add_argument("--force", action="store_true", help="Rebuild even if already up to date.")
    args = parser.parse_args()

    log("Checking latest jmdict-simplified release …")
    release = fetch_latest_release()
    version = release["tag_name"]
    log(f"Latest release: {version}")

    current = existing_version(args.output)
    if current == version and not args.force:
        log(f"Dictionary already built from {version} at {args.output}. Nothing to do.")
        log("Use --force to rebuild.")
        return 0

    jmdict_asset = find_asset(release, JMDICT_PREFIX)
    kanjidic_asset = find_asset(release, KANJIDIC_PREFIX)

    log("Downloading datasets …")
    jmdict = download_and_extract_json(jmdict_asset["browser_download_url"], jmdict_asset["name"])
    kanjidic = download_and_extract_json(
        kanjidic_asset["browser_download_url"], kanjidic_asset["name"]
    )

    log(f"Building {args.output} …")
    build_database(args.output, jmdict, kanjidic, version)
    log("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
