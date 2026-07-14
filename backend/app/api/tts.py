"""TTS (text-to-speech) endpoint — Phase 5.

Thin HTTP layer over the TTS provider abstraction (``app/voice/tts``). The
provider — VOICEVOX locally, Google Cloud in the hosted demo — is selected by
config and resolved from app state; this router only validates input, maps the
provider's result to the wire model, and turns provider failures into 502s.
"""

import base64

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.voice.tts import SpeakerOption, TTSError, TTSProvider

router = APIRouter()


def get_tts_provider(request: Request) -> TTSProvider:
    return request.app.state.tts_provider


class TTSRequest(BaseModel):
    text: str
    # Optional override: if omitted the server-configured default is used.
    speaker_id: int | None = None


class MoraTimingModel(BaseModel):
    """A unit of pronunciation with its hiragana reading and time range (seconds)."""

    text: str
    start: float
    end: float


class TTSResponse(BaseModel):
    audio: str  # base64-encoded audio
    mime_type: str  # MIME type of the audio (e.g. "audio/wav", "audio/mpeg")
    moras: list[MoraTimingModel]


@router.get("/tts/speakers")
async def list_speakers(
    provider: TTSProvider = Depends(get_tts_provider),
) -> list[SpeakerOption]:
    """Return the engine's selectable voices as a flat id/name list (may be empty)."""
    try:
        speakers = await provider.list_speakers()
    except TTSError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return list(speakers)


@router.post("/tts")
async def synthesize(
    body: TTSRequest,
    provider: TTSProvider = Depends(get_tts_provider),
) -> TTSResponse:
    """Convert Japanese text to speech, returning audio plus optional mora timings."""
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="Text must not be empty.")

    try:
        result = await provider.synthesize(body.text, body.speaker_id)
    except TTSError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return TTSResponse(
        audio=base64.b64encode(result.audio).decode("ascii"),
        mime_type=result.mime_type,
        moras=[MoraTimingModel(text=m.text, start=m.start, end=m.end) for m in result.moras],
    )
