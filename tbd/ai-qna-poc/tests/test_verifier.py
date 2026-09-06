"""Tests for the deterministic verifier and the correctness pipeline report."""
import os
import random

os.environ.setdefault("PDF_SOURCE_MODE", "sample")
os.environ.setdefault("GENERATION_PROVIDER", "droid")
os.environ["OPENAI_API_KEY"] = ""  # keep tests offline: critic stays skipped

from app.agents import verifier  # noqa: E402
from app.pipeline import run  # noqa: E402
from app.providers.droid_authored import (  # noqa: E402
    _g_derivative,
    _g_integral,
    _g_ohm_current,
    _g_parallel,
    _g_power,
    _g_quadratic,
    _g_series,
)
from app.schemas import (  # noqa: E402
    ClassLevel,
    Difficulty,
    GenerateRequest,
    Subject,
)

_GENS = [
    _g_series,
    _g_parallel,
    _g_ohm_current,
    _g_power,
    _g_derivative,
    _g_integral,
    _g_quadratic,
]


def test_correct_generators_verify():
    rng = random.Random(7)
    for g in _GENS:
        result = verifier.verify(g(rng, Difficulty.medium))
        assert result.status == verifier.VERIFIED, f"{g.__name__}: {result.detail}"


def test_wrong_answer_key_is_refuted():
    for seed, g in enumerate(_GENS):
        q = g(random.Random(seed), Difficulty.easy)
        for opt in q["options"]:
            opt["is_correct"] = not opt["is_correct"]  # corrupt the answer key
        assert verifier.verify(q).status == verifier.REFUTED, g.__name__


def test_no_spec_skips():
    item = {
        "type": "single_choice",
        "options": [{"label_md": "A", "is_correct": True}, {"label_md": "B", "is_correct": False}],
    }
    assert verifier.verify(item).status == verifier.SKIPPED


def test_pipeline_reports_verification_without_key():
    resp = run(
        GenerateRequest(
            class_level=ClassLevel.twelve,
            subject=Subject.physics,
            difficulty=Difficulty.medium,
            count=8,
            types=["sc"],
            seed=7,
        )
    )
    assert resp.validation.passed
    assert resp.validation.verified >= 1  # numeric generators were verified
    assert resp.validation.critic == "skipped"  # no API key in test env
    assert resp.validation.refuted == 0
