"""Concept-to-diagram family and relevance gates."""
from __future__ import annotations

from typing import Any

from .common import ConceptMatch, diagram_spec, result
from .rules import CONCEPT_RULES

_GENERIC_PHYSICS_KINDS = {
    "generic",
    "geometry",
    "angle",
    "mensuration",
    "triangle",
    "right-triangle",
    "circle",
    "coordinate",
}


def validate_diagram_type(
    question: dict[str, Any],
    concept: ConceptMatch,
    *,
    required: bool = False,
) -> Any:
    spec = diagram_spec(question)
    kind = str((spec or {}).get("kind") or "").strip().casefold()
    issues: list[str] = []
    warnings: list[str] = []
    critical: list[str] = []
    rule = CONCEPT_RULES.get(concept.concept)

    if required and not spec:
        issues.append("diagram-only question has no valid controlled diagram")
        critical.append("diagram_irrelevant")
    if not spec:
        return result(
            issues=issues,
            critical_failures=critical,
            diagram_kind=None,
            allowed_kinds=sorted(rule.get("allowed_kinds", [])) if rule else [],
        )

    if concept.subject == "Physics" and kind in _GENERIC_PHYSICS_KINDS:
        issues.append(
            f"generic diagram kind {kind!r} is not meaningful for detected Physics "
            f"concept {concept.concept!r}"
        )
        critical.append("diagram_irrelevant")
    if rule:
        allowed = set(rule.get("allowed_kinds", set()))
        forbidden = set(rule.get("forbidden_kinds", set()))
        if kind in forbidden:
            issues.append(
                f"diagram kind {kind!r} is forbidden for concept {concept.concept!r}"
            )
            critical.append("diagram_irrelevant")
        elif allowed and kind not in allowed:
            issues.append(
                f"diagram kind {kind!r} is not allowed for concept "
                f"{concept.concept!r}; expected one of {sorted(allowed)}"
            )
            critical.append("diagram_irrelevant")
    elif kind in {"generic", ""}:
        warnings.append("diagram has no concept-specific kind")

    return result(
        issues=issues,
        warnings=warnings,
        critical_failures=critical,
        diagram_kind=kind or None,
        allowed_kinds=sorted(rule.get("allowed_kinds", [])) if rule else [],
    )
