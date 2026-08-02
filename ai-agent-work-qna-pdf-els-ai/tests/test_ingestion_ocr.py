from __future__ import annotations

import json
from pathlib import Path

from knowledge_pipeline.ingestion import (
    _detect_chapters,
    _load_ocr_cache,
    _source_signature,
    _usable_pdf_text,
    _write_ocr_cache,
)


def test_pdf_text_quality_rejects_empty_and_symbol_noise() -> None:
    assert not _usable_pdf_text("")
    assert not _usable_pdf_text("- = / " * 100)
    assert _usable_pdf_text(
        "Quadratic equations contain variables raised to the second power. "
        "Students can solve them by factorization or by applying the formula."
    )


def test_ocr_cache_is_bound_to_source_signature(tmp_path: Path) -> None:
    source = tmp_path / "scan.pdf"
    source.write_bytes(b"first")
    cache = tmp_path / "scan.json"
    pages = {"0": {"text": "Recognized page text", "confidence": 0.91}}

    _write_ocr_cache(cache, source, 1, pages)

    assert _load_ocr_cache(cache, source, 1) == pages
    payload = json.loads(cache.read_text(encoding="utf-8"))
    assert payload["source"] == _source_signature(source)

    source.write_bytes(b"changed source")
    assert _load_ocr_cache(cache, source, 1) == {}


def test_chapter_detection_accepts_ocr_text_without_spaces() -> None:
    pages = [
        "Preface",
        "Chapter1\nRATIONAL EQUATIONS",
        "Exercises",
        "Chapter2\nALGEBRA",
    ]

    chapters = _detect_chapters(pages, "Mathematics")

    assert [chapter.page_start for chapter in chapters] == [1, 3]
