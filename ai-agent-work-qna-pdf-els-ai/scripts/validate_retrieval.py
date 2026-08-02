"""Embed approved chunks and validate semantic retrieval before store loading."""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.stores import Embedder  # noqa: E402
from knowledge_pipeline.retrieval_improvement import (  # noqa: E402
    RetrievalValidationImprover,
)
from knowledge_pipeline.output_layout import (  # noqa: E402
    artifact_path,
    load_manifest,
    resolve_artifact,
)

CONCEPT_THRESHOLDS = {
    "capped_recall_at_k": 0.60,
    "precision_at_k": 0.20,
    "mrr": 0.80,
    "ndcg": 0.60,
}


def _dot(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def _dcg(relevance: list[int]) -> float:
    return sum(value / math.log2(index + 2) for index, value in enumerate(relevance))


def _representative_query(chunk: dict, concept_id: str) -> str:
    metadata = chunk.get("metadata") or {}
    concept = metadata.get("concept") or chunk.get("title") or concept_id
    text = " ".join(str(chunk.get("text") or "").split())
    if "WHAT:" in text:
        text = text.split("WHAT:", 1)[1].split("WHY IT MATTERS:", 1)[0].strip()
    if len(text) >= 40:
        return f"Find educational material about {concept}: {text[:240]}"
    topic = metadata.get("topic") or ""
    return f"Explain {concept} in {topic} and show how it is applied."


def evaluate(chunks: list[dict], vectors: list[list[float]], embedder: Embedder, top_k: int) -> dict:
    by_concept: dict[str, list[int]] = defaultdict(list)
    for index, chunk in enumerate(chunks):
        by_concept[str(chunk.get("concept_id", ""))].append(index)

    queries: list[dict] = []
    covered_concepts: set[str] = set()
    for concept_id, expected_indices in by_concept.items():
        representative = chunks[expected_indices[0]]
        query = _representative_query(representative, concept_id)
        query_vector = embedder.embed_one(query)
        ranked = sorted(
            range(len(chunks)),
            key=lambda index: _dot(query_vector, vectors[index]),
            reverse=True,
        )[:top_k]
        expected = set(expected_indices)
        relevance = [1 if index in expected else 0 for index in ranked]
        hits = sum(relevance)
        recall = hits / len(expected)
        capped_recall = hits / min(len(expected), top_k)
        precision = hits / len(ranked) if ranked else 0.0
        reciprocal_rank = next(
            (1.0 / (rank + 1) for rank, value in enumerate(relevance) if value),
            0.0,
        )
        ideal = [1] * min(len(expected), top_k)
        ndcg = _dcg(relevance) / _dcg(ideal) if ideal else 0.0
        if hits:
            covered_concepts.add(concept_id)
        queries.append(
            {
                "query": query,
                "concept_id": concept_id,
                "expected_chunks": [chunks[index]["chunk_id"] for index in expected_indices],
                "retrieved_chunks": [chunks[index]["chunk_id"] for index in ranked],
                "recall_at_k": round(recall, 4),
                "capped_recall_at_k": round(capped_recall, 4),
                "precision_at_k": round(precision, 4),
                "mrr": round(reciprocal_rank, 4),
                "ndcg": round(ndcg, 4),
            }
        )

    count = len(queries)
    metrics = {
        "recall_at_k": round(sum(item["recall_at_k"] for item in queries) / count, 4) if count else 0,
        "capped_recall_at_k": round(
            sum(item["capped_recall_at_k"] for item in queries) / count, 4
        ) if count else 0,
        "precision_at_k": round(sum(item["precision_at_k"] for item in queries) / count, 4) if count else 0,
        "mrr": round(sum(item["mrr"] for item in queries) / count, 4) if count else 0,
        "ndcg": round(sum(item["ndcg"] for item in queries) / count, 4) if count else 0,
        "coverage": round(len(covered_concepts) / count, 4) if count else 0,
    }
    failed_concepts = [
        item["concept_id"]
        for item in queries
        if item["recall_at_k"] == 0 or item["mrr"] == 0
    ]
    return {"metrics": metrics, "queries": queries, "failed_concepts": failed_concepts}


def apply_concept_gate(
    result: dict,
    chunks: list[dict],
    thresholds: dict[str, float] | None = None,
) -> list[dict]:
    thresholds = dict(thresholds or CONCEPT_THRESHOLDS)
    accepted_concepts: list[str] = []
    rejected_concepts: list[dict] = []
    for query in result["queries"]:
        reasons = [
            f"{metric}={query[metric]:.4f} below {minimum:.4f}"
            for metric, minimum in thresholds.items()
            if query[metric] < minimum
        ]
        query["accepted"] = not reasons
        query["rejection_reasons"] = reasons
        if query["accepted"]:
            accepted_concepts.append(query["concept_id"])
        else:
            rejected_concepts.append(
                {
                    "concept_id": query["concept_id"],
                    "reasons": reasons,
                }
            )
    accepted = set(accepted_concepts)
    result["thresholds"] = thresholds
    result["accepted_concepts"] = accepted_concepts
    result["rejected_concepts"] = rejected_concepts
    result["accepted_concept_count"] = len(accepted_concepts)
    result["rejected_concept_count"] = len(rejected_concepts)
    result["passed"] = bool(accepted_concepts)
    result["partial"] = bool(accepted_concepts and rejected_concepts)
    result["status"] = (
        "partial"
        if result["partial"]
        else "passed"
        if result["passed"]
        else "failed"
    )
    result["failed_concepts"] = [item["concept_id"] for item in rejected_concepts]
    result["improvement"] = RetrievalValidationImprover().diagnose(result)
    approved = [chunk for chunk in chunks if chunk.get("concept_id") in accepted]
    result["approved_chunks"] = len(approved)
    result["rejected_chunks"] = len(chunks) - len(approved)
    return approved


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--chunks-file", default="approved_chunk_repository.json")
    parser.add_argument("--model", default="BAAI/bge-small-en-v1.5")
    parser.add_argument("--dimension", type=int, default=384)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--allow-hash-fallback", action="store_true")
    parser.add_argument(
        "--report-file",
        default="validation/retrieval_validation.json",
        help="Run-relative path for the immutable validation report.",
    )
    parser.add_argument(
        "--approved-output-file",
        default="chunks/retrieval_approved_chunk_repository.json",
        help="Run-relative path for chunks belonging to accepted concepts.",
    )
    args = parser.parse_args()

    output_dir = args.output_dir.resolve()
    manifest = load_manifest(output_dir)
    report_path = _run_relative_path(output_dir, args.report_file)
    approved_path = _run_relative_path(output_dir, args.approved_output_file)
    existing = [path for path in (report_path, approved_path) if path.exists()]
    if existing:
        raise SystemExit(
            "Retrieval validation outputs already exist; create a new pipeline run instead of "
            f"overwriting: {', '.join(str(path) for path in existing)}"
        )
    requested = Path(args.chunks_file)
    if requested.is_absolute():
        chunks_path = requested
    elif len(requested.parts) > 1 and (output_dir / requested).exists():
        chunks_path = output_dir / requested
    else:
        chunks_path = resolve_artifact(output_dir, requested.name)
    chunks = json.loads(chunks_path.read_text(encoding="utf-8"))
    if not chunks:
        raise SystemExit("No approved chunks are available for retrieval validation.")

    embedder = Embedder(args.model, args.dimension)
    vectors = embedder.embed([chunk["text"] for chunk in chunks])
    if embedder.backend != "fastembed" and not args.allow_hash_fallback:
        raise SystemExit(
            f"Semantic retrieval validation requires fastembed; backend={embedder.backend}."
        )
    result = evaluate(chunks, vectors, embedder, args.top_k)
    result.update(
        {
            "embedding_model": args.model,
            "embedding_backend": embedder.backend,
            "run_id": manifest.get("run_id") or output_dir.name,
            "top_k": args.top_k,
        }
    )
    approved = apply_concept_gate(result, chunks)

    report_path.parent.mkdir(parents=True, exist_ok=True)
    approved_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(result, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    approved_path.write_text(
        json.dumps(approved, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"[retrieval] backend={embedder.backend} metrics={result['metrics']}")
    print(
        f"[retrieval] accepted {result['accepted_concept_count']}/{len(result['queries'])} "
        f"concepts and approved {result['approved_chunks']}/{len(chunks)} chunks; "
        f"status={result['status']}"
    )
    return 0 if result["passed"] else 2


def _run_relative_path(output_dir: Path, value: str) -> Path:
    requested = Path(value)
    if requested.is_absolute():
        raise ValueError("validation outputs must remain inside the immutable run")
    target = (output_dir / requested).resolve()
    if output_dir not in target.parents:
        raise ValueError("validation output path leaves the immutable run")
    return target


if __name__ == "__main__":
    raise SystemExit(main())
