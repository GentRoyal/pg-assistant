FILTER_FIELDS = ("sources", "document_type", "academic_level")


def build_filters(sources=None, document_type=None, academic_level=None):
    if isinstance(sources, str):
        sources = [sources]

    return {
        "filter_sources": list(sources) if sources else None,
        "filter_document_type": document_type or None,
        "filter_academic_level": academic_level or None,
    }


def describe(filters):
    active = {
        key.replace("filter_", ""): value for key, value in filters.items() if value is not None
    }
    if not active:
        return "no filters"
    return ", ".join(f"{key}={value}" for key, value in active.items())


def deduplicate_by_section(results):
    seen = set()
    unique = []
    for result in results:
        key = (result.get("document_id"), result.get("section_title"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(result)
    return unique
