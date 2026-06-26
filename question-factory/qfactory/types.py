"""Canonical enums, aliases and the normalized request dataclass."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class QType(str, Enum):
    SCQ = "SCQ"
    MCQ = "MCQ"
    TF = "TF"
    NUMERICAL = "Numerical"
    ASSERTION_REASON = "AssertionReason"


QTYPE_ALIASES = {
    "scq": QType.SCQ, "sc": QType.SCQ, "single": QType.SCQ, "single_choice": QType.SCQ,
    "mcq": QType.MCQ, "multi": QType.MCQ, "multi_choice": QType.MCQ, "multiple": QType.MCQ,
    "tf": QType.TF, "truefalse": QType.TF, "true_false": QType.TF,
    "numerical": QType.NUMERICAL, "num": QType.NUMERICAL, "integer": QType.NUMERICAL, "nat": QType.NUMERICAL,
    "assertionreason": QType.ASSERTION_REASON, "assertion_reason": QType.ASSERTION_REASON,
    "assertion-reason": QType.ASSERTION_REASON, "ar": QType.ASSERTION_REASON,
}


class Level(str, Enum):
    BOARD = "Board"
    BOARD_HOTS = "Board_HOTS"
    JEE_MAIN = "JEE_Main"
    JEE_ADVANCED = "JEE_Advanced"
    NEET = "NEET"
    MIXED = "Mixed"


LEVEL_ALIASES = {
    "board": Level.BOARD, "cbse": Level.BOARD,
    "board_hots": Level.BOARD_HOTS, "hots": Level.BOARD_HOTS, "board-hots": Level.BOARD_HOTS,
    "jee_main": Level.JEE_MAIN, "jeemain": Level.JEE_MAIN, "jee-main": Level.JEE_MAIN, "jm": Level.JEE_MAIN,
    "jee_advanced": Level.JEE_ADVANCED, "jeeadvanced": Level.JEE_ADVANCED, "jee-advanced": Level.JEE_ADVANCED,
    "ja": Level.JEE_ADVANCED, "advanced": Level.JEE_ADVANCED,
    "neet": Level.NEET,
    "mixed": Level.MIXED, "mix": Level.MIXED,
}

LEVEL_CODE = {
    Level.BOARD: "BRD", Level.BOARD_HOTS: "BHT", Level.JEE_MAIN: "JM",
    Level.JEE_ADVANCED: "JA", Level.NEET: "NEET", Level.MIXED: "MIX",
}

SUBJECT_ALIASES = {
    "physics": "physics", "phy": "physics",
    "chemistry": "chemistry", "chem": "chemistry",
    "mathematics": "mathematics", "maths": "mathematics", "math": "mathematics",
    "biology": "biology", "bio": "biology",
    "science": "science",
}

SUBJECT_CODE = {
    "physics": "PHY", "chemistry": "CHE", "mathematics": "MAT",
    "biology": "BIO", "science": "SCI",
}


@dataclass
class QFRequest:
    class_level: str = "12"
    subject: str = "physics"
    chapter: Optional[str] = None
    topic: Optional[str] = None
    question_types: List[QType] = field(
        default_factory=lambda: [QType.SCQ, QType.MCQ, QType.TF, QType.NUMERICAL]
    )
    difficulty: Level = Level.MIXED
    count: int = 10
    include_solutions: bool = True
    include_bloom: bool = True
    include_marks: bool = True
    output_format: str = "JSON"
    seed: Optional[int] = None
