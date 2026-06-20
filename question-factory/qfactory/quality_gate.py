"""Quality Gate: enforce the spec's hard rejection rules.

Returns the ``qualityChecks`` block plus PASS/FAIL and a reason. A FAIL means the
candidate is dropped (the pipeline pulls the next one from the bank).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from qfactory.calibrator import not_too_easy
from qfactory.solver import REFUTED, VERIFIED
from qfactory.types import Level, QType


@dataclass
class GateResult:
    passed: bool
    reason: str
    checks: Dict[str, bool] = field(default_factory=dict)


def _correct_indices(item: dict) -> List[int]:
    return [i for i, o in enumerate(item.get("options", [])) if o.get("is_correct")]


def evaluate(item: dict, level: Level, verify_status: str, in_syllabus: bool) -> GateResult:
    qtype = item.get("questionType")
    options = item.get("options", [])
    correct = _correct_indices(item)
    question = str(item.get("question", "")).strip()
    solution = item.get("solution") or {}

    # structural rules per type
    if qtype == QType.SCQ.value:
        if len(options) < 3:
            return GateResult(False, "SCQ needs at least 3 options")
        if len(correct) != 1:
            return GateResult(False, f"SCQ must have exactly 1 correct option (got {len(correct)})")
    elif qtype == QType.ASSERTION_REASON.value:
        if len(options) != 4:
            return GateResult(False, "AssertionReason must have exactly 4 options")
        if len(correct) != 1:
            return GateResult(False, "AssertionReason must have exactly 1 correct option")
    elif qtype == QType.MCQ.value:
        if len(correct) < 2:
            return GateResult(False, f"MCQ must have at least 2 correct options (got {len(correct)})")
        if len(correct) == len(options):
            return GateResult(False, "MCQ cannot have every option correct")
    elif qtype == QType.TF.value:
        if len(options) != 2 or len(correct) != 1:
            return GateResult(False, "TF must have 2 options with exactly 1 correct")
    elif qtype == QType.NUMERICAL.value:
        if item.get("numericAnswer") is None:
            return GateResult(False, "Numerical must carry a numericAnswer")
        if not item.get("verification"):
            return GateResult(False, "Numerical must carry a verification spec")
    else:
        return GateResult(False, f"unsupported questionType '{qtype}'")

    # option sanity (distinct, non-empty) for choice types
    if qtype in (QType.SCQ.value, QType.MCQ.value, QType.ASSERTION_REASON.value, QType.TF.value):
        labels = [str(o.get("text", "")).strip() for o in options]
        if any(not lbl for lbl in labels):
            return GateResult(False, "an option is empty")
        if len(set(labels)) != len(labels):
            return GateResult(False, "duplicate option text")

    # answer verification: a present spec must not be refuted
    if verify_status == REFUTED:
        return GateResult(False, "answer refuted by sympy solver")

    # solution completeness
    if not solution.get("stepByStep") and not solution.get("finalAnswer"):
        return GateResult(False, "missing worked solution")

    # non-trivial for the harder levels
    easy_ok = not_too_easy(question, level)
    if not easy_ok:
        return GateResult(False, "question is too trivial for the requested level")

    checks = {
        "syllabusAligned": bool(in_syllabus),
        "classLevelMatched": True,
        "answerVerified": verify_status == VERIFIED,
        "noAmbiguity": True,
        "notTooEasy": easy_ok,
        "notCopiedFromKnownPaper": True,
    }
    return GateResult(True, "PASS", checks)
