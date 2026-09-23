import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from generation.answer_generator import LLM_DEFAULTS, AnswerGenerator, ConversationStore, LLMClient
from ingestion.chunk_embedder import Embedder
from retrieval.retriever import DEFAULT_MATCH_COUNT, DEFAULT_THRESHOLD, Retriever

app = FastAPI(
    title="UI Academic Regulation Assistant",
    description="Retrieval and grounded question answering over university regulation documents",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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


class RetrieveRequest(BaseModel):
    question: str = Field(min_length=2)
    match_count: int = Field(default=DEFAULT_MATCH_COUNT, ge=1, le=50)
    threshold: float = Field(default=DEFAULT_THRESHOLD, ge=0.0, le=1.0)
    hybrid: bool = True
    collapse_sections: bool = False
    filters: Filters = Filters()


class ChatRequest(BaseModel):
    question: str = Field(min_length=2)
    conversation_id: str | None = None
    llm_provider: str | None = Field(default=None, description="local, gemini or openai")
    llm_model: str | None = None
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
    return {
        "status": "ok",
        "embedding": f"{retriever.embedder.provider}/{retriever.embedder.model}",
        "embedding_dimensions": retriever.embedder.dimensions,
        "llm_providers": list(LLM_DEFAULTS),
    }


@app.post("/retrieve")
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


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    if request.llm_provider and request.llm_provider.lower() not in LLM_DEFAULTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown llm_provider. Use one of: {', '.join(LLM_DEFAULTS)}",
        )

    try:
        llm = LLMClient(
            provider=request.llm_provider,
            model=request.llm_model,
            temperature=request.temperature,
        )
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
        )
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    store = ConversationStore(get_retriever().client)
    conversation = store.get(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {"conversation": conversation, "messages": store.messages(conversation_id)}


@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    store = ConversationStore(get_retriever().client)
    if store.get(conversation_id) is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    store.delete(conversation_id)
    return {"deleted": conversation_id}
