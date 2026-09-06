"""Difficulty rubric.

Turns an abstract difficulty (easy/medium/hard) into a concrete, level-aware
instruction so a generator (LLM or Droid) produces questions that actually
match the requested class. The critic uses the same rubric to audit level fit.
"""
from __future__ import annotations

from app.schemas import ClassLevel, Difficulty

# What each difficulty means, independent of class.
_DIFFICULTY = {
    Difficulty.easy: (
        "Direct recall or a single-step application. One formula or definition, "
        "no chained reasoning. Numbers are small and clean."
    ),
    Difficulty.medium: (
        "Application requiring 2-3 connected steps: pick the right relation, "
        "rearrange it, then substitute. Mild distractors based on common slips."
    ),
    Difficulty.hard: (
        "Multi-concept or multi-step reasoning, a short derivation, or combining "
        "two relations. Distractors must reflect plausible conceptual errors."
    ),
}

# Class context (CBSE).
_CLASS = {
    ClassLevel.ten: (
        "CBSE Class 10 (secondary). Stay within the Class 10 syllabus and notation; "
        "avoid calculus and senior-secondary-only terms."
    ),
    ClassLevel.twelve: (
        "CBSE Class 12 (senior secondary). Board-level depth; calculus, vectors and "
        "formal definitions are in scope."
    ),
}


def _coerce_class(class_level) -> ClassLevel:
    return class_level if isinstance(class_level, ClassLevel) else ClassLevel(str(class_level))


def _coerce_difficulty(difficulty) -> Difficulty:
    return difficulty if isinstance(difficulty, Difficulty) else Difficulty(str(difficulty))


def rubric_for(class_level, difficulty) -> str:
    """Return a one-paragraph rubric for a (class, difficulty) pair."""
    cl = _coerce_class(class_level)
    diff = _coerce_difficulty(difficulty)
    return (
        f"Level: {_CLASS[cl]} "
        f"Difficulty '{diff.value}': {_DIFFICULTY[diff]}"
    )
