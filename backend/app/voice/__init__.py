"""Voice (Phase 5): provider-agnostic text-to-speech and speech-to-text.

Like the LLM layer, feature code (the ``/tts`` and ``/stt`` routers) depends only
on the abstract :class:`~app.voice.tts.base.TTSProvider` /
:class:`~app.voice.stt.base.STTProvider` interfaces. Concrete engines — VOICEVOX
and faster-whisper locally, Google Cloud in the hosted demo — are built by the
factories and never imported directly by routes.
"""

from app.voice.stt import STTError, STTProvider, build_stt_provider
from app.voice.tts import (
    MoraTiming,
    SpeakerOption,
    TTSError,
    TTSProvider,
    TTSResult,
    build_tts_provider,
)

__all__ = [
    "MoraTiming",
    "STTError",
    "STTProvider",
    "SpeakerOption",
    "TTSError",
    "TTSProvider",
    "TTSResult",
    "build_stt_provider",
    "build_tts_provider",
]
