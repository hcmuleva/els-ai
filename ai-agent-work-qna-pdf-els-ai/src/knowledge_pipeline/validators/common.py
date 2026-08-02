"""Shared types and normalization helpers for STEM quiz validation."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Iterable

VALID_STATUSES = {"pass", "warning", "fail"}


@dataclass(frozen=True)
class ConceptMatch:
    concept: str
    subject: str
    required_diagram_family: str
    confidence: float
    evidence: tuple[str, ...] = ()

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class CheckResult:
    status: str = "pass"
    issues: list[str] = field(default_factory=list)
    critical_failures: list[str] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "status": self.status,
            "issues": sorted(set(self.issues)),
        }
        result.update(self.details)
        return result


def result(
    *,
    issues: Iterable[str] = (),
    warnings: Iterable[str] = (),
    critical_failures: Iterable[str] = (),
    **details: Any,
) -> CheckResult:
    issue_list = sorted(set(filter(None, issues)))
    warning_list = sorted(set(filter(None, warnings)))
    critical = sorted(set(filter(None, critical_failures)))
    if issue_list or critical:
        status = "fail"
    elif warning_list:
        status = "warning"
    else:
        status = "pass"
    return CheckResult(
        status=status,
        issues=issue_list + warning_list,
        critical_failures=critical,
        details=details,
    )


def unwrap_question(value: dict[str, Any]) -> dict[str, Any]:
    question = value.get("question", value)
    return question if isinstance(question, dict) else {}


def question_data(value: dict[str, Any]) -> dict[str, Any]:
    data = unwrap_question(value).get("question_data") or {}
    return data if isinstance(data, dict) else {}


def question_meta(value: dict[str, Any]) -> dict[str, Any]:
    meta = question_data(value).get("_meta") or {}
    return meta if isinstance(meta, dict) else {}


def question_text(value: dict[str, Any]) -> str:
    question = unwrap_question(value)
    return " ".join(
        str(part or "")
        for part in (
            question.get("question_title"),
            question.get("explanation"),
            question_meta(value).get("topic"),
        )
    ).strip()


def diagram_spec(value: dict[str, Any]) -> dict[str, Any] | None:
    raw = question_data(value).get("diagram")
    return raw if isinstance(raw, dict) else None


def options(value: dict[str, Any]) -> list[dict[str, Any]]:
    raw = question_data(value).get("options") or []
    return [item for item in raw if isinstance(item, dict)]


def normalize_token(value: Any) -> str:
    return " ".join(str(value or "").strip().casefold().split())
