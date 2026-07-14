"""Google Cloud implementation of :class:`STTProvider`.

The cloud option for the hosted demo, where loading a local Whisper model (and a
GPU) isn't available. Calls the Speech-to-Text REST API with an API key, sending
the browser's WebM/Opus audio directly — no ffmpeg or model download needed.

Uses the synchronous ``speech:recognize`` endpoint, which handles audio up to
~1 minute; conversational utterances are well within that.
"""

from __future__ import annotations

import base64
import logging

import httpx

from app.voice.stt.base import STTError, STTProvider

logger = logging.getLogger(__name__)

_ENDPOINT = "https://speech.googleapis.com/v1/speech:recognize"


class GoogleSTTProvider(STTProvider):
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._client = httpx.AsyncClient(timeout=30.0)

    async def transcribe(self, audio: bytes, content_type: str | None = None) -> str:
        try:
            resp = await self._client.post(
                _ENDPOINT,
                params={"key": self._api_key},
                json={
                    # WEBM_OPUS carries its sample rate in the container, so the
                    # API reads it from the header — no sampleRateHertz needed.
                    "config": {
                        "encoding": "WEBM_OPUS",
                        "languageCode": "ja-JP",
                        "enableAutomaticPunctuation": True,
                    },
                    "audio": {"content": base64.b64encode(audio).decode("ascii")},
                },
            )
            resp.raise_for_status()
        except httpx.ConnectError as exc:
            raise STTError("Could not reach Google Cloud Speech-to-Text.") from exc
        except httpx.HTTPStatusError as exc:
            logger.warning("Google STT error: %s", exc)
            raise STTError(f"Google Speech-to-Text returned {exc.response.status_code}.") from exc

        # Concatenate the top alternative of each result segment. A request with
        # no recognizable speech comes back with no "results" key at all.
        results = resp.json().get("results", [])
        parts = [
            alt[0]["transcript"]
            for r in results
            if (alt := r.get("alternatives")) and alt[0].get("transcript")
        ]
        return "".join(parts).strip()

    async def aclose(self) -> None:
        await self._client.aclose()
