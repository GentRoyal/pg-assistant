import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from generation.answer_generator import AnswerGenerator, ConversationStore, LLMClient
from retrieval.retriever import DEFAULT_MATCH_COUNT, DEFAULT_THRESHOLD, Retriever

from api.admin import fail_interrupted_documents
from api.admin import router as admin_router
from api.auth import require_admin, require_user
from api.auth import router as auth_router
from api.rate_limit import chat_limit, retrieve_limit

# Browsers may only call the API from these sites. Set ALLOWED_ORIGINS to the
# Vercel URL(s), comma separated. Local dev goes through the Vite proxy, which
# is same-origin, so these defaults only matter when calling the API directly.
ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in (
        os.getenv("ALLOWED_ORIGINS") or "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]



@asynccontextmanager
async def lifespan(app: FastAPI):
    # The local embedding model takes ~15s to load. Do it at boot so the first
    # question does not look like it has hung, and so /health can report
    # whether embeddings actually work rather than just echoing the config.
    retriever = get_retriever()
    try:
        retriever.embedder.embed_query("warm up")
        app.state.embedding_error = None
        print(f"Embedding model ready: {retriever.embedder.provider}/{retriever.embedder.model}")
    except Exception as error:
        app.state.embedding_error = str(error)
        print(f"EMBEDDINGS ARE NOT WORKING: {error}")

    app.state.embedding_mismatch = _check_stored_vectors(retriever)
    if app.state.embedding_mismatch:
        print(f"WARNING: {app.state.embedding_mismatch}")

    fail_interrupted_documents()
    yield


def _check_stored_vectors(retriever):
    """
    Vectors from different embedding models are not comparable, so querying with
    one model against chunks embedded with another returns plausible-looking
    nonsense. Catch that at boot rather than in someone's search results.
    """
    try:
        rows = retriever.client.table("documents").select("embedding_model").execute().data or []
    except Exception:
        return None

    current = f"{retriever.embedder.provider}/{retriever.embedder.model}"
    stored = sorted({row["embedding_model"] for row in rows if row.get("embedding_model")})
    stale = [model for model in stored if model != current]
    if not stale:
        return None

    return (
        f"Stored vectors were built with {', '.join(stale)} but queries use {current}. "
        f"Re-ingest the documents (scripts/ingest_documents.py --force) or switch the "
        f"embedding settings back."
    )


app = FastAPI(
    title="UI Academic Regulation Assistant",
    description="Retrieval and grounded question answering over university regulation documents",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(Exception)
async def unhandled_error(request: Request, error: Exception):
    """
    Starlette returns unhandled 500s from outside the CORS middleware, so the
    browser blocks them and the caller sees a generic network failure instead of
    the real error. Handling them here keeps the CORS headers on the response.
    """
    print(f"Unhandled error on {request.url.path}: {type(error).__name__}: {error}")

    # Set by hand: this handler runs outside CORSMiddleware, so without it
    # the browser drops the response and the caller sees a network failure.
    headers = {"Vary": "Origin"}
    origin = request.headers.get("origin", "").rstrip("/")
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin

    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(error).__name__}: {error}"},
        headers=headers,
    )

app.include_router(auth_router)
app.include_router(admin_router)

_retriever = None


def get_retriever():
    global _retriever
    if _retriever is None:
        _retriever = Retriever()
    return _retriever


class Filters(BaseModel):
    sources: list[str] | None = None
    document_type: str | None = None
    academic_level: str | None = None


MAX_QUESTION_LENGTH = 2000


class RetrieveRequest(BaseModel):
    question: str = Field(min_length=2, max_length=MAX_QUESTION_LENGTH)
    match_count: int = Field(default=DEFAULT_MATCH_COUNT, ge=1, le=50)
    threshold: float = Field(default=DEFAULT_THRESHOLD, ge=0.0, le=1.0)
    hybrid: bool = True
    collapse_sections: bool = False
    filters: Filters = Filters()


class ChatRequest(BaseModel):
    question: str = Field(min_length=2, max_length=MAX_QUESTION_LENGTH)
    conversation_id: str | None = None
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)
    match_count: int | None = Field(default=None, ge=1, le=50)
    threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    hybrid: bool = True
    filters: Filters = Filters()


class Citation(BaseModel):
    index: int
    chunk_id: str | None = None
    source: str | None = None
    title: str | None = None
    section_title: str | None = None
    page_start: int | None = None
    page_end: int | None = None
    similarity: float | None = None
    content: str | None = None


class ChatResponse(BaseModel):
    conversation_id: str
    question: str
    search_query: str
    answer: str
    citations: list[Citation]
    llm: str
    latency_ms: int


@app.get("/health")
def health():
    retriever = get_retriever()
    llm = LLMClient()
    embedding_error = getattr(app.state, "embedding_error", None)
    mismatch = getattr(app.state, "embedding_mismatch", None)

    return {
        "status": "degraded" if (embedding_error or mismatch) else "ok",
        "embedding": f"{retriever.embedder.provider}/{retriever.embedder.model}",
        "embedding_dimensions": retriever.embedder.dimensions,
        "embedding_ready": embedding_error is None,
        "embedding_error": embedding_error,
        "embedding_mismatch": getattr(app.state, "embedding_mismatch", None),
        "llm": f"{llm.provider}/{llm.model}",
    }


# A debugging aid for the team, so admins only.
@app.post("/retrieve", dependencies=[Depends(retrieve_limit), Depends(require_admin)])
def retrieve(request: RetrieveRequest):
    try:
        results = get_retriever().search(
            request.question,
            match_count=request.match_count,
            threshold=request.threshold,
            sources=request.filters.sources,
            document_type=request.filters.document_type,
            academic_level=request.filters.academic_level,
            hybrid=request.hybrid,
            collapse_sections=request.collapse_sections,
        )
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    return {"question": request.question, "count": len(results), "results": results}


def _log_failed_question(question, user):
    """A question that errored still counts in the admin reports."""
    try:
        get_retriever().log_query(question, user=user, status="error", latency_ms=0)
    except Exception as error:
        print(f"  query_logs write failed: {error}")


@app.post("/chat", response_model=ChatResponse, dependencies=[Depends(chat_limit)])
def chat(request: ChatRequest, user=Depends(require_user)):
    try:
        # The model comes from LLM_PROVIDER/LLM_MODEL only; requests cannot pick one.
        llm = LLMClient(temperature=request.temperature)
        generator = AnswerGenerator(retriever=get_retriever(), llm=llm)
        return generator.answer(
            request.question,
            conversation_id=request.conversation_id,
            match_count=request.match_count,
            threshold=request.threshold,
            sources=request.filters.sources,
            document_type=request.filters.document_type,
            academic_level=request.filters.academic_level,
            hybrid=request.hybrid,
            user=user,
        )
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RuntimeError as error:
        _log_failed_question(request.question, user)
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception:
        _log_failed_question(request.question, user)
        raise


def _own_conversation(store, conversation_id, user):
    """Students see only their own conversations; admins can open any."""
    conversation = store.get(conversation_id)
    visible = conversation is not None and (
        user["role"] == "admin" or conversation.get("user_id") in (None, user["id"])
    )
    if not visible:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


class RenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)


# The chat list is always the caller's own, admins included; the admin
# reports are where everyone's questions are visible.
@app.get("/conversations")
def list_conversations(user=Depends(require_user)):
    store = ConversationStore(get_retriever().client)
    return {"conversations": store.list_for_user(user["id"])}


@app.delete("/conversations", status_code=204)
def delete_all_conversations(user=Depends(require_user)):
    ConversationStore(get_retriever().client).delete_for_user(user["id"])


@app.patch("/conversations/{conversation_id}")
def rename_conversation(conversation_id: str, request: RenameRequest, user=Depends(require_user)):
    store = ConversationStore(get_retriever().client)
    _own_conversation(store, conversation_id, user)

    title = " ".join(request.title.split())
    if not title:
        raise HTTPException(status_code=422, detail="The chat name cannot be empty.")
    store.rename(conversation_id, title)
    return {"id": conversation_id, "title": title}


@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, user=Depends(require_user)):
    store = ConversationStore(get_retriever().client)
    conversation = _own_conversation(store, conversation_id, user)
    return {"conversation": conversation, "messages": store.messages(conversation_id)}


@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, user=Depends(require_user)):
    store = ConversationStore(get_retriever().client)
    _own_conversation(store, conversation_id, user)

    store.delete(conversation_id)
    return {"deleted": conversation_id}
