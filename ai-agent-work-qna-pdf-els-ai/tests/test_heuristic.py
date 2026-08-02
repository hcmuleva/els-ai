from knowledge_pipeline.extractors.heuristic import HeuristicExtractor
from knowledge_pipeline.phases.p04_distillation import _exercise_batches


def test_classify_book_detects_subject():
    ex = HeuristicExtractor()
    result = ex.classify_book(
        "Intro to Physics",
        "Velocity and force are core to physics. Newtons laws describe motion.",
    )
    assert result["subject"] == "Physics"
    assert result["domain"] == "STEM"


def test_page_value_high_for_definition():
    ex = HeuristicExtractor()
    verdict = ex.page_value(
        "Velocity is defined as the rate of change of displacement. "
        "For example a car travels 100 metres in 5 seconds."
    )
    assert verdict["value_class"] == "HIGH"
    assert "definition" in verdict["categories"]


def test_page_value_low_for_copyright():
    ex = HeuristicExtractor()
    verdict = ex.page_value("Copyright 2024 Press. All rights reserved. ISBN 978-0-00.")
    assert verdict["value_class"] == "LOW"
    assert "copyright" in verdict["noise_reasons"]


def test_distill_units_extracts_concept():
    ex = HeuristicExtractor()
    text = (
        "Velocity is defined as the rate of change of displacement with respect to time. "
        "For example, a car travels 100 metres in 5 seconds giving 20 metres per second."
    )
    units = ex.distill_units("book_x", 1, "Kinematics", text)
    assert units
    assert any("velocity" in u["concept"].lower() for u in units)


def test_misconceptions_reference_concept():
    ex = HeuristicExtractor()
    out = ex.misconceptions("Velocity", "Velocity is the rate of change of displacement.")
    assert len(out) >= 1
    assert all({"misconception", "explanation", "correction"} <= set(m) for m in out)


def test_problem_batch_fallback_uses_section_context_not_question_text():
    ex = HeuristicExtractor()
    text = (
        "1. Solve x squared minus five x plus six equals zero. "
        "2. Find the roots of the related polynomial. "
        "3. Determine when the expression is positive."
    )

    units = ex.distill_units(
        "book_x",
        1,
        "Quadratic equations practice pages 10-15",
        text,
    )

    assert len(units) == 1
    assert units[0]["concept"] == "Quadratic equations practice pages 10-15"
    assert "Solve" in units[0]["definition"]


def test_exercise_batches_follow_numbered_section_headings():
    pages = [
        (10, "1.1.Linear Equations and Inequalities\nProblems"),
        (11, "More problems"),
        (12, "1.2.Quadratic Equations\nProblems"),
    ]

    batches = _exercise_batches(pages, "Chapter 1", 6)

    assert [(title, [page for page, _ in batch]) for title, batch in batches] == [
        ("1.1 Linear Equations and Inequalities", [10, 11]),
        ("1.2 Quadratic Equations", [12]),
    ]
