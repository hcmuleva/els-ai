"""Prompt templates for LLM-backed extraction. All prompts demand strict JSON."""
from __future__ import annotations

SYSTEM = (
    "You are a senior educational knowledge architect. You transform textbook text "
    "into precise, assessment-ready structured knowledge. Always answer with STRICT, "
    "valid JSON only. No markdown, no prose, no commentary."
)

CLASSIFY_BOOK = """Classify this educational book.
Return JSON: {{"subject": str, "curriculum": str, "domain": str}}
- subject: e.g. Physics, Economics, Computer Science
- curriculum: one of K-12, Higher Education, Undergraduate, Professional
- domain: one of STEM, Social Sciences, Humanities, Business, General

TITLE: {title}
SAMPLE TEXT:
\"\"\"{sample}\"\"\"
"""

PAGE_VALUE = """Classify the educational value of this page.
Return JSON: {{"value_class": "HIGH"|"MEDIUM"|"LOW", "categories": [str], "noise_reasons": [str]}}
HIGH = definitions, concepts, formulae, laws, rules, frameworks, processes,
methodologies, case studies, examples, learning objectives.
MEDIUM = historical background, supporting explanations.
LOW = acknowledgements, references, marketing, author notes, copyright, duplicates.

PAGE TEXT:
\"\"\"{text}\"\"\"
"""

DISTILL = """Extract self-contained knowledge units from this chapter text.
Return JSON: {{"units": [{{
  "topic": str, "subtopic": str, "concept": str, "definition": str,
  "examples": [str], "frameworks": [str], "processes": [str],
  "formulae": [str], "case_studies": [str], "facts": [str]
}}]}}
Only include educationally important content. Skip filler. Keep each unit about ONE concept.

CHAPTER TITLE: {chapter_title}
CHAPTER TEXT:
\"\"\"{text}\"\"\"
"""

MISCONCEPTIONS = """List common student misconceptions for the concept below.
Return JSON: {{"misconceptions": [{{"misconception": str, "explanation": str, "correction": str}}]}}
Provide 1-3 realistic misconceptions with clear corrections.

CONCEPT: {concept}
DEFINITION: {definition}
"""

ASSESS_LEVEL = """You are calibrating the DIFFICULTY LEVEL of an educational concept for
question generation, on this ladder (easiest to hardest):
beginner < intermediate < advanced < jee_main < jee_advanced < expert.
- beginner/intermediate: recall and direct application, single step.
- advanced: solid undergraduate/board depth, few steps.
- jee_main: competitive exam, multi-step, careful application.
- jee_advanced: hard competitive, multi-concept fusion, non-obvious reasoning.
- expert: olympiad / research-adjacent depth.

Judge from the CONTENT ITSELF. If the material is only introductory, do NOT rate it jee/expert.
Return JSON: {{
  "level_band": one of the ladder values,
  "intrinsic_difficulty": "low"|"medium"|"high",
  "reasoning_level": one of Remember|Understand|Apply|Analyze|Evaluate|Create,
  "steps_required": integer,
  "concepts_combined": integer (how many concepts a hard item on this would fuse),
  "confidence": number 0..1,
  "rationale": short string
}}

CONCEPT: {concept}
TYPE: {concept_type}   TOPIC: {topic}   PREREQUISITE_DEPTH: {prerequisite_depth}
DEFINITION: {definition}
SUPPORTING: {supporting}
"""

GENERATE_QUESTION = """Generate ONE high-quality assessment item.
LEVEL: {level_band}    BLOOM: {bloom_level}    FORMAT: {assessment_type}
{mode_instruction}

Use the concept material below. For MCQ-style formats provide 4 options with exactly one correct.
Seed distractors from the listed misconceptions when possible. Provide a full worked solution.
Return JSON: {{
  "stem": str,
  "options": [str] (empty list if not multiple-choice),
  "correct_answer": str,
  "distractors": [str],
  "worked_solution": str
}}

CONCEPTS:
{concepts_block}

MISCONCEPTIONS TO USE AS DISTRACTORS:
{misconceptions_block}
"""
