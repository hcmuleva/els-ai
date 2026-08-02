"""Load pipeline output (JSON repositories) into Qdrant + Postgres.

Usage:
    python scripts/load_stores.py [--output-dir data/output] [--recreate]

Reads: knowledge_inventory, concept_repository, knowledge_graph,
chunk_repository, level_repository. Writes: Postgres (metadata + relations) and
Qdrant (chunk vectors). Identity fields come from config/env (never hardcoded).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.config import PipelineConfig  # noqa: E402
from knowledge_pipeline.output_layout import (  # noqa: E402
    artifact_path,
    load_manifest,
    resolve_artifact,
)
from knowledge_pipeline.stores import Embedder, QdrantStore, build_relational_store  # noqa: E402
from knowledge_pipeline.stores.qdrant_store import point_id_for  # noqa: E402


def _load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _resolve_requested_artifact(output_dir: Path, value: str) -> Path:
    requested = Path(value)
    if requested.is_absolute():
        return requested
    direct = output_dir / requested
    if len(requested.parts) > 1 and direct.exists():
        return direct
    return resolve_artifact(output_dir, requested.name)


def _storage_chunk_id(run_id: str, source_chunk_id: str) -> str:
    return f"{run_id}:{source_chunk_id}"


def _accepted_concepts(
    concepts: list[dict], chunks: list[dict]
) -> tuple[list[dict], set[str]]:
    accepted_ids = {
        str(chunk.get("concept_id"))
        for chunk in chunks
        if chunk.get("concept_id")
    }
    return (
        [
            concept
            for concept in concepts
            if str(concept.get("concept_id")) in accepted_ids
        ],
        accepted_ids,
    )


def _map_edges(graph: dict) -> list[dict]:
    out = []
    for e in graph.get("edges", []):
        rel = e.get("relation", "related")
        if rel == "prerequisite_dependent":
            # graph edge is (prereq -> concept); our convention: concept depends on prereq
            out.append(
                {"source_id": e["target"], "target_id": e["source"],
                 "relation_type": "prerequisite", "weight": float(e.get("weight", 1.0))}
            )
        else:
            out.append(
                {"source_id": e["source"], "target_id": e["target"],
                 "relation_type": rel, "weight": float(e.get("weight", 1.0))}
            )
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output-dir", required=True, help="Exact immutable run directory.")
    ap.add_argument(
        "--chunks-file",
        default="retrieval_approved_chunk_repository.json",
        help="chunk repository filename within the output directory",
    )
    ap.add_argument(
        "--allow-unvalidated",
        action="store_true",
        help="allow loading without passed document, chunk, and retrieval validation reports",
    )
    ap.add_argument(
        "--retrieval-report",
        default="retrieval_validation.json",
        help="validation report filename or run-relative path",
    )
    ap.add_argument("--recreate", action="store_true", help="recreate the Qdrant collection")
    args = ap.parse_args()

    cfg = PipelineConfig.load()
    out_dir = Path(args.output_dir).resolve()
    manifest = load_manifest(out_dir)
    run_id = str(manifest.get("run_id") or out_dir.name)
    retrieval_report_path = _resolve_requested_artifact(
        out_dir, args.retrieval_report
    )
    report_path = artifact_path(out_dir, "store_load_report.json")
    if report_path.exists():
        raise SystemExit(
            "Store load report already exists; create a new pipeline run instead of "
            f"overwriting: {report_path}"
        )
    if not args.allow_unvalidated:
        gates = {
            "document": _load(resolve_artifact(out_dir, "document_validation.json")).get("passed"),
            "chunk": (
                _load(resolve_artifact(out_dir, "chunk_quality_report.json")).get(
                    "approval_rate", 0
                )
                >= 0.8
            ),
            "retrieval": _load(retrieval_report_path).get("passed"),
        }
        if not all(gates.values()):
            raise SystemExit(f"Store loading blocked by validation gates: {gates}")

    inventory = _load(resolve_artifact(out_dir, "knowledge_inventory.json"))
    concepts_raw = _load(resolve_artifact(out_dir, "concept_repository.json"))
    graph = _load(resolve_artifact(out_dir, "knowledge_graph.json"))
    chunks_path = _resolve_requested_artifact(out_dir, args.chunks_file)
    chunks_raw = _load(chunks_path)
    concepts_raw, accepted_concept_ids = _accepted_concepts(
        concepts_raw, chunks_raw
    )
    levels_raw = _load(resolve_artifact(out_dir, "level_repository.json"))

    levels_by_id = {l["concept_id"]: l for l in levels_raw}
    ident = cfg.identity

    # ---- Relational (Postgres or SQLite) -----------------------------------
    pg = build_relational_store(cfg.stores.postgres_dsn)
    print(f"[load] init relational schema ({type(pg).__name__}) ...")
    pg.init_schema()

    concepts = []
    for c in concepts_raw:
        lvl = levels_by_id.get(c["concept_id"], {})
        concepts.append(
            {
                "concept_id": c["concept_id"],
                "book_id": c.get("book_id"),
                "name": c.get("concept_name", ""),
                "concept_type": c.get("concept_type"),
                "topic": c.get("topic"),
                "subtopic": c.get("subtopic"),
                "definition": c.get("definition"),
                "level_band": lvl.get("level_band", "unrated"),
                "prerequisite_depth": int(lvl.get("prerequisite_depth", 0) or 0),
                "centrality": float(c.get("importance_score", 0.0) or 0.0),
                "metadata": {
                    "run_id": run_id,
                    "examples": c.get("examples", []),
                    "formulae": c.get("formulae", []),
                    "facts": c.get("facts", []),
                    "difficulty": c.get("difficulty"),
                },
            }
        )

    chunks = []
    for ch in chunks_raw:
        meta = ch.get("metadata", {})
        source_chunk_id = ch["chunk_id"]
        storage_chunk_id = _storage_chunk_id(run_id, source_chunk_id)
        chunks.append(
            {
                "chunk_id": storage_chunk_id,
                "book_id": meta.get("book_id"),
                "concept_id": ch.get("concept_id"),
                "topic": meta.get("topic"),
                "level_band": meta.get("level_band", "unrated"),
                "content": ch.get("text", ""),
                "token_estimate": max(1, len(ch.get("text", "")) // 4),
                "metadata": {
                    **meta,
                    "run_id": run_id,
                    "source_chunk_id": source_chunk_id,
                    "chunk_type": ch.get("chunk_type"),
                    "title": ch.get("title"),
                },
                "vector_point_id": point_id_for(storage_chunk_id),
            }
        )

    level_profiles = [
        {
            "concept_id": l["concept_id"],
            "level_band": l.get("level_band", "unrated"),
            "intrinsic_difficulty": l.get("intrinsic_difficulty"),
            "reasoning_level": l.get("reasoning_level"),
            "steps_required": int(l.get("steps_required", 0) or 0),
            "concepts_combined": int(l.get("concepts_combined", 1) or 1),
            "confidence": float(l.get("confidence", 0.0) or 0.0),
            "rationale": l.get("rationale"),
            "source": l.get("level_source"),
        }
        for l in levels_raw
    ]

    concepts_by_book: dict[str, list] = {}
    for c in concepts:
        concepts_by_book.setdefault(c["book_id"], []).append(c)
    chunks_by_book: dict[str, list] = {}
    for ch in chunks:
        chunks_by_book.setdefault(ch["book_id"], []).append(ch)
    levelset = {c["concept_id"] for c in concepts}

    for book in inventory.get("books", []):
        bid = book["book_id"]
        bid_ids = {c["concept_id"] for c in concepts_by_book.get(bid, [])}
        
        # Infer class level dynamically from filename/title if present (e.g. Class-6 -> Class 6)
        book_title = book.get("title", "")
        book_filename = book.get("filename", "")
        import re
        match = re.search(r"\b(class|grade)[\s\-_]*([0-9]{1,2})\b", f"{book_title} {book_filename}", re.IGNORECASE)
        inferred_class = f"Class {match.group(2)}" if match else ident.class_level

        pg.load_book_assets(
            book={
                "book_id": bid,
                "title": book_title,
                "subject": book.get("subject") or ident.subject,
                "curriculum": book.get("curriculum"),
                "domain": book.get("domain"),
                "class_level": inferred_class,
                "creator_id": ident.creator_id,
                "organization_id": ident.organization_id,
                "language": ident.language,
            },
            concepts=concepts_by_book.get(bid, []),
            edges=[],
            chunks=chunks_by_book.get(bid, []),
            level_profiles=[lp for lp in level_profiles if lp["concept_id"] in bid_ids],
        )
        print(f"[load] Postgres book {bid}: "
              f"{len(concepts_by_book.get(bid, []))} concepts, {len(chunks_by_book.get(bid, []))} chunks")

    edges = [e for e in _map_edges(graph) if e["source_id"] in levelset and e["target_id"] in levelset]
    n_edges = pg.upsert_edges(edges)
    print(f"[load] Postgres edges: {n_edges}")

    # ---- Qdrant ------------------------------------------------------------
    emb = Embedder(cfg.stores.embedding_model, cfg.stores.embedding_dim)
    qs = QdrantStore(cfg.stores.qdrant_url, cfg.stores.qdrant_collection, cfg.stores.embedding_dim, emb)
    print(f"[load] ensure Qdrant collection '{cfg.stores.qdrant_collection}' ...")
    qs.ensure_collection(recreate=args.recreate)
    q_points = [
        {
            "chunk_id": ch["chunk_id"],
            "content": ch["content"],
            "payload": {
                "chunk_id": ch["chunk_id"],
                "concept_id": ch["concept_id"],
                "book_id": ch["book_id"],
                "topic": ch["topic"],
                "level_band": ch["level_band"],
                "content": ch["content"],
                "run_id": run_id,
                **ch["metadata"],
            },
        }
        for ch in chunks
    ]
    n = qs.upsert_chunks(q_points)
    qs.close()
    print(f"[load] Qdrant upserted {n} points (embedder backend: {emb.backend})")
    try:
        chunks_file = chunks_path.relative_to(out_dir).as_posix()
    except ValueError:
        chunks_file = str(chunks_path)
    report = {
        "run_id": run_id,
        "chunks_file": chunks_file,
        "relational_backend": type(pg).__name__,
        "qdrant_collection": cfg.stores.qdrant_collection,
        "embedding_model": cfg.stores.embedding_model,
        "embedding_backend": emb.backend,
        "concepts": len(concepts),
        "chunks": len(chunks),
        "edges": n_edges,
        "qdrant_points": n,
        "accepted_concepts": len(accepted_concept_ids),
        "retrieval_report": (
            retrieval_report_path.relative_to(out_dir).as_posix()
            if out_dir in retrieval_report_path.parents
            else str(retrieval_report_path)
        ),
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("[load] done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
