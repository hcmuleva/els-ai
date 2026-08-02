"""Map an internal generated question into the target quiz schema.

Internal item shape (all optional unless noted):
  stem (required), instruction, question_diagram, explanation, level_band,
  bloom_level, concept_ids, topic, source, points, time_limit_seconds,
  options: [{label (required), is_correct, diagram, rationale}]
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ..config import IdentityConfig
from ..diagram.dsl import DiagramSpec
from ..rendering.svg import render_svg
from .models import Option, QuestionData, QuestionMeta, TargetQuestion

_NS = uuid.UUID("1b671a64-40d5-491e-99b0-da01ff1f3341")
_SLUG_RE = re.compile(r"[^a-zA-Z0-9]+")


def _slug(text: str, limit: int = 24) -> str:
    s = _SLUG_RE.sub("_", text.strip()).strip("_")
    return (s[:limit] or "opt").rstrip("_")


def _render_diagram(value: Any) -> tuple[Optional[str], Optional[Dict[str, Any]]]:
    if value is None:
        return None, None
    spec = value if isinstance(value, DiagramSpec) else DiagramSpec.model_validate(value)
    return render_svg(spec), spec.model_dump()


def to_target_question(
    item: Dict[str, Any],
    identity: IdentityConfig,
    quiz_id: Optional[str] = None,
    quiz_title: str = "Question Bank",
    question_id: Optional[str] = None,
    created_at: Optional[str] = None,
    sort_order: Optional[int] = None,
) -> TargetQuestion:
    raw_options = item.get("options") or []
    correct_count = sum(1 for o in raw_options if o.get("is_correct"))
    variant = "multi_choice" if correct_count > 1 else "single_choice"

    q_svg, q_dsl = _render_diagram(item.get("question_diagram"))

    options: List[Option] = []
    for i, o in enumerate(raw_options, start=1):
        o_svg, o_dsl = _render_diagram(o.get("diagram"))
        label = str(o.get("label", ""))
        options.append(
            Option(
                id=f"{_slug(label)}_{i}",
                label=label,
                is_correct=bool(o.get("is_correct")),
                slot_position=i,
                svg=o_svg,
                diagram=o_dsl,
                rationale=o.get("rationale"),
            )
        )

    meta = QuestionMeta(
        subject=item.get("subject") or identity.subject,
        creatorId=identity.creator_id,
        classLevel=item.get("class_level") or identity.class_level,
        organizationId=identity.organization_id,
        level_band=item.get("level_band"),
        bloom_level=item.get("bloom_level"),
        topic=item.get("topic"),
        concept_ids=list(item.get("concept_ids") or []),
        source=item.get("source"),
        source_run_id=item.get("source_run_id"),
        source_book_id=item.get("source_book_id"),
        source_pages=list(item.get("source_pages") or []),
        source_chunk_ids=list(item.get("source_chunk_ids") or []),
    )

    stem = str(item.get("stem", ""))
    if question_id is None:
        key = (
            (quiz_id or "")
            + "|"
            + stem
            + "|"
            + "|".join(o.label for o in options)
            + "|"
            + (item.get("source") or "")
        )
        question_id = str(uuid.uuid5(_NS, key))
    instruction = item.get("instruction") or (
        "Choose all correct options." if variant == "multi_choice" else "Choose one correct option."
    )

    return TargetQuestion(
        id=question_id,
        quiz_id=quiz_id,
        quiz_title=quiz_title,
        class_level=item.get("class_level") or identity.class_level,
        subject=item.get("subject") or identity.subject,
        quiz_type=variant,
        question_type=variant,
        question_title=stem,
        question_instruction=instruction,
        explanation=item.get("explanation"),
        time_limit_seconds=int(item.get("time_limit_seconds", 30)),
        points=int(item.get("points", 10)),
        sort_order=sort_order,
        question_svg=q_svg,
        question_data=QuestionData(_meta=meta, options=options, variant=variant, diagram=q_dsl),
        created_at=created_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    )
