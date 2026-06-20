"""Optional OpenAI-compatible provider.

Only used when ``GENERATION_PROVIDER=external`` and an API key is configured.
It builds the generation prompt (difficulty rubric + source-paper exemplars) via
``app.generation.prompt`` and carries any ``verification`` spec the model returns
so the deterministic verifier can check it. On any error it transparently falls
back to the Droid-authored provider, so the POC keeps working offline.
"""
from __future__ import annotations

from typing import List

import httpx

from app.config import settings
from app.generation.prompt import build_generation_messages, safe_json_loads
from app.providers.base import GenerationContext, LLMProvider, RawQuestion
from app.schemas import Difficulty, QuestionType

_TYPE_MAP = {
    "sc": QuestionType.single_choice,
    "single_choice": QuestionType.single_choice,
    "mcq": QuestionType.multi_choice,
    "multi_choice": QuestionType.multi_choice,
    "tf": QuestionType.true_false,
    "true_false": QuestionType.true_false,
}


def _exemplars_from_source(source_text: str) -> List[str]:
    """Pull a few question-like lines from the parsed paper as style anchors."""
    if not source_text:
        return []
    lines = [ln.strip() for ln in source_text.splitlines() if "?" in ln]
    return lines[:5]


class ExternalLLMProvider(LLMProvider):
    name = "external-openai-compatible"

    def __init__(self, fallback: LLMProvider) -> None:
        self.fallback = fallback

    def generate(self, ctx: GenerationContext) -> List[RawQuestion]:
        try:
            messages = build_generation_messages(ctx, _exemplars_from_source(ctx.source_text))
            resp = httpx.post(
                f"{settings.openai_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": settings.openai_model,
                    "messages": messages,
                    "temperature": 0.4,
                    "response_format": {"type": "json_object"},
                },
                timeout=settings.hf_timeout_seconds,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            data = safe_json_loads(content)
            raw = data.get("questions", [])
            normalized: List[RawQuestion] = []
            for q in raw:
                qtype = _TYPE_MAP.get(str(q.get("type", "")).lower())
                if not qtype:
                    continue
                item: RawQuestion = {
                    "type": qtype,
                    "difficulty": Difficulty(str(q.get("difficulty", ctx.difficulty.value))),
                    "topic": q.get("topic", ctx.topic or ctx.subject),
                    "title_md": q["title_md"],
                    "instruction": q.get("instruction", ""),
                    "options": q.get("options", []),
                    "explanation_md": q.get("explanation_md", ""),
                    "source_style_ref": q.get("source_style_ref", "external LLM"),
                }
                if isinstance(q.get("verification"), dict):
                    item["verification"] = q["verification"]
                normalized.append(item)
            if normalized:
                return normalized[: ctx.count]
        except Exception:
            pass
        return self.fallback.generate(ctx)
