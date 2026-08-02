"""Create an immutable question run with reviewed, semantically valid diagrams."""
from __future__ import annotations

import argparse
import copy
import json
import math
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.assessment.validation import validate_latex  # noqa: E402
from knowledge_pipeline.diagram import builders as B  # noqa: E402
from knowledge_pipeline.diagram.builders import _window  # noqa: E402
from knowledge_pipeline.diagram.dsl import (  # noqa: E402
    AngleMark,
    Arrow,
    Axes,
    Circle,
    DiagramSpec,
    FunctionPlot,
    FunctionRegion,
    Grid,
    Label,
    Line,
    Point,
    Polygon,
    Segment,
)
from knowledge_pipeline.diagram.validation import (  # noqa: E402
    stem_requires_diagram,
    validate_question_diagram,
)
from knowledge_pipeline.quizschema.models import TargetQuestion  # noqa: E402
from knowledge_pipeline.rendering.svg import render_svg  # noqa: E402

_ID_NAMESPACE = uuid.UUID("77a14658-c77e-4a45-8f76-b8b545c1143c")
_DEFAULT_SOURCE = (
    _ROOT
    / "data"
    / "output"
    / "question-runs"
    / "questions-prilepko-20260721-03"
)
_DEFAULT_OUTPUT_ROOT = _ROOT / "data" / "output" / "question-runs"


REMOVE: dict[str, str] = {
    "01a896ea-4086-548b-a7ba-175764bc0487": (
        "Generic triangle omitted the three defining lines, axes, and parabola."
    ),
    "fad7ee71-6af8-5f34-9e74-288394557d41": (
        "The solved coordinate segment was decorative and disclosed derived values."
    ),
    "afee8aec-6a57-5c57-97d3-e573c2fda337": (
        "A generic 60-degree angle did not represent the trigonometric identity."
    ),
    "bba9365e-378d-56f2-977b-72e4e76ce39b": (
        "An arbitrary angle did not establish the stated half-angle inequality."
    ),
    "89f3762e-ad9f-5bb0-8ed0-7b3bf9c076ec": (
        "The route diagram hard-coded the unknown distance and meeting point."
    ),
    "9a97e036-c887-56da-bfce-7ee87de9a0e3": (
        "The diagram directly depicted the derived 90-degree answer."
    ),
    "4a837eed-a831-5255-8f0e-6fd86f0eb87d": (
        "The generic 60-degree sketch invented a special case."
    ),
    "0632ac38-07ac-5a6c-b24a-80007d1203ee": (
        "A two-dimensional segment was invalid for the three-dimensional vector."
    ),
    "153b3fd0-3745-551e-98bf-23a5c30348e2": (
        "The unlabeled generic triangle did not aid the self-contained Heron calculation."
    ),
    "a2a65614-ee1d-57d4-ae3d-a63ea44ca4c2": (
        "The circle-only sketch omitted the cylinder and oblique cutting plane."
    ),
    "af4ef7d2-ed68-50f1-af4e-2f4ddf95a625": (
        "The generic triangle omitted the square pyramid, insphere, and section."
    ),
}

KEEP: dict[str, str] = {
    "80f00cb3-d55d-5b1a-9820-156bd2e2d0bb": (
        "The function, interval, endpoint values, and viewport match the extrema question."
    ),
    "cce5ddd6-c6bc-5cdd-b7fc-f6ac094966ee": (
        "The constraints, feasible polygon, and optimum match the linear program."
    ),
    "44226efa-9a71-5cb8-93e3-216ff33533d3": (
        "The constraints, feasible polygon, and optimum match the linear program."
    ),
}


def _custom(
    kind: str,
    points: list[tuple[float, float]],
    elements: list,
    *,
    title: str | None = None,
    pad: float = 1.2,
    width: int = 420,
    height: int = 320,
) -> DiagramSpec:
    xmin, xmax, ymin, ymax = _window(points, pad=pad)
    return DiagramSpec(
        kind=kind,
        width=width,
        height=height,
        xmin=xmin,
        xmax=xmax,
        ymin=ymin,
        ymax=ymax,
        title=title,
        elements=elements,
    )


def _area_between(
    upper: str,
    lower: str,
    domain: tuple[float, float],
    viewport: tuple[float, float, float, float],
    upper_label: str,
    lower_label: str,
    *,
    extra: list | None = None,
) -> DiagramSpec:
    xmin, xmax, ymin, ymax = viewport
    return DiagramSpec(
        kind="function-region",
        width=420,
        height=320,
        xmin=xmin,
        xmax=xmax,
        ymin=ymin,
        ymax=ymax,
        elements=[
            Grid(),
            Axes(),
            FunctionRegion(
                upper_expr=upper,
                lower_expr=lower,
                domain=domain,
            ),
            FunctionPlot(
                expr=upper,
                domain=domain,
                label=upper_label,
                color="#2563eb",
            ),
            FunctionPlot(
                expr=lower,
                domain=domain,
                label=lower_label,
                color="#dc2626",
            ),
            *(extra or []),
        ],
    )


def _q14() -> DiagramSpec:
    return DiagramSpec(
        kind="function-plot",
        width=420,
        height=320,
        xmin=0.8,
        xmax=4.6,
        ymin=2,
        ymax=13,
        elements=[
            Grid(),
            Axes(),
            FunctionPlot(expr="12/x", domain=(1, 4), label="f(x)=12/x"),
            Point(at=(1, 12), label="maximum"),
            Point(at=(4, 3), label="minimum"),
        ],
    )


def _q25() -> DiagramSpec:
    return B.lpp_region(
        [(1, 1, 4, ">="), (2, 1, 6, "<=")],
        [(0, 4), (0, 6), (2, 2)],
        xmax=3,
        ymax=7,
    )


def _sin_squared() -> DiagramSpec:
    return B.function_plot(
        "sin(x)**2",
        xmin=-math.pi,
        xmax=math.pi,
        ymin=-0.15,
        ymax=1.15,
        label="sin²x",
    )


def _q82() -> DiagramSpec:
    return B.lpp_region(
        [(3, 2, 45, "<="), (2, 3, 36, "<="), (1, 2, 30, "<=")],
        [(0, 0), (15, 0), (12.6, 3.6), (0, 12)],
        xmax=16,
        ymax=13,
        optimum=(12.6, 3.6, "maximum revenue"),
    )


def _q93() -> DiagramSpec:
    return _area_between(
        "2*sqrt(x)",
        "-2*sqrt(x)",
        (0, 3),
        (-0.3, 3.5, -4, 4),
        "y=2√x",
        "y=−2√x",
        extra=[Line(a=1, b=0, c=3, label="x=3", color="#7c3aed")],
    )


def _q94() -> DiagramSpec:
    return _area_between(
        "4",
        "x**2",
        (-2, 2),
        (-2.6, 2.6, -0.5, 4.8),
        "y=4",
        "y=x²",
    )


def _q109() -> DiagramSpec:
    origin = (0.0, 0.0)
    a = (3.0, 0.0)
    b = (2.0, 3.464101615)
    return _custom(
        "vector-angle",
        [origin, a, b],
        [
            Arrow(start=origin, end=a, label="a, |a|=3", color="#2563eb"),
            Arrow(start=origin, end=b, label="b, |b|=4", color="#dc2626"),
            AngleMark(vertex=origin, p1=a, p2=b, label="60°"),
        ],
    )


def _triangle_13_14_15(mark_angle: bool = False) -> DiagramSpec:
    return B.triangle_diagram(
        (0, 0),
        (13, 0),
        (99 / 13, 168 / 13),
        side_labels=("13", "14", "15"),
        mark_angle_at=1 if mark_angle else None,
        angle_label=None,
    )


def _q116() -> DiagramSpec:
    a, b, c, m = (0, 0), (14, 0), (5, 12), (7, 0)
    return _custom(
        "median-triangle",
        [a, b, c],
        [
            Polygon(points=[a, b, c]),
            Segment(a=a, b=b, label="AB=14"),
            Segment(a=a, b=c, label="AC=13"),
            Segment(a=b, b=c, label="BC=15"),
            Segment(a=c, b=m, label="median CM", color="#7c3aed"),
            Point(at=a, label="A"),
            Point(at=b, label="B"),
            Point(at=c, label="C"),
            Point(at=m, label="M, AM=MB"),
        ],
    )


def _q117() -> DiagramSpec:
    b, c, a, d = (0, 0), (10, 0), (7.25, math.sqrt(28.4375)), (6, 0)
    return _custom(
        "angle-bisector",
        [a, b, c],
        [
            Polygon(points=[a, b, c]),
            Segment(a=a, b=b, label="AB=9"),
            Segment(a=a, b=c, label="AC=6"),
            Segment(a=b, b=c, label="BC=10"),
            Segment(a=a, b=d, label="angle bisector AD", color="#7c3aed"),
            Point(at=a, label="A"),
            Point(at=b, label="B"),
            Point(at=c, label="C"),
            Point(at=d, label="D"),
            AngleMark(vertex=a, p1=b, p2=d, label="α", radius_px=18),
            AngleMark(vertex=a, p1=d, p2=c, label="α", radius_px=28),
        ],
    )


def _q118() -> DiagramSpec:
    degrees = [0, 24, 61, 102, 130, 180]
    labels = ["24°", "37°", "41°", "28°", "α₅"]
    points = [
        (4 * math.cos(math.radians(degree)), 4 * math.sin(math.radians(degree)))
        for degree in degrees
    ]
    elements: list = [Point(at=(0, 0), label="O")]
    elements.extend(Segment(a=(0, 0), b=point) for point in points)
    for index, label in enumerate(labels):
        elements.append(
            AngleMark(
                vertex=(0, 0),
                p1=points[index],
                p2=points[index + 1],
                label=label,
                radius_px=22 + index * 9,
            )
        )
    return _custom("consecutive-angles", [(0, 0), *points], elements, pad=0.7)


def _q119() -> DiagramSpec:
    a, b, c, d, e = (2, 4), (0, 0), (8, 0), (1, 2), (5, 2)
    return _custom(
        "midpoint-theorem",
        [a, b, c],
        [
            Polygon(points=[a, b, c]),
            Segment(a=b, b=c, label="BC=18"),
            Segment(a=d, b=e, label="DE", color="#7c3aed"),
            Point(at=a, label="A"),
            Point(at=b, label="B"),
            Point(at=c, label="C"),
            Point(at=d, label="D midpoint"),
            Point(at=e, label="E midpoint"),
        ],
    )


def _q120() -> DiagramSpec:
    return B.coordinate_diagram(
        [(1, 2, "A"), (7, 2, "B"), (4, 8, "C"), (5.5, 5, "D"), (4, 4, "G")],
        [
            ((1, 2), (7, 2), "AB"),
            ((7, 2), (4, 8), "BC"),
            ((4, 8), (1, 2), "CA"),
            ((1, 2), (5.5, 5), "median AD"),
        ],
    )


def _q121() -> DiagramSpec:
    o, x, y = (0, 0), (6, 0), (3, 5.196)
    p, q, a = (4, 0), (2, 3.464), (3, 1.732)
    return _custom(
        "midpoint-intercept-construction",
        [o, x, y],
        [
            Segment(a=o, b=x, label="ray OX"),
            Segment(a=o, b=y, label="ray OY"),
            Segment(a=p, b=q, label="PQ through A", color="#7c3aed"),
            Point(at=o, label="O"),
            Point(at=p, label="P"),
            Point(at=q, label="Q"),
            Point(at=a, label="A, AP=AQ"),
        ],
    )


def _q122() -> DiagramSpec:
    return B.triangle_diagram(
        (0, 0),
        (4, 0),
        (1.5, 2.6),
        side_labels=("c", None, "b"),  # type: ignore[arg-type]
        mark_angle_at=0,
        angle_label="α",
    )


def _q123() -> DiagramSpec:
    b, c, d, a = (0, 0), (5, 0), (4, 6.928), (1.773, 3.07)
    return _custom(
        "sum-of-sides-construction",
        [b, c, d],
        [
            Segment(a=b, b=c, label="BC=a"),
            Segment(a=b, b=d, label="BD=s"),
            Segment(a=a, b=c, label="AC"),
            Segment(a=c, b=d, dashed=True, label="CD"),
            Point(at=b, label="B"),
            Point(at=c, label="C"),
            Point(at=d, label="D"),
            Point(at=a, label="A"),
            AngleMark(vertex=b, p1=c, p2=d, label="β"),
        ],
    )


def _q124() -> DiagramSpec:
    o, p, m = (0, 0), (5, 0), (2.5, 0)
    t1, t2 = (0.8, 1.833030278), (0.8, -1.833030278)
    points = [(-2, -2), (5.2, 2), o, p, m, t1, t2]
    return _custom(
        "tangent-construction",
        points,
        [
            Circle(center=o, radius=2, label="O", stroke="#2563eb"),
            Circle(center=m, radius=2.5, label="auxiliary circle", stroke="#94a3b8"),
            Segment(a=o, b=p, label="OP", dashed=True),
            Segment(a=p, b=t1, label="PT₁ tangent", color="#dc2626"),
            Segment(a=p, b=t2, label="PT₂ tangent", color="#dc2626"),
            Segment(a=o, b=t1),
            Segment(a=o, b=t2),
            Point(at=p, label="P"),
            Point(at=m, label="M midpoint"),
            Point(at=t1, label="T₁"),
            Point(at=t2, label="T₂"),
        ],
    )


def _q125() -> DiagramSpec:
    b, d, f = (0, 0), (4, 0), (1.5, 2.598)
    d_prime, c = (0, 4), (-2.598, 1.5)
    return _custom(
        "rotation-construction",
        [b, d, f, d_prime, c],
        [
            Polygon(points=[d, b, f], fill="#dbeafe", stroke="#2563eb"),
            Polygon(points=[d_prime, b, c], fill="#fee2e2", stroke="#dc2626"),
            Segment(a=b, b=d, label="BD=4"),
            Segment(a=b, b=f, label="BF=3"),
            Segment(a=d_prime, b=c, label="D′C"),
            Point(at=b, label="B"),
            Point(at=d, label="D"),
            Point(at=f, label="F"),
            Point(at=d_prime, label="D′"),
            Point(at=c, label="C"),
            AngleMark(vertex=b, p1=d, p2=f, label="60°"),
            Arrow(start=f, end=c, label="rotate 90°", dashed=True, color="#7c3aed"),
        ],
    )


def _q128() -> DiagramSpec:
    a, c, b, d = (0, 0), (15, 0), (6.6, 11.2), (6.6, 0)
    return _custom(
        "triangle-altitude",
        [a, b, c],
        [
            Polygon(points=[a, b, c]),
            Segment(a=a, b=b, label="AB=13"),
            Segment(a=b, b=c, label="BC=14"),
            Segment(a=a, b=c, label="AC=15"),
            Segment(a=b, b=d, label="BD ⟂ AC", color="#7c3aed"),
            Point(at=a, label="A"),
            Point(at=b, label="B"),
            Point(at=c, label="C"),
            Point(at=d, label="D"),
        ],
    )


def _q129() -> DiagramSpec:
    a, b, c, o = (0, 0), (13, 0), (99 / 13, 168 / 13), (6.5, 4.875)
    points = [(o[0] - 8.125, o[1] - 8.125), (o[0] + 8.125, o[1] + 8.125)]
    return _custom(
        "triangle-circumcircle",
        points,
        [
            Circle(center=o, radius=8.125, label="O", stroke="#2563eb"),
            Polygon(points=[a, b, c]),
            Segment(a=a, b=b, label="13"),
            Segment(a=b, b=c, label="14"),
            Segment(a=c, b=a, label="15"),
            Segment(a=o, b=a, label="R", color="#7c3aed"),
            Point(at=a, label="A"),
            Point(at=b, label="B"),
            Point(at=c, label="C"),
        ],
        pad=0.5,
    )


def _q130() -> DiagramSpec:
    a, c, b, center, foot = (0, 0), (15, 0), (6.6, 11.2), (7, 4), (7, 0)
    return _custom(
        "triangle-incircle",
        [a, b, c],
        [
            Polygon(points=[a, b, c]),
            Circle(center=center, radius=4, label="I", stroke="#2563eb"),
            Segment(a=a, b=b, label="13"),
            Segment(a=b, b=c, label="14"),
            Segment(a=c, b=a, label="15"),
            Segment(a=center, b=foot, label="r", color="#7c3aed"),
            Point(at=a, label="A"),
            Point(at=b, label="B"),
            Point(at=c, label="C"),
        ],
    )


def _q163() -> DiagramSpec:
    return _area_between(
        "x",
        "x**2",
        (0, 1),
        (-0.2, 1.2, -0.2, 1.2),
        "y=x",
        "y=x²",
        extra=[Point(at=(0, 0), label="(0,0)"), Point(at=(1, 1), label="(1,1)")],
    )


REBUILD: dict[str, tuple[str, Callable[[], DiagramSpec]]] = {
    "b210a760-e36c-5635-ac4e-4b3370df416b": (
        "Reframed the function so both interval extrema are visible and labeled.",
        _q14,
    ),
    "5fbeb26c-590d-57f9-85ce-ad397cbfe18b": (
        "Removed the false optimization marker from the feasible-area diagram.",
        _q25,
    ),
    "ac078f4f-3bc1-5793-9c6d-fa4e1b581b70": (
        "Scaled the vertical axis to the actual range of sin squared.",
        _sin_squared,
    ),
    "b03622c0-3b9f-5fcd-9ba4-3b80389afb43": (
        "Scaled the vertical axis to the actual range of sin squared.",
        _sin_squared,
    ),
    "134ec142-4a96-56a1-a62c-595e0777f59b": (
        "Expanded the viewport to include every feasible vertex and the optimum.",
        _q82,
    ),
    "d3731637-876c-5fa2-8992-0070ea182780": (
        "Rendered both parabola branches, the x=3 boundary, and the enclosed region.",
        _q93,
    ),
    "6400ec74-838c-59ae-a824-0eda7e0fbc17": (
        "Rendered the parabola, y=4, and the region between the stated curves.",
        _q94,
    ),
    "e9f6a45a-c7e8-567a-a189-a42e0076b3fe": (
        "Rendered vectors with lengths 3 and 4 and the stated 60-degree angle.",
        _q109,
    ),
    "302accd9-3c7c-50a5-bd56-c61beb0cf4a7": (
        "Added the midpoint, median, and all three side lengths.",
        _q116,
    ),
    "61890bac-d550-5f77-a37f-8e767a94a82e": (
        "Added D, the angle bisector, equal angle marks, and all side lengths.",
        _q117,
    ),
    "ec1cf2ce-abf3-53e8-a0f5-285317e3842c": (
        "Rendered all five consecutive angles in the stated half-plane.",
        _q118,
    ),
    "7e311c9c-3b01-571d-8e6e-0d0f25afccc8": (
        "Added both midpoints and the midpoint segment DE.",
        _q119,
    ),
    "53c68b38-39e1-5e8e-9889-aa3f54e563ea": (
        "Added the median endpoint D and the centroid G on the median.",
        _q120,
    ),
    "cb90d4a6-0665-56e8-828e-47de3a9323bf": (
        "Added A, the intercepted endpoints, named rays, and midpoint relation.",
        _q121,
    ),
    "e690fb29-ec9a-5c5f-b223-06f02bc64be8": (
        "Added the given side labels b and c to the included-angle construction.",
        _q122,
    ),
    "72a1d09c-b6aa-57a4-b3f3-da135dc0cb54": (
        "Added BC=a, BD=s, A on the construction ray, and the angle beta.",
        _q123,
    ),
    "881faf89-d90c-507c-a2d9-8939a5016f2e": (
        "Added P, midpoint M, the auxiliary circle, and both tangents.",
        _q124,
    ),
    "1c0cee0a-ed5a-587d-a712-7c521d7f1d81": (
        "Added the original and rotated triangles with C, D-prime, and the rotation.",
        _q125,
    ),
    "f7c84041-404d-5c07-b430-905289f8dd0d": (
        "Rebuilt the triangle to scale with side lengths 13, 14, and 15.",
        lambda: _triangle_13_14_15(mark_angle=True),
    ),
    "a531654c-eecd-58aa-b780-9a19b8150e5e": (
        "Added altitude BD, its foot, perpendicularity, and all side lengths.",
        _q128,
    ),
    "cbefff6d-8a97-5551-9589-d1de8deb1da3": (
        "Rebuilt the 13-14-15 triangle with its mathematically correct circumcircle.",
        _q129,
    ),
    "71efc019-b5a7-54a1-b1f1-238efcf64b37": (
        "Replaced the incorrect circumcircle with the correct incircle and radius.",
        _q130,
    ),
    "ecc88b01-b909-5905-8d9e-fd820dfe8954": (
        "Rendered both curves and shaded only their enclosed region.",
        _q163,
    ),
}


def _validate_question(question: dict, diagram_review: dict) -> dict:
    issues: list[str] = []
    try:
        TargetQuestion.model_validate(question)
    except Exception as exc:
        issues.append(f"target schema: {exc}")
    data = question.get("question_data") or {}
    options = data.get("options") or []
    labels = [str(option.get("label", "")).strip() for option in options]
    if len(options) != 4:
        issues.append("question must have exactly four options")
    if len(labels) != len(set(labels)):
        issues.append("option labels are not unique")
    if sum(bool(option.get("is_correct")) for option in options) != 1:
        issues.append("question must have exactly one correct option")
    meta = data.get("_meta") or {}
    for field in ("source_run_id", "source_book_id"):
        if not meta.get(field):
            issues.append(f"missing {field}")
    for field in ("source_pages", "source_chunk_ids"):
        if not meta.get(field):
            issues.append(f"missing {field}")
    latex_values = [
        question.get("question_title") or "",
        question.get("explanation") or "",
        *labels,
        *[str(option.get("rationale") or "") for option in options],
    ]
    for value in latex_values:
        valid, latex_issues = validate_latex(value)
        if not valid:
            issues.extend(latex_issues)
    if not diagram_review["passed"]:
        issues.extend(diagram_review["issues"])
    return {
        "question_id": question.get("id"),
        "topic": meta.get("topic"),
        "status": "PASSED" if not issues else "FAILED",
        "quality_score": max(0, 100 - 20 * len(set(issues))),
        "issues": sorted(set(issues)),
    }


def rebuild(source_run: Path, output_root: Path, run_id: str) -> Path:
    source_run = source_run.resolve()
    run_dir = (output_root / run_id).resolve()
    if run_dir.exists():
        raise FileExistsError(f"immutable output run already exists: {run_dir}")
    source_set = json.loads(
        (source_run / "questions" / "question_set.json").read_text(encoding="utf-8")
    )
    source_manifest = json.loads(
        (source_run / "manifest.json").read_text(encoding="utf-8")
    )
    questions = copy.deepcopy(source_set["questions"])
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    quiz_id = f"quiz-{uuid.uuid5(_ID_NAMESPACE, run_id).hex[:12]}"
    diagram_reviews: list[dict] = []
    question_validation: list[dict] = []
    old_to_new: dict[str, dict] = {}
    source_diagrams = 0

    for wrapped in questions:
        question = wrapped["question"]
        old_id = question["id"]
        data = question["question_data"]
        had_diagram = bool(data.get("diagram") or question.get("question_svg"))
        source_diagrams += int(had_diagram)
        if old_id in REMOVE:
            decision, rationale, expected = "removed", REMOVE[old_id], False
            data["diagram"] = None
            question["question_svg"] = None
        elif old_id in REBUILD:
            decision, (rationale, builder), expected = "rebuilt", REBUILD[old_id], True
            spec = builder()
            data["diagram"] = spec.model_dump(mode="json")
            question["question_svg"] = render_svg(spec)
        elif old_id in KEEP:
            decision, rationale, expected = "retained", KEEP[old_id], True
            spec = DiagramSpec.model_validate(data["diagram"])
            data["diagram"] = spec.model_dump(mode="json")
            question["question_svg"] = render_svg(spec)
        elif had_diagram:
            raise RuntimeError(f"diagram question has no review decision: {old_id}")
        else:
            decision = "not_needed"
            rationale = "The stem is self-contained and does not require a visual to answer."
            expected = False
        if stem_requires_diagram(question["question_title"]) and not expected:
            raise RuntimeError(f"required visual was removed from question {old_id}")

        new_id = str(uuid.uuid5(_ID_NAMESPACE, f"{run_id}|{old_id}"))
        question["id"] = new_id
        question["quiz_id"] = quiz_id
        question["quiz_title"] = f"{source_set['quiz_title']} (Validated Diagrams)"
        question["created_at"] = created_at
        review = validate_question_diagram(
            question,
            expected=expected,
            rationale=rationale,
        )
        review.update(
            {
                "question_id": new_id,
                "source_question_id": old_id,
                "topic": data.get("_meta", {}).get("topic"),
                "decision": decision,
                "diagram_required_by_stem": stem_requires_diagram(
                    question["question_title"]
                ),
                "diagram_useful": expected,
                "diagram_kind": (
                    (data.get("diagram") or {}).get("kind") if expected else None
                ),
            }
        )
        diagram_reviews.append(review)
        question_validation.append(_validate_question(question, review))
        old_to_new[old_id] = wrapped

    if len(old_to_new) != len(questions):
        raise RuntimeError("question IDs are not unique")
    failed = [record for record in question_validation if record["status"] != "PASSED"]
    failed_diagrams = [record for record in diagram_reviews if not record["passed"]]
    if failed or failed_diagrams:
        raise RuntimeError(
            "validation failed: "
            + json.dumps(
                {
                    "questions": failed,
                    "diagrams": failed_diagrams,
                },
                ensure_ascii=False,
            )
        )

    question_set = copy.deepcopy(source_set)
    question_set.update(
        {
            "quiz_id": quiz_id,
            "quiz_title": f"{source_set['quiz_title']} (Validated Diagrams)",
            "count": len(questions),
            "questions": questions,
            "derived_from_question_run": source_manifest["run_id"],
            "diagram_validation_passed": True,
        }
    )
    (run_dir / "questions" / "topics").mkdir(parents=True)
    (run_dir / "validation").mkdir()
    (run_dir / "questions" / "question_set.json").write_text(
        json.dumps(question_set, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    source_topic_dir = source_run / "questions" / "topics"
    for source_topic in sorted(source_topic_dir.glob("*.json")):
        payload = json.loads(source_topic.read_text(encoding="utf-8"))
        payload["questions"] = [
            old_to_new[wrapped["question"]["id"]]
            for wrapped in payload.get("questions", [])
        ]
        (run_dir / "questions" / "topics" / source_topic.name).write_text(
            json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    validation_report = {
        "passed": True,
        "expected_topics": source_set["topic_count"],
        "completed_topics": source_set["topic_count"],
        "expected_questions": source_set["count"],
        "generated_questions": len(questions),
        "failed_topics": [],
        "failed_questions": [],
        "questions": question_validation,
    }
    (run_dir / "validation" / "question_validation.json").write_text(
        json.dumps(validation_report, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    decision_counts = {
        name: sum(review["decision"] == name for review in diagram_reviews)
        for name in ("retained", "rebuilt", "removed", "not_needed")
    }
    diagram_report = {
        "passed": True,
        "source_question_run": source_manifest["run_id"],
        "questions_reviewed": len(questions),
        "source_diagrams": source_diagrams,
        "final_diagrams": sum(review["diagram_useful"] for review in diagram_reviews),
        "decisions": decision_counts,
        "failed_diagrams": [],
        "questions": diagram_reviews,
    }
    (run_dir / "validation" / "diagram_validation.json").write_text(
        json.dumps(diagram_report, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    manifest = {
        **source_manifest,
        "run_id": run_id,
        "run_type": "question_diagram_revalidation",
        "status": "completed",
        "created_at": created_at,
        "completed_at": created_at,
        "derived_from_question_run": source_manifest["run_id"],
        "quiz_id": quiz_id,
        "validation_passed": True,
        "diagram_validation_passed": True,
        "persisted": False,
        "diagram_counts": {
            "source": source_diagrams,
            "final": diagram_report["final_diagrams"],
            **decision_counts,
        },
        "files": {
            "question_set.json": "questions/question_set.json",
            "question_validation.json": "validation/question_validation.json",
            "diagram_validation.json": "validation/diagram_validation.json",
            "topics": "questions/topics",
        },
    }
    (run_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return run_dir


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-run", type=Path, default=_DEFAULT_SOURCE)
    parser.add_argument("--output-root", type=Path, default=_DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--run-id", default="questions-prilepko-20260721-04")
    args = parser.parse_args()
    output = rebuild(args.source_run, args.output_root, args.run_id)
    print(f"[diagrams] wrote validated immutable question run: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
