"""Scenario generation endpoint (brief §5, Phase 4 — Generated mode).

The LLM produces a scenario description (title, roles, situation) from an
optional theme and the learner's current settings. JSON mode is used for the
same reliability reasons as the feedback endpoint.
"""

import json
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.llm import GenerationOptions, LLMError, LLMMessage, LLMProvider
from app.models.conversation import GenerateScenarioRequest, GenerateScenarioResponse, Scenario
from app.prompts.scenario_prompt import (
    GENERATE_SCENARIO_SYSTEM_PROMPT,
    compose_generate_scenario_input,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def get_provider(request: Request) -> LLMProvider:
    return request.app.state.provider


@router.post("/generate", response_model=None)
async def generate_scenario(
    payload: GenerateScenarioRequest,
    provider: LLMProvider = Depends(get_provider),
    settings: Settings = Depends(get_settings),
) -> GenerateScenarioResponse | JSONResponse:
    messages = [
        LLMMessage(role="system", content=GENERATE_SCENARIO_SYSTEM_PROMPT),
        LLMMessage(
            role="user",
            content=compose_generate_scenario_input(payload.theme, payload.settings),
        ),
    ]
    options = GenerationOptions(
        model=settings.ollama_model,
        temperature=0.9,
        json_mode=True,
    )

    try:
        raw = await provider.complete(messages, options)
    except LLMError as exc:
        logger.warning("Scenario generation failed: %s", exc)
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    scenario = _parse_scenario(raw)
    if scenario is None:
        logger.warning("Scenario response was not parseable: %r", raw[:300])
        return JSONResponse(
            status_code=502,
            content={"detail": "Could not generate a valid scenario. Please try again."},
        )

    return GenerateScenarioResponse(scenario=scenario)


def _parse_scenario(raw: str) -> Scenario | None:
    text = raw.strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        obj = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None

    if not isinstance(obj, dict):
        return None

    try:
        return Scenario(
            title=str(obj.get("title", "")).strip(),
            title_ja=str(obj.get("title_ja", "")).strip(),
            description=str(obj.get("description", "")).strip(),
            user_role=str(obj.get("user_role", "")).strip(),
            ai_role=str(obj.get("ai_role", "")).strip(),
        )
    except ValidationError:
        return None
