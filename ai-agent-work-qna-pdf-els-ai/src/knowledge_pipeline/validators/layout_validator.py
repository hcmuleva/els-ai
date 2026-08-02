"""Readable-layout checks for deterministic STEM SVG diagrams."""
from __future__ import annotations

from typing import Any

from ..diagram.dsl import DiagramSpec
from ..diagram.validation import validate_svg_layout
from .common import diagram_spec, result, unwrap_question


def validate_layout(question: dict[str, Any]) -> Any:
    raw = unwrap_question(question)
    svg = str(raw.get("question_svg") or "")
    spec_data = diagram_spec(question)
    if not svg.strip() and not spec_data:
        return result()

    issues: list[str] = []
    warnings: list[str] = []
    if svg.strip():
        _, layout_issues = validate_svg_layout(svg)
        issues.extend(layout_issues)
    if spec_data:
        try:
            spec = DiagramSpec.model_validate(spec_data)
        except Exception:
            pass
        else:
            if spec.width < 300 or spec.height < 220:
                warnings.append(
                    f"diagram canvas {spec.width}x{spec.height} may be too small for labels"
                )
            if len(spec.elements) == 1 and spec.kind not in {
                "bar-chart",
                "pie-chart",
                "pictogram",
            }:
                warnings.append("diagram contains only one visual element")
            if len(spec.elements) > 60:
                warnings.append("diagram may be visually crowded")
    return result(
        issues=issues,
        warnings=warnings,
        readable=not issues,
    )
