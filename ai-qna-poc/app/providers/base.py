from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.schemas import Difficulty, QuestionType


@dataclass
class GenerationContext:
    class_level: str
    subject: str
    difficulty: Difficulty
    allowed_types: List[QuestionType]
    count: int
    topic: Optional[str] = None  # explicit, user-requested topic (strict)
    detected_topic: Optional[str] = None  # inferred from the paper (soft hint)
    seed: Optional[int] = None
    source_text: str = ""


# Raw question shape returned by any provider. The pipeline normalises this
# into the strict `Question` schema (ids, slots, answer keys, sort order).
RawQuestion = Dict[str, object]


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    def generate(self, ctx: GenerationContext) -> List[RawQuestion]:
        """Return book-format raw questions for the given context."""
        raise NotImplementedError
