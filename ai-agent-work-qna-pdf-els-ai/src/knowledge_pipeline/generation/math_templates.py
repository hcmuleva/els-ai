"""Parametric math-question templates.

Each returns an internal question item (see quizschema.adapter). Because the
correct answer is computed with sympy and the diagram is built from the same
parameters, the stem, diagram, options and key are always mutually consistent.
"""
from __future__ import annotations

import math
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple

import sympy

from ..diagram import builders as B

XY = Tuple[float, float]

_SUP = {"0": "\u2070", "1": "\u00b9", "2": "\u00b2", "3": "\u00b3", "4": "\u2074",
        "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079"}


def _pretty(expr: Any) -> str:
    """Render a sympy/py expression string in readable math notation (x**2 -> x\u00b2)."""
    s = str(expr).replace("**", "^")
    s = re.sub(r"\^(\d+)", lambda m: "".join(_SUP[d] for d in m.group(1)), s)
    return s.replace("*", "")


def _num(value: Any) -> str:
    v = sympy.nsimplify(value) if not isinstance(value, sympy.Basic) else value
    v = sympy.simplify(v)
    if v.is_Integer:
        return str(int(v))
    if v.is_Rational:
        return str(v)
    f = float(v)
    return str(int(round(f))) if abs(f - round(f)) < 1e-9 else f"{f:.2f}"


def _item(
    stem: str,
    options: List[Dict[str, Any]],
    *,
    topic: str,
    source: str,
    level_band: str,
    explanation: str,
    question_diagram=None,
    bloom_level: str = "Apply",
    concept_ids: Optional[Sequence[str]] = None,
) -> Dict[str, Any]:
    return {
        "stem": stem,
        "options": options,
        "topic": topic,
        "source": source,
        "level_band": level_band,
        "bloom_level": bloom_level,
        "explanation": explanation,
        "question_diagram": question_diagram,
        "concept_ids": list(concept_ids or []),
    }


def _mcq(correct: str, distractors: Sequence[str]) -> List[Dict[str, Any]]:
    seen = {correct}
    opts = [{"label": correct, "is_correct": True}]
    for d in distractors:
        if d not in seen:
            seen.add(d)
            opts.append({"label": d, "is_correct": False})
        if len(opts) == 4:
            break
    return opts


def _num_options(value: Any, extra: Sequence[Any] = ()) -> List[Dict[str, Any]]:
    """Build a 4-option numeric MCQ with distinct, sympy-consistent distractors."""
    v = sympy.nsimplify(value) if not isinstance(value, sympy.Basic) else value
    correct = _num(v)
    labels = [correct]
    for cand in list(extra) + [v + 1, v - 1, v + 2, v - 2, v + 3, 2 * v, -v]:
        lbl = _num(cand)
        if lbl not in labels:
            labels.append(lbl)
        if len(labels) == 4:
            break
    return _mcq(labels[0], labels[1:])


def distance_between_points(
    a: XY, b: XY, level_band: str = "intermediate", concept_ids=None
) -> Dict[str, Any]:
    dx, dy = b[0] - a[0], b[1] - a[1]
    d = sympy.sqrt(sympy.Integer(int(dx)) ** 2 + sympy.Integer(int(dy)) ** 2)
    correct = _num(d)
    distractors = [_num(abs(dx) + abs(dy)), _num(sympy.Abs(dx * dy)), _num(sympy.Abs(dx) + 1)]
    diagram = B.coordinate_diagram(
        points=[(a[0], a[1], "A"), (b[0], b[1], "B")],
        segments=[((a[0], a[1]), (b[0], b[1]), "d")],
        title="Distance between two points",
    )
    return _item(
        f"Find the distance between A({_num(a[0])}, {_num(a[1])}) and B({_num(b[0])}, {_num(b[1])}).",
        _mcq(correct, distractors),
        topic="Coordinate Geometry",
        source="template:distance_between_points",
        level_band=level_band,
        explanation=f"AB = sqrt((x2-x1)^2 + (y2-y1)^2) = sqrt({int(dx)}^2 + {int(dy)}^2) = {correct}.",
        question_diagram=diagram,
        concept_ids=concept_ids,
    )


def rectangle_area(
    w: float, h: float, level_band: str = "beginner", concept_ids=None
) -> Dict[str, Any]:
    area = _num(sympy.Integer(int(w)) * sympy.Integer(int(h)))
    perim = _num(2 * (int(w) + int(h)))
    diagram = B.mensuration_rectangle(w, h, f"{_num(w)} cm", f"{_num(h)} cm", title="Rectangle")
    return _item(
        f"A rectangle has width {_num(w)} cm and height {_num(h)} cm. Find its area (in cm^2).",
        _mcq(area, [perim, _num(int(w) + int(h)), _num(int(w) * int(h) + int(w))]),
        topic="Mensuration",
        source="template:rectangle_area",
        level_band=level_band,
        explanation=f"Area = width x height = {_num(w)} x {_num(h)} = {area} cm^2.",
        question_diagram=diagram,
        bloom_level="Apply",
        concept_ids=concept_ids,
    )


def triangle_third_angle(
    a1: int, a2: int, level_band: str = "beginner", concept_ids=None
) -> Dict[str, Any]:
    third = 180 - a1 - a2
    diagram = B.triangle_diagram(
        (0, 0), (4, 0), (1, 3), mark_angle_at=0, angle_label=f"{a1}°", title="Triangle angles"
    )
    return _item(
        f"Two angles of a triangle measure {a1}° and {a2}°. Find the third angle.",
        _mcq(f"{third}°", [f"{third + 10}°", f"{180 - a1}°", f"{a1 + a2}°"]),
        topic="Triangles",
        source="template:triangle_third_angle",
        level_band=level_band,
        explanation=f"Angle sum = 180°, so third = 180 - {a1} - {a2} = {third}°.",
        question_diagram=diagram,
        concept_ids=concept_ids,
    )


def function_value(
    expr: str, x0: float, xmin: float = -4, xmax: float = 4, level_band: str = "intermediate",
    concept_ids=None,
) -> Dict[str, Any]:
    x = sympy.Symbol("x")
    fx = sympy.sympify(expr)
    val = fx.subs(x, x0)
    correct = _num(val)
    distractors = [_num(val + 1), _num(val - 2), _num(-val if val != 0 else val + 3)]
    ys = [float(fx.subs(x, xv)) for xv in (xmin, (xmin + xmax) / 2, xmax, x0)]
    ymin, ymax = math.floor(min(ys)) - 1, math.ceil(max(ys)) + 1
    diagram = B.function_plot(
        expr, xmin, xmax, ymin, ymax, label=f"y={expr}",
        points=[(float(x0), float(val), "P")], title="Function value",
    )
    return _item(
        f"For f(x) = {expr}, evaluate f({_num(x0)}).",
        _mcq(correct, distractors),
        topic="Relations and Functions",
        source="template:function_value",
        level_band=level_band,
        explanation=f"Substitute x = {_num(x0)} into f(x) = {expr} to get {correct}.",
        question_diagram=diagram,
        concept_ids=concept_ids,
    )


def lpp_optimum(
    objective: Tuple[int, int],
    vertices: Sequence[XY],
    sense: str = "max",
    level_band: str = "jee_main",
    concept_ids=None,
) -> Dict[str, Any]:
    cx, cy = objective
    scored = [((cx * vx + cy * vy), (vx, vy)) for vx, vy in vertices]
    best = max(scored) if sense == "max" else min(scored)
    xmax = max(v[0] for v in vertices) + 2
    ymax = max(v[1] for v in vertices) + 2
    diagram = B.lpp_region(
        constraints=[],
        feasible_vertices=list(vertices),
        xmax=xmax,
        ymax=ymax,
        optimum=(best[1][0], best[1][1], f"Z={_num(best[0])}"),
        title="Linear programming",
    )
    options = []
    for z, (vx, vy) in scored:
        options.append(
            {
                "label": f"({_num(vx)}, {_num(vy)})",
                "is_correct": (vx, vy) == best[1],
                "rationale": f"Z = {cx}·{_num(vx)} + {cy}·{_num(vy)} = {_num(z)}",
            }
        )
    return _item(
        f"{'Maximize' if sense == 'max' else 'Minimize'} Z = {cx}x + {cy}y over the feasible "
        f"region shown. At which corner point is Z optimal?",
        options[:4],
        topic="Linear Programming",
        source="template:lpp_optimum",
        level_band=level_band,
        explanation=f"Evaluate Z at each corner; optimum is {best[1]} with Z = {_num(best[0])}.",
        question_diagram=diagram,
        bloom_level="Analyze",
        concept_ids=concept_ids,
    )


def graph_match(
    correct_expr: str,
    distractor_exprs: Sequence[str],
    xmin: float = -3,
    xmax: float = 3,
    ymin: float = -4,
    ymax: float = 4,
    level_band: str = "intermediate",
    concept_ids=None,
) -> Dict[str, Any]:
    """Options carry their own SVG (graph images); the stem has no diagram."""
    exprs = [(correct_expr, True)] + [(e, False) for e in distractor_exprs]
    options = []
    for i, (expr, is_correct) in enumerate(exprs[:4]):
        diagram = B.function_plot(expr, xmin, xmax, ymin, ymax, label=None)
        options.append(
            {
                "label": f"Graph {chr(65 + i)}",
                "is_correct": is_correct,
                "diagram": diagram,
                "rationale": f"y = {expr}",
            }
        )
    return _item(
        f"Which of the following graphs represents y = {correct_expr}?",
        options,
        topic="Relations and Functions",
        source="template:graph_match",
        level_band=level_band,
        explanation=f"The correct graph is the plot of y = {correct_expr}.",
        question_diagram=None,
        bloom_level="Understand",
        concept_ids=concept_ids,
    )


# --------------------------------------------------------------------------- #
# JEE-level templates (Class 12). Answers are computed with sympy so the stem,
# options and key stay consistent; diagrams are built from the same parameters.
# --------------------------------------------------------------------------- #

_X = sympy.Symbol("x")


def definite_integral(
    expr: str, a: int, b: int, level_band: str = "jee_main", concept_ids=None
) -> Dict[str, Any]:
    fx = sympy.sympify(expr)
    val = sympy.integrate(fx, (_X, a, b))
    F = sympy.integrate(fx, _X)
    wrong = [F.subs(_X, b) + F.subs(_X, a), F.subs(_X, b), val * 2]  # common slips
    ys = [float(fx.subs(_X, xv)) for xv in (a, (a + b) / 2, b)]
    ymin, ymax = math.floor(min(ys + [0])) - 1, math.ceil(max(ys + [0])) + 1
    diagram = B.function_plot(
        expr, a - 1, b + 1, ymin, ymax, label=f"y={expr}",
        points=[(float(a), float(fx.subs(_X, a)), "a"), (float(b), float(fx.subs(_X, b)), "b")],
        title="Area under the curve",
    )
    return _item(
        f"Evaluate the definite integral  \u222b from {a} to {b} of {_pretty(expr)} dx.",
        _num_options(val, wrong),
        topic="Integrals",
        source="template:definite_integral",
        level_band=level_band,
        explanation=(
            f"\u222b {_pretty(expr)} dx = {_pretty(F)} + C; "
            f"evaluate from {a} to {b}: F({b}) - F({a}) = {_num(val)}."
        ),
        question_diagram=diagram,
        bloom_level="Apply",
        concept_ids=concept_ids,
    )


def derivative_at_point(
    expr: str, x0: int, level_band: str = "jee_main", concept_ids=None
) -> Dict[str, Any]:
    fx = sympy.sympify(expr)
    d = sympy.diff(fx, _X)
    val = d.subs(_X, x0)
    wrong = [fx.subs(_X, x0), sympy.diff(d, _X).subs(_X, x0), val + x0]
    fval = float(fx.subs(_X, x0))
    diagram = B.function_plot(
        expr, x0 - 3, x0 + 3, math.floor(fval) - 4, math.ceil(fval) + 4,
        label=f"y={expr}", points=[(float(x0), fval, "P")], title="Slope at a point",
    )
    return _item(
        f"If f(x) = {_pretty(expr)}, find f\u2032({x0}) (the derivative evaluated at x = {x0}).",
        _num_options(val, wrong),
        topic="Continuity and Differentiability",
        source="template:derivative_at_point",
        level_band=level_band,
        explanation=f"f\u2032(x) = {_pretty(d)}; f\u2032({x0}) = {_num(val)}.",
        question_diagram=diagram,
        bloom_level="Apply",
        concept_ids=concept_ids,
    )


def local_extremum(
    expr: str, level_band: str = "jee_advanced", concept_ids=None
) -> Dict[str, Any]:
    fx = sympy.sympify(expr)
    d1 = sympy.diff(fx, _X)
    d2 = sympy.diff(fx, _X, 2)
    crit = [c for c in sympy.solve(d1, _X) if c.is_real]
    minima = [c for c in crit if d2.subs(_X, c) > 0]
    target = minima[0] if minima else (crit[0] if crit else sympy.Integer(0))
    correct = f"x = {_num(target)}"
    wrong_pts = [c for c in crit if c != target]
    distractors = [f"x = {_num(c)}" for c in wrong_pts]
    distractors += [f"x = {_num(target + 1)}", f"x = {_num(-target)}", "No critical point"]
    lo = float(min(crit + [sympy.Integer(0)])) - 2 if crit else -3.0
    hi = float(max(crit + [sympy.Integer(0)])) + 2 if crit else 3.0
    ys = [float(fx.subs(_X, xv)) for xv in (lo, hi, float(target))]
    diagram = B.function_plot(
        expr, lo, hi, math.floor(min(ys)) - 1, math.ceil(max(ys)) + 1,
        label=f"y={expr}", points=[(float(target), float(fx.subs(_X, target)), "min")],
        title="Local minimum",
    )
    return _item(
        f"The function f(x) = {_pretty(expr)} has a local minimum at which point?",
        _mcq(correct, distractors),
        topic="Application of Derivatives",
        source="template:local_extremum",
        level_band=level_band,
        explanation=(
            f"Set f\u2032(x) = {_pretty(d1)} = 0; "
            f"a minimum needs f\u2033(x) > 0. This gives {correct}."
        ),
        question_diagram=diagram,
        bloom_level="Analyze",
        concept_ids=concept_ids,
    )


def determinant_3x3(
    rows: Sequence[Sequence[int]], level_band: str = "jee_main", concept_ids=None
) -> Dict[str, Any]:
    M = sympy.Matrix(rows)
    val = M.det()
    trace = sum(rows[i][i] for i in range(len(rows)))
    matrix_txt = "; ".join("[" + ", ".join(str(v) for v in r) + "]" for r in rows)
    return _item(
        f"Evaluate the determinant of the 3\u00d73 matrix  [{matrix_txt}].",
        _num_options(val, [trace, val + 6, -val]),
        topic="Determinants",
        source="template:determinant_3x3",
        level_band=level_band,
        explanation=(
            "Expand along the first row: "
            f"det = {_num(val)} (cofactor expansion)."
        ),
        bloom_level="Apply",
        concept_ids=concept_ids,
    )


def vectors_dot_product(
    u: Sequence[int], v: Sequence[int], level_band: str = "jee_main", concept_ids=None
) -> Dict[str, Any]:
    U, V = sympy.Matrix(u), sympy.Matrix(v)
    dot = (U.T * V)[0]
    cross_mag_sq = (U.norm() ** 2) * (V.norm() ** 2) - dot ** 2
    wrong = [U.dot(U), V.dot(V), dot + 2]
    diagram = B.coordinate_diagram(
        points=[(int(u[0]), int(u[1]), "u"), (int(v[0]), int(v[1]), "v")],
        segments=[((0, 0), (int(u[0]), int(u[1])), "u"), ((0, 0), (int(v[0]), int(v[1])), "v")],
        title="Vectors from the origin",
    )
    return _item(
        f"Given a = {tuple(int(x) for x in u)} and b = {tuple(int(x) for x in v)} "
        f"(i, j, k components), find the scalar product a\u00b7b.",
        _num_options(dot, wrong),
        topic="Vector Algebra",
        source="template:vectors_dot_product",
        level_band=level_band,
        explanation=(
            f"a\u00b7b = "
            + " + ".join(f"({int(ai)})({int(bi)})" for ai, bi in zip(u, v))
            + f" = {_num(dot)}."
        ),
        question_diagram=diagram,
        bloom_level="Apply",
        concept_ids=concept_ids,
    )


def inverse_trig_value(
    fn: str, arg: str, correct: str, distractors: Sequence[str],
    level_band: str = "jee_main", concept_ids=None,
) -> Dict[str, Any]:
    return _item(
        f"Find the principal value of {fn}({arg}).",
        _mcq(correct, distractors),
        topic="Inverse Trigonometric Functions",
        source="template:inverse_trig_value",
        level_band=level_band,
        explanation=f"The principal value of {fn}({arg}) is {correct}.",
        bloom_level="Understand",
        concept_ids=concept_ids,
    )


def diff_eq_order_degree(
    equation: str, order: int, degree: str, level_band: str = "jee_main", concept_ids=None
) -> Dict[str, Any]:
    correct = f"order {order}, degree {degree}"
    distractors = [
        f"order {order + 1}, degree {degree}",
        f"order {order}, degree {int(degree) + 1 if degree.isdigit() else 2}",
        f"order {max(order - 1, 1)}, degree {degree}",
    ]
    return _item(
        f"State the order and degree of the differential equation:  {equation}.",
        _mcq(correct, distractors),
        topic="Differential Equations",
        source="template:diff_eq_order_degree",
        level_band=level_band,
        explanation=(
            "Order = highest derivative present; degree = power of the highest-order "
            f"derivative once the equation is polynomial in derivatives. Here: {correct}."
        ),
        bloom_level="Understand",
        concept_ids=concept_ids,
    )


def conditional_probability(
    total: int, a: int, b: int, a_and_b: int, level_band: str = "jee_main", concept_ids=None
) -> Dict[str, Any]:
    pba = sympy.Rational(a_and_b, a)          # P(B|A)
    wrong = [
        sympy.Rational(a_and_b, total),        # P(A ∩ B)
        sympy.Rational(b, total),              # P(B)
        sympy.Rational(a, total),              # P(A)
    ]
    labels = [str(pba)] + [str(w) for w in wrong]
    seen, opts = set(), []
    for lbl, correct in zip(labels, [True, False, False, False]):
        if lbl in seen:
            continue
        seen.add(lbl)
        opts.append({"label": lbl, "is_correct": correct})
    return _item(
        f"Of {total} students, {a} play chess (A) and {b} play carrom (B); "
        f"{a_and_b} play both. Find P(B | A).",
        opts[:4],
        topic="Probability",
        source="template:conditional_probability",
        level_band=level_band,
        explanation=(
            f"P(B|A) = P(A\u2229B)/P(A) = ({a_and_b}/{total}) / ({a}/{total}) "
            f"= {a_and_b}/{a} = {pba}."
        ),
        bloom_level="Apply",
        concept_ids=concept_ids,
    )
