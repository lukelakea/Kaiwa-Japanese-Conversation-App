"""TTS (text-to-speech) endpoint — Phase 5.

Calls the VOICEVOX local HTTP API in two steps (audio_query then synthesis)
and returns raw WAV bytes. VOICEVOX must be running on the configured URL
before this endpoint is called.
"""

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


class TTSRequest(BaseModel):
    text: str


@router.post("/tts")
async def synthesize(
    body: TTSRequest,
    settings: Settings = Depends(get_settings),
) -> Response:
    """Convert Japanese text to speech via VOICEVOX and return WAV audio."""
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="Text must not be empty.")

    base = settings.voicevox_base_url.rstrip("/")
    speaker = settings.voicevox_speaker

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: build the audio query from the text.
        try:
            q_resp = await client.post(
                f"{base}/audio_query",
                params={"text": body.text, "speaker": speaker},
            )
            q_resp.raise_for_status()
        except httpx.ConnectError as exc:
            raise HTTPException(
                status_code=502,
                detail=(f"VOICEVOX is not running. Start VOICEVOX so it is available at {base}."),
            ) from exc
        except httpx.HTTPStatusError as exc:
            logger.warning("VOICEVOX audio_query error: %s", exc)
            raise HTTPException(
                status_code=502,
                detail=f"VOICEVOX audio_query returned {exc.response.status_code}.",
            ) from exc

        # Step 2: synthesise audio from the query.
        try:
            synth_resp = await client.post(
                f"{base}/synthesis",
                params={"speaker": speaker},
                content=q_resp.content,
                headers={"Content-Type": "application/json"},
            )
            synth_resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning("VOICEVOX synthesis error: %s", exc)
            raise HTTPException(
                status_code=502,
                detail=f"VOICEVOX synthesis returned {exc.response.status_code}.",
            ) from exc

    return Response(content=synth_resp.content, media_type="audio/wav")
