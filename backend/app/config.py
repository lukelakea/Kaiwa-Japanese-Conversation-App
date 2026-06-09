"""Application configuration, loaded from environment / .env.

All settings are prefixed with ``KAIWA_`` to avoid collisions. See
``.env.example`` for the full list and defaults.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Anchor relative data paths to the backend root (this file is app/config.py).
_BACKEND_ROOT = Path(__file__).resolve().parents[1]


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

    # Translation (brief §6) is a faithful transformation of an already-generated
    # reply, so it runs cooler than conversation to stay literal and stable.
    translation_temperature: float = 0.3

    # Reading-aids dictionary (Phase 2), built by scripts/build_dictionaries.py.
    # Relative paths are resolved against the backend root.
    dictionary_path: str = "data/dictionary.sqlite"

    # Origins permitted by CORS, as a comma-separated string.
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_dictionary_path(self) -> Path:
        path = Path(self.dictionary_path)
        return path if path.is_absolute() else _BACKEND_ROOT / path


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (read once per process)."""
    return Settings()
