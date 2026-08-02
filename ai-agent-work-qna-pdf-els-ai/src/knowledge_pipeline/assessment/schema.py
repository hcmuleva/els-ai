"""Pydantic models for the rich assessment JSON contract."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AssessmentMetadata(BaseModel):
    grade: str = ""
    topic: str = ""
    subTopic: str = ""
    difficulty: str = ""
    bloomLevel: str = ""
    estimatedTime: str = ""
    questionType: str = ""


class QuestionObject(BaseModel):
    questionText: str = ""
    equationLatex: str = ""
    diagramRequired: bool = False
    diagramType: str = ""
    diagramSvg: str = ""
    diagramSpec: Optional[Dict[str, Any]] = None
    accessibilityAltText: str = ""


class AssessmentOption(BaseModel):
    id: str
    type: str = "text"           # "text" | "svg"
    value: str = ""


class VerifySpec(BaseModel):
    """Optional machine-checkable answer verification (SymPy)."""
    kind: str = "none"           # "solve" | "evaluate" | "equal" | "none"
    expr: Optional[str] = None   # python-syntax expr (solve: =0; evaluate: value)
    var: Optional[str] = "x"
    lhs: Optional[str] = None    # for kind == "equal"
    rhs: Optional[str] = None
    expected: Optional[str] = None  # comma-separated roots, or a numeric string


class AnswerObject(BaseModel):
    correctOptionId: str = ""
    value: str = ""
    verify: Optional[VerifySpec] = None


class ExplanationStep(BaseModel):
    step: int = 0
    reasoning: str = ""
    svg: Optional[str] = None


class ValidationReport(BaseModel):
    questionValid: bool = False
    equationValid: bool = False
    svgValid: bool = False
    answerVerified: bool = False
    diagramVerified: bool = False
    qualityScore: int = 0
    status: str = "FAILED"       # "PASSED" | "FAILED"
    issues: List[str] = Field(default_factory=list)


class Assessment(BaseModel):
    metadata: AssessmentMetadata = Field(default_factory=AssessmentMetadata)
    question: QuestionObject = Field(default_factory=QuestionObject)
    options: List[AssessmentOption] = Field(default_factory=list)
    answer: AnswerObject = Field(default_factory=AnswerObject)
    explanation: List[ExplanationStep] = Field(default_factory=list)
    validation: ValidationReport = Field(default_factory=ValidationReport)
