"""RAG-backed quiz generation for the serving plane.

Every question is authored by the configured LLM, grounded in retrieved
NCERT passages/concepts. The model returns strict JSON; we validate it and
attach a deterministic SVG diagram from a small controlled vocabulary so the
figures stay correct regardless of what the model draws in prose. Math is
authored in LaTeX (rendered by MathJax in the player).
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple

from ..config import PipelineConfig
from ..diagram.catalog import diagram_prompt_guide
from ..diagram.dsl import DiagramSpec
from ..diagram.from_spec import build_diagram_from_spec
from ..quizschema.adapter import to_target_question
from .context import build_context

_JSON_MATH_SPAN_RE = re.compile(
    r"\\+[\(\[].*?\\+[\)\]]",
    re.DOTALL,
)


def extract_json(raw: str) -> Any:
    """Parse an LLM response as JSON, extracting JSON blocks and repairing formatting/LaTeX if needed."""
    text = (raw or "").strip()
    if not text:
        raise ValueError("Empty completion text received from LLM")
    if "```" in text:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1).strip()

    start_candidates = [i for i in (text.find("{"), text.find("[")) if i != -1]
    if not start_candidates:
        raise ValueError(f"No JSON start delimiter ('{{' or '[') found in LLM response: {text[:160]!r}")
    start = min(start_candidates)
    end = max(text.rfind("}"), text.rfind("]"))
    if end <= start:
        raise ValueError(f"No JSON end delimiter ('}}' or ']') found in LLM response: {text[:160]!r}")

    text = text[start : end + 1]

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    cleaned = re.sub(r",\s*([\}\]])", r"\1", text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    fixed = re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", cleaned)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM response is not valid JSON: {exc}") from exc


_DIAGRAM_GUIDE = diagram_prompt_guide("diagram")


_LEVEL_DESCRIPTIONS: dict[str, str] = {
    "very_easy": "Level 1: Very Easy (Recall / Remember) - Soliciting simple, straightforward answers based on obvious facts or awareness. Set bloom_level to 'Remember'.",
    "easy": "Level 2: Easy (Understand / Comprehend) - Requires a basic grasp of the meaning, letting learners explain ideas in their own words, simple sorting or identifying an example of a known concept. Set bloom_level to 'Understand'.",
    "moderate": "Level 3: Moderate (Apply / Intermediate) - Students use information in new situations, problem-solving, implementing methods, bridging simple facts and tasks. Set bloom_level to 'Apply'.",
    "difficult": "Level 4: Difficult (Analyze / Evaluate) - Students break down information into component parts for better understanding or form judgments, multi-step logic, comparing options. Set bloom_level to 'Analyze' or 'Evaluate'.",
    "very_difficult": "Level 5: Very Difficult (Create / Expert) - Reserved for deep synthesis, original problem-solving, or elite competition-level logic. Set bloom_level to 'Create'.",
}


class RagQuizGenerator:
    def __init__(self, config: PipelineConfig, retriever: Any, llm: Any) -> None:
        self.config = config
        self.retriever = retriever
        self.llm = llm

    # ------------------------------------------------------------------ retrieval
    def _retrieve(
        self,
        topic: str,
        query: str,
        retrieval_filter: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        try:
            hits = self.retriever.vector_search(
                query or topic, top_k=6, flt=retrieval_filter
            )
        except Exception:
            hits = []
        topic_filter = (
            retrieval_filter.get("topic")
            if retrieval_filter
            else None
        )
        if not hits and isinstance(topic_filter, (list, tuple, set)):
            seen_chunks: set[str] = set()
            for selected_topic in topic_filter:
                scalar_filter = dict(retrieval_filter or {})
                scalar_filter["topic"] = selected_topic
                try:
                    topic_hits = self.retriever.vector_search(
                        f"{selected_topic}: {query}".strip(": "),
                        top_k=1,
                        flt=scalar_filter,
                    )
                except Exception:
                    topic_hits = []
                for hit in topic_hits:
                    payload = hit.get("payload", {})
                    chunk_id = str(payload.get("chunk_id") or "")
                    if chunk_id and chunk_id in seen_chunks:
                        continue
                    if chunk_id:
                        seen_chunks.add(chunk_id)
                    hits.append(hit)
                if len(hits) >= 6:
                    break
        try:
            concepts = self.retriever.concepts_by_topic(topic, limit=6)
        except Exception:
            concepts = []
        return build_context(hits, concepts, [], max_chunks=6)

    def retrieve_context(
        self,
        topic: str,
        query: str = "",
        retrieval_filter: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self._retrieve(topic, query, retrieval_filter)

    # --------------------------------------------------------------------- prompt
    def build_prompt(
        self,
        topic: str,
        level: str,
        count: int,
        context: str,
        prefer_types: Optional[Sequence[str]] = None,
        diagram_only: bool = False,
        question_style: str = "standard",
        generation_profile: str = "standard",
        subject: Optional[str] = None,
        class_level: Optional[str] = None,
        repair_instructions: Optional[Sequence[str]] = None,
    ) -> str:
        prefer_txt = (
            ", ".join(prefer_types)
            if prefer_types
            else "any valid controlled diagram type (e.g. triangle-geometry, circle-geometry, function)"
        )
        ctx = context.strip() or "(no retrieved context; use standard NCERT-aligned knowledge)"
        level_desc = _LEVEL_DESCRIPTIONS.get(level, level)
        class_str = f" for {class_level}" if class_level else ""
        
        style_instructions = {
            "olympiad": (
                "QUESTION STYLE: OLYMPIAD / COMPETITIVE (IMO/CMO/SOF Style)\n"
                "- Write competitive Olympiad-style questions (IMO/CMO/SOF).\n"
                "- Emphasize logical reasoning, multi-step problem solving, and analytical thinking.\n"
                "- Base the problem logic directly on concepts in the reference material."
            ),
            "jee": (
                "QUESTION STYLE: JEE MAIN / ADVANCED\n"
                "- Emphasize deep conceptual application, multi-step mathematical derivations, and high analytical rigor.\n"
                "- Require exact calculation, multi-concept synthesis, or critical edge cases."
            ),
            "school_exam": (
                "QUESTION STYLE: SCHOOL / BOARD EXAM (NCERT Standard)\n"
                "- Strictly align with standard textbook exercise problems and curriculum syllabus guidelines.\n"
                "- Use clear, direct, student-friendly phrasing suitable for classroom assessment."
            ),
            "conceptual": (
                "QUESTION STYLE: CONCEPTUAL / DIAGNOSTIC\n"
                "- Focus on understanding core principles, identifying common misconceptions, and fundamental reasoning.\n"
                "- Options should target common student missteps or conceptual errors."
            ),
            "standard": (
                "QUESTION STYLE: BALANCED STANDARD\n"
                "- Provide a well-balanced multiple-choice question testing understanding and application."
            ),
        }.get(question_style, "QUESTION STYLE: BALANCED STANDARD")
        diagram_rule = (
            "DIAGRAM-ONLY OUTPUT MODE:\n"
            "- Select only concepts where a figure materially improves the reasoning.\n"
            "- Every returned question must include a valid controlled diagram object.\n"
            "- Never attach a decorative or unrelated figure. If a candidate question "
            "does not genuinely benefit from a diagram, omit that candidate and write "
            "a different, naturally visual question."
            if diagram_only
            else (
                "AUTO DIAGRAM MODE:\n"
                "- Include a controlled diagram only when it materially improves reasoning.\n"
                "- Use null when a diagram is unnecessary; never add decorative figures."
            )
        )
        example = (
            '{"questions":[{"stem":"Evaluate \\\\( \\\\int_{0}^{2} 3x^2\\\\,dx \\\\).",'
            '"options":[{"text":"\\\\( 8 \\\\)","is_correct":true,"rationale":"x^3 from 0 to 2"},'
            '{"text":"\\\\( 6 \\\\)","is_correct":false,"rationale":""},'
            '{"text":"\\\\( 12 \\\\)","is_correct":false,"rationale":""},'
            '{"text":"\\\\( 4 \\\\)","is_correct":false,"rationale":""}],'
            '"explanation":"\\\\( \\\\int_0^2 3x^2 dx = [x^3]_0^2 = 8 \\\\).",'
            '"bloom_level":"Apply","diagram":{"type":"function","expr":"3*x**2","xmin":0,"xmax":2}}]}'
        )
        subject_name = subject or "STEM"
        repair_rule = (
            "\nREPAIR REQUIREMENTS FROM THE PREVIOUS ATTEMPT:\n- "
            + "\n- ".join(repair_instructions)
            if repair_instructions
            else ""
        )
        profile_rule = (
            """
JEE COMPLEX GEOMETRY PROFILE:
- Every question must require the diagram to solve, not merely illustrate the stem.
- Require at least three linked reasoning steps and at least two geometric relations,
  such as similarity plus cyclicity, tangent-secant power, a cevian ratio, projection,
  or a non-obvious auxiliary construction.
- Prefer Bloom levels Analyze or Evaluate. Avoid direct theorem recall and one-step
  substitution.
- Use a detailed triangle-geometry, circle-geometry, or solid-geometry object with at
  least three labeled points and all lines, circles, hidden edges, and relation marks
  needed by the stem.
- Coordinates are rendering coordinates only. Do not mention them in the question.
- Every label and supplied value in the diagram must agree exactly with the stem.
"""
            if generation_profile == "jee_geometry_complex"
            else ""
        )
        return f"""You are an expert {subject_name} item writer for Indian NCERT curriculum{class_str}.
Write {count} high-quality multiple-choice questions on the topic: "{topic}".
Target Grade/Class Level: {class_level or 'NCERT standard'}
Difficulty Requirement: {level_desc}

{style_instructions}

REFERENCE MATERIAL (STRICTLY MODEL QUESTION FORMAT AND RIGOR ON THIS DATA):
{ctx}

STRICT OUTPUT RULES:
1. Output ONLY a JSON object: {{"questions":[ ... ]}} with exactly {count} items.
2. Each question object has: "stem", "options" (exactly 4), "explanation", "bloom_level", "diagram".
3. Each option: {{"text": ..., "is_correct": true|false, "rationale": short}}.
   Exactly ONE option is correct.
4. The entire response MUST pass a strict JSON parser without repair.
   Every backslash inside every JSON string MUST be escaped as a double backslash.
   Write ALL mathematical, physical, and chemical notation in LaTeX wrapped in
   \\\\( ... \\\\) for inline (or \\\\[ ... \\\\] for display).
   Write JSON-escaped commands such as \\\\int, \\\\frac, \\\\sqrt, \\\\theta,
   \\\\begin, \\\\end, \\\\times, \\\\vec, and \\\\sin.
   For example,
   write \\\\mathrm{{m}}, \\\\mu\\\\mathrm{{F}}, \\\\Omega, \\\\omega,
   \\\\mathrm{{rad}}\\\\,\\\\mathrm{{s}}^{{-1}}, and \\\\frac{{L}}{{R}}.
   Write chemical formulae with roman groups, for example \\\\mathrm{{H_2SO_4}},
   \\\\mathrm{{Na^+}}, and \\\\mathrm{{SO_4^{{2-}}}}.
   Never emit a raw single JSON backslash. Never emit command names without
   backslashes (wrong: mathrm, dfrac, sqrt, omega, Omega).
   Never place unescaped prose or multi-letter names inside math; use \\\\text{{...}}
   or \\\\mathrm{{...}}.
   Use SI symbols, not unit words: \\\\mathrm{{A}} instead of amperes and
   \\\\mathrm{{rad}} instead of radians.
   Never use bare < or > outside LaTeX. Keep option text concise.
5. Before returning JSON, verify every ^ has an argument and every command has balanced braces.
6. Prefer diagram type(s): {prefer_txt}. Use a figure only when it genuinely aids the question.
7. The subject is {subject_name}. Keep question subject, formulae, terminology, and
   diagram family aligned with that subject.

STATIC DIAGRAM SELECTION:
- Output only controlled static diagram JSON, never animation, raw SVG, TikZ, or image URLs.
- Physics circuits must use lr-circuit, transformer-circuit, or coupled-coils,
  never geometry, mensuration, or angle-only figures.
- Transformer diagrams must omit R-L loads unless the question explicitly
  supplies or asks about a load; voltage-ratio questions show only source,
  windings, core, turns, and primary/secondary voltages.
- Magnetic-flux questions must use magnetic-flux with the loop, area, B vector,
  normal n, and angle. An angle-only diagram is invalid.
- Physics plots must use current-time or function with physical axis labels and units,
  never generic x/y axes.
- Mechanics must use inclined-plane; refraction must use refraction.
- Mathematics may use function, function-region, coordinate, geometry,
  triangle-geometry, circle-geometry, solid-geometry, or chart families.
- Chemistry reactions may use chemical-reaction. Preserve formula subscripts and charges.
- Copy only quantities supplied by the question; never invent diagram values or labels.

{diagram_rule}
{profile_rule}
{repair_rule}

{_DIAGRAM_GUIDE}

EXAMPLE (format only):
{example}
"""

    # -------------------------------------------------------------------- diagram
    def _diagram(self, spec: Any) -> Optional[DiagramSpec]:
        return build_diagram_from_spec(spec)

    # ----------------------------------------------------------------- item build
    def _to_item(
        self, q: Dict[str, Any], topic: str, level: str, concept_ids: Sequence[str]
    ) -> Optional[Dict[str, Any]]:
        stem = str(q.get("stem", "")).strip()
        options: List[Dict[str, Any]] = []
        for o in q.get("options") or []:
            text = str(o.get("text", "")).strip()
            if not text:
                continue
            options.append({"label": text, "is_correct": bool(o.get("is_correct")), "rationale": o.get("rationale")})
        if not stem or len(options) < 2:
            return None
        if sum(1 for o in options if o["is_correct"]) == 0:
            return None
        return {
            "stem": stem,
            "options": options,
            "explanation": q.get("explanation"),
            "level_band": level,
            "bloom_level": q.get("bloom_level"),
            "topic": topic,
            "source": f"rag:{topic}",
            "concept_ids": list(concept_ids or []),
            "question_diagram": self._diagram(q.get("diagram")),
        }

    _prompt = build_prompt

    # -------------------------------------------------------------------- generate
    def generate_topic(
        self,
        topic: str,
        query: str = "",
        level: str = "jee_main",
        count: int = 3,
        prefer_diagrams: Sequence[str] = (),
        diagram_only: bool = False,
        subject: Optional[str] = None,
        class_level: Optional[str] = None,
        question_style: str = "standard",
        generation_profile: str = "standard",
        repair_instructions: Sequence[str] = (),
        concept_ids: Optional[Sequence[str]] = None,
        retrieval_filter: Optional[Dict[str, Any]] = None,
        require_context: bool = False,
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        ctx = context or self._retrieve(
            topic,
            query,
            retrieval_filter=retrieval_filter,
        )
        if require_context and not ctx.get("source_chunk_ids"):
            return [], ctx
        prompt = self.build_prompt(
            topic,
            level,
            count,
            ctx["text"],
            prefer_diagrams,
            diagram_only=diagram_only,
            question_style=question_style,
            subject=subject,
            class_level=class_level,
            generation_profile=generation_profile,
            repair_instructions=repair_instructions,
        )
        raw = self.llm.complete(prompt)
        data = extract_json(raw)
        raw_qs = data.get("questions") if isinstance(data, dict) else data
        if not isinstance(raw_qs, list):
            raw_qs = []
        cids = list(concept_ids or ctx.get("concept_ids") or [])
        items: List[Dict[str, Any]] = []
        for q in raw_qs:
            if not isinstance(q, dict):
                continue
            item = self._to_item(q, topic, level, cids)
            if item:
                item["source_chunk_ids"] = list(ctx.get("source_chunk_ids") or [])
                item["source_pages"] = list(ctx.get("source_pages") or [])
                run_ids = list(ctx.get("source_run_ids") or [])
                book_ids = list(ctx.get("source_book_ids") or [])
                item["source_run_id"] = run_ids[0] if len(run_ids) == 1 else None
                item["source_book_id"] = book_ids[0] if len(book_ids) == 1 else None
                items.append(item)
            if len(items) >= count:
                break
        return items, ctx

    def adapt_items(
        self,
        items: Sequence[Dict[str, Any]],
        quiz_id: Optional[str],
        quiz_title: str,
        created_at: Optional[str],
        start_order: int = 1,
    ) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        order = start_order
        for item in items:
            try:
                tq = to_target_question(
                    item,
                    identity=self.config.identity,
                    quiz_id=quiz_id,
                    quiz_title=quiz_title,
                    created_at=created_at,
                    sort_order=order,
                )
            except Exception:
                continue
            out.append(tq.wrapped())
            order += 1
        return out
