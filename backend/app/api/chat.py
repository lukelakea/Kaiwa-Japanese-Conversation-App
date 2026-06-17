"""Conversation endpoint.

Composes the system prompt from the request's settings/mode, prepends it to the
conversation history, and streams the model's reply back as UTF-8 text deltas.

Failure handling uses a small "peek" pattern: we pull the first delta before
opening the streaming response, so the common startup failures (Ollama not
running, model not pulled) become a clean HTTP 502 with a helpful message
rather than a half-open stream. Errors that occur mid-stream end the stream.
"""

import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.config import Settings, get_settings
from app.llm import GenerationOptions, LLMError, LLMMessage, LLMProvider
from app.models.conversation import ChatRequest
from app.prompts import compose_system_prompt

logger = logging.getLogger(__name__)
router = APIRouter()


def get_provider(request: Request) -> LLMProvider:
    return request.app.state.provider


@router.post("/chat", response_model=None)
async def chat(
    payload: ChatRequest,
    provider: LLMProvider = Depends(get_provider),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse | JSONResponse:
    system_prompt = compose_system_prompt(payload.settings, payload.mode, payload.scenario)
    messages = [
        LLMMessage(role="system", content=system_prompt),
        *[LLMMessage(role=m.role.value, content=m.content) for m in payload.messages],
    ]
    options = GenerationOptions(
        model=settings.active_model,
        temperature=settings.temperature,
    )

    stream = provider.stream_chat(messages, options)

    # Peek the first delta so connection/model errors surface as a real status.
    try:
        first_delta = await anext(stream, "")
    except LLMError as exc:
        logger.warning("LLM generation failed to start: %s", exc)
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    async def body() -> AsyncIterator[str]:
        if first_delta:
            yield first_delta
        try:
            async for delta in stream:
                yield delta
        except LLMError as exc:
            logger.warning("LLM stream interrupted mid-reply: %s", exc)

    return StreamingResponse(body(), media_type="text/plain; charset=utf-8")
