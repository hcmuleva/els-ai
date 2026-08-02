import json

from knowledge_pipeline.assessment import AssessmentGenerator
from knowledge_pipeline.assessment.schema import VerifySpec
from knowledge_pipeline.assessment.validation import (
    validate_latex,
    validate_svg,
    verify_answer_symbolic,
)
from knowledge_pipeline.config import IdentityConfig, PipelineConfig
from knowledge_pipeline.diagram import builders as B
from knowledge_pipeline.rendering.svg import render_svg
from knowledge_pipeline.serving.context import StubRetriever
from knowledge_pipeline.serving.llm import StubLLM


def _config():
    cfg = PipelineConfig(provider="mock")
    cfg.identity = IdentityConfig(
        creator_id="c-1", organization_id="o-1", subject="Mathematics", class_level="Class 12"
    )
    return cfg


# ------------------------------------------------------------------- LaTeX
def test_validate_latex_balanced_and_unbalanced():
    assert validate_latex(r"\( \frac{1}{2} + x^2 \)")[0] is True
    assert validate_latex(r"\( \frac{1}{2 \)")[0] is False          # unclosed brace
    assert validate_latex(r"\( x \( y")[0] is False                 # unbalanced \( \)
    assert validate_latex("")[0] is True
    # arrow commands must NOT be mistaken for \left / \right
    assert validate_latex(r"\( A \leftrightarrow P,\ B \rightarrow Q \)")[0] is True
    assert validate_latex(r"\( \left( \frac{a}{b} \right) \)")[0] is True
    assert validate_latex(r"\( \left( x \)")[0] is False            # real unbalanced \left
    assert validate_latex(r"\( x\in[0,2\pi) \)")[0] is True        # half-open interval
    # bare & (alignment) outside an environment must be flagged ("Misplaced &")
    assert validate_latex(r"\( D(x)=x^3-3x & +2 \)")[0] is False
    assert validate_latex(r"\( \begin{vmatrix} a & b \\ c & d \end{vmatrix} \)")[0] is True
    assert validate_latex(r"a \& b")[0] is True                     # escaped ampersand is fine


def test_normalize_latex_collapses_double_escaping():
    from knowledge_pipeline.assessment.validation import normalize_latex
    # double-escaped delimiters/commands collapse to single so MathJax renders them
    assert normalize_latex(r"\\(\\frac{1}{2}\\)") == r"\(\frac{1}{2}\)"
    assert normalize_latex(r"\\[\\int_0^1 f(x)\\,dx\\]") == r"\[\int_0^1 f(x)\,dx\]"
    # already-correct single escaping is left untouched
    assert normalize_latex(r"\(x=-1\) is a max") == r"\(x=-1\) is a max"
    # genuine \\ line breaks (matrix rows) are preserved
    assert normalize_latex(r"\begin{cases} a & b \\ c & d \end{cases}") == r"\begin{cases} a & b \\ c & d \end{cases}"


def test_validate_latex_accepts_cross_subject_notation():
    assert validate_latex(
        r"\(5.0\times10^{-3}\,\mathrm{m}^2,\ \omega=100\,\mathrm{rad}\,\mathrm{s}^{-1}\)"
    )[0] is True
    assert validate_latex(
        r"\(\frac{L}{R}\ln 2+\sqrt{3}\)"
    )[0] is True
    assert validate_latex(
        r"\(\mathrm{H_2SO_4}+2\mathrm{NaOH}\rightarrow\mathrm{Na_2SO_4}+2\mathrm{H_2O}\)"
    )[0] is True
    assert validate_latex(
        r"\(\triangle ABC\cong\triangle ACD,\ AB=AC,\ PA=PB\)"
    )[0] is True


def test_validate_latex_rejects_malformed_cross_subject_notation():
    assert validate_latex(r"\(20,mathrmV\)")[0] is False
    assert validate_latex(r"\(dfracLRln2\)")[0] is False
    assert validate_latex(r"\(x^\)")[0] is False
    assert validate_latex(r"\(\unknown{x}\)")[0] is False


# --------------------------------------------------------------------- SVG
def test_validate_svg_wellformedness():
    good = render_svg(B.triangle_diagram((0, 0), (4, 0), (1, 3)))
    assert validate_svg(good)[0] is True
    assert validate_svg('<svg viewBox="0 0 1 1"></svg>')[0] is True
    assert validate_svg("<svg><rect></svg>")[0] is False            # not well-formed
    assert validate_svg("<svg></svg>")[0] is False                  # missing viewBox
    assert validate_svg("")[0] is True                              # empty allowed


# ------------------------------------------------------------------- answer
def test_verify_answer_symbolic():
    ran, ok, _ = verify_answer_symbolic(VerifySpec(kind="solve", expr="x**2 - 5*x + 6", var="x", expected="2,3"))
    assert ran and ok
    ran, ok, _ = verify_answer_symbolic(VerifySpec(kind="evaluate", expr="3*4", expected="12"))
    assert ran and ok
    ran, ok, _ = verify_answer_symbolic(VerifySpec(kind="evaluate", expr="3*4", expected="11"))
    assert ran and not ok
    ran, ok, _ = verify_answer_symbolic(None)
    assert (not ran) and ok
    # float-valued expressions must compare with tolerance, not exact structural zero
    ran, ok, _ = verify_answer_symbolic(
        VerifySpec(kind="equal", lhs="2*(1/(3**0.5))/(1+(1/(3**0.5))**2)", rhs="3**0.5/2")
    )
    assert ran and ok


# ---------------------------------------------------------------- generator
def _passing_payload():
    return {
        "metadata": {"grade": "Class 12", "topic": "Integrals", "subTopic": "Definite Integrals",
                     "difficulty": "jee_main", "bloomLevel": "Apply", "estimatedTime": "2 min",
                     "questionType": "FUNCTIONS"},
        "question": {
            "questionText": "Evaluate \\( \\int_{0}^{2} 3x^2\\,dx \\).",
            "equationLatex": "\\[ \\int_{0}^{2} 3x^2\\,dx \\]",
            "diagramRequired": True, "diagramType": "", "diagramSpec": {"type": "function", "expr": "3*x**2", "xmin": 0, "xmax": 2},
            "accessibilityAltText": "Curve y=3x^2, area shaded from 0 to 2.",
        },
        "options": [
            {"id": "A", "type": "text", "value": "\\( 8 \\)"},
            {"id": "B", "type": "text", "value": "\\( 6 \\)"},
            {"id": "C", "type": "text", "value": "\\( 12 \\)"},
            {"id": "D", "type": "text", "value": "\\( 4 \\)"},
        ],
        "answer": {"correctOptionId": "A", "value": "\\( 8 \\)",
                   "verify": {"kind": "evaluate", "expr": "2**3 - 0**3", "expected": "8"}},
        "explanation": [
            {"step": 1, "reasoning": "Antiderivative is \\( x^3 \\)."},
            {"step": 2, "reasoning": "Evaluate \\( [x^3]_0^2 = 8 \\)."},
        ],
    }


def _gen(payload):
    return AssessmentGenerator(_config(), StubRetriever(), StubLLM(json.dumps(payload)))


def test_generator_produces_passing_assessment_with_rendered_svg():
    a = _gen(_passing_payload()).generate("Integrals", difficulty="jee_main")
    assert a.validation.status == "PASSED"
    assert a.validation.qualityScore == 100
    assert a.validation.answerVerified and a.validation.svgValid and a.validation.equationValid
    # diagram spec was rendered to real SVG by the server (not left to the model)
    assert a.question.diagramSvg.startswith("<svg") and "viewBox" in a.question.diagramSvg
    assert a.question.diagramType == "function-plot"
    assert a.question.diagramSpec is not None
    assert a.question.diagramSpec["kind"] == "function-plot"
    assert len(a.options) == 4


def test_generator_flags_failed_when_answer_check_mismatches():
    payload = _passing_payload()
    payload["answer"]["verify"] = {"kind": "evaluate", "expr": "2**3", "expected": "9"}  # 8 != 9
    a = _gen(payload).generate("Integrals")
    assert a.validation.answerVerified is False
    assert a.validation.status == "FAILED"


def test_generator_handles_unparseable_llm_output():
    a = AssessmentGenerator(_config(), StubRetriever(), StubLLM("not json at all")).generate("Integrals")
    assert a.validation.status == "FAILED"
