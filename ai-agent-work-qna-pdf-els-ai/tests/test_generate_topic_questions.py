import json

from knowledge_pipeline.config import IdentityConfig, PipelineConfig
from knowledge_pipeline.serving.llm import StubLLM
from scripts.generate_topic_questions import (
    _generate_group,
    _normalize_item,
    _validate_item,
    group_topics,
)


def _chunk(topic: str, chunk_id: str, pages: list[int]) -> dict:
    return {
        "chunk_id": chunk_id,
        "concept_id": f"concept-{chunk_id}",
        "title": topic,
        "text": f"CONCEPT: {topic}\nWHAT: Solve representative problems about {topic}.",
        "metadata": {
            "topic": topic,
            "concept": topic,
            "book_id": "book-math",
            "source_pages": pages,
        },
    }


def test_group_topics_merges_page_batches_and_solution_sections() -> None:
    chunks = [
        _chunk("1.1 LinearEquations practice pages 11-13", "a", [10, 11, 12]),
        _chunk("1.1 Linear Equations practice pages 139-143", "b", [138, 139]),
        _chunk("1.2 QuadraticEquations practice pages 14-18", "c", [13, 14]),
    ]

    groups = group_topics(chunks)

    assert [group["key"] for group in groups] == ["1.1", "1.2"]
    assert len(groups[0]["chunks"]) == 2
    assert groups[0]["topic"] == "1.1 Linear Equations"


def test_item_validation_requires_four_options_and_one_answer() -> None:
    item = {
        "stem": "Which value satisfies the equation \\(x+1=2\\)?",
        "options": [
            {"label": "\\(1\\)", "is_correct": True},
            {"label": "\\(2\\)", "is_correct": False},
        ],
        "explanation": "Substitution gives \\(1+1=2\\).",
    }

    assert "question must have exactly four options" in _validate_item(item)


def test_question_item_normalizes_double_escaped_latex() -> None:
    item = {
        "stem": r"Solve \\(x=1\\).",
        "options": [{"label": r"\\(1\\)", "is_correct": True}],
        "explanation": r"The value is \\(1\\).",
    }

    normalized = _normalize_item(item)

    assert normalized["stem"] == r"Solve \(x=1\)."
    assert normalized["options"][0]["label"] == r"\(1\)"


def test_group_generation_attaches_run_and_page_provenance() -> None:
    canned = json.dumps(
        {
            "questions": [
                {
                    "stem": "Which value satisfies the equation \\(x+1=2\\)?",
                    "options": [
                        {"text": "\\(1\\)", "is_correct": True},
                        {"text": "\\(2\\)", "is_correct": False},
                        {"text": "\\(3\\)", "is_correct": False},
                        {"text": "\\(4\\)", "is_correct": False},
                    ],
                    "explanation": "Substitution gives \\(1+1=2\\), so the answer is \\(1\\).",
                    "bloom_level": "Apply",
                    "diagram": None,
                }
            ]
        }
    )
    config = PipelineConfig(provider="mock")
    config.identity = IdentityConfig(subject="Mathematics", class_level="Class 12")
    group = {
        "key": "1.1",
        "topic": "1.1 Linear Equations",
        "chunks": [_chunk("1.1 Linear Equations practice pages 11-13", "a", [10, 11, 12])],
    }

    result = _generate_group(
        config,
        StubLLM(canned),
        group,
        count=1,
        level="jee_main",
        retries=0,
        source_run_id="source-run",
        quiz_id="quiz-1",
        quiz_title="Questions",
        created_at="2026-07-21T00:00:00Z",
    )

    metadata = result["questions"][0]["question"]["question_data"]["_meta"]
    assert result["generated"] == 1
    assert metadata["source_run_id"] == "source-run"
    assert metadata["source_pages"] == [10, 11, 12]
    assert metadata["source_chunk_ids"] == ["a"]


def test_group_generation_retries_invalid_json() -> None:
    valid = json.dumps(
        {
            "questions": [
                {
                    "stem": "Which value satisfies the equation \\(x+1=2\\)?",
                    "options": [
                        {"text": "\\(1\\)", "is_correct": True},
                        {"text": "\\(2\\)", "is_correct": False},
                        {"text": "\\(3\\)", "is_correct": False},
                        {"text": "\\(4\\)", "is_correct": False},
                    ],
                    "explanation": "Substitution gives \\(1+1=2\\).",
                    "bloom_level": "Apply",
                    "diagram": None,
                }
            ]
        }
    )

    class RetryLLM:
        def __init__(self) -> None:
            self.responses = iter(["not json", valid])

        def complete(self, prompt: str) -> str:
            return next(self.responses)

    config = PipelineConfig(provider="mock")
    config.identity = IdentityConfig(subject="Mathematics", class_level="Class 12")
    group = {
        "key": "1.1",
        "topic": "1.1 Linear Equations",
        "chunks": [_chunk("1.1 Linear Equations", "a", [10])],
    }

    result = _generate_group(
        config,
        RetryLLM(),
        group,
        count=1,
        level="jee_main",
        retries=1,
        source_run_id="source-run",
        quiz_id="quiz-1",
        quiz_title="Questions",
        created_at="2026-07-22T00:00:00Z",
    )

    assert result["generated"] == 1
    assert result["rejected"] == [
        {"attempt": 1, "issues": ["LLM response is not strict JSON"]}
    ]
