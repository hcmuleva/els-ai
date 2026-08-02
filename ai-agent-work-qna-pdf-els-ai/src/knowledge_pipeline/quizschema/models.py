"""Pydantic models mirroring the supplied target quiz schema.

Extra fields beyond the original example (all additive, non-breaking):
  - question-level `question_svg` and `question_diagram`
  - per-option `svg`, `diagram`, `rationale`
  - `_meta` gains `level_band`, `bloom_level`, `concept_ids`, `topic`, `source`
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class Option(BaseModel):
    id: str
    label: str
    is_correct: bool = False
    slot_position: int = 1
    # additive fields for diagram-bearing options
    svg: Optional[str] = None
    diagram: Optional[Dict[str, Any]] = None
    rationale: Optional[str] = None


class QuestionMeta(BaseModel):
    subject: Optional[str] = None
    creatorId: Optional[str] = None
    classLevel: Optional[str] = None
    organizationId: Optional[str] = None
    # additive
    level_band: Optional[str] = None
    bloom_level: Optional[str] = None
    topic: Optional[str] = None
    concept_ids: List[str] = Field(default_factory=list)
    source: Optional[str] = None
    source_run_id: Optional[str] = None
    source_book_id: Optional[str] = None
    source_pages: List[int] = Field(default_factory=list)
    source_chunk_ids: List[str] = Field(default_factory=list)


class QuestionData(BaseModel):
    meta: QuestionMeta = Field(default_factory=QuestionMeta, alias="_meta")
    options: List[Option] = Field(default_factory=list)
    variant: str = "single_choice"
    # additive: stem diagram DSL (rendered form is `question_svg` at question level)
    diagram: Optional[Dict[str, Any]] = None

    model_config = {"populate_by_name": True}


class TargetQuestion(BaseModel):
    id: str
    quiz_id: Optional[str] = None
    quiz_title: str = "Question Bank"
    class_level: Optional[str] = None
    subject: Optional[str] = None
    quiz_type: str = "single_choice"
    question_type: str = "single_choice"
    question_title: str = ""
    question_instruction: str = "Choose one correct option."
    explanation: Optional[str] = None
    question_audio: Optional[str] = None
    time_limit_seconds: int = 30
    points: int = 10
    sort_order: Optional[int] = None
    question_data: QuestionData = Field(default_factory=QuestionData)
    created_at: Optional[str] = None
    # additive: rendered stem diagram
    question_svg: Optional[str] = None

    def wrapped(self) -> Dict[str, Any]:
        """Return the `{"question": {...}}` envelope matching the supplied example."""
        return {"question": self.model_dump(by_alias=True)}
