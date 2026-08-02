"""Validation layer for assessments: LaTeX balance, SVG well-formedness,
SymPy answer verification, and a heuristic quality score."""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from functools import lru_cache
from typing import List, Tuple

from .schema import Assessment, ValidationReport, VerifySpec

_PASS_THRESHOLD = 70
_MATH_SPAN_RE = re.compile(r"(\\\(.*?\\\)|\\\[.*?\\\])", re.DOTALL)


@lru_cache(maxsize=1)
def _known_latex_commands() -> set[str]:
    from latex2mathml import commands, symbols_parser

    known = set(symbols_parser.SYMBOLS)
    for value in vars(commands).values():
        if isinstance(value, dict):
            entries = [*value.keys(), *value.values()]
        elif isinstance(value, (set, tuple, list)):
            entries = list(value)
        elif isinstance(value, str):
            entries = [value]
        else:
            continue
        known.update(
            entry.rstrip("*")
            for entry in entries
            if isinstance(entry, str) and entry.startswith("\\")
        )
    return known


def _validate_math_span(span: str) -> list[str]:
    from latex2mathml.converter import convert

    content = span[2:-2].strip()
    issues: list[str] = []
    try:
        convert(content)
    except Exception as exc:
        issues.append(f"LaTeX parse error: {type(exc).__name__}")

    commands = set(re.findall(r"\\[A-Za-z]+", content))
    unknown = sorted(command for command in commands if command not in _known_latex_commands())
    if unknown:
        issues.append(f"unknown LaTeX command(s): {', '.join(unknown)}")

    prose_free = re.sub(
        r"\\(?:begin|end|text|textrm|textsf|texttt|mathrm|mathbf|mathit|"
        r"mathsf|mathtt|operatorname)\*?\s*\{[^{}]*\}",
        "",
        content,
    )
    prose_free = re.sub(r"\\[A-Za-z]+", "", prose_free)
    bare_words = re.findall(r"[A-Za-z]{2,}", prose_free)
    known_names = {
        command[1:]
        for command in _known_latex_commands()
        if command[1:].isalpha() and len(command) > 2
    }
    malformed_words = [
        word
        for word in bare_words
        if not word.isupper() and (len(word) >= 3 or word in known_names)
    ]
    if malformed_words:
        issues.append(
            "multi-letter text in math must use a LaTeX command or text/roman group"
        )
    return issues


# --------------------------------------------------------------- normalization
def normalize_latex(text: str) -> str:
    """Collapse double-escaped LaTeX (\\\\( \\\\[ \\\\frac ...) back to single
    backslashes so MathJax renders it instead of showing raw source.

    A correctly single-escaped string is untouched (its delimiters/commands have
    only one backslash). Genuine ``\\\\`` line breaks (followed by whitespace, ``&``
    or ``*``) are preserved because only ``\\\\`` immediately before a letter or a
    math delimiter is collapsed.
    """
    if not text:
        return text
    for a, b in (("\\\\(", "\\("), ("\\\\)", "\\)"), ("\\\\[", "\\["), ("\\\\]", "\\]")):
        text = text.replace(a, b)
    # collapse \\ before a letter or a LaTeX special/spacing token (\\frac, \\,, \\{ ...),
    # but keep genuine \\ line breaks (which are followed by whitespace, & or *).
    text = re.sub(r"\\\\(?=[A-Za-z,;:!{}|%#$_])", r"\\", text)
    return text


def normalize_assessment(a: Assessment) -> Assessment:
    """Normalize LaTeX in every math-bearing field of an assessment, in place."""
    q = a.question
    q.questionText = normalize_latex(q.questionText)
    q.equationLatex = normalize_latex(q.equationLatex)
    q.accessibilityAltText = normalize_latex(q.accessibilityAltText)
    for o in a.options:
        if o.type != "svg":
            o.value = normalize_latex(o.value)
    a.answer.value = normalize_latex(a.answer.value)
    for s in a.explanation:
        s.reasoning = normalize_latex(s.reasoning)
    return a


# --------------------------------------------------------------------- LaTeX
def validate_latex(text: str) -> Tuple[bool, List[str]]:
    """Check bracket/delimiter balance for a LaTeX-bearing string."""
    if not text:
        return True, []
    issues: List[str] = []
    brace_depth = 0
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch == "\\":
            i += 2  # skip escaped char (\{ \} \( \) \[ \] \\ etc.)
            continue
        if ch == "{":
            brace_depth += 1
        elif ch == "}":
            if brace_depth == 0:
                issues.append("unbalanced '}'")
                return False, issues
            brace_depth -= 1
        i += 1
    if brace_depth:
        issues.append("unclosed brace(s)")
    # LaTeX math delimiters
    if text.count("\\(") != text.count("\\)"):
        issues.append("unbalanced \\( \\) delimiters")
    if text.count("\\[") != text.count("\\]"):
        issues.append("unbalanced \\[ \\] delimiters")
    # \left / \right must pair, but exclude \leftarrow, \rightarrow, \leftrightarrow, etc.
    n_left = len(re.findall(r"\\left(?![a-zA-Z])", text))
    n_right = len(re.findall(r"\\right(?![a-zA-Z])", text))
    if n_left != n_right:
        issues.append("unbalanced \\left \\right")
    if text.count("$") % 2 != 0:
        issues.append("odd number of $ delimiters")
    for span in _MATH_SPAN_RE.findall(text):
        issues.extend(_validate_math_span(span))
    # a bare & (alignment char) only renders inside a matrix/cases/array/aligned env;
    # otherwise MathJax raises "Misplaced &".
    if re.search(r"(?<!\\)&", text) and not re.search(
        r"\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix|array|cases|aligned|align|alignat|split|eqnarray)\*?\}",
        text,
    ):
        issues.append("misplaced & (alignment char outside matrix/cases/array environment)")
    return (len(issues) == 0), issues


# ----------------------------------------------------------------------- SVG
def validate_svg(svg: str) -> Tuple[bool, List[str]]:
    """Empty SVG is acceptable; a present SVG must be well-formed XML rooted at
    <svg> with a viewBox."""
    if not svg or not svg.strip():
        return True, []
    try:
        root = ET.fromstring(svg)
    except ET.ParseError as exc:
        return False, [f"SVG not well-formed XML: {exc}"]
    tag = root.tag.split("}")[-1]
    if tag != "svg":
        return False, ["SVG root element is not <svg>"]
    if "viewBox" not in root.attrib:
        return False, ["SVG missing viewBox"]
    return True, []


# -------------------------------------------------------------------- answer
def _numbers(text: str):
    import sympy

    out = []
    for part in re.split(r"[,\s]+", (text or "").strip()):
        if not part:
            continue
        try:
            out.append(sympy.nsimplify(sympy.sympify(part)))
        except Exception:
            try:
                out.append(sympy.sympify(part))
            except Exception:
                return None
    return out


def _equal(a_expr, b_expr, tol: float = 1e-6) -> bool:
    """Exact-then-numeric equality, tolerant of float-valued expressions."""
    import sympy

    a, b = sympy.sympify(a_expr), sympy.sympify(b_expr)
    diff = sympy.simplify(a - b)
    if diff == 0:
        return True
    try:
        return abs(complex(diff.evalf())) < tol
    except Exception:
        return False


def verify_answer_symbolic(verify: VerifySpec) -> Tuple[bool, bool, List[str]]:
    """Return (ran, passed, issues). ran=False when no symbolic check applies.

    Comparisons are exact where possible and fall back to a numeric tolerance so
    float-valued verify expressions (e.g. 3**0.5) are not spuriously rejected.
    """
    if verify is None or (verify.kind or "none") == "none":
        return False, True, []
    import sympy

    try:
        if verify.kind == "solve":
            var = sympy.Symbol(verify.var or "x")
            roots = sympy.solve(sympy.sympify(verify.expr), var)
            exp = _numbers(verify.expected)
            if exp is None:
                return True, False, ["could not parse expected roots"]
            got_f = sorted(complex(sympy.sympify(r).evalf()).real for r in roots)
            exp_f = sorted(complex(sympy.sympify(e).evalf()).real for e in exp)
            ok = len(got_f) == len(exp_f) and all(abs(a - b) < 1e-6 for a, b in zip(got_f, exp_f))
            return True, ok, ([] if ok else [f"solve mismatch: {roots} != {exp}"])
        if verify.kind == "evaluate":
            exp = _numbers(verify.expected)
            if exp is None or len(exp) != 1:
                return True, False, ["could not parse expected value"]
            ok = _equal(verify.expr, exp[0])
            return True, ok, ([] if ok else [f"evaluate mismatch: {verify.expr} != {verify.expected}"])
        if verify.kind == "equal":
            ok = _equal(verify.lhs, verify.rhs)
            return True, ok, ([] if ok else ["equal check failed: lhs != rhs"])
    except Exception as exc:
        return True, False, [f"symbolic verification error: {exc}"]
    return False, True, []


# -------------------------------------------------------------------- report
def run_validation(a: Assessment) -> ValidationReport:
    issues: List[str] = []

    # --- structural question validity ---
    ids = [o.id for o in a.options]
    unique_ids = len(ids) == len(set(ids))
    correct_in = a.answer.correctOptionId in ids
    values = [o.value.strip() for o in a.options]
    unique_values = len(values) == len(set(values))
    question_valid = bool(a.question.questionText.strip()) and len(a.options) >= 2 and unique_ids and correct_in
    if not a.question.questionText.strip():
        issues.append("empty questionText")
    if len(a.options) < 2:
        issues.append("fewer than 2 options")
    if not unique_ids:
        issues.append("option ids not unique")
    if not correct_in:
        issues.append("correctOptionId not among options")
    if not unique_values:
        issues.append("duplicate option values")

    # --- LaTeX validity across all math-bearing fields ---
    latex_fields = [a.question.questionText, a.question.equationLatex, a.answer.value]
    latex_fields += [o.value for o in a.options if o.type != "svg"]
    latex_fields += [s.reasoning for s in a.explanation]
    equation_valid = True
    for fld in latex_fields:
        ok, iss = validate_latex(fld)
        if not ok:
            equation_valid = False
            issues.extend(iss)

    # --- SVG validity across all svg-bearing fields ---
    svg_fields = [a.question.diagramSvg]
    svg_fields += [o.value for o in a.options if o.type == "svg"]
    svg_fields += [s.svg or "" for s in a.explanation]
    svg_valid = True
    for svg in svg_fields:
        ok, iss = validate_svg(svg)
        if not ok:
            svg_valid = False
            issues.extend(iss)

    # --- diagram consistency ---
    has_svg = bool(a.question.diagramSvg and a.question.diagramSvg.strip())
    if a.question.diagramRequired:
        diagram_verified = has_svg and svg_valid
        if not has_svg:
            issues.append("diagramRequired but diagramSvg is empty")
        if has_svg and not a.question.accessibilityAltText.strip():
            issues.append("missing accessibilityAltText for a required diagram")
    else:
        diagram_verified = True

    # --- answer verification (structural + symbolic where feasible) ---
    ran, passed, aiss = verify_answer_symbolic(a.answer.verify)
    issues.extend(aiss)
    answer_verified = question_valid and (passed if ran else True)

    # --- quality score ---
    score = 100
    if not a.question.questionText.strip():
        score -= 30
    if len(a.options) != 4:
        score -= 10
    if not unique_values:
        score -= 15
    if not equation_valid:
        score -= 15
    if a.question.diagramRequired and not (has_svg and svg_valid):
        score -= 20
    if a.question.diagramRequired and has_svg and not a.question.accessibilityAltText.strip():
        score -= 8
    if len(a.explanation) < 2:
        score -= 10
        issues.append("explanation has fewer than 2 steps")
    if not answer_verified:
        score -= 20
    score = max(0, min(100, score))

    status_ok = (
        question_valid and equation_valid and svg_valid and answer_verified and diagram_verified
        and score >= _PASS_THRESHOLD
    )
    return ValidationReport(
        questionValid=question_valid,
        equationValid=equation_valid,
        svgValid=svg_valid,
        answerVerified=answer_verified,
        diagramVerified=diagram_verified,
        qualityScore=score,
        status="PASSED" if status_ok else "FAILED",
        issues=issues,
    )
