from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class ClassLevel(str, Enum):
    ten = "10"
    twelve = "12"


class Subject(str, Enum):
    physics = "physics"
    chemistry = "chemistry"
    mathematics = "mathematics"
    biology = "biology"


class Difficulty(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class QuestionType(str, Enum):
    single_choice = "single_choice"  # sc
    multi_choice = "multi_choice"    # mcq
    true_false = "true_false"        # tf


# Friendly aliases accepted on input and normalised to QuestionType.
TYPE_ALIASES = {
    "sc": QuestionType.single_choice,
    "single": QuestionType.single_choice,
    "single_choice": QuestionType.single_choice,
    "mcq": QuestionType.multi_choice,
    "multi": QuestionType.multi_choice,
    "multi_choice": QuestionType.multi_choice,
    "tf": QuestionType.true_false,
    "truefalse": QuestionType.true_false,
    "true_false": QuestionType.true_false,
}


class GenerateRequest(BaseModel):
    class_level: ClassLevel = Field(..., description="Target class: 10 or 12")
    subject: Subject = Field(..., description="physics | chemistry | mathematics | biology")
    difficulty: Difficulty = Field(default=Difficulty.medium)
    count: int = Field(default=10, ge=1, le=30, description="Number of questions to generate")
    types: List[str] = Field(
        default_factory=lambda: ["sc", "mcq", "tf"],
        description="Allowed question types (sc | mcq | tf or full names).",
    )
    topic: Optional[str] = Field(
        default=None,
        description="Optional topic hint. If omitted, it is inferred from the source paper.",
    )
    seed: Optional[int] = Field(
        default=None,
        description="Optional seed for reproducible generation.",
    )

    def normalized_types(self) -> List[QuestionType]:
        resolved: List[QuestionType] = []
        for raw in self.types:
            key = str(raw).strip().lower()
            qt = TYPE_ALIASES.get(key)
            if qt and qt not in resolved:
                resolved.append(qt)
        return resolved or [QuestionType.single_choice, QuestionType.multi_choice, QuestionType.true_false]


class Option(BaseModel):
    id: str
    slot_position: int
    label_markdown: str = Field(..., description="Book-format markdown (LaTeX allowed) for the option.")
    is_correct: bool


class Question(BaseModel):
    id: str
    type: QuestionType
    title_markdown: str = Field(..., description="Book-format markdown question stem (LaTeX allowed).")
    instruction: str
    difficulty: Difficulty
    points: int = 10
    sort_order: int
    options: List[Option]
    answer_key: List[str] = Field(..., description="IDs of the correct option(s).")
    explanation_markdown: str = Field(..., description="Book-format worked explanation (LaTeX allowed).")
    source_style_ref: str = Field(..., description="Which source paper style this was modelled on.")


class SourceInfo(BaseModel):
    mode: str = Field(..., description="live | sample")
    dataset: Optional[str] = None
    pdf_path: Optional[str] = None
    pdf_url: Optional[str] = None
    detected_topic: Optional[str] = None
    text_chars: int = 0
    note: Optional[str] = None


class ValidationReport(BaseModel):
    passed: bool
    checks: List[str]
    warnings: List[str]
    deduped: int
    verified: int = Field(default=0, description="Questions confirmed by the deterministic sympy verifier.")
    refuted: int = Field(default=0, description="Candidates dropped because verification/critic refuted them.")
    critic: str = Field(default="skipped", description="ran | skipped (skipped when no API key is set).")
    repaired: int = Field(default=0, description="Accepted questions produced during repair attempts.")
    attempts: int = Field(default=1, description="Number of generate+validate rounds used.")


class GenerateResponse(BaseModel):
    meta: dict
    source: SourceInfo
    validation: ValidationReport
    questions: List[Question]
