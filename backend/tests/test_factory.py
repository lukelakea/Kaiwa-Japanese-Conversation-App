"""Tests for the provider factory — the one place that maps a configured
provider name to a concrete implementation.
"""

import pytest

from app.config import Settings
from app.llm.factory import build_provider
from app.llm.ollama_provider import OllamaProvider


def test_build_provider_ollama():
    provider = build_provider(Settings(llm_provider="ollama"))
    assert isinstance(provider, OllamaProvider)


def test_build_provider_anthropic_requires_key():
    # The key check happens before the (lazy) anthropic import, so this runs
    # even when the optional dependency is not installed.
    with pytest.raises(ValueError, match="KAIWA_ANTHROPIC_API_KEY"):
        build_provider(Settings(llm_provider="anthropic", anthropic_api_key=None))


def test_build_provider_unknown():
    with pytest.raises(ValueError, match="Unknown LLM provider"):
        build_provider(Settings(llm_provider="bogus"))


def test_build_provider_anthropic_with_key():
    pytest.importorskip("anthropic")
    from app.llm.anthropic_provider import AnthropicProvider

    provider = build_provider(Settings(llm_provider="anthropic", anthropic_api_key="sk-test"))
    assert isinstance(provider, AnthropicProvider)


def test_active_model_follows_provider():
    ollama = Settings(llm_provider="ollama", ollama_model="gemma3:27b")
    anthropic_settings = Settings(llm_provider="anthropic", anthropic_model="claude-sonnet-4-6")
    assert ollama.active_model == "gemma3:27b"
    assert anthropic_settings.active_model == "claude-sonnet-4-6"
