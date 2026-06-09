"""FastAPI application entrypoint.

Wires configuration, CORS, and the conversation router, and owns the lifecycle
of the LLM provider (built once on startup, closed on shutdown).
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, feedback, reading, scenario, stt, translate, tts
from app.config import get_settings
from app.japanese import Dictionary, Tokenizer
from app.llm import build_provider

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.provider = build_provider(settings)
    # Reading aids (Phase 2): load the tokenizer once, and open the compiled
    # dictionary. The tokenizer always works; the dictionary degrades gracefully
    # if it has not been built yet (see scripts/build_dictionaries.py).
    app.state.tokenizer = Tokenizer()
    app.state.dictionary = Dictionary(settings.resolved_dictionary_path)
    if not app.state.dictionary.available:
        logger.warning(
            "Dictionary not found at %s — hover-lookup will be empty. "
            "Run 'npm run setup:dict' to build it.",
            settings.resolved_dictionary_path,
        )
    try:
        yield
    finally:
        await app.state.provider.aclose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Kaiwa API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(chat.router, prefix="/api", tags=["chat"])
    app.include_router(reading.router, prefix="/api", tags=["reading"])
    app.include_router(translate.router, prefix="/api", tags=["translate"])
    app.include_router(feedback.router, prefix="/api", tags=["feedback"])
    app.include_router(scenario.router, prefix="/api/scenario", tags=["scenario"])
    app.include_router(stt.router, prefix="/api", tags=["voice"])
    app.include_router(tts.router, prefix="/api", tags=["voice"])

    @app.get("/api/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "provider": settings.llm_provider, "model": settings.ollama_model}

    return app


app = create_app()
