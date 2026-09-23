import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingestion.chunk_embedder import (
    DEFAULT_MAX_TOKENS,
    DEFAULT_MIN_TOKENS,
    DEFAULT_OVERLAP_TOKENS,
)
from ingestion.pdf_extractor import OCR_DPI
from ingestion.pipeline import DOCUMENT_ATTRIBUTES, ingest_directory, ingest_pdf


def main():
    parser = argparse.ArgumentParser(
        description="Extract, clean, chunk, embed and store PDFs in Supabase"
    )
    parser.add_argument(
        "path",
        type=Path,
        nargs="?",
        default=Path("data/documents"),
        help="PDF file or directory of PDFs",
    )
    parser.add_argument("--start-page", type=int, default=None)
    parser.add_argument("--end-page", type=int, default=None)
    parser.add_argument("--max-tokens", type=int, default=DEFAULT_MAX_TOKENS)
    parser.add_argument("--min-tokens", type=int, default=DEFAULT_MIN_TOKENS)
    parser.add_argument("--overlap-tokens", type=int, default=DEFAULT_OVERLAP_TOKENS)
    parser.add_argument("--dry-run", action="store_true", help="Embed and save JSON, but do not write to Supabase")
    parser.add_argument("--no-embed", action="store_true", help="Structure only, skip embeddings")
    parser.add_argument("--force", action="store_true", help="Re-ingest even if unchanged")
    parser.add_argument("--no-save", action="store_true", help="Skip writing intermediate JSON")
    parser.add_argument(
        "--ocr",
        choices=("auto", "always", "never"),
        default="auto",
        help="OCR scanned pages (auto: only pages with no text layer)",
    )
    parser.add_argument("--ocr-dpi", type=int, default=OCR_DPI)

    for attribute in DOCUMENT_ATTRIBUTES:
        parser.add_argument(f"--{attribute.replace('_', '-')}", default=None)

    args = parser.parse_args()

    options = {
        "max_tokens": args.max_tokens,
        "min_tokens": args.min_tokens,
        "overlap_tokens": args.overlap_tokens,
        "save_intermediate": not args.no_save,
        "dry_run": args.dry_run,
        "embed": not args.no_embed,
        "ocr": args.ocr,
        "ocr_dpi": args.ocr_dpi,
        "force": args.force,
        "attributes": {name: getattr(args, name) for name in DOCUMENT_ATTRIBUTES},
    }

    if args.path.is_dir():
        results = ingest_directory(args.path, **options)
    else:
        results = [
            ingest_pdf(args.path, start_page=args.start_page, end_page=args.end_page, **options)
        ]

    total = sum(result["inserted"] for result in results)
    print(f"\nDone. {len(results)} document(s), {total} chunk(s) stored.")


if __name__ == "__main__":
    main()
