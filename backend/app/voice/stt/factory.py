"""STT provider construction.

The single place that maps the configured engine name to a concrete provider,
mirroring the LLM and TTS factories.
"""

from app.config import Settings
from app.voice.stt.base import STTProvider


def build_stt_provider(settings: Settings) -> STTProvider:
    provider = settings.stt_provider.lower()
    if provider == "whisper":
        from app.voice.stt.whisper import WhisperProvider

        return WhisperProvider(
            model=settings.whisper_model,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )
    if provider == "google":
        if not settings.google_cloud_api_key:
            raise ValueError(
                "KAIWA_GOOGLE_CLOUD_API_KEY is required when KAIWA_STT_PROVIDER=google."
            )
        from app.voice.stt.google import GoogleSTTProvider

        return GoogleSTTProvider(api_key=settings.google_cloud_api_key)
    raise ValueError(
        f"Unknown STT provider '{settings.stt_provider}'. Supported: 'whisper', 'google'."
    )
