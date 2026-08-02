"""Target quiz JSON schema (as supplied) + adapter from internal questions."""
from __future__ import annotations

from .adapter import to_target_question
from .models import Option, QuestionData, QuestionMeta, TargetQuestion

__all__ = ["TargetQuestion", "QuestionData", "QuestionMeta", "Option", "to_target_question"]
