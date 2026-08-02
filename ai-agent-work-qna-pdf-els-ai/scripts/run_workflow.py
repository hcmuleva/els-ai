"""Trigger a LangGraph workflow from the command line (Droid can call this too).

Examples:
    python scripts/run_workflow.py quiz --topic "Linear Programming" --level jee_main --count 3
    python scripts/run_workflow.py explanation --query "How to find distance between two points?"
    python scripts/run_workflow.py learning_path --topic "Integrals" --target-level advanced
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.serving import Workflows  # noqa: E402


def main() -> int:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--no-mcp", action="store_true", help="use direct stores instead of MCP")
    common.add_argument("--out", default=None, help="write JSON result to this path")

    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="kind", required=True)

    q = sub.add_parser("quiz", parents=[common])
    q.add_argument("--topic", required=True)
    q.add_argument("--level", default="intermediate")
    q.add_argument("--count", type=int, default=3)
    q.add_argument("--persist", action="store_true")

    e = sub.add_parser("explanation", parents=[common])
    e.add_argument("--query", required=True)
    e.add_argument("--top-k", type=int, default=5)
    e.add_argument("--level", default="intermediate")

    p = sub.add_parser("learning_path", parents=[common])
    p.add_argument("--topic", required=True)
    p.add_argument("--target-level", default="advanced")

    args = ap.parse_args()

    wf = Workflows(prefer_mcp=not args.no_mcp)
    if args.kind == "quiz":
        result = wf.generate_quiz(args.topic, level_band=args.level, count=args.count, persist=args.persist)
    elif args.kind == "explanation":
        result = wf.generate_explanation(args.query, top_k=args.top_k, level_band=args.level)
    else:
        result = wf.generate_learning_path(args.topic, target_level=args.target_level)

    text = json.dumps(result, indent=2, ensure_ascii=False)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"[run] wrote {args.out}")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
