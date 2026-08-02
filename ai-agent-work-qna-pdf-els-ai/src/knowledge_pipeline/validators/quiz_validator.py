"""Production orchestration for deterministic STEM quiz and diagram validation."""
from __future__ import annotations

from typing import Any

from ..assessment.validation import validate_latex
from .answer_key_validator import validate_answer_key
from .common import CheckResult, options, result, unwrap_question
from .concept_extractor import extract_concept
from .diagram_label_validator import validate_diagram_labels
from .diagram_type_validator import validate_diagram_type
from .graph_validator import validate_graph
from .layout_validator import validate_layout
from .metadata_validator import validate_metadata
from .physics_formula_validator import validate_physics_formula
from .placeholder_validator import validate_placeholders
from .repair_instruction_generator import generate_repair_instructions
from .required_object_validator import validate_required_objects
from .rules import SCORE_WEIGHTS
from .svg_validator import validate_svg_content
from .static_engine_selector import select_static_engine


def _validate_question_latex(question: dict[str, Any]) -> CheckResult:
    raw = unwrap_question(question)
    fields = [
        str(raw.get("question_title") or ""),
        str(raw.get("explanation") or ""),
    ]
    for choice in options(question):
        fields.extend(
            [
                str(choice.get("label") or ""),
                str(choice.get("rationale") or ""),
            ]
        )
    issues = []
    for value in fields:
        valid, latex_issues = validate_latex(value)
        if not valid:
            issues.extend(latex_issues)
    return result(
        issues=issues,
        critical_failures=["invalid_latex"] if issues else [],
    )


def _score(checks: dict[str, CheckResult]) -> int:
    score = 0.0
    for name, weight in SCORE_WEIGHTS.items():
        check = checks[name]
        if check.status == "pass":
            score += weight
        elif check.status == "warning":
            score += weight * 0.8
    score -= sum(
        max(0, float(check.details.get("quality_penalty", 0)))
        for check in checks.values()
    )
    return max(0, min(100, round(score)))


def validate_question(
    question: dict[str, Any],
    *,
    quiz_subject: str | None = None,
    require_diagram: bool = False,
) -> dict[str, Any]:
    raw = unwrap_question(question)
    concept = extract_concept(question)
    checks: dict[str, CheckResult] = {}
    checks["metadata"] = validate_metadata(
        question, concept, quiz_subject=quiz_subject
    )
    checks["physics_correctness"] = validate_physics_formula(question, concept)
    checks["answer_key_consistency"] = validate_answer_key(question)
    checks["diagram_relevance"] = validate_diagram_type(
        question, concept, required=require_diagram
    )
    checks["diagram_required_objects"] = validate_required_objects(
        question, concept, required=require_diagram
    )
    checks["diagram_labels"] = validate_diagram_labels(question, concept)
    checks["graph_quality"] = validate_graph(question, concept)
    checks["svg_schema"] = validate_svg_content(
        question, concept, required=require_diagram
    )
    checks["layout_quality"] = validate_layout(question)
    checks["placeholder_detection"] = validate_placeholders(question)
    checks["latex"] = _validate_question_latex(question)

    score = _score(checks)
    critical_failures = sorted(
        {
            failure
            for check in checks.values()
            for failure in check.critical_failures
        }
    )
    failed_checks = [
        name for name, check in checks.items() if check.status == "fail"
    ]
    warning_checks = [
        name for name, check in checks.items() if check.status == "warning"
    ]

    if critical_failures or score < 60:
        decision = "reject"
        overall_status = "fail"
    elif failed_checks or score < 85:
        decision = "repair_required"
        overall_status = "warning"
    else:
        decision = "accept"
        overall_status = "warning" if warning_checks else "pass"

    serialized = {name: check.as_dict() for name, check in checks.items()}
    engine = select_static_engine(concept)
    repairs = generate_repair_instructions(concept, serialized)
    if decision == "accept":
        summary = (
            f"Accepted {concept.subject} question for concept "
            f"{concept.concept} with score {score}/100."
        )
    else:
        summary = (
            f"{decision.replace('_', ' ').title()}: "
            f"{len(failed_checks)} failed checks and "
            f"{len(critical_failures)} critical failures."
        )
    return {
        "question_id": raw.get("id"),
        "overall_status": overall_status,
        "score": score,
        "max_score": 100,
        "decision": decision,
        "summary": summary,
        "detected_subject": concept.subject,
        "detected_concept": concept.concept,
        **engine,
        "concept": concept.as_dict(),
        "critical_failures": critical_failures,
        "checks": serialized,
        "repair_instructions": repairs,
    }


class QuizValidator:
    def validate_question(
        self,
        question: dict[str, Any],
        *,
        quiz_subject: str | None = None,
        require_diagram: bool = False,
    ) -> dict[str, Any]:
        return validate_question(
            question,
            quiz_subject=quiz_subject,
            require_diagram=require_diagram,
        )

    def validate_quiz(
        self,
        quiz: dict[str, Any],
        *,
        require_diagram: bool = False,
    ) -> list[dict[str, Any]]:
        subject = quiz.get("subject")
        return [
            self.validate_question(
                wrapped,
                quiz_subject=subject,
                require_diagram=require_diagram,
            )
            for wrapped in quiz.get("questions", [])
            if isinstance(wrapped, dict)
        ]
