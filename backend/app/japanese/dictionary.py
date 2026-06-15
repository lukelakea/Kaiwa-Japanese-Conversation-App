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

# For single-kana grammatical tokens (particles, auxiliaries), the kana key
# matches dozens of homophones. Restrict to entries whose JMdict POS tags
# overlap with the token's grammatical category so only relevant entries show.
_POS_FILTER: dict[str, frozenset[str]] = {
    "particle": frozenset({"particle"}),
    "auxiliary": frozenset({"auxiliary verb", "auxiliary adjective", "auxiliary"}),
}

# JMdict POS strings contain the broad category as a leading word (e.g. "noun
# (common) …", "verb (godan …)"). Matching token_pos against these prefixes is
# enough to promote same-category homophone entries to the top of results.
_POS_PREFIX: dict[str, str] = {
    "noun": "noun",
    "pronoun": "pronoun",
    "verb": "verb",
    "adjective": "adjective",
    "adjectival noun": "adjectival noun",
    "adverb": "adverb",
    "adnominal": "pre-noun adjectival",
    "conjunction": "conjunction",
    "interjection": "interjection",
    "prefix": "prefix",
    "suffix": "suffix",
    "numeral": "numeral",
}


class Dictionary:
    """Looks up words and kanji in the compiled SQLite dictionary."""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self.available = db_path.exists()

    def _connect(self) -> sqlite3.Connection:
        # Open read-only per call: lookups are infrequent (on hover) and this
        # sidesteps SQLite's cross-thread connection constraints entirely.
        return sqlite3.connect(f"file:{self._db_path}?mode=ro", uri=True)

    def look_up(self, surface: str, lemma: str, pos: str = "") -> LookupResponse:
        if not self.available:
            return LookupResponse(words=[], kanji=[])
        conn = self._connect()
        try:
            return LookupResponse(
                words=self._words(conn, surface, lemma, _POS_FILTER.get(pos), pos),
                kanji=self._kanji(conn, surface, lemma),
            )
        finally:
            conn.close()

    def _words(
        self,
        conn: sqlite3.Connection,
        surface: str,
        lemma: str,
        pos_filter: frozenset[str] | None,
        token_pos: str,
    ) -> list[WordEntry]:
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
                ORDER BY words.priority
                """,
                (key,),
            ).fetchall()
            for word_id, data in rows:
                if word_id in seen_ids:
                    continue
                seen_ids.add(word_id)
                entry = _parse_word(data, key)
                if pos_filter and not any(
                    p in pos_filter for sense in entry.senses for p in sense.part_of_speech
                ):
                    continue
                entries.append(entry)

        # For content words (not particles/auxiliaries which are already filtered),
        # promote entries whose senses match the token's POS to the top. Frequency
        # ordering is preserved within each group by the stable sort.
        pos_prefix = _POS_PREFIX.get(token_pos)
        if pos_prefix:
            entries.sort(key=lambda e: _pos_rank(e, pos_prefix))

        return entries[:_MAX_WORDS]

    def _kanji(self, conn: sqlite3.Connection, surface: str, lemma: str) -> list[KanjiEntry]:
        # Every distinct kanji appearing in the surface or lemma, in order.
        literals = list(dict.fromkeys(ch for ch in surface + lemma if _is_kanji(ch)))
        entries: list[KanjiEntry] = []
        for literal in literals:
            row = conn.execute("SELECT data FROM kanji WHERE literal = ?", (literal,)).fetchone()
            if row:
                entries.append(_parse_kanji(literal, row[0]))
        return entries


def _pos_rank(entry: WordEntry, pos_prefix: str) -> int:
    """0 if any sense's POS starts with ``pos_prefix``, 1 otherwise.

    Used as a stable-sort key so POS-matching entries surface first while
    preserving the frequency ordering already applied by the SQL query.
    """
    for sense in entry.senses:
        for p in sense.part_of_speech:
            if p.startswith(pos_prefix):
                return 0
    return 1


def _parse_word(data: str, key: str) -> WordEntry:
    record = json.loads(data)
    kanji_forms: list[str] = record.get("kanji", [])
    kana_forms: list[str] = record.get("kana", [])
    # An entry can bundle multiple kanji forms or readings (e.g. 端 = はし/はじ/はな
    # all sharing one set of senses). Prefer whichever form matched the lookup key
    # so the popup shows the reading the user actually hovered, not just the first.
    fallback_text = kanji_forms[0] if kanji_forms else (kana_forms[0] if kana_forms else "")
    text = key if key in kanji_forms else fallback_text
    reading = key if key in kana_forms else (kana_forms[0] if kana_forms else "")
    return WordEntry(
        text=text,
        reading=reading,
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
