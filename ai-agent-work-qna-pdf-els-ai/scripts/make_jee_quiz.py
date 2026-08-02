"""Assemble a proper JEE-level Class 12 Mathematics quiz across topics.

Uses the deterministic (sympy-verified) template engine so every stem, diagram,
option and answer key stays consistent. Ties questions to real concept ids from
the relational store when available, writes the target-schema JSON, and persists
it to Postgres/SQLite.

    python scripts/make_jee_quiz.py --level jee_main --out data/output/jee_math_quiz.json
"""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.config import PipelineConfig  # noqa: E402
from knowledge_pipeline.generation import QuestionGenerator  # noqa: E402
from knowledge_pipeline.serving.workflows import Workflows  # noqa: E402
from knowledge_pipeline.stores import build_relational_store  # noqa: E402

# (topic, question count) - a JEE Main style spread across the Class 12 syllabus.
BLUEPRINT = [
    ("Integrals", 2),
    ("Application of Derivatives", 2),
    ("Continuity and Differentiability", 2),
    ("Determinants", 2),
    ("Vector Algebra", 2),
    ("Inverse Trigonometric Functions", 1),
    ("Differential Equations", 1),
    ("Probability", 1),
    ("Linear Programming", 1),
]


def _concept_ids(rel, topic: str) -> list[str]:
    try:
        rows = rel.concepts_by_topic(topic, limit=3)
        return [r["concept_id"] for r in rows]
    except Exception:
        return []


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", default="jee_main", choices=["jee_main", "jee_advanced"])
    ap.add_argument("--out", default="data/output/jee_math_quiz.json")
    ap.add_argument("--no-persist", action="store_true")
    args = ap.parse_args()

    cfg = PipelineConfig.load()
    if not cfg.identity.subject:
        cfg.identity.subject = "Mathematics"
    if not cfg.identity.class_level:
        cfg.identity.class_level = "Class 12"

    gen = QuestionGenerator(cfg)
    rel = build_relational_store(cfg.stores.postgres_dsn)

    quiz_id = f"jee-math-{uuid.uuid4().hex[:10]}"
    title = f"JEE {'Advanced' if args.level == 'jee_advanced' else 'Main'} - Class 12 Mathematics"
    created = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    questions: list = []
    for topic, count in BLUEPRINT:
        cids = _concept_ids(rel, topic)
        items = gen.generate_items(topic, level_band=args.level, count=count, concept_ids=cids)
        questions.extend(gen.to_target(items, quiz_id=quiz_id, quiz_title=title, created_at=created))

    # sequential display order across the whole paper
    for i, wrapped in enumerate(questions, start=1):
        wrapped["question"]["question_data"]["_meta"]["sort_order"] = i

    quiz = {
        "quiz_id": quiz_id,
        "quiz_title": title,
        "topic": "Mixed (JEE Class 12 Mathematics)",
        "level_band": args.level,
        "subject": cfg.identity.subject,
        "class_level": cfg.identity.class_level,
        "count": len(questions),
        "questions": questions,
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(quiz, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[jee] wrote {out} ({len(questions)} questions across {len(BLUEPRINT)} topics)")

    if not args.no_persist:
        ok = Workflows(config=cfg, prefer_mcp=False).persist_quiz(quiz)
        print(f"[jee] persisted to relational store: {ok}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
