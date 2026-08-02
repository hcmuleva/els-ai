from __future__ import annotations

import json

import pytest

from knowledge_pipeline.output_layout import (
    RUN_DIRECTORIES,
    artifact_path,
    create_run_directory,
    resolve_artifact,
)
from scripts.load_stores import _accepted_concepts, _storage_chunk_id


def test_run_directory_is_unique_and_structured(tmp_path) -> None:
    run_id, run_dir = create_run_directory(tmp_path, "run-001")

    assert run_id == "run-001"
    assert run_dir == tmp_path / "run-001"
    assert all((run_dir / name).is_dir() for name in RUN_DIRECTORIES)
    assert artifact_path(run_dir, "chunk_repository.json") == (
        run_dir / "chunks" / "chunk_repository.json"
    )

    with pytest.raises(FileExistsError):
        create_run_directory(tmp_path, "run-001")


def test_artifact_resolution_supports_structured_and_legacy_runs(tmp_path) -> None:
    _, structured = create_run_directory(tmp_path, "structured")
    target = artifact_path(structured, "concept_repository.json")
    target.write_text("[]", encoding="utf-8")
    (structured / "manifest.json").write_text(
        json.dumps(
            {
                "files": {
                    "concept_repository.json": "repositories/concept_repository.json"
                }
            }
        ),
        encoding="utf-8",
    )
    assert resolve_artifact(structured, "concept_repository.json") == target

    legacy = tmp_path / "legacy"
    legacy.mkdir()
    legacy_target = legacy / "concept_repository.json"
    legacy_target.write_text("[]", encoding="utf-8")
    (legacy / "manifest.json").write_text(
        json.dumps({"files": ["concept_repository.json", "manifest.json"]}),
        encoding="utf-8",
    )
    assert resolve_artifact(legacy, "concept_repository.json") == legacy_target


def test_storage_chunk_ids_preserve_each_run_version() -> None:
    assert _storage_chunk_id("run-a", "chunk-1") == "run-a:chunk-1"
    assert _storage_chunk_id("run-a", "chunk-1") != _storage_chunk_id(
        "run-b", "chunk-1"
    )


def test_store_loading_filters_rejected_concepts() -> None:
    concepts = [{"concept_id": "valid"}, {"concept_id": "rejected"}]
    chunks = [{"chunk_id": "chunk-1", "concept_id": "valid"}]

    accepted, accepted_ids = _accepted_concepts(concepts, chunks)

    assert accepted == [{"concept_id": "valid"}]
    assert accepted_ids == {"valid"}
