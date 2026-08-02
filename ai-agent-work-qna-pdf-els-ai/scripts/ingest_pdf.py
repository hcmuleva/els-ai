"""Extract one document, build chunks, and upsert them into the configured stores.

Example:
    python scripts/ingest_pdf.py "C:/books/physics.pdf" --provider mock
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.config import PipelineConfig  # noqa: E402
from knowledge_pipeline.pipeline import run_pipeline  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Extract, analyze, chunk, embed, and store one PDF/TXT/MD file."
    )
    ap.add_argument("file", type=Path, help="Path to the PDF, TXT, or Markdown file.")
    ap.add_argument("--output-dir", type=Path, default=_ROOT / "data" / "output" / "runs")
    ap.add_argument("--run-id", help="Optional unique output run folder name.")
    ap.add_argument(
        "--provider",
        choices=["mock", "auto", "local", "droid", "openai", "anthropic"],
        default=None,
        help="LLM backend. Defaults to KP_PROVIDER/config settings.",
    )
    ap.add_argument("--settings", type=Path, default=None)
    ap.add_argument("--qdrant-url", help="Qdrant URL or local on-disk directory.")
    ap.add_argument("--collection", help="Qdrant collection name.")
    ap.add_argument("--embedding-model", help="fastembed model name, or 'hash' for offline mode.")
    ap.add_argument("--postgres-dsn", help="Postgres DSN, or sqlite:PATH for local mode.")
    ap.add_argument(
        "--recreate",
        action="store_true",
        help="Recreate the Qdrant collection before loading this validated run.",
    )
    args = ap.parse_args()

    source = args.file.resolve()
    if not source.is_file():
        ap.error(f"source file does not exist: {source}")
    if source.suffix.lower() not in {".pdf", ".txt", ".md", ".markdown"}:
        ap.error("source must be a .pdf, .txt, .md, or .markdown file")

    # Store options are environment-backed throughout the project, so the
    # loader subprocess uses exactly the same settings as this pipeline run.
    overrides = {
        "KP_QDRANT_URL": args.qdrant_url,
        "KP_QDRANT_COLLECTION": args.collection,
        "KP_EMBEDDING_MODEL": args.embedding_model,
        "KP_POSTGRES_DSN": args.postgres_dsn,
    }
    for key, value in overrides.items():
        if value:
            os.environ[key] = value

    cfg = PipelineConfig.load(args.settings)
    cfg.input_dir = source
    cfg.output_dir = args.output_dir.resolve()
    cfg.output_run_id = args.run_id
    if args.provider:
        cfg.provider = args.provider
    cfg.generation.enabled = False

    print(f"[ingest] source={source}")
    result = run_pipeline(cfg)
    print(f"[ingest] analysis complete: {result.output_dir}")

    analyzer = _ROOT / "scripts" / "analyze_chunks.py"
    subprocess.run(
        [
            sys.executable,
            str(analyzer),
            "--output-dir",
            str(result.output_dir),
        ],
        check=True,
        cwd=_ROOT,
    )
    print("[ingest] chunk quality validation passed")

    retrieval_validator = _ROOT / "scripts" / "validate_retrieval.py"
    subprocess.run(
        [
            sys.executable,
            str(retrieval_validator),
            "--output-dir",
            str(result.output_dir),
            "--model",
            cfg.stores.embedding_model,
            "--dimension",
            str(cfg.stores.embedding_dim),
        ],
        check=True,
        cwd=_ROOT,
    )
    print("[ingest] semantic retrieval validation passed")

    loader = _ROOT / "scripts" / "load_stores.py"
    command = [
        sys.executable,
        str(loader),
        "--output-dir",
        str(result.output_dir),
    ]
    if args.recreate:
        command.append("--recreate")
    subprocess.run(command, check=True, cwd=_ROOT)
    print("[ingest] chunks embedded and upserted")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
