"""Translation endpoint (brief §6, Phase 2).

A separate, opt-in LLM call that turns an already-generated Japanese reply into
English. Unlike the conversation stream this returns a single JSON payload: the
translated text is short and the UI reveals it as one block under the reply, so
there is nothing to gain from streaming it.

Like the chat endpoint, a failure to reach the model surfaces as a clean 502.
"""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.llm import GenerationOptions, LLMError, LLMMessage, LLMProvider
from app.models.reading import TranslateRequest, TranslateResponse
from app.prompts import TRANSLATION_SYSTEM_PROMPT

logger = logging.getLogger(__name__)
router = APIRouter()


def get_provider(request: Request) -> LLMProvider:
    return request.app.state.provider


@router.post("/translate", response_model=None)
async def translate(
    payload: TranslateRequest,
    provider: LLMProvider = Depends(get_provider),
    settings: Settings = Depends(get_settings),
) -> TranslateResponse | JSONResponse:
    messages = [
        LLMMessage(role="system", content=TRANSLATION_SYSTEM_PROMPT),
        LLMMessage(role="user", content=payload.text),
    ]
    options = GenerationOptions(
        model=settings.ollama_model,
        temperature=settings.translation_temperature,
    )

    try:
        translation = await provider.complete(messages, options)
    except LLMError as exc:
        logger.warning("Translation failed: %s", exc)
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    return TranslateResponse(translation=translation.strip())
