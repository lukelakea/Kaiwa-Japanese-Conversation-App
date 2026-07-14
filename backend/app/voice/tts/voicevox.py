"""VOICEVOX implementation of :class:`TTSProvider`.

The local default. Calls the VOICEVOX HTTP API in two steps (audio_query then
synthesis) and returns the WAV audio alongside per-mora timing extracted from the
audio_query, so the frontend can highlight text in sync with playback. VOICEVOX
must be running on the configured URL before this provider is used.
"""

from __future__ import annotations

import logging

import httpx

from app.japanese.kana import kata_to_hira
from app.voice.tts.base import MoraTiming, SpeakerOption, TTSError, TTSProvider, TTSResult

logger = logging.getLogger(__name__)


class VoicevoxProvider(TTSProvider):
    def __init__(self, base_url: str, default_speaker: int) -> None:
        self._base = base_url.rstrip("/")
        self._default_speaker = default_speaker
        self._client = httpx.AsyncClient(base_url=self._base, timeout=30.0)

    async def list_speakers(self) -> list[SpeakerOption]:
        try:
            resp = await self._client.get("/speakers", timeout=5.0)
            resp.raise_for_status()
        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            raise TTSError(
                f"VOICEVOX is not running. Start VOICEVOX so it is available at {self._base}."
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise TTSError(f"VOICEVOX /speakers returned {exc.response.status_code}.") from exc

        options: list[SpeakerOption] = []
        for speaker in resp.json():
            for style in speaker.get("styles", []):
                options.append(
                    SpeakerOption(id=style["id"], name=f"{speaker['name']} — {style['name']}")
                )
        return options

    async def synthesize(self, text: str, speaker_id: int | None = None) -> TTSResult:
        speaker = speaker_id if speaker_id is not None else self._default_speaker

        # Step 1: build the audio query from the text.
        try:
            q_resp = await self._client.post(
                "/audio_query", params={"text": text, "speaker": speaker}
            )
            q_resp.raise_for_status()
        except httpx.ConnectError as exc:
            raise TTSError(
                f"VOICEVOX is not running. Start VOICEVOX so it is available at {self._base}."
            ) from exc
        except httpx.HTTPStatusError as exc:
            logger.warning("VOICEVOX audio_query error: %s", exc)
            raise TTSError(f"VOICEVOX audio_query returned {exc.response.status_code}.") from exc

        query = q_resp.json()

        # Step 2: synthesise audio from the query.
        try:
            synth_resp = await self._client.post(
                "/synthesis",
                params={"speaker": speaker},
                content=q_resp.content,
                headers={"Content-Type": "application/json"},
            )
            synth_resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning("VOICEVOX synthesis error: %s", exc)
            raise TTSError(f"VOICEVOX synthesis returned {exc.response.status_code}.") from exc

        return TTSResult(
            audio=synth_resp.content,
            mime_type="audio/wav",
            moras=_extract_mora_timings(query),
        )

    async def aclose(self) -> None:
        await self._client.aclose()


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
                # dataclass is frozen — replace the last entry with an extended end.
                last = timings[-1]
                timings[-1] = MoraTiming(text=last.text, start=last.start, end=last.end + duration)
            t += duration
    return timings
