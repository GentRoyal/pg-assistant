import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

try:
    from ingestion.chunk_embedder import (
        DEFAULT_MAX_TOKENS,
        DEFAULT_MIN_TOKENS,
        DEFAULT_OVERLAP_TOKENS,
        Embedder,
        chunk_document,
    )
    from ingestion.pdf_extractor import OCR_DPI, extract_document
except ImportError:
    from chunk_embedder import (
        DEFAULT_MAX_TOKENS,
        DEFAULT_MIN_TOKENS,
        DEFAULT_OVERLAP_TOKENS,
        Embedder,
        chunk_document,
    )
    from pdf_extractor import OCR_DPI, extract_document

INSERT_BATCH_SIZE = 100
EMBEDDING_PRECISION = 6
RESULTS_DIR = Path("data/results")
DOCUMENTS_TABLE = "documents"
CHUNKS_TABLE = "document_chunks"
DOCUMENT_ATTRIBUTES = (
    "document_type",
    "academic_level",
    "department",
    "version",
    "academic_session",
    "effective_date",
)


def file_hash(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def _upsert_document(client, document, content_hash, embedder, attributes=None):
    payload = {
        "source": document["source"],
        "title": document["title"],
        "file_path": document["path"],
        "total_pages": document["total_pages"],
        "page_range": document["page_range"],
        "content_hash": content_hash,
        "embedding_model": f"{embedder.provider}/{embedder.model}",
        "embedding_dimensions": embedder.dimensions,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    payload.update({key: value for key, value in (attributes or {}).items() if value})

    response = client.table(DOCUMENTS_TABLE).upsert(payload, on_conflict="source").execute()
    return response.data[0]["id"]


def _existing_hash(client, source):
    response = (
        client.table(DOCUMENTS_TABLE)
        .select("id, content_hash")
        .eq("source", source)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]["content_hash"]
    return None


def _insert_chunks(client, document_id, chunks):
    rows = []
    for chunk in chunks:
        rows.append(
            {
                "document_id": document_id,
                "chunk_index": chunk["chunk_index"],
                "content": chunk["text"],
                "token_count": chunk["token_count"],
                "section_title": chunk["heading"],
                "page_start": chunk["page_start"],
                "page_end": chunk["page_end"],
                "metadata": dict(chunk["metadata"], section_path=chunk["section_path"]),
                "embedding": chunk["embedding"],
            }
        )

    inserted = 0
    for start in range(0, len(rows), INSERT_BATCH_SIZE):
        batch = rows[start : start + INSERT_BATCH_SIZE]
        try:
            client.table(CHUNKS_TABLE).upsert(
                batch, on_conflict="document_id,chunk_index"
            ).execute()
        except Exception as error:
            if "dimensions" in str(error):
                raise RuntimeError(
                    f"{error}\n\nThe document_chunks.embedding column size does not match the "
                    f"embedding model. Re-run database/schema.sql (it resizes the column), or set "
                    f"EMBEDDING_PROVIDER/EMBEDDING_DIMENSIONS in .env to match the column."
                ) from error
            raise
        inserted += len(batch)
        print(f"  inserted {inserted}/{len(rows)}")

    return inserted


REQUIRED_DOCUMENT_COLUMNS = "source, content_hash, file_path, total_pages, embedding_model"

SCHEMA_HINT = (
    "The Supabase schema is not set up yet.\n"
    "Open the Supabase SQL editor and run, in order:\n"
    "  1. database/schema.sql\n"
    "  2. database/vector_search.sql\n"
    "Then re-run this command."
)


def _verify_schema(client):
    try:
        client.table(DOCUMENTS_TABLE).select(REQUIRED_DOCUMENT_COLUMNS).limit(1).execute()
        client.table(CHUNKS_TABLE).select("id").limit(1).execute()
    except Exception as error:
        raise RuntimeError(f"{SCHEMA_HINT}\n\nPostgREST said: {error}") from error


def _get_client():
    try:
        from database.supabase_client import get_client
    except ImportError:
        import sys

        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from database.supabase_client import get_client

    return get_client()


def embed_chunks(chunks, embedder=None):
    embedder = embedder or Embedder()
    print(f"Embedding with {embedder.provider}/{embedder.model} ({embedder.dimensions}d)")

    vectors = embedder.embed_documents([chunk["embedding_text"] for chunk in chunks])
    model_name = f"{embedder.provider}/{embedder.model}"

    for chunk, vector in zip(chunks, vectors):
        chunk["metadata"]["embedding_model"] = model_name
        chunk["metadata"]["embedding_dimensions"] = embedder.dimensions
        chunk["embedding"] = [round(value, EMBEDDING_PRECISION) for value in vector]

    return embedder


def _save_intermediate(pdf_path, document, chunks):
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    stem = pdf_path.stem

    with open(RESULTS_DIR / f"{stem}.extracted.json", "w", encoding="utf-8") as handle:
        json.dump(document, handle, ensure_ascii=False, indent=2)
    with open(RESULTS_DIR / f"{stem}.chunks.json", "w", encoding="utf-8") as handle:
        json.dump(chunks, handle, ensure_ascii=False, indent=2)

    print(f"Intermediate JSON written to {RESULTS_DIR}")


def ingest_pdf(
    pdf_path,
    start_page=None,
    end_page=None,
    max_tokens=DEFAULT_MAX_TOKENS,
    min_tokens=DEFAULT_MIN_TOKENS,
    overlap_tokens=DEFAULT_OVERLAP_TOKENS,
    ocr="auto",
    ocr_dpi=OCR_DPI,
    save_intermediate=True,
    dry_run=False,
    embed=True,
    force=False,
    attributes=None,
    embedder=None,
):
    pdf_path = Path(pdf_path)

    print(f"\n=== {pdf_path.name} ===")
    document = extract_document(pdf_path, start_page, end_page, ocr=ocr, ocr_dpi=ocr_dpi)
    chunks = chunk_document(document, max_tokens, min_tokens, overlap_tokens)

    sizes = [chunk["token_count"] for chunk in chunks]
    print(f"Chunks: {len(chunks)}")
    if sizes:
        print(f"Tokens min/avg/max: {min(sizes)}/{sum(sizes) // len(sizes)}/{max(sizes)}")

    client = None
    content_hash = file_hash(pdf_path)

    if not dry_run:
        client = _get_client()
        _verify_schema(client)
        if not force and _existing_hash(client, document["source"]) == content_hash:
            print("Unchanged since last ingest (same content hash). Use --force to re-ingest.")
            return {"document": document, "chunks": chunks, "inserted": 0}

    if embed:
        embedder = embed_chunks(chunks, embedder)
    else:
        print("Skipping embeddings (--no-embed).")

    if save_intermediate:
        _save_intermediate(pdf_path, document, chunks)

    if dry_run:
        print("Dry run: skipping Supabase insert.")
        return {"document": document, "chunks": chunks, "inserted": 0}

    if not embed:
        print("No embeddings generated, nothing to store. Drop --no-embed to insert.")
        return {"document": document, "chunks": chunks, "inserted": 0}

    document_id = _upsert_document(client, document, content_hash, embedder, attributes)
    client.table(CHUNKS_TABLE).delete().eq("document_id", document_id).execute()
    inserted = _insert_chunks(client, document_id, chunks)

    print(f"Stored {inserted} chunks for document {document_id}")
    return {"document": document, "chunks": chunks, "inserted": inserted}


def ingest_directory(directory, **kwargs):
    directory = Path(directory)
    pdfs = sorted(directory.glob("*.pdf"))
    if not pdfs:
        print(f"No PDFs found in {directory}")
        return []
    return [ingest_pdf(pdf, **kwargs) for pdf in pdfs]
