"""Pydantic schemas for every knowledge asset the pipeline produces.

These types are the contract between phases and the final JSON repositories.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- enums
class ContentValue(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ConceptType(str, Enum):
    DEFINITION = "Definition"
    FACT = "Fact"
    PRINCIPLE = "Principle"
    THEORY = "Theory"
    FRAMEWORK = "Framework"
    PROCESS = "Process"
    FORMULA = "Formula"
    MODEL = "Model"
    PROCEDURE = "Procedure"
    CASE_STUDY = "Case Study"


class Difficulty(str, Enum):
    FOUNDATIONAL = "foundational"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class BloomLevel(str, Enum):
    REMEMBER = "Remember"
    UNDERSTAND = "Understand"
    APPLY = "Apply"
    ANALYZE = "Analyze"
    EVALUATE = "Evaluate"
    CREATE = "Create"


class AssessmentType(str, Enum):
    MCQ = "MCQ"
    SCENARIO = "Scenario"
    PROBLEM_SOLVING = "Problem Solving"
    CASE_STUDY = "Case Study"
    SHORT_ANSWER = "Short Answer"
    ESSAY = "Essay"
    PRACTICAL = "Practical"


class RelationType(str, Enum):
    PARENT_CHILD = "parent_child"
    CAUSE_EFFECT = "cause_effect"
    PREREQUISITE_DEPENDENT = "prerequisite_dependent"
    THEORY_APPLICATION = "theory_application"
    RELATED = "related"


class LevelBand(str, Enum):
    VERY_EASY = "very_easy"
    EASY = "easy"
    MODERATE = "moderate"
    DIFFICULT = "difficult"
    VERY_DIFFICULT = "very_difficult"
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    JEE_MAIN = "jee_main"
    JEE_ADVANCED = "jee_advanced"
    EXPERT = "expert"
    UNRATED = "unrated"  # assigned when no LLM is available (never faked)


# --------------------------------------------------------------- phase 1: discovery
class TopicNode(BaseModel):
    title: str
    subtopics: list[str] = Field(default_factory=list)


class ChapterNode(BaseModel):
    index: int
    title: str
    page_start: int
    page_end: int
    topics: list[TopicNode] = Field(default_factory=list)


class BookMeta(BaseModel):
    book_id: str
    filename: str
    title: str
    num_pages: int
    subject: str = "Unknown"
    curriculum: str = "General"
    domain: str = "General"
    chapters: list[ChapterNode] = Field(default_factory=list)


class BookOverlap(BaseModel):
    book_a: str
    book_b: str
    shared_topics: list[str] = Field(default_factory=list)
    jaccard: float = 0.0


class KnowledgeInventoryReport(BaseModel):
    books: list[BookMeta] = Field(default_factory=list)
    overlaps: list[BookOverlap] = Field(default_factory=list)
    subject_index: dict[str, list[str]] = Field(default_factory=dict)
    domain_index: dict[str, list[str]] = Field(default_factory=dict)
    total_chapters: int = 0
    total_topics: int = 0


# ------------------------------------------------------------- phase 2/3: quality
class PageContent(BaseModel):
    book_id: str
    page_number: int
    chapter_index: Optional[int] = None
    text: str
    value_class: ContentValue = ContentValue.MEDIUM
    value_score: float = 0.0
    categories: list[str] = Field(default_factory=list)
    noise_reasons: list[str] = Field(default_factory=list)
    kept: bool = True


# ----------------------------------------------------------- phase 4: distillation
class DistilledUnit(BaseModel):
    unit_id: str
    book_id: str
    chapter_index: int
    topic: str
    subtopic: str
    concept: str
    definition: str = ""
    examples: list[str] = Field(default_factory=list)
    frameworks: list[str] = Field(default_factory=list)
    processes: list[str] = Field(default_factory=list)
    formulae: list[str] = Field(default_factory=list)
    case_studies: list[str] = Field(default_factory=list)
    facts: list[str] = Field(default_factory=list)
    source_pages: list[int] = Field(default_factory=list)


# ------------------------------------------------------------- phase 5: concepts
class Concept(BaseModel):
    concept_id: str
    concept_name: str
    concept_type: ConceptType
    difficulty: Difficulty
    importance_score: float
    confidence_score: float
    prerequisites: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    related_concepts: list[str] = Field(default_factory=list)
    # provenance / payload used by later phases
    definition: str = ""
    description: str = ""
    examples: list[str] = Field(default_factory=list)
    frameworks: list[str] = Field(default_factory=list)
    processes: list[str] = Field(default_factory=list)
    formulae: list[str] = Field(default_factory=list)
    case_studies: list[str] = Field(default_factory=list)
    facts: list[str] = Field(default_factory=list)
    book_id: str = ""
    chapter_index: int = -1
    source_pages: list[int] = Field(default_factory=list)
    topic: str = ""
    subtopic: str = ""


# --------------------------------------------------- phase 6: learning objectives
class LearningObjective(BaseModel):
    objective_id: str
    concept_id: str
    objective: str
    bloom_level: BloomLevel
    competency: str
    assessment_type: AssessmentType


# ------------------------------------------------------- phase 7: misconceptions
class Misconception(BaseModel):
    misconception_id: str
    concept_id: str
    misconception: str
    explanation: str
    correction: str


# --------------------------------------------------------- phase 8: competency
class CompetencyRecord(BaseModel):
    competency_id: str
    concept_id: str
    concept_name: str
    skill: str
    outcome: str
    assessment: str


# ------------------------------------------------------------- phase 9: graph
class GraphNode(BaseModel):
    id: str
    label: str
    concept_type: str
    weight: float
    difficulty: str


class GraphEdge(BaseModel):
    source: str
    target: str
    relation: RelationType
    weight: float


class GraphCentrality(BaseModel):
    concept_id: str
    degree: float
    betweenness: float
    pagerank: float


class KnowledgeGraph(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)
    centrality: list[GraphCentrality] = Field(default_factory=list)


# -------------------------------------------------------- phase 10: assessment
class AssessmentProfile(BaseModel):
    concept_id: str
    concept_name: str
    candidate_scores: dict[str, float] = Field(default_factory=dict)
    recommended_types: list[str] = Field(default_factory=list)
    overall_suitability: float = 0.0


# ------------------------------------------------------- phase 11: validation
class QualityScores(BaseModel):
    concept_id: str
    relevance: float
    educational_value: float
    assessment_value: float
    embedding_value: float
    completeness: float
    accuracy: float
    confidence: float
    passed: bool
    rejection_reasons: list[str] = Field(default_factory=list)


# --------------------------------------------------------- phase 12/13: embedding
class EmbeddingUnit(BaseModel):
    concept_id: str
    concept: str
    description: str
    learning_objectives: list[str] = Field(default_factory=list)
    misconceptions: list[str] = Field(default_factory=list)
    examples: list[str] = Field(default_factory=list)
    assessment_candidates: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class Chunk(BaseModel):
    chunk_id: str
    concept_id: str
    chunk_type: str            # concept | learning_objective | framework | process | formula | case_study
    title: str
    what: str = ""
    why: str = ""
    how: str = ""
    example: str = ""
    assessment_opportunity: str = ""
    text: str = ""             # fully assembled self-contained chunk text
    metadata: dict = Field(default_factory=dict)


class VectorRecord(BaseModel):
    id: str
    text: str
    metadata: dict = Field(default_factory=dict)


# ------------------------------------------------- level calibration (LLM-driven)
class LevelProfile(BaseModel):
    concept_id: str
    concept_name: str
    level_band: LevelBand = LevelBand.UNRATED
    intrinsic_difficulty: str = "unknown"   # low | medium | high | unknown
    reasoning_level: str = ""               # highest Bloom level the concept can bear
    steps_required: int = 0                 # typical solution steps at this level
    concepts_combined: int = 1              # how many concepts a hard item fuses
    prerequisite_depth: int = 0             # from the knowledge graph (factual)
    confidence: float = 0.0
    level_source: str = "none"              # llm:local | llm:openai | ... | heuristic_estimate | none
    rationale: str = ""


class CompositeSpec(BaseModel):
    bundle_id: str
    target_concept_id: str
    target_concept_name: str
    member_concept_ids: list[str] = Field(default_factory=list)
    member_concept_names: list[str] = Field(default_factory=list)
    level_band: LevelBand = LevelBand.JEE_MAIN
    prerequisite_depth: int = 0
    rationale: str = ""


# --------------------------------------------------- phase 15: question generation
class GeneratedQuestion(BaseModel):
    question_id: str
    level_band: LevelBand
    bloom_level: str = ""
    assessment_type: str = ""
    concept_ids: list[str] = Field(default_factory=list)
    concept_names: list[str] = Field(default_factory=list)
    stem: str = ""
    options: list[str] = Field(default_factory=list)   # populated for MCQ-style items
    correct_answer: str = ""
    distractors: list[str] = Field(default_factory=list)
    worked_solution: str = ""
    source: str = "template_fallback"                  # llm:local | llm:openai | template_fallback
    metadata: dict = Field(default_factory=dict)
