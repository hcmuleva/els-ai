from knowledge_pipeline.stores import SqliteStore, build_relational_store


def _seed(store):
    store.init_schema()
    book = {
        "book_id": "b1", "title": "T", "subject": "Math", "curriculum": "NCERT",
        "domain": "math", "class_level": "12", "creator_id": None,
        "organization_id": None, "language": "en",
    }
    concepts = [
        {"concept_id": "c1", "book_id": "b1", "name": "Limits", "concept_type": "concept",
         "topic": "Calculus", "subtopic": None, "definition": "d1", "level_band": "beginner",
         "prerequisite_depth": 0, "centrality": 0.9, "metadata": {"run_id": "run-1"}},
        {"concept_id": "c2", "book_id": "b1", "name": "Derivatives", "concept_type": "concept",
         "topic": "Calculus", "subtopic": None, "definition": "d2", "level_band": "intermediate",
         "prerequisite_depth": 1, "centrality": 0.7, "metadata": {"run_id": "run-1"}},
    ]
    edges = [{"source_id": "c2", "target_id": "c1", "relation_type": "prerequisite", "weight": 1.0}]
    chunks = [
        {"chunk_id": "ch1", "book_id": "b1", "concept_id": "c1", "topic": "Calculus",
         "level_band": "beginner", "content": "Limits context", "token_estimate": 3,
         "metadata": {"run_id": "run-1"}, "vector_point_id": "p1"},
        {"chunk_id": "ch2", "book_id": "b1", "concept_id": "c2", "topic": "Calculus",
         "level_band": "intermediate", "content": "Derivative context", "token_estimate": 3,
         "metadata": {"run_id": "run-1"}, "vector_point_id": "p2"},
    ]
    store.load_book_assets(book, concepts, edges, chunks, [])


def test_factory_returns_sqlite(tmp_path):
    store = build_relational_store(f"sqlite:{tmp_path/'kp.sqlite'}")
    assert isinstance(store, SqliteStore)


def test_recursive_prereq_and_topic(tmp_path):
    store = SqliteStore(str(tmp_path / "kp.sqlite"))
    _seed(store)
    chain = store.prerequisite_chain("c2")
    assert [r["concept_id"] for r in chain] == ["c1"]
    topics = store.concepts_by_topic("calc")
    assert {r["concept_id"] for r in topics} == {"c1", "c2"}
    filtered = store.concepts_by_topic("Calculus", level_band="beginner")
    assert [r["concept_id"] for r in filtered] == ["c1"]


def test_upsert_edges_idempotent(tmp_path):
    store = SqliteStore(str(tmp_path / "kp.sqlite"))
    _seed(store)
    n = store.upsert_edges(
        [{"source_id": "c2", "target_id": "c1", "relation_type": "prerequisite", "weight": 2.0}]
    )
    assert n == 1
    rel = store.related_concepts("c2")
    assert rel[0]["weight"] == 2.0


def test_catalog_lists_only_persisted_run_content(tmp_path):
    store = SqliteStore(str(tmp_path / "kp.sqlite"))
    _seed(store)

    subjects = store.catalog_subjects(query="mat", source_run_id="run-1")
    assert subjects == [{
        "subject": "Math",
        "topic_count": 1,
        "concept_count": 2,
        "chunk_count": 2,
        "run_ids": ["run-1"],
    }]

    topics = store.catalog_topics(subject="math", query="calc", source_run_id="run-1")
    assert topics == [{
        "subject": "Math",
        "topic": "Calculus",
        "source_run_id": "run-1",
        "concept_count": 2,
        "chunk_count": 2,
        "book_titles": ["T"],
        "book_ids": ["b1"],
    }]
    assert store.catalog_topics(source_run_id="missing") == []
    assert {
        row["concept_id"]
        for row in store.concepts_by_topic("Calculus", source_run_id="run-1")
    } == {"c1", "c2"}
    assert {
        row["concept_id"]
        for row in store.concepts_by_subject("Math", source_run_ids=["run-1"])
    } == {"c1", "c2"}
    assert store.concepts_by_subject("Math", source_run_ids=["missing"]) == []


def test_persisted_quiz_subjects_and_player_round_trip(tmp_path):
    store = SqliteStore(str(tmp_path / "kp.sqlite"))
    store.init_schema()
    store.insert_quiz(
        {
            "quiz_id": "quiz-physics",
            "book_id": None,
            "title": "Induction",
            "subject": "Physics",
            "class_level": "12",
            "level_band": "jee_main",
            "creator_id": None,
            "organization_id": None,
            "metadata": {"topic": "Electromagnetic Induction"},
        },
        [{
            "question_id": "q-physics",
            "quiz_id": "quiz-physics",
            "concept_id": "c-induction",
            "question_type": "single_choice",
            "level_band": "jee_main",
            "bloom_level": "Apply",
            "stem": "Find the induced emf.",
            "explanation": "Use Faraday's law.",
            "svg": "<svg></svg>",
            "diagram": None,
            "metadata": {
                "instruction": "Choose one answer.",
                "topic": "Electromagnetic Induction",
                "source_pages": [2, 3],
            },
        }],
        {
            "q-physics": [{
                "option_id": "option-a",
                "question_id": "q-physics",
                "position": 1,
                "text": "2 V",
                "is_correct": True,
                "svg": None,
                "diagram": None,
                "rationale": "Correct application.",
            }]
        },
    )

    assert store.quiz_subjects()[0]["subject"] == "Physics"
    assert store.quiz_subjects()[0]["question_count"] == 1

    player = store.load_player_quiz(subject="physics")
    assert player["subject"] == "Physics"
    assert player["count"] == 1
    assert player["questions"][0]["topic"] == "Electromagnetic Induction"
    assert player["questions"][0]["source_pages"] == [2, 3]
    assert player["questions"][0]["options"][0]["is_correct"] is True
    assert store.load_player_quiz(subject="Chemistry")["questions"] == []


def test_player_hides_duplicate_stems_and_keeps_newest_quiz_record(tmp_path):
    store = SqliteStore(str(tmp_path / "kp.sqlite"))
    store.init_schema()

    def insert(quiz_id, question_id, stem):
        store.insert_quiz(
            {
                "quiz_id": quiz_id,
                "book_id": None,
                "title": quiz_id,
                "subject": "Physics",
                "class_level": "12",
                "level_band": "jee_main",
                "creator_id": None,
                "organization_id": None,
                "metadata": {},
            },
            [{
                "question_id": question_id,
                "quiz_id": quiz_id,
                "concept_id": None,
                "question_type": "single_choice",
                "level_band": "jee_main",
                "bloom_level": "Apply",
                "stem": stem,
                "explanation": quiz_id,
                "svg": None,
                "diagram": None,
                "metadata": {"topic": "Mechanics"},
            }],
            {},
        )

    insert("old-quiz", "old-question", "Find the acceleration of the body.")
    insert("new-quiz", "new-question", "Find the acceleration of the body.")
    insert("new-quiz", "unique-question", "Find the work done by the force.")

    with store.connect() as conn:
        conn.execute("UPDATE quizzes SET created_at = '2026-01-01 00:00:00' WHERE quiz_id = 'old-quiz'")
        conn.execute("UPDATE quizzes SET created_at = '2026-01-02 00:00:00' WHERE quiz_id = 'new-quiz'")
        conn.commit()

    player = store.load_player_quiz(subject="Physics")

    assert player["count"] == 2
    assert [question["explanation"] for question in player["questions"]] == [
        "new-quiz",
        "new-quiz",
    ]
