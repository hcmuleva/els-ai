"""Phase 8 - Competency Mapping -> Competency Matrix.

Concept -> Skill -> Outcome -> Assessment.
"""
from __future__ import annotations

from ..models import Concept, ConceptType, CompetencyRecord
from ..utils import stable_id

# concept type -> (skill verb, outcome template, assessment)
_SKILL_MAP: dict[ConceptType, tuple[str, str, str]] = {
    ConceptType.DEFINITION: ("Define and distinguish", "can accurately define {name} and separate it from related terms", "MCQ + Short Answer"),
    ConceptType.FACT: ("Recall", "can recall and state {name} correctly", "MCQ"),
    ConceptType.PRINCIPLE: ("Apply the principle of", "can apply {name} to predict or explain outcomes", "Problem Solving"),
    ConceptType.THEORY: ("Reason with the theory of", "can use {name} to explain phenomena and evaluate claims", "Essay + Scenario"),
    ConceptType.FRAMEWORK: ("Operate the framework", "can apply the {name} framework to structure a real problem", "Case Study"),
    ConceptType.PROCESS: ("Execute the process", "can carry out {name} step by step and troubleshoot it", "Practical"),
    ConceptType.FORMULA: ("Compute using", "can select and apply {name} to solve quantitative problems", "Problem Solving"),
    ConceptType.MODEL: ("Model with", "can use the {name} model to represent and analyze a system", "Scenario"),
    ConceptType.PROCEDURE: ("Perform the procedure", "can perform {name} accurately and safely", "Practical"),
    ConceptType.CASE_STUDY: ("Analyze the case", "can analyze {name} and extract transferable lessons", "Case Study"),
}


def run(concepts: list[Concept]) -> list[CompetencyRecord]:
    records: list[CompetencyRecord] = []
    for c in concepts:
        verb, outcome_tpl, assessment = _SKILL_MAP.get(
            c.concept_type,
            ("Understand", "understands {name}", "Short Answer"),
        )
        skill = f"{verb} {c.concept_name}"
        outcome = f"Learner {outcome_tpl.format(name=c.concept_name)}."
        records.append(
            CompetencyRecord(
                competency_id=stable_id("comp", c.concept_id),
                concept_id=c.concept_id,
                concept_name=c.concept_name,
                skill=skill,
                outcome=outcome,
                assessment=assessment,
            )
        )
    return records
