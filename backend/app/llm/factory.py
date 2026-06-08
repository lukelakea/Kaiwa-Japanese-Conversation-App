"""Provider construction.

The factory is the single place that maps a configured provider name to a
concrete implementation. Routes ask for an :class:`LLMProvider` and never learn
which one they got — that is what makes adding Anthropic (post-1.0) a one-file
change here plus a new provider module.
"""

from app.config import Settings
from app.llm.base import LLMProvider
from app.llm.ollama_provider import OllamaProvider


def build_provider(settings: Settings) -> LLMProvider:
    provider = settings.llm_provider.lower()
    if provider == "ollama":
        return OllamaProvider(base_url=settings.ollama_base_url)
    # Future: if provider == "anthropic": return AnthropicProvider(...)
    raise ValueError(f"Unknown LLM provider '{settings.llm_provider}'. Supported: 'ollama'.")
