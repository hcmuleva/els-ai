import json

from knowledge_pipeline.config import PipelineConfig, ValidationThresholds
from knowledge_pipeline.output_layout import resolve_artifact
from knowledge_pipeline.pipeline import run_pipeline

SAMPLE = """# Foundations of Motion

Chapter 1: Kinematics

Velocity is defined as the rate of change of displacement with respect to time.
Acceleration is defined as the rate of change of velocity with respect to time.
The formula for average velocity is v = d / t.
For example, a car travels 100 metres in 5 seconds giving 20 metres per second.

Chapter 2: Newton's Laws

Force is defined as the product of mass and acceleration, given by F = m a.
The principle of inertia states that an object resists changes to its motion.
The process of solving a problem: first draw a diagram, second resolve forces, finally solve.
For example, a force of 10 newtons on a 2 kilogram mass gives 5 metres per second squared.

References
Copyright 2024 Press. All rights reserved. ISBN 978-0-00-000000-0.
"""

_REQUIRED_FILES = [
    "document_structure.json",
    "extraction_report.json",
    "document_validation.json",
    "knowledge_repository.json",
    "ontology_repository.json",
    "concept_repository.json",
    "learning_objective_repository.json",
    "competency_repository.json",
    "knowledge_graph.json",
    "graph_validation.json",
    "assessment_repository.json",
    "chunk_repository.json",
    "embedding_ready.json",
    "vectordb_dataset.json",
    "level_repository.json",
    "composite_repository.json",
    "question_repository.json",
    "formula_repository.json",
    "figure_repository.json",
    "learning_path_repository.json",
]


def _config(tmp_path):
    inp = tmp_path / "input"
    out = tmp_path / "output"
    inp.mkdir()
    out.mkdir()
    (inp / "sample.md").write_text(SAMPLE, encoding="utf-8")
    return PipelineConfig(
        provider="mock",
        input_dir=inp,
        output_dir=out,
        thresholds=ValidationThresholds(),
    )


def test_pipeline_end_to_end(tmp_path):
    config = _config(tmp_path)
    result = run_pipeline(config)

    for name in _REQUIRED_FILES:
        assert resolve_artifact(result.output_dir, name).exists(), f"missing {name}"

    counts = result.manifest["counts"]
    assert counts["concepts_passed"] >= 1
    assert counts["chunks"] >= 1
    assert counts["learning_objectives"] == counts["concepts_passed"] * 6
    assert counts["pages_kept"] <= counts["pages_total"]


def test_concepts_have_required_fields(tmp_path):
    config = _config(tmp_path)
    result = run_pipeline(config)
    concepts = json.loads(resolve_artifact(result.output_dir, "concept_repository.json").read_text("utf-8"))
    assert concepts
    required = {
        "concept_id", "concept_name", "concept_type", "difficulty",
        "importance_score", "confidence_score", "prerequisites",
        "dependencies", "related_concepts",
    }
    assert required <= set(concepts[0])


def test_vector_records_are_self_contained(tmp_path):
    config = _config(tmp_path)
    result = run_pipeline(config)
    records = json.loads(resolve_artifact(result.output_dir, "vectordb_dataset.json").read_text("utf-8"))
    assert records
    sample = records[0]
    assert {"id", "text", "metadata"} <= set(sample)
    assert "WHAT:" in sample["text"] and "ASSESSMENT OPPORTUNITY:" in sample["text"]
    assert "level_band" in sample["metadata"]
    assert sample["metadata"]["source_book"]
    assert sample["metadata"]["page_range"]
    assert "graph_neighbors" in sample["metadata"]
    assert all(record["metadata"]["chunk_type"] != "learning_objective" for record in records)


def test_offline_levels_are_unrated_never_faked(tmp_path):
    # In mock/offline mode we must not fabricate a difficulty level.
    config = _config(tmp_path)
    result = run_pipeline(config)
    levels = json.loads(resolve_artifact(result.output_dir, "level_repository.json").read_text("utf-8"))
    assert levels
    assert all(l["level_band"] == "unrated" for l in levels)
    assert all(l["level_source"] == "none" for l in levels)
    # No competitive composites can be built without real level judgments.
    composites = json.loads(resolve_artifact(result.output_dir, "composite_repository.json").read_text("utf-8"))
    assert composites == []


def test_offline_question_generation_is_template_fallback(tmp_path):
    config = _config(tmp_path)
    result = run_pipeline(config)
    questions = json.loads(resolve_artifact(result.output_dir, "question_repository.json").read_text("utf-8"))
    assert questions
    for q in questions:
        assert q["source"] == "template_fallback"
        # never faked to a competitive band offline
        assert q["level_band"] not in {"jee_main", "jee_advanced", "expert"}
        assert q["stem"] and q["options"]


def test_pipeline_creates_a_new_immutable_run_directory(tmp_path):
    config = _config(tmp_path)
    first = run_pipeline(config)
    first_manifest = (first.output_dir / "manifest.json").read_text(encoding="utf-8")

    second = run_pipeline(config)

    assert first.output_dir != second.output_dir
    assert first.output_dir.parent == second.output_dir.parent == config.output_dir
    assert (first.output_dir / "manifest.json").read_text(encoding="utf-8") == first_manifest
    assert first.manifest["run_id"] == first.run_id
    assert second.manifest["run_id"] == second.run_id
