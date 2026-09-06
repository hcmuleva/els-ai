from qfactory import quality_gate, solver
from qfactory.types import Level


def _scq(correct_count=1, opts=4):
    options = [{"text": f"opt {i}", "is_correct": i < correct_count} for i in range(opts)]
    return {
        "questionType": "SCQ",
        "difficulty": "JEE_Main",
        "question": "A reasonably long stem requiring a couple of reasoning steps to solve.",
        "options": options,
        "solution": {"finalAnswer": "opt 0", "stepByStep": ["step"]},
    }


def test_scq_with_two_correct_fails():
    res = quality_gate.evaluate(_scq(correct_count=2), Level.JEE_MAIN, solver.SKIPPED, True)
    assert not res.passed


def test_good_scq_passes():
    res = quality_gate.evaluate(_scq(), Level.JEE_MAIN, solver.VERIFIED, True)
    assert res.passed
    assert res.checks["answerVerified"] is True


def test_mcq_with_single_correct_fails():
    item = _scq(correct_count=1)
    item["questionType"] = "MCQ"
    res = quality_gate.evaluate(item, Level.JEE_ADVANCED, solver.SKIPPED, True)
    assert not res.passed


def test_refuted_answer_fails():
    res = quality_gate.evaluate(_scq(), Level.JEE_MAIN, solver.REFUTED, True)
    assert not res.passed


def test_numerical_requires_answer_and_spec():
    item = {
        "questionType": "Numerical",
        "difficulty": "Board",
        "question": "Find the molarity of the prepared solution in mol per litre.",
        "options": [],
        "solution": {"finalAnswer": "0.25", "stepByStep": ["step"]},
    }
    assert not quality_gate.evaluate(item, Level.BOARD, solver.SKIPPED, True).passed
    item["numericAnswer"] = 0.25
    item["verification"] = {"kind": "numeric", "expression": "0.5/2", "expected": 0.25}
    assert quality_gate.evaluate(item, Level.BOARD, solver.VERIFIED, True).passed
