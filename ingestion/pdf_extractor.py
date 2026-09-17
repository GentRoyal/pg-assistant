import re
from pathlib import Path
import fitz

# Dynamic path for macOS
pdf_path = Path.home() / "Downloads" / "MANUAL_OF_STYLE.pdf"

if not pdf_path.exists():
    print(f"Error: File not found at {pdf_path}")
    exit()

pdf = fitz.open(pdf_path)


# ============================================================
# 1. TEXT CLEANING & TOC FILTERING
# ============================================================

def is_toc_page(page_text: str) -> bool:
    """Detects if a page belongs to the Table of Contents."""
    text_lower = page_text.lower()
    
    # Check for TOC headings
    if "table of contents" in text_lower or "contents" in text_lower[:100]:
        return True
        
    # Check for high density of dot leaders or page number patterns (e.g., "... 12")
    dot_leader_count = len(re.findall(r"\.{3,}\s*\d+", page_text))
    if dot_leader_count > 3:  # If more than 3 TOC-style lines exist, it's a TOC page
        return True
        
    return False

cleaned_pages = []

# Process all pages (or set a limit if desired)
for page_number, page in enumerate(pdf):
    raw_text = page.get_text()

    # Skip Table of Contents pages entirely
    if is_toc_page(raw_text):
        print(f"Skipping Page {page_number + 1} (Detected as Table of Contents)")
        continue

    rect = page.rect
    height = rect.height

    # Spatial boundaries for Headers and Footers (Adjust percentages as needed)
    top_margin = height * 0.08      # Top 8%
    bottom_margin = height * 0.92   # Bottom 8%

    blocks = page.get_text("blocks")
    page_blocks = []

    for b in blocks:
        # b[6] == 0 means text block
        if b[6] == 0:
            block_y0, block_y1, block_text = b[1], b[3], b[4].strip()

            # Ignore top/bottom header & footer zones
            if block_y0 < top_margin or block_y1 > bottom_margin:
                continue

            # Filter standalone page numbers
            if re.match(r"^(page\s+)?\d+(\s+of\s+\d+)?$", block_text, re.IGNORECASE):
                continue

            # Clean extra internal white spaces and line breaks
            clean_block = re.sub(r"\s+", " ", block_text)
            page_blocks.append(clean_block)

    if page_blocks:
        page_content = "\n\n".join(page_blocks)
        cleaned_pages.append({
            "page": page_number + 1,
            "text": page_content
        })

pdf.close()

# Combine all valid cleaned text into a single document string
full_cleaned_text = "\n\n".join([p["text"] for p in cleaned_pages])


# ============================================================
# 2. RAG CHUNKING (Sliding Window with Overlap)
# ============================================================

def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 100) -> list[str]:
    """
    Splits cleaned text into overlapping chunks by word count 
    to preserve context for vector embeddings.
    """
    words = text.split()
    chunks = []
    
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += (chunk_size - chunk_overlap)
        
    return chunks

# Execute Chunking
chunks = chunk_text(full_cleaned_text, chunk_size=300, chunk_overlap=50)

print(f"\n--- EXTRACTION COMPLETE ---")
print(f"Total Cleaned Pages Processed: {len(cleaned_pages)}")
print(f"Total RAG Chunks Generated: {len(chunks)}\n")

# Preview first 2 chunks
for i, chunk in enumerate(chunks[:2]):
    print(f"=== CHUNK {i + 1} ===")
    print(chunk)
    print("\n")