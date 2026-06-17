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
from typing import Any

from app.japanese.tokenizer import _has_kanji, _is_kanji
from app.models.reading import KanjiEntry, LookupResponse, WordEntry, WordSense

# Cap how many word entries one hover returns — enough to be useful, not a wall.
_MAX_WORDS = 8

# Entries with priority >= this are JMdict's "uncommon" tier: build_dictionaries
# assigns base 0 to a common word and 5000 to an uncommon one (see
# _priority_score there). Used to decide whether a kana-written entry is common
# enough to anchor homophone suppression.
_UNCOMMON_PRIORITY = 5000

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
        # Whether the DB carries JMdict's per-entry uk ("usually kana") flag.
        # Built once: chooses the homophone-suppression strategy in _words.
        self._has_uk = self._read_has_uk() if self.available else False

    def _connect(self) -> sqlite3.Connection:
        # Open read-only per call: lookups are infrequent (on hover) and this
        # sidesteps SQLite's cross-thread connection constraints entirely.
        return sqlite3.connect(f"file:{self._db_path}?mode=ro", uri=True)

    def _read_has_uk(self) -> bool:
        try:
            conn = self._connect()
            try:
                row = conn.execute("SELECT value FROM meta WHERE key = 'has_uk'").fetchone()
                return bool(row) and row[0] == "1"
            finally:
                conn.close()
        except sqlite3.Error:
            return False

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
                SELECT words.id, words.priority, words.data
                FROM word_lookup
                JOIN words ON words.id = word_lookup.word_id
                WHERE word_lookup.key = ?
                ORDER BY words.priority
                """,
                (key,),
            ).fetchall()
            records = [(word_id, priority, json.loads(data)) for word_id, priority, data in rows]
            # For a kana key, a word the kana surface canonically spells (事 → こと,
            # the honorific さん) is what was typed; kanji-headword entries that
            # merely share the reading (古都/琴 for こと; 山/酸/産 for さん) are
            # homophones to drop. "Kana-written" = no real kanji (a non-ideographic
            # symbol like 〼 doesn't count), or JMdict's "usually kana" (uk) flag —
            # so 事/もの survive. On older DBs without uk, fall back to
            # category-aware suppression: only a same-category kana-written entry
            # (the suffix さん for a suffix token) qualifies, so an unrelated
            # particle こと can't anchor suppression of the noun 事.
            if self._has_uk:
                kana_written = [_kana_written(rec) for _, _, rec in records]
            else:
                kana_written = [
                    _kana_written(rec) and _pos_compatible(rec, token_pos) for _, _, rec in records
                ]
            # Suppress kanji homophones only when a *common* kana-written word
            # anchors the reading. A rare uk homophone must not: 鴇 ("crested
            # ibis", uk but uncommon) shares とき with the everyday 時 ("time"),
            # and 鱒 ("trout", uk) shares ます with the polite auxiliary — letting
            # either anchor suppression would drop the word the learner wants.
            # priority < _UNCOMMON_PRIORITY marks JMdict's "common" tier (see
            # build_dictionaries._priority_score).
            suppress_homophones = any(
                written and priority < _UNCOMMON_PRIORITY
                for (_, priority, _), written in zip(records, kana_written, strict=True)
            )
            for (word_id, _, record), written in zip(records, kana_written, strict=True):
                if word_id in seen_ids:
                    continue
                if suppress_homophones and not written:
                    continue
                seen_ids.add(word_id)
                entry = _parse_word(record, key)
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


def _kana_written(record: dict[str, Any]) -> bool:
    """Is ``record`` a word the kana surface canonically spells?

    True when the entry has no real kanji (a non-ideographic symbol like the
    polite-ます ligature 〼 U+303C does not count) or carries JMdict's "usually
    kana" (uk) flag. Such entries are kept for a kana surface; other kanji
    homophones sharing only the reading are candidates for suppression.
    """
    return not any(_has_kanji(form) for form in record.get("kanji", [])) or record.get("uk", False)


def _pos_compatible(record: dict[str, Any], token_pos: str) -> bool:
    """Does any sense of ``record`` share ``token_pos``'s grammatical category?

    Decides whether a kana-only entry is the *canonical* reading of a key (so
    kanji homophones can be dropped) or merely a grammatical homophone of a
    differently-categorised token (so they must be kept). Uses the same category
    vocabulary as lookup: exact membership for grammatical tokens, prefix match
    for content tokens. Tokens whose POS we can't map fall back to ``True`` — the
    original, category-blind suppression.
    """
    senses_pos = [p for sense in record.get("senses", []) for p in sense.get("pos", [])]
    if token_pos in _POS_FILTER:
        return any(p in _POS_FILTER[token_pos] for p in senses_pos)
    prefix = _POS_PREFIX.get(token_pos)
    if prefix is None:
        return True
    return any(p.startswith(prefix) for p in senses_pos)


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


def _parse_word(record: dict[str, Any], key: str) -> WordEntry:
    kanji_forms: list[str] = record.get("kanji", [])
    kana_forms: list[str] = record.get("kana", [])
    # An entry can bundle multiple kanji forms or readings (e.g. 端 = はし/はじ/はな
    # all sharing one set of senses). Prefer whichever form matched the lookup key
    # so the popup shows the reading the user actually hovered, not just the first.
    # When falling back, prefer a kanji headword (事 over こと) — but only if it
    # contains a real kanji: some entries list a non-ideographic symbol as their
    # "kanji" form (the polite auxiliary ます has 〼 U+303C, a MASU ligature), which
    # no learner would recognize, so show the kana headword instead.
    real_kanji = [k for k in kanji_forms if _has_kanji(k)]
    fallback_text = real_kanji[0] if real_kanji else (kana_forms[0] if kana_forms else "")
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
