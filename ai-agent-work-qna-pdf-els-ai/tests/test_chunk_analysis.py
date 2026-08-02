from scripts.analyze_chunks import analyze


def _chunk(chunk_id: str, text: str, source_pages: list[int] | None = None) -> dict:
    return {
        "chunk_id": chunk_id,
        "concept_id": "concept-1",
        "chunk_type": "concept",
        "title": "Quadratic equations",
        "text": text,
        "metadata": {
            "book_id": "book-1",
            "source_pages": source_pages if source_pages is not None else [10],
        },
    }


def test_analysis_approves_complete_source_backed_chunk() -> None:
    text = "\n".join(
        [
            "CONCEPT: Quadratic equations",
            "WHAT: A quadratic equation is a polynomial equation of degree two with useful roots.",
            "WHY IT MATTERS: It models trajectories, areas, and many optimization problems.",
            "HOW IT WORKS: Rearrange the expression and apply factorization or the quadratic formula.",
            "EXAMPLE: Solve x² - 5x + 6 = 0 by finding the factors (x - 2)(x - 3).",
            "ASSESSMENT OPPORTUNITY: Ask learners to solve and verify a quadratic equation.",
        ]
    )

    approved, report = analyze([_chunk("chunk-1", text)])

    assert len(approved) == 1
    assert report["approval_rate"] == 1.0


def test_analysis_rejects_short_or_untraceable_chunks() -> None:
    approved, report = analyze([_chunk("chunk-1", "CONCEPT: x", source_pages=[])])

    assert approved == []
    assert report["rejected_chunks"] == 1
    assert "missing_source_pages" in report["rejection_reasons"]
