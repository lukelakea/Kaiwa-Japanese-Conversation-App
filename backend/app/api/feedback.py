"""Feedback endpoint (brief §8, Phase 3).

A separate, opt-out-free LLM call that critiques the user's most recent message
without interrupting the conversation. It runs in parallel with the chat reply
(the critique never depends on the reply), and returns a single JSON object —
forced via the provider's ``json_mode`` and validated defensively here, so the
client always receives a clean, typed result or a clear error.

Like the chat and translate endpoints, an unreachable model surfaces as a 502.
"""

import json
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.llm import GenerationOptions, LLMError, LLMMessage, LLMProvider
from app.models.feedback import FeedbackLabel, FeedbackRequest, FeedbackResponse
from app.prompts import compose_feedback_prompt, format_feedback_input

logger = logging.getLogger(__name__)
router = APIRouter()

_VALID_LABELS = {label.value for label in FeedbackLabel}


def get_provider(request: Request) -> LLMProvider:
    return request.app.state.provider


@router.post("/feedback", response_model=None)
async def feedback(
    payload: FeedbackRequest,
    provider: LLMProvider = Depends(get_provider),
    settings: Settings = Depends(get_settings),
) -> FeedbackResponse | JSONResponse:
    messages = [
        LLMMessage(role="system", content=compose_feedback_prompt(payload.settings)),
        LLMMessage(role="user", content=format_feedback_input(payload.text, payload.context)),
    ]
    options = GenerationOptions(
        model=settings.active_model,
        temperature=settings.feedback_temperature,
        json_mode=True,
    )

    try:
        raw = await provider.complete(messages, options)
    except LLMError as exc:
        logger.warning("Feedback generation failed: %s", exc)
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    parsed = _parse_feedback(raw)
    if parsed is None:
        logger.warning("Feedback response was not parseable JSON: %r", raw[:300])
        return JSONResponse(
            status_code=502,
            content={"detail": "Could not analyze this message. Try again."},
        )

    return parsed


def _parse_feedback(raw: str) -> FeedbackResponse | None:
    """Validate the model's JSON into a FeedbackResponse, or None if malformed.

    ``json_mode`` makes Ollama return a JSON object, so this is mostly a typed
    validation step; it stays defensive (brace extraction, label filtering)
    because a local model can still drift on the schema's finer points.
    """
    obj = _extract_json_object(raw)
    if not isinstance(obj, dict):
        return None

    acceptable = bool(obj.get("acceptable", True))
    labels = [
        value
        for value in obj.get("labels", [])
        if isinstance(value, str) and value in _VALID_LABELS
    ]
    raw_correction = obj.get("correction")
    correction = raw_correction.strip() if isinstance(raw_correction, str) else None
    explanation = str(obj.get("explanation", "")).strip()

    try:
        return FeedbackResponse(
            acceptable=acceptable,
            # Labels, correction, and explanation only matter for non-acceptable messages.
            labels=labels if not acceptable else [],
            correction=correction or None if not acceptable else None,
            explanation=(explanation or _fallback_explanation()) if not acceptable else None,
        )
    except ValidationError:
        return None


def _extract_json_object(raw: str) -> object:
    """Parse the first JSON object in ``raw``, tolerating stray fences/prose."""
    text = raw.strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None



def _fallback_explanation() -> str:
    return "This could be phrased more naturally."
