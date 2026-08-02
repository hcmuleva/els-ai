"""Question ownership and subject/topic metadata validation."""
from __future__ import annotations

import re
from typing import Any

from .common import ConceptMatch, normalize_token, question_meta, result, unwrap_question

_SUBJECT_ALIASES = {
    "math": "Mathematics",
    "mathematics": "Mathematics",
    "physics": "Physics",
    "chemistry": "Chemistry",
}
_BROAD_TOPICS = {
    "physics",
    "mathematics",
    "math",
    "chemistry",
    "science",
    "all topics",
}


def canonical_subject(value: Any) -> str:
    token = normalize_token(value)
    return _SUBJECT_ALIASES.get(token, str(value or "").strip())


def validate_metadata(
    question: dict[str, Any],
    concept: ConceptMatch,
    *,
    quiz_subject: str | None = None,
) -> Any:
    raw = unwrap_question(question)
    meta = question_meta(question)
    question_subject = canonical_subject(raw.get("subject"))
    meta_subject = canonical_subject(meta.get("subject"))
    quiz_value = canonical_subject(quiz_subject) if quiz_subject else ""
    expected = canonical_subject(concept.subject)
    issues: list[str] = []
    warnings: list[str] = []
    critical: list[str] = []

    if not question_subject:
        issues.append("question.subject is missing")
    if not meta_subject:
        issues.append("question_data._meta.subject is missing")
    if question_subject and meta_subject and question_subject != meta_subject:
        issues.append(
            f"Question subject {question_subject!r} does not match metadata subject "
            f"{meta_subject!r}."
        )
        critical.append("subject_mismatch")
    for label, subject in (
        ("quiz", quiz_value),
        ("question", question_subject),
        ("metadata", meta_subject),
    ):
        if subject and expected not in {"", "Unknown"} and subject != expected:
            issues.append(
                f"{label.capitalize()} subject {subject!r} conflicts with detected "
                f"{expected} concept {concept.concept!r}."
            )
            critical.append("subject_mismatch")

    class_level = str(raw.get("class_level") or meta.get("classLevel") or "").strip()
    if not class_level:
        warnings.append("class level is missing")
    elif not re.fullmatch(
        r"(?i)(?:class|grade)?\s*(?:[1-9]|1[0-2])(?:th)?", class_level
    ):
        issues.append(f"invalid class level: {class_level!r}")

    topic = str(meta.get("topic") or "").strip()
    if not topic:
        issues.append("topic metadata is missing")
    elif normalize_token(topic) in _BROAD_TOPICS and concept.concept != "unknown":
        warnings.append(
            f"topic {topic!r} is overly broad for detected concept {concept.concept!r}"
        )

    return result(
        issues=issues,
        warnings=warnings,
        critical_failures=critical,
        quiz_subject=quiz_value or None,
        question_subject=question_subject or None,
        metadata_subject=meta_subject or None,
        expected_subject=expected,
        class_level=class_level or None,
        topic=topic or None,
    )
