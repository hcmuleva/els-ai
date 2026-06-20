"""Schema Validator: final structural audit of the output payload.

Lightweight (no external deps): checks required envelope keys and, per question,
that ``correctAnswer`` is consistent with the declared type and options.
"""
from __future__ import annotations

from typing import List, Tuple

from qfactory.types import QType

_META_KEYS = {"class", "subject", "difficulty", "totalQuestions"}
_Q_KEYS = {"id", "questionType", "difficulty", "chapter", "topic", "question", "options", "correctAnswer"}


def _question_errors(q: dict, n: int) -> List[str]:
    errs: List[str] = []
    missing = _Q_KEYS - set(q.keys())
    if missing:
        errs.append(f"Q{n}: missing keys {sorted(missing)}")
        return errs

    qtype = q.get("questionType")
    options = q.get("options", [])
    keys = [o.get("key") for o in options]
    ans = q.get("correctAnswer")

    if qtype == QType.NUMERICAL.value:
        if options:
            errs.append(f"Q{n}: Numerical must have no options")
        try:
            float(ans)
        except (TypeError, ValueError):
            errs.append(f"Q{n}: Numerical correctAnswer '{ans}' is not a number")
    elif qtype == QType.MCQ.value:
        if not isinstance(ans, list) or len(ans) < 2:
            errs.append(f"Q{n}: MCQ correctAnswer must be a list of >=2 keys")
        elif any(a not in keys for a in ans):
            errs.append(f"Q{n}: MCQ correctAnswer {ans} not all in {keys}")
    elif qtype == QType.TF.value:
        if str(ans).lower() not in ("true", "false"):
            errs.append(f"Q{n}: TF correctAnswer must be true/false")
    elif qtype in (QType.SCQ.value, QType.ASSERTION_REASON.value):
        if ans not in keys:
            errs.append(f"Q{n}: {qtype} correctAnswer '{ans}' not in {keys}")
    else:
        errs.append(f"Q{n}: unsupported questionType '{qtype}'")
    return errs


def validate_response(resp: dict) -> Tuple[bool, List[str]]:
    errors: List[str] = []
    meta = resp.get("metadata", {})
    missing_meta = _META_KEYS - set(meta.keys())
    if missing_meta:
        errors.append(f"metadata missing keys {sorted(missing_meta)}")
    for i, q in enumerate(resp.get("questions", []), 1):
        errors.extend(_question_errors(q, i))
    return (len(errors) == 0, errors)
