import pytest

from knowledge_pipeline.config import IdentityConfig, PipelineConfig
from knowledge_pipeline.generation import QuestionGenerator


@pytest.fixture()
def gen():
    cfg = PipelineConfig(provider="mock")
    cfg.identity = IdentityConfig(
        creator_id="2bb3d34c-0000",
        organization_id="8ba8388f-0000",
        subject="Mathematics",
        class_level="Class 12",
    )
    return QuestionGenerator(cfg)


TOPICS = [
    "Linear Programming",
    "Relations and Functions",
    "Coordinate Geometry",
    "Triangles",
    "Mensuration",
]


def test_target_schema_shape(gen):
    q = gen.to_target(gen.generate_items("Coordinate Geometry", count=1), created_at="2026-01-01T00:00:00Z")
    top = q[0]["question"]
    for key in (
        "id", "quiz_id", "quiz_title", "quiz_type", "question_type",
        "question_title", "question_instruction", "time_limit_seconds",
        "points", "question_data", "created_at",
    ):
        assert key in top
    data = top["question_data"]
    assert "_meta" in data and "options" in data and "variant" in data
    meta = data["_meta"]
    assert meta["creatorId"] == "2bb3d34c-0000"
    assert meta["organizationId"] == "8ba8388f-0000"


def test_all_topics_generate(gen):
    for t in TOPICS:
        items = gen.generate_items(t, level_band="jee_main", count=2, concept_ids=["c1"])
        assert len(items) == 2
        q = gen.to_target(items, created_at="2026-01-01T00:00:00Z")
        assert len(q) == 2
        for wrapped in q:
            top = wrapped["question"]
            opts = top["question_data"]["options"]
            assert 2 <= len(opts) <= 4
            assert sum(1 for o in opts if o["is_correct"]) == 1


def test_stem_diagram_has_svg(gen):
    q = gen.to_target(gen.generate_items("Mensuration", count=1), created_at="2026-01-01T00:00:00Z")
    top = q[0]["question"]
    assert top["question_svg"] and top["question_svg"].startswith("<svg")
    assert top["question_data"]["diagram"] is not None


def test_graph_match_puts_svg_on_options(gen):
    # graph_match is one of the "Relations and Functions" families
    items = gen.generate_items("Relations and Functions", count=2)
    gm = next((i for i in items if i["source"] == "template:graph_match"), None)
    assert gm is not None
    q = gen.to_target([gm], created_at="2026-01-01T00:00:00Z")[0]["question"]
    opts = q["question_data"]["options"]
    assert all(o["svg"] and o["svg"].startswith("<svg") for o in opts)


def test_determinism(gen):
    a = gen.to_target(gen.generate_items("Linear Programming", count=2), created_at="2026-01-01T00:00:00Z")
    b = gen.to_target(gen.generate_items("Linear Programming", count=2), created_at="2026-01-01T00:00:00Z")
    assert a == b
