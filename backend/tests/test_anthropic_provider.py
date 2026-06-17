"""Unit tests for the Anthropic provider's two adaptations over the interface:
system-prompt hoisting and never forwarding sampling parameters. The SDK's
network layer is replaced with a fake, so these run offline.
"""

import asyncio

import httpx
import pytest

pytest.importorskip("anthropic")

import anthropic  # noqa: E402

from app.llm.anthropic_provider import AnthropicProvider, _split_system  # noqa: E402
from app.llm.base import GenerationOptions, LLMError, LLMMessage  # noqa: E402


def _opts(model: str = "claude-sonnet-4-6", temperature: float = 0.7) -> GenerationOptions:
    return GenerationOptions(model=model, temperature=temperature)


# --- system-prompt hoisting -------------------------------------------------


def test_split_system_hoists_and_maps_roles():
    system, turns = _split_system(
        [
            LLMMessage(role="system", content="be helpful"),
            LLMMessage(role="user", content="hi"),
            LLMMessage(role="assistant", content="yo"),
        ]
    )
    assert system == "be helpful"
    assert turns == [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "yo"},
    ]


def test_split_system_joins_multiple_system_messages():
    system, _ = _split_system(
        [
            LLMMessage(role="system", content="one"),
            LLMMessage(role="system", content="two"),
            LLMMessage(role="user", content="hi"),
        ]
    )
    assert system == "one\n\ntwo"


def test_split_system_injects_nudge_when_no_turns():
    # Scenario opening (brief §5): only the system prompt, no prior turns. The
    # Messages API needs at least one user turn, so a nudge is injected.
    _, turns = _split_system([LLMMessage(role="system", content="play a barista")])
    assert len(turns) == 1
    assert turns[0]["role"] == "user"
    assert turns[0]["content"]


# --- streaming behavior (fake SDK client) ----------------------------------


async def _agen(items):
    for item in items:
        yield item


class _FakeStream:
    def __init__(self, deltas, raise_exc=None):
        self._deltas = deltas
        self._raise = raise_exc

    async def __aenter__(self):
        if self._raise is not None:
            raise self._raise
        return self

    async def __aexit__(self, *exc):
        return False

    @property
    def text_stream(self):
        return _agen(self._deltas)


class _FakeMessages:
    def __init__(self, deltas, raise_exc=None):
        self._deltas = deltas
        self._raise = raise_exc
        self.calls: list[dict] = []

    def stream(self, **kwargs):
        self.calls.append(kwargs)
        return _FakeStream(self._deltas, self._raise)


class _FakeClient:
    def __init__(self, deltas, raise_exc=None):
        self.messages = _FakeMessages(deltas, raise_exc)


def _collect(provider, messages, options):
    async def run():
        return [delta async for delta in provider.stream_chat(messages, options)]

    return asyncio.run(run())


def test_stream_chat_yields_deltas_and_omits_temperature():
    provider = AnthropicProvider(api_key="k")
    provider._client = _FakeClient(["こん", "にちは"])

    out = _collect(
        provider,
        [
            LLMMessage(role="system", content="sys"),
            LLMMessage(role="user", content="hi"),
        ],
        _opts(),
    )

    assert out == ["こん", "にちは"]
    call = provider._client.messages.calls[0]
    assert call["system"] == "sys"
    assert call["messages"] == [{"role": "user", "content": "hi"}]
    assert call["model"] == "claude-sonnet-4-6"
    # Modern Claude models reject sampling params — they must never be forwarded.
    assert "temperature" not in call
    assert "top_p" not in call


def test_stream_chat_translates_api_error():
    provider = AnthropicProvider(api_key="k")
    exc = anthropic.APIConnectionError(request=httpx.Request("POST", "https://api.anthropic.com"))
    provider._client = _FakeClient([], raise_exc=exc)

    async def run():
        return [
            delta
            async for delta in provider.stream_chat(
                [LLMMessage(role="user", content="hi")], _opts()
            )
        ]

    with pytest.raises(LLMError):
        asyncio.run(run())
