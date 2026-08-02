"""Helpers for keeping source topic labels out of player-facing metadata."""
from __future__ import annotations

import re

_PRACTICE_PAGES_RE = re.compile(
    r"\s+practice\s+pages\s+\d+\s*-\s*\d+\s*$",
    re.IGNORECASE,
)
_EMBEDDED_TOPICS_RE = re.compile(
    r"^\s*(?P<subject>.+?),\s*across\s+all\s+embedded\s+topics\s*:",
    re.IGNORECASE | re.DOTALL,
)


def clean_topic_label(value: object, subject: str | None = None) -> str | None:
    """Return a concise topic label suitable for quiz-player display."""
    if value is None:
        return subject or None
    label = str(value).strip()
    if not label:
        return subject or None

    embedded_match = _EMBEDDED_TOPICS_RE.match(label)
    if embedded_match:
        return subject or embedded_match.group("subject").strip() or "All topics"

    label = _PRACTICE_PAGES_RE.sub("", label).strip(" ,")
    label = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", label)
    label = re.sub(r"\s+", " ", label)
    label = re.sub(r"\s*,\s*", ", ", label)
    return label.strip(" ,") or subject or None
