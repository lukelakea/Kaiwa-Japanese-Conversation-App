"""Text-to-speech provider abstraction (VOICEVOX local, Google Cloud)."""

from app.voice.tts.base import (
    MoraTiming,
    SpeakerOption,
    TTSError,
    TTSProvider,
    TTSResult,
)
from app.voice.tts.factory import build_tts_provider

__all__ = [
    "MoraTiming",
    "SpeakerOption",
    "TTSError",
    "TTSProvider",
    "TTSResult",
    "build_tts_provider",
]
