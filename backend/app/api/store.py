"""User-data persistence endpoints.

A small key-value document store backing the frontend's saved collections
(vocab, conversation history, custom scenarios, the grammar log, app settings).
Each collection is one JSON document: ``GET`` reads it, ``PUT`` overwrites it.
The server stays oblivious to the document shape — see ``app/storage/store.py``.

The synchronous file IO is dispatched to a worker thread so it never blocks the
event loop, matching the reading-aid endpoints.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool

from app.storage import JsonDocumentStore, UnknownCollection

router = APIRouter()


def get_store(request: Request) -> JsonDocumentStore:
    return request.app.state.store


@router.get("/store/{collection}", response_model=None)
async def read_collection(
    collection: str,
    store: JsonDocumentStore = Depends(get_store),
) -> Response:
    """Return a collection's document, or 404 if nothing is stored yet."""
    try:
        document = await run_in_threadpool(store.read, collection)
    except UnknownCollection as exc:
        raise HTTPException(status_code=404, detail=f"Unknown collection: {collection}") from exc
    if document is None:
        raise HTTPException(status_code=404, detail="No data stored yet.")
    return JSONResponse(content=document)


@router.put("/store/{collection}", status_code=204, response_model=None)
async def write_collection(
    collection: str,
    request: Request,
    store: JsonDocumentStore = Depends(get_store),
) -> Response:
    """Overwrite a collection with the JSON request body."""
    try:
        document: Any = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Request body must be valid JSON.") from exc
    try:
        await run_in_threadpool(store.write, collection, document)
    except UnknownCollection as exc:
        raise HTTPException(status_code=404, detail=f"Unknown collection: {collection}") from exc
    return Response(status_code=204)
