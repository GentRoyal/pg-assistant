import re
from bisect import bisect_right

# A detected grid only counts as a table when most cells hold short text. Page
# frames and boxed layouts also form grids, but they are mostly empty cells or
# a whole paragraph in one cell.
TABLE_MIN_FILL = 0.6
TABLE_MIN_CELL_CHARS = 3
TABLE_MAX_CELL_CHARS = 200
TABLE_HEADER_MAX_CHARS = 40

# Ruling lines in a scanned page, relative to the page image size.
GRID_MIN_WIDTH = 0.3
GRID_MIN_HEIGHT = 0.03
GRID_LINE_COVERAGE = 0.5
GRID_MIN_LINES = 3

WHITESPACE = re.compile(r"\s+")


def _clean_cell(text):
    return WHITESPACE.sub(" ", (text or "").replace("|", "/")).strip()


def _looks_like_header(row):
    filled = [cell for cell in row if cell]
    return (
        len(filled) >= 2
        and not any(re.search(r"\d", cell) for cell in filled)
        and all(len(cell) <= TABLE_HEADER_MAX_CHARS for cell in filled)
    )


def table_line(rows, bbox):
    """
    A pseudo line holding a whole table, positioned at the table's box so it
    sorts into reading order with the page's real lines. None if the grid does
    not look like a table.
    """
    rows = [[_clean_cell(cell) for cell in row] for row in rows]
    rows = [row for row in rows if any(row)]
    if len(rows) < 2 or max(len(row) for row in rows) < 2:
        return None

    cells = [cell for row in rows for cell in row]
    filled = [cell for cell in cells if cell]
    average = sum(len(cell) for cell in filled) / len(filled)
    if len(filled) / len(cells) < TABLE_MIN_FILL:
        return None
    if not TABLE_MIN_CELL_CHARS <= average <= TABLE_MAX_CELL_CHARS:
        return None

    x0, y0, x1, y1 = bbox
    return {
        "text": "",
        "table": rows,
        "header": _looks_like_header(rows[0]),
        "size": 0,
        "bold": False,
        "x0": x0,
        "x1": x1,
        "y0": y0,
        "y1": y1,
        "height": y1 - y0,
    }


def render_table(rows, header):
    """One line per row, cells separated by pipes; a header row gets a rule under it."""
    width = max(len(row) for row in rows)
    lines = ["| " + " | ".join(row + [""] * (width - len(row))) + " |" for row in rows]
    if header:
        lines.insert(1, "|" + " --- |" * width)
    return "\n".join(lines)


def inside(item, line):
    """True when the centre of a line or OCR box falls within a table."""
    centre_x = (item["x0"] + item.get("x1", item["x0"])) / 2
    centre_y = (item["y0"] + item["y1"]) / 2
    return line["x0"] <= centre_x <= line["x1"] and line["y0"] <= centre_y <= line["y1"]


# ------------------------------------------------------------ text layer


def text_tables(page):
    """Ruled tables on a page with a text layer, via PyMuPDF's table finder."""
    try:
        found = page.find_tables().tables
    except Exception:
        return []

    lines = []
    for table in found:
        if table.row_count < 2 or table.col_count < 2:
            continue
        line = table_line(table.extract(), table.bbox)
        if line:
            lines.append(line)
    return lines


# ---------------------------------------------------------- scanned pages


def _line_positions(profile, threshold):
    """Centres of the runs where a projection profile reaches threshold."""
    import numpy as np

    hits = np.where(profile >= threshold)[0]
    if hits.size == 0:
        return []
    positions = []
    start = hits[0]
    for previous, current in zip(hits, hits[1:]):
        if current - previous > 3:
            positions.append(float(start + previous) / 2)
            start = current
    positions.append(float(start + hits[-1]) / 2)
    return positions


def image_grids(image):
    """
    Ruled tables in a page image, as cell boundaries in pixels. Long horizontal
    and vertical strokes are isolated with morphological opening; each cluster
    of them is a candidate table, and rows and columns are where a stroke spans
    most of the cluster.
    """
    import cv2
    import numpy as np

    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    ink = cv2.adaptiveThreshold(
        255 - gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 15, -2
    )
    height, width = ink.shape

    horizontal = cv2.morphologyEx(
        ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (width // 25, 1))
    )
    vertical = cv2.morphologyEx(
        ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, height // 60))
    )

    strokes = cv2.dilate(horizontal | vertical, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(strokes, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    grids = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w < width * GRID_MIN_WIDTH or h < height * GRID_MIN_HEIGHT:
            continue
        rows = _line_positions(
            horizontal[y : y + h, x : x + w].sum(axis=1) / 255, w * GRID_LINE_COVERAGE
        )
        cols = _line_positions(
            vertical[y : y + h, x : x + w].sum(axis=0) / 255, h * GRID_LINE_COVERAGE
        )
        if len(rows) < GRID_MIN_LINES or len(cols) < GRID_MIN_LINES:
            continue
        grids.append({"rows": [y + r for r in rows], "cols": [x + c for c in cols]})
    return grids


def _cell_text(boxes):
    """Join a cell's OCR boxes line by line; boxes on one line differ slightly in y."""
    lines = []
    for box in sorted(boxes, key=lambda b: b["y0"]):
        centre = (box["y0"] + box["y1"]) / 2
        if lines:
            last = lines[-1]
            if abs(centre - last["centre"]) < max(last["height"], box["height"]) * 0.6:
                last["boxes"].append(box)
                continue
        lines.append({"boxes": [box], "centre": centre, "height": box["height"]})
    return " ".join(
        box["text"] for line in lines for box in sorted(line["boxes"], key=lambda b: b["x0"])
    )


def ocr_tables(grids, boxes, scale):
    """
    Place OCR boxes into the cells of each grid. Returns the table lines and the
    boxes that were not part of any table. Grid positions are in pixels; scale
    converts them to the points the boxes use.
    """
    tables = []
    remaining = list(boxes)

    for grid in grids:
        rows = [position * scale for position in grid["rows"]]
        cols = [position * scale for position in grid["cols"]]
        cells = [[[] for _ in range(len(cols) - 1)] for _ in range(len(rows) - 1)]

        outside = []
        for box in remaining:
            centre_x = (box["x0"] + box["x1"]) / 2
            centre_y = (box["y0"] + box["y1"]) / 2
            row = bisect_right(rows, centre_y) - 1
            col = bisect_right(cols, centre_x) - 1
            if 0 <= row < len(rows) - 1 and 0 <= col < len(cols) - 1:
                cells[row][col].append(box)
            else:
                outside.append(box)

        text_rows = [[_cell_text(cell) for cell in row] for row in cells]
        line = table_line(text_rows, (cols[0], rows[0], cols[-1], rows[-1]))
        if line:
            tables.append(line)
            remaining = outside

    return tables, remaining
