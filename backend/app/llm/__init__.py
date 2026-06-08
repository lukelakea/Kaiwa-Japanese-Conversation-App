"""LLM provider abstraction.

Feature code depends only on :class:`~app.llm.base.LLMProvider`. Concrete
providers (Ollama today, Anthropic later) are constructed by
:func:`~app.llm.factory.build_provider` and never imported directly by routes.
"""

from app.llm.base import GenerationOptions, LLMError, LLMMessage, LLMProvider
from app.llm.factory import build_provider

__all__ = [
    "GenerationOptions",
    "LLMError",
    "LLMMessage",
    "LLMProvider",
    "build_provider",
]
