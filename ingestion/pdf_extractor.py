import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import fitz

LIGATURES = {
    "ﬀ": "ff",
    "ﬁ": "fi",
    "ﬂ": "fl",
    "ﬃ": "ffi",
    "ﬄ": "ffl",
    "ﬅ": "st",
    "ﬆ": "st",
}

PUNCTUATION_MAP = {
    "‘": "'",
    "’": "'",
    "‚": "'",
    "“": '"',
    "”": '"',
    "„": '"',
    "–": "-",
    "—": "-",
    "―": "-",
    "−": "-",
    " ": " ",
    " ": " ",
    " ": " ",
    "​": "",
    "‌": "",
    "‍": "",
    "﻿": "",
    "­": "",
}

CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
DOT_LEADER = re.compile(r"[.·…_\-]{4,}\s*\d{0,4}\s*$")
DOT_LEADER_LINE = re.compile(r"^.{2,}?[.·…]{4,}\s*\d{0,4}$")
LEADER_RUN = re.compile(r"�{2,}")
LEADING_GLYPH = re.compile(r"^\s*�\s+")
MULTI_SPACE = re.compile(r"[ \t]+")
HYPHEN_BREAK = re.compile(r"(\w)-$")

PAGE_NUMBER_PATTERNS = [
    re.compile(r"^\(?\s*(?:page|pg\.?|p\.)?\s*(\d{1,4})\s*(?:of\s*\d{1,4})?\s*\)?$", re.IGNORECASE),
    re.compile(r"^[-–—|\[\(]\s*(\d{1,4})\s*[-–—|\]\)]$"),
    re.compile(r"^(?:[ivxlcdm]{1,7})$", re.IGNORECASE),
]

BULLET_PREFIX = re.compile(
    r"^\s*(?:"
    r"[•●○▪■◦‣⁃∙·−–—\-\*o]\s+"
    r"|\(?\d{1,2}[.)]\s+"
    r"|\(\s*[a-zA-Z]\s*\)\s*"
    r"|[a-z][.)]\s+"
    r"|\(\s*[ivxIVX]{1,4}\s*\)\s*"
    r"|[ivx]{1,4}[.)]\s+"
    r")"
)

NUMBERED_HEADING = re.compile(
    r"^\s*(?:"
    r"(?:CHAPTER|SECTION|PART|APPENDIX|ANNEX|SCHEDULE|ARTICLE|RULE)\s+[A-Z0-9IVXivx]+"
    r"|\d{1,2}(?:\.\d{1,2}){0,3}"
    r")\s*[.:\)–—-]?\s+\S",
    re.IGNORECASE,
)

SENTENCE_END = re.compile(r"[.!?:;,]$")
URL_OR_EMAIL = re.compile(r"(https?://\S+|www\.\S+|\S+@\S+\.\S+)")
REPEATED_PUNCT = re.compile(r"([^\w\s])\1{3,}")
TOC_HEADING = re.compile(r"^\s*(table\s+of\s+contents|contents|index)\s*$", re.IGNORECASE)


def normalize_unicode(text):
    text = unicodedata.normalize("NFKC", text)
    for source, target in LIGATURES.items():
        text = text.replace(source, target)
    for source, target in PUNCTUATION_MAP.items():
        text = text.replace(source, target)
    text = LEADER_RUN.sub("....", text)
    text = LEADING_GLYPH.sub("• ", text)
    text = text.replace("�", "")
    return CONTROL_CHARS.sub("", text)


def collapse_whitespace(text):
    return MULTI_SPACE.sub(" ", text).strip()


def strip_dot_leaders(text):
    return DOT_LEADER.sub("", text).strip()


def join_lines(lines):
    parts = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if parts and HYPHEN_BREAK.search(parts[-1]):
            parts[-1] = parts[-1][:-1] + line
        else:
            parts.append(line)
    text = " ".join(parts)
    text = REPEATED_PUNCT.sub(r"\1", text)
    return collapse_whitespace(text)


def page_number_value(text):
    candidate = collapse_whitespace(strip_dot_leaders(text))
    if not candidate or len(candidate) > 16:
        return None
    for pattern in PAGE_NUMBER_PATTERNS:
        match = pattern.match(candidate)
        if match:
            return candidate
    return None


def is_page_number(text):
    return page_number_value(text) is not None


def is_toc_line(text):
    stripped = text.strip()
    if TOC_HEADING.match(stripped):
        return True
    return bool(DOT_LEADER_LINE.match(stripped))


def is_noise(text):
    stripped = collapse_whitespace(text)
    if not stripped:
        return True
    if len(stripped) <= 2 and not stripped.isdigit():
        return True
    letters = sum(character.isalpha() for character in stripped)
    if letters == 0 and not URL_OR_EMAIL.search(stripped):
        return True
    if letters / max(len(stripped), 1) < 0.25 and len(stripped) < 40:
        return True
    return False


def starts_list_item(text):
    if URL_OR_EMAIL.match(text.strip()):
        return False
    return bool(BULLET_PREFIX.match(text))


def looks_like_heading_text(text, max_words=18):
    stripped = collapse_whitespace(text)
    if not stripped or len(stripped) > 160:
        return False
    words = stripped.split()
    if len(words) > max_words:
        return False
    if SENTENCE_END.search(stripped) and not stripped.endswith(":"):
        return False
    if NUMBERED_HEADING.match(stripped):
        return True
    alpha = [character for character in stripped if character.isalpha()]
    if alpha and sum(character.isupper() for character in alpha) / len(alpha) > 0.75:
        return True
    if stripped.istitle() and len(words) <= 10:
        return True
    return False


def heading_level(text, size_rank=2):
    stripped = collapse_whitespace(text)
    if re.match(r"^(CHAPTER|PART|SECTION|APPENDIX|ANNEX|SCHEDULE)\b", stripped, re.IGNORECASE):
        return 1
    match = re.match(r"^(\d{1,2}(?:\.\d{1,2})*)", stripped)
    if match:
        return min(match.group(1).count(".") + 2, 6)
    return size_rank


def clean_block_text(text):
    return collapse_whitespace(normalize_unicode(text))


BOLD_FLAG = 1 << 4
MARGIN_RATIO = 0.08
CAPTION_PATTERN = re.compile(r"^(figure|fig\.?|table|chart|box|exhibit)\s*\d", re.IGNORECASE)
LOWER_START = re.compile(r"^[a-z(]")
SECTION_NUMBER_ONLY = re.compile(r"^\d{1,2}(?:\.\d{1,2})*\.$|^\d{1,2}(?:\.\d{1,2})+$")
OPEN_END = re.compile(r"[,;:\-]$|\w$")

OCR_MIN_CHARS = 40
OCR_MIN_CONFIDENCE = 0.5
OCR_DPI = 200
OCR_SIZE_RATIO = 0.8
RUNON_MIN_LENGTH = 10
RUNON_CONNECTIVES = {
    "a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on",
    "or", "the", "to", "with",
}


def _line_info(line):
    text = "".join(span["text"] for span in line["spans"])
    spans = [span for span in line["spans"] if span["text"].strip()]
    if not spans:
        return None
    size = max(round(span["size"], 1) for span in spans)
    bold = any(
        span["flags"] & BOLD_FLAG
        or "bold" in span["font"].lower()
        or "black" in span["font"].lower()
        for span in spans
    )
    return {
        "text": normalize_unicode(text),
        "size": size,
        "bold": bold,
        "x0": line["bbox"][0],
        "y0": line["bbox"][1],
        "y1": line["bbox"][3],
    }


def _page_lines(page):
    blocks = page.get_text("dict")["blocks"]
    result = []
    for block in sorted(blocks, key=lambda b: (round(b["bbox"][1], 1), b["bbox"][0])):
        if block.get("type") != 0:
            continue
        lines = []
        for line in block.get("lines", []):
            info = _line_info(line)
            if info:
                lines.append(info)
        if lines:
            result.append(lines)
    return result


_OCR_ENGINE = None


def _ocr_engine():
    global _OCR_ENGINE
    if _OCR_ENGINE is None:
        from rapidocr_onnxruntime import RapidOCR

        _OCR_ENGINE = RapidOCR()
    return _OCR_ENGINE


def page_needs_ocr(page, min_chars=OCR_MIN_CHARS):
    return len(page.get_text().strip()) < min_chars


def _ocr_boxes(page, dpi):
    import numpy as np

    pixmap = page.get_pixmap(dpi=dpi)
    image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
        pixmap.height, pixmap.width, pixmap.n
    )
    if pixmap.n == 4:
        image = image[:, :, :3]

    result, _ = _ocr_engine()(image)
    if not result:
        return []

    scale = 72.0 / dpi
    boxes = []
    for box, text, score in result:
        text = normalize_unicode(text).strip()
        if not text or score < OCR_MIN_CONFIDENCE:
            continue
        xs = [point[0] * scale for point in box]
        ys = [point[1] * scale for point in box]
        boxes.append(
            {
                "text": text,
                "x0": min(xs),
                "y0": min(ys),
                "y1": max(ys),
                "height": max(ys) - min(ys),
            }
        )
    return sorted(boxes, key=lambda b: (b["y0"], b["x0"]))


def _ocr_page_lines(page, dpi=OCR_DPI):
    boxes = _ocr_boxes(page, dpi)
    if not boxes:
        return []

    lines = []
    for box in boxes:
        centre = (box["y0"] + box["y1"]) / 2
        if lines:
            last = lines[-1]
            last_centre = (last["y0"] + last["y1"]) / 2
            if abs(centre - last_centre) < max(last["height"], box["height"]) * 0.6:
                last["parts"].append(box)
                last["y0"] = min(last["y0"], box["y0"])
                last["y1"] = max(last["y1"], box["y1"])
                last["height"] = max(last["height"], box["height"])
                continue
        lines.append({"parts": [box], "y0": box["y0"], "y1": box["y1"], "height": box["height"]})

    merged = []
    for line in lines:
        parts = sorted(line["parts"], key=lambda b: b["x0"])
        merged.append(
            {
                "text": " ".join(part["text"] for part in parts),
                "size": round(line["height"] * OCR_SIZE_RATIO, 1),
                "bold": False,
                "x0": parts[0]["x0"],
                "y0": line["y0"],
                "y1": line["y1"],
            }
        )

    gaps = [
        merged[index]["y0"] - merged[index - 1]["y1"] for index in range(1, len(merged))
    ]
    typical_gap = sorted(gaps)[len(gaps) // 2] if gaps else 0

    blocks = [[merged[0]]]
    for previous, line in zip(merged, merged[1:]):
        if line["y0"] - previous["y1"] > max(typical_gap * 2, 4):
            blocks.append([line])
        else:
            blocks[-1].append(line)

    return blocks


def _split_runon_caps(page_entries):
    vocabulary = set()
    for entry in page_entries:
        for block_lines in entry["blocks"]:
            for line in block_lines:
                for word in re.findall(r"[A-Za-z]{2,}", line["text"]):
                    if not word.isupper():
                        vocabulary.add(word.lower())
    vocabulary.update(RUNON_CONNECTIVES)

    def split(token):
        lowered = token.lower()
        pieces = []
        position = 0
        while position < len(lowered):
            for end in range(len(lowered), position, -1):
                candidate = lowered[position:end]
                if len(candidate) >= 2 and candidate in vocabulary:
                    pieces.append(token[position:end])
                    position = end
                    break
            else:
                return None

        if len(pieces) < 2:
            return None

        # Only accept a split made of real words; anything shorter than four
        # letters has to be a connective, otherwise this is guesswork.
        for piece in pieces:
            if len(piece) < 4 and piece.lower() not in RUNON_CONNECTIVES:
                return None

        return " ".join(pieces)

    for entry in page_entries:
        if not entry["ocr"]:
            continue
        for block_lines in entry["blocks"]:
            for line in block_lines:
                replaced = []
                for token in line["text"].split():
                    if len(token) >= RUNON_MIN_LENGTH and token.isupper() and token.isalpha():
                        replaced.append(split(token) or token)
                    else:
                        replaced.append(token)
                line["text"] = " ".join(replaced)


def _collect_pages(pdf, start_index, end_index, ocr, ocr_dpi, verbose):
    entries = []

    for page_number in range(start_index, end_index):
        page = pdf[page_number]
        blocks = _page_lines(page)
        used_ocr = False

        if ocr == "always" or (ocr == "auto" and page_needs_ocr(page)):
            if verbose:
                print(f"  OCR page {page_number + 1}...")
            ocr_blocks = _ocr_page_lines(page, ocr_dpi)
            if ocr_blocks:
                blocks = ocr_blocks
                used_ocr = True

        entries.append(
            {
                "page": page_number + 1,
                "height": page.rect.height,
                "blocks": blocks,
                "ocr": used_ocr,
            }
        )

    if any(entry["ocr"] for entry in entries):
        _split_runon_caps(entries)

    return entries


def _profile_document(page_entries):
    size_weights = Counter()
    margin_texts = Counter()
    page_count = len(page_entries)

    for entry in page_entries:
        height = entry["height"]
        for block_lines in entry["blocks"]:
            for line in block_lines:
                text = clean_block_text(line["text"])
                if not text:
                    continue
                size_weights[line["size"]] += len(text)
                if line["y0"] < height * MARGIN_RATIO or line["y1"] > height * (1 - MARGIN_RATIO):
                    if not page_number_value(text):
                        margin_texts[text.lower()] += 1

    body_size = size_weights.most_common(1)[0][0] if size_weights else 10.0
    heading_sizes = sorted({size for size in size_weights if size > body_size * 1.05}, reverse=True)

    threshold = max(3, int(page_count * 0.3))
    repeated = {text for text, count in margin_texts.items() if count >= threshold}

    return body_size, heading_sizes, repeated


def _size_rank(size, body_size, heading_sizes):
    if size <= body_size * 1.05:
        return None
    for index, heading_size in enumerate(heading_sizes[:4]):
        if abs(size - heading_size) < 0.3:
            return index + 1
    return 3


def _classify(text, line, body_size, heading_sizes):
    if CAPTION_PATTERN.match(text):
        return "caption", None
    if starts_list_item(text):
        return "list_item", None
    rank = _size_rank(line["size"], body_size, heading_sizes)
    if rank is not None and looks_like_heading_text(text, max_words=24):
        return "heading", heading_level(text, rank)
    if line["bold"] and looks_like_heading_text(text):
        return "heading", heading_level(text, 3)
    if NUMBERED_HEADING.match(text) and looks_like_heading_text(text, max_words=12):
        return "heading", heading_level(text, 3)
    return "paragraph", None


def _extract_page(entry, body_size, heading_sizes, repeated):
    height = entry["height"]
    page_number = entry["page"]
    elements = []
    page_label = None
    toc_hits = 0
    current = None
    pending_number = None

    def flush():
        nonlocal current
        if current is None:
            return
        text = join_lines(current["lines"])
        if text and not is_noise(text):
            elements.append(
                {
                    "type": current["type"],
                    "text": text,
                    "level": current["level"],
                    "page": page_number,
                }
            )
        current = None

    for block_lines in entry["blocks"]:
        for line in block_lines:
            text = clean_block_text(line["text"])
            if not text:
                continue

            if SECTION_NUMBER_ONLY.match(text):
                pending_number = text.rstrip(".")
                continue

            if pending_number:
                text = f"{pending_number}. {text}"
                pending_number = None

            in_margin = line["y0"] < height * MARGIN_RATIO or line["y1"] > height * (1 - MARGIN_RATIO)

            label = page_number_value(text)
            if label and (in_margin or not elements):
                page_label = page_label or label
                continue

            if text.lower() in repeated:
                continue

            if is_toc_line(text):
                toc_hits += 1
                continue

            kind, level = _classify(text, line, body_size, heading_sizes)

            if kind == "heading":
                adjacent = (
                    current is not None
                    and current["type"] == "heading"
                    and current["level"] == level
                    and line["y0"] - current["last_y1"] < line["size"] * 0.9
                )
                if adjacent:
                    current["lines"].append(text)
                    current["last_y1"] = line["y1"]
                    continue
                flush()
                current = {
                    "type": "heading",
                    "level": level,
                    "lines": [text],
                    "last_y1": line["y1"],
                    "size": line["size"],
                }
                continue

            if kind == "caption":
                flush()
                current = {"type": "caption", "level": None, "lines": [text]}
                flush()
                continue

            if kind == "list_item":
                flush()
                current = {"type": "list_item", "level": None, "lines": [text]}
                continue

            if current is not None and current["type"] in ("paragraph", "list_item"):
                current["lines"].append(text)
                continue

            flush()
            current = {"type": "paragraph", "level": None, "lines": [text]}

        if current is not None and current["type"] == "paragraph":
            if not OPEN_END.search(join_lines(current["lines"])):
                flush()

    flush()
    return elements, page_label, toc_hits


def _is_toc_page(elements, toc_hits):
    if toc_hits >= 4:
        return True
    if not elements:
        return False
    head = " ".join(element["text"].lower() for element in elements[:2]).strip()
    return toc_hits >= 2 and ("table of contents" in head or head.startswith("contents"))


def extract_document(
    pdf_path, start_page=None, end_page=None, ocr="auto", ocr_dpi=OCR_DPI, verbose=True
):
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    pdf = fitz.open(pdf_path)
    try:
        total_pages = len(pdf)
        start_index = (start_page - 1) if start_page else 0
        end_index = end_page if end_page else total_pages

        if start_index < 0:
            raise ValueError("Start page must be 1 or greater.")
        if end_index > total_pages:
            raise ValueError(f"End page cannot exceed the PDF's {total_pages} pages.")
        if start_index >= end_index:
            raise ValueError("Start page must be less than or equal to end page.")

        if verbose:
            print(f"PDF: {pdf_path.name}")
            print(f"Pages {start_index + 1}-{end_index} of {total_pages}")

        page_entries = _collect_pages(pdf, start_index, end_index, ocr, ocr_dpi, verbose)
        ocr_pages = [entry["page"] for entry in page_entries if entry["ocr"]]

        body_size, heading_sizes, repeated = _profile_document(page_entries)

        if verbose:
            print(f"Body font size: {body_size} | heading sizes: {heading_sizes[:4]}")
            print(f"Repeated header/footer lines: {len(repeated)}")
            if ocr_pages:
                print(f"OCR applied to {len(ocr_pages)} page(s): {ocr_pages}")

        pages = []
        skipped = []
        previous_tail = None

        for entry in page_entries:
            elements, page_label, toc_hits = _extract_page(
                entry, body_size, heading_sizes, repeated
            )

            if not elements:
                skipped.append((entry["page"], "no usable text"))
                continue

            if _is_toc_page(elements, toc_hits):
                skipped.append((entry["page"], "table of contents"))
                continue

            first = elements[0]
            first["continues_previous_page"] = bool(
                previous_tail
                and previous_tail["type"] == "paragraph"
                and first["type"] == "paragraph"
                and OPEN_END.search(previous_tail["text"])
                and LOWER_START.match(first["text"])
            )

            pages.append(
                {
                    "page": entry["page"],
                    "page_label": page_label,
                    "blocks": elements,
                    "ocr": entry["ocr"],
                }
            )
            previous_tail = elements[-1]

        metadata = pdf.metadata or {}
        title = (metadata.get("title") or "").strip() or pdf_path.stem.replace("_", " ").title()

        document = {
            "source": pdf_path.name,
            "path": str(pdf_path),
            "title": title,
            "total_pages": total_pages,
            "page_range": [start_index + 1, end_index],
            "ocr_pages": ocr_pages,
            "pages": pages,
        }

        if verbose:
            block_count = sum(len(page["blocks"]) for page in pages)
            headings = sum(
                1 for page in pages for block in page["blocks"] if block["type"] == "heading"
            )
            print(f"Pages retained: {len(pages)} | blocks: {block_count} | headings: {headings}")
            for page_number, reason in skipped:
                print(f"  skipped page {page_number}: {reason}")

        return document
    finally:
        pdf.close()


def main():
    parser = argparse.ArgumentParser(description="Extract structured blocks from a PDF")
    parser.add_argument("pdf_path", type=Path)
    parser.add_argument("--start-page", type=int, default=None)
    parser.add_argument("--end-page", type=int, default=None)
    parser.add_argument("--ocr", choices=("auto", "always", "never"), default="auto")
    parser.add_argument("--ocr-dpi", type=int, default=OCR_DPI)
    parser.add_argument(
        "--output", type=Path, default=Path("data/results/extracted.json")
    )
    args = parser.parse_args()

    document = extract_document(
        args.pdf_path, args.start_page, args.end_page, ocr=args.ocr, ocr_dpi=args.ocr_dpi
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(document, handle, ensure_ascii=False, indent=2)

    print(f"Saved to {args.output}")


if __name__ == "__main__":
    main()
