"""Command-line interface for the knowledge pipeline."""
from __future__ import annotations

import argparse
import os
from pathlib import Path

from .config import PipelineConfig
from .pipeline import run_pipeline

_REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader (no external dependency)."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and value and key not in os.environ:
            os.environ[key] = value


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="knowledge-pipeline",
        description="Transform educational PDFs into assessment-ready knowledge assets.",
    )
    parser.add_argument("--input", type=Path, help="Input PDF/TXT/MD file or directory.")
    parser.add_argument("--output", type=Path, help="Root directory for immutable pipeline runs.")
    parser.add_argument("--run-id", help="Optional unique run folder name.")
    parser.add_argument(
        "--provider", choices=["auto", "mock", "local", "droid", "openai", "anthropic"],
        help="Extraction backend (default from settings/env; auto prefers local).",
    )
    parser.add_argument("--droid-model", help="Droid model id (blank = Droid default).")
    parser.add_argument("--droid-autonomy", choices=["low", "medium", "high"], help="droid exec autonomy.")
    parser.add_argument("--no-generate", action="store_true", help="Skip Phase 15 question generation.")
    parser.add_argument("--settings", type=Path, help="Path to settings.yaml.")
    parser.add_argument("--env", type=Path, default=_REPO_ROOT / ".env", help="Path to .env file.")
    args = parser.parse_args(argv)

    _load_dotenv(args.env)

    config = PipelineConfig.load(args.settings)
    if args.input:
        config.input_dir = args.input.resolve()
    if args.output:
        config.output_dir = args.output.resolve()
    if args.run_id:
        config.output_run_id = args.run_id
    if args.provider:
        config.provider = args.provider
    if args.droid_model:
        config.droid_model = args.droid_model
    if args.droid_autonomy:
        config.droid_autonomy = args.droid_autonomy
    if args.no_generate:
        config.generation.enabled = False

    result = run_pipeline(config)
    print("\nDone. Manifest counts:")
    for key, value in result.manifest["counts"].items():
        print(f"  {key:>22}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
