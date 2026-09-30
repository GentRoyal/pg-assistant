import os
import re
import tempfile
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)

from api.auth import require_admin
from database.supabase_client import get_client

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

DOCUMENTS_TABLE = "documents"
CHUNKS_TABLE = "document_chunks"
QUERY_LOGS_TABLE = "query_logs"
ACTIVITY_TABLE = "activity_log"

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB") or 50)
# Scanned pages need OCR, which the API server does not run (see the upload notes).
MAX_SCANNED_SHARE = 0.5
# Nigeria is on West Africa Time all year, so "today" and "this week" use UTC+1.
WAT = timezone(timedelta(hours=1))
MAX_PAGE_SIZE = 10_000
MAX_LOG_ROWS = 10_000

DOCUMENT_COLUMNS = (
    "id, source, title, document_type, academic_level, total_pages, status, error, "
    "file_size, uploaded_at, updated_at"
)


# ------------------------------------------------------------------ helpers

def log_activity(label, tone="info"):
    try:
        get_client().table(ACTIVITY_TABLE).insert({"label": label, "tone": tone}).execute()
    except Exception as error:
        print(f"activity_log write failed: {error}")


def _display(value, empty="All"):
    """Stored tags are lowercase ("postgraduate"); the console shows "Postgraduate"."""
    return value.strip().title() if value else empty


def _stored(value):
    value = (value or "").strip().lower()
    return None if value in ("", "all") else value


def _chunk_count(client, document_id):
    return (
        client.table(CHUNKS_TABLE)
        .select("id", count="exact")
        .eq("document_id", document_id)
        .limit(1)
        .execute()
        .count
        or 0
    )


def _to_admin_document(client, row):
    return {
        "id": row["id"],
        "title": row.get("title") or row["source"],
        "fileName": row["source"],
        "documentType": _display(row.get("document_type"), "Document"),
        "academicLevel": _display(row.get("academic_level")),
        "pages": row.get("total_pages") or 0,
        "chunks": _chunk_count(client, row["id"]) if row.get("status") == "ready" else 0,
        "status": row.get("status") or "ready",
        "error": row.get("error"),
        "uploadedAt": row.get("uploaded_at"),
        "updatedAt": row.get("updated_at"),
        "sizeBytes": row.get("file_size") or 0,
    }


def _get_document(client, document_id):
    rows = (
        client.table(DOCUMENTS_TABLE).select(DOCUMENT_COLUMNS).eq("id", document_id).limit(1).execute().data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Document not found.")
    return rows[0]


def _safe_file_name(name):
    name = Path(name or "").name
    name = re.sub(r"[^\w.\- ]+", "_", name).strip()
    return name if name.lower().endswith(".pdf") else None


async def _read_pdf(file):
    file_name = _safe_file_name(file.filename)
    if not file_name:
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    data = await file.read()
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"The file is larger than {MAX_UPLOAD_MB} MB. Large scanned handbooks must be "
            f"processed with the local ingestion script.",
        )
    if not data.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="That file is not a valid PDF.")
    return file_name, data


def _source_taken(client, source, except_id=None):
    rows = client.table(DOCUMENTS_TABLE).select("id").eq("source", source).limit(1).execute().data
    return bool(rows) and rows[0]["id"] != except_id


def _now():
    return datetime.now(timezone.utc).isoformat()


# ------------------------------------------------------------- processing

def _scanned_share(path):
    import fitz

    from ingestion.pdf_extractor import page_needs_ocr

    with fitz.open(path) as pdf:
        total = len(pdf)
        scanned = sum(1 for page in pdf if page_needs_ocr(page))
    return total, scanned


def process_document(document_id, file_name, data, title):
    """
    Runs after the upload response: extract, chunk, embed and store the PDF.
    The server skips OCR, so a mostly scanned PDF is marked failed with a note to
    ingest it locally, where OCR is available.
    """
    client = get_client()
    try:
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / file_name
            path.write_bytes(data)

            total, scanned = _scanned_share(path)
            if total == 0 or scanned / total > MAX_SCANNED_SHARE:
                raise ValueError(
                    f"{scanned} of {total} pages are scanned images. Scanned PDFs need OCR; "
                    f"process this file with the local ingestion script."
                )

            from ingestion.pipeline import ingest_pdf

            row = _get_document(client, document_id)
            result = ingest_pdf(
                path,
                ocr="never",
                save_intermediate=False,
                force=True,
                title=title,
                attributes={
                    "document_type": row.get("document_type"),
                    "academic_level": row.get("academic_level"),
                },
            )
            if not result["inserted"]:
                raise ValueError("No readable text was found in this PDF.")

        note = f"{scanned} scanned page(s) were skipped." if scanned else None
        client.table(DOCUMENTS_TABLE).update(
            {"status": "ready", "error": note, "updated_at": _now()}
        ).eq("id", document_id).execute()
        log_activity(f"{title} is ready ({result['inserted']} chunks)", "success")
    except Exception as error:
        print(f"Processing {file_name} failed: {error}")
        client.table(CHUNKS_TABLE).delete().eq("document_id", document_id).execute()
        client.table(DOCUMENTS_TABLE).update(
            {"status": "failed", "error": str(error)[:500], "updated_at": _now()}
        ).eq("id", document_id).execute()
        log_activity(f"{title} failed to process", "warn")


def fail_interrupted_documents():
    """Uploads are processed in memory, so a restart loses any that were in progress."""
    try:
        get_client().table(DOCUMENTS_TABLE).update(
            {
                "status": "failed",
                "error": "Processing was interrupted by a server restart. Upload the file again.",
            }
        ).eq("status", "processing").execute()
    except Exception as error:
        print(f"Could not reset interrupted uploads: {error}")


# -------------------------------------------------------------- documents

@router.get("/documents")
def list_documents():
    client = get_client()
    rows = client.table(DOCUMENTS_TABLE).select(DOCUMENT_COLUMNS).order("updated_at", desc=True).execute().data
    return [_to_admin_document(client, row) for row in rows or []]


@router.post("/documents", status_code=201)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    documentType: str | None = Form(default=None),
    academicLevel: str | None = Form(default=None),
):
    client = get_client()
    file_name, data = await _read_pdf(file)
    if _source_taken(client, file_name):
        raise HTTPException(
            status_code=409,
            detail=f"A document named {file_name} already exists. Use Update to replace it.",
        )

    title = (title or "").strip() or Path(file_name).stem.replace("_", " ").replace("-", " ").strip()
    row = (
        client.table(DOCUMENTS_TABLE)
        .insert(
            {
                "source": file_name,
                "title": title,
                "document_type": _stored(documentType),
                "academic_level": _stored(academicLevel),
                "status": "processing",
                "file_size": len(data),
            }
        )
        .execute()
        .data[0]
    )
    log_activity(f"{title} uploaded — processing", "info")
    background.add_task(process_document, row["id"], file_name, data, title)
    return _to_admin_document(client, _get_document(client, row["id"]))


@router.put("/documents/{document_id}")
async def update_document(
    document_id: str,
    background: BackgroundTasks,
    file: UploadFile | None = File(default=None),
    title: str | None = Form(default=None),
    documentType: str | None = Form(default=None),
    academicLevel: str | None = Form(default=None),
):
    """Change a document's details, and when a file is sent, replace and re-process it."""
    client = get_client()
    row = _get_document(client, document_id)
    if row.get("status") == "processing":
        raise HTTPException(status_code=409, detail="This document is still processing. Try again shortly.")

    changes = {"updated_at": _now()}
    if title and title.strip():
        changes["title"] = title.strip()
    if documentType is not None:
        changes["document_type"] = _stored(documentType)
    if academicLevel is not None:
        changes["academic_level"] = _stored(academicLevel)

    new_file = None
    if file is not None and file.filename:
        file_name, data = await _read_pdf(file)
        if _source_taken(client, file_name, except_id=document_id):
            raise HTTPException(
                status_code=409, detail=f"Another document is already named {file_name}."
            )
        changes.update(
            {"source": file_name, "status": "processing", "error": None, "file_size": len(data)}
        )
        new_file = (file_name, data)

    client.table(DOCUMENTS_TABLE).update(changes).eq("id", document_id).execute()
    title = changes.get("title") or row.get("title") or row["source"]

    if new_file:
        log_activity(f"{title} replaced — processing", "info")
        background.add_task(process_document, document_id, new_file[0], new_file[1], title)
    else:
        log_activity(f"{title} details updated", "success")

    return _to_admin_document(client, _get_document(client, document_id))


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(document_id: str):
    client = get_client()
    row = _get_document(client, document_id)
    client.table(CHUNKS_TABLE).delete().eq("document_id", document_id).execute()
    client.table(DOCUMENTS_TABLE).delete().eq("id", document_id).execute()
    log_activity(f"{row.get('title') or row['source']} deleted", "warn")
    return Response(status_code=204)


# ------------------------------------------------------------ dashboard

def _logs_since(client, since, columns):
    return (
        client.table(QUERY_LOGS_TABLE)
        .select(columns)
        .gte("created_at", since.isoformat())
        .order("created_at", desc=True)
        .limit(MAX_LOG_ROWS)
        .execute()
        .data
        or []
    )


def _parse_time(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _count(client, table):
    return client.table(table).select("id", count="exact").limit(1).execute().count or 0


@router.get("/stats")
def stats(request: Request):
    client = get_client()
    now = datetime.now(WAT)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    monday = today - timedelta(days=today.weekday())
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    documents = client.table(DOCUMENTS_TABLE).select("id, title, total_pages, status").execute().data or []
    titles = {row["id"]: row.get("title") for row in documents}

    recent = _logs_since(
        client, min(week_ago, monday), "created_at, user_id, status, latency_ms, cited_document_ids"
    )
    trend = [0] * 7
    this_week = []
    for row in recent:
        at = _parse_time(row["created_at"]).astimezone(WAT)
        if at >= monday:
            trend[(at - monday).days] += 1
        if at >= week_ago:
            this_week.append(row)

    answered = [row for row in this_week if row.get("status") in ("answered", "weak")]
    latencies = [row["latency_ms"] for row in answered if row.get("latency_ms")]
    weak = sum(1 for row in answered if row.get("status") == "weak")

    cited = Counter()
    for row in _logs_since(client, month_ago, "cited_document_ids"):
        cited.update(row.get("cited_document_ids") or [])
    top_documents = [
        {"title": titles[document_id], "hits": hits}
        for document_id, hits in cited.most_common()
        if document_id in titles
    ][:5]

    activity = (
        client.table(ACTIVITY_TABLE).select("id, label, tone, created_at")
        .order("created_at", desc=True).limit(8).execute().data or []
    )

    unhealthy = getattr(request.app.state, "embedding_error", None) or getattr(
        request.app.state, "embedding_mismatch", None
    )
    return {
        "totalDocuments": len(documents),
        "totalChunks": _count(client, CHUNKS_TABLE),
        "totalPages": sum(row.get("total_pages") or 0 for row in documents if row.get("status") == "ready"),
        "questionsToday": sum(
            1 for row in recent if _parse_time(row["created_at"]).astimezone(WAT) >= today
        ),
        "questionsWeek": len(this_week),
        "activeStudents": len({row["user_id"] for row in this_week if row.get("user_id")}),
        "conversations": _count(client, "conversations"),
        "avgLatencyMs": round(sum(latencies) / len(latencies)) if latencies else 0,
        "weakRetrievalRate": round(weak / len(answered), 3) if answered else 0,
        "systemStatus": "degraded"
        if unhealthy or any(row.get("status") == "failed" for row in documents)
        else "ok",
        "questionsTrend": trend,
        "topDocuments": top_documents,
        "recentActivity": [
            {"id": row["id"], "label": row["label"], "at": row["created_at"], "tone": row["tone"]}
            for row in activity
        ],
    }


# --------------------------------------------------------------- reports

def _search_term(q):
    """PostgREST filter syntax treats these characters specially."""
    return re.sub(r"[,()*%\\]", " ", q or "").strip()


@router.get("/reports/queries")
def query_report(
    q: str | None = None,
    status: str | None = Query(default=None, pattern="^(answered|weak|error)$"),
    date_from: str | None = Query(default=None, alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: str | None = Query(default=None, alias="to", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=5, ge=1, le=MAX_PAGE_SIZE),
):
    client = get_client()
    query = client.table(QUERY_LOGS_TABLE).select(
        "id, created_at, student_email, question, status, latency_ms, top_source", count="exact"
    )
    if status:
        query = query.eq("status", status)
    if date_from:
        start = datetime.fromisoformat(date_from).replace(tzinfo=WAT)
        query = query.gte("created_at", start.isoformat())
    if date_to:
        end = datetime.fromisoformat(date_to).replace(tzinfo=WAT) + timedelta(days=1)
        query = query.lt("created_at", end.isoformat())
    term = _search_term(q)
    if term:
        query = query.or_(
            f"question.ilike.*{term}*,student_email.ilike.*{term}*,top_source.ilike.*{term}*"
        )

    start_row = (page - 1) * page_size
    response = (
        query.order("created_at", desc=True).range(start_row, start_row + page_size - 1).execute()
    )
    return {
        "items": [
            {
                "id": row["id"],
                "askedAt": row["created_at"],
                "studentEmail": row.get("student_email") or "unknown",
                "question": row["question"],
                "status": row.get("status") or "answered",
                "latencyMs": row.get("latency_ms") or 0,
                "topSource": row.get("top_source") or "—",
            }
            for row in response.data or []
        ],
        "total": response.count or 0,
        "page": page,
        "pageSize": page_size,
    }


@router.get("/reports/documents")
def document_report(
    q: str | None = None,
    status: str | None = Query(default=None, pattern="^(ready|processing|failed)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=5, ge=1, le=MAX_PAGE_SIZE),
):
    client = get_client()
    documents = client.table(DOCUMENTS_TABLE).select("id, title, source, document_type, status").execute().data or []

    hits = Counter()
    last_cited = {}
    logs = (
        client.table(QUERY_LOGS_TABLE).select("created_at, cited_document_ids")
        .not_.is_("cited_document_ids", "null")
        .order("created_at", desc=True).limit(MAX_LOG_ROWS).execute().data or []
    )
    for row in logs:
        for document_id in row.get("cited_document_ids") or []:
            hits[document_id] += 1
            last_cited.setdefault(document_id, row["created_at"])

    rows = [
        {
            "id": row["id"],
            "title": row.get("title") or row["source"],
            "documentType": _display(row.get("document_type"), "Document"),
            "hits": hits[row["id"]],
            "lastCitedAt": last_cited.get(row["id"]),
            "status": row.get("status") or "ready",
        }
        for row in documents
    ]
    if status:
        rows = [row for row in rows if row["status"] == status]
    needle = (q or "").strip().lower()
    if needle:
        rows = [
            row for row in rows
            if needle in row["title"].lower() or needle in row["documentType"].lower()
        ]
    rows.sort(key=lambda row: row["hits"], reverse=True)

    start_row = (page - 1) * page_size
    return {
        "items": rows[start_row : start_row + page_size],
        "total": len(rows),
        "page": page,
        "pageSize": page_size,
    }
