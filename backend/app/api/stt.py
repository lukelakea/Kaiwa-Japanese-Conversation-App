"""STT (speech-to-text) endpoint — Phase 5.

Accepts an audio upload (WebM/Opus from the browser's MediaRecorder, or any
format ffmpeg can decode), runs faster-whisper with language pinned to
Japanese, and returns the transcript. The model is loaded lazily on first
call and cached for the lifetime of the process.
"""

import asyncio
import logging
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile

from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Module-level singleton. Loaded on first request; subsequent calls reuse it.
_whisper_model = None
_model_lock = asyncio.Lock()


async def _get_model():
    """Load the faster-whisper model once, thread-safely."""
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model
    async with _model_lock:
        if _whisper_model is not None:
            return _whisper_model
        settings = get_settings()
        logger.info(
            "Loading faster-whisper model '%s' on %s (compute_type=%s). "
            "This may take a moment on first use.",
            settings.whisper_model,
            settings.whisper_device,
            settings.whisper_compute_type,
        )
        try:
            from faster_whisper import WhisperModel

            _whisper_model = await asyncio.to_thread(
                WhisperModel,
                settings.whisper_model,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Could not load the speech recognition model: {exc}",
            ) from exc
        logger.info("faster-whisper ready.")
        return _whisper_model


def _transcribe_sync(model, path: str) -> str:
    """Run transcription synchronously (called inside a thread pool)."""
    segments, _ = model.transcribe(path, language="ja", beam_size=5)
    return "".join(s.text for s in segments).strip()


@router.post("/stt")
async def transcribe(audio: UploadFile) -> dict[str, str]:
    """Transcribe an audio file to Japanese text via faster-whisper."""
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=422, detail="Audio file is empty.")

    suffix = Path(audio.filename or "recording.webm").suffix or ".webm"
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            tmp_path = tmp.name

        model = await _get_model()
        text = await asyncio.to_thread(_transcribe_sync, model, tmp_path)
    finally:
        if tmp_path:
            os.unlink(tmp_path)

    if not text:
        raise HTTPException(status_code=422, detail="No speech detected in the audio.")

    return {"text": text}
