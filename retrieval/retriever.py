import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database.supabase_client import get_client
from ingestion.chunk_embedder import Embedder
from retrieval.filters import build_filters, deduplicate_by_section

CHUNKS_TABLE = "document_chunks"
RPC_NAME = "match_chunks"
RRF_K = 60

DEFAULT_MATCH_COUNT = int(os.getenv("RETRIEVAL_MATCH_COUNT") or 8)
DEFAULT_THRESHOLD = float(os.getenv("RETRIEVAL_SIMILARITY_THRESHOLD") or 0.3)

# Course codes such as "CSC 103" or "csc103". Embeddings barely register them and
# plain keyword search returns matches unranked, so they get a search of their own.
COURSE_CODE = re.compile(r"(?<![A-Za-z])([A-Za-z]{3})(\s?)(\d{3})(?!\d)")
# Lowercase words that look like a prefix in "and 200 level" but are not codes.
NOT_CODE_PREFIXES = {
    "and", "are", "any", "all", "but", "for", "has", "had", "its", "not", "one",
    "our", "per", "the", "two", "was", "who", "yet",
}

# documents!inner so that filters on the embedded table actually drop chunk rows.
CHUNK_SELECT = (
    "id, document_id, chunk_index, section_title, content, page_start, page_end, metadata, "
    "documents!inner(source, title, document_type, academic_level)"
)


def _normalise_keyword_row(row):
    document = row.pop("documents", None) or {}
    row.update(
        {
            "source": document.get("source"),
            "title": document.get("title"),
            "document_type": document.get("document_type"),
            "academic_level": document.get("academic_level"),
            "similarity": None,
        }
    )
    return row


def course_codes(question):
    codes = []
    for prefix, space, number in COURSE_CODE.findall(question):
        if not prefix.isupper() and space and prefix.lower() in NOT_CODE_PREFIXES:
            continue
        code = (prefix.upper(), number)
        if code not in codes:
            codes.append(code)
    return codes


def _code_rank(row, codes):
    """Sort key: the code in a heading beats the code in passing, then by mentions."""
    patterns = [re.compile(rf"\b{prefix}\s?{number}\b", re.IGNORECASE) for prefix, number in codes]
    headings = [row.get("section_title") or ""] + [
        line for line in row["content"].splitlines() if line.startswith("#")
    ]
    in_heading = any(pattern.search(heading) for pattern in patterns for heading in headings)
    mentions = sum(len(pattern.findall(row["content"])) for pattern in patterns)
    return (not in_heading, -mentions)


def _reciprocal_rank_fusion(ranked_lists):
    scores = {}
    merged = {}

    for results in ranked_lists:
        for rank, result in enumerate(results):
            key = result["id"]
            scores[key] = scores.get(key, 0.0) + 1.0 / (RRF_K + rank + 1)
            if key not in merged or merged[key].get("similarity") is None:
                merged[key] = result

    ordered = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    output = []
    for key, score in ordered:
        result = merged[key]
        result["rrf_score"] = round(score, 6)
        output.append(result)
    return output


class Retriever:
    def __init__(self, client=None, embedder=None):
        self.client = client or get_client()
        self.embedder = embedder or Embedder()

    def vector_search(self, question, match_count, threshold, filters):
        payload = {
            "query_embedding": self.embedder.embed_query(question),
            "match_count": match_count,
            "similarity_threshold": threshold,
        }
        payload.update(filters)

        try:
            response = self.client.rpc(RPC_NAME, payload).execute()
        except Exception as error:
            if RPC_NAME in str(error) or "PGRST202" in str(error):
                raise RuntimeError(
                    f"The {RPC_NAME}() function is missing from Supabase. Check that "
                    f"SUPABASE_URL points at the right project.\n\n{error}"
                ) from error
            raise

        return response.data or []

    def keyword_search(self, question, match_count, filters):
        query = self.client.table(CHUNKS_TABLE).select(CHUNK_SELECT)

        if filters.get("filter_sources"):
            query = query.in_("documents.source", filters["filter_sources"])
        if filters.get("filter_document_type"):
            query = query.eq("documents.document_type", filters["filter_document_type"])
        if filters.get("filter_academic_level"):
            query = query.eq("documents.academic_level", filters["filter_academic_level"])

        try:
            # text_search() returns a builder with no filter or limit methods, so it goes last.
            response = (
                query.limit(match_count)
                .text_search(
                    "content", question, options={"type": "web_search", "config": "english"}
                )
                .execute()
            )
        except Exception as error:
            print(f"  keyword search unavailable ({error}); using vector results only")
            return []

        return [_normalise_keyword_row(row) for row in (response.data or [])]

    def code_search(self, question, match_count, filters):
        codes = course_codes(question)
        if not codes:
            return []

        # Documents write codes both ways, and the full-text parser treats
        # "CSC103" as one token, so search for both spellings.
        terms = " or ".join(f'"{prefix} {number}" or {prefix}{number}' for prefix, number in codes)
        rows = self.keyword_search(terms, match_count * 4, filters)
        return sorted(rows, key=lambda row: _code_rank(row, codes))[:match_count]

    def search(
        self,
        question,
        match_count=DEFAULT_MATCH_COUNT,
        threshold=DEFAULT_THRESHOLD,
        sources=None,
        document_type=None,
        academic_level=None,
        hybrid=True,
        collapse_sections=False,
    ):
        filters = build_filters(sources, document_type, academic_level)

        vector_results = self.vector_search(question, match_count, threshold, filters)

        if not hybrid:
            results = vector_results
        else:
            keyword_results = self.keyword_search(question, match_count, filters)
            code_results = self.code_search(question, match_count, filters)
            extra = [ranked for ranked in (keyword_results, code_results) if ranked]
            results = (
                _reciprocal_rank_fusion([vector_results] + extra) if extra else vector_results
            )

        if collapse_sections:
            results = deduplicate_by_section(results)

        return results[:match_count]

    def log_query(self, question, answer=None, results=None):
        payload = {
            "question": question,
            "answer": answer,
            "retrieved_chunk_ids": [result["id"] for result in (results or [])],
        }
        self.client.table("query_logs").insert(payload).execute()


def format_context(results, max_chars=None):
    blocks = []
    for position, result in enumerate(results, start=1):
        pages = result.get("page_start")
        if result.get("page_end") and result["page_end"] != pages:
            pages = f"{result['page_start']}-{result['page_end']}"

        header = f"[{position}] {result.get('title') or result.get('source')}"
        if result.get("section_title"):
            header += f" — {result['section_title']}"
        if pages:
            header += f" (p. {pages})"

        blocks.append(f"{header}\n{result['content']}")

    context = "\n\n---\n\n".join(blocks)
    if max_chars and len(context) > max_chars:
        context = context[:max_chars].rstrip() + "\n[context truncated]"
    return context


def retrieve(question, **kwargs):
    return Retriever().search(question, **kwargs)
