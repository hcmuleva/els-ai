"""Input Normalizer: turn a raw spec request dict into a canonical QFRequest.

Accepts the spec's camelCase keys (``class``, ``questionTypes``,
``includeSolutions`` ...) as well as snake_case, and fills the spec's documented
defaults when fields are missing.
"""
from __future__ import annotations

from typing import Any, Dict, List

from qfactory.types import (
    LEVEL_ALIASES,
    QTYPE_ALIASES,
    SUBJECT_ALIASES,
    Level,
    QFRequest,
    QType,
)

# Only these types are supported by this POC (verifiable + answer-keyable).
SUPPORTED_TYPES = {QType.SCQ, QType.MCQ, QType.TF, QType.NUMERICAL, QType.ASSERTION_REASON}


def _first(raw: Dict[str, Any], *keys: str, default: Any = None) -> Any:
    for k in keys:
        if k in raw and raw[k] not in (None, ""):
            return raw[k]
    return default


def _norm_types(value: Any) -> List[QType]:
    if not value:
        return []
    if isinstance(value, str):
        value = [value]
    out: List[QType] = []
    for raw in value:
        qt = QTYPE_ALIASES.get(str(raw).strip().lower())
        if qt and qt in SUPPORTED_TYPES and qt not in out:
            out.append(qt)
    return out


def normalize_request(raw: Dict[str, Any]) -> QFRequest:
    raw = dict(raw or {})

    class_level = str(_first(raw, "class", "class_level", "classLevel", default="12")).strip()
    if class_level not in ("10", "12"):
        class_level = "12"

    subject_in = str(_first(raw, "subject", default="physics")).strip().lower()
    subject = SUBJECT_ALIASES.get(subject_in, "physics")

    types = _norm_types(_first(raw, "questionTypes", "question_types", "types"))
    if not types:
        types = [QType.SCQ, QType.MCQ, QType.TF, QType.NUMERICAL]

    difficulty = LEVEL_ALIASES.get(
        str(_first(raw, "difficulty", default="Mixed")).strip().lower(), Level.MIXED
    )

    try:
        count = int(_first(raw, "count", "questionCount", "question_count", "numQuestions", default=10))
    except (TypeError, ValueError):
        count = 10
    count = max(1, min(count, 50))

    seed_raw = _first(raw, "seed")
    try:
        seed = int(seed_raw) if seed_raw is not None else None
    except (TypeError, ValueError):
        seed = None

    return QFRequest(
        class_level=class_level,
        subject=subject,
        chapter=(_first(raw, "chapter") or None),
        topic=(_first(raw, "topic") or None),
        question_types=types,
        difficulty=difficulty,
        count=count,
        include_solutions=bool(_first(raw, "includeSolutions", "include_solutions", default=True)),
        include_bloom=bool(_first(raw, "includeBloomLevel", "include_bloom", default=True)),
        include_marks=bool(_first(raw, "includeMarks", "include_marks", default=True)),
        output_format=str(_first(raw, "outputFormat", "output_format", default="JSON")).upper(),
        seed=seed,
    )
