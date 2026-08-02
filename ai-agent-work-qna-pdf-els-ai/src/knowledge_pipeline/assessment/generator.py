"""RAG-grounded assessment generator producing the rich validated contract."""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

from ..config import PipelineConfig
from ..diagram.catalog import diagram_prompt_guide
from ..diagram.from_spec import build_diagram_from_spec
from ..rendering.svg import render_svg
from ..serving.context import build_context
from ..serving.rag_quiz import extract_json
from .schema import (
    Assessment,
    AssessmentMetadata,
    AssessmentOption,
    AnswerObject,
    ExplanationStep,
    QuestionObject,
    VerifySpec,
)
from .validation import normalize_assessment, run_validation

_DIAGRAM_GUIDE = diagram_prompt_guide("question.diagramSpec")


class AssessmentGenerator:
    def __init__(self, config: PipelineConfig, retriever: Any, llm: Any) -> None:
        self.config = config
        self.retriever = retriever
        self.llm = llm

    # ------------------------------------------------------------------ retrieval
    def _retrieve(self, topic: str, query: str) -> Dict[str, Any]:
        try:
            hits = self.retriever.vector_search(query or topic, top_k=6)
        except Exception:
            hits = []
        try:
            concepts = self.retriever.concepts_by_topic(topic, limit=6)
        except Exception:
            concepts = []
        return build_context(hits, concepts, [], max_chunks=6)

    # --------------------------------------------------------------------- prompt
    def _prompt(
        self, topic: str, subtopic: str, grade: str, difficulty: str,
        question_type: str, context: str, prefer: Sequence[str],
        require_diagram: bool = False,
    ) -> str:
        ctx = context.strip() or "(no retrieved context; use standard NCERT-aligned knowledge)"
        prefer_txt = ", ".join(prefer) if prefer else "the most appropriate type or null"
        diagram_rule = (
            f"3. You MUST include a figure: set diagramRequired=true and provide a valid "
            f"question.diagramSpec (use type: {prefer_txt}) plus a concise accessibilityAltText. "
            f"The figure must be pedagogically essential to the question."
            if require_diagram else
            f"3. If a figure genuinely helps, set diagramRequired=true and provide question.diagramSpec\n"
            f"   (preferred type(s): {prefer_txt}) plus a concise accessibilityAltText describing it.\n"
            f"   If no figure is needed, set diagramRequired=false and diagramSpec=null."
        )
        return f"""You are an Expert Mathematics Assessment Generation Agent for Indian NCERT {grade}.
Create ONE high-quality, exam-quality, teacher-review-quality multiple-choice question.

TOPIC: {topic}
SUB-TOPIC: {subtopic or topic}
DIFFICULTY: {difficulty}
QUESTION TYPE: {question_type or "choose an appropriate type"}

Ground the question in this reference material when relevant:
{ctx}

Return ONLY a valid JSON object with EXACTLY this shape (no markdown, no commentary):
{{
  "metadata": {{"grade":"{grade}","topic":"{topic}","subTopic":"{subtopic or topic}","difficulty":"{difficulty}","bloomLevel":"","estimatedTime":"","questionType":"{question_type}"}},
  "question": {{"questionText":"","equationLatex":"","diagramRequired":true,"diagramType":"","diagramSpec":null,"accessibilityAltText":""}},
  "options": [
    {{"id":"A","type":"text","value":""}},
    {{"id":"B","type":"text","value":""}},
    {{"id":"C","type":"text","value":""}},
    {{"id":"D","type":"text","value":""}}
  ],
  "answer": {{"correctOptionId":"A","value":"","verify":{{"kind":"none"}}}},
  "explanation": [{{"step":1,"reasoning":""}},{{"step":2,"reasoning":""}}]
}}

STRICT RULES:
1. EXACTLY 4 options with unique ids A-D and exactly ONE correct (set answer.correctOptionId).
2. Write ALL mathematics in LaTeX wrapped in \\( ... \\) (inline) or \\[ ... \\] (display).
   Use \\int, \\frac, \\sqrt, \\pi, \\le, \\ge, \\times, \\cdot, \\sin, \\cos, ^\\circ, etc.
   Never use bare < or > outside LaTeX, and never x**2 / sqrt(x) style in the QUESTION text.
{diagram_rule}
4. answer.value is the correct option's value in LaTeX. When the answer is computational,
   include a machine-checkable "verify":
     - solve:    {{"kind":"solve","expr":"x**2 - 5*x + 6","var":"x","expected":"2,3"}}
     - evaluate: {{"kind":"evaluate","expr":"3*2**2","expected":"12"}}
     - equal:    {{"kind":"equal","lhs":"...","rhs":"..."}}
   (expr/lhs/rhs use PYTHON syntax). For pure geometry/graph questions use {{"kind":"none"}}.
5. explanation is an ordered list of >= 2 teaching steps, each {{"step":n,"reasoning":"..."}} with LaTeX.

{_DIAGRAM_GUIDE}
"""

    # ------------------------------------------------------------------- assemble
    def _assemble(self, data: Dict[str, Any], topic: str, subtopic: str, grade: str, difficulty: str) -> Assessment:
        meta_in = data.get("metadata") or {}
        q_in = data.get("question") or {}
        metadata = AssessmentMetadata(
            grade=str(meta_in.get("grade") or grade),
            topic=str(meta_in.get("topic") or topic),
            subTopic=str(meta_in.get("subTopic") or subtopic or topic),
            difficulty=str(meta_in.get("difficulty") or difficulty),
            bloomLevel=str(meta_in.get("bloomLevel") or ""),
            estimatedTime=str(meta_in.get("estimatedTime") or ""),
            questionType=str(meta_in.get("questionType") or ""),
        )

        diagram_spec = q_in.get("diagramSpec") or q_in.get("diagram")
        built = build_diagram_from_spec(diagram_spec) if diagram_spec else None
        diagram_type = str(q_in.get("diagramType") or "")
        diagram_required = bool(q_in.get("diagramRequired"))
        diagram_svg = ""
        if built is not None:
            diagram_svg = render_svg(built)
            diagram_type = diagram_type or built.kind
            diagram_required = True

        question = QuestionObject(
            questionText=str(q_in.get("questionText") or ""),
            equationLatex=str(q_in.get("equationLatex") or ""),
            diagramRequired=diagram_required,
            diagramType=diagram_type,
            diagramSvg=diagram_svg,
            diagramSpec=(built.model_dump(mode="json") if built is not None else None),
            accessibilityAltText=str(q_in.get("accessibilityAltText") or ""),
        )

        options: List[AssessmentOption] = []
        for i, o in enumerate(data.get("options") or []):
            options.append(AssessmentOption(
                id=str(o.get("id") or chr(65 + i)),
                type=str(o.get("type") or "text"),
                value=str(o.get("value") or ""),
            ))

        ans_in = data.get("answer") or {}
        v_in = ans_in.get("verify") or {}
        verify = None
        if v_in and str(v_in.get("kind") or "none") != "none":
            verify = VerifySpec(
                kind=str(v_in.get("kind") or "none"),
                expr=v_in.get("expr"),
                var=v_in.get("var") or "x",
                lhs=v_in.get("lhs"),
                rhs=v_in.get("rhs"),
                expected=(str(v_in.get("expected")) if v_in.get("expected") is not None else None),
            )
        answer = AnswerObject(
            correctOptionId=str(ans_in.get("correctOptionId") or ""),
            value=str(ans_in.get("value") or ""),
            verify=verify,
        )

        explanation: List[ExplanationStep] = []
        for i, s in enumerate(data.get("explanation") or []):
            if not isinstance(s, dict):
                continue
            explanation.append(ExplanationStep(
                step=int(s.get("step") or (i + 1)),
                reasoning=str(s.get("reasoning") or ""),
                svg=(s.get("svg") if isinstance(s.get("svg"), str) else None),
            ))

        a = Assessment(metadata=metadata, question=question, options=options, answer=answer, explanation=explanation)
        normalize_assessment(a)
        a.validation = run_validation(a)
        return a

    # ------------------------------------------------------------------- generate
    def generate(
        self,
        topic: str,
        subtopic: str = "",
        grade: str = "Class 12",
        difficulty: str = "jee_main",
        question_type: str = "",
        query: str = "",
        prefer_diagrams: Sequence[str] = (),
        require_diagram: bool = False,
    ) -> Assessment:
        ctx = self._retrieve(topic, query)
        attempts = 2 if require_diagram else 1
        last: Optional[Assessment] = None
        for _ in range(attempts):
            prompt = self._prompt(topic, subtopic, grade, difficulty, question_type,
                                  ctx["text"], prefer_diagrams, require_diagram)
            raw = self.llm.complete(prompt)
            try:
                data = extract_json(raw)
            except Exception as exc:
                a = Assessment(metadata=AssessmentMetadata(grade=grade, topic=topic, difficulty=difficulty))
                a.validation.issues.append(f"JSON parse failed: {exc}")
                a.validation.status = "FAILED"
                last = a
                continue
            if not isinstance(data, dict):
                data = {}
            a = self._assemble(data, topic, subtopic, grade, difficulty)
            last = a
            has_diagram = bool(a.question.diagramSvg and a.question.diagramSvg.strip())
            if a.validation.status == "PASSED" and (has_diagram or not require_diagram):
                return a
        return last
