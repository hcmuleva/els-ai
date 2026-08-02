from knowledge_pipeline.config import IdentityConfig
from knowledge_pipeline.quizschema.adapter import to_target_question


def _identity():
    return IdentityConfig(creator_id="c1", organization_id="o1", subject="Math", class_level="Class 12")


def _item(n_correct=1):
    opts = [
        {"label": "A", "is_correct": True},
        {"label": "B", "is_correct": n_correct > 1},
        {"label": "C", "is_correct": False},
    ]
    return {
        "stem": "Pick the right ones",
        "options": opts,
        "level_band": "advanced",
        "bloom_level": "Apply",
        "topic": "Algebra",
        "concept_ids": ["x1"],
        "source": "template:test",
    }


def test_single_choice_default():
    tq = to_target_question(_item(1), _identity(), created_at="t")
    assert tq.question_type == "single_choice"
    assert tq.question_instruction == "Choose one correct option."


def test_multi_choice_detection():
    tq = to_target_question(_item(2), _identity(), created_at="t")
    assert tq.question_type == "multi_choice"
    assert tq.question_data.variant == "multi_choice"
    assert "all correct" in tq.question_instruction


def test_meta_identity_injected():
    tq = to_target_question(_item(), _identity(), created_at="t")
    meta = tq.question_data.meta
    assert meta.creatorId == "c1" and meta.organizationId == "o1"
    assert meta.level_band == "advanced" and meta.topic == "Algebra"
    assert meta.concept_ids == ["x1"]


def test_option_ids_and_stable_question_id():
    a = to_target_question(_item(), _identity(), created_at="t")
    b = to_target_question(_item(), _identity(), created_at="t")
    assert a.id == b.id  # deterministic uuid5
    assert [o.id for o in a.question_data.options] == ["A_1", "B_2", "C_3"]


def test_question_ids_are_scoped_to_quiz():
    first = to_target_question(_item(), _identity(), quiz_id="quiz-one", created_at="t")
    second = to_target_question(_item(), _identity(), quiz_id="quiz-two", created_at="t")

    assert first.id != second.id


def test_wrapped_envelope():
    tq = to_target_question(_item(), _identity(), created_at="t")
    wrapped = tq.wrapped()
    assert set(wrapped.keys()) == {"question"}
    assert wrapped["question"]["question_data"]["_meta"]["creatorId"] == "c1"
