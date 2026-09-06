from qfactory import solver


def test_numeric_verified_when_value_matches():
    spec = {"kind": "numeric", "expression": "9e9*2e-6*3e-6/0.1**2", "expected": 5.4, "tol": 0.001}
    res = solver.verify(spec, ["$5.4\\ \\text{N}$"], None)
    assert res.status == solver.VERIFIED


def test_numeric_refuted_when_expected_wrong():
    spec = {"kind": "numeric", "expression": "10/(4+6)", "expected": 2, "tol": 0.0001}
    res = solver.verify(spec, ["$1\\ \\text{A}$"], None)
    assert res.status == solver.REFUTED


def test_numeric_refuted_when_answer_label_mismatch():
    spec = {"kind": "numeric", "expression": "5-2", "expected": 3, "tol": 0.0001}
    res = solver.verify(spec, ["$7\\ \\text{eV}$"], None)
    assert res.status == solver.REFUTED


def test_definite_integral_verified():
    spec = {"kind": "symbolic_integral_def", "integrand": "3*x**2", "lower": 1, "upper": 2, "expected": 7}
    res = solver.verify(spec, ["$7$"], None)
    assert res.status == solver.VERIFIED


def test_no_spec_is_skipped():
    res = solver.verify(None, ["True"], None)
    assert res.status == solver.SKIPPED
