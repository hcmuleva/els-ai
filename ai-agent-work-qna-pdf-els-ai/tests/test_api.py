import json

from fastapi.testclient import TestClient

from knowledge_pipeline.api.app import create_app
from knowledge_pipeline.config import PipelineConfig
from knowledge_pipeline.diagram.from_spec import build_diagram_from_spec
from knowledge_pipeline.serving.context import StubRetriever
from knowledge_pipeline.serving.llm import StubLLM
from knowledge_pipeline.serving.question_service import (
    QuestionGenerationService,
    normalize_generated_item,
    validate_complex_geometry_item,
    validate_generated_item,
)


class _Jobs:
    def create(self, filename, content):
        return {
            "job_id": "ingest-test",
            "status": "queued",
            "filename": filename,
            "size": len(content),
            "run_id": "document-test",
        }

    def get(self, job_id):
        if job_id != "ingest-test":
            raise KeyError(job_id)
        return {"job_id": job_id, "status": "completed", "run_id": "document-test"}


class _Questions:
    def generate(self, **kwargs):
        return {
            "quiz_id": "quiz-test",
            "count": kwargs["count"],
            "topic": kwargs["topic"],
            "diagram_mode": kwargs["diagram_mode"],
            "generation_profile": kwargs["generation_profile"],
            "diagram_families": kwargs["diagram_families"],
            "validation": {"passed": True},
            "questions": [],
        }


class _Catalog:
    def catalog_classes(self, **kwargs):
        return [{
            "class_level": "Class 12",
            "subject_count": 1,
            "topic_count": 2,
            "concept_count": 3,
            "chunk_count": 8,
            "run_ids": ["document-test"],
        }]

    def catalog_subjects(self, **kwargs):
        return [{
            "subject": "Physics",
            "topic_count": 2,
            "concept_count": 3,
            "chunk_count": 8,
            "run_ids": ["document-test"],
        }]

    def catalog_topics(self, **kwargs):
        assert kwargs["subject"] == "Physics"
        return [{
            "subject": "Physics",
            "topic": "Electromagnetic Induction",
            "source_run_id": "document-test",
            "concept_count": 2,
            "chunk_count": 5,
            "book_titles": ["Revision Notes"],
        }]

    def quiz_subjects(self):
        return [{
            "subject": "Physics",
            "quiz_count": 1,
            "question_count": 1,
            "latest_created_at": "2026-07-22T10:00:00",
        }]

    def load_player_quiz(self, **kwargs):
        assert kwargs["subject"] == "Physics"
        return {
            "quiz_id": "persisted:Physics:quiz-test:1",
            "quiz_title": "Physics Question Bank",
            "subject": "Physics",
            "count": 1,
            "questions": [{
                "id": "question-test",
                "topic": "Electromagnetic Induction",
                "options": [],
            }],
        }


def _client():
    config = PipelineConfig(provider="mock")
    return TestClient(
        create_app(
            config=config,
            job_manager=_Jobs(),
            question_service=_Questions(),
            catalog_store=_Catalog(),
        )
    )


def test_upload_and_job_status_api():
    client = _client()
    response = client.post(
        "/api/documents",
        files={"file": ("book.md", b"# Algebra", "text/markdown")},
    )

    assert response.status_code == 202
    assert response.json()["run_id"] == "document-test"
    assert client.get("/api/jobs/ingest-test").json()["status"] == "completed"
    assert client.get("/api/jobs/missing").status_code == 404


def test_question_generation_api_returns_json():
    response = _client().post(
        "/api/questions",
        json={"topic": "Integrals", "count": 5, "level_band": "moderate"},
    )

    assert response.status_code == 200
    assert response.json()["count"] == 5
    assert response.json()["validation"]["passed"] is True


def test_question_generation_api_accepts_subject_without_topic():
    response = _client().post(
        "/api/questions",
        json={"subject": "Physics", "count": 5, "level_band": "moderate"},
    )

    assert response.status_code == 200
    assert response.json()["topic"] is None


def test_question_generation_api_accepts_diagram_only_mode():
    response = _client().post(
        "/api/questions",
        json={
            "subject": "Physics",
            "count": 3,
            "diagram_mode": "diagram_only",
        },
    )

    assert response.status_code == 200
    assert response.json()["diagram_mode"] == "diagram_only"


def test_question_generation_api_accepts_complex_geometry_profile():
    response = _client().post(
        "/api/questions",
        json={
            "subject": "Mathematics",
            "topic": "Circle geometry",
            "count": 5,
            "level_band": "difficult",
            "diagram_mode": "diagram_only",
            "generation_profile": "jee_geometry_complex",
            "diagram_families": ["triangle-geometry", "circle-geometry"],
        },
    )

    assert response.status_code == 200
    assert response.json()["generation_profile"] == "jee_geometry_complex"
    assert response.json()["diagram_families"] == [
        "triangle-geometry",
        "circle-geometry",
    ]


def test_diagram_gallery_is_served():
    response = _client().get("/diagrams")

    assert response.status_code == 200
    assert "Deterministic Diagram Gallery" in response.text


def test_local_mathjax_asset_is_served():
    response = _client().head("/vendor/mathjax/tex-svg.js")

    assert response.status_code == 200


def test_admin_page_shows_live_ingestion_progress():
    response = _client().get("/")

    assert response.status_code == 200
    assert 'id="job-progress-track"' in response.text
    assert 'id="job-log"' in response.text
    assert "Detailed live log" in response.text
    assert "progress_percent" in response.text
    assert 'id="class-picker"' in response.text
    assert 'id="subject-picker"' in response.text
    assert 'id="topic-picker"' in response.text
    assert "All topics" in response.text
    assert "if (!payload.topic) delete payload.topic" in response.text
    assert "/api/catalog/classes" in response.text
    assert "/api/catalog/topics" in response.text
    assert 'id="question-preview"' in response.text
    assert "renderQuestionPreview(result)" in response.text
    assert "safeSvg(value)" in response.text
    assert "Check answer" in response.text
    assert "Raw generated JSON" in response.text
    assert 'output: "svg"' in response.text
    assert "enableMenu: false" in response.text
    assert 'localStorage.removeItem("MathJax-Menu-Settings")' in response.text
    assert 'renderer: "SVG"' in response.text
    assert "result.validation?.partial" in response.text
    assert "Diagram-only output" in response.text
    assert 'payload.diagram_mode = form.has("diagram_only")' in response.text
    assert "What does persistence do?" in response.text
    assert "Rejected questions are never stored." in response.text


def test_embedded_content_catalog_api():
    client = _client()

    classes = client.get("/api/catalog/classes").json()
    subjects = client.get("/api/catalog/subjects?query=phys").json()
    topics = client.get(
        "/api/catalog/topics",
        params={"class_level": "Class 12", "subject": "Physics", "source_run_id": "document-test"},
    ).json()

    assert classes["items"][0]["class_level"] == "Class 12"
    assert subjects["items"][0]["subject"] == "Physics"
    assert topics["items"][0]["topic"] == "Electromagnetic Induction"
    assert topics["items"][0]["source_run_id"] == "document-test"


def test_persisted_question_player_api_and_page():
    client = _client()

    subjects = client.get("/api/player/subjects").json()
    player = client.get("/api/player", params={"subject": "Physics"}).json()
    page = client.get("/player")

    assert subjects["items"][0]["question_count"] == 1
    assert player["subject"] == "Physics"
    assert player["questions"][0]["topic"] == "Electromagnetic Induction"
    assert page.status_code == 200
    assert "Knowledge Question Player" in page.text


def test_generated_item_validation_contract():
    valid = {
        "stem": "What is \\(2+2\\)?",
        "options": [
            {"label": "\\(4\\)", "is_correct": True},
            {"label": "\\(3\\)", "is_correct": False},
            {"label": "\\(5\\)", "is_correct": False},
            {"label": "\\(6\\)", "is_correct": False},
        ],
        "explanation": "Adding gives \\(4\\).",
    }
    assert validate_generated_item(valid) == []

    valid["options"][3]["label"] = "\\(5\\)"
    assert "option labels must be unique" in validate_generated_item(valid)


def test_complex_geometry_validation_requires_rich_requested_family():
    rich = build_diagram_from_spec({
        "type": "circle-geometry",
        "circles": [{"center": [0, 0], "radius": 3, "role": "circle"}],
        "segments": [
            {"a": [3, -3], "b": [3, 3], "role": "tangent", "label": "t"},
            {"a": [-4, -1], "b": [3.5, 1.5], "role": "secant"},
            {"a": [0, 0], "b": [3, 0], "role": "radius", "label": "OT"},
            {"a": [-3, 0], "b": [3, 0], "role": "diameter"},
        ],
        "points": [[0, 0, "O"], [3, 0, "T"], [-3, 0, "A"]],
    })

    assert rich is not None
    assert validate_complex_geometry_item(
        {"question_diagram": rich}, ["circle-geometry"]
    ) == []
    assert "not one of the requested geometry families" in " ".join(
        validate_complex_geometry_item(
            {"question_diagram": rich}, ["triangle-geometry"]
        )
    )


def test_generated_item_rejects_malformed_notation_before_returning_quiz():
    item = {
        "stem": r"A circuit has \(R=20,Omega\) and \(C=100,mumathrmF\).",
        "options": [
            {"label": r"\(1,mathrmA\)", "is_correct": True},
            {"label": r"\(2,mathrmA\)", "is_correct": False},
            {"label": r"\(3,mathrmA\)", "is_correct": False},
            {"label": r"\(4,mathrmA\)", "is_correct": False},
        ],
        "explanation": r"The current is \(1,mathrmA\).",
    }

    normalized = normalize_generated_item(item)

    issues = validate_generated_item(normalized)
    assert "multi-letter text in math must use a LaTeX command or text/roman group" in issues


def test_question_service_returns_grounded_validated_json():
    config = PipelineConfig(provider="local")
    class RecordingRetriever(StubRetriever):
        search_filter = None

        def vector_search(self, query, top_k=5, flt=None):
            self.search_filter = flt
            return super().vector_search(query, top_k, flt)

    retriever = RecordingRetriever(
        vector_hits=[
            {
                "payload": {
                    "chunk_id": "run-1:chunk-1",
                    "run_id": "run-1",
                    "book_id": "book-1",
                    "topic": "Integrals",
                    "content": "The definite integral gives signed area.",
                    "source_pages": [12],
                }
            }
        ],
        concepts=[
            {
                "concept_id": "concept-1",
                "name": "Definite Integral",
                "topic": "Integrals",
                "definition": "A limit of sums.",
            }
        ],
    )
    completion = json.dumps(
        {
            "questions": [
                {
                    "stem": "Evaluate \\(\\int_0^1 2x\\,dx\\).",
                    "options": [
                        {"text": "\\(1\\)", "is_correct": True},
                        {"text": "\\(0\\)", "is_correct": False},
                        {"text": "\\(2\\)", "is_correct": False},
                        {"text": "\\(4\\)", "is_correct": False},
                    ],
                    "explanation": "\\([x^2]_0^1=1\\).",
                    "bloom_level": "Apply",
                    "diagram": None,
                }
            ]
        }
    )

    class Relational:
        source_run_id = None

        def concepts_by_topic(self, *_args, **kwargs):
            self.source_run_id = kwargs.get("source_run_id")
            return [{"concept_id": "concept-1"}]

    relational = Relational()
    result = QuestionGenerationService(
        config,
        retriever=retriever,
        llm=StubLLM(completion),
        relational=relational,
    ).generate(
        subject="Mathematics",
        topic="Integrals",
        count=1,
        source_run_id="run-1",
        max_attempts=1,
    )

    assert result["count"] == 1
    assert result["validation"]["passed"] is True
    assert result["subject"] == "Mathematics"
    assert result["source_chunk_ids"] == ["run-1:chunk-1"]
    assert retriever.search_filter == {
        "topic": "Integrals",
        "subject": "Mathematics",
        "run_id": "run-1",
    }
    assert relational.source_run_id == "run-1"
    meta = result["questions"][0]["question"]["question_data"]["_meta"]
    assert meta["source_run_id"] == "run-1"
    assert meta["source_pages"] == [12]


def test_question_service_returns_valid_partial_result_instead_of_502():
    config = PipelineConfig(provider="local")
    retriever = StubRetriever(
        vector_hits=[{
            "payload": {
                "chunk_id": "run-1:chunk-1",
                "run_id": "run-1",
                "book_id": "book-1",
                "topic": "Magnetic Flux",
                "content": "Magnetic flux is the surface integral of the magnetic field.",
                "source_pages": [2],
            }
        }]
    )
    completion = json.dumps({
        "questions": [
            {
                "stem": "Which quantity measures magnetic field through a surface?",
                "options": [
                    {"text": "Magnetic flux", "is_correct": True},
                    {"text": "Resistance", "is_correct": False},
                    {"text": "Power", "is_correct": False},
                    {"text": "Charge", "is_correct": False},
                ],
                "explanation": "Magnetic flux measures field through a surface.",
                "diagram": {
                    "type": "magnetic-flux",
                    "area_label": "A",
                    "field_label": "B",
                    "normal_label": "n",
                    "angle_degrees": 60,
                    "angle_label": "θ",
                },
            },
            {
                "stem": "Which unit is used for magnetic flux?",
                "options": [
                    {"text": "Weber", "is_correct": True},
                    {"text": "Tesla", "is_correct": False},
                    {"text": "Ohm", "is_correct": False},
                    {"text": "Watt", "is_correct": False},
                ],
                "explanation": "The SI unit of magnetic flux is the weber.",
                "diagram": None,
            },
        ]
    })

    class Relational:
        def concepts_by_topic(self, *_args, **_kwargs):
            return [{"concept_id": "concept-1"}]

    result = QuestionGenerationService(
        config,
        retriever=retriever,
        llm=StubLLM(completion),
        relational=Relational(),
    ).generate(
        subject="Physics",
        topic="Magnetic Flux",
        count=2,
        diagram_mode="diagram_only",
        max_attempts=1,
    )

    assert result["requested_count"] == 2
    assert result["count"] == 1
    assert result["validation"]["passed"] is True
    assert result["validation"]["complete"] is False
    assert result["validation"]["partial"] is True
    assert result["diagram_mode"] == "diagram_only"
    assert result["questions"][0]["question"]["question_svg"].startswith("<svg")
    assert "valid_meaningful_diagram" in result["validation"]["rules"]
    assert "exact_count" not in result["validation"]["rules"]
    assert result["validation"]["message"] == (
        "Generated 1 of 2 requested valid questions."
    )


def test_question_service_retries_with_string_repair_instructions():
    config = PipelineConfig(provider="local")
    retriever = StubRetriever(
        vector_hits=[{
            "payload": {
                "chunk_id": "run-1:chunk-1",
                "run_id": "run-1",
                "book_id": "book-1",
                "topic": "Magnetic Flux",
                "content": "Magnetic flux depends on field, area, and orientation.",
                "source_pages": [2],
            }
        }]
    )

    def completion(diagram):
        return json.dumps({
            "questions": [{
                "stem": "Which quantity measures magnetic field through a surface?",
                "options": [
                    {"text": "Magnetic flux", "is_correct": True},
                    {"text": "Resistance", "is_correct": False},
                    {"text": "Power", "is_correct": False},
                    {"text": "Charge", "is_correct": False},
                ],
                "explanation": "Magnetic flux measures field through a surface.",
                "diagram": diagram,
            }]
        })

    class SequenceLLM:
        def __init__(self):
            self.prompts = []
            self.responses = [
                completion({"type": "angle", "degrees": 60}),
                completion({
                    "type": "magnetic-flux",
                    "area_label": "A",
                    "field_label": "B",
                    "normal_label": "n",
                    "angle_label": "θ",
                }),
            ]

        def complete(self, prompt):
            self.prompts.append(prompt)
            return self.responses.pop(0)

    class Relational:
        def concepts_by_topic(self, *_args, **_kwargs):
            return [{"concept_id": "concept-1"}]

    llm = SequenceLLM()
    result = QuestionGenerationService(
        config,
        retriever=retriever,
        llm=llm,
        relational=Relational(),
    ).generate(
        subject="Physics",
        topic="Magnetic Flux",
        count=1,
        diagram_mode="diagram_only",
        max_attempts=2,
    )

    assert result["count"] == 1
    assert result["validation"]["attempts"] == 2
    assert "REPAIR REQUIREMENTS FROM THE PREVIOUS ATTEMPT" in llm.prompts[1]
    assert "magnetic-flux loop diagram" in llm.prompts[1]


def test_question_service_generates_across_all_subject_topics():
    config = PipelineConfig(provider="local")

    class RecordingRetriever(StubRetriever):
        search_filter = None

        def vector_search(self, query, top_k=5, flt=None):
            self.search_filter = flt
            return super().vector_search(query, top_k, flt)

    retriever = RecordingRetriever(
        vector_hits=[{
            "payload": {
                "chunk_id": "run-1:chunk-1",
                "run_id": "run-1",
                "book_id": "book-1",
                "topic": "Magnetic Flux",
                "content": "Magnetic flux depends on field, area, and orientation.",
                "source_pages": [2],
            }
        }]
    )
    completion = json.dumps({
        "questions": [{
            "stem": "Which quantity describes magnetic field through a surface?",
            "options": [
                {"text": "Magnetic flux", "is_correct": True},
                {"text": "Resistance", "is_correct": False},
                {"text": "Capacitance", "is_correct": False},
                {"text": "Power", "is_correct": False},
            ],
            "explanation": "Magnetic flux measures the field passing through a surface.",
            "bloom_level": "Understand",
            "diagram": None,
        }]
    })

    class Relational:
        source_run_ids = None

        def catalog_topics(self, **_kwargs):
            return [
                {
                    "topic": "Magnetic Flux",
                    "source_run_id": "run-1",
                    "book_ids": ["book-1"],
                },
                {
                    "topic": "Transformers",
                    "source_run_id": "run-1",
                    "book_ids": ["book-1"],
                },
            ]

        def concepts_by_subject(self, _subject, **kwargs):
            self.source_run_ids = kwargs["source_run_ids"]
            return [{"concept_id": "concept-1"}]

    relational = Relational()
    result = QuestionGenerationService(
        config,
        retriever=retriever,
        llm=StubLLM(completion),
        relational=relational,
    ).generate(
        subject="Physics",
        count=1,
        max_attempts=1,
    )

    assert result["scope"] == "subject"
    assert result["topic"] is None
    assert result["topics"] == ["Magnetic Flux", "Transformers"]
    assert (
        result["questions"][0]["question"]["question_data"]["_meta"]["topic"]
        == "Physics"
    )
    assert result["source_run_ids"] == ["run-1"]
    assert retriever.search_filter == {
        "subject": "Physics",
        "topic": ["Magnetic Flux", "Transformers"],
    }
    assert relational.source_run_ids == ["run-1"]


def test_subject_generation_falls_back_to_scalar_topic_searches():
    config = PipelineConfig(provider="local")

    class ScalarOnlyRetriever(StubRetriever):
        search_filters = []

        def vector_search(self, query, top_k=5, flt=None):
            self.search_filters.append(flt)
            if isinstance((flt or {}).get("topic"), list):
                return []
            if (flt or {}).get("topic") == "Magnetic Flux":
                return [{
                    "payload": {
                        "chunk_id": "run-1:chunk-1",
                        "run_id": "run-1",
                        "book_id": "book-1",
                        "subject": "Physics",
                        "topic": "Magnetic Flux",
                        "content": "Magnetic flux measures field through a surface.",
                        "source_pages": [2],
                    }
                }]
            return []

    completion = json.dumps({
        "questions": [{
            "stem": "Which quantity describes magnetic field through a surface?",
            "options": [
                {"text": "Magnetic flux", "is_correct": True},
                {"text": "Resistance", "is_correct": False},
                {"text": "Capacitance", "is_correct": False},
                {"text": "Power", "is_correct": False},
            ],
            "explanation": "Magnetic flux measures field through a surface.",
            "diagram": None,
        }]
    })

    class Relational:
        def catalog_topics(self, **_kwargs):
            return [
                {
                    "topic": "Magnetic Flux",
                    "source_run_id": "run-1",
                    "book_ids": ["book-1"],
                },
                {
                    "topic": "Transformers",
                    "source_run_id": "run-1",
                    "book_ids": ["book-1"],
                },
            ]

        def concepts_by_subject(self, *_args, **_kwargs):
            return [{"concept_id": "concept-1"}]

    retriever = ScalarOnlyRetriever()
    result = QuestionGenerationService(
        config,
        retriever=retriever,
        llm=StubLLM(completion),
        relational=Relational(),
    ).generate(
        subject="Physics",
        count=1,
        max_attempts=1,
    )

    assert result["count"] == 1
    assert retriever.search_filters[0] == {
        "subject": "Physics",
        "topic": ["Magnetic Flux", "Transformers"],
    }
    assert retriever.search_filters[1] == {
        "subject": "Physics",
        "topic": "Magnetic Flux",
    }
