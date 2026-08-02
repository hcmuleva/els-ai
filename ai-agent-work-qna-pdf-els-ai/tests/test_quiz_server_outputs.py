from __future__ import annotations

import json
import os

from scripts import quiz_server
from scripts.generate_questions import _default_output


def _quiz() -> dict:
    return {
        "quiz_id": "quiz-1",
        "quiz_title": "Mechanics",
        "questions": [{"question": {"id": "q1", "question_data": {"options": []}}}],
    }


def test_player_ignores_legacy_unvalidated_outputs(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(quiz_server, "_OUTPUT_DIR", tmp_path)
    (tmp_path / "legacy.json").write_text(json.dumps(_quiz()), encoding="utf-8")

    player = quiz_server.load_player_quiz()

    assert player["count"] == 0


def test_question_generation_defaults_to_a_unique_structured_folder() -> None:
    first = _default_output("Newton's Laws", "quiz-a")
    second = _default_output("Newton's Laws", "quiz-b")

    assert first.name == "question_set.json"
    assert first.parent.name == "questions"
    assert "question-runs" in first.parts
    assert first != second


def test_player_loads_latest_completed_validated_question_run(
    tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr(quiz_server, "_OUTPUT_DIR", tmp_path)
    older = tmp_path / "question-runs" / "older"
    newer = tmp_path / "question-runs" / "newer"
    failed = tmp_path / "question-runs" / "failed"
    for run, title, passed in (
        (older, "Older", True),
        (newer, "Newest validated", True),
        (failed, "Failed run", False),
    ):
        questions = run / "questions"
        questions.mkdir(parents=True)
        (questions / "question_set.json").write_text(
            json.dumps({**_quiz(), "quiz_title": title}), encoding="utf-8"
        )
        (run / "manifest.json").write_text(
            json.dumps(
                {
                    "status": "completed" if passed else "failed",
                    "validation_passed": passed,
                    "files": {"question_set.json": "questions/question_set.json"},
                }
            ),
            encoding="utf-8",
        )
    os.utime(older / "questions" / "question_set.json", (1, 1))
    os.utime(newer / "questions" / "question_set.json", (2, 2))

    player = quiz_server.load_player_quiz()

    assert player["quiz_title"] == "Newest validated"


def test_json_player_normalizes_instruction_and_learning_metadata(tmp_path) -> None:
    quiz = {
        "quiz_id": "quiz-player",
        "quiz_title": "Player",
        "questions": [
            {
                "question": {
                    "id": "q1",
                    "question_title": "Solve \\(x=1\\).",
                    "question_instruction": "Choose one answer.",
                    "question_data": {
                        "_meta": {
                            "topic": "Linear equations",
                            "level_band": "jee_main",
                            "bloom_level": "Apply",
                            "source_pages": [10, 11],
                        },
                        "options": [],
                    },
                }
            }
        ],
    }
    path = tmp_path / "question_set.json"
    path.write_text(json.dumps(quiz), encoding="utf-8")

    question = quiz_server.load_json_quiz(path)["questions"][0]

    assert question["instruction"] == "Choose one answer."
    assert question["level_band"] == "jee_main"
    assert question["bloom_level"] == "Apply"
    assert question["source_pages"] == [10, 11]


def test_json_player_hides_embedded_topic_reference_text(tmp_path) -> None:
    quiz = {
        "quiz_id": "quiz-math",
        "quiz_title": "Mathematics",
        "subject": "Mathematics",
        "questions": [
            {
                "question": {
                    "id": "q1",
                    "question_title": "Solve \\(x=1\\).",
                    "question_data": {
                        "_meta": {
                            "topic": (
                                "Mathematics, across all embedded topics: "
                                "1.1 Linear Equations practice pages 11-13"
                            )
                        },
                        "options": [],
                    },
                }
            }
        ],
    }
    path = tmp_path / "question_set.json"
    path.write_text(json.dumps(quiz), encoding="utf-8")

    question = quiz_server.load_json_quiz(path)["questions"][0]

    assert question["topic"] == "Mathematics"


def test_single_player_page_uses_maintainable_local_assets() -> None:
    html = quiz_server._HTML.read_text(encoding="utf-8")
    script = (
        quiz_server._WEB_DIR / "assets" / "question-player.js"
    ).read_text(encoding="utf-8")

    assert quiz_server._HTML.name == "question_player.html"
    assert "/assets/question-player.css" in html
    assert "/assets/question-player.js" in html
    assert "/vendor/mathjax/tex-svg.js" in html
    assert 'output: "svg"' in html
    assert "enableMenu: false" in html
    assert 'localStorage.removeItem("MathJax-Menu-Settings")' in html
    assert 'renderer: "SVG"' in html
    assert 'id="hintButton"' in script
    assert 'id="subjectFilter"' in script
    assert 'id="topicFilter"' in script
    assert 'id="diagramFilter"' in script
    assert 'id="statusFilter"' in script
    assert 'id="skipButton"' in script
    assert 'id="resetQuizButton"' in script
    assert "skipQuestion" in script
    assert "filteredEntries" in script
    assert "shuffledQuestions" in script
    assert "attemptSeed" in script
    assert "resetQuiz" in script
    assert "feedback-card" in script
    assert "safeSvg" in script
    assert "/api/player/subjects" in script
    assert "Fetch new questions" in script
