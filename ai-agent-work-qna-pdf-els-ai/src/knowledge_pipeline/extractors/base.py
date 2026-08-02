"""Abstract extractor interface used by the semantic phases.

Only genuinely semantic operations live here. Deterministic transformations
(Bloom objectives, competency mapping, assessment classification, validation
scoring, graph building, chunking) are implemented as reproducible rules in the
phase modules and do not depend on any model backend.
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class BookClassification(dict):
    """{'subject': str, 'curriculum': str, 'domain': str}"""


class KnowledgeExtractor(ABC):
    name: str = "base"

    @abstractmethod
    def classify_book(self, title: str, sample_text: str) -> dict:
        """Return {'subject', 'curriculum', 'domain'} for a book."""

    @abstractmethod
    def page_value(self, text: str) -> dict:
        """Return {'value_class': HIGH|MEDIUM|LOW, 'categories': [str], 'noise_reasons': [str]}."""

    @abstractmethod
    def distill_units(
        self, book_id: str, chapter_index: int, chapter_title: str, text: str
    ) -> list[dict]:
        """Return a list of distilled unit dicts with keys:
        topic, subtopic, concept, definition, examples, frameworks, processes,
        formulae, case_studies, facts.
        """

    @abstractmethod
    def misconceptions(self, concept_name: str, definition: str) -> list[dict]:
        """Return list of {'misconception', 'explanation', 'correction'}."""

    @abstractmethod
    def assess_level(self, payload: dict) -> dict:
        """Judge the difficulty/level of a concept (a semantic task).

        Input payload: concept_name, definition, concept_type, difficulty, topic,
        prerequisite_depth, has_formula, has_process.
        Returns: {level_band, intrinsic_difficulty, reasoning_level, steps_required,
        concepts_combined, confidence, rationale}. Backends without a model MUST
        return level_band='unrated' (never fabricate a level).
        """

    @abstractmethod
    def generate_question(self, spec: dict) -> dict | None:
        """Generate one assessment item for the given spec, or None if unsupported.

        Input spec: level_band, assessment_type, bloom_level, concepts (list of
        {name, definition, examples}), misconceptions (list[str]), composite (bool).
        Returns: {stem, options, correct_answer, distractors, worked_solution} or None.
        """
