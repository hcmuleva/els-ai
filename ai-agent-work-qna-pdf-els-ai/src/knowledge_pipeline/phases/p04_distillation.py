"""Phase 4 - Knowledge Distillation.

Convert each chapter (clean pages only) into normalized knowledge units:
{topic, subtopic, concept, definition, examples, frameworks, processes,
 formulae, case_studies, facts}.
"""
from __future__ import annotations

import re
from collections import defaultdict

from ..extractors.base import KnowledgeExtractor
from ..ingestion import RawBook
from ..models import DistilledUnit, PageContent
from ..utils import stable_id

_MAX_PAGES_PER_BATCH = 6
_SECTION_RE = re.compile(r"\b([1-9]\.[1-9])\.\s*([A-Z][^\n]{3,100})")
_NON_HEADING_STARTS = ("from ", "prove ", "since ", "solving", "thus ")


def run(
    books: list[RawBook],
    clean_pages: list[PageContent],
    extractor: KnowledgeExtractor,
) -> list[DistilledUnit]:
    # book_id -> chapter_index -> list[(page_number, text)]
    by_chapter: dict[str, dict[int, list[tuple[int, str]]]] = defaultdict(lambda: defaultdict(list))
    for p in clean_pages:
        ch = p.chapter_index if p.chapter_index is not None else 1
        by_chapter[p.book_id][ch].append((p.page_number, p.text))

    books_by_id = {b.book_id: b for b in books}
    units: list[DistilledUnit] = []

    for book_id, chapters in by_chapter.items():
        book = books_by_id.get(book_id)
        chapter_titles = {c.index: c.title for c in (book.chapters if book else [])}
        exercise_book = bool(
            book
            and "problem" in f"{book.filename} {book.title}".lower()
        )
        for chapter_index, page_items in chapters.items():
            page_items.sort()
            chapter = next(
                (
                    candidate
                    for candidate in (book.chapters if book else [])
                    if candidate.index == chapter_index
                ),
                None,
            )
            if chapter:
                page_items = [
                    item
                    for item in page_items
                    if chapter.page_start <= item[0] <= chapter.page_end
                ]
            if not page_items:
                continue
            title = chapter_titles.get(chapter_index, f"Chapter {chapter_index}")
            batches = (
                _exercise_batches(
                    page_items,
                    title,
                    _MAX_PAGES_PER_BATCH,
                    {
                        page_number: book.pages[page_number]
                        for page_number, _ in page_items
                        if page_number < len(book.pages)
                    },
                )
                if exercise_book
                else [(title, batch) for batch in _batches(page_items, _MAX_PAGES_PER_BATCH)]
            )
            for batch_index, (section_title, batch) in enumerate(batches, start=1):
                source_pages = [pn for pn, _ in batch]
                text = "\n".join(t for _, t in batch)
                batch_title = (
                    f"{section_title} practice pages "
                    f"{source_pages[0] + 1}-{source_pages[-1] + 1}"
                    if exercise_book or len(page_items) > _MAX_PAGES_PER_BATCH
                    else title
                )
                raw_units = extractor.distill_units(
                    book_id, chapter_index, batch_title, text
                )
                for u in raw_units:
                    if not u.get("concept"):
                        continue
                    concept_name = u["concept"]
                    unit_id = stable_id(
                        "unit", book_id, chapter_index, batch_index, concept_name
                    )
                    units.append(
                        DistilledUnit(
                            unit_id=unit_id,
                            book_id=book_id,
                            chapter_index=chapter_index,
                            topic=u.get("topic", batch_title),
                            subtopic=u.get("subtopic", concept_name),
                            concept=concept_name,
                            definition=u.get("definition", ""),
                            examples=u.get("examples", []),
                            frameworks=u.get("frameworks", []),
                            processes=u.get("processes", []),
                            formulae=u.get("formulae", []),
                            case_studies=u.get("case_studies", []),
                            facts=u.get("facts", []),
                            source_pages=source_pages,
                        )
                    )

    return _dedupe_units(units)


def _batches(items: list[tuple[int, str]], size: int) -> list[list[tuple[int, str]]]:
    return [items[start : start + size] for start in range(0, len(items), size)]


def _exercise_batches(
    items: list[tuple[int, str]],
    chapter_title: str,
    size: int,
    raw_pages: dict[int, str] | None = None,
) -> list[tuple[str, list[tuple[int, str]]]]:
    batches: list[tuple[str, list[tuple[int, str]]]] = []
    current_title = chapter_title
    current: list[tuple[int, str]] = []
    chapter_match = re.search(r"\bchapter\s*([1-9])\b", chapter_title, re.IGNORECASE)
    chapter_number = chapter_match.group(1) if chapter_match else ""
    for item in items:
        detection_text = (raw_pages or {}).get(item[0], item[1])
        detected = _section_title(detection_text, chapter_number)
        if detected and detected != current_title and current:
            batches.append((current_title, current))
            current = []
        if detected:
            current_title = detected
        if len(current) >= size:
            batches.append((current_title, current))
            current = []
        current.append(item)
    if current:
        batches.append((current_title, current))
    return batches


def _section_title(text: str, chapter_number: str = "") -> str:
    for match in _SECTION_RE.finditer(text):
        number = match.group(1)
        title = match.group(2).strip(" .:-")
        if chapter_number and not number.startswith(f"{chapter_number}."):
            continue
        if title.lower().startswith(_NON_HEADING_STARTS):
            continue
        return f"{number} {title}"
    return ""


def _dedupe_units(units: list[DistilledUnit]) -> list[DistilledUnit]:
    """Merge units that resolve to the same concept within the same book."""
    merged: dict[tuple[str, str], DistilledUnit] = {}
    for u in units:
        key = (u.book_id, u.concept.strip().lower())
        if key not in merged:
            merged[key] = u
            continue
        existing = merged[key]
        if len(u.definition) > len(existing.definition):
            existing.definition = u.definition
        for field_name in ("examples", "frameworks", "processes", "formulae", "case_studies", "facts"):
            combined = getattr(existing, field_name) + getattr(u, field_name)
            seen: set[str] = set()
            deduped = []
            for item in combined:
                k = item.strip().lower()
                if k and k not in seen:
                    seen.add(k)
                    deduped.append(item)
            setattr(existing, field_name, deduped[:6])
        existing.source_pages = sorted(set(existing.source_pages) | set(u.source_pages))
    return list(merged.values())
