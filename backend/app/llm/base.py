"""The provider-agnostic LLM interface.

This is the seam that keeps the rest of the app independent of any particular
model backend. Adding a new provider (e.g. Anthropic, post-1.0) means writing
one class that implements :class:`LLMProvider` — no feature code changes.
"""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class LLMMessage:
    """A single message in provider-neutral form.

    ``role`` is one of ``"system"``, ``"user"`` or ``"assistant"`` — the common
    denominator every chat model understands.
    """

    role: str
    content: str


@dataclass(frozen=True)
class GenerationOptions:
    """Per-request generation parameters, independent of any provider."""

    model: str
    temperature: float = 0.7
    # Ask the provider to return a single valid JSON object rather than free
    # text. Used by structured passes (e.g. feedback, Phase 3) where the reply
    # must be machine-parseable. Providers map this to their own JSON/structured
    # mode; it stays provider-neutral here.
    json_mode: bool = False


class LLMError(RuntimeError):
    """Raised when a provider cannot produce a response.

    Carries a human-readable message suitable for surfacing to the client
    (e.g. "Ollama is not reachable" / "model not found").
    """


class LLMProvider(ABC):
    """Abstract chat LLM.

    Streaming is the primary primitive: replies can be long and a conversation
    UI should render tokens as they arrive. A non-streaming :meth:`complete`
    convenience is derived from it.
    """

    @abstractmethod
    def stream_chat(
        self,
        messages: Sequence[LLMMessage],
        options: GenerationOptions,
    ) -> AsyncIterator[str]:
        """Yield reply text deltas in order as they are generated.

        Implementations should raise :class:`LLMError` if generation cannot
        start (e.g. the backend is unreachable or the model is missing).
        """
        raise NotImplementedError

    async def complete(
        self,
        messages: Sequence[LLMMessage],
        options: GenerationOptions,
    ) -> str:
        """Collect a full reply by draining :meth:`stream_chat`."""
        return "".join([delta async for delta in self.stream_chat(messages, options)])

    async def aclose(self) -> None:  # noqa: B027 — optional no-op hook, not abstract
        """Release any held resources (network clients, etc.). Optional override."""
