"""Phase C - Composite Assembly.

Multi-concept fusion is the hallmark of competitive (JEE/Olympiad) items. For
concepts calibrated at/above the composite threshold, we bundle the target
concept with its prerequisites and related concepts (from the knowledge graph)
into a problem spec the generator can turn into a multi-step item.

This step is deterministic graph traversal; the difficulty judgment that gates
it came from the LLM level calibration.
"""
from __future__ import annotations

from ..config import GenerationConfig
from ..models import CompositeSpec, Concept, LevelBand, LevelProfile
from ..utils import dedupe_preserve, stable_id

_BAND_RANK = {
    LevelBand.BEGINNER: 0,
    LevelBand.INTERMEDIATE: 1,
    LevelBand.ADVANCED: 2,
    LevelBand.JEE_MAIN: 3,
    LevelBand.JEE_ADVANCED: 4,
    LevelBand.EXPERT: 5,
    LevelBand.UNRATED: -1,
}


def run(
    concepts: list[Concept],
    level_profiles: list[LevelProfile],
    gen: GenerationConfig,
) -> list[CompositeSpec]:
    try:
        min_rank = _BAND_RANK[LevelBand(gen.composite_min_band)]
    except ValueError:
        min_rank = _BAND_RANK[LevelBand.JEE_MAIN]

    by_id = {c.concept_id: c for c in concepts}
    band_by_id = {p.concept_id: p.level_band for p in level_profiles}
    depth_by_id = {p.concept_id: p.prerequisite_depth for p in level_profiles}

    specs: list[CompositeSpec] = []
    for c in concepts:
        band = band_by_id.get(c.concept_id, LevelBand.UNRATED)
        if _BAND_RANK.get(band, -1) < min_rank:
            continue

        member_ids = dedupe_preserve(
            [c.concept_id] + c.prerequisites + c.related_concepts
        )
        member_ids = [m for m in member_ids if m in by_id][: gen.max_composite_members]
        if len(member_ids) < 2:  # a composite must fuse at least two concepts
            continue

        names = [by_id[m].concept_name for m in member_ids]
        specs.append(
            CompositeSpec(
                bundle_id=stable_id("bundle", c.concept_id, *member_ids),
                target_concept_id=c.concept_id,
                target_concept_name=c.concept_name,
                member_concept_ids=member_ids,
                member_concept_names=names,
                level_band=band,
                prerequisite_depth=depth_by_id.get(c.concept_id, 0),
                rationale=(
                    f"{band.value} item fusing {', '.join(names)} "
                    f"across topic '{c.topic}'."
                ),
            )
        )
    return specs
