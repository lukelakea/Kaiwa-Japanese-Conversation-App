"""Read-only dictionary lookup over the compiled SQLite database.

The database is built by ``scripts/build_dictionaries.py`` from JMdict (words)
and KANJIDIC2 (kanji). Lookups are pure data access — no LLM (brief §7).

If the database has not been built yet, the service degrades gracefully:
``available`` is ``False`` and every lookup returns empty results, so the app
still runs (furigana works; hover simply finds nothing) and the setup docs tell
the developer to run the build script.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from app.japanese.tokenizer import _is_kanji
from app.models.reading import KanjiEntry, LookupResponse, WordEntry, WordSense

# Cap how many word entries one hover returns — enough to be useful, not a wall.
_MAX_WORDS = 8


class Dictionary:
    """Looks up words and kanji in the compiled SQLite dictionary."""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self.available = db_path.exists()

    def _connect(self) -> sqlite3.Connection:
        # Open read-only per call: lookups are infrequent (on hover) and this
        # sidesteps SQLite's cross-thread connection constraints entirely.
        return sqlite3.connect(f"file:{self._db_path}?mode=ro", uri=True)

    def look_up(self, surface: str, lemma: str) -> LookupResponse:
        if not self.available:
            return LookupResponse(words=[], kanji=[])
        conn = self._connect()
        try:
            return LookupResponse(
                words=self._words(conn, surface, lemma),
                kanji=self._kanji(conn, surface, lemma),
            )
        finally:
            conn.close()

    def _words(self, conn: sqlite3.Connection, surface: str, lemma: str) -> list[WordEntry]:
        # Prefer the dictionary form, then the literal surface. Preserve that
        # priority while de-duplicating entries shared across keys.
        keys = list(dict.fromkeys(k for k in (lemma, surface) if k))
        seen_ids: set[int] = set()
        entries: list[WordEntry] = []
        for key in keys:
            rows = conn.execute(
                """
                SELECT words.id, words.data
                FROM word_lookup
                JOIN words ON words.id = word_lookup.word_id
                WHERE word_lookup.key = ?
                """,
                (key,),
            ).fetchall()
            for word_id, data in rows:
                if word_id in seen_ids:
                    continue
                seen_ids.add(word_id)
                entries.append(_parse_word(data))
                if len(entries) >= _MAX_WORDS:
                    return entries
        return entries

    def _kanji(self, conn: sqlite3.Connection, surface: str, lemma: str) -> list[KanjiEntry]:
        # Every distinct kanji appearing in the surface or lemma, in order.
        literals = list(dict.fromkeys(ch for ch in surface + lemma if _is_kanji(ch)))
        entries: list[KanjiEntry] = []
        for literal in literals:
            row = conn.execute("SELECT data FROM kanji WHERE literal = ?", (literal,)).fetchone()
            if row:
                entries.append(_parse_kanji(literal, row[0]))
        return entries


def _parse_word(data: str) -> WordEntry:
    record = json.loads(data)
    kanji_forms: list[str] = record.get("kanji", [])
    kana_forms: list[str] = record.get("kana", [])
    return WordEntry(
        text=kanji_forms[0] if kanji_forms else (kana_forms[0] if kana_forms else ""),
        reading=kana_forms[0] if kana_forms else "",
        senses=[
            WordSense(part_of_speech=sense.get("pos", []), glosses=sense.get("glosses", []))
            for sense in record.get("senses", [])
        ],
    )


def _parse_kanji(literal: str, data: str) -> KanjiEntry:
    record = json.loads(data)
    return KanjiEntry(
        literal=literal,
        on=record.get("on", []),
        kun=record.get("kun", []),
        meanings=record.get("meanings", []),
        strokes=record.get("strokes"),
        grade=record.get("grade"),
        jlpt=record.get("jlpt"),
    )
