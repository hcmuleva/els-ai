"""Validate generated chunks before they are embedded and indexed."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.output_layout import artifact_path, load_manifest, resolve_artifact  # noqa: E402

_REQUIRED_SECTIONS = (
    "CONCEPT:",
    "WHAT:",
    "WHY IT MATTERS:",
    "HOW IT WORKS:",
    "ASSESSMENT OPPORTUNITY:",
)
_WORD_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9'²³⁻+./-]*")


def analyze(
    chunks: list[dict],
    *,
    known_concepts: set[str] | None = None,
    pages_by_book: dict[str, int] | None = None,
) -> tuple[list[dict], dict]:
    seen: set[str] = set()
    seen_ids: set[str] = set()
    approved: list[dict] = []
    records: list[dict] = []

    for chunk in chunks:
        text = str(chunk.get("text", "")).strip()
        metadata = chunk.get("metadata") or {}
        words = _WORD_RE.findall(text)
        visible = [char for char in text if not char.isspace()]
        alphanumeric_ratio = (
            sum(char.isalnum() for char in visible) / len(visible) if visible else 0.0
        )
        fingerprint = hashlib.sha1(
            re.sub(r"\W+", " ", text.lower()).strip().encode("utf-8")
        ).hexdigest()
        reasons: list[str] = []
        chunk_id = str(chunk.get("chunk_id", ""))
        concept_id = str(chunk.get("concept_id", ""))

        if len(text) < 180:
            reasons.append("text_too_short")
        if len(words) < 30:
            reasons.append("insufficient_words")
        if alphanumeric_ratio < 0.55:
            reasons.append("low_alphanumeric_ratio")
        if any(section not in text for section in _REQUIRED_SECTIONS):
            reasons.append("missing_required_section")
        if not metadata.get("book_id"):
            reasons.append("missing_book_id")
        if not metadata.get("source_pages"):
            reasons.append("missing_source_pages")
        if known_concepts is not None and concept_id not in known_concepts:
            reasons.append("unknown_concept")
        if pages_by_book is not None and metadata.get("book_id") in pages_by_book:
            upper_bound = pages_by_book[metadata["book_id"]]
            if any(
                not isinstance(page, int) or page < 0 or page >= upper_bound
                for page in metadata.get("source_pages", [])
            ):
                reasons.append("source_page_out_of_range")
        if text.endswith("..."):
            reasons.append("truncated_text")
        if "\ufffd" in text:
            reasons.append("unicode_replacement_character")
        if not chunk_id or chunk_id in seen_ids:
            reasons.append("duplicate_or_missing_chunk_id")
        if fingerprint in seen:
            reasons.append("duplicate_text")
        seen_ids.add(chunk_id)
        seen.add(fingerprint)

        passed = not reasons
        if passed:
            approved.append(chunk)
        records.append(
            {
                "chunk_id": chunk_id,
                "passed": passed,
                "reasons": reasons,
                "characters": len(text),
                "words": len(words),
                "alphanumeric_ratio": round(alphanumeric_ratio, 3),
            }
        )

    reason_counts = Counter(reason for record in records for reason in record["reasons"])
    report = {
        "total_chunks": len(chunks),
        "approved_chunks": len(approved),
        "rejected_chunks": len(chunks) - len(approved),
        "approval_rate": round(len(approved) / len(chunks), 4) if chunks else 0.0,
        "rejection_reasons": dict(sorted(reason_counts.items())),
        "records": records,
    }
    return approved, report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--min-approval-rate", type=float, default=0.8)
    args = parser.parse_args()

    output_dir = args.output_dir.resolve()
    manifest = load_manifest(output_dir)
    chunks = json.loads(
        resolve_artifact(output_dir, "chunk_repository.json").read_text(encoding="utf-8")
    )
    concepts = json.loads(
        resolve_artifact(output_dir, "concept_repository.json").read_text(encoding="utf-8")
    )
    inventory = json.loads(
        resolve_artifact(output_dir, "knowledge_inventory.json").read_text(encoding="utf-8")
    )
    document_validation = json.loads(
        resolve_artifact(output_dir, "document_validation.json").read_text(encoding="utf-8")
    )
    approved, report = analyze(
        chunks,
        known_concepts={concept["concept_id"] for concept in concepts},
        pages_by_book={book["book_id"]: book["num_pages"] for book in inventory["books"]},
    )
    report["run_id"] = manifest.get("run_id") or output_dir.name
    report["upstream_gates"] = {
        "document_integrity": bool(document_validation.get("passed")),
    }

    report_path = artifact_path(output_dir, "chunk_quality_report.json")
    approved_path = artifact_path(output_dir, "approved_chunk_repository.json")
    vector_path = artifact_path(output_dir, "approved_vectordb_dataset.json")
    existing = [path for path in (report_path, approved_path, vector_path) if path.exists()]
    if existing:
        raise SystemExit(
            "Chunk validation outputs already exist; create a new pipeline run instead of "
            f"overwriting: {', '.join(str(path) for path in existing)}"
        )
    for path in (report_path, approved_path, vector_path):
        path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    approved_path.write_text(json.dumps(approved, indent=2, ensure_ascii=False), encoding="utf-8")
    vectors = [
        {
            "id": chunk["chunk_id"],
            "text": chunk["text"],
            "metadata": {
                **(chunk.get("metadata") or {}),
                "concept_id": chunk.get("concept_id"),
                "chunk_type": chunk.get("chunk_type"),
                "title": chunk.get("title"),
            },
        }
        for chunk in approved
    ]
    vector_path.write_text(json.dumps(vectors, indent=2, ensure_ascii=False), encoding="utf-8")

    print(
        f"[quality] approved {report['approved_chunks']}/{report['total_chunks']} "
        f"chunks ({report['approval_rate']:.1%})"
    )
    if report["rejection_reasons"]:
        print(f"[quality] rejection reasons: {report['rejection_reasons']}")
    if report["approval_rate"] < args.min_approval_rate:
        print(
            f"[quality] approval rate is below the required "
            f"{args.min_approval_rate:.1%}; embedding blocked"
        )
        return 2
    if not all(report["upstream_gates"].values()):
        print(f"[quality] upstream validation blocked embedding: {report['upstream_gates']}")
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
