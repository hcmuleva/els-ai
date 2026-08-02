"""Deterministic STEM concept extraction from question text and topic metadata."""
from __future__ import annotations

import re
from typing import Any

from .common import ConceptMatch, question_text
from .rules import CONCEPT_RULES

_PATTERNS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "transformer_ac_load",
        (
            r"\btransformer\b",
            r"\bprimary\s+coil\b",
            r"\bsecondary\s+coil\b",
            r"\bN_?[ps]\b",
            r"\bturns?\s+ratio\b",
        ),
    ),
    (
        "mutual_induction",
        (
            r"\bmutual\s+induct",
            r"\bcoefficient\s+of\s+coupling\b",
            r"\bcoupled\s+coils?\b",
            r"\bM\s*=",
            r"\bL_?1\b.*\bL_?2\b",
        ),
    ),
    (
        "lr_current_growth",
        (
            r"\b(?:LR|RL)\s+circuit\b",
            r"\bcurrent\s+(?:growth|rise|reaches)\b",
            r"\btime\s+constant\b.*\bL\s*/\s*R\b",
            r"1\s*-\s*(?:e|exp)\s*\^",
        ),
    ),
    (
        "magnetic_flux_loop",
        (
            r"\bmagnetic\s+flux\b",
            r"\bmagnetic\s+field\b.*\b(?:surface|loop|area|normal)\b",
            r"\bconducting\s+loop\b",
            r"\\vec\{?B\}?",
            r"\bflux\s+through\s+(?:the\s+)?surface\b",
        ),
    ),
    (
        "free_body_incline",
        (
            r"\binclined\s+plane\b",
            r"\bfree[- ]body\b",
            r"\bnormal\s+(?:force|reaction)\b.*\bfriction\b",
        ),
    ),
    (
        "optics_refraction",
        (
            r"\brefraction\b",
            r"\bSnell'?s\s+law\b",
            r"\bincident\s+ray\b",
            r"\brefracted\s+ray\b",
        ),
    ),
    (
        "chemical_reaction",
        (
            r"\breactants?\b.*\bproducts?\b",
            r"\bchemical\s+(?:equation|reaction)\b",
            r"\\rightarrow|→",
        ),
    ),
    (
        "mathematical_function_plot",
        (
            r"\bgraph\s+of\b",
            r"\bfunction\s+(?:plot|graph)\b",
            r"\b(?:maximum|minimum|derivative|turning point)\b.*\bfunction\b",
            r"\bf\s*\(\s*x\s*\)",
        ),
    ),
)

_SUBJECT_TERMS = {
    "Physics": re.compile(
        r"\b(?:magnetic|induct(?:or|ance|ion)|transformer|current|voltage|"
        r"resistance|circuit|force|friction|lens|refraction|electric|emf)\b",
        re.IGNORECASE,
    ),
    "Chemistry": re.compile(
        r"\b(?:reaction|reactant|product|molecule|molar|acid|base|oxidation|"
        r"reduction|electrolysis)\b",
        re.IGNORECASE,
    ),
    "Mathematics": re.compile(
        r"\b(?:function|derivative|integral|polynomial|matrix|determinant|"
        r"trigonometry|probability|coordinate geometry|"
        # geometry & mensuration (Class 6-10)
        r"triangle|rectangle|square|polygon|hexagon|circle|chord|radius|diameter|"
        r"tangent|secant|arc|sector|segment|parallelogram|rhombus|trapezium|"
        r"angle|perpendicular|parallel|diagonal|perimeter|area|volume|"
        r"symmetry|line of symmetry|reflection|rotation|"
        # numbers & arithmetic (Class 1-8)
        r"whole number|natural number|integer|fraction|decimal|prime|composite|"
        r"factor|multiple|divisor|lcm|hcf|ratio|proportion|percentage|"
        r"arithmetic|algebra|numeral|digit|place value|number line|"
        # graph & data (Class 6-8)
        r"bar graph|bar chart|pie chart|pictograph|histogram|frequency|tally"
        r")\b",
        re.IGNORECASE,
    ),
}


def extract_concept(question: dict[str, Any]) -> ConceptMatch:
    text = question_text(question)
    for concept, patterns in _PATTERNS:
        evidence = tuple(
            pattern
            for pattern in patterns
            if re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        )
        if evidence:
            rule = CONCEPT_RULES[concept]
            confidence = min(0.99, 0.72 + 0.08 * (len(evidence) - 1))
            return ConceptMatch(
                concept=concept,
                subject=rule["subject"],
                required_diagram_family=rule["family"],
                confidence=confidence,
                evidence=evidence,
            )

    scores = {
        subject: len(pattern.findall(text))
        for subject, pattern in _SUBJECT_TERMS.items()
    }
    subject = max(scores, key=scores.get) if max(scores.values(), default=0) else "Unknown"
    return ConceptMatch(
        concept="unknown",
        subject=subject,
        required_diagram_family="unknown",
        confidence=0.35 if subject != "Unknown" else 0.0,
        evidence=(),
    )
