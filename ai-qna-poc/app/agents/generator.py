"""Generator agent.

Thin wrapper around the active LLM provider. Builds the generation context
from the request + parsed source and returns raw (book-format) questions.
"""
from __future__ import annotations

from typing import List, Optional

from app.providers import get_provider
from app.providers.base import GenerationContext, RawQuestion
from app.schemas import Difficulty, QuestionType


def generate(
    class_level: str,
    subject: str,
    difficulty: Difficulty,
    allowed_types: List[QuestionType],
    count: int,
    topic: Optional[str],
    seed: Optional[int],
    source_text: str,
    detected_topic: Optional[str] = None,
) -> List[RawQuestion]:
    provider = get_provider()
    ctx = GenerationContext(
        class_level=class_level,
        subject=subject,
        difficulty=difficulty,
        allowed_types=allowed_types,
        count=count,
        topic=topic,
        detected_topic=detected_topic,
        seed=seed,
        source_text=source_text,
    )
    return provider.generate(ctx)
