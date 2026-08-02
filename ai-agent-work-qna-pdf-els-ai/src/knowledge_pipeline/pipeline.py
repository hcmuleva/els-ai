"""End-to-end orchestration of the 14-phase knowledge pipeline."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .config import PipelineConfig
from .extractors import build_extractor
from .ingestion import load_documents
from .output_layout import create_run_directory
from .phases import (
    p00_document,
    p01_discovery,
    p02_quality,
    p04_distillation,
    p05_concepts,
    p08_competency,
    p09_graph,
    p10_assessment,
    p12_embedding,
    p14_output,
    p15_generation,
    p_composite,
    p_levels,
    p_validation,
)


@dataclass
class PipelineResult:
    manifest: dict
    output_dir: Path
    run_id: str


def _log(step: str, msg: str) -> None:
    print(f"[{step:>7}] {msg}")


def run_pipeline(config: Optional[PipelineConfig] = None) -> PipelineResult:
    config = config or PipelineConfig.load()
    run_id, run_dir = create_run_directory(config.output_dir, config.output_run_id)
    _log("output", f"run_id={run_id} directory={run_dir}")
    provider = config.resolved_provider()
    extractor = build_extractor(config)
    _log("setup", f"provider={provider} extractor={extractor.name}")

    books = load_documents(config.input_dir)
    if not books:
        raise SystemExit(
            f"No source documents found in {config.input_dir}. "
            "Add .pdf/.txt/.md files (or run scripts/make_sample_pdf.py)."
        )
    _log("ingest", f"{len(books)} book(s), {sum(b.num_pages for b in books)} pages")

    # Phases 0 + 0.5
    document_structure = p00_document.build_structure(books)
    extraction_report = p00_document.extraction_report(books)
    document_validation = p00_document.validate(books, document_structure)
    _log(
        "phase0",
        f"document integrity={document_validation['integrity_score']}/100 "
        f"passed={document_validation['passed']}",
    )

    # Phase 1
    inventory = p01_discovery.run(books, extractor)
    _log("phase1", f"{inventory.total_chapters} chapters, {inventory.total_topics} topics")

    # Phases 2 + 3
    pages = p02_quality.score_pages(books, extractor, config)
    pages = p02_quality.remove_noise(pages)
    clean_pages = p02_quality.clean_corpus(pages)
    _log("phase2-3", f"{len(clean_pages)}/{len(pages)} pages kept after noise removal")

    # Phase 4
    units = p04_distillation.run(books, clean_pages, extractor)
    _log("phase4", f"{len(units)} distilled knowledge units")

    # Phase 5
    all_concepts = p05_concepts.extract_concepts(units)
    _log("phase5", f"{len(all_concepts)} candidate concepts")

    # Phase 10 (needed for validation) then Phase 11
    all_assessments = p10_assessment.classify_assessments(all_concepts)
    validations = p10_assessment.validate(all_concepts, all_assessments, config.thresholds)
    passed_ids = {v.concept_id for v in validations if v.passed}
    concepts = [c for c in all_concepts if c.concept_id in passed_ids]
    _log("phase11", f"{len(concepts)}/{len(all_concepts)} concepts passed validation")

    assessments = [a for a in all_assessments if a.concept_id in passed_ids]

    # Phase 6, 7, 8, 9 on the validated set
    objectives = p05_concepts.generate_objectives(concepts)
    misconceptions = p05_concepts.generate_misconceptions(concepts, extractor)
    _log("phase6-7", f"{len(objectives)} objectives, {len(misconceptions)} misconceptions")

    competencies = p08_competency.run(concepts)
    graph = p09_graph.run(concepts)
    _log("phase8-9", f"{len(graph.nodes)} nodes, {len(graph.edges)} edges")
    ontology = p_validation.build_ontology(concepts, competencies, assessments, misconceptions)
    graph_validation = p_validation.validate_graph(graph, concepts)
    _log(
        "phase9.5",
        f"connectivity={graph_validation['metrics']['connectivity']:.1%} "
        f"passed={graph_validation['passed']}",
    )

    # Phase L: LLM-driven level calibration (offline -> 'unrated', never faked).
    # Hybrid runs can point just this phase at a different (LLM) provider.
    if config.level_provider and config.level_provider != provider:
        level_extractor = build_extractor(config, provider=config.level_provider)
        _log("phaseL", f"level provider override -> {level_extractor.name}")
    else:
        level_extractor = extractor
    level_profiles = p_levels.run(concepts, level_extractor)
    rated = sum(1 for p in level_profiles if p.level_band.value != "unrated")
    _log("phaseL", f"{rated}/{len(level_profiles)} concepts level-rated ({level_extractor.name})")

    # Phase C: graph-based multi-concept composite assembly
    composites = p_composite.run(concepts, level_profiles, config.generation)
    _log("phaseC", f"{len(composites)} composite (multi-concept) bundles")

    # Phases 12 + 13 (level band carried into metadata)
    embedding_units = p12_embedding.build_embedding_units(
        concepts, objectives, misconceptions, assessments, level_profiles
    )
    chunks = p12_embedding.build_chunks(
        concepts, objectives, assessments, config.chunk_max_chars, level_profiles
    )
    p_validation.enrich_embedding_metadata(
        chunks,
        embedding_units,
        concepts=concepts,
        objectives=objectives,
        competencies=competencies,
        assessments=assessments,
        graph=graph,
        inventory=inventory,
    )
    _log("phase12-13", f"{len(embedding_units)} embedding units, {len(chunks)} chunks")
    formula_repository = p_validation.build_formula_repository(concepts)
    figure_repository = p_validation.build_figure_repository(document_structure)
    learning_paths = p_validation.build_learning_paths(concepts)

    # Phase 15: level-aware question generation (local-first)
    questions = p15_generation.run(
        concepts, level_profiles, misconceptions, assessments, composites, extractor,
        config.generation,
    )
    _log("phase15", f"{len(questions)} questions generated")

    # Phase 14
    manifest = p14_output.write_all(
        run_dir,
        run_id=run_id,
        provider=extractor.name,
        document_structure=document_structure,
        extraction_report=extraction_report,
        document_validation=document_validation,
        inventory=inventory,
        pages=pages,
        clean_pages=clean_pages,
        units=units,
        concepts=concepts,
        objectives=objectives,
        misconceptions=misconceptions,
        competencies=competencies,
        graph=graph,
        ontology=ontology,
        graph_validation=graph_validation,
        assessments=assessments,
        validations=validations,
        embedding_units=embedding_units,
        chunks=chunks,
        level_profiles=level_profiles,
        composites=composites,
        questions=questions,
        formula_repository=formula_repository,
        figure_repository=figure_repository,
        learning_paths=learning_paths,
    )
    _log("phase14", f"wrote {len(manifest['files'])} files to {run_dir}")
    return PipelineResult(manifest=manifest, output_dir=run_dir, run_id=run_id)
