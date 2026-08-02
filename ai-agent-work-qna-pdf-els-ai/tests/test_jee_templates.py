"""Correctness checks for the JEE-level templates (answers must be exact)."""
import sympy

from knowledge_pipeline.generation import math_templates as T


def _correct(item):
    return next(o["label"] for o in item["options"] if o["is_correct"])


def _one_key(item):
    assert sum(1 for o in item["options"] if o["is_correct"]) == 1
    assert 2 <= len(item["options"]) <= 4


def test_definite_integral_exact():
    item = T.definite_integral("x**2", 0, 3)
    _one_key(item)
    assert _correct(item) == "9"  # ∫0..3 x^2 = 9


def test_derivative_at_point_exact():
    item = T.derivative_at_point("x**3 - 3*x", 2)  # f'=3x^2-3 -> 9
    _one_key(item)
    assert _correct(item) == "9"


def test_local_extremum_is_true_minimum():
    item = T.local_extremum("x**3 - 3*x")  # min at x=1
    _one_key(item)
    assert _correct(item) == "x = 1"


def test_determinant_matches_sympy():
    rows = [[1, 2, 3], [0, 1, 4], [5, 6, 0]]
    item = T.determinant_3x3(rows)
    _one_key(item)
    assert _correct(item) == str(sympy.Matrix(rows).det())


def test_dot_product_exact():
    item = T.vectors_dot_product((1, 2, 2), (2, 1, 2))  # 2+2+4 = 8
    _one_key(item)
    assert _correct(item) == "8"


def test_conditional_probability_exact():
    item = T.conditional_probability(100, 40, 30, 12)  # P(B|A)=12/40=3/10
    _one_key(item)
    assert _correct(item) == "3/10"


def test_inverse_trig_principal_value():
    item = T.inverse_trig_value("sin\u207b\u00b9", "1/2", "\u03c0/6", ["\u03c0/3", "\u03c0/4", "\u03c0/2"])
    _one_key(item)
    assert _correct(item) == "\u03c0/6"


def test_diff_eq_order_degree_label():
    item = T.diff_eq_order_degree("(dy/dx)\u00b2 + y = x", 1, "2")
    _one_key(item)
    assert _correct(item) == "order 1, degree 2"
