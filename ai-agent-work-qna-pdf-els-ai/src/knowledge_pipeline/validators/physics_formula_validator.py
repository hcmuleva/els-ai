"""Conservative deterministic checks for supported Class 12 Physics formulas."""
from __future__ import annotations

import math
import re
from typing import Any

from .answer_key_validator import NumericValue, extract_numeric_values
from .common import ConceptMatch, options, question_text, result


def _plain(text: str) -> str:
    value = text.replace("\\(", " ").replace("\\)", " ")
    value = value.replace("\\[", " ").replace("\\]", " ")
    value = value.replace("\\mathrm", "").replace("\\Omega", "Ω")
    value = value.replace("\\times", "×").replace("\\,", " ")
    value = value.replace("{", "").replace("}", "").replace("_", "")
    return " ".join(value.split())


def _assignment(text: str, names: tuple[str, ...]) -> tuple[float, str] | None:
    alternatives = "|".join(re.escape(name.replace("_", "")) for name in names)
    match = re.search(
        rf"(?i)(?:^|\W)(?:{alternatives})\s*=\s*"
        r"([+-]?\d+(?:\.\d+)?)\s*(mH|H|mV|V|mA|A|Ω|ohm|T|m2|s|ms)?",
        text,
    )
    if not match:
        return None
    value = float(match.group(1))
    unit = (match.group(2) or "")
    scales = {"mH": 1e-3, "mV": 1e-3, "mA": 1e-3, "ms": 1e-3}
    return value * scales.get(unit, 1.0), unit


def _marked_value(question: dict[str, Any]) -> NumericValue | None:
    correct = [choice for choice in options(question) if choice.get("is_correct")]
    if len(correct) != 1:
        return None
    values = extract_numeric_values(str(correct[0].get("label") or ""))
    return values[-1] if values else None


def _compare(
    question: dict[str, Any],
    expected: float | None,
    formula: str,
    *,
    unit: str,
) -> Any:
    marked = _marked_value(question)
    if expected is None:
        return result(
            warnings=["deterministic formula check was not applicable"],
            ran=False,
            formula=formula,
            expected=None,
        )
    if marked is None:
        return result(
            issues=["computed result could not be compared with the marked option"],
            critical_failures=["answer_explanation_mismatch"],
            ran=True,
            formula=formula,
            expected=f"{expected:g} {unit}".strip(),
        )
    expected_unit = unit.casefold()
    if marked.unit and expected_unit and marked.unit != expected_unit:
        return result(
            issues=[
                f"Deterministic formula gives a result in {unit}, but the marked "
                f"option uses {marked.unit}."
            ],
            critical_failures=["answer_explanation_mismatch"],
            ran=True,
            formula=formula,
            expected=f"{expected:g} {unit}".strip(),
            marked=marked.value,
        )
    scale = max(1.0, abs(expected), abs(marked.value))
    if not math.isclose(
        expected,
        marked.value,
        rel_tol=2e-3,
        abs_tol=1e-8 * scale,
    ):
        return result(
            issues=[
                f"Deterministic formula gives {expected:g} {unit}, but the marked "
                f"option gives {marked.value:g}."
            ],
            critical_failures=["answer_explanation_mismatch"],
            ran=True,
            formula=formula,
            expected=f"{expected:g} {unit}".strip(),
            marked=marked.value,
        )
    return result(
        ran=True,
        formula=formula,
        expected=f"{expected:g} {unit}".strip(),
        marked=marked.value,
    )


def _mutual_induction(question: dict[str, Any], text: str) -> Any:
    l1 = _assignment(text, ("L1",))
    l2 = _assignment(text, ("L2",))
    coupling = _assignment(text, ("k",))
    supplied_mutual = _assignment(text, ("M",))
    mutual = supplied_mutual[0] if supplied_mutual else None
    if mutual is None and l1 and l2 and coupling:
        mutual = coupling[0] * math.sqrt(l1[0] * l2[0])

    if l1 and l2 and mutual is not None and re.search(
        r"(?i)\bseries\s+(?:aiding|opposing)\b", text
    ):
        aiding = bool(re.search(r"(?i)\bseries\s+aiding\b", text))
        expected = l1[0] + l2[0] + (2 * mutual if aiding else -2 * mutual)
        return _compare(
            question,
            expected,
            "Leq = L1 + L2 + 2M"
            if aiding
            else "Leq = L1 + L2 - 2M",
            unit="H",
        )

    if not (l1 and l2 and mutual is not None):
        return _compare(question, None, "M = k sqrt(L1 L2)", unit="V")
    derivative = _assignment(text, ("di/dt", "di1/dt"))
    if derivative:
        di_dt = derivative[0]
    else:
        current = re.search(
            r"(?i)i1\s*=\s*([+-]?\d+(?:\.\d+)?)\s*t\s*\^\s*(\d+)",
            text,
        )
        at_time = _assignment(text, ("t",))
        if not current or not at_time:
            return _compare(
                question,
                None,
                "M = k sqrt(L1 L2); emf = M |di1/dt|",
                unit="V",
            )
        coefficient = float(current.group(1))
        power = int(current.group(2))
        di_dt = coefficient * power * at_time[0] ** (power - 1)
    expected = abs(mutual * di_dt)
    return _compare(
        question,
        expected,
        "M = k sqrt(L1 L2); emf = M |di1/dt|",
        unit="V",
    )


def _magnetic_flux(question: dict[str, Any], text: str) -> Any:
    if re.search(r"(?i)\bB\s*\(\s*x\s*\)", text):
        return _compare(
            question,
            None,
            "phi = integral(B dot dA) for a non-uniform field",
            unit="Wb",
        )
    field = _assignment(text, ("B",))
    area = _assignment(text, ("A",))
    angle = re.search(r"(\d+(?:\.\d+)?)\s*(?:°|degree|circ)", text, re.I)
    if not (field and area):
        return _compare(question, None, "phi = B A cos(theta)", unit="Wb")
    theta = math.radians(float(angle.group(1))) if angle else 0.0
    return _compare(
        question,
        field[0] * area[0] * math.cos(theta),
        "phi = B A cos(theta)",
        unit="Wb",
    )


def _lr_current(question: dict[str, Any], text: str) -> Any:
    voltage = _assignment(text, ("V",))
    resistance = _assignment(text, ("R",))
    inductance = _assignment(text, ("L",))
    fraction = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
    if (
        voltage
        and resistance
        and inductance
        and fraction
        and re.search(r"(?i)\b(?:time|when)\b", text)
    ):
        f = float(fraction.group(1)) / 100.0
        if 0 < f < 1:
            expected = -(inductance[0] / resistance[0]) * math.log(1 - f)
            return _compare(
                question,
                expected,
                "t = -(L/R) ln(1-f)",
                unit="s",
            )
    return _compare(
        question,
        None,
        "I(t) = (V/R)(1-exp(-tR/L))",
        unit="",
    )


def _transformer(question: dict[str, Any], text: str) -> Any:
    primary_v = _assignment(text, ("Vp",))
    primary_n = _assignment(text, ("Np",))
    secondary_n = _assignment(text, ("Ns",))
    if (
        primary_v
        and primary_n
        and secondary_n
        and re.search(r"(?i)\bsecondary\s+voltage\b|\bVs\b", text)
    ):
        expected = primary_v[0] * secondary_n[0] / primary_n[0]
        return _compare(question, expected, "Vs = Vp Ns/Np", unit="V")
    return _compare(
        question,
        None,
        "Vs = Vp Ns/Np; XL = omega L; Z = sqrt(R^2+XL^2)",
        unit="",
    )


def validate_physics_formula(
    question: dict[str, Any],
    concept: ConceptMatch,
) -> Any:
    if concept.subject != "Physics":
        return result(ran=False)
    text = _plain(question_text(question))
    validators = {
        "mutual_induction": _mutual_induction,
        "magnetic_flux_loop": _magnetic_flux,
        "lr_current_growth": _lr_current,
        "transformer_ac_load": _transformer,
    }
    validator = validators.get(concept.concept)
    if not validator:
        return result(
            warnings=["no deterministic formula rule exists for this Physics concept"],
            ran=False,
        )
    return validator(question, text)
