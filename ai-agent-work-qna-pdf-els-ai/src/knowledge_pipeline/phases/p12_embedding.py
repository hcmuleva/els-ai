"""Phase 12 - Embedding Preparation and Phase 13 - Semantic Chunking.

No embeddings are created here. We produce embedding-ready payloads and
self-contained semantic chunks (never page/token based). Every chunk answers:
what is it, why it matters, how it works, an example, and an assessment opportunity.
"""
from __future__ import annotations

from collections import defaultdict

from typing import Optional

from ..models import (
    AssessmentProfile,
    Chunk,
    Concept,
    EmbeddingUnit,
    LearningObjective,
    LevelProfile,
    Misconception,
)
from ..utils import normalize_ws, stable_id


def _level_index(levels: Optional[list[LevelProfile]]) -> dict[str, LevelProfile]:
    return {p.concept_id: p for p in (levels or [])}


# ----------------------------------------------------------------- phase 12
def build_embedding_units(
    concepts: list[Concept],
    objectives: list[LearningObjective],
    misconceptions: list[Misconception],
    profiles: list[AssessmentProfile],
    levels: Optional[list[LevelProfile]] = None,
) -> list[EmbeddingUnit]:
    level_by_id = _level_index(levels)
    obj_by_concept: dict[str, list[str]] = defaultdict(list)
    for o in objectives:
        obj_by_concept[o.concept_id].append(f"[{o.bloom_level.value}] {o.objective}")
    misc_by_concept: dict[str, list[str]] = defaultdict(list)
    for m in misconceptions:
        misc_by_concept[m.concept_id].append(m.misconception)
    rec_by_concept = {p.concept_id: p.recommended_types for p in profiles}

    units: list[EmbeddingUnit] = []
    for c in concepts:
        units.append(
            EmbeddingUnit(
                concept_id=c.concept_id,
                concept=c.concept_name,
                description=c.description or c.definition,
                learning_objectives=obj_by_concept.get(c.concept_id, []),
                misconceptions=misc_by_concept.get(c.concept_id, []),
                examples=c.examples,
                assessment_candidates=rec_by_concept.get(c.concept_id, []),
                metadata={
                    "book_id": c.book_id,
                    "source_pages": c.source_pages,
                    "topic": c.topic,
                    "subtopic": c.subtopic,
                    "concept_type": c.concept_type.value,
                    "difficulty": c.difficulty.value,
                    "level_band": _band(level_by_id, c.concept_id),
                    "level_confidence": _band_conf(level_by_id, c.concept_id),
                    "importance_score": round(c.importance_score, 3),
                    "confidence_score": round(c.confidence_score, 3),
                    "prerequisites": c.prerequisites,
                    "related_concepts": c.related_concepts,
                },
            )
        )
    return units


# ----------------------------------------------------------------- phase 13
def build_chunks(
    concepts: list[Concept],
    objectives: list[LearningObjective],
    profiles: list[AssessmentProfile],
    max_chars: int,
    levels: Optional[list[LevelProfile]] = None,
) -> list[Chunk]:
    rec_by_concept = {p.concept_id: p.recommended_types for p in profiles}
    name_by_id = {c.concept_id: c.concept_name for c in concepts}
    level_by_id = _level_index(levels)

    chunks: list[Chunk] = []
    for c in concepts:
        assessment_hint = ", ".join(rec_by_concept.get(c.concept_id, [])) or "Short Answer"

        # 1) primary concept chunk
        chunks.append(
            _make_chunk(
                concept=c,
                chunk_type="concept",
                title=c.concept_name,
                what=c.definition or c.description,
                why=_why(c, name_by_id),
                how=_how(c),
                example=c.examples[0] if c.examples else _fallback_example(c),
                assessment=f"Suitable assessment: {assessment_hint}.",
                max_chars=max_chars,
            )
        )

        # 2) structural chunks: frameworks / processes / formulae / case studies
        for kind, items in (
            ("framework", c.frameworks),
            ("process", c.processes),
            ("formula", c.formulae),
            ("case_study", c.case_studies),
        ):
            for i, item in enumerate(items):
                chunks.append(
                    _make_chunk(
                        concept=c,
                        chunk_type=kind,
                        title=f"{c.concept_name} - {kind.replace('_', ' ')} {i + 1}",
                        what=item,
                        why=f"This {kind.replace('_', ' ')} operationalizes {c.concept_name}.",
                        how=item,
                        example=c.examples[0] if c.examples else "",
                        assessment=f"Best assessed via: {assessment_hint}.",
                        max_chars=max_chars,
                    )
                )

    # attach level metadata (LLM-assigned; may be 'unrated' offline)
    for ch in chunks:
        ch.metadata["level_band"] = _band(level_by_id, ch.concept_id)
        ch.metadata["level_confidence"] = _band_conf(level_by_id, ch.concept_id)
    return chunks


def _band(level_by_id: dict[str, LevelProfile], concept_id: str) -> str:
    p = level_by_id.get(concept_id)
    return p.level_band.value if p else "unrated"


def _band_conf(level_by_id: dict[str, LevelProfile], concept_id: str) -> float:
    p = level_by_id.get(concept_id)
    return round(p.confidence, 3) if p else 0.0


def _why(c: Concept, name_by_id: dict[str, str]) -> str:
    related_names = [name_by_id.get(rid, "") for rid in c.related_concepts[:3]]
    related_names = [n for n in related_names if n]
    supports = ", ".join(related_names) if related_names else "further concepts in this topic"
    return (
        f"{c.concept_name} is categorized as a {c.difficulty.value}-level "
        f"{c.concept_type.value} within {c.topic or 'this subject'}; "
        f"mastering it supports {supports}."
    )


def _how(c: Concept) -> str:
    if c.processes:
        return c.processes[0]
    if c.formulae:
        return f"Apply: {c.formulae[0]}"
    if c.frameworks:
        return c.frameworks[0]
    if c.facts:
        return c.facts[0]
    return c.definition or "See definition."


def _fallback_example(c: Concept) -> str:
    if c.case_studies:
        return c.case_studies[0]
    if c.facts:
        return c.facts[0]
    return f"Consider how {c.concept_name} appears in a typical {c.topic or 'course'} problem."


def _make_chunk(
    concept: Concept,
    chunk_type: str,
    title: str,
    what: str,
    why: str,
    how: str,
    example: str,
    assessment: str,
    max_chars: int,
) -> Chunk:
    sections = [
        f"CONCEPT: {concept.concept_name}",
        f"WHAT: {normalize_ws(what)}",
        f"WHY IT MATTERS: {normalize_ws(why)}",
        f"HOW IT WORKS: {normalize_ws(how)}",
    ]
    if example:
        sections.append(f"EXAMPLE: {normalize_ws(example)}")
    sections.append(f"ASSESSMENT OPPORTUNITY: {normalize_ws(assessment)}")
    text = "\n".join(sections)

    return Chunk(
        chunk_id=stable_id("chunk", concept.concept_id, chunk_type, title),
        concept_id=concept.concept_id,
        chunk_type=chunk_type,
        title=title,
        what=normalize_ws(what),
        why=normalize_ws(why),
        how=normalize_ws(how),
        example=normalize_ws(example),
        assessment_opportunity=normalize_ws(assessment),
        text=text,
        metadata={
            "book_id": concept.book_id,
            "source_pages": concept.source_pages,
            "topic": concept.topic,
            "subtopic": concept.subtopic,
            "concept_type": concept.concept_type.value,
            "difficulty": concept.difficulty.value,
        },
    )
