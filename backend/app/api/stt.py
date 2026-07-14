"""STT (speech-to-text) endpoint — Phase 5.

Thin HTTP layer over the STT provider abstraction (``app/voice/stt``). Accepts an
audio upload (WebM/Opus from the browser's MediaRecorder) and delegates to the
configured provider — faster-whisper locally, Google Cloud in the hosted demo.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile

from app.voice.stt import STTError, STTProvider

router = APIRouter()

# Conversational recordings are typically 5–30 seconds of WebM/Opus — well under 1 MB.
# Cap at 10 MB to reject accidental or deliberate oversized uploads without reading them.
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def get_stt_provider(request: Request) -> STTProvider:
    return request.app.state.stt_provider


@router.post("/stt")
async def transcribe(
    audio: UploadFile,
    provider: STTProvider = Depends(get_stt_provider),
) -> dict[str, str]:
    """Transcribe an uploaded audio file to Japanese text."""
    data = await audio.read(_MAX_UPLOAD_BYTES + 1)
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Audio file exceeds the 10 MB limit.")
    if not data:
        raise HTTPException(status_code=422, detail="Audio file is empty.")

    try:
        text = await provider.transcribe(data, audio.content_type)
    except STTError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if not text:
        raise HTTPException(status_code=422, detail="No speech detected in the audio.")

    return {"text": text}
