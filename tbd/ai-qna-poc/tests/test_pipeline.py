"""Offline smoke tests for the pipeline (sample mode, no network needed)."""
import os

os.environ.setdefault("PDF_SOURCE_MODE", "sample")
os.environ.setdefault("GENERATION_PROVIDER", "droid")
os.environ["OPENAI_API_KEY"] = ""  # keep tests offline: critic stays skipped

from app.pipeline import run  # noqa: E402
from app.schemas import (  # noqa: E402
    ClassLevel,
    Difficulty,
    GenerateRequest,
    QuestionType,
    Subject,
)


def _req(**kwargs) -> GenerateRequest:
    base = dict(
        class_level=ClassLevel.twelve,
        subject=Subject.physics,
        difficulty=Difficulty.medium,
        count=10,
        types=["sc", "mcq", "tf"],
        seed=7,
    )
    base.update(kwargs)
    return GenerateRequest(**base)


def test_generates_requested_count():
    resp = run(_req())
    assert len(resp.questions) == 10
    assert resp.validation.passed


def test_answer_keys_and_structure():
    resp = run(_req())
    for q in resp.questions:
        assert q.title_markdown
        assert q.explanation_markdown
        assert q.answer_key, "every question must expose an answer key"
        correct = [o for o in q.options if o.is_correct]
        if q.type == QuestionType.single_choice:
            assert len(correct) == 1
        if q.type == QuestionType.true_false:
            assert len(q.options) == 2 and len(correct) == 1
        # answer_key matches the correct option ids
        assert {o.id for o in correct} == set(q.answer_key)


def test_type_filter_respected():
    resp = run(_req(types=["tf"], count=4))
    assert all(q.type == QuestionType.true_false for q in resp.questions)


def test_all_subjects_classes_produce_output():
    for cls in [ClassLevel.ten, ClassLevel.twelve]:
        for sub in [Subject.physics, Subject.chemistry, Subject.mathematics, Subject.biology]:
            resp = run(_req(class_level=cls, subject=sub, count=6))
            assert len(resp.questions) >= 1, f"no questions for {cls} {sub}"


def test_reproducible_with_seed():
    a = run(_req(seed=123))
    b = run(_req(seed=123))
    assert [q.title_markdown for q in a.questions] == [q.title_markdown for q in b.questions]
