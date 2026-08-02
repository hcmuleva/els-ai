"""Phase 2 - Content Quality Analysis and Phase 3 - Noise Removal.

Phase 2 assigns every page a value class + Content Value Score.
Phase 3 flags pages to drop (noise / duplicates), producing the clean corpus.
"""
from __future__ import annotations

import hashlib

from ..config import PipelineConfig
from ..extractors.base import KnowledgeExtractor
from ..ingestion import RawBook
from ..models import ContentValue, PageContent
from ..utils import clamp, normalize_ws

_CLASS_BASE = {"HIGH": 0.85, "MEDIUM": 0.55, "LOW": 0.1}
_CATEGORY_BONUS = 0.03


def score_pages(
    books: list[RawBook], extractor: KnowledgeExtractor, config: PipelineConfig
) -> list[PageContent]:
    """Phase 2: classify + score every page."""
    pages: list[PageContent] = []
    for book in books:
        chapter_for_page = _page_to_chapter(book)
        for page_no, text in enumerate(book.pages):
            if not normalize_ws(text):
                continue
            verdict = extractor.page_value(text)
            value_class = verdict.get("value_class", "MEDIUM")
            categories = verdict.get("categories", [])
            noise = verdict.get("noise_reasons", [])

            base = _CLASS_BASE.get(value_class, 0.5)
            score = clamp(base + _CATEGORY_BONUS * len(categories) - 0.1 * len(noise))

            pages.append(
                PageContent(
                    book_id=book.book_id,
                    page_number=page_no,
                    chapter_index=chapter_for_page.get(page_no),
                    text=normalize_ws(text),
                    value_class=ContentValue(value_class),
                    value_score=score,
                    categories=categories,
                    noise_reasons=noise,
                    kept=True,
                )
            )
    return pages


def remove_noise(pages: list[PageContent]) -> list[PageContent]:
    """Phase 3: mark duplicate / low-value / boilerplate pages as not kept."""
    seen_hashes: set[str] = set()
    for page in pages:
        fingerprint = _fingerprint(page.text)
        reasons = list(page.noise_reasons)

        if fingerprint in seen_hashes:
            reasons.append("duplicate_page")
        else:
            seen_hashes.add(fingerprint)

        # A page is dropped when it is duplicated, or classified LOW value
        # (phase 2 already flags noise-dominant boilerplate as LOW). A HIGH-value
        # page that merely mentions "references" is retained.
        drop = "duplicate_page" in reasons or page.value_class == ContentValue.LOW
        page.noise_reasons = reasons
        page.kept = not drop
    return pages


def clean_corpus(pages: list[PageContent]) -> list[PageContent]:
    return [p for p in pages if p.kept]


def _fingerprint(text: str) -> str:
    normalized = " ".join(sorted(normalize_ws(text).lower().split()))[:2000]
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()


def _page_to_chapter(book: RawBook) -> dict[int, int]:
    mapping: dict[int, int] = {}
    for ch in book.chapters:
        for p in range(ch.page_start, ch.page_end + 1):
            mapping[p] = ch.index
    return mapping
