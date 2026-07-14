"""TTS provider construction.

The single place that maps the configured engine name to a concrete provider.
The router asks for a :class:`TTSProvider` and never learns which one it got —
mirroring the LLM factory, so adding an engine is a one-file change here.
"""

from app.config import Settings
from app.voice.tts.base import TTSProvider


def build_tts_provider(settings: Settings) -> TTSProvider:
    provider = settings.tts_provider.lower()
    if provider == "voicevox":
        from app.voice.tts.voicevox import VoicevoxProvider

        return VoicevoxProvider(
            base_url=settings.voicevox_base_url,
            default_speaker=settings.voicevox_speaker,
        )
    if provider == "google":
        if not settings.google_cloud_api_key:
            raise ValueError(
                "KAIWA_GOOGLE_CLOUD_API_KEY is required when KAIWA_TTS_PROVIDER=google."
            )
        from app.voice.tts.google import GoogleTTSProvider

        return GoogleTTSProvider(
            api_key=settings.google_cloud_api_key,
            voice_name=settings.google_tts_voice,
        )
    raise ValueError(
        f"Unknown TTS provider '{settings.tts_provider}'. Supported: 'voicevox', 'google'."
    )
