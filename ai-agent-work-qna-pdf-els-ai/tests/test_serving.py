from knowledge_pipeline.config import IdentityConfig, PipelineConfig
from knowledge_pipeline.serving import Workflows
from knowledge_pipeline.serving.context import StubRetriever
from knowledge_pipeline.serving.llm import StubLLM


def _config():
    cfg = PipelineConfig(provider="mock")
    cfg.identity = IdentityConfig(
        creator_id="c-1", organization_id="o-1", subject="Mathematics", class_level="Class 12"
    )
    return cfg


def _workflows():
    retriever = StubRetriever(
        vector_hits=[{"payload": {"chunk_id": "ch1", "content": "A linear program optimizes Z.", "topic": "Linear Programming"}}],
        concepts=[
            {"concept_id": "c1", "name": "Feasible Region", "topic": "Linear Programming", "level_band": "jee_main", "definition": "Region satisfying all constraints."}
        ],
        prereqs=[{"concept_id": "c0", "name": "Inequalities", "level_band": "intermediate", "depth": 1}],
    )
    return Workflows(_config(), retriever=retriever, llm=StubLLM("STUB OUTPUT"), prefer_mcp=False)


def test_quiz_workflow_returns_target_schema():
    wf = _workflows()
    quiz = wf.generate_quiz("Linear Programming", level_band="jee_main", count=2)
    assert quiz["count"] == 2
    q0 = quiz["questions"][0]["question"]
    assert q0["question_type"] in ("single_choice", "multi_choice")
    assert q0["question_data"]["_meta"]["creatorId"] == "c-1"
    assert q0["question_svg"] and q0["question_svg"].startswith("<svg")


def test_explanation_workflow_uses_llm_and_context():
    wf = _workflows()
    out = wf.generate_explanation("What is a feasible region?", top_k=3)
    assert out["explanation"] == "STUB OUTPUT"
    assert out["context_used"] is True
    assert out["sources"] == ["ch1"]


def test_learning_path_workflow():
    wf = _workflows()
    out = wf.generate_learning_path("Linear Programming", target_level="jee_advanced")
    assert out["topic"] == "Linear Programming"
    assert out["prerequisite_order"] == ["Inequalities"]
    assert out["narrative"] == "STUB OUTPUT"
