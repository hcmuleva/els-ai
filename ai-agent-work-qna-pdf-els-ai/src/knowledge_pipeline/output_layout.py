"""Immutable, run-scoped output layout and artifact resolution."""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_RUN_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")

ARTIFACT_PATHS: dict[str, Path] = {
    "document_structure.json": Path("extraction/document_structure.json"),
    "extraction_report.json": Path("extraction/extraction_report.json"),
    "document_validation.json": Path("validation/document_validation.json"),
    "knowledge_inventory.json": Path("analysis/knowledge_inventory.json"),
    "page_quality.json": Path("validation/page_quality.json"),
    "clean_corpus.json": Path("extraction/clean_corpus.json"),
    "quality_validation.json": Path("validation/quality_validation.json"),
    "ontology_repository.json": Path("repositories/ontology_repository.json"),
    "graph_validation.json": Path("validation/graph_validation.json"),
    "knowledge_repository.json": Path("repositories/knowledge_repository.json"),
    "concept_repository.json": Path("repositories/concept_repository.json"),
    "learning_objective_repository.json": Path(
        "repositories/learning_objective_repository.json"
    ),
    "competency_repository.json": Path("repositories/competency_repository.json"),
    "knowledge_graph.json": Path("repositories/knowledge_graph.json"),
    "assessment_repository.json": Path("repositories/assessment_repository.json"),
    "chunk_repository.json": Path("chunks/chunk_repository.json"),
    "embedding_ready.json": Path("embeddings/embedding_ready.json"),
    "vectordb_dataset.json": Path("embeddings/vectordb_dataset.json"),
    "misconception_repository.json": Path("repositories/misconception_repository.json"),
    "level_repository.json": Path("repositories/level_repository.json"),
    "composite_repository.json": Path("repositories/composite_repository.json"),
    "question_repository.json": Path("questions/question_repository.json"),
    "formula_repository.json": Path("repositories/formula_repository.json"),
    "figure_repository.json": Path("repositories/figure_repository.json"),
    "learning_path_repository.json": Path("repositories/learning_path_repository.json"),
    "chunk_quality_report.json": Path("validation/chunk_quality_report.json"),
    "approved_chunk_repository.json": Path("chunks/approved_chunk_repository.json"),
    "approved_vectordb_dataset.json": Path("embeddings/approved_vectordb_dataset.json"),
    "retrieval_validation.json": Path("validation/retrieval_validation.json"),
    "retrieval_approved_chunk_repository.json": Path(
        "chunks/retrieval_approved_chunk_repository.json"
    ),
    "store_load_report.json": Path("validation/store_load_report.json"),
}

RUN_DIRECTORIES = (
    "analysis",
    "chunks",
    "embeddings",
    "extraction",
    "questions",
    "repositories",
    "validation",
)


def generate_run_id(now: datetime | None = None) -> str:
    timestamp = (now or datetime.now(timezone.utc)).strftime("%Y%m%dT%H%M%S%fZ")
    return f"{timestamp}-{uuid.uuid4().hex[:8]}"


def create_run_directory(output_root: Path, run_id: str | None = None) -> tuple[str, Path]:
    root = Path(output_root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    selected = run_id or generate_run_id()
    if not _RUN_ID_RE.fullmatch(selected):
        raise ValueError(
            "run_id must start with an alphanumeric character and contain only "
            "letters, numbers, dots, underscores, or hyphens"
        )
    run_dir = root / selected
    run_dir.mkdir(parents=False, exist_ok=False)
    for directory in RUN_DIRECTORIES:
        (run_dir / directory).mkdir()
    return selected, run_dir


def artifact_path(run_dir: Path, name: str) -> Path:
    try:
        relative = ARTIFACT_PATHS[name]
    except KeyError as exc:
        raise KeyError(f"Unknown run artifact: {name}") from exc
    return Path(run_dir) / relative


def load_manifest(run_dir: Path) -> dict[str, Any]:
    path = Path(run_dir) / "manifest.json"
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_artifact(run_dir: Path, name: str) -> Path:
    run_dir = Path(run_dir)
    manifest_path = run_dir / "manifest.json"
    if manifest_path.exists():
        manifest = load_manifest(run_dir)
        files = manifest.get("files", {})
        recorded = files.get(name) if isinstance(files, dict) else None
        if recorded:
            return run_dir / Path(recorded)
    structured = artifact_path(run_dir, name)
    if structured.exists():
        return structured
    legacy = run_dir / name
    return legacy
