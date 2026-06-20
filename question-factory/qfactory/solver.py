"""Independent Solver/Verifier.

Re-computes the answer from a ``verification`` spec with sympy and confirms it
matches what the question claims (the numeric answer for a Numerical item, or
the number carried by the correct option for an SCQ). Items with no spec are
SKIPPED (left for the quality gate / authoring trust). This is the same
deterministic correctness layer used in POC 1.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional

_NUM_RE = re.compile(r"-?\d+(?:\.\d+)?")

try:
    import sympy as sp

    _X = sp.symbols("x")
    _SYMPY_OK = True
except Exception:  # pragma: no cover
    _SYMPY_OK = False

VERIFIED = "verified"
REFUTED = "refuted"
SKIPPED = "skipped"


@dataclass
class VerifyResult:
    status: str
    detail: str = ""


def _nums(text: str) -> List[float]:
    out: List[float] = []
    for m in _NUM_RE.findall(text or ""):
        try:
            out.append(float(m))
        except ValueError:
            continue
    return out


def _value_present(value: float, texts: List[str], tol: float) -> bool:
    for t in texts:
        if any(abs(n - value) <= tol for n in _nums(t)):
            return True
    return False


def verify(spec: Optional[dict], answer_texts: List[str], numeric_answer=None) -> VerifyResult:
    """``answer_texts`` are the correct option labels (SCQ/MCQ); ``numeric_answer``
    is the declared value for a Numerical item."""
    if not spec:
        return VerifyResult(SKIPPED, "no verification spec")
    if not _SYMPY_OK:
        return VerifyResult(SKIPPED, "sympy unavailable")

    kind = str(spec.get("kind", "")).lower()
    try:
        tol = float(spec.get("tol", 1e-6))
        label_tol = max(tol, 1e-6)
        targets = list(answer_texts)
        if numeric_answer is not None:
            targets = targets + [str(numeric_answer)]

        if kind == "numeric":
            value = float(sp.sympify(spec["expression"]))
            expected = spec.get("expected")
            if expected is not None and abs(value - float(expected)) > tol:
                return VerifyResult(REFUTED, f"compute {value} != expected {expected}")
            if numeric_answer is not None and abs(value - float(numeric_answer)) > label_tol:
                return VerifyResult(REFUTED, f"compute {value} != answer {numeric_answer}")
            if not _value_present(value, targets, label_tol):
                return VerifyResult(REFUTED, "computed value not present in the correct answer")
            return VerifyResult(VERIFIED, f"numeric={value}")

        if kind == "roots":
            sols = {sp.nsimplify(s) for s in sp.solve(sp.sympify(spec["poly"]), _X)}
            expected = {sp.nsimplify(e) for e in spec.get("expected", [])}
            if expected and sols != expected:
                return VerifyResult(REFUTED, f"roots {sols} != expected {expected}")
            return VerifyResult(VERIFIED, f"roots={sols}")

        if kind == "symbolic_derivative":
            d = sp.diff(sp.sympify(spec["func"]), _X)
            if sp.simplify(d - sp.sympify(spec["expected"])) != 0:
                return VerifyResult(REFUTED, f"d/dx={d} != expected {spec['expected']}")
            return VerifyResult(VERIFIED, f"derivative={d}")

        if kind == "symbolic_integral_def":
            val = float(sp.integrate(sp.sympify(spec["integrand"]), (_X, spec["lower"], spec["upper"])))
            expected = spec.get("expected")
            if expected is not None and abs(val - float(expected)) > tol:
                return VerifyResult(REFUTED, f"integral {val} != expected {expected}")
            if not _value_present(val, targets, label_tol):
                return VerifyResult(REFUTED, "integral value not present in the correct answer")
            return VerifyResult(VERIFIED, f"integral={val}")

        return VerifyResult(SKIPPED, f"unknown kind '{kind}'")
    except Exception as exc:  # malformed spec must never crash the pipeline
        return VerifyResult(SKIPPED, f"solver error: {exc}")
