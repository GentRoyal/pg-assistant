import argparse
import json
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------- chunking

DEFAULT_MAX_TOKENS = 420
DEFAULT_MIN_TOKENS = 80
DEFAULT_OVERLAP_TOKENS = 64

SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9(\"'])")
BULLET_GLYPH = re.compile(r"^[•\-\*]\s+")

try:
    import tiktoken

    _ENCODER = tiktoken.get_encoding("cl100k_base")
except Exception:
    _ENCODER = None


def count_tokens(text):
    if not text:
        return 0
    if _ENCODER is not None:
        return len(_ENCODER.encode(text))
    return max(1, int(len(text.split()) * 1.3))


def render_block(block):
    text = block["text"]
    kind = block["type"]
    if kind == "heading":
        level = block.get("level") or 2
        return "#" * min(level, 6) + " " + text
    if kind == "list_item":
        return "- " + BULLET_GLYPH.sub("", text)
    return text


def flatten_blocks(document):
    flat = []
    stack = []

    for page in document["pages"]:
        for block in page["blocks"]:
            if block["type"] == "heading":
                level = block.get("level") or 2
                stack = [item for item in stack if item["level"] < level]
                stack.append({"level": level, "text": block["text"]})

            flat.append(
                {
                    "type": block["type"],
                    "level": block.get("level"),
                    "text": block["text"],
                    "rendered": render_block(block),
                    "page": block["page"],
                    "page_label": page.get("page_label"),
                    "continues_previous_page": block.get("continues_previous_page", False),
                    "section_path": [item["text"] for item in stack],
                }
            )

    return flat


def _split_oversized(block, max_tokens, overlap_tokens):
    sentences = SENTENCE_SPLIT.split(block["rendered"])
    if len(sentences) == 1:
        words = block["rendered"].split()
        step = max(1, int(max_tokens / 1.3))
        sentences = [" ".join(words[i : i + step]) for i in range(0, len(words), step)]

    pieces = []
    buffer = []
    buffer_tokens = 0

    for sentence in sentences:
        tokens = count_tokens(sentence)
        if buffer and buffer_tokens + tokens > max_tokens:
            pieces.append(" ".join(buffer))
            tail = _tail_text(" ".join(buffer), overlap_tokens)
            buffer = [tail] if tail else []
            buffer_tokens = count_tokens(tail)
        buffer.append(sentence)
        buffer_tokens += tokens

    if buffer:
        pieces.append(" ".join(buffer))

    return [dict(block, rendered=piece) for piece in pieces]


def _tail_text(text, overlap_tokens):
    if overlap_tokens <= 0 or not text:
        return ""
    sentences = SENTENCE_SPLIT.split(text)
    selected = []
    total = 0
    for sentence in reversed(sentences):
        tokens = count_tokens(sentence)
        if selected and total + tokens > overlap_tokens:
            break
        selected.insert(0, sentence)
        total += tokens
        if total >= overlap_tokens:
            break
    tail = " ".join(selected).strip()
    if count_tokens(tail) > overlap_tokens * 2:
        words = tail.split()
        tail = " ".join(words[-int(overlap_tokens / 1.3) :])
    return tail


def _build_chunk(document, blocks, index, overlap_text):
    body = []
    previous_kind = None
    for block in blocks:
        separator = "\n" if block["type"] == "list_item" and previous_kind == "list_item" else "\n\n"
        if body:
            body.append(separator)
        body.append(block["rendered"])
        previous_kind = block["type"]

    text = "".join(body).strip()
    if overlap_text:
        text = overlap_text.strip() + "\n\n" + text

    pages = sorted({block["page"] for block in blocks})
    section_path = blocks[0]["section_path"]
    heading = next(
        (block["text"] for block in blocks if block["type"] == "heading"),
        section_path[-1] if section_path else None,
    )
    breadcrumb = " > ".join([document["title"]] + section_path)

    return {
        "chunk_index": index,
        "text": text,
        "embedding_text": breadcrumb + "\n\n" + text if breadcrumb else text,
        "token_count": count_tokens(text),
        "heading": heading,
        "section_path": section_path,
        "page_start": pages[0],
        "page_end": pages[-1],
        "metadata": {
            "source": document["source"],
            "title": document["title"],
            "breadcrumb": breadcrumb,
            "pages": pages,
            "page_labels": sorted(
                {block["page_label"] for block in blocks if block.get("page_label")}
            ),
            "block_types": sorted({block["type"] for block in blocks}),
            "spans_page_break": len(pages) > 1,
            "has_overlap": bool(overlap_text),
        },
    }


def chunk_document(
    document,
    max_tokens=DEFAULT_MAX_TOKENS,
    min_tokens=DEFAULT_MIN_TOKENS,
    overlap_tokens=DEFAULT_OVERLAP_TOKENS,
):
    flat = flatten_blocks(document)
    budget = max(max_tokens - overlap_tokens, int(max_tokens * 0.5))

    expanded = []
    for block in flat:
        if count_tokens(block["rendered"]) > budget:
            expanded.extend(_split_oversized(block, budget, overlap_tokens))
        else:
            expanded.append(block)

    chunks = []
    buffer = []
    buffer_tokens = 0
    previous_chunk = None

    def close():
        nonlocal buffer, buffer_tokens, previous_chunk
        if not buffer:
            return
        overlap_text = ""
        if previous_chunk is not None and overlap_tokens > 0:
            same_section = previous_chunk["section_path"][:1] == buffer[0]["section_path"][:1]
            if same_section or buffer[0]["continues_previous_page"]:
                overlap_text = _tail_text(previous_chunk["text"], overlap_tokens)
        chunk = _build_chunk(document, buffer, len(chunks), overlap_text)
        chunks.append(chunk)
        previous_chunk = chunk
        buffer = []
        buffer_tokens = 0

    for block in expanded:
        tokens = count_tokens(block["rendered"])

        starts_section = block["type"] == "heading" and (block.get("level") or 2) <= 3
        if starts_section and buffer_tokens >= min_tokens:
            close()
        elif buffer and buffer_tokens + tokens > budget:
            close()

        buffer.append(block)
        buffer_tokens += tokens

    close()

    trailing_only_heading = [
        chunk
        for chunk in chunks
        if chunk["metadata"]["block_types"] == ["heading"] and chunk["token_count"] < min_tokens
    ]
    for orphan in trailing_only_heading:
        position = chunks.index(orphan)
        if position + 1 < len(chunks):
            following = chunks[position + 1]
            following["text"] = orphan["text"] + "\n\n" + following["text"]
            following["embedding_text"] = (
                following["metadata"]["breadcrumb"] + "\n\n" + following["text"]
            )
            following["token_count"] = count_tokens(following["text"])
            following["page_start"] = min(following["page_start"], orphan["page_start"])
            chunks.remove(orphan)

    for index, chunk in enumerate(chunks):
        chunk["chunk_index"] = index

    return chunks


# -------------------------------------------------------------- embeddings

PROVIDER_DEFAULTS = {
    "local": {"model": "BAAI/bge-small-en-v1.5", "dimensions": 384, "batch_size": 32},
    "gemini": {"model": "text-embedding-004", "dimensions": 768, "batch_size": 100},
    "openai": {"model": "text-embedding-3-small", "dimensions": 1536, "batch_size": 128},
}

# bge/e5 models are trained with an instruction prefix on the query side only.
LOCAL_QUERY_PREFIXES = {
    "bge": "Represent this sentence for searching relevant passages: ",
    "e5": "query: ",
}

MAX_RETRIES = 5
RETRY_BASE_DELAY = 2.0
MAX_LOCAL_SEQUENCE = 512


def _env(*names):
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return None


def _env_model(provider_var, model_var, provider):
    """
    The configured model only belongs to the configured provider. Without this,
    EMBEDDING_MODEL would follow a provider it does not belong to.
    """
    model = os.getenv(model_var)
    if not model:
        return None

    configured = (os.getenv(provider_var) or "").lower()
    if configured and configured != provider:
        return None
    return model


class Embedder:
    def __init__(self, provider=None, model=None, dimensions=None, batch_size=None):
        self.provider = (provider or os.getenv("EMBEDDING_PROVIDER") or "local").lower()
        if self.provider not in PROVIDER_DEFAULTS:
            raise ValueError(
                f"Unsupported EMBEDDING_PROVIDER '{self.provider}'. "
                f"Use one of: {', '.join(PROVIDER_DEFAULTS)}"
            )

        defaults = PROVIDER_DEFAULTS[self.provider]
        self.model = (
            model
            or _env_model("EMBEDDING_PROVIDER", "EMBEDDING_MODEL", self.provider)
            or defaults["model"]
        )
        self.dimensions = int(
            dimensions or os.getenv("EMBEDDING_DIMENSIONS") or defaults["dimensions"]
        )
        self.batch_size = int(batch_size or os.getenv("EMBEDDING_BATCH_SIZE") or defaults["batch_size"])
        self._client = None

    def _local_model(self):
        if self._client is None:
            import torch
            from transformers import AutoModel, AutoTokenizer

            tokenizer = AutoTokenizer.from_pretrained(self.model)
            model = AutoModel.from_pretrained(self.model)
            model.eval()
            device = os.getenv("EMBEDDING_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
            model.to(device)
            self._client = (tokenizer, model, device)
        return self._client

    def _local_query_prefix(self):
        name = self.model.lower()
        for marker, prefix in LOCAL_QUERY_PREFIXES.items():
            if marker in name:
                return prefix
        return ""

    def _embed_local(self, texts, task_type):
        import torch

        tokenizer, model, device = self._local_model()

        if task_type == "RETRIEVAL_QUERY":
            prefix = self._local_query_prefix()
            texts = [prefix + text for text in texts]

        batch = tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=MAX_LOCAL_SEQUENCE,
            return_tensors="pt",
        ).to(device)

        with torch.no_grad():
            output = model(**batch).last_hidden_state

        if "bge" in self.model.lower():
            pooled = output[:, 0]
        else:
            mask = batch["attention_mask"].unsqueeze(-1).float()
            pooled = (output * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)

        pooled = torch.nn.functional.normalize(pooled, p=2, dim=1)
        return pooled.cpu().tolist()

    def _gemini_client(self):
        if self._client is None:
            from google import genai

            api_key = _env("GEMINI_API_KEY", "GOOGLE_API_KEY", "LLM_API_KEY")
            if not api_key:
                raise RuntimeError("Set GEMINI_API_KEY (or LLM_API_KEY) in .env")
            self._client = genai.Client(api_key=api_key)
        return self._client

    def _openai_client(self):
        if self._client is None:
            from openai import OpenAI

            api_key = _env("OPENAI_API_KEY", "LLM_API_KEY")
            if not api_key:
                raise RuntimeError("Set OPENAI_API_KEY (or LLM_API_KEY) in .env")
            self._client = OpenAI(api_key=api_key)
        return self._client

    def _embed_gemini(self, texts, task_type):
        from google.genai import types

        client = self._gemini_client()
        config = types.EmbedContentConfig(task_type=task_type)
        if self.dimensions != PROVIDER_DEFAULTS["gemini"]["dimensions"]:
            config.output_dimensionality = self.dimensions

        response = client.models.embed_content(model=self.model, contents=texts, config=config)
        return [list(item.values) for item in response.embeddings]

    def _embed_openai(self, texts, task_type):
        client = self._openai_client()
        kwargs = {"model": self.model, "input": texts}
        if self.dimensions != PROVIDER_DEFAULTS["openai"]["dimensions"]:
            kwargs["dimensions"] = self.dimensions

        response = client.embeddings.create(**kwargs)
        return [list(item.embedding) for item in response.data]

    def _embed_batch(self, texts, task_type):
        call = {
            "local": self._embed_local,
            "gemini": self._embed_gemini,
            "openai": self._embed_openai,
        }[self.provider]

        retries = 1 if self.provider == "local" else MAX_RETRIES

        for attempt in range(retries):
            try:
                vectors = call(texts, task_type)
            except Exception as error:
                if attempt == retries - 1:
                    raise
                delay = RETRY_BASE_DELAY * (2**attempt)
                print(f"  embedding retry {attempt + 1}/{retries} in {delay:.0f}s ({error})")
                time.sleep(delay)
                continue

            for vector in vectors:
                if len(vector) != self.dimensions:
                    raise ValueError(
                        f"Model returned {len(vector)}-dim vectors but EMBEDDING_DIMENSIONS "
                        f"is {self.dimensions}; the pgvector column must match."
                    )
            return vectors

        return []

    def embed_documents(self, texts, progress=True):
        vectors = []
        for start in range(0, len(texts), self.batch_size):
            batch = texts[start : start + self.batch_size]
            vectors.extend(self._embed_batch(batch, "RETRIEVAL_DOCUMENT"))
            if progress:
                print(f"  embedded {len(vectors)}/{len(texts)}")
        return vectors

    def embed_query(self, text):
        return self._embed_batch([text], "RETRIEVAL_QUERY")[0]


def get_embedder():
    return Embedder()


# --------------------------------------------------------------------- cli

def main():
    parser = argparse.ArgumentParser(description="Chunk an extracted document JSON")
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/results/chunks.json"))
    parser.add_argument("--max-tokens", type=int, default=DEFAULT_MAX_TOKENS)
    parser.add_argument("--min-tokens", type=int, default=DEFAULT_MIN_TOKENS)
    parser.add_argument("--overlap-tokens", type=int, default=DEFAULT_OVERLAP_TOKENS)
    args = parser.parse_args()

    with open(args.input, encoding="utf-8") as handle:
        document = json.load(handle)

    chunks = chunk_document(document, args.max_tokens, args.min_tokens, args.overlap_tokens)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(chunks, handle, ensure_ascii=False, indent=2)

    sizes = [chunk["token_count"] for chunk in chunks]
    print(f"Chunks: {len(chunks)}")
    if sizes:
        print(f"Tokens min/avg/max: {min(sizes)}/{sum(sizes) // len(sizes)}/{max(sizes)}")
    print(f"Saved to {args.output}")


if __name__ == "__main__":
    main()
