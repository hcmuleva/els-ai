"""Pipeline orchestrator.

Request -> Normalizer -> Syllabus Mapper -> Generator -> Solver/Verifier
        -> Quality Gate -> Builder -> Schema Validator -> response envelope.

The answer key always comes from the authored ``is_correct`` flags / numeric
answer, re-checked by sympy, never from free text.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from qfactory import builder, generator, quality_gate, solver, validator
from qfactory.normalizer import normalize_request
from qfactory.syllabus import in_scope, load_syllabus
from qfactory.types import Level


def run(raw_request: Dict[str, Any]) -> dict:
    req = normalize_request(raw_request)
    syllabus = load_syllabus()
    in_syll = in_scope(syllabus, req.class_level, req.subject, req.chapter, req.topic)

    candidates = generator.select(req)

    accepted: List[dict] = []
    warnings: List[str] = []
    verified = refuted = quality_failed = 0

    for item in candidates:
        if len(accepted) >= req.count:
            break

        spec = item.get("verification")
        vres = solver.verify(spec, builder.correct_option_texts(item), item.get("numericAnswer"))
        if vres.status == solver.VERIFIED:
            verified += 1
        elif vres.status == solver.REFUTED:
            refuted += 1

        item_level = Level(item.get("difficulty", Level.BOARD.value))
        gate = quality_gate.evaluate(item, item_level, vres.status, in_syll)
        if not gate.passed:
            quality_failed += 1
            warnings.append(f"dropped ({gate.reason}): {str(item.get('question',''))[:50]}")
            continue

        accepted.append(builder.to_output(item, len(accepted) + 1, req, gate.checks))

    questions = accepted[: req.count]
    schema_ok, schema_errors = validator.validate_response({
        "metadata": {"class": req.class_level, "subject": req.subject,
                     "difficulty": req.difficulty.value, "totalQuestions": len(questions)},
        "questions": questions,
    })
    warnings.extend(f"schema: {e}" for e in schema_errors)

    checks = [
        f"{len(questions)} questions passed structural + quality-gate validation",
        "answer keys derived from verified correct options / numeric answers",
        f"{verified} independently verified by sympy",
        f"{quality_failed} candidates rejected by the quality gate",
        "syllabus scope " + ("matched" if in_syll else "NOT matched (soft warning)"),
    ]
    if not in_syll:
        warnings.append("requested chapter/topic not found in the loaded syllabus map")

    metadata = {
        "class": req.class_level,
        "subject": req.subject,
        "chapter": req.chapter,
        "topic": req.topic,
        "difficulty": req.difficulty.value,
        "questionSetType": "Practice",
        "totalQuestions": len(questions),
        "requestedCount": req.count,
        "questionTypes": [t.value for t in req.question_types],
        "provider": "droid-authored-offline",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }

    validation = {
        "passed": len(questions) > 0 and schema_ok,
        "schemaValid": schema_ok,
        "totalAccepted": len(questions),
        "verified": verified,
        "refuted": refuted,
        "qualityRejected": quality_failed,
        "checks": checks,
        "warnings": warnings,
    }

    return {"metadata": metadata, "validation": validation, "questions": questions}
