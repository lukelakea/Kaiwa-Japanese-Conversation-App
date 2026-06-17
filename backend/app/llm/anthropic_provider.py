"""Anthropic implementation of :class:`LLMProvider`.

Talks to the Anthropic Messages API via the official SDK in streaming mode.
This module is imported lazily by the factory only when the provider is
selected, so the ``anthropic`` dependency stays optional and the local-first
Ollama path never needs it.

Two shapes differ from Ollama and are reconciled here, behind the interface:

* **System prompt placement.** Feature code prepends the system prompt as a
  ``role="system"`` message (Ollama's convention). The Messages API takes it as
  a top-level ``system`` parameter instead, so we hoist those messages out.
* **Sampling parameters.** The current Claude models (Opus 4.x, Sonnet 4.6,
  Fable 5) reject ``temperature``/``top_p`` — the model is configurable, so we
  never forward it and let the system prompt steer register and variety. The
  per-call cooler temperatures used for translation/feedback are dropped; those
  passes stay stable because Claude follows the JSON prompt reliably.
"""

from collections.abc import AsyncIterator, Sequence

import anthropic

from app.llm.base import GenerationOptions, LLMError, LLMMessage, LLMProvider

# The Messages API requires max_tokens. Conversational replies and translations
# are short; this ceiling is generous headroom, not a target length.
_DEFAULT_MAX_TOKENS = 4096

# When a scenario opens (brief §5) the request carries only the system prompt
# and no prior turns. Ollama generates from system alone, but the Messages API
# needs at least one user turn, so we inject a minimal Japanese nudge — the
# system prompt's scenario framing does the real work. It is never stored
# client-side (the frontend keeps only the assistant's opening reply).
_OPENING_NUDGE = "（会話を始めてください）"


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str, max_tokens: int = _DEFAULT_MAX_TOKENS) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=api_key)
        self._max_tokens = max_tokens

    async def stream_chat(
        self,
        messages: Sequence[LLMMessage],
        options: GenerationOptions,
    ) -> AsyncIterator[str]:
        system, turns = _split_system(messages)

        try:
            async with self._client.messages.stream(
                model=options.model,
                max_tokens=self._max_tokens,
                system=system,
                messages=turns,
            ) as stream:
                async for delta in stream.text_stream:
                    if delta:
                        yield delta
        except anthropic.APIError as exc:
            raise LLMError(_describe_error(exc, options.model)) from exc

    async def aclose(self) -> None:
        await self._client.aclose()


def _split_system(messages: Sequence[LLMMessage]) -> tuple[str, list[dict[str, str]]]:
    """Separate system messages (→ ``system`` param) from the conversation turns.

    Multiple system messages are joined; the remaining user/assistant turns are
    mapped to the Messages API shape. If no turns remain (a scenario opening),
    a minimal user nudge is injected so the API has something to reply to.
    """
    system_parts = [m.content for m in messages if m.role == "system"]
    turns = [{"role": m.role, "content": m.content} for m in messages if m.role != "system"]
    if not turns:
        turns.append({"role": "user", "content": _OPENING_NUDGE})
    return "\n\n".join(system_parts), turns


def _describe_error(exc: anthropic.APIError, model: str) -> str:
    """Translate an SDK error into a human-readable, client-safe message."""
    if isinstance(exc, anthropic.AuthenticationError):
        return "Anthropic rejected the API key. Check KAIWA_ANTHROPIC_API_KEY."
    if isinstance(exc, anthropic.NotFoundError):
        return f"Model '{model}' was not found by Anthropic. Check KAIWA_ANTHROPIC_MODEL."
    if isinstance(exc, anthropic.RateLimitError):
        return "Anthropic rate limit reached. Wait a moment and try again."
    if isinstance(exc, anthropic.APIConnectionError):
        return "Could not reach Anthropic. Check your network connection."
    if isinstance(exc, anthropic.APIStatusError):
        return f"Anthropic returned HTTP {exc.status_code}: {exc.message}"
    return f"Anthropic request failed: {exc}"
