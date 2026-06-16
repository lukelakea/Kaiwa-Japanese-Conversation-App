"""Tests for hover-lookup ranking and homophone suppression.

Builds a tiny synthetic dictionary mirroring the real JMdict-derived schema
(see ``scripts/build_dictionaries.py``) so these run without the (gitignored,
multi-MB) compiled ``data/dictionary.sqlite``.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest

from app.japanese.dictionary import Dictionary

_SCHEMA = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE words (id INTEGER PRIMARY KEY, priority INTEGER NOT NULL, data TEXT NOT NULL);
CREATE TABLE word_lookup (key TEXT NOT NULL, word_id INTEGER NOT NULL);
CREATE TABLE kanji (literal TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE INDEX idx_word_lookup_key ON word_lookup (key);
"""


def _entry(
    kanji: list[str], kana: list[str], pos: list[str], glosses: list[str], uk: bool = False
) -> dict:
    entry = {"kanji": kanji, "kana": kana, "senses": [{"pos": pos, "glosses": glosses}]}
    if uk:
        entry["uk"] = True
    return entry


# A trimmed-down stand-in for the さん homophone cluster: one kana-only
# suffix entry (the correct one for a pure-kana "さん" token) plus several
# kanji-headed entries (山, 酸, 産) for which さん is merely a reading.
_ENTRIES: list[tuple[int, list[str], dict]] = [
    (1, ["さん"], _entry([], ["さん"], ["suffix"], ["Mr; Mrs; Miss; Ms"])),
    (2, ["さん"], _entry(["山"], ["さん", "ざん"], ["suffix"], ["Mt.; Mount"])),
    (3, ["さん"], _entry(["酸"], ["さん"], ["noun (common)"], ["acid"])),
    (4, ["さん"], _entry(["産"], ["さん"], ["noun, used as a suffix"], ["products of"])),
    # きれい: a single bundled entry with both kanji and kana forms — must
    # survive untouched (no competing kana-only headword for this key).
    (
        5,
        ["きれい", "綺麗"],
        _entry(["綺麗", "奇麗"], ["きれい"], ["adjectival noun"], ["pretty", "clean"]),
    ),
    # こと cluster (the 見たことがある case): the formal noun 事 is flagged uk
    # (usually written in kana), so for a kana surface it must survive while its
    # kanji homophone 古都 ("ancient city", not uk) is dropped as reading-noise.
    # An unrelated kana-only particle こと also shares the key.
    (6, ["こと"], _entry(["事"], ["こと"], ["noun (common)"], ["thing", "matter"], uk=True)),
    (7, ["こと"], _entry(["古都"], ["こと"], ["noun (common)"], ["ancient city"])),
    (8, ["こと"], _entry([], ["こと"], ["particle"], ["particle indicating a command"])),
    # ます cluster (the polite-auxiliary case): the auxiliary ます carries a rare
    # kanji form (〼) and is NOT flagged uk, while an unrelated homophone 鱒
    # ("trout") IS uk. A naive uk-suppression would let trout suppress the
    # auxiliary as a kanji homophone, then the auxiliary pos_filter drops trout,
    # leaving the most common verb ending in the language with no entry at all.
    (9, ["ます"], _entry(["〼"], ["ます"], ["auxiliary verb"], ["expresses politeness"])),
    (10, ["ます"], _entry(["鱒"], ["ます"], ["noun (common)"], ["trout"], uk=True)),
]


@pytest.fixture()
def dictionary(tmp_path: Path) -> Dictionary:
    db_path = tmp_path / "dictionary.sqlite"
    conn = sqlite3.connect(db_path)
    conn.executescript(_SCHEMA)
    conn.execute("INSERT INTO meta (key, value) VALUES ('has_uk', '1')")
    for word_id, keys, entry in _ENTRIES:
        conn.execute(
            "INSERT INTO words (id, priority, data) VALUES (?, ?, ?)",
            (word_id, word_id, json.dumps(entry, ensure_ascii=False)),
        )
        conn.executemany(
            "INSERT INTO word_lookup (key, word_id) VALUES (?, ?)",
            [(key, word_id) for key in keys],
        )
    conn.commit()
    conn.close()
    return Dictionary(db_path)


def test_kana_only_entry_suppresses_kanji_homophones(dictionary: Dictionary) -> None:
    """A pure-kana さん token should surface only the kana-only suffix entry,
    not 山/酸/産 — さん is just a *reading* of those kanji, not what's written.
    """
    result = dictionary.look_up("さん", "さん", "suffix")
    assert [w.text for w in result.words] == ["さん"]
    assert result.words[0].senses[0].glosses == ["Mr; Mrs; Miss; Ms"]


def test_bundled_kanji_kana_entry_is_unaffected(dictionary: Dictionary) -> None:
    """A word with one entry covering both its kanji and kana forms (no
    separate kana-only headword) is returned normally.
    """
    result = dictionary.look_up("きれい", "綺麗", "adjectival noun")
    assert [w.text for w in result.words] == ["綺麗"]


def test_uk_entry_survives_while_kanji_homophone_is_dropped(dictionary: Dictionary) -> None:
    """For a kana surface (こと in 見たことがある), the usually-kana noun 事 (uk) is
    kept and ranked first, while the kanji homophone 古都 (not uk, written in
    kanji) is dropped as reading-noise.
    """
    result = dictionary.look_up("こと", "こと", "noun")
    texts = [w.text for w in result.words]
    assert texts[0] == "事"  # uk noun, ranked above the unrelated particle entry
    assert "古都" not in texts  # kanji homophone suppressed for a kana surface


def test_grammatical_token_keeps_pos_match_despite_unrelated_uk_homophone(
    dictionary: Dictionary,
) -> None:
    """An auxiliary token (ます) must surface its grammatical entry even when an
    unrelated uk homophone (鱒 "trout") shares the reading. The polite auxiliary
    has only the non-ideographic ligature 〼 as a "kanji" form, so it counts as
    kana-written and is never a suppression target; the POS filter then keeps it
    over the trout. (Against the real DB, trout is also too uncommon to anchor
    suppression at all — see test_lookup_integration.)
    """
    result = dictionary.look_up("ます", "ます", "auxiliary")
    glosses = [g for w in result.words for s in w.senses for g in s.glosses]
    assert "expresses politeness" in glosses
    assert "trout" not in glosses  # filtered out by the auxiliary POS filter


def test_legacy_db_without_uk_falls_back_to_category_suppression(tmp_path: Path) -> None:
    """A DB built before the uk flag (no has_uk meta) must not regress: it falls
    back to category-aware suppression, so the noun 事 still survives a kana-only
    particle こと even though neither is flagged uk.
    """
    db_path = tmp_path / "legacy.sqlite"
    conn = sqlite3.connect(db_path)
    conn.executescript(_SCHEMA)  # no has_uk meta row inserted
    legacy = [
        (1, ["こと"], _entry(["事"], ["こと"], ["noun (common)"], ["thing"])),
        (2, ["こと"], _entry([], ["こと"], ["particle"], ["command"])),
    ]
    for word_id, keys, entry in legacy:
        conn.execute(
            "INSERT INTO words (id, priority, data) VALUES (?, ?, ?)",
            (word_id, word_id, json.dumps(entry, ensure_ascii=False)),
        )
        conn.executemany(
            "INSERT INTO word_lookup (key, word_id) VALUES (?, ?)",
            [(key, word_id) for key in keys],
        )
    conn.commit()
    conn.close()

    dictionary = Dictionary(db_path)
    assert dictionary._has_uk is False
    assert "事" in [w.text for w in dictionary.look_up("こと", "こと", "noun").words]
