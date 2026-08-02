from knowledge_pipeline.stores import Embedder
from scripts.validate_retrieval import apply_concept_gate, evaluate


def test_retrieval_metrics_use_concept_ground_truth() -> None:
    chunks = [
        {
            "chunk_id": "quadratic",
            "concept_id": "c-quadratic",
            "title": "Quadratic equations",
            "text": "Quadratic equations use roots, factorization, discriminants, and parabolas.",
            "metadata": {"concept": "Quadratic equations", "topic": "Algebra"},
        },
        {
            "chunk_id": "periodic",
            "concept_id": "c-periodic",
            "title": "Periodic trends",
            "text": "Periodic trends describe atomic radius, ionization energy, and electronegativity.",
            "metadata": {"concept": "Periodic trends", "topic": "Inorganic chemistry"},
        },
    ]
    embedder = Embedder("hash", 384)
    vectors = embedder.embed([chunk["text"] for chunk in chunks])

    result = evaluate(chunks, vectors, embedder, top_k=1)

    assert result["metrics"]["coverage"] == 1.0
    assert result["metrics"]["mrr"] == 1.0


def test_recall_is_capped_by_retrieval_depth() -> None:
    chunks = [
        {
            "chunk_id": f"chunk-{index}",
            "concept_id": "concept-a",
            "title": "Shared concept",
            "text": f"Shared concept explanation and example number {index}.",
            "metadata": {"concept": "Shared concept"},
        }
        for index in range(7)
    ]
    embedder = Embedder("hash", 384)
    vectors = embedder.embed([chunk["text"] for chunk in chunks])

    result = evaluate(chunks, vectors, embedder, top_k=5)

    assert result["queries"][0]["recall_at_k"] == 0.7143
    assert result["queries"][0]["capped_recall_at_k"] == 1.0


def test_concept_gate_keeps_valid_chunks_and_rejects_invalid_ones() -> None:
    result = {
        "queries": [
            {
                "concept_id": "valid",
                "capped_recall_at_k": 0.8,
                "precision_at_k": 0.4,
                "mrr": 1.0,
                "ndcg": 0.9,
                "expected_chunks": ["valid-1"],
                "retrieved_chunks": ["valid-1"],
            },
            {
                "concept_id": "invalid",
                "capped_recall_at_k": 0.2,
                "precision_at_k": 0.2,
                "mrr": 1.0,
                "ndcg": 0.4,
                "expected_chunks": ["invalid-1"],
                "retrieved_chunks": ["other"],
            },
        ]
    }
    chunks = [
        {"chunk_id": "valid-1", "concept_id": "valid"},
        {"chunk_id": "invalid-1", "concept_id": "invalid"},
    ]

    approved = apply_concept_gate(result, chunks)

    assert result["passed"] is True
    assert result["partial"] is True
    assert result["accepted_concepts"] == ["valid"]
    assert result["rejected_concept_count"] == 1
    assert [chunk["chunk_id"] for chunk in approved] == ["valid-1"]
