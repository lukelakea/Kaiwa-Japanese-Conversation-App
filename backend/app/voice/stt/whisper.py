"""faster-whisper implementation of :class:`STTProvider`.

The local default. Runs faster-whisper with language pinned to Japanese. The
model is heavy, so it is loaded lazily on the first call and cached for the
lifetime of the provider. Requires ffmpeg on PATH to decode browser audio.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile

from app.voice.stt.base import STTError, STTProvider

logger = logging.getLogger(__name__)


class WhisperProvider(STTProvider):
    def __init__(self, model: str, device: str, compute_type: str) -> None:
        self._model_name = model
        self._device = device
        self._compute_type = compute_type
        self._model = None
        self._lock = asyncio.Lock()

    async def _get_model(self):
        """Load the faster-whisper model once, thread-safely."""
        if self._model is not None:
            return self._model
        async with self._lock:
            if self._model is not None:
                return self._model
            logger.info(
                "Loading faster-whisper model '%s' on %s (compute_type=%s). "
                "This may take a moment on first use.",
                self._model_name,
                self._device,
                self._compute_type,
            )
            try:
                from faster_whisper import WhisperModel

                self._model = await asyncio.to_thread(
                    WhisperModel,
                    self._model_name,
                    device=self._device,
                    compute_type=self._compute_type,
                )
            except Exception as exc:
                raise STTError(f"Could not load the speech recognition model: {exc}") from exc
            logger.info("faster-whisper ready.")
            return self._model

    async def transcribe(self, audio: bytes, content_type: str | None = None) -> str:
        suffix = _suffix_for(content_type)
        tmp_path: str | None = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(audio)
                tmp_path = tmp.name

            model = await self._get_model()
            return await asyncio.to_thread(_transcribe_sync, model, tmp_path)
        finally:
            if tmp_path:
                os.unlink(tmp_path)


def _suffix_for(content_type: str | None) -> str:
    """Pick a temp-file suffix from the upload's MIME type (default .webm)."""
    if content_type and "/" in content_type:
        ext = content_type.split("/", 1)[1].split(";", 1)[0].strip()
        if ext:
            return f".{ext}"
    return ".webm"


def _transcribe_sync(model, path: str) -> str:
    """Run transcription synchronously (called inside a thread pool)."""
    segments, _ = model.transcribe(path, language="ja", beam_size=5)
    return "".join(s.text for s in segments).strip()
