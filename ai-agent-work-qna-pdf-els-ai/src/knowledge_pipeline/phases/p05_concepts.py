"""Phase 5 - Concept Extraction, Phase 6 - Learning Objectives, Phase 7 - Misconceptions."""
from __future__ import annotations

import re

from ..extractors.base import KnowledgeExtractor
from ..models import (
    AssessmentType,
    BloomLevel,
    Concept,
    ConceptType,
    Difficulty,
    LearningObjective,
    Misconception,
)
from ..models import DistilledUnit
from ..utils import clamp, dedupe_preserve, normalize_ws, stable_id

_ADVANCED_MARKERS = re.compile(
    r"\b(derivative|integral|tensor|eigen|stochastic|thermodynamic|quantum|asymptotic|"
    r"optimization|differential|equilibrium|nonlinear)\b",
    re.IGNORECASE,
)

# Bloom -> (verb, competency, assessment type)
_BLOOM_SPEC: dict[BloomLevel, tuple[str, str, AssessmentType]] = {
    BloomLevel.REMEMBER: ("Recall and state", "Knowledge Retention", AssessmentType.MCQ),
    BloomLevel.UNDERSTAND: ("Explain in your own words", "Conceptual Understanding", AssessmentType.SHORT_ANSWER),
    BloomLevel.APPLY: ("Apply to a new situation", "Application", AssessmentType.PROBLEM_SOLVING),
    BloomLevel.ANALYZE: ("Break down and compare", "Analysis", AssessmentType.SCENARIO),
    BloomLevel.EVALUATE: ("Critique and justify decisions about", "Evaluation", AssessmentType.ESSAY),
    BloomLevel.CREATE: ("Design or produce something using", "Synthesis", AssessmentType.PRACTICAL),
}


# ----------------------------------------------------------------- phase 5
def extract_concepts(units: list[DistilledUnit]) -> list[Concept]:
    concepts: list[Concept] = []
    for u in units:
        ctype = _infer_type(u)
        difficulty = _infer_difficulty(u)
        description = _build_description(u)
        concept = Concept(
            concept_id=stable_id("concept", u.book_id, u.concept),
            concept_name=u.concept,
            concept_type=ctype,
            difficulty=difficulty,
            importance_score=_importance(u),
            confidence_score=_confidence(u),
            definition=u.definition,
            description=description,
            examples=u.examples,
            frameworks=u.frameworks,
            processes=u.processes,
            formulae=u.formulae,
            case_studies=u.case_studies,
            facts=u.facts,
            book_id=u.book_id,
            chapter_index=u.chapter_index,
            source_pages=u.source_pages,
            topic=u.topic,
            subtopic=u.subtopic,
        )
        concepts.append(concept)

    _link_relations(concepts)
    return concepts


def _infer_type(u: DistilledUnit) -> ConceptType:
    if u.formulae:
        return ConceptType.FORMULA
    if u.frameworks:
        return ConceptType.FRAMEWORK
    if u.processes:
        return ConceptType.PROCESS
    if u.case_studies:
        return ConceptType.CASE_STUDY
    text = u.definition.lower()
    if re.search(r"\b(law|principle|axiom|postulate|rule)\b", text):
        return ConceptType.PRINCIPLE
    if re.search(r"\btheory\b", text):
        return ConceptType.THEORY
    if re.search(r"\bmodel\b", text):
        return ConceptType.MODEL
    if re.search(r"\b(procedure|method|steps)\b", text):
        return ConceptType.PROCEDURE
    if u.definition:
        return ConceptType.DEFINITION
    return ConceptType.FACT


def _infer_difficulty(u: DistilledUnit) -> Difficulty:
    blob = " ".join([u.definition] + u.facts + u.formulae)
    if u.formulae or _ADVANCED_MARKERS.search(blob):
        return Difficulty.ADVANCED
    if len(u.definition) > 160 or u.processes or u.frameworks:
        return Difficulty.INTERMEDIATE
    return Difficulty.FOUNDATIONAL


def _importance(u: DistilledUnit) -> float:
    populated = sum(
        1
        for v in (u.examples, u.frameworks, u.processes, u.formulae, u.case_studies, u.facts)
        if v
    )
    base = 0.4 + 0.1 * populated
    if u.definition:
        base += 0.1
    return clamp(base)


def _confidence(u: DistilledUnit) -> float:
    conf = 0.4
    if len(u.definition) >= 40:
        conf += 0.3
    if 3 <= len(u.concept) <= 45:
        conf += 0.2
    if u.examples or u.facts:
        conf += 0.1
    return clamp(conf)


def _build_description(u: DistilledUnit) -> str:
    parts = [u.definition] if u.definition else []
    parts.extend(u.facts[:2])
    return normalize_ws(" ".join(parts))[:600]


def _link_relations(concepts: list[Concept]) -> None:
    name_to_id = {c.concept_name.lower(): c.concept_id for c in concepts}
    by_topic: dict[str, list[Concept]] = {}
    for c in concepts:
        by_topic.setdefault(c.topic.lower(), []).append(c)

    for c in concepts:
        blob = " ".join([c.definition] + c.facts + c.examples).lower()
        deps: list[str] = []
        related: list[str] = []
        for other in concepts:
            if other.concept_id == c.concept_id:
                continue
            oname = other.concept_name.lower()
            if len(oname) < 4:
                continue
            if re.search(rf"\b{re.escape(oname)}\b", blob):
                deps.append(other.concept_id)
        # topic siblings are related
        for sib in by_topic.get(c.topic.lower(), []):
            if sib.concept_id != c.concept_id:
                related.append(sib.concept_id)

        c.dependencies = dedupe_preserve(deps)[:8]
        c.related_concepts = dedupe_preserve(related + deps)[:8]
        # prerequisites: dependencies that are easier or in an earlier chapter
        prereqs = []
        id_to_concept = {x.concept_id: x for x in concepts}
        for dep_id in c.dependencies:
            dep = id_to_concept.get(dep_id)
            if not dep:
                continue
            if _rank(dep.difficulty) < _rank(c.difficulty) or dep.chapter_index < c.chapter_index:
                prereqs.append(dep_id)
        c.prerequisites = dedupe_preserve(prereqs)[:6]


def _rank(d: Difficulty) -> int:
    return {Difficulty.FOUNDATIONAL: 0, Difficulty.INTERMEDIATE: 1, Difficulty.ADVANCED: 2}[d]


# ----------------------------------------------------------------- phase 6
def generate_objectives(concepts: list[Concept]) -> list[LearningObjective]:
    objectives: list[LearningObjective] = []
    for c in concepts:
        for level, (verb, competency, atype) in _BLOOM_SPEC.items():
            text = f"{verb} the concept of {c.concept_name}."
            objectives.append(
                LearningObjective(
                    objective_id=stable_id("obj", c.concept_id, level.value),
                    concept_id=c.concept_id,
                    objective=text,
                    bloom_level=level,
                    competency=competency,
                    assessment_type=atype,
                )
            )
    return objectives


# ----------------------------------------------------------------- phase 7
def generate_misconceptions(
    concepts: list[Concept], extractor: KnowledgeExtractor
) -> list[Misconception]:
    out: list[Misconception] = []
    for c in concepts:
        for i, m in enumerate(extractor.misconceptions(c.concept_name, c.definition)):
            if not m.get("misconception"):
                continue
            out.append(
                Misconception(
                    misconception_id=stable_id("misc", c.concept_id, i),
                    concept_id=c.concept_id,
                    misconception=m["misconception"],
                    explanation=m.get("explanation", ""),
                    correction=m.get("correction", ""),
                )
            )
    return out
