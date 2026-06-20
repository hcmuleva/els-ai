"""Prompt builders for the external LLM provider and the LLM critic.

Both emit OpenAI-style ``messages`` lists. Generation prompts carry the
difficulty rubric and optional exemplars from the source paper. Critic prompts
hide the marked answer so the model must solve the question independently.
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING, Dict, List

from app.generation.difficulty import rubric_for

if TYPE_CHECKING:  # avoid importing the providers package at module load (circular)
    from app.providers.base import GenerationContext, RawQuestion

_GEN_SYSTEM = (
    "You are a CBSE examination question author. Write questions in BOOK FORMAT "
    "markdown: inline math as $...$ and display math as $$...$$ so a markdown + "
    "KaTeX renderer shows textbook-style formulas. Explanations must be in a "
    "teacher voice: state what is given, the idea, then numbered steps, then the "
    "final answer. Return STRICT JSON only, no prose outside the JSON."
)

_OUTPUT_CONTRACT = (
    'Return JSON of the form: {"questions":[{'
    '"type":"single_choice|multi_choice|true_false",'
    '"difficulty":"easy|medium|hard","topic":"...","title_md":"...",'
    '"instruction":"...","options":[{"label_md":"...","is_correct":true}],'
    '"explanation_md":"...","source_style_ref":"...",'
    '"verification":{"kind":"numeric|symbolic_derivative|symbolic_integral_def|roots",'
    '"expression":"sympy-evaluable string (numeric)","func":"a*x**n (derivative)",'
    '"integrand":"x","lower":0,"upper":3,"poly":"x**2 - 5*x + 6 (roots)",'
    '"expected":"number or list of numbers","tokens":["substrings that must appear in the correct option label"]}'
    "}]}. "
    "Include the optional 'verification' object ONLY for questions whose answer is "
    "computable (numeric/algebra/calculus); omit it for purely conceptual questions."
)


def _exemplars_block(exemplars: List[str]) -> str:
    picked = [e.strip() for e in exemplars if e and e.strip()][:5]
    if not picked:
        return "No exemplars available; infer style from the syllabus."
    lines = "\n".join(f"- {e[:200]}" for e in picked)
    return "Style exemplars from the source paper:\n" + lines


def build_generation_messages(ctx: GenerationContext, exemplars: List[str]) -> List[Dict[str, str]]:
    types = ", ".join(t.value for t in ctx.allowed_types)
    rubric = rubric_for(ctx.class_level, ctx.difficulty)
    user = (
        f"Generate {ctx.count} Class {ctx.class_level} {ctx.subject} questions.\n"
        f"Allowed types: {types}.\n"
        f"Topic hint: {ctx.topic or 'infer from the source paper'}.\n\n"
        f"{rubric}\n\n"
        f"{_exemplars_block(exemplars)}\n\n"
        f"{_OUTPUT_CONTRACT}"
    )
    return [
        {"role": "system", "content": _GEN_SYSTEM},
        {"role": "user", "content": user},
    ]


_CRITIC_SYSTEM = (
    "You are a meticulous CBSE answer-checker. You are given a question and its "
    "options WITHOUT being told which is correct. Solve it yourself, decide which "
    "option number(s) are correct, judge the difficulty, and flag ambiguity. "
    "Return STRICT JSON only."
)


def build_critic_messages(raw: RawQuestion) -> List[Dict[str, str]]:
    options = raw.get("options", [])
    enumerated = "\n".join(
        f"{idx}. {str(o.get('label_md', ''))}" for idx, o in enumerate(options, start=1)
    )
    qtype = raw.get("type")
    qtype = getattr(qtype, "value", str(qtype))
    user = (
        f"Question type: {qtype}\n"
        f"Stem:\n{str(raw.get('title_md', ''))}\n\n"
        f"Options:\n{enumerated}\n\n"
        "Decide the correct option number(s). "
        'Return JSON: {"correct_options":[1],"difficulty":"easy|medium|hard",'
        '"ambiguous":false,"reason":"short justification"}. '
        "For single_choice exactly one number; for true_false one number; "
        "for multi_choice one or more."
    )
    return [
        {"role": "system", "content": _CRITIC_SYSTEM},
        {"role": "user", "content": user},
    ]


def safe_json_loads(content: str):
    """Tolerant JSON parse: handles models that wrap JSON in code fences."""
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    return json.loads(text)
