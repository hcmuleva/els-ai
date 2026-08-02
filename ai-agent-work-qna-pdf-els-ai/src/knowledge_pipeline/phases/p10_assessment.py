"""Phase 10 - Assessment Engine Preparation and Phase 11 - Quality Validation."""
from __future__ import annotations

from ..config import ValidationThresholds
from ..models import (
    AssessmentProfile,
    AssessmentType,
    Concept,
    ConceptType,
    QualityScores,
)
from ..utils import clamp

# base suitability of each assessment type per concept type
_SUITABILITY: dict[AssessmentType, dict[ConceptType, float]] = {
    AssessmentType.MCQ: {
        ConceptType.DEFINITION: 0.9, ConceptType.FACT: 0.9, ConceptType.PRINCIPLE: 0.7,
        ConceptType.FORMULA: 0.6, ConceptType.THEORY: 0.5,
    },
    AssessmentType.SCENARIO: {
        ConceptType.PRINCIPLE: 0.85, ConceptType.THEORY: 0.85, ConceptType.MODEL: 0.8,
        ConceptType.FRAMEWORK: 0.8, ConceptType.PROCESS: 0.6,
    },
    AssessmentType.PROBLEM_SOLVING: {
        ConceptType.FORMULA: 0.95, ConceptType.PROCESS: 0.8, ConceptType.PROCEDURE: 0.8,
        ConceptType.PRINCIPLE: 0.6,
    },
    AssessmentType.CASE_STUDY: {
        ConceptType.CASE_STUDY: 0.95, ConceptType.FRAMEWORK: 0.85, ConceptType.THEORY: 0.7,
        ConceptType.MODEL: 0.7,
    },
    AssessmentType.SHORT_ANSWER: {
        ConceptType.DEFINITION: 0.8, ConceptType.FACT: 0.7, ConceptType.PRINCIPLE: 0.7,
        ConceptType.THEORY: 0.7, ConceptType.MODEL: 0.6,
    },
    AssessmentType.ESSAY: {
        ConceptType.THEORY: 0.9, ConceptType.PRINCIPLE: 0.8, ConceptType.MODEL: 0.7,
        ConceptType.CASE_STUDY: 0.7,
    },
    AssessmentType.PRACTICAL: {
        ConceptType.PROCEDURE: 0.95, ConceptType.PROCESS: 0.9, ConceptType.FORMULA: 0.7,
        ConceptType.FRAMEWORK: 0.6,
    },
}
_RECOMMEND_THRESHOLD = 0.6


# ----------------------------------------------------------------- phase 10
def classify_assessments(concepts: list[Concept]) -> list[AssessmentProfile]:
    profiles: list[AssessmentProfile] = []
    for c in concepts:
        scores: dict[str, float] = {}
        richness_bonus = 0.05 * sum(
            1 for v in (c.examples, c.formulae, c.processes, c.case_studies) if v
        )
        for atype, mapping in _SUITABILITY.items():
            base = mapping.get(c.concept_type, 0.35)
            scores[atype.value] = round(clamp(base + richness_bonus), 3)

        recommended = sorted(
            (t for t, s in scores.items() if s >= _RECOMMEND_THRESHOLD),
            key=lambda t: scores[t],
            reverse=True,
        )
        top = sorted(scores.values(), reverse=True)[:3]
        overall = round(sum(top) / len(top), 3) if top else 0.0
        profiles.append(
            AssessmentProfile(
                concept_id=c.concept_id,
                concept_name=c.concept_name,
                candidate_scores=scores,
                recommended_types=recommended,
                overall_suitability=overall,
            )
        )
    return profiles


# ----------------------------------------------------------------- phase 11
def validate(
    concepts: list[Concept],
    assessment_profiles: list[AssessmentProfile],
    thresholds: ValidationThresholds,
) -> list[QualityScores]:
    suitability = {p.concept_id: p.overall_suitability for p in assessment_profiles}
    results: list[QualityScores] = []

    for c in concepts:
        populated = sum(
            1
            for v in (c.examples, c.frameworks, c.processes, c.formulae, c.case_studies, c.facts)
            if v
        )
        completeness = clamp(
            (0.5 if c.definition else 0.0)
            + (0.1 * populated)
        )
        educational_value = clamp(0.3 + 0.1 * populated + (0.3 if len(c.definition) > 60 else 0.1))
        relevance = clamp(0.5 * c.importance_score + 0.5 * (1.0 if c.definition else 0.3))
        assessment_value = suitability.get(c.concept_id, 0.0)
        embedding_value = clamp(0.4 + min(len(c.description), 400) / 800 + 0.1 * populated)
        # heuristic accuracy proxy: extraction confidence (no ground-truth verification offline)
        accuracy = clamp(0.5 + 0.5 * c.confidence_score)
        confidence = c.confidence_score

        metrics = {
            "relevance": relevance,
            "educational_value": educational_value,
            "assessment_value": assessment_value,
            "embedding_value": embedding_value,
            "completeness": completeness,
            "accuracy": accuracy,
            "confidence": confidence,
        }
        rejection = _check_thresholds(metrics, thresholds)
        results.append(
            QualityScores(
                concept_id=c.concept_id,
                relevance=round(relevance, 3),
                educational_value=round(educational_value, 3),
                assessment_value=round(assessment_value, 3),
                embedding_value=round(embedding_value, 3),
                completeness=round(completeness, 3),
                accuracy=round(accuracy, 3),
                confidence=round(confidence, 3),
                passed=not rejection,
                rejection_reasons=rejection,
            )
        )
    return results


def _check_thresholds(metrics: dict[str, float], t: ValidationThresholds) -> list[str]:
    reasons: list[str] = []
    checks = {
        "relevance": t.min_relevance,
        "educational_value": t.min_educational_value,
        "assessment_value": t.min_assessment_value,
        "embedding_value": t.min_embedding_value,
        "completeness": t.min_completeness,
        "accuracy": t.min_accuracy,
        "confidence": t.min_confidence,
    }
    for key, minimum in checks.items():
        if metrics[key] < minimum:
            reasons.append(f"{key}<{minimum}")
    return reasons
