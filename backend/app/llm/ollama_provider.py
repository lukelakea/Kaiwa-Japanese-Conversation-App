"""Ollama implementation of :class:`LLMProvider`.

Talks to a local Ollama server's ``/api/chat`` endpoint in streaming mode.
Each streamed line is a JSON object; we forward the incremental
``message.content`` deltas to the caller.
"""

import json
from collections.abc import AsyncIterator, Sequence

import httpx

from app.llm.base import GenerationOptions, LLMError, LLMMessage, LLMProvider

# Generous read timeout: a large local model can take a while to produce the
# first token, and a streamed reply has no fixed length. A short connect
# timeout still fails fast when Ollama isn't running.
_TIMEOUT = httpx.Timeout(connect=5.0, read=None, write=10.0, pool=5.0)


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str) -> None:
        self._client = httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=_TIMEOUT)

    async def stream_chat(
        self,
        messages: Sequence[LLMMessage],
        options: GenerationOptions,
    ) -> AsyncIterator[str]:
        payload: dict[str, object] = {
            "model": options.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": True,
            "options": {"temperature": options.temperature},
        }
        # Ollama's "format": "json" constrains the output to a single valid JSON
        # object — far more reliable than asking a local model to format itself.
        if options.json_mode:
            payload["format"] = "json"

        try:
            async with self._client.stream("POST", "/api/chat", json=payload) as response:
                if response.status_code != httpx.codes.OK:
                    detail = (await response.aread()).decode("utf-8", "replace")
                    raise LLMError(
                        _describe_http_error(response.status_code, detail, options.model)
                    )

                async for line in response.aiter_lines():
                    delta = _extract_delta(line)
                    if delta:
                        yield delta
        except httpx.ConnectError as exc:
            raise LLMError(
                f"Could not reach Ollama. Is it running? ({self._client.base_url})"
            ) from exc
        except httpx.HTTPError as exc:
            raise LLMError(f"Ollama request failed: {exc}") from exc

    async def aclose(self) -> None:
        await self._client.aclose()


def _extract_delta(line: str) -> str:
    """Pull the incremental assistant text out of one streamed JSON line."""
    line = line.strip()
    if not line:
        return ""
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        return ""
    if data.get("error"):
        raise LLMError(f"Ollama error: {data['error']}")
    return data.get("message", {}).get("content", "")


def _describe_http_error(status: int, detail: str, model: str) -> str:
    if status == httpx.codes.NOT_FOUND:
        return f"Model '{model}' was not found by Ollama. Pull it first:  ollama pull {model}"
    return f"Ollama returned HTTP {status}: {detail[:300]}"
