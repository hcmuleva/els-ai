import json

import pytest

from knowledge_pipeline.config import IdentityConfig, PipelineConfig
from knowledge_pipeline.assessment.generator import _DIAGRAM_GUIDE as ASSESSMENT_GUIDE
from knowledge_pipeline.diagram.catalog import diagram_prompt_guide
from knowledge_pipeline.serving.context import StubRetriever
from knowledge_pipeline.serving.llm import StubLLM
from knowledge_pipeline.serving.rag_quiz import (
    RagQuizGenerator,
    _DIAGRAM_GUIDE as RAG_GUIDE,
    extract_json,
)


def _config():
    cfg = PipelineConfig(provider="mock")
    cfg.identity = IdentityConfig(
        creator_id="c-1", organization_id="o-1", subject="Mathematics", class_level="Class 12"
    )
    return cfg


_CANNED = json.dumps(
    {
        "questions": [
            {
                "stem": "Evaluate \\( \\int_{0}^{2} 3x^2\\,dx \\).",
                "options": [
                    {"text": "\\( 8 \\)", "is_correct": True, "rationale": "x^3 from 0 to 2"},
                    {"text": "\\( 6 \\)", "is_correct": False, "rationale": ""},
                    {"text": "\\( 12 \\)", "is_correct": False, "rationale": ""},
                    {"text": "\\( 4 \\)", "is_correct": False, "rationale": ""},
                ],
                "explanation": "\\( [x^3]_0^2 = 8 \\).",
                "bloom_level": "Apply",
                "diagram": {"type": "function", "expr": "3*x**2", "xmin": 0, "xmax": 2},
            },
            {
                "stem": "In triangle \\(ABC\\), the angle at \\(A\\) is marked. Which is largest?",
                "options": [
                    {"text": "angle A", "is_correct": True},
                    {"text": "angle B", "is_correct": False},
                    {"text": "angle C", "is_correct": False},
                    {"text": "cannot say", "is_correct": False},
                ],
                "explanation": "Opposite the longest side.",
                "diagram": {"type": "triangle", "vertices": [[0, 0], [4, 0], [1, 3]], "mark_angle_at": 0, "angle_label": "\\theta"},
            },
            {
                "stem": "A malformed question with no correct option.",
                "options": [
                    {"text": "x", "is_correct": False},
                    {"text": "y", "is_correct": False},
                ],
            },
        ]
    }
)


def _gen(canned=_CANNED):
    return RagQuizGenerator(_config(), StubRetriever(), StubLLM(canned))


def test_extract_json_requires_strict_unfenced_json():
    assert extract_json('{"questions": []}') == {"questions": []}
    with pytest.raises(ValueError, match="strict JSON"):
        extract_json("```json\n{\"questions\": []}\n```")


def test_generation_agents_share_the_diagram_catalog():
    assert RAG_GUIDE == diagram_prompt_guide("diagram")
    assert ASSESSMENT_GUIDE == diagram_prompt_guide("question.diagramSpec")
    for family in ("right-triangle", "bar-chart", "pie-chart", "pictogram"):
        assert family in RAG_GUIDE and family in ASSESSMENT_GUIDE


def test_diagram_only_prompt_requires_naturally_visual_questions():
    prompt = _gen()._prompt(
        "Magnetic Flux",
        "jee_main",
        3,
        "Flux through a surface.",
        (),
        diagram_only=True,
    )

    assert "DIAGRAM-ONLY OUTPUT MODE" in prompt
    assert "materially improves the reasoning" in prompt
    assert "Never attach a decorative or unrelated figure" in prompt
    assert "omit that candidate" in prompt


def test_complex_geometry_prompt_requires_multistep_diagram_reasoning():
    prompt = _gen()._prompt(
        "Circle geometry",
        "jee_advanced",
        5,
        "Tangent and chord theorems.",
        ("triangle-geometry", "circle-geometry"),
        diagram_only=True,
        subject="Mathematics",
        generation_profile="jee_geometry_complex",
    )

    assert "JEE COMPLEX GEOMETRY PROFILE" in prompt
    assert "at least three linked reasoning steps" in prompt
    assert "triangle-geometry, circle-geometry" in prompt
    assert "Every question must require the diagram to solve" in prompt


def test_extract_json_rejects_single_escaped_latex():
    raw = '{"questions":[{"stem":"Compute \\(\\int_0^1 x\\,dx=\\frac{1}{2}\\)","options":[{"text":"\\(\\frac{1}{2}\\)","is_correct":true}]}]}'
    with pytest.raises(ValueError):
        extract_json(raw)


def test_extract_json_does_not_decode_times_as_json_tab():
    raw = r'{"questions":[{"stem":"\\(5\times2\\)"}]}'

    with pytest.raises(ValueError, match="backslashes"):
        extract_json(raw)


def test_extract_json_preserves_strictly_escaped_latex():
    raw = r'{"questions":[{"stem":"\\(5\\times2\\)"}]}'

    stem = extract_json(raw)["questions"][0]["stem"]

    assert stem == r"\(5\times2\)"


def test_generate_topic_parses_and_validates():
    gen = _gen()
    items, ctx = gen.generate_topic("Integrals", level="jee_main", count=3)
    # 3 came back but the malformed (no-correct) one is dropped
    assert len(items) == 2
    assert items[0]["stem"].startswith("Evaluate")
    assert items[0]["question_diagram"] is not None          # function plot attached
    assert items[1]["question_diagram"] is not None          # triangle attached
    assert all(sum(1 for o in it["options"] if o["is_correct"]) >= 1 for it in items)


def test_adapt_items_maps_to_target_schema_with_svg():
    gen = _gen()
    items, _ = gen.generate_topic("Integrals", level="jee_main", count=3)
    wrapped = gen.adapt_items(items, quiz_id="rag-x", quiz_title="RAG Test", created_at="2026-01-01T00:00:00Z")
    assert len(wrapped) == 2
    q0 = wrapped[0]["question"]
    assert q0["question_type"] == "single_choice"
    assert q0["question_svg"].startswith("<svg")
    assert q0["question_data"]["_meta"]["subject"] == "Mathematics"
    assert q0["question_data"]["_meta"]["topic"] == "Integrals"
    # LaTeX is preserved verbatim in stems/options for MathJax
    assert "\\int" in q0["question_title"]


def test_bad_diagram_spec_is_dropped_not_fatal():
    canned = json.dumps(
        {
            "questions": [
                {
                    "stem": "Question with an unrenderable function.",
                    "options": [
                        {"text": "a", "is_correct": True},
                        {"text": "b", "is_correct": False},
                    ],
                    "diagram": {"type": "function", "expr": "this is not valid python $$"},
                }
            ]
        }
    )
    gen = _gen(canned)
    items, _ = gen.generate_topic("Integrals", count=1)
    assert len(items) == 1
    assert items[0]["question_diagram"] is None  # bad diagram silently dropped


def test_require_context_blocks_ungrounded_generation():
    items, context = _gen().generate_topic(
        "Integrals", count=1, require_context=True
    )

    assert items == []
    assert context["source_chunk_ids"] == []
