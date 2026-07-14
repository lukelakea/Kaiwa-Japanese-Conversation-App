"""Speech-to-text provider abstraction (faster-whisper local, Google Cloud)."""

from app.voice.stt.base import STTError, STTProvider
from app.voice.stt.factory import build_stt_provider

__all__ = ["STTError", "STTProvider", "build_stt_provider"]
