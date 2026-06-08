"""Application configuration, loaded from environment / .env.

All settings are prefixed with ``KAIWA_`` to avoid collisions. See
``.env.example`` for the full list and defaults.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="KAIWA_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Which provider the factory should build. v1.0 supports "ollama".
    llm_provider: str = "ollama"

    # Ollama connection + default model. Model is intentionally configurable
    # rather than hardcoded so it can be swapped without code changes.
    #
    # Default is gemma3:27b: in testing it stayed reliably in Japanese, whereas
    # qwen2.5:32b — though strong at Japanese — intermittently code-switched to
    # Chinese mid-reply at every temperature tried. Swap freely via .env.
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma3:27b"

    # Default sampling temperature for conversational replies.
    temperature: float = 0.7

    # Origins permitted by CORS, as a comma-separated string.
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (read once per process)."""
    return Settings()
