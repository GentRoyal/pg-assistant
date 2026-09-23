import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retrieval.filters import build_filters, describe
from retrieval.retriever import DEFAULT_MATCH_COUNT, DEFAULT_THRESHOLD, Retriever, format_context


def main():
    parser = argparse.ArgumentParser(description="Search the ingested regulation chunks")
    parser.add_argument("question", nargs="+")
    parser.add_argument("-k", "--match-count", type=int, default=DEFAULT_MATCH_COUNT)
    parser.add_argument("-t", "--threshold", type=float, default=DEFAULT_THRESHOLD)
    parser.add_argument("--source", action="append", default=None, help="Filter by file name")
    parser.add_argument("--document-type", default=None)
    parser.add_argument("--academic-level", default=None)
    parser.add_argument("--no-hybrid", action="store_true", help="Vector search only")
    parser.add_argument("--collapse-sections", action="store_true", help="One hit per section")
    parser.add_argument("--context", action="store_true", help="Print the LLM-ready context block")
    parser.add_argument("--json", action="store_true", help="Print raw results as JSON")
    parser.add_argument("--log", action="store_true", help="Write the query to query_logs")
    args = parser.parse_args()

    question = " ".join(args.question)
    retriever = Retriever()

    print(f"Question: {question}")
    print(f"Embedding: {retriever.embedder.provider}/{retriever.embedder.model}")
    print(
        f"Filters: {describe(build_filters(args.source, args.document_type, args.academic_level))}"
    )

    results = retriever.search(
        question,
        match_count=args.match_count,
        threshold=args.threshold,
        sources=args.source,
        document_type=args.document_type,
        academic_level=args.academic_level,
        hybrid=not args.no_hybrid,
        collapse_sections=args.collapse_sections,
    )

    if not results:
        print("\nNo chunks above the similarity threshold. Try -t 0 or a broader question.")
        return

    if args.json:
        print(json.dumps(results, indent=2, default=str))
    elif args.context:
        print()
        print(format_context(results))
    else:
        print(f"\n{len(results)} result(s):\n")
        for position, result in enumerate(results, start=1):
            score = result.get("similarity")
            score = f"{score:.3f}" if isinstance(score, (int, float)) else "keyword"
            pages = result.get("page_start")
            if result.get("page_end") and result["page_end"] != pages:
                pages = f"{result['page_start']}-{result['page_end']}"
            print(f"[{position}] {score} | {result.get('source')} p.{pages}")
            print(f"    {result.get('section_title') or '(no section)'}")
            snippet = " ".join(result["content"].split())[:220]
            print(f"    {snippet}...\n")

    if args.log:
        retriever.log_query(question, results=results)
        print("Logged to query_logs.")


if __name__ == "__main__":
    main()
