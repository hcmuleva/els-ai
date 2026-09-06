"""Validator agent.

Split into small, reusable pieces so the pipeline can interleave structural
checks with the deterministic verifier and the LLM critic:

* ``check_structure`` - validate one raw question (option counts, correct-option
  rules, non-empty text) and collect book-format math warnings.
* ``build_question`` - normalise one accepted raw question into the strict
  ``Question`` schema (ids, slot positions, answer key derived from the
  ``is_correct`` flags, sort order).
* ``validate`` - convenience wrapper that runs structure + build over a list
  (used by any caller that does not need verify/critic).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Tuple

from app.formatting.book_format import math_delimiters_balanced
from app.providers.base import RawQuestion
from app.schemas import (
    Difficulty,
    Option,
    Question,
    QuestionType,
    ValidationReport,
)


@dataclass
class StructResult:
    ok: bool
    reason: str = ""
    warnings: List[str] = field(default_factory=list)


def _coerce_type(value) -> QuestionType:
    return value if isinstance(value, QuestionType) else QuestionType(str(value))


def _coerce_difficulty(value, fallback: Difficulty) -> Difficulty:
    if value is None:
        return fallback
    return value if isinstance(value, Difficulty) else Difficulty(str(value))


def _option_objs(raw_options, prefix: str) -> List[Option]:
    options: List[Option] = []
    for idx, opt in enumerate(raw_options, start=1):
        options.append(
            Option(
                id=f"{prefix}_opt_{idx}",
                slot_position=idx,
                label_markdown=str(opt["label_md"]),
                is_correct=bool(opt["is_correct"]),
            )
        )
    return options


def _structurally_valid(qtype: QuestionType, raw_options) -> Tuple[bool, str]:
    correct = [o for o in raw_options if o.get("is_correct")]
    n = len(raw_options)
    if qtype == QuestionType.true_false:
        if n != 2:
            return False, "true_false must have exactly 2 options"
        if len(correct) != 1:
            return False, "true_false must have exactly 1 correct option"
    elif qtype == QuestionType.single_choice:
        if n < 2:
            return False, "single_choice needs at least 2 options"
        if len(correct) != 1:
            return False, "single_choice must have exactly 1 correct option"
    elif qtype == QuestionType.multi_choice:
        if n < 3:
            return False, "multi_choice needs at least 3 options"
        if len(correct) < 1:
            return False, "multi_choice must have at least 1 correct option"
    return True, ""


def check_structure(raw: RawQuestion) -> StructResult:
    """Validate one raw question. Returns ok/reason plus soft math warnings."""
    try:
        qtype = _coerce_type(raw["type"])
    except Exception:
        return StructResult(False, "unknown question type")

    raw_options = raw.get("options", [])
    ok, reason = _structurally_valid(qtype, raw_options)
    if not ok:
        return StructResult(False, reason)

    labels = [str(o.get("label_md", "")).strip() for o in raw_options]
    if len(labels) != len({lbl.replace(" ", "") for lbl in labels}):
        return StructResult(False, "duplicate option labels (ambiguous)")

    title = str(raw.get("title_md", "")).strip()
    explanation = str(raw.get("explanation_md", "")).strip()
    if not title:
        return StructResult(False, "missing title")
    if not explanation:
        return StructResult(False, "missing explanation")

    warnings: List[str] = []
    if not math_delimiters_balanced(title):
        warnings.append(f"unbalanced math in stem: {title[:60]}")
    if not math_delimiters_balanced(explanation):
        warnings.append(f"unbalanced math in explanation: {title[:60]}")
    for opt in raw_options:
        label = str(opt.get("label_md", ""))
        if not math_delimiters_balanced(label):
            warnings.append(f"unbalanced math in option: {label[:40]}")

    return StructResult(True, "", warnings)


def build_question(raw: RawQuestion, sort_order: int, default_difficulty: Difficulty) -> Question:
    """Normalise an accepted raw question into the strict ``Question`` schema."""
    qtype = _coerce_type(raw["type"])
    prefix = f"q{sort_order}"
    options = _option_objs(raw.get("options", []), prefix)
    q_difficulty = _coerce_difficulty(raw.get("difficulty"), default_difficulty)
    return Question(
        id=prefix,
        type=qtype,
        title_markdown=str(raw["title_md"]).strip(),
        instruction=str(raw.get("instruction", "")),
        difficulty=q_difficulty,
        points=10,
        sort_order=sort_order,
        options=options,
        answer_key=[o.id for o in options if o.is_correct],
        explanation_markdown=str(raw.get("explanation_md", "")).strip(),
        source_style_ref=str(raw.get("source_style_ref", "")),
    )


def validate(raw_items: List[RawQuestion], difficulty: Difficulty) -> Tuple[List[Question], ValidationReport]:
    """Structure + build over a list, without verify/critic. Kept for callers
    that do not need the full correctness pipeline."""
    warnings: List[str] = []
    seen = set()
    deduped = 0
    questions: List[Question] = []

    sort_order = 1
    for raw in raw_items:
        result = check_structure(raw)
        if not result.ok:
            warnings.append(f"dropped ({result.reason}): {str(raw.get('title_md',''))[:60]}")
            continue
        warnings.extend(result.warnings)

        key = (str(raw["title_md"]).strip(), _coerce_type(raw["type"]).value)
        if key in seen:
            deduped += 1
            continue
        seen.add(key)

        questions.append(build_question(raw, sort_order, difficulty))
        sort_order += 1

    report = ValidationReport(
        passed=len(questions) > 0,
        checks=[
            f"{len(questions)} questions passed structural validation",
            "answer keys derived from correct options",
            "book-format math delimiters checked",
        ],
        warnings=warnings,
        deduped=deduped,
    )
    return questions, report
