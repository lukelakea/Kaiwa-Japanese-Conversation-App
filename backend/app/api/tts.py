"""TTS (text-to-speech) endpoint — Phase 5.

Calls the VOICEVOX local HTTP API in two steps (audio_query then synthesis)
and returns the WAV audio alongside per-mora timing data extracted from the
audio_query, so the frontend can highlight text in sync with playback.
VOICEVOX must be running on the configured URL before this endpoint is called.
"""

import base64
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.japanese.kana import kata_to_hira

logger = logging.getLogger(__name__)
router = APIRouter()


class TTSRequest(BaseModel):
    text: str
    # Optional override: if omitted the server-configured default is used.
    speaker_id: int | None = None


class SpeakerOption(BaseModel):
    id: int
    name: str


class MoraTiming(BaseModel):
    """A unit of pronunciation with its hiragana reading and time range (seconds)."""

    text: str
    start: float
    end: float


class TTSResponse(BaseModel):
    audio: str  # base64-encoded WAV
    moras: list[MoraTiming]


def _extract_mora_timings(query: dict) -> list[MoraTiming]:
    """Flatten an audio_query's accent phrases into a timeline of mora readings.

    Each mora's duration is its consonant + vowel length; pauses between accent
    phrases have no reading of their own, so their duration is folded into the
    preceding mora's end time rather than emitted as a separate entry.
    """
    timings: list[MoraTiming] = []
    t = query.get("prePhonemeLength") or 0.0
    for phrase in query["accent_phrases"]:
        for mora in phrase["moras"]:
            duration = (mora.get("consonant_length") or 0.0) + (mora.get("vowel_length") or 0.0)
            timings.append(MoraTiming(text=kata_to_hira(mora["text"]), start=t, end=t + duration))
            t += duration
        pause = phrase.get("pause_mora")
        if pause:
            duration = pause.get("vowel_length") or 0.0
            if timings:
                timings[-1].end += duration
            t += duration
    return timings


@router.get("/tts/speakers")
async def list_speakers(settings: Settings = Depends(get_settings)) -> list[SpeakerOption]:
    """Return available VOICEVOX speakers as a flat id/name list."""
    base = settings.voicevox_base_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{base}/speakers")
            resp.raise_for_status()
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"VOICEVOX is not running. Start VOICEVOX so it is available at {base}.",
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"VOICEVOX /speakers returned {exc.response.status_code}.",
        ) from exc

    raw = resp.json()
    options: list[SpeakerOption] = []
    for speaker in raw:
        for style in speaker.get("styles", []):
            options.append(
                SpeakerOption(id=style["id"], name=f"{speaker['name']} — {style['name']}")
            )
    return options


@router.post("/tts")
async def synthesize(
    body: TTSRequest,
    settings: Settings = Depends(get_settings),
) -> TTSResponse:
    """Convert Japanese text to speech via VOICEVOX, returning audio plus mora timings."""
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="Text must not be empty.")

    base = settings.voicevox_base_url.rstrip("/")
    speaker = body.speaker_id if body.speaker_id is not None else settings.voicevox_speaker

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

        query = q_resp.json()

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

    return TTSResponse(
        audio=base64.b64encode(synth_resp.content).decode("ascii"),
        moras=_extract_mora_timings(query),
    )
