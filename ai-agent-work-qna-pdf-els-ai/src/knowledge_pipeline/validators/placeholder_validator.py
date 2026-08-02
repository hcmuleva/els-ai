"""Placeholder and garbage-label detection for structured diagrams and SVG."""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from typing import Any

from .common import diagram_spec, result, unwrap_question

_PLACEHOLDER = re.compile(
    r"(?i)\b(?:abc|xyz|foo|bar|test|sample|dummy|placeholder|todo|tbd|"
    r"node\d*|label|value|formula\s+here)\b"
)
_LABEL_KEYS = {
    "label",
    "labels",
    "text",
    "title",
    "x_label",
    "y_label",
    "width_label",
    "height_label",
    "angle_label",
    "vertex_labels",
    "side_labels",
    "key_label",
    "total_label",
    "upper_label",
    "lower_label",
}


def _structured_labels(value: Any, key: str = "") -> list[str]:
    labels: list[str] = []
    if isinstance(value, dict):
        for child_key, child in value.items():
            if child_key in _LABEL_KEYS:
                labels.extend(_structured_labels(child, child_key))
            elif isinstance(child, (dict, list, tuple)):
                labels.extend(_structured_labels(child, child_key))
    elif isinstance(value, (list, tuple)):
        for child in value:
            labels.extend(_structured_labels(child, key))
    elif key in _LABEL_KEYS and value is not None:
        labels.append(str(value))
    return labels


def _svg_labels(svg: str) -> list[str]:
    if not svg.strip():
        return []
    try:
        root = ET.fromstring(svg)
    except ET.ParseError:
        return []
    return [
        "".join(element.itertext()).strip()
        for element in root.iter()
        if element.tag.split("}")[-1] == "text"
    ]


def validate_placeholders(question: dict[str, Any]) -> Any:
    raw = unwrap_question(question)
    labels = _structured_labels(diagram_spec(question) or {})
    labels.extend(_svg_labels(str(raw.get("question_svg") or "")))
    found = sorted(
        {
            match.group(0)
            for label in labels
            for match in _PLACEHOLDER.finditer(label)
        },
        key=str.casefold,
    )
    empty = [label for label in labels if not label.strip()]
    issues = []
    if found:
        issues.append(f"placeholder diagram label(s): {', '.join(found)}")
    if empty:
        issues.append("diagram contains an empty text label")
    return result(
        issues=issues,
        critical_failures=["placeholder_label"] if issues else [],
        found_placeholders=found,
        inspected_label_count=len(labels),
    )
