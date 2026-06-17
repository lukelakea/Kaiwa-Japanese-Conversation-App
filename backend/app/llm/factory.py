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
    if provider == "anthropic":
        # Imported here, not at module scope, so the optional `anthropic`
        # dependency is only required when this provider is actually selected —
        # the local-first Ollama path stays dependency-free.
        if not settings.anthropic_api_key:
            raise ValueError(
                "KAIWA_ANTHROPIC_API_KEY is required when KAIWA_LLM_PROVIDER=anthropic."
            )
        from app.llm.anthropic_provider import AnthropicProvider

        # TODO (post-1.0, brief §10): enforce hard spending caps for the cloud
        # provider before exposing it beyond local/dev use.
        return AnthropicProvider(api_key=settings.anthropic_api_key)
    raise ValueError(
        f"Unknown LLM provider '{settings.llm_provider}'. Supported: 'ollama', 'anthropic'."
    )
