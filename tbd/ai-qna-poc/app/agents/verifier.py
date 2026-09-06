"""Deterministic verifier agent.

Given a raw question that carries an optional ``verification`` spec, it
independently recomputes the answer with sympy and confirms that the option
marked correct actually matches that answer. This is the cheapest and most
reliable correctness layer; questions without a spec are simply skipped (left
to the LLM critic, or trusted when authored by Droid).

An optional ``exact_label`` pins the canonical correct-option text: the verifier
checks that the option(s) equal to it are exactly the option(s) flagged correct,
catching a correct computation attached to the wrong option (or an ambiguous
distractor that duplicates the answer).

Verification spec shapes (all keys optional except ``kind``):
    {"kind": "numeric", "expression": "6/3", "expected": 2, "exact_label": "$2\\,A$"}
    {"kind": "symbolic_derivative", "func": "6*x**3", "expected": "18*x**2", "exact_label": "$18x^{2}$"}
    {"kind": "symbolic_integral_def", "integrand": "x", "lower": 0, "upper": 4, "expected": 8}
    {"kind": "roots", "poly": "x**2 - 5*x + 6", "expected": [2, 3], "exact_label": "$2$ and $3$"}
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List

from app.providers.base import RawQuestion

_NUM_RE = re.compile(r"-?\d+(?:\.\d+)?")

try:  # sympy is optional at import time; missing -> verifier always skips
    import sympy as sp

    _X = sp.symbols("x")
    _SYMPY_OK = True
except Exception:  # pragma: no cover - exercised only when sympy is absent
    _SYMPY_OK = False


VERIFIED = "verified"
REFUTED = "refuted"
SKIPPED = "skipped"


@dataclass
class VerifyResult:
    status: str  # verified | refuted | skipped
    detail: str = ""


def _correct_labels(raw: RawQuestion) -> List[str]:
    return [
        str(o.get("label_md", ""))
        for o in raw.get("options", [])
        if o.get("is_correct")
    ]


def _label_numbers(labels: List[str]) -> List[float]:
    nums: List[float] = []
    for lbl in labels:
        for m in _NUM_RE.findall(lbl):
            try:
                nums.append(float(m))
            except ValueError:
                continue
    return nums


def _value_in_labels(value: float, labels: List[str], tol: float) -> bool:
    return any(abs(n - value) <= tol for n in _label_numbers(labels))


def _norm_label(s: str) -> str:
    return s.replace("$", "").replace("\\,", "").replace(" ", "")


def _flagged_slots(raw: RawQuestion) -> set:
    return {
        idx
        for idx, o in enumerate(raw.get("options", []), start=1)
        if o.get("is_correct")
    }


def _exact_label_matches_correct(raw: RawQuestion, exact_label: str) -> bool:
    """The option(s) whose label equals ``exact_label`` must be exactly the
    option(s) flagged correct (catches a right computation pinned to the wrong
    option)."""
    target = _norm_label(exact_label)
    matched = {
        idx
        for idx, o in enumerate(raw.get("options", []), start=1)
        if _norm_label(str(o.get("label_md", ""))) == target
    }
    return bool(matched) and matched == _flagged_slots(raw)


def verify(raw: RawQuestion) -> VerifyResult:
    spec = raw.get("verification")
    if not spec or not _SYMPY_OK:
        return VerifyResult(SKIPPED, "no verification spec" if not spec else "sympy unavailable")

    kind = str(spec.get("kind", "")).lower()
    labels = _correct_labels(raw)
    exact = spec.get("exact_label")

    try:
        tol = float(spec.get("tol", 1e-6))

        label_tol = max(tol, 1e-6)

        if kind == "numeric":
            value = float(sp.sympify(spec["expression"]))
            expected = spec.get("expected")
            if expected is not None and abs(value - float(expected)) > tol:
                return VerifyResult(REFUTED, f"compute {value} != expected {expected}")
            if exact and not _exact_label_matches_correct(raw, exact):
                return VerifyResult(REFUTED, "computed value not pinned to the correct option")
            if not _value_in_labels(value, labels, label_tol):
                return VerifyResult(REFUTED, "correct option does not contain the computed value")
            return VerifyResult(VERIFIED, f"numeric={value}")

        if kind == "symbolic_derivative":
            derivative = sp.diff(sp.sympify(spec["func"]), _X)
            expected = sp.sympify(spec["expected"])
            if sp.simplify(derivative - expected) != 0:
                return VerifyResult(REFUTED, f"d/dx gives {derivative}, expected {expected}")
            if exact and not _exact_label_matches_correct(raw, exact):
                return VerifyResult(REFUTED, "correct option label does not match derivative")
            return VerifyResult(VERIFIED, f"derivative={derivative}")

        if kind == "symbolic_integral_def":
            integral = sp.integrate(sp.sympify(spec["integrand"]), (_X, spec["lower"], spec["upper"]))
            value = float(integral)
            expected = spec.get("expected")
            if expected is not None and abs(value - float(expected)) > tol:
                return VerifyResult(REFUTED, f"integral {value} != expected {expected}")
            if exact and not _exact_label_matches_correct(raw, exact):
                return VerifyResult(REFUTED, "integral value not pinned to the correct option")
            if not _value_in_labels(value, labels, label_tol):
                return VerifyResult(REFUTED, "correct option does not contain the integral value")
            return VerifyResult(VERIFIED, f"integral={value}")

        if kind == "roots":
            solutions = sp.solve(sp.sympify(spec["poly"]), _X)
            got = {sp.nsimplify(s) for s in solutions}
            expected = {sp.nsimplify(e) for e in spec.get("expected", [])}
            if expected and got != expected:
                return VerifyResult(REFUTED, f"roots {got} != expected {expected}")
            if exact and not _exact_label_matches_correct(raw, exact):
                return VerifyResult(REFUTED, "roots not pinned to the correct option")
            if not exact:
                label_nums = {round(n, 6) for n in _label_numbers(labels)}
                want = {round(float(e), 6) for e in spec.get("expected", [])}
                if want and not want.issubset(label_nums):
                    return VerifyResult(REFUTED, "correct option does not contain the roots")
            return VerifyResult(VERIFIED, f"roots={got}")

        return VerifyResult(SKIPPED, f"unknown kind '{kind}'")
    except Exception as exc:  # malformed spec should not crash the pipeline
        return VerifyResult(SKIPPED, f"verifier error: {exc}")
