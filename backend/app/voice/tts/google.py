"""Google Cloud implementation of :class:`TTSProvider`.

The cloud option for the hosted demo, where VOICEVOX isn't available. Calls the
Text-to-Speech REST API with an API key (held server-side) and returns MP3 audio.

Google does not return per-mora timing, so ``moras`` is always empty and the
frontend degrades to plain playback without the karaoke-style highlight — the
deliberate tradeoff for running without a local engine.
"""

from __future__ import annotations

import base64
import logging

import httpx

from app.voice.tts.base import TTSError, TTSProvider, TTSResult

logger = logging.getLogger(__name__)

_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize"
# Google TTS accepts up to 5000 bytes per request; conversation replies are far
# shorter. Reject anything implausibly long rather than send a doomed request.
_MAX_CHARS = 2000


class GoogleTTSProvider(TTSProvider):
    def __init__(self, api_key: str, voice_name: str) -> None:
        self._voice_name = voice_name
        # The key rides in a header rather than the "?key=" query param so it
        # never ends up in a URL — and therefore never in an exception message
        # or a log line if a request fails (see GoogleSTTProvider for the same).
        self._client = httpx.AsyncClient(timeout=30.0, headers={"X-Goog-Api-Key": api_key})

    async def synthesize(self, text: str, speaker_id: int | None = None) -> TTSResult:
        if len(text) > _MAX_CHARS:
            raise TTSError(f"Text is too long to synthesize (limit {_MAX_CHARS} characters).")

        try:
            resp = await self._client.post(
                _ENDPOINT,
                json={
                    "input": {"text": text},
                    "voice": {"languageCode": "ja-JP", "name": self._voice_name},
                    "audioConfig": {"audioEncoding": "MP3"},
                },
            )
            resp.raise_for_status()
        except httpx.ConnectError as exc:
            raise TTSError("Could not reach Google Cloud Text-to-Speech.") from exc
        except httpx.HTTPStatusError as exc:
            logger.warning("Google TTS error: %s", exc)
            raise TTSError(f"Google Text-to-Speech returned {exc.response.status_code}.") from exc

        audio_b64 = resp.json().get("audioContent")
        if not audio_b64:
            raise TTSError("Google Text-to-Speech returned no audio.")

        return TTSResult(audio=base64.b64decode(audio_b64), mime_type="audio/mpeg")

    async def aclose(self) -> None:
        await self._client.aclose()
