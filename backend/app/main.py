"""FastAPI application entrypoint.

Wires configuration, CORS, rate limiting, and the routers, and owns the
lifecycle of the LLM / TTS / STT providers (built once on startup, closed on
shutdown).
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api import chat, feedback, reading, scenario, store, stt, translate, tts
from app.config import get_settings
from app.japanese import Dictionary, Tokenizer
from app.llm import build_provider
from app.ratelimit import build_limiter
from app.storage import JsonDocumentStore
from app.voice import build_stt_provider, build_tts_provider

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.provider = build_provider(settings)
    # Voice providers (Phase 5): VOICEVOX / faster-whisper locally, Google Cloud
    # in the hosted demo. Selected by config, behind the provider abstractions.
    app.state.tts_provider = build_tts_provider(settings)
    app.state.stt_provider = build_stt_provider(settings)
    # Reading aids (Phase 2): load the tokenizer once, and open the compiled
    # dictionary. The tokenizer always works; the dictionary degrades gracefully
    # if it has not been built yet (see scripts/build_dictionaries.py).
    app.state.tokenizer = Tokenizer()
    app.state.dictionary = Dictionary(settings.resolved_dictionary_path)
    # Local document store for the frontend's saved data (vocab, history, etc.).
    app.state.store = JsonDocumentStore(settings.resolved_data_dir)
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
        await app.state.tts_provider.aclose()
        await app.state.stt_provider.aclose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Kaiwa API", version="0.1.0", lifespan=lifespan)

    # Per-IP rate limiting (no-op unless KAIWA_RATE_LIMIT is set). Applied as
    # middleware so feature code stays untouched; see app/ratelimit.py.
    app.state.limiter = build_limiter(settings)
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

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
    app.include_router(store.router, prefix="/api", tags=["store"])
    app.include_router(stt.router, prefix="/api", tags=["voice"])
    app.include_router(tts.router, prefix="/api", tags=["voice"])

    @app.get("/api/health", tags=["health"])
    @app.state.limiter.exempt
    async def health() -> dict[str, str]:
        return {
            "status": "ok",
            "provider": settings.llm_provider,
            "model": settings.active_model,
            "tts_provider": settings.tts_provider,
        }

    return app


app = create_app()
