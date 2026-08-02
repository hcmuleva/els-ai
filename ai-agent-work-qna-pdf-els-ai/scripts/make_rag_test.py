"""Generate a full RAG test: every question authored by Droid, grounded in the
loaded NCERT content, across the Class 12 syllabus plus extra geometry topics
for diagram variety (triangles, circles, angles, mensuration). Math is emitted
as LaTeX (rendered by MathJax in the player).

    python scripts/make_rag_test.py --per-topic 3 --level jee_main

Writes data/output/rag_test_quiz.json incrementally (so partial progress is
saved) and persists the finished quiz to the relational store.
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
from knowledge_pipeline.serving.context import DirectRetriever  # noqa: E402
from knowledge_pipeline.serving.llm import build_llm  # noqa: E402
from knowledge_pipeline.serving.rag_quiz import RagQuizGenerator  # noqa: E402
from knowledge_pipeline.serving.workflows import Workflows  # noqa: E402
from knowledge_pipeline.stores import build_relational_store  # noqa: E402

# (topic, retrieval query, preferred diagram families)
TOPICS = [
    ("Integrals", "definite and indefinite integration, area under a curve", ["function"]),
    ("Application of Derivatives", "maxima minima, increasing decreasing, tangents and normals", ["function"]),
    ("Continuity and Differentiability", "continuity, differentiability, chain rule, derivatives", ["function"]),
    ("Matrices", "matrix operations, transpose, symmetric matrices", []),
    ("Determinants", "determinant, minors and cofactors, adjoint, inverse of a matrix", []),
    ("Vector Algebra", "dot product, cross product, projection of vectors", ["coordinate"]),
    ("Three Dimensional Geometry", "direction cosines, equation of a line and plane in space", ["coordinate"]),
    ("Probability", "conditional probability, multiplication theorem, Bayes theorem", []),
    ("Relations and Functions", "types of relations and functions, one-one, onto, composition", ["function"]),
    ("Inverse Trigonometric Functions", "principal value branch, properties of inverse trig", []),
    ("Differential Equations", "order and degree, solving first order differential equations", ["function"]),
    ("Linear Programming", "objective function, constraints, feasible region, corner points", ["lpp"]),
    # Extra geometry for diagram variety
    ("Triangles", "properties of triangles, angle sum, similarity, area of a triangle", ["triangle", "angle"]),
    ("Circles", "circle, chord, tangent, angle subtended by an arc at the centre", ["circle"]),
    ("Angles", "types of angles, complementary and supplementary angles, angle pairs", ["angle"]),
    ("Mensuration", "area and perimeter of rectangles and plane figures", ["mensuration"]),
]


def _concept_ids(rel, topic: str) -> list[str]:
    try:
        return [r["concept_id"] for r in rel.concepts_by_topic(topic, limit=3)]
    except Exception:
        return []


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-topic", type=int, default=3)
    ap.add_argument("--level", default="jee_main", choices=["jee_main", "jee_advanced"])
    ap.add_argument("--out", default="data/output/rag_test_quiz.json")
    ap.add_argument("--no-persist", action="store_true")
    ap.add_argument("--only", default="", help="comma-separated topic substrings to limit the run")
    args = ap.parse_args()

    cfg = PipelineConfig.load()
    if not cfg.identity.subject:
        cfg.identity.subject = "Mathematics"
    if not cfg.identity.class_level:
        cfg.identity.class_level = "Class 12"

    provider = cfg.resolved_provider()
    print(f"[rag] provider={provider} level={args.level} per_topic={args.per_topic}")
    if provider == "mock":
        print("[rag] No LLM configured; set KP_PROVIDER=local, droid, openai, or anthropic.")
        return 2

    retriever = DirectRetriever(cfg)
    rel = build_relational_store(cfg.stores.postgres_dsn)
    gen = RagQuizGenerator(cfg, retriever, build_llm(cfg))

    topics = TOPICS
    if args.only:
        keys = [k.strip().lower() for k in args.only.split(",") if k.strip()]
        topics = [t for t in TOPICS if any(k in t[0].lower() for k in keys)]

    quiz_id = f"rag-test-{uuid.uuid4().hex[:10]}"
    title = f"RAG Test - Class 12 Mathematics ({'Advanced' if args.level == 'jee_advanced' else 'Main'})"
    created = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    questions: list = []
    for topic, query, prefer in topics:
        cids = _concept_ids(rel, topic)
        try:
            items, _ctx = gen.generate_topic(
                topic, query=query, level=args.level, count=args.per_topic,
                prefer_diagrams=prefer, concept_ids=cids,
            )
        except Exception as exc:  # keep going; one bad topic shouldn't sink the run
            print(f"[rag] {topic}: generation failed ({exc}); skipping")
            continue
        wrapped = gen.adapt_items(items, quiz_id, title, created, start_order=len(questions) + 1)
        questions.extend(wrapped)
        with_dia = sum(1 for w in wrapped if w["question"].get("question_svg"))
        print(f"[rag] {topic}: {len(wrapped)} questions ({with_dia} with diagrams)")

        # incremental save
        quiz = _envelope(quiz_id, title, args.level, cfg, questions)
        out.write_text(json.dumps(quiz, indent=2, ensure_ascii=False), encoding="utf-8")

    quiz = _envelope(quiz_id, title, args.level, cfg, questions)
    out.write_text(json.dumps(quiz, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[rag] wrote {out} ({len(questions)} questions across {len(topics)} topics)")

    if not args.no_persist and questions:
        ok = Workflows(config=cfg, prefer_mcp=False).persist_quiz(quiz)
        print(f"[rag] persisted to relational store: {ok}")
    return 0


def _envelope(quiz_id, title, level, cfg, questions) -> dict:
    for i, wrapped in enumerate(questions, start=1):
        wrapped["question"]["question_data"]["_meta"]["sort_order"] = i
    return {
        "quiz_id": quiz_id,
        "quiz_title": title,
        "topic": "RAG Test (Class 12 Mathematics + Geometry)",
        "level_band": level,
        "subject": cfg.identity.subject,
        "class_level": cfg.identity.class_level,
        "count": len(questions),
        "questions": questions,
    }


if __name__ == "__main__":
    raise SystemExit(main())
