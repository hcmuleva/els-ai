"""Accuracy sweep for the QnA pipeline.

Runs many (class, subject, difficulty, types) combinations through the full
pipeline (offline, sample mode) and measures:

* coverage      - returned / requested questions
* verifier acc. - deterministic sympy verdicts: verified / (verified + refuted)
                  measured over ALL candidates the pipeline saw during the run
* latex_ok      - every title / option / explanation has balanced $...$ / $$...$$
* key_ok        - every question exposes a non-empty answer key whose ids match
                  the options flagged correct

Run:  ./.venv/bin/python scripts/accuracy_report.py
"""
from __future__ import annotations

import itertools
import os
import sys

os.environ.setdefault("PDF_SOURCE_MODE", "sample")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.formatting.book_format import math_delimiters_balanced  # noqa: E402
from app.pipeline import run  # noqa: E402
from app.schemas import (  # noqa: E402
    ClassLevel,
    Difficulty,
    GenerateRequest,
    Subject,
)

E, M, H = Difficulty.easy, Difficulty.medium, Difficulty.hard
ALL = ["sc", "mcq", "tf"]

CLASSES = [ClassLevel.ten, ClassLevel.twelve]
SUBJECTS = [Subject.physics, Subject.chemistry, Subject.mathematics, Subject.biology]
DIFFS = [E, M, H]


def _build_combos():
    combos = []
    # 1) full-type sweep over every class x subject x difficulty (24)
    for cls, sub, diff in itertools.product(CLASSES, SUBJECTS, DIFFS):
        combos.append((cls, sub, diff, ALL, 10))
    # 2) single-type sweep at medium over every class x subject (24)
    for cls, sub, types in itertools.product(CLASSES, SUBJECTS, [["sc"], ["mcq"], ["tf"]]):
        combos.append((cls, sub, M, types, 8))
    # 3) a couple of larger numeric-heavy requests (2) -> 50 total
    combos.append((ClassLevel.twelve, Subject.mathematics, H, ["sc"], 15))
    combos.append((ClassLevel.ten, Subject.physics, M, ["sc"], 15))
    return combos[:50]


COMBOS = _build_combos()


def _latex_ok(q) -> bool:
    if not math_delimiters_balanced(q.title_markdown):
        return False
    if not math_delimiters_balanced(q.explanation_markdown):
        return False
    return all(math_delimiters_balanced(o.label_markdown) for o in q.options)


def _key_ok(q) -> bool:
    correct_ids = {o.id for o in q.options if o.is_correct}
    return bool(q.answer_key) and correct_ids == set(q.answer_key)


def main() -> None:
    header = (
        f"{'class':>5} {'subject':<12} {'diff':<6} {'types':<12} "
        f"{'req':>3} {'ret':>3} {'verif':>5} {'refut':>5} {'latex':>5} {'key':>4} {'warn':>4}"
    )
    print(header)
    print("-" * len(header))

    tot_req = tot_ret = tot_verif = tot_refut = tot_latex = tot_key = tot_warn = 0
    base_seed = 20260620

    for idx, (cls, sub, diff, types, count) in enumerate(COMBOS):
        resp = run(
            GenerateRequest(
                class_level=cls, subject=sub, difficulty=diff,
                types=types, count=count, seed=base_seed + idx,  # vary seed per test
            )
        )
        v = resp.validation
        latex_ok = sum(1 for q in resp.questions if _latex_ok(q))
        key_ok = sum(1 for q in resp.questions if _key_ok(q))
        ret = len(resp.questions)

        print(
            f"{cls.value:>5} {sub.value:<12} {diff.value:<6} {','.join(types):<12} "
            f"{count:>3} {ret:>3} {v.verified:>5} {v.refuted:>5} "
            f"{latex_ok:>5} {key_ok:>4} {len(v.warnings):>4}"
        )

        tot_req += count
        tot_ret += ret
        tot_verif += v.verified
        tot_refut += v.refuted
        tot_latex += latex_ok
        tot_key += key_ok
        tot_warn += len(v.warnings)

    print("-" * len(header))
    checkable = tot_verif + tot_refut
    verif_acc = (tot_verif / checkable * 100) if checkable else 100.0
    print(f"combos: {len(COMBOS)}")
    print(f"requested: {tot_req}   returned: {tot_ret}   coverage: {tot_ret/tot_req*100:.1f}%")
    print(f"deterministically checkable candidates: {checkable}")
    print(f"verifier accuracy (verified / checkable): {tot_verif}/{checkable} = {verif_acc:.1f}%")
    print(f"refuted (caught & dropped, NOT in final output): {tot_refut}")
    print(f"latex_ok: {tot_latex}/{tot_ret} = {tot_latex/tot_ret*100:.1f}%")
    print(f"answer_key_ok: {tot_key}/{tot_ret} = {tot_key/tot_ret*100:.1f}%")
    print(f"total warnings: {tot_warn}")


if __name__ == "__main__":
    main()
