"""The provider-agnostic speech-to-text interface.

Keeps the ``/stt`` router independent of any particular recognition engine.
Adding a new backend means writing one class that implements
:class:`STTProvider` — no router changes.

Providers take raw audio bytes plus the upload's content type (the browser's
MediaRecorder produces WebM/Opus) and return the Japanese transcript.
"""

from abc import ABC, abstractmethod


class STTError(RuntimeError):
    """Raised when transcription fails, carrying a client-safe message."""


class STTProvider(ABC):
    """Abstract speech-to-text engine."""

    @abstractmethod
    async def transcribe(self, audio: bytes, content_type: str | None = None) -> str:
        """Transcribe ``audio`` to Japanese text.

        ``content_type`` is the upload's MIME type (e.g. ``audio/webm``), used by
        engines that need the container format. Implementations raise
        :class:`STTError` if transcription cannot complete; an empty transcript
        is returned as ``""`` for the router to handle.
        """
        raise NotImplementedError

    async def aclose(self) -> None:  # noqa: B027 — optional no-op hook, not abstract
        """Release any held resources (network clients, etc.). Optional override."""
