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

    # Which provider the factory should build. "ollama" (local, the default) or
    # "anthropic" (cloud, opt-in). Local-first: the app runs fully against
    # Ollama with no cloud dependency unless this is switched.
    llm_provider: str = "ollama"

    # Ollama connection + default model. Model is intentionally configurable
    # rather than hardcoded so it can be swapped without code changes.
    #
    # Default is gemma3:27b: in testing it stayed reliably in Japanese, whereas
    # qwen2.5:32b — though strong at Japanese — intermittently code-switched to
    # Chinese mid-reply at every temperature tried. Swap freely via .env.
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma3:27b"

    # Anthropic (opt-in cloud provider). The key is held server-side and never
    # sent to the client. Sonnet is the default: a strong balance of quality and
    # cost for high-volume conversation. Requires the "anthropic" extra
    # (`uv sync --extra anthropic`) and KAIWA_LLM_PROVIDER=anthropic.
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-6"

    # Default sampling temperature for conversational replies.
    temperature: float = 0.7

    # Translation (brief §6) is a faithful transformation of an already-generated
    # reply, so it runs cooler than conversation to stay literal and stable.
    translation_temperature: float = 0.3

    # Feedback (brief §8) is a structured critique of the user's message; it runs
    # cool for consistent, well-formed JSON rather than creative variation.
    feedback_temperature: float = 0.3

    # Reading-aids dictionary (Phase 2), built by scripts/build_dictionaries.py.
    # Relative paths are resolved against the backend root.
    dictionary_path: str = "data/dictionary.sqlite"

    # Local document store for the frontend's saved data (vocab, conversation
    # history, custom scenarios, the grammar log, app settings). Persisting here
    # rather than in browser localStorage means the data survives a cleared or
    # changed browser. Relative paths resolve against the backend root.
    data_dir: str = "data/store"

    # Origins permitted by CORS, as a comma-separated string.
    cors_origins: str = "http://localhost:5173"

    # --- Voice (Phase 5) ---
    # VOICEVOX local HTTP API. Speaker 1 = 四国めたん ノーマル; see VOICEVOX
    # for the full speaker list. VOICEVOX must be running before TTS is used.
    voicevox_base_url: str = "http://localhost:50021"
    voicevox_speaker: int = 2

    # faster-whisper model size and target device. "base" is fast and accurate
    # enough for conversational Japanese; swap to "large-v3" for best accuracy.
    # compute_type "float16" is optimal for CUDA; use "int8" for CPU.
    whisper_model: str = "base"
    whisper_device: str = "cuda"
    whisper_compute_type: str = "float16"

    @property
    def active_model(self) -> str:
        """The model name for the configured provider.

        Lets feature code request a model without naming a vendor: the chat /
        translate / feedback / scenario endpoints pass this, and the factory
        decides which provider it belongs to.
        """
        return self.anthropic_model if self.llm_provider == "anthropic" else self.ollama_model

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_dictionary_path(self) -> Path:
        path = Path(self.dictionary_path)
        return path if path.is_absolute() else _BACKEND_ROOT / path

    @property
    def resolved_data_dir(self) -> Path:
        path = Path(self.data_dir)
        return path if path.is_absolute() else _BACKEND_ROOT / path


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (read once per process)."""
    return Settings()
