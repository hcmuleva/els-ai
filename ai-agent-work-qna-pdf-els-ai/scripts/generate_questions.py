"""Generate RAG-grounded questions for a topic using the indexed chunks.

Example:
    python scripts/generate_questions.py --topic "Kinematics" --count 5
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import sys

_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.config import PipelineConfig  # noqa: E402
from knowledge_pipeline.serving.question_service import (  # noqa: E402
    QuestionGenerationService,
)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Retrieve indexed PDF context and generate validated questions."
    )
    ap.add_argument("--topic", required=True, help="Topic to retrieve from the vector database.")
    ap.add_argument("--query", default="", help="More specific retrieval query.")
    ap.add_argument("--count", type=int, default=5)
    ap.add_argument(
        "--level",
        default="intermediate",
        choices=["beginner", "intermediate", "advanced", "jee_main", "jee_advanced", "expert"],
    )
    ap.add_argument("--out", type=Path, default=None, help="Output JSON path.")
    ap.add_argument("--no-persist", action="store_true", help="Do not save questions to SQL.")
    ap.add_argument("--source-run-id", help="Restrict vector retrieval to one validated run.")
    ap.add_argument("--max-attempts", type=int, default=3)
    args = ap.parse_args()
    if args.count < 1:
        ap.error("--count must be at least 1")

    cfg = PipelineConfig.load()
    if cfg.resolved_provider() == "mock":
        ap.error(
            "question generation requires an LLM. Set KP_PROVIDER=local, droid, "
            "openai, or anthropic."
        )

    result = QuestionGenerationService(cfg).generate(
        topic=args.topic,
        query=args.query,
        level_band=args.level,
        count=args.count,
        source_run_id=args.source_run_id,
        persist=not args.no_persist,
        max_attempts=args.max_attempts,
    )

    out = args.out or _default_output(args.topic, result["quiz_id"])
    out = out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        raise SystemExit(f"Question output already exists; choose a new path: {out}")
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[questions] wrote {out} ({result['count']} questions)")
    if "persisted" in result:
        print(f"[questions] persisted to relational store: {result['persisted']}")
    return 0


def _default_output(topic: str, quiz_id: str) -> Path:
    safe = "".join(char.lower() if char.isalnum() else "_" for char in topic).strip("_")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    return (
        _ROOT
        / "data"
        / "output"
        / "question-runs"
        / f"{timestamp}-{safe or 'quiz'}-{quiz_id}"
        / "questions"
        / "question_set.json"
    )


if __name__ == "__main__":
    raise SystemExit(main())
