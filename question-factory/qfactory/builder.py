"""Builder: convert an internal bank item into the spec-shaped output question.

Output keeps POC 1's spirit but adopts the spec's per-question fields:
id, questionType, difficulty, bloomLevel, marks, chapter, topic, question,
options[{key,text}], correctAnswer, solution{...}, qualityChecks, tags.
"""
from __future__ import annotations

from typing import Dict, List, Union

from qfactory.calibrator import default_bloom, default_marks
from qfactory.types import LEVEL_CODE, SUBJECT_CODE, Level, QFRequest, QType

_KEYS = ["A", "B", "C", "D", "E", "F"]


def _fmt_num(v) -> str:
    try:
        f = float(v)
        return str(int(f)) if f == int(f) else str(f)
    except (TypeError, ValueError):
        return str(v)


def _chapter_code(chapter: str) -> str:
    code = "".join(c for c in (chapter or "").upper() if c.isalnum())[:14]
    return code or "GEN"


def _make_id(item: dict, level: Level, idx: int) -> str:
    subj = SUBJECT_CODE.get(item.get("subject", ""), "GEN")
    return f"{subj}{item.get('class_level','')}_{_chapter_code(item.get('chapter',''))}_{LEVEL_CODE[level]}_{idx:03d}"


def correct_option_texts(item: dict) -> List[str]:
    return [str(o.get("text", "")) for o in item.get("options", []) if o.get("is_correct")]


def to_output(item: dict, idx: int, req: QFRequest, gate_checks: Dict[str, bool]) -> dict:
    qtype = item.get("questionType")
    level = Level(item.get("difficulty", Level.BOARD.value))

    options: List[dict] = []
    correct_keys: List[str] = []
    for i, o in enumerate(item.get("options", [])):
        if i >= len(_KEYS):
            break
        key = _KEYS[i]
        options.append({"key": key, "text": str(o.get("text", ""))})
        if o.get("is_correct"):
            correct_keys.append(key)

    correct: Union[str, List[str]]
    if qtype == QType.NUMERICAL.value:
        correct = _fmt_num(item.get("numericAnswer"))
        options = []
    elif qtype == QType.MCQ.value:
        correct = correct_keys
    elif qtype == QType.TF.value:
        is_true = any(
            o.get("is_correct") and str(o.get("text", "")).strip().lower().startswith("true")
            for o in item.get("options", [])
        )
        correct = "true" if is_true else "false"
    else:  # SCQ, AssertionReason
        correct = correct_keys[0] if correct_keys else ""

    q: Dict[str, object] = {
        "id": _make_id(item, level, idx),
        "questionType": qtype,
        "difficulty": level.value,
    }
    if req.include_bloom:
        q["bloomLevel"] = item.get("bloomLevel") or default_bloom(level)
    if req.include_marks:
        q["marks"] = item.get("marks") or default_marks(level)
    q["chapter"] = item.get("chapter", "")
    q["topic"] = item.get("topic", "")
    q["question"] = item.get("question", "")
    q["options"] = options
    q["correctAnswer"] = correct
    if req.include_solutions:
        sol = item.get("solution") or {}
        q["solution"] = {
            "finalAnswer": sol.get("finalAnswer", ""),
            "stepByStep": sol.get("stepByStep", []),
            "formulaUsed": sol.get("formulaUsed", []),
            "commonMistake": sol.get("commonMistake", ""),
            "examinerNote": sol.get("examinerNote", ""),
        }
    q["qualityChecks"] = gate_checks
    q["tags"] = item.get("tags", [])
    return q
