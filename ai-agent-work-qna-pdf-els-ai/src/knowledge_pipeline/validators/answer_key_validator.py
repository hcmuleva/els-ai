"""Deterministic answer-key, rationale, and explanation consistency checks."""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any

from .common import options, result, unwrap_question

_NUMBER = re.compile(
    r"(?<![\w.])([+-]?\d+(?:\.\d+)?)"
    r"(?:\s*(?:×|\\times)\s*10\s*\^?\s*\{?([+-]?\d+)\}?)?"
    r"\s*(\\Omega|Ω|mH|H|ms|s|mV|kV|V|mA|A|Wb|T|W|J|C|N|%|"
    r"(?:m|cm|mm)(?:\^?\{?2\}?|²)?)?"
    r"(?:\s*(?:rms|RMS))?",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class NumericValue:
    value: float
    unit: str
    raw: str


def extract_numeric_values(text: str) -> list[NumericValue]:
    values: list[NumericValue] = []
    for match in _NUMBER.finditer(text or ""):
        base = float(match.group(1))
        exponent = int(match.group(2) or 0)
        unit = (match.group(3) or "").replace("\\Omega", "Ω")
        normalized_unit = unit.casefold()
        scales = {
            "mv": (1e-3, "v"),
            "kv": (1e3, "v"),
            "ma": (1e-3, "a"),
            "mh": (1e-3, "h"),
            "ms": (1e-3, "s"),
            "cm2": (1e-4, "m2"),
            "cm^2": (1e-4, "m2"),
            "cm²": (1e-4, "m2"),
            "mm2": (1e-6, "m2"),
            "mm^2": (1e-6, "m2"),
            "mm²": (1e-6, "m2"),
            "m²": (1.0, "m2"),
            "m2": (1.0, "m2"),
            "m^2": (1.0, "m2"),
        }
        normalized_unit = normalized_unit.replace("{", "").replace("}", "")
        scale, canonical_unit = scales.get(
            normalized_unit,
            (1.0, normalized_unit),
        )
        values.append(
            NumericValue(
                value=base * (10**exponent) * scale,
                unit=canonical_unit,
                raw=match.group(0).strip(),
            )
        )
    return values


def _equivalent(first: NumericValue, second: NumericValue) -> bool:
    if first.unit and second.unit and first.unit != second.unit:
        return False
    scale = max(1.0, abs(first.value), abs(second.value))
    return math.isclose(first.value, second.value, rel_tol=1e-6, abs_tol=1e-8 * scale)


def _final_explanation_value(explanation: str) -> NumericValue | None:
    conclusion = list(
        re.finditer(
            r"(?i)\b(?:therefore|hence|thus|so|final\s+answer|gives|equals)\b",
            explanation,
        )
    )
    if conclusion:
        conclusion_values = extract_numeric_values(
            explanation[conclusion[-1].start():]
        )
        if conclusion_values:
            return conclusion_values[-1]
    values = extract_numeric_values(explanation)
    if not values:
        return None
    return values[-1]


def validate_answer_key(question: dict[str, Any]) -> Any:
    raw = unwrap_question(question)
    choices = options(question)
    correct = [choice for choice in choices if choice.get("is_correct")]
    issues: list[str] = []
    warnings: list[str] = []
    critical: list[str] = []

    if not correct:
        issues.append("no answer option is marked correct")
        critical.append("no_correct_option")
    elif len(correct) > 1:
        issues.append("multiple answer options are marked correct")
        critical.append("multiple_correct_options")

    explanation = str(raw.get("explanation") or "")
    expected = _final_explanation_value(explanation)
    marked = None
    if len(correct) == 1:
        marked_values = extract_numeric_values(str(correct[0].get("label") or ""))
        if marked_values:
            marked = marked_values[-1]
    if expected and marked and not _equivalent(expected, marked):
        issues.append(
            f"Explanation derives {expected.raw}, but the marked correct option is "
            f"{marked.raw}."
        )
        critical.append("answer_explanation_mismatch")

    if expected:
        distractor_expected = expected
        if marked and not expected.unit and marked.unit:
            distractor_expected = NumericValue(
                value=expected.value,
                unit=marked.unit,
                raw=expected.raw,
            )
        for choice in choices:
            if choice.get("is_correct"):
                continue
            for value in extract_numeric_values(str(choice.get("label") or "")):
                if _equivalent(distractor_expected, value):
                    issues.append(
                        f"Incorrect option {choice.get('label')!r} contains the "
                        f"explanation result {expected.raw}."
                    )
                    critical.append("answer_explanation_mismatch")

    explicit = re.search(
        r"(?i)(?:correct\s+(?:answer|option)\s+is|therefore\s+(?:the\s+)?answer\s+is)"
        r"\s*[:\-]?\s*([A-D])\b",
        explanation,
    )
    if explicit and len(correct) == 1:
        expected_index = ord(explicit.group(1).upper()) - ord("A")
        actual_index = choices.index(correct[0])
        if expected_index != actual_index:
            issues.append(
                f"Explanation names option {explicit.group(1).upper()}, but option "
                f"{chr(ord('A') + actual_index)} is marked correct."
            )
            critical.append("answer_explanation_mismatch")

    if len(correct) == 1:
        rationale = str(correct[0].get("rationale") or "")
        rationale_value = _final_explanation_value(rationale)
        if expected and rationale_value and not _equivalent(expected, rationale_value):
            warnings.append(
                "Correct-option rationale does not match the explanation's final value."
            )

    return result(
        issues=issues,
        warnings=warnings,
        critical_failures=critical,
        expected_from_explanation=expected.raw if expected else None,
        marked_correct=correct[0].get("label") if len(correct) == 1 else None,
        correct_option_count=len(correct),
    )
