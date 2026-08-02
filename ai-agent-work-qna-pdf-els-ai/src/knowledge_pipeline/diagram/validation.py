"""Deterministic semantic and layout checks for controlled diagrams."""
from __future__ import annotations

import math
import re
import xml.etree.ElementTree as ET
from typing import Any

from ..assessment.validation import validate_svg
from ..rendering.svg import _overlap_area, _text_box
from .dsl import (
    AngleMark,
    Arrow,
    BarChart,
    Circle,
    DiagramSpec,
    Dimension,
    FunctionPlot,
    FunctionRegion,
    Line,
    Label,
    ParallelMark,
    PictogramChart,
    PieChart,
    Point,
    Polygon,
    RightAngleMark,
    Segment,
    TickMark,
)
from .from_spec import validate_function_expr

_FIGURE_REFERENCE = re.compile(
    r"\b(?:diagram|figure|graph|plot|shown|pictured|in the figure|from the graph)\b",
    re.IGNORECASE,
)


def stem_requires_diagram(stem: str) -> bool:
    """Return true only when the wording explicitly depends on a visual."""
    return bool(_FIGURE_REFERENCE.search(stem or ""))


def validate_spec_semantics(spec: DiagramSpec) -> tuple[bool, list[str]]:
    issues: list[str] = []
    if spec.width <= 0 or spec.height <= 0:
        issues.append("diagram dimensions must be positive")
    if not spec.xmin < spec.xmax or not spec.ymin < spec.ymax:
        issues.append("diagram viewport must have increasing bounds")
    if not spec.elements:
        issues.append("diagram has no elements")
    parallel_groups: dict[int, list[ParallelMark]] = {}
    tick_groups: dict[int, list[TickMark]] = {}
    for element in spec.elements:
        if isinstance(element, FunctionPlot):
            try:
                validate_function_expr(element.expr, *element.domain)
            except Exception as exc:
                issues.append(f"invalid function {element.expr!r}: {exc}")
        elif isinstance(element, FunctionRegion):
            for expression in (element.upper_expr, element.lower_expr):
                try:
                    validate_function_expr(expression, *element.domain)
                except Exception as exc:
                    issues.append(f"invalid region function {expression!r}: {exc}")
        elif isinstance(element, Point):
            if not _inside(spec, element.at):
                issues.append(f"point {element.label or element.at} is outside the viewport")
        elif isinstance(element, Segment):
            if not _inside(spec, element.a) or not _inside(spec, element.b):
                issues.append(f"segment {element.label or ''} leaves the viewport")
        elif isinstance(element, Arrow):
            if not _inside(spec, element.start) or not _inside(spec, element.end):
                issues.append(f"arrow {element.label or ''} leaves the viewport")
        elif isinstance(element, Label):
            if not element.text.strip():
                issues.append("diagram label text is empty")
            if not _inside(spec, element.at):
                issues.append(f"label {element.text!r} is outside the viewport")
        elif isinstance(element, Dimension):
            if not element.label.strip():
                issues.append("dimension label is empty")
            if not _inside(spec, element.a) or not _inside(spec, element.b):
                issues.append(f"dimension {element.label!r} leaves the viewport")
        elif isinstance(element, Line):
            if abs(element.a) < 1e-12 and abs(element.b) < 1e-12:
                issues.append("line has zero coefficients")
        elif isinstance(element, AngleMark):
            if _length(element.vertex, element.p1) <= 1e-9 or _length(
                element.vertex, element.p2
            ) <= 1e-9:
                issues.append("angle mark has a zero-length ray")
        elif isinstance(element, RightAngleMark):
            first = _vector(element.vertex, element.p1)
            second = _vector(element.vertex, element.p2)
            lengths = math.hypot(*first) * math.hypot(*second)
            if lengths <= 1e-9:
                issues.append("right-angle mark has a zero-length ray")
            elif abs(first[0] * second[0] + first[1] * second[1]) / lengths > 1e-4:
                issues.append("right-angle mark references non-perpendicular rays")
        elif isinstance(element, (TickMark, ParallelMark)):
            if _length(element.a, element.b) <= 1e-9:
                issues.append(f"{element.type} references a zero-length segment")
            if not _inside(spec, element.a) or not _inside(spec, element.b):
                issues.append(f"{element.type} leaves the viewport")
            if element.count < 1:
                issues.append(f"{element.type} count must be positive")
            if isinstance(element, ParallelMark):
                parallel_groups.setdefault(element.count, []).append(element)
            else:
                tick_groups.setdefault(element.count, []).append(element)
        elif isinstance(element, Circle):
            if element.radius <= 0:
                issues.append("circle radius must be positive")
        elif isinstance(element, Polygon):
            if len(element.points) < 2 or len(set(element.points)) < 2:
                issues.append("polygon is degenerate")
        elif isinstance(element, BarChart):
            if not element.categories or len(element.categories) != len(element.values):
                issues.append("bar chart categories and values must be nonempty and aligned")
            if any(not math.isfinite(value) or value < 0 for value in element.values):
                issues.append("bar chart values must be finite and nonnegative")
            maximum = element.max_value or max(element.values or [0])
            if maximum <= 0 or any(value > maximum for value in element.values):
                issues.append("bar chart maximum must contain every value")
            if element.tick_step is not None and element.tick_step <= 0:
                issues.append("bar chart tick step must be positive")
        elif isinstance(element, PieChart):
            if not element.categories or len(element.categories) != len(element.values):
                issues.append("pie chart categories and values must be nonempty and aligned")
            if any(not math.isfinite(value) or value <= 0 for value in element.values):
                issues.append("pie chart values must be finite and positive")
            if sum(element.values) <= 0:
                issues.append("pie chart total must be positive")
        elif isinstance(element, PictogramChart):
            if element.unit <= 0:
                issues.append("pictogram unit must be positive")
            if not element.rows:
                issues.append("pictogram must contain at least one row")
            if any(not math.isfinite(row.value) or row.value < 0 for row in element.rows):
                issues.append("pictogram row values must be finite and nonnegative")
            if element.max_icons_per_row < 1:
                issues.append("pictogram icon limit must be positive")
            elif element.unit > 0 and any(
                row.value / element.unit > element.max_icons_per_row
                for row in element.rows
            ):
                issues.append("pictogram row exceeds the configured icon limit")
    for marks in parallel_groups.values():
        if len(marks) < 2:
            continue
        reference = _vector(marks[0].a, marks[0].b)
        for mark in marks[1:]:
            vector = _vector(mark.a, mark.b)
            scale = math.hypot(*reference) * math.hypot(*vector)
            if scale > 1e-9 and abs(reference[0] * vector[1] - reference[1] * vector[0]) / scale > 1e-4:
                issues.append("matching parallel marks reference non-parallel segments")
    for marks in tick_groups.values():
        if len(marks) < 2:
            continue
        reference_length = _length(marks[0].a, marks[0].b)
        for mark in marks[1:]:
            length = _length(mark.a, mark.b)
            scale = max(reference_length, length, 1e-9)
            if abs(reference_length - length) / scale > 1e-4:
                issues.append("matching tick marks reference unequal segments")
    return not issues, sorted(set(issues))


def validate_svg_layout(svg: str) -> tuple[bool, list[str]]:
    valid, issues = validate_svg(svg)
    if not valid:
        return False, issues
    root = ET.fromstring(svg)
    view_box = [float(value) for value in root.attrib["viewBox"].split()]
    if len(view_box) != 4:
        return False, ["SVG viewBox must have four numbers"]
    left, top, width, height = view_box
    right, bottom = left + width, top + height
    labels: list[tuple[str, tuple[float, float, float, float]]] = []
    for element in root.iter():
        if element.tag.split("}")[-1] != "text":
            continue
        if element.attrib.get("data-layout") != "auto":
            continue
        text = "".join(element.itertext())
        box = _text_box(
            text,
            float(element.attrib["x"]),
            float(element.attrib["y"]),
            element.attrib.get("text-anchor", "start"),
            float(element.attrib.get("font-size", 12)),
        )
        labels.append((text, box))
        if box[0] < left or box[1] < top or box[2] > right or box[3] > bottom:
            issues.append(f"label {text!r} is clipped by the viewBox")
    for index, (first_text, first_box) in enumerate(labels):
        for second_text, second_box in labels[index + 1 :]:
            if _overlap_area(first_box, second_box) > 0:
                issues.append(
                    f"labels {first_text!r} and {second_text!r} overlap"
                )
    return not issues, sorted(set(issues))


def validate_question_diagram(
    question: dict[str, Any],
    *,
    expected: bool,
    rationale: str,
) -> dict[str, Any]:
    data = question.get("question_data") or {}
    raw_spec = data.get("diagram")
    svg = question.get("question_svg") or ""
    issues: list[str] = []
    checks = {
        "necessity_classified": bool(rationale.strip()),
        "presence_matches_decision": bool(raw_spec and svg) == expected,
        "spec_semantics": True,
        "svg_structure": True,
        "layout": True,
    }
    if expected:
        try:
            spec = DiagramSpec.model_validate(raw_spec)
        except Exception as exc:
            checks["spec_semantics"] = False
            issues.append(f"invalid DiagramSpec: {exc}")
        else:
            checks["spec_semantics"], spec_issues = validate_spec_semantics(spec)
            issues.extend(spec_issues)
        checks["svg_structure"], svg_issues = validate_svg(svg)
        checks["layout"], layout_issues = validate_svg_layout(svg)
        issues.extend(svg_issues)
        issues.extend(layout_issues)
    elif raw_spec or svg:
        issues.append("diagram retained despite a remove/not-needed decision")
    if not checks["presence_matches_decision"]:
        issues.append("diagram presence does not match the semantic decision")
    passed = all(checks.values()) and not issues
    return {
        "passed": passed,
        "expected": expected,
        "rationale": rationale,
        "checks": checks,
        "issues": sorted(set(issues)),
    }


def _inside(spec: DiagramSpec, point: tuple[float, float]) -> bool:
    return (
        math.isfinite(point[0])
        and math.isfinite(point[1])
        and spec.xmin <= point[0] <= spec.xmax
        and spec.ymin <= point[1] <= spec.ymax
    )


def _vector(
    start: tuple[float, float], end: tuple[float, float]
) -> tuple[float, float]:
    return (end[0] - start[0], end[1] - start[1])


def _length(start: tuple[float, float], end: tuple[float, float]) -> float:
    return math.hypot(*_vector(start, end))
