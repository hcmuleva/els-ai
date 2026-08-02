"""Phase 0 document structure and Phase 0.5 integrity validation."""
from __future__ import annotations

import hashlib
import re

from ..ingestion import RawBook
from ..utils import normalize_ws

_FORMULA_RE = re.compile(
    r"(?:[A-Za-z][A-Za-z0-9]*\s*=\s*[^\n]{2,120}|"
    r"[A-Za-z0-9)][+\-*/²³^][A-Za-z0-9(])"
)
_QUESTION_RE = re.compile(r"^\s*(?:Q(?:uestion)?\s*)?(\d{1,4})[.)]\s+\S", re.IGNORECASE)
_FIGURE_RE = re.compile(r"\b(?:fig(?:ure)?|diagram)\s*[.:#-]?\s*(\d+(?:\.\d+)*)?", re.IGNORECASE)
_TABLE_RE = re.compile(r"\btable\s*[.:#-]?\s*(\d+(?:\.\d+)*)?", re.IGNORECASE)


def build_structure(books: list[RawBook]) -> dict:
    structured_books: list[dict] = []
    for book in books:
        chapter_by_page = _chapter_by_page(book)
        pages: list[dict] = []
        for page_number, raw_text in enumerate(book.pages):
            lines = [normalize_ws(line) for line in raw_text.splitlines() if normalize_ws(line)]
            chapter = chapter_by_page.get(page_number)
            pages.append(
                {
                    "page": page_number,
                    "extraction_method": (
                        book.page_extraction_methods[page_number]
                        if page_number < len(book.page_extraction_methods)
                        else "unknown"
                    ),
                    "extraction_confidence": (
                        book.page_confidences[page_number]
                        if page_number < len(book.page_confidences)
                        else 0.0
                    ),
                    "chapter": chapter.title if chapter else "",
                    "section": _heading(lines),
                    "subsection": "",
                    "content": lines,
                    "tables": [
                        {"reference": match.group(0), "content": []}
                        for match in _TABLE_RE.finditer(raw_text)
                    ],
                    "figures": [
                        {"reference": match.group(0), "caption": "", "description": ""}
                        for match in _FIGURE_RE.finditer(raw_text)
                    ],
                    "formulae": [normalize_ws(match.group(0)) for match in _FORMULA_RE.finditer(raw_text)],
                    "exercises": [
                        {"number": match.group(1), "text": normalize_ws(line)}
                        for line in lines
                        if (match := _QUESTION_RE.match(line))
                    ],
                }
            )
        structured_books.append(
            {
                "book_id": book.book_id,
                "filename": book.filename,
                "title": book.title,
                "source_path": book.source_path,
                "source_sha256": book.source_sha256,
                "chapters": [
                    {
                        "index": chapter.index,
                        "title": chapter.title,
                        "page_start": chapter.page_start,
                        "page_end": chapter.page_end,
                    }
                    for chapter in book.chapters
                ],
                "pages": pages,
            }
        )
    return {"books": structured_books}


def extraction_report(books: list[RawBook]) -> dict:
    records = []
    for book in books:
        methods = {
            method: book.page_extraction_methods.count(method)
            for method in sorted(set(book.page_extraction_methods))
        }
        confidences = [
            confidence
            for method, confidence in zip(book.page_extraction_methods, book.page_confidences)
            if method == "ocr"
        ]
        records.append(
            {
                "book_id": book.book_id,
                "filename": book.filename,
                "source_path": book.source_path,
                "source_sha256": book.source_sha256,
                "pages": book.num_pages,
                "methods": methods,
                "ocr_mean_confidence": (
                    round(sum(confidences) / len(confidences), 4) if confidences else None
                ),
            }
        )
    return {"books": records}


def validate(books: list[RawBook], structure: dict) -> dict:
    results: list[dict] = []
    structures = {book["book_id"]: book for book in structure["books"]}
    for book in books:
        total = max(1, len(book.pages))
        empty_pages = [i for i, text in enumerate(book.pages) if not normalize_ws(text)]
        corrupt_pages = [
            i for i, text in enumerate(book.pages) if normalize_ws(text) and _corruption_ratio(text) > 0.08
        ]
        duplicates = _duplicate_pages(book.pages)
        page_records = structures[book.book_id]["pages"]
        formulae = [formula for page in page_records for formula in page["formulae"]]
        broken_formulae = [formula for formula in formulae if not _balanced(formula)]
        figures = [figure for page in page_records for figure in page["figures"]]
        missing_captions = [figure["reference"] for figure in figures if not figure["caption"]]
        numbering_gaps = _numbering_gaps(page_records)
        issues: list[dict] = []
        _add_issue(issues, "empty_pages", empty_pages, "critical")
        _add_issue(issues, "ocr_corruption", corrupt_pages, "critical")
        _add_issue(issues, "duplicate_pages", duplicates, "warning")
        _add_issue(issues, "formula_corruption", broken_formulae, "warning")
        _add_issue(issues, "missing_figure_captions", missing_captions, "warning")
        _add_issue(issues, "broken_numbering", numbering_gaps, "warning")
        if not book.chapters:
            issues.append({"type": "missing_chapters", "severity": "critical", "count": 1, "items": []})

        score = 100.0
        score -= 60 * len(empty_pages) / total
        score -= 30 * len(corrupt_pages) / total
        score -= min(10, 20 * len(duplicates) / total)
        score -= min(5, len(broken_formulae) * 0.2)
        score -= min(5, len(numbering_gaps) * 0.1)
        score = round(max(0.0, score), 2)
        results.append(
            {
                "book_id": book.book_id,
                "filename": book.filename,
                "integrity_score": score,
                "passed": score >= 70 and len(empty_pages) / total <= 0.05,
                "issues": issues,
                "metrics": {
                    "pages": len(book.pages),
                    "empty_pages": len(empty_pages),
                    "corrupt_pages": len(corrupt_pages),
                    "duplicate_pages": len(duplicates),
                    "formulae_detected": len(formulae),
                    "figures_referenced": len(figures),
                    "numbering_gaps": len(numbering_gaps),
                },
                "limitations": [
                    "OCR text does not preserve equation typography perfectly.",
                    "Figure pixels are not embedded; references are retained for traceability.",
                    "Table cells are retained as reading-order text when layout recovery is unavailable.",
                ],
            }
        )
    average = round(sum(item["integrity_score"] for item in results) / len(results), 2) if results else 0
    return {
        "passed": bool(results) and all(item["passed"] for item in results),
        "integrity_score": average,
        "books": results,
    }


def _chapter_by_page(book: RawBook) -> dict[int, object]:
    return {
        page: chapter
        for chapter in book.chapters
        for page in range(chapter.page_start, chapter.page_end + 1)
    }


def _heading(lines: list[str]) -> str:
    for line in lines[:8]:
        if 3 <= len(line) <= 100 and (line.isupper() or re.match(r"^\d+(?:\.\d+)+\s+", line)):
            return line
    return ""


def _corruption_ratio(text: str) -> float:
    visible = [char for char in text if not char.isspace()]
    if not visible:
        return 1.0
    suspicious = sum(
        char == "\ufffd" or (not char.isalnum() and char not in ".,:;!?()[]{}+-=*/<>%°'\"²³√∑∫≤≥→")
        for char in visible
    )
    return suspicious / len(visible)


def _duplicate_pages(pages: list[str]) -> list[int]:
    seen: set[str] = set()
    duplicates: list[int] = []
    for page_number, text in enumerate(pages):
        clean = normalize_ws(text).lower()
        if not clean:
            continue
        fingerprint = hashlib.sha1(clean.encode("utf-8")).hexdigest()
        if fingerprint in seen:
            duplicates.append(page_number)
        seen.add(fingerprint)
    return duplicates


def _balanced(text: str) -> bool:
    return text.count("(") == text.count(")") and text.count("[") == text.count("]")


def _numbering_gaps(pages: list[dict]) -> list[dict]:
    numbers = [
        int(exercise["number"])
        for page in pages
        for exercise in page["exercises"]
        if exercise["number"].isdigit()
    ]
    gaps: list[dict] = []
    for previous, current in zip(numbers, numbers[1:]):
        if previous < current and current - previous > 1:
            gaps.append({"after": previous, "before": current})
    return gaps[:100]


def _add_issue(issues: list[dict], issue_type: str, items: list, severity: str) -> None:
    if items:
        issues.append(
            {"type": issue_type, "severity": severity, "count": len(items), "items": items[:100]}
        )
