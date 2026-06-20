from qfactory.pipeline import run
from qfactory.types import QType

_SUPPORTED = {t.value for t in (QType.SCQ, QType.MCQ, QType.TF, QType.NUMERICAL, QType.ASSERTION_REASON)}


def _answer_consistent(q):
    qtype = q["questionType"]
    keys = [o["key"] for o in q.get("options", [])]
    ans = q["correctAnswer"]
    if qtype == "Numerical":
        try:
            float(ans)
        except (TypeError, ValueError):
            return False
        return q["options"] == []
    if qtype == "MCQ":
        return isinstance(ans, list) and len(ans) >= 2 and all(a in keys for a in ans)
    if qtype == "TF":
        return str(ans).lower() in ("true", "false")
    return ans in keys


def test_physics_jee_main_pilot():
    resp = run({
        "class": 12, "subject": "Physics", "chapter": "Electrostatics",
        "difficulty": "JEE_Main", "questionCount": 5,
        "questionTypes": ["SCQ", "Numerical", "AssertionReason"],
    })
    assert resp["validation"]["schemaValid"] is True
    assert resp["metadata"]["totalQuestions"] >= 1
    for q in resp["questions"]:
        assert q["questionType"] in _SUPPORTED
        assert q["difficulty"] == "JEE_Main"
        assert q["chapter"] == "Electrostatics"
        assert _answer_consistent(q)


def test_mixed_chemistry_has_types_and_verifications():
    resp = run({
        "class": 12, "subject": "Chemistry", "difficulty": "Mixed", "questionCount": 8,
        "questionTypes": ["SCQ", "MCQ", "TF", "Numerical", "AssertionReason"],
    })
    assert resp["metadata"]["totalQuestions"] >= 5
    assert resp["validation"]["verified"] >= 1
    for q in resp["questions"]:
        assert _answer_consistent(q)


def test_types_are_limited_to_request():
    resp = run({
        "class": 12, "subject": "Mathematics", "difficulty": "Mixed",
        "questionCount": 6, "questionTypes": ["Numerical"],
    })
    for q in resp["questions"]:
        assert q["questionType"] == "Numerical"
