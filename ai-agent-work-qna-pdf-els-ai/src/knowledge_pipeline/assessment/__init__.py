"""Rich, self-validating assessment generation contract.

Produces the metadata/question/options/answer/explanation/validation JSON with a
full validation report (LaTeX, SVG, SymPy answer verification, quality score).
"""
from .schema import (
    Assessment,
    AssessmentMetadata,
    AssessmentOption,
    AnswerObject,
    ExplanationStep,
    QuestionObject,
    ValidationReport,
    VerifySpec,
)
from .validation import run_validation
from .generator import AssessmentGenerator

__all__ = [
    "Assessment",
    "AssessmentMetadata",
    "AssessmentOption",
    "AnswerObject",
    "ExplanationStep",
    "QuestionObject",
    "ValidationReport",
    "VerifySpec",
    "run_validation",
    "AssessmentGenerator",
]
