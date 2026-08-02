"""Required visual-object validation for detected STEM concepts."""
from __future__ import annotations

import re
from typing import Any

from .common import ConceptMatch, diagram_spec, question_text, result
from .diagram_inspection import inspect_diagram
from .rules import CONCEPT_RULES


def _elements(question: dict[str, Any]) -> list[dict[str, Any]]:
    diagram = diagram_spec(question)
    if not diagram:
        return []
    return [
        element
        for element in diagram.get("elements", [])
        if isinstance(element, dict)
    ]


def _free_body_geometry_issues(question: dict[str, Any]) -> list[str]:
    elements = _elements(question)
    arrows = {
        str(element.get("label", "")).casefold(): element
        for element in elements
        if element.get("type") == "arrow"
    }
    issues: list[str] = []
    weight = next(
        (arrow for label, arrow in arrows.items() if label in {"mg", "w"}),
        None,
    )
    if weight:
        start, end = weight.get("start"), weight.get("end")
        if (
            not start
            or not end
            or abs(end[0] - start[0]) > 0.1
            or end[1] >= start[1]
        ):
            issues.append("weight vector must point vertically downward")
    normal = arrows.get("n")
    incline = next(
        (
            element
            for element in elements
            if element.get("type") == "segment"
            and element.get("a")
            and element.get("b")
            and element["b"][1] > element["a"][1]
        ),
        None,
    )
    if normal and incline:
        start, end = normal["start"], normal["end"]
        a, b = incline["a"], incline["b"]
        normal_vector = (end[0] - start[0], end[1] - start[1])
        slope_vector = (b[0] - a[0], b[1] - a[1])
        dot = (
            normal_vector[0] * slope_vector[0]
            + normal_vector[1] * slope_vector[1]
        )
        scale = max(
            1.0,
            abs(normal_vector[0]) + abs(normal_vector[1]),
            abs(slope_vector[0]) + abs(slope_vector[1]),
        )
        if abs(dot) > 0.05 * scale * scale:
            issues.append("normal force must be perpendicular to the incline")
    stem = question_text(question).casefold()
    if "frictionless" in stem and any(
        label in {"f", "friction"} for label in arrows
    ):
        issues.append("frictionless question must not show a friction vector")
    return issues


def validate_required_objects(
    question: dict[str, Any],
    concept: ConceptMatch,
    *,
    required: bool = False,
) -> Any:
    rule = CONCEPT_RULES.get(concept.concept)
    inspection = inspect_diagram(question)
    objects = set(inspection["objects"])
    if not diagram_spec(question):
        issues = ["required diagram objects cannot be validated without a diagram"] if required else []
        return result(
            issues=issues,
            critical_failures=["required_objects_missing"] if issues else [],
            missing_objects=[],
            detected_objects=[],
        )
    if not rule:
        return result(
            warnings=["no required-object rule exists for the detected concept"],
            missing_objects=[],
            detected_objects=sorted(objects),
        )

    required_all = set(rule.get("required_all", set()))
    normalized_text = question_text(question).casefold()
    if (
        concept.concept == "free_body_incline"
        and "friction" in normalized_text
        and "frictionless" not in normalized_text
    ):
        required_all.add("friction_vector")
    transformer_load_terms = {
        "load_resistor": bool(
            re.search(r"\bresist(?:or|ive)\b|(?:^|\W)r\s*=", normalized_text)
        ),
        "load_inductor": bool(
            re.search(r"\binduct(?:or|ive)\b|(?:^|\W)l\s*=", normalized_text)
        ),
    }
    if concept.concept == "transformer_ac_load":
        required_all.update(
            name for name, present in transformer_load_terms.items() if present
        )
    missing = required_all - objects

    required_any = tuple(set(group) for group in rule.get("required_any", ()))
    alternatives_satisfied = not required_any or any(
        group <= objects for group in required_any
    )
    if required_any and not alternatives_satisfied:
        smallest_gap = min(
            (group - objects for group in required_any),
            key=lambda values: (len(values), sorted(values)),
        )
        missing.update(smallest_gap)

    issues = []
    warnings = []
    if missing:
        issues.append(
            "diagram is missing required visual object(s): "
            + ", ".join(sorted(missing))
        )
    if concept.concept == "free_body_incline":
        issues.extend(_free_body_geometry_issues(question))
    if concept.concept == "transformer_ac_load":
        extraneous_loads = sorted(
            name
            for name, present in transformer_load_terms.items()
            if not present and name in objects
        )
        if extraneous_loads:
            warnings.append(
                "diagram shows a load not supplied or requested by the question: "
                + ", ".join(extraneous_loads)
            )
    recommended_context_missing: list[str] = []
    if concept.concept == "mutual_induction":
        joined_labels = " ".join(inspection.get("labels", [])).casefold()
        recommendations = {
            "mutual inductance M": bool(
                re.search(r"(?:^|\W)m\s*=|\bmutual\s+inductance\b", joined_labels)
            ),
            "mutual flux direction": bool(
                re.search(r"\bmutual\s+flux\b|φ|\\phi", joined_labels)
            ),
            "dot convention": bool(
                re.search(
                    r"\bdot\b|\bdot\s+convention\b|\bdotted\s+terminals?\b",
                    joined_labels,
                )
            ),
        }
        recommended_context_missing = [
            name for name, present in recommendations.items() if not present
        ]
    return result(
        issues=issues,
        warnings=warnings,
        critical_failures=(
            ["required_objects_missing"]
            if issues and concept.concept != "lr_current_growth"
            else []
        ),
        missing_objects=sorted(missing),
        detected_objects=sorted(objects),
        alternatives_satisfied=alternatives_satisfied,
        recommended_context_missing=recommended_context_missing,
        quality_penalty=(
            min(10, 4 + 2 * len(recommended_context_missing))
            if concept.concept == "mutual_induction"
            else 0
        ),
    )
