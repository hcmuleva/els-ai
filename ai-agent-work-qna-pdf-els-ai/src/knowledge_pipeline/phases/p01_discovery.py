"""Phase 1 - Content Discovery -> Knowledge Inventory Report."""
from __future__ import annotations

import re
from collections import Counter
from itertools import combinations

from ..extractors.base import KnowledgeExtractor
from ..ingestion import RawBook
from ..models import (
    BookMeta,
    BookOverlap,
    ChapterNode,
    KnowledgeInventoryReport,
    TopicNode,
)
from ..utils import normalize_ws, words

_STOP = {
    "the", "and", "for", "that", "this", "with", "from", "which", "these", "those",
    "have", "has", "was", "were", "are", "will", "can", "may", "such", "when", "what",
    "into", "also", "been", "their", "there", "here", "very", "more", "most", "some",
    "chapter", "section", "figure", "table", "page", "example",
}
_SUBHEADING_RE = re.compile(r"^\s*(\d+\.\d+|\d+\.\d+\.\d+|[A-Z][A-Za-z ]{3,50})\s*$")


def run(books: list[RawBook], extractor: KnowledgeExtractor) -> KnowledgeInventoryReport:
    metas: list[BookMeta] = []
    topic_sets: dict[str, set[str]] = {}

    for book in books:
        cls = extractor.classify_book(book.title, book.sample_text())
        chapters: list[ChapterNode] = []
        book_topics: set[str] = set()

        for ch in book.chapters:
            text = book.chapter_text(ch)
            topics = _extract_topics(text, ch.title)
            chapters.append(
                ChapterNode(
                    index=ch.index,
                    title=ch.title,
                    page_start=ch.page_start,
                    page_end=ch.page_end,
                    topics=topics,
                )
            )
            for t in topics:
                book_topics.add(t.title.lower())
                book_topics.update(s.lower() for s in t.subtopics)

        metas.append(
            BookMeta(
                book_id=book.book_id,
                filename=book.filename,
                title=book.title,
                num_pages=book.num_pages,
                subject=cls["subject"],
                curriculum=cls["curriculum"],
                domain=cls["domain"],
                chapters=chapters,
            )
        )
        topic_sets[book.book_id] = book_topics

    overlaps = _overlaps(topic_sets)
    subject_index: dict[str, list[str]] = {}
    domain_index: dict[str, list[str]] = {}
    for m in metas:
        subject_index.setdefault(m.subject, []).append(m.book_id)
        domain_index.setdefault(m.domain, []).append(m.book_id)

    return KnowledgeInventoryReport(
        books=metas,
        overlaps=overlaps,
        subject_index=subject_index,
        domain_index=domain_index,
        total_chapters=sum(len(m.chapters) for m in metas),
        total_topics=sum(len(ch.topics) for m in metas for ch in m.chapters),
    )


def _extract_topics(text: str, chapter_title: str) -> list[TopicNode]:
    headings: list[str] = []
    for line in text.splitlines():
        clean = normalize_ws(line)
        if not clean or clean == normalize_ws(chapter_title):
            continue
        if _SUBHEADING_RE.match(line) and len(clean.split()) <= 8:
            headings.append(clean)
        if len(headings) >= 6:
            break

    keywords = _keywords(text, top=8)
    if headings:
        topics = [TopicNode(title=h, subtopics=[]) for h in headings[:6]]
        # attach keyword subtopics round-robin
        for i, kw in enumerate(keywords):
            topics[i % len(topics)].subtopics.append(kw)
        for t in topics:
            t.subtopics = t.subtopics[:4]
        return topics

    # Fallback: chapter is one topic, keywords are subtopics.
    if not keywords:
        return [TopicNode(title=normalize_ws(chapter_title) or "General", subtopics=[])]
    return [TopicNode(title=normalize_ws(chapter_title) or "General", subtopics=keywords[:6])]


def _keywords(text: str, top: int) -> list[str]:
    freq = Counter(
        w.lower() for w in words(text) if len(w) > 4 and w.lower() not in _STOP
    )
    return [w.title() for w, _ in freq.most_common(top)]


def _overlaps(topic_sets: dict[str, set[str]]) -> list[BookOverlap]:
    out: list[BookOverlap] = []
    for a, b in combinations(topic_sets, 2):
        sa, sb = topic_sets[a], topic_sets[b]
        if not sa or not sb:
            continue
        shared = sa & sb
        union = sa | sb
        jacc = len(shared) / len(union) if union else 0.0
        if shared:
            out.append(
                BookOverlap(
                    book_a=a,
                    book_b=b,
                    shared_topics=sorted(shared)[:20],
                    jaccard=jacc,
                )
            )
    return out
