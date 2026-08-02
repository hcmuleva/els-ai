"""Shared normalization for persisted question-player records."""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Iterable


def question_stem_key(stem: Any) -> str:
    """Build a stable key for exact question text duplicates."""
    normalized = unicodedata.normalize("NFKC", str(stem or "")).casefold()
    return re.sub(r"[^a-z0-9]+", "", normalized)


def deduplicate_questions(
    questions: Iterable[dict[str, Any]], limit: int
) -> list[dict[str, Any]]:
    """Keep the newest occurrence of each question while preserving query order."""
    unique: list[dict[str, Any]] = []
    seen: set[str] = set()
    for question in questions:
        key = question_stem_key(question.get("stem"))
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(question)
        if len(unique) >= limit:
            break
    return unique
