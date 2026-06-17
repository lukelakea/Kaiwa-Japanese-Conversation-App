"""Tests for the local JSON document store (app/storage/store.py)."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.storage import ALLOWED_COLLECTIONS, JsonDocumentStore, UnknownCollection


def test_read_missing_collection_returns_none(tmp_path: Path) -> None:
    store = JsonDocumentStore(tmp_path)
    assert store.read("vocab") is None


def test_write_then_read_round_trips(tmp_path: Path) -> None:
    store = JsonDocumentStore(tmp_path)
    document = [{"lemma": "猫", "reading": "ねこ"}, {"lemma": "犬", "reading": "いぬ"}]
    store.write("vocab", document)
    assert store.read("vocab") == document


def test_write_overwrites_previous_document(tmp_path: Path) -> None:
    store = JsonDocumentStore(tmp_path)
    store.write("scenarios", [{"id": "a"}])
    store.write("scenarios", [{"id": "b"}])
    assert store.read("scenarios") == [{"id": "b"}]


def test_japanese_is_stored_as_utf8_not_escaped(tmp_path: Path) -> None:
    store = JsonDocumentStore(tmp_path)
    store.write("vocab", [{"surface": "日本語"}])
    raw = (tmp_path / "vocab.json").read_text(encoding="utf-8")
    assert "日本語" in raw  # ensure_ascii=False keeps the file human-readable


def test_unknown_collection_is_rejected(tmp_path: Path) -> None:
    store = JsonDocumentStore(tmp_path)
    with pytest.raises(UnknownCollection):
        store.read("../../etc/passwd")
    with pytest.raises(UnknownCollection):
        store.write("secrets", {"nope": True})


def test_write_leaves_no_temp_files_behind(tmp_path: Path) -> None:
    store = JsonDocumentStore(tmp_path)
    store.write("grammar", [{"id": "g1"}])
    leftover = list(tmp_path.glob("*.tmp"))
    assert leftover == []


@pytest.mark.parametrize("collection", sorted(ALLOWED_COLLECTIONS))
def test_all_allowed_collections_round_trip(tmp_path: Path, collection: str) -> None:
    store = JsonDocumentStore(tmp_path)
    store.write(collection, {"ok": True})
    assert store.read(collection) == {"ok": True}
