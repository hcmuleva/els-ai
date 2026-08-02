"""Phase 15 - Level-Aware Question Generation.

Generates assessment items calibrated to each concept's LLM-assigned level band.
- Bands below the composite threshold -> single-concept items.
- Bands at/above the threshold      -> multi-concept items from composite bundles.
Backend priority is local-first (set by provider resolution); every generation
carries the backend that produced it in `source`.
"""
from __future__ import annotations

from collections import defaultdict

from ..config import GenerationConfig
from ..extractors.base import KnowledgeExtractor
from ..models import (
    AssessmentProfile,
    CompositeSpec,
    Concept,
    GeneratedQuestion,
    LevelBand,
    LevelProfile,
    Misconception,
)
from ..utils import stable_id
from .p_composite import _BAND_RANK

_BAND_BLOOM = {
    LevelBand.BEGINNER: "Remember",
    LevelBand.INTERMEDIATE: "Understand",
    LevelBand.ADVANCED: "Apply",
    LevelBand.JEE_MAIN: "Analyze",
    LevelBand.JEE_ADVANCED: "Evaluate",
    LevelBand.EXPERT: "Create",
    LevelBand.UNRATED: "Understand",
}
_BAND_FORMAT = {
    LevelBand.BEGINNER: "MCQ",
    LevelBand.INTERMEDIATE: "MCQ",
    LevelBand.ADVANCED: "Problem Solving",
    LevelBand.JEE_MAIN: "Problem Solving",
    LevelBand.JEE_ADVANCED: "Scenario",
    LevelBand.EXPERT: "Essay",
    LevelBand.UNRATED: "MCQ",
}


def run(
    concepts: list[Concept],
    level_profiles: list[LevelProfile],
    misconceptions: list[Misconception],
    assessments: list[AssessmentProfile],
    composites: list[CompositeSpec],
    extractor: KnowledgeExtractor,
    gen: GenerationConfig,
) -> list[GeneratedQuestion]:
    if not gen.enabled:
        return []

    by_id = {c.concept_id: c for c in concepts}
    band_by_id = {p.concept_id: p.level_band for p in level_profiles}
    misc_by_id: dict[str, list[str]] = defaultdict(list)
    for m in misconceptions:
        misc_by_id[m.concept_id].append(m.misconception)
    rec_by_id = {a.concept_id: a.recommended_types for a in assessments}

    allowed_bands = set(gen.bands)
    try:
        min_rank = _BAND_RANK[LevelBand(gen.composite_min_band)]
    except ValueError:
        min_rank = _BAND_RANK[LevelBand.JEE_MAIN]

    questions: list[GeneratedQuestion] = []

    # ---- single-concept items (bands below composite threshold, or unrated)
    for c in concepts:
        band = band_by_id.get(c.concept_id, LevelBand.UNRATED)
        if band.value not in allowed_bands and band != LevelBand.UNRATED:
            continue
        if _BAND_RANK.get(band, -1) >= min_rank and band != LevelBand.UNRATED:
            continue  # handled as composite
        atype = (rec_by_id.get(c.concept_id) or [_BAND_FORMAT[band]])[0]
        spec = {
            "level_band": band.value,
            "bloom_level": _BAND_BLOOM[band],
            "assessment_type": atype,
            "composite": False,
            "concepts": [_concept_payload(c)],
            "misconceptions": misc_by_id.get(c.concept_id, []),
        }
        _emit(questions, extractor, spec, band, [c.concept_id], [c.concept_name], gen)

    # ---- multi-concept items (composite bundles at competitive/expert bands)
    for spec_c in composites:
        band = spec_c.level_band
        if band.value not in allowed_bands:
            continue
        members = [by_id[m] for m in spec_c.member_concept_ids if m in by_id]
        misc: list[str] = []
        for m in members:
            misc.extend(misc_by_id.get(m.concept_id, [])[:1])
        spec = {
            "level_band": band.value,
            "bloom_level": _BAND_BLOOM[band],
            "assessment_type": _BAND_FORMAT[band],
            "composite": True,
            "concepts": [_concept_payload(m) for m in members],
            "misconceptions": misc,
        }
        _emit(
            questions, extractor, spec, band,
            spec_c.member_concept_ids, spec_c.member_concept_names, gen,
            bundle_id=spec_c.bundle_id,
        )

    return questions


def _emit(questions, extractor, spec, band, concept_ids, concept_names, gen, bundle_id=""):
    for i in range(max(1, gen.questions_per_item)):
        result = extractor.generate_question(spec)
        if not result:
            return  # unsupported (e.g. offline competitive item) -> never faked
        seed = bundle_id or concept_ids[0]
        questions.append(
            GeneratedQuestion(
                question_id=stable_id("q", seed, band.value, i),
                level_band=band,
                bloom_level=spec["bloom_level"],
                assessment_type=spec["assessment_type"],
                concept_ids=list(concept_ids),
                concept_names=list(concept_names),
                stem=result.get("stem", ""),
                options=result.get("options", []),
                correct_answer=result.get("correct_answer", ""),
                distractors=result.get("distractors", []),
                worked_solution=result.get("worked_solution", ""),
                source=result.get("source", "template_fallback"),
                metadata={"composite": spec["composite"], "num_concepts": len(concept_ids)},
            )
        )


def _concept_payload(c: Concept) -> dict:
    return {
        "name": c.concept_name,
        "definition": c.definition or c.description,
        "examples": c.examples,
    }
