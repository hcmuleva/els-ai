"""Phase L - Level Calibration (LLM-driven).

Content difficulty is a semantic judgment, so the level band is assigned by the
LLM backend. Prerequisite depth (a factual graph property) is computed here and
passed in as context. When no LLM is reachable, items are marked 'unrated'
(never faked), per the configured offline behavior.
"""
from __future__ import annotations

from ..extractors.base import KnowledgeExtractor
from ..models import Concept, LevelBand, LevelProfile


def run(concepts: list[Concept], extractor: KnowledgeExtractor) -> list[LevelProfile]:
    depths = _prerequisite_depths(concepts)
    profiles: list[LevelProfile] = []

    for c in concepts:
        payload = {
            "concept_name": c.concept_name,
            "definition": c.definition or c.description,
            "concept_type": c.concept_type.value,
            "topic": c.topic,
            "difficulty": c.difficulty.value,
            "prerequisite_depth": depths.get(c.concept_id, 0),
            "facts": c.facts,
            "formulae": c.formulae,
        }
        verdict = extractor.assess_level(payload)
        band = _coerce_band(verdict.get("level_band", "unrated"))
        source = extractor.name if band != LevelBand.UNRATED else "none"

        profiles.append(
            LevelProfile(
                concept_id=c.concept_id,
                concept_name=c.concept_name,
                level_band=band,
                intrinsic_difficulty=verdict.get("intrinsic_difficulty", "unknown"),
                reasoning_level=verdict.get("reasoning_level", ""),
                steps_required=int(verdict.get("steps_required", 0) or 0),
                concepts_combined=int(verdict.get("concepts_combined", 1) or 1),
                prerequisite_depth=depths.get(c.concept_id, 0),
                confidence=float(verdict.get("confidence", 0.0) or 0.0),
                level_source=source,
                rationale=verdict.get("rationale", ""),
            )
        )
    return profiles


def _coerce_band(value: str) -> LevelBand:
    try:
        return LevelBand(str(value).strip().lower())
    except ValueError:
        return LevelBand.UNRATED


def _prerequisite_depths(concepts: list[Concept]) -> dict[str, int]:
    """Longest prerequisite chain leading into each concept (memoized DFS)."""
    prereqs = {c.concept_id: list(c.prerequisites) for c in concepts}
    known = set(prereqs)
    memo: dict[str, int] = {}

    def depth(cid: str, stack: frozenset[str]) -> int:
        if cid in memo:
            return memo[cid]
        if cid in stack:  # cycle guard
            return 0
        best = 0
        for p in prereqs.get(cid, []):
            if p in known:
                best = max(best, 1 + depth(p, stack | {cid}))
        memo[cid] = best
        return best

    return {cid: depth(cid, frozenset()) for cid in prereqs}
