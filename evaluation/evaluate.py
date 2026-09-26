import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from evaluation.test_queries import TEST_QUERIES
from generation.answer_generator import LLMClient
from generation.prompts import ANSWER_TEMPLATE, NO_CONTEXT_REPLY, SYSTEM_PROMPT
from retrieval.retriever import DEFAULT_MATCH_COUNT, Retriever, format_context

CONTEXT_CHAR_BUDGET = 12000

# Phrases the assistant uses when the excerpts do not answer the question.
REFUSAL = re.compile(
    r"could not find|do(es)? not (contain|include|provide|specify|mention|state)|"
    r"no information|not (available|covered|mentioned) in",
    re.IGNORECASE,
)


def _hit_rank(results, case):
    """1-based rank of the first result from an expected source and page, else None."""
    for rank, result in enumerate(results, start=1):
        if result.get("source") not in case["sources"]:
            continue
        pages = case.get("pages")
        if pages is None:
            return rank
        start = result.get("page_start") or 0
        end = result.get("page_end") or start
        if any(start <= page <= end for page in pages):
            return rank
    return None


def _answer(llm, question, results):
    """
    Generate the way AnswerGenerator does for a first message, without writing
    a conversation or query log to Supabase.
    """
    if not results:
        return NO_CONTEXT_REPLY
    context = format_context(results, max_chars=CONTEXT_CHAR_BUDGET)
    prompt = ANSWER_TEMPLATE.format(context=context, question=question)
    return llm.complete(SYSTEM_PROMPT, [{"role": "user", "content": prompt}])


def _check_answer(answer, case):
    if not case.get("answerable", True):
        return bool(REFUSAL.search(answer)), "should say it cannot answer"
    if REFUSAL.search(answer) and not case.get("expect"):
        return False, "refused"
    missing = [pattern for pattern in case.get("expect", []) if not re.search(pattern, answer, re.I)]
    if missing:
        return False, f"missing {', '.join(missing)}"
    return True, ""


def evaluate(match_count, hybrid, answers, verbose):
    retriever = Retriever()
    llm = LLMClient() if answers else None
    rows = []

    for case in TEST_QUERIES:
        results = retriever.search(case["question"], match_count=match_count, hybrid=hybrid)
        row = {"question": case["question"], "answerable": case.get("answerable", True)}

        if row["answerable"]:
            row["rank"] = _hit_rank(results, case)
        if answers:
            row["answer"] = _answer(llm, case["question"], results)
            row["answer_ok"], row["answer_note"] = _check_answer(row["answer"], case)

        rows.append(row)
        _print_row(row, results, verbose)

    return rows


def _print_row(row, results, verbose):
    if row["answerable"]:
        rank = row["rank"]
        retrieval = f"hit@{rank}" if rank else "MISS"
    else:
        retrieval = "n/a"

    line = f"{retrieval:>6}  "
    if "answer_ok" in row:
        line += ("ok    " if row["answer_ok"] else "FAIL  ")
    print(line + row["question"])

    if "answer_ok" in row and not row["answer_ok"]:
        print(f"        {row['answer_note']}: {' '.join(row['answer'].split())[:160]}")
    if verbose or (row["answerable"] and not row["rank"]):
        for result in results[:3]:
            print(f"        got {result.get('source')} p.{result.get('page_start')}")


def summarise(rows, match_count):
    answerable = [row for row in rows if row["answerable"]]
    ranks = [row["rank"] for row in answerable]

    def hit_at(k):
        return sum(1 for rank in ranks if rank and rank <= k) / len(ranks)

    summary = {
        "questions": len(rows),
        "hit@1": round(hit_at(1), 3),
        "hit@3": round(hit_at(3), 3),
        f"hit@{match_count}": round(hit_at(match_count), 3),
        "mrr": round(sum(1 / rank for rank in ranks if rank) / len(ranks), 3),
    }
    if any("answer_ok" in row for row in rows):
        summary["answers_ok"] = round(sum(row["answer_ok"] for row in rows) / len(rows), 3)
        unanswerable = [row for row in rows if not row["answerable"]]
        if unanswerable:
            summary["refused_out_of_scope"] = f"{sum(row['answer_ok'] for row in unanswerable)}/{len(unanswerable)}"
    return summary


def main():
    parser = argparse.ArgumentParser(
        description="Score retrieval (and optionally answers) against evaluation/test_queries.py"
    )
    parser.add_argument("-k", "--match-count", type=int, default=DEFAULT_MATCH_COUNT)
    parser.add_argument("--no-hybrid", action="store_true", help="Vector search only")
    parser.add_argument(
        "--answers",
        action="store_true",
        help="Also generate answers with the configured LLM and check them (costs LLM calls)",
    )
    parser.add_argument("--verbose", action="store_true", help="Show the top sources for every question")
    parser.add_argument("--output", type=Path, default=None, help="Write per-question results as JSON")
    args = parser.parse_args()

    rows = evaluate(args.match_count, not args.no_hybrid, args.answers, args.verbose)
    summary = summarise(rows, args.match_count)

    print("\n" + json.dumps(summary, indent=2))

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps({"summary": summary, "rows": rows}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"Saved to {args.output}")


if __name__ == "__main__":
    main()
