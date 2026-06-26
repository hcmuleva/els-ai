"""Difficulty Calibrator.

- Assigns default marks / Bloom level by exam level when the author left them out.
- Implements the spec's Mixed distribution (30% Board, 30% Board_HOTS,
  25% JEE_Main/NEET, 15% JEE_Advanced for PCM; NEET replaces JEE_Advanced for
  Biology/Science).
- Provides the "not too easy" heuristic used by the quality gate.
"""
from __future__ import annotations

from typing import Dict

from qfactory.types import Level

_DEFAULT_MARKS = {
    Level.BOARD: 3,
    Level.BOARD_HOTS: 4,
    Level.JEE_MAIN: 4,
    Level.JEE_ADVANCED: 4,
    Level.NEET: 4,
}

_DEFAULT_BLOOM = {
    Level.BOARD: "Understand",
    Level.BOARD_HOTS: "Analyze",
    Level.JEE_MAIN: "Apply",
    Level.JEE_ADVANCED: "Analyze",
    Level.NEET: "Apply",
}

_TRIVIAL_STARTS = ("what is", "define", "name the", "state the ")


def default_marks(level: Level) -> int:
    return _DEFAULT_MARKS.get(level, 3)


def default_bloom(level: Level) -> str:
    return _DEFAULT_BLOOM.get(level, "Apply")


def not_too_easy(question: str, level: Level) -> bool:
    """Reject bare-definition recall for the harder levels."""
    q = (question or "").strip().lower()
    if level in (Level.BOARD,):
        return len(q) >= 12
    if any(q.startswith(s) for s in _TRIVIAL_STARTS) and len(q) < 80:
        return False
    return len(q) >= 25


def mixed_distribution(count: int, subject: str) -> Dict[Level, int]:
    """Split ``count`` across levels per the spec's Mixed rule."""
    is_pcm = subject in ("physics", "chemistry", "mathematics")
    if is_pcm:
        weights = {
            Level.BOARD: 0.30,
            Level.BOARD_HOTS: 0.30,
            Level.JEE_MAIN: 0.25,
            Level.JEE_ADVANCED: 0.15,
        }
    else:  # biology / science -> NEET replaces JEE_Advanced
        weights = {
            Level.BOARD: 0.30,
            Level.BOARD_HOTS: 0.30,
            Level.NEET: 0.40,
        }
    alloc: Dict[Level, int] = {lvl: int(count * w) for lvl, w in weights.items()}
    # hand out any remainder (rounding) to the highest-weight level
    while sum(alloc.values()) < count:
        top = max(weights, key=lambda k: weights[k])
        alloc[top] += 1
    return alloc
