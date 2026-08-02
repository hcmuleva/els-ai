"""Required symbol, value, unit, and axis-label validation."""
from __future__ import annotations

import re
from typing import Any

from .answer_key_validator import extract_numeric_values
from .common import ConceptMatch, diagram_spec, question_text, result
from .diagram_inspection import inspect_diagram
from .rules import CONCEPT_RULES

_ASSIGNMENT = re.compile(
    r"(?<![A-Za-z0-9])([A-Za-zΦφεε][A-Za-z0-9_∞]*)\s*=\s*"
    r"([+-]?\d+(?:\.\d+)?)"
    r"(?:\s*(?:×|\\times)\s*10\s*\^?\s*\{?([+-]?\d+)\}?)?"
    r"\s*(mH|H|ms|s|mV|kV|V|mA|A|Wb|T|Ω|\\Omega|"
    r"(?:m|cm|mm)(?:\^?\{?2\}?|²)?)?"
    r"(?:\s*rms)?",
    re.IGNORECASE,
)


def _flat(value: str) -> str:
    text = value.replace("\\mathrm", "").replace("\\mathbf", "")
    text = text.replace("\\vec", "").replace("\\hat", "")
    text = text.replace("\\(", " ").replace("\\)", " ")
    text = text.replace("\\[", " ").replace("\\]", " ").replace("\\,", " ")
    text = text.replace("{", "").replace("}", "").replace("_", "")
    return " ".join(text.split())


def _contains_label(joined: str, expected: str) -> bool:
    aliases = {
        "n": (r"(?:^|\W)n(?:\W|$)", r"\bnormal\b"),
        "ε2": (r"ε\s*2", r"epsilon\s*2", r"\bemf\b"),
        "i1": (r"(?:^|\W)i\s*1(?:\W|$)", r"changing\s+current"),
        "Np": (r"(?:^|\W)np(?:\W|$)", r"primary"),
        "Ns": (r"(?:^|\W)ns(?:\W|$)", r"secondary"),
        "Vp": (r"(?:^|\W)vp(?:\W|$)", r"primary\s+voltage"),
    }
    patterns = aliases.get(
        expected,
        (rf"(?:^|\W){re.escape(expected.casefold())}(?:\W|$)",),
    )
    return any(re.search(pattern, joined, re.IGNORECASE) for pattern in patterns)


def _assigned_quantities(text: str) -> dict[str, list[tuple[float, str]]]:
    assigned: dict[str, list[tuple[float, str]]] = {}
    for match in _ASSIGNMENT.finditer(_flat(text)):
        values = extract_numeric_values(match.group(0))
        if not values:
            continue
        value = values[-1]
        assigned.setdefault(match.group(1).casefold(), []).append(
            (value.value, value.unit)
        )
    return assigned


def validate_diagram_labels(
    question: dict[str, Any],
    concept: ConceptMatch,
) -> Any:
    if not diagram_spec(question):
        return result(missing_labels=[], missing_units=[])
    inspection = inspect_diagram(question)
    labels = [_flat(str(label)) for label in inspection["labels"]]
    joined = " ".join(labels).casefold()
    rule = CONCEPT_RULES.get(concept.concept, {})
    required_labels = set(rule.get("required_labels", set()))
    missing = sorted(
        label for label in required_labels if not _contains_label(joined, label)
    )

    required_any = tuple(set(group) for group in rule.get("required_labels_any", ()))
    if required_any and not any(
        all(_contains_label(joined, label) for label in group)
        for group in required_any
    ):
        best = min(
            (
                {
                    label
                    for label in group
                    if not _contains_label(joined, label)
                }
                for group in required_any
            ),
            key=lambda values: (len(values), sorted(values)),
        )
        missing.extend(sorted(best))
        missing = sorted(set(missing))

    text = question_text(question)
    angle_values = re.findall(r"(\d+(?:\.\d+)?)\s*(?:°|\\circ)", text)
    missing_values = [
        f"{value}°"
        for value in angle_values
        if not re.search(rf"{re.escape(value)}\s*(?:°|\\circ)", " ".join(labels))
    ]
    question_quantities = _assigned_quantities(text)
    diagram_quantities = _assigned_quantities(" ".join(labels))
    missing_units: list[str] = []
    mismatched_units: list[str] = []
    for symbol, displayed in diagram_quantities.items():
        supplied = question_quantities.get(symbol, [])
        supplied_units = {unit for _, unit in supplied if unit}
        if not supplied_units:
            continue
        for displayed_value, displayed_unit in displayed:
            matching_units = {
                unit
                for supplied_value, unit in supplied
                if unit
                and abs(supplied_value - displayed_value)
                <= 1e-8 * max(1.0, abs(supplied_value), abs(displayed_value))
            }
            if not matching_units:
                continue
            if not displayed_unit:
                missing_units.append(
                    f"{symbol}={displayed_value:g} ({'/'.join(sorted(matching_units))})"
                )
            elif displayed_unit not in matching_units:
                mismatched_units.append(
                    f"{symbol}: {displayed_unit} instead of "
                    f"{'/'.join(sorted(matching_units))}"
                )

    issues = []
    warnings = []
    if missing:
        issues.append("diagram is missing required label(s): " + ", ".join(missing))
    if missing_values:
        issues.append(
            "diagram is missing question angle value(s): "
            + ", ".join(missing_values)
        )
    if missing_units:
        warnings.append(
            "diagram omits a unit for a rendered quantity: "
            + ", ".join(missing_units)
        )
    if mismatched_units:
        issues.append(
            "diagram uses the wrong unit for a rendered quantity: "
            + ", ".join(mismatched_units)
        )
    return result(
        issues=issues,
        warnings=warnings,
        missing_labels=missing,
        missing_values=missing_values,
        missing_units=missing_units,
        mismatched_units=mismatched_units,
        labels=labels,
    )
