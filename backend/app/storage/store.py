"""Local document store for the frontend's saved user data.

The frontend persists its small personal collections here — saved vocab,
conversation history, custom scenarios, the grammar log, app settings — instead
of browser localStorage, so the data survives a cleared browser, a different
browser, or a private window (local-first: it still never leaves the machine).

The store is deliberately dumb: each collection is a single JSON document, and
all upsert / dedup / cap logic stays in the frontend hooks. The server holds no
opinion about the shape of what it stores, which keeps this layer trivial and
lets the frontend remain the single source of truth for its own data model.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

# The fixed set of collections the frontend persists. A whitelist (rather than
# accepting any name) keeps the store from ever writing an arbitrary file and
# doubles as the guard against path traversal via the collection path segment.
ALLOWED_COLLECTIONS: frozenset[str] = frozenset(
    {"app-settings", "vocab", "conversations", "grammar", "scenarios"}
)


class UnknownCollection(KeyError):
    """Raised for a collection name outside ``ALLOWED_COLLECTIONS``."""


class JsonDocumentStore:
    """A directory of ``{collection}.json`` documents with atomic writes.

    Synchronous on purpose — the documents are tiny and single-user. Callers on
    the async path dispatch ``read`` / ``write`` to a worker thread so the event
    loop is never blocked (see ``app/api/store.py``).
    """

    def __init__(self, data_dir: Path) -> None:
        self._dir = data_dir
        self._dir.mkdir(parents=True, exist_ok=True)

    def _path(self, collection: str) -> Path:
        if collection not in ALLOWED_COLLECTIONS:
            raise UnknownCollection(collection)
        return self._dir / f"{collection}.json"

    def read(self, collection: str) -> Any | None:
        """Return the stored document, or ``None`` if nothing is saved yet."""
        path = self._path(collection)
        try:
            with path.open(encoding="utf-8") as fh:
                return json.load(fh)
        except FileNotFoundError:
            return None

    def write(self, collection: str, document: Any) -> None:
        """Overwrite a collection's document atomically.

        Serialise to a unique temp file in the same directory, then ``os.replace``
        it into place — atomic on the same filesystem on both POSIX and Windows.
        A crash, a concurrent read, or two concurrent writes can therefore never
        observe (or leave behind) a half-written document.
        """
        path = self._path(collection)
        fd, tmp_name = tempfile.mkstemp(dir=self._dir, suffix=".tmp")
        tmp = Path(tmp_name)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(document, fh, ensure_ascii=False, separators=(",", ":"))
            os.replace(tmp, path)
        except BaseException:
            tmp.unlink(missing_ok=True)
            raise
