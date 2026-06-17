"""Local persistence for the frontend's saved user data."""

from app.storage.store import ALLOWED_COLLECTIONS, JsonDocumentStore, UnknownCollection

__all__ = ["ALLOWED_COLLECTIONS", "JsonDocumentStore", "UnknownCollection"]
