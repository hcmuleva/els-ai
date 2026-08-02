"""Concept-aware validation for Mathematics and Physics plots."""
from __future__ import annotations

import re
from typing import Any

from .common import ConceptMatch, diagram_spec, question_text, result
from .diagram_inspection import inspect_diagram


def validate_graph(question: dict[str, Any], concept: ConceptMatch) -> Any:
    spec = diagram_spec(question)
    if not spec:
        return result()
    inspection = inspect_diagram(question)
    kind = str(inspection["kind"] or "").casefold()
    if kind not in {"function-plot", "physics-current-time"}:
        return result()

    issues: list[str] = []
    warnings: list[str] = []
    axes = inspection["axes"]
    labels = " ".join(inspection["labels"])
    objects = set(inspection["objects"])
    if not axes:
        issues.append("function plot has no labeled axes")
    if concept.subject == "Physics":
        if any(x.strip().casefold() == "x" and y.strip().casefold() == "y" for x, y in axes):
            issues.append(
                "Physics graph uses generic x/y axes instead of physical quantities"
            )
        if concept.concept == "lr_current_growth":
            if "time_axis" not in objects:
                issues.append("LR growth graph x-axis must represent time t")
            if "current_axis" not in objects:
                issues.append("LR growth graph y-axis must represent current I")
            if "exponential_growth_curve" not in objects:
                issues.append("LR growth graph must show exponential current growth")
            if "75" in question_text(question) and not re.search(r"75\s*%", labels):
                issues.append("LR growth graph must mark the stated 75% current level")
        for x_label, y_label in axes:
            if "(" not in x_label and concept.concept == "lr_current_growth":
                warnings.append("time axis should include a unit, for example t (s)")
            if "(" not in y_label and concept.concept == "lr_current_growth":
                warnings.append("current axis should include a unit, for example I (A)")

    return result(
        issues=issues,
        warnings=warnings,
        axes=[{"x": x, "y": y} for x, y in axes],
    )
