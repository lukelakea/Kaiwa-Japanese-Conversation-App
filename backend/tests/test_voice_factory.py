"""Tests for the voice (TTS/STT) provider factories — the one place that maps a
configured engine name to a concrete implementation, mirroring the LLM factory.
"""

import pytest

from app.config import Settings
from app.voice.stt.factory import build_stt_provider
from app.voice.stt.google import GoogleSTTProvider
from app.voice.stt.whisper import WhisperProvider
from app.voice.tts.factory import build_tts_provider
from app.voice.tts.google import GoogleTTSProvider
from app.voice.tts.voicevox import VoicevoxProvider


def test_build_tts_voicevox():
    provider = build_tts_provider(Settings(tts_provider="voicevox"))
    assert isinstance(provider, VoicevoxProvider)


def test_build_tts_google_requires_key():
    with pytest.raises(ValueError, match="KAIWA_GOOGLE_CLOUD_API_KEY"):
        build_tts_provider(Settings(tts_provider="google", google_cloud_api_key=None))


def test_build_tts_google_with_key():
    provider = build_tts_provider(Settings(tts_provider="google", google_cloud_api_key="k"))
    assert isinstance(provider, GoogleTTSProvider)


def test_build_tts_unknown():
    with pytest.raises(ValueError, match="Unknown TTS provider"):
        build_tts_provider(Settings(tts_provider="bogus"))


def test_build_stt_whisper():
    provider = build_stt_provider(Settings(stt_provider="whisper"))
    assert isinstance(provider, WhisperProvider)


def test_build_stt_google_requires_key():
    with pytest.raises(ValueError, match="KAIWA_GOOGLE_CLOUD_API_KEY"):
        build_stt_provider(Settings(stt_provider="google", google_cloud_api_key=None))


def test_build_stt_google_with_key():
    provider = build_stt_provider(Settings(stt_provider="google", google_cloud_api_key="k"))
    assert isinstance(provider, GoogleSTTProvider)


def test_build_stt_unknown():
    with pytest.raises(ValueError, match="Unknown STT provider"):
        build_stt_provider(Settings(stt_provider="bogus"))
