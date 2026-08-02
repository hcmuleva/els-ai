"""Generate a set of rich, self-validated assessments (metadata / question /
options / answer / explanation / validation) grounded in the loaded NCERT
content, across varied question types and diagram families.

    python scripts/make_assessment_set.py --per-topic 1

Writes data/output/assessment_set.json incrementally and prints a PASSED/FAILED
summary per item.
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

# (topic, subTopic, questionType, preferred diagrams, retrieval query)
TOPICS = [
    ("Integrals", "Definite integrals", "FUNCTIONS", ["function"], "definite integral area under a curve"),
    ("Application of Derivatives", "Maxima and minima", "GRAPHS", ["function"], "maxima minima increasing decreasing tangents"),
    ("Determinants", "Determinant of a 3x3 matrix", "ALGEBRA", [], "determinant adjoint inverse of a matrix"),
    ("Vector Algebra", "Dot and cross product", "COORDINATE GEOMETRY", ["coordinate"], "dot product cross product projection"),
    ("Probability", "Conditional probability", "DATA INTERPRETATION", [], "conditional probability Bayes theorem"),
    ("Triangles", "Angle sum and similarity", "TRIANGLES", ["triangle", "angle"], "properties of triangles similarity area"),
    ("Circles", "Chord and tangent", "CIRCLE GEOMETRY", ["circle"], "circle chord tangent angle subtended"),
    ("Angles", "Complementary and supplementary angles", "ANGLE PROBLEMS", ["angle"], "types of angles angle pairs"),
    ("Mensuration", "Area and perimeter", "MENSURATION", ["mensuration"], "area and perimeter of plane figures"),
    ("Coordinate Geometry", "Distance and section formula", "COORDINATE GEOMETRY", ["coordinate"], "distance formula section formula"),
    ("Polygons", "Interior angles of polygons", "POLYGONS", ["polygon"], "regular polygon interior angles"),
    ("Trigonometry", "Ratios and identities", "TRIGONOMETRY", [], "trigonometric ratios and identities"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-topic", type=int, default=1)
    ap.add_argument("--grade", default="Class 12")
    ap.add_argument("--difficulty", default="jee_main")
    ap.add_argument("--out", default="data/output/assessment_set.json")
    ap.add_argument("--only", default="", help="comma-separated topic substrings to limit the run")
    args = ap.parse_args()

    cfg = PipelineConfig.load()
    if not cfg.identity.subject:
        cfg.identity.subject = "Mathematics"
    if not cfg.identity.class_level:
        cfg.identity.class_level = args.grade

    provider = cfg.resolved_provider()
    print(f"[assess] provider={provider} grade={args.grade} difficulty={args.difficulty} per_topic={args.per_topic}")
    if provider == "mock":
        print("[assess] No LLM configured; set KP_PROVIDER=local, droid, openai, or anthropic.")
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
    for topic, subtopic, qtype, prefer, query in topics:
        for _ in range(args.per_topic):
            try:
                a = gen.generate(topic, subtopic=subtopic, grade=args.grade, difficulty=args.difficulty,
                                 question_type=qtype, query=query, prefer_diagrams=prefer)
            except Exception as exc:
                print(f"[assess] {topic}: generation error ({exc}); skipping")
                continue
            v = a.validation
            print(f"[assess] {topic:26s} status={v.status:6s} score={v.qualityScore:3d} "
                  f"svg={'Y' if a.question.diagramSvg else '-'} "
                  f"{('issues: ' + '; '.join(v.issues[:2])) if v.issues else ''}")
            assessments.append(a.model_dump())
            _write(out, generated, args, assessments)

    _write(out, generated, args, assessments)
    passed = sum(1 for a in assessments if a["validation"]["status"] == "PASSED")
    print(f"[assess] wrote {out} ({len(assessments)} assessments, {passed} PASSED)")
    return 0


def _write(out: Path, generated: str, args, assessments: list) -> None:
    passed = sum(1 for a in assessments if a["validation"]["status"] == "PASSED")
    payload = {
        "title": f"Assessment Set - {args.grade} Mathematics ({args.difficulty})",
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
