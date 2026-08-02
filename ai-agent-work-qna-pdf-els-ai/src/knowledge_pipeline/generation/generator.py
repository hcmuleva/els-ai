"""Route topics to deterministic templates and emit target-schema questions."""
from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Sequence

from ..config import PipelineConfig
from ..quizschema.adapter import to_target_question
from . import math_templates as T

# Parameter pools keep questions reproducible while offering variety by index.
_DISTANCE = [((0, 0), (3, 4)), ((1, 2), (4, 6)), ((0, 0), (6, 8)), ((0, 0), (5, 12))]
_RECT = [(5, 3), (8, 4), (6, 6), (7, 2)]
_TRI = [(50, 60), (40, 75), (30, 90), (45, 55)]
_FUNC = [("x**2 - 1", 2), ("2*x + 3", 1), ("x**2 - 2*x", 3), ("3*x - 4", 2)]
_LPP = [
    ((3, 4), [(0, 0), (4, 0), (3, 3), (0, 5)]),
    ((5, 3), [(0, 0), (6, 0), (4, 4), (0, 6)]),
]
_GRAPH = [
    ("x**2", ["x**3", "-x**2", "2*x"]),
    ("x**2 - 2", ["x**2 + 2", "-x**2", "x"]),
]

# JEE-level parameter pools (Class 12).
_INTEGRAL = [("x**2", 0, 3), ("2*x + 1", 1, 4), ("3*x**2 - 2*x", 0, 2), ("x**3", 0, 2)]
_DERIV = [("x**3 - 3*x", 2), ("x**2 + 2*x", 3), ("2*x**3 - 3*x**2", 1), ("x**4 - x**2", 2)]
_EXTREMUM = ["x**3 - 3*x", "x**2 - 4*x + 3", "2*x**3 - 3*x**2 - 12*x", "x**2 + 2*x + 5"]
_DET = [
    [[1, 2, 3], [0, 1, 4], [5, 6, 0]],
    [[2, 0, 1], [1, 3, 2], [4, 1, 8]],
    [[1, 1, 1], [1, 2, 3], [1, 4, 9]],
]
_VEC = [((1, 2, 2), (2, 1, 2)), ((3, 0, 4), (0, 5, 0)), ((1, -1, 2), (2, 3, 1))]
_INV_TRIG = [
    ("sin\u207b\u00b9", "1/2", "\u03c0/6", ["\u03c0/3", "\u03c0/4", "\u03c0/2"]),
    ("cos\u207b\u00b9", "0", "\u03c0/2", ["0", "\u03c0", "\u03c0/3"]),
    ("tan\u207b\u00b9", "1", "\u03c0/4", ["\u03c0/3", "\u03c0/6", "\u03c0/2"]),
]
_DIFFEQ = [
    ("(dy/dx)\u00b2 + y = x", 1, "2"),
    ("d\u00b2y/dx\u00b2 + 3(dy/dx) + 2y = 0", 2, "1"),
    ("d\u00b3y/dx\u00b3 + (dy/dx)\u2074 = 0", 3, "1"),
]
_PROB = [(100, 40, 30, 12), (200, 80, 60, 24), (50, 20, 15, 8)]


def _f_distance(i: int, level: str, cids) -> Dict[str, Any]:
    a, b = _DISTANCE[i % len(_DISTANCE)]
    return T.distance_between_points(a, b, level_band=level, concept_ids=cids)


def _f_rect(i: int, level: str, cids) -> Dict[str, Any]:
    w, h = _RECT[i % len(_RECT)]
    return T.rectangle_area(w, h, level_band=level, concept_ids=cids)


def _f_tri(i: int, level: str, cids) -> Dict[str, Any]:
    a1, a2 = _TRI[i % len(_TRI)]
    return T.triangle_third_angle(a1, a2, level_band=level, concept_ids=cids)


def _f_func(i: int, level: str, cids) -> Dict[str, Any]:
    expr, x0 = _FUNC[i % len(_FUNC)]
    return T.function_value(expr, x0, level_band=level, concept_ids=cids)


def _f_lpp(i: int, level: str, cids) -> Dict[str, Any]:
    obj, verts = _LPP[i % len(_LPP)]
    return T.lpp_optimum(obj, verts, level_band=level, concept_ids=cids)


def _f_graph(i: int, level: str, cids) -> Dict[str, Any]:
    correct, distractors = _GRAPH[i % len(_GRAPH)]
    return T.graph_match(correct, distractors, level_band=level, concept_ids=cids)


def _f_integral(i: int, level: str, cids) -> Dict[str, Any]:
    expr, a, b = _INTEGRAL[i % len(_INTEGRAL)]
    return T.definite_integral(expr, a, b, level_band=level, concept_ids=cids)


def _f_deriv(i: int, level: str, cids) -> Dict[str, Any]:
    expr, x0 = _DERIV[i % len(_DERIV)]
    return T.derivative_at_point(expr, x0, level_band=level, concept_ids=cids)


def _f_extremum(i: int, level: str, cids) -> Dict[str, Any]:
    return T.local_extremum(_EXTREMUM[i % len(_EXTREMUM)], level_band=level, concept_ids=cids)


def _f_det(i: int, level: str, cids) -> Dict[str, Any]:
    return T.determinant_3x3(_DET[i % len(_DET)], level_band=level, concept_ids=cids)


def _f_vec(i: int, level: str, cids) -> Dict[str, Any]:
    u, v = _VEC[i % len(_VEC)]
    return T.vectors_dot_product(u, v, level_band=level, concept_ids=cids)


def _f_invtrig(i: int, level: str, cids) -> Dict[str, Any]:
    fn, arg, correct, distractors = _INV_TRIG[i % len(_INV_TRIG)]
    return T.inverse_trig_value(fn, arg, correct, distractors, level_band=level, concept_ids=cids)


def _f_diffeq(i: int, level: str, cids) -> Dict[str, Any]:
    eq, order, degree = _DIFFEQ[i % len(_DIFFEQ)]
    return T.diff_eq_order_degree(eq, order, degree, level_band=level, concept_ids=cids)


def _f_prob(i: int, level: str, cids) -> Dict[str, Any]:
    total, a, b, ab = _PROB[i % len(_PROB)]
    return T.conditional_probability(total, a, b, ab, level_band=level, concept_ids=cids)


Family = Callable[[int, str, Optional[Sequence[str]]], Dict[str, Any]]

_ROUTES: List[tuple[tuple[str, ...], List[Family]]] = [
    (("linear programming", "lpp"), [_f_lpp]),
    (("integral", "integration"), [_f_integral]),
    (("application of derivative", "maxima", "minima", "tangent", "increasing"), [_f_extremum]),
    (("continuity", "differentiab", "derivative"), [_f_deriv]),
    (("determinant", "matrix", "matrices"), [_f_det]),
    (("vector",), [_f_vec]),
    (("inverse trigonometr", "inverse trig"), [_f_invtrig]),
    (("differential equation",), [_f_diffeq]),
    (("probability",), [_f_prob]),
    (("relations", "function"), [_f_func, _f_graph]),
    (("coordinate", "three dimensional", "geometry"), [_f_distance]),
    (("triangle", "trigonometr"), [_f_tri]),
    (("mensuration", "area", "volume"), [_f_rect]),
]
_DEFAULT: List[Family] = [_f_integral, _f_deriv, _f_det, _f_vec]


def _families_for(topic: str) -> List[Family]:
    t = (topic or "").lower()
    for keys, fams in _ROUTES:
        if any(k in t for k in keys):
            return fams
    return _DEFAULT


class QuestionGenerator:
    def __init__(self, config: PipelineConfig) -> None:
        self.config = config

    def generate_items(
        self,
        topic: str,
        level_band: str = "intermediate",
        count: int = 3,
        concept_ids: Optional[Sequence[str]] = None,
    ) -> List[Dict[str, Any]]:
        families = _families_for(topic)
        items: List[Dict[str, Any]] = []
        for i in range(count):
            fam = families[i % len(families)]
            items.append(fam(i, level_band, concept_ids))
        return items

    def to_target(
        self,
        items: Sequence[Dict[str, Any]],
        quiz_id: Optional[str] = None,
        quiz_title: str = "Question Bank",
        created_at: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        out = []
        for i, item in enumerate(items):
            tq = to_target_question(
                item,
                identity=self.config.identity,
                quiz_id=quiz_id,
                quiz_title=quiz_title,
                created_at=created_at,
                sort_order=i + 1,
            )
            out.append(tq.wrapped())
        return out

    def generate_quiz(
        self,
        topic: str,
        level_band: str = "intermediate",
        count: int = 3,
        quiz_id: Optional[str] = None,
        quiz_title: str = "Question Bank",
        concept_ids: Optional[Sequence[str]] = None,
        created_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        items = self.generate_items(topic, level_band, count, concept_ids)
        questions = self.to_target(items, quiz_id, quiz_title, created_at)
        return {
            "quiz_id": quiz_id,
            "quiz_title": quiz_title,
            "topic": topic,
            "level_band": level_band,
            "subject": self.config.identity.subject,
            "class_level": self.config.identity.class_level,
            "count": len(questions),
            "questions": questions,
        }
