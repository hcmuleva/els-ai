"""Phase 14 - Final Output.

Writes the nine normalized JSON repositories plus phase intermediates and a
run manifest. Also assembles the VectorDB-ready dataset from the semantic chunks.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from ..models import (
    AssessmentProfile,
    Chunk,
    Concept,
    CompetencyRecord,
    CompositeSpec,
    DistilledUnit,
    EmbeddingUnit,
    GeneratedQuestion,
    KnowledgeGraph,
    KnowledgeInventoryReport,
    LearningObjective,
    LevelProfile,
    Misconception,
    PageContent,
    QualityScores,
    VectorRecord,
)
from ..output_layout import artifact_path
from ..utils import write_json


def _dump(items) -> list[dict]:
    return [i.model_dump(mode="json") for i in items]


def _tally(values) -> dict[str, int]:
    counts: dict[str, int] = {}
    for v in values:
        counts[v] = counts.get(v, 0) + 1
    return dict(sorted(counts.items()))


def build_vector_dataset(chunks: list[Chunk]) -> list[VectorRecord]:
    records: list[VectorRecord] = []
    for ch in chunks:
        meta = dict(ch.metadata)
        meta.update(
            {
                "concept_id": ch.concept_id,
                "chunk_type": ch.chunk_type,
                "title": ch.title,
            }
        )
        records.append(VectorRecord(id=ch.chunk_id, text=ch.text, metadata=meta))
    return records


def write_all(
    output_dir: Path,
    *,
    run_id: str,
    provider: str,
    document_structure: dict,
    extraction_report: dict,
    document_validation: dict,
    inventory: KnowledgeInventoryReport,
    pages: list[PageContent],
    clean_pages: list[PageContent],
    units: list[DistilledUnit],
    concepts: list[Concept],
    objectives: list[LearningObjective],
    misconceptions: list[Misconception],
    competencies: list[CompetencyRecord],
    graph: KnowledgeGraph,
    ontology: dict,
    graph_validation: dict,
    assessments: list[AssessmentProfile],
    validations: list[QualityScores],
    embedding_units: list[EmbeddingUnit],
    chunks: list[Chunk],
    level_profiles: list[LevelProfile],
    composites: list[CompositeSpec],
    questions: list[GeneratedQuestion],
    formula_repository: list[dict],
    figure_repository: list[dict],
    learning_paths: list[dict],
) -> dict:
    output_dir = Path(output_dir)
    vector_records = build_vector_dataset(chunks)

    files = {
        # phase intermediates
        "document_structure.json": document_structure,
        "extraction_report.json": extraction_report,
        "document_validation.json": document_validation,
        "knowledge_inventory.json": inventory.model_dump(mode="json"),
        "page_quality.json": _dump(pages),
        "clean_corpus.json": _dump(clean_pages),
        "quality_validation.json": _dump(validations),
        "ontology_repository.json": ontology,
        "graph_validation.json": graph_validation,
        # the nine required repositories
        "knowledge_repository.json": _dump(units),
        "concept_repository.json": _dump(concepts),
        "learning_objective_repository.json": _dump(objectives),
        "competency_repository.json": _dump(competencies),
        "knowledge_graph.json": graph.model_dump(mode="json"),
        "assessment_repository.json": _dump(assessments),
        "chunk_repository.json": _dump(chunks),
        "embedding_ready.json": _dump(embedding_units),
        "vectordb_dataset.json": _dump(vector_records),
        # misconceptions (feed quiz distractors / explanations)
        "misconception_repository.json": _dump(misconceptions),
        # level calibration + generation
        "level_repository.json": _dump(level_profiles),
        "composite_repository.json": _dump(composites),
        "question_repository.json": _dump(questions),
        "formula_repository.json": formula_repository,
        "figure_repository.json": figure_repository,
        "learning_path_repository.json": learning_paths,
    }

    artifact_files = {
        name: artifact_path(output_dir, name).relative_to(output_dir).as_posix()
        for name in files
    }
    for name, data in files.items():
        write_json(artifact_path(output_dir, name), data)

    manifest = {
        "run_id": run_id,
        "layout_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "extractor_provider": provider,
        "counts": {
            "books": len(inventory.books),
            "document_integrity_score": document_validation.get("integrity_score", 0),
            "pages_total": len(pages),
            "pages_kept": len(clean_pages),
            "distilled_units": len(units),
            "concepts_passed": len(concepts),
            "learning_objectives": len(objectives),
            "misconceptions": len(misconceptions),
            "competencies": len(competencies),
            "graph_nodes": len(graph.nodes),
            "graph_edges": len(graph.edges),
            "assessment_profiles": len(assessments),
            "chunks": len(chunks),
            "embedding_units": len(embedding_units),
            "vector_records": len(vector_records),
            "ontology_entities": len(ontology.get("entities", [])),
            "formulae": len(formula_repository),
            "figures": len(figure_repository),
            "composites": len(composites),
            "questions": len(questions),
        },
        "level_bands": _tally(p.level_band.value for p in level_profiles),
        "question_bands": _tally(q.level_band.value for q in questions),
        "question_sources": _tally(q.source for q in questions),
        "files": {**dict(sorted(artifact_files.items())), "manifest.json": "manifest.json"},
    }
    write_json(output_dir / "manifest.json", manifest)
    return manifest
