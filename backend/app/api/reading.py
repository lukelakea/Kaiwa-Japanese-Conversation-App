"""Reading-aid endpoints (Phase 2): tokenisation and dictionary hover-lookup.

Both are deterministic and local (no LLM). The synchronous SudachiPy / SQLite
work is dispatched to a worker thread so it never blocks the event loop.
"""

from fastapi import APIRouter, Depends, Query, Request
from starlette.concurrency import run_in_threadpool

from app.japanese import Dictionary, Tokenizer
from app.models.reading import LookupResponse, TokenizeRequest, TokenizeResponse

router = APIRouter()


def get_tokenizer(request: Request) -> Tokenizer:
    return request.app.state.tokenizer


def get_dictionary(request: Request) -> Dictionary:
    return request.app.state.dictionary


@router.post("/tokenize", response_model=TokenizeResponse)
async def tokenize(
    payload: TokenizeRequest,
    tokenizer: Tokenizer = Depends(get_tokenizer),
) -> TokenizeResponse:
    """Tokenise a reply into words with furigana and dictionary-form lemmas."""
    tokens = await run_in_threadpool(tokenizer.tokenize, payload.text)
    return TokenizeResponse(tokens=tokens)


@router.get("/lookup", response_model=LookupResponse)
async def lookup(
    surface: str = Query(..., min_length=1, description="The token as written."),
    lemma: str = Query("", description="The token's dictionary form, if known."),
    dictionary: Dictionary = Depends(get_dictionary),
) -> LookupResponse:
    """Look up a token: JMdict word senses plus KANJIDIC2 detail per kanji."""
    return await run_in_threadpool(dictionary.look_up, surface, lemma or surface)
