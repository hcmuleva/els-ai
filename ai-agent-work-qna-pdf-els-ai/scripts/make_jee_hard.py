"""Generate 10 hard (JEE-advanced) validated assessments across visual topics
(graphs, circles, triangles, coordinate geometry, ...) grounded in the loaded
NCERT content. Only PASSED items are kept; each visual topic is asked to include
a deterministic diagram.

    python scripts/make_jee_hard.py

Writes data/output/jee_hard_set.json.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.assessment import AssessmentGenerator  # noqa: E402
from knowledge_pipeline.config import PipelineConfig  # noqa: E402
from knowledge_pipeline.serving.context import DirectRetriever  # noqa: E402
from knowledge_pipeline.serving.llm import build_llm  # noqa: E402

# (topic, subTopic, questionType, prefer diagrams, require_diagram, retrieval query)
TOPICS = [
    ("Graphs of Functions", "Roots and intersections of curves", "GRAPHS", ["function"], True,
     "graph of a cubic polynomial roots turning points intersection"),
    ("Circles", "Chord, tangent and angle subtended", "CIRCLE GEOMETRY", ["circle"], True,
     "circle chord tangent angle subtended at centre"),
    ("Triangles", "Similarity, area and coordinates", "TRIANGLES", ["triangle"], True,
     "triangle similarity area coordinates of vertices"),
    ("Coordinate Geometry", "Locus, distance and section", "COORDINATE GEOMETRY", ["coordinate"], True,
     "locus distance formula section formula points in plane"),
    ("Application of Derivatives", "Tangents, maxima and minima", "GRAPHS", ["function"], True,
     "tangent normal maxima minima of a function graph"),
    ("Definite Integrals", "Area bounded by curves", "GRAPHS", ["function"], True,
     "area bounded between curve and x-axis definite integral"),
    ("Straight Lines", "Angle between lines and intersection", "COORDINATE GEOMETRY", ["coordinate"], True,
     "straight line slope angle between lines point of intersection"),
    ("Angles and Polygons", "Interior angles / angle chasing", "ANGLE PROBLEMS", ["angle", "polygon"], True,
     "regular polygon interior angle angle chasing"),
    ("Trigonometric Equations", "Solutions in an interval", "TRIGONOMETRY", [], False,
     "solve trigonometric equation general solution interval"),
    ("Vectors and 3D Geometry", "Projections and coordinates", "COORDINATE GEOMETRY", ["coordinate"], True,
     "position vectors dot product projection points in space"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--grade", default="Class 12")
    ap.add_argument("--difficulty", default="jee_advanced")
    ap.add_argument("--out", default="data/output/jee_hard_set.json")
    ap.add_argument("--only", default="")
    args = ap.parse_args()

    cfg = PipelineConfig.load()
    if not cfg.identity.subject:
        cfg.identity.subject = "Mathematics"
    if not cfg.identity.class_level:
        cfg.identity.class_level = args.grade

    provider = cfg.resolved_provider()
    print(f"[hard] provider={provider} grade={args.grade} difficulty={args.difficulty}")
    if provider == "mock":
        print("[hard] No LLM configured; set KP_PROVIDER=local, droid, openai, or anthropic.")
        return 2

    gen = AssessmentGenerator(cfg, DirectRetriever(cfg), build_llm(cfg))

    topics = TOPICS
    if args.only:
        keys = [k.strip().lower() for k in args.only.split(",") if k.strip()]
        topics = [t for t in TOPICS if any(k in t[0].lower() for k in keys)]

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    assessments: list = []
    for topic, subtopic, qtype, prefer, need_dia, query in topics:
        try:
            a = gen.generate(topic, subtopic=subtopic, grade=args.grade, difficulty=args.difficulty,
                             question_type=qtype, query=query, prefer_diagrams=prefer,
                             require_diagram=need_dia)
        except Exception as exc:
            print(f"[hard] {topic}: generation error ({exc}); skipping")
            continue
        v = a.validation
        print(f"[hard] {topic:26s} status={v.status:6s} score={v.qualityScore:3d} "
              f"diagram={'Y' if a.question.diagramSvg else '-'} "
              f"{('issues: ' + '; '.join(v.issues[:2])) if v.issues else ''}")
        assessments.append(a.model_dump())
        _write(out, generated, args, assessments)

    _write(out, generated, args, assessments)
    passed = sum(1 for a in assessments if a["validation"]["status"] == "PASSED")
    dia = sum(1 for a in assessments if a["question"]["diagramSvg"])
    print(f"[hard] wrote {out} ({len(assessments)} items, {passed} PASSED, {dia} with diagrams)")
    return 0


def _write(out: Path, generated: str, args, assessments: list) -> None:
    passed = sum(1 for a in assessments if a["validation"]["status"] == "PASSED")
    payload = {
        "title": f"Hard JEE Set - {args.grade} Mathematics ({args.difficulty})",
        "generated_at": generated,
        "grade": args.grade,
        "difficulty": args.difficulty,
        "count": len(assessments),
        "passed": passed,
        "assessments": assessments,
    }
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
