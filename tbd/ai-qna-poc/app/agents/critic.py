"""LLM critic agent (independent answer-checker).

When an API key is configured it sends each question to an OpenAI-compatible
model WITHOUT the answer key, asks it to solve the question itself, and compares
the model's chosen option(s) to the marked correct option(s). When no key is set
(the default for this POC) it skips gracefully and the pipeline relies on the
deterministic verifier + structural checks.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Set

import httpx

from app.config import settings
from app.generation.prompt import build_critic_messages, safe_json_loads
from app.providers.base import RawQuestion

VERIFIED = "verified"
REFUTED = "refuted"
SKIPPED = "skipped"


@dataclass
class CriticResult:
    status: str  # verified | refuted | skipped
    reason: str = ""


def _marked_correct_slots(raw: RawQuestion) -> Set[int]:
    return {
        idx
        for idx, o in enumerate(raw.get("options", []), start=1)
        if o.get("is_correct")
    }


def review(raw: RawQuestion) -> CriticResult:
    if not settings.critic_enabled:
        return CriticResult(SKIPPED, "no API key configured")

    try:
        resp = httpx.post(
            f"{settings.openai_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={
                "model": settings.openai_model,
                "messages": build_critic_messages(raw),
                "temperature": settings.critic_temperature,
                "response_format": {"type": "json_object"},
            },
            timeout=settings.hf_timeout_seconds,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        data = safe_json_loads(content)

        chosen: Set[int] = {int(n) for n in data.get("correct_options", [])}
        marked = _marked_correct_slots(raw)
        if not chosen:
            return CriticResult(SKIPPED, "critic returned no option")
        if chosen != marked:
            return CriticResult(
                REFUTED,
                f"critic chose {sorted(chosen)} but answer key is {sorted(marked)}",
            )
        if bool(data.get("ambiguous")):
            return CriticResult(REFUTED, f"critic flagged ambiguous: {data.get('reason', '')}")
        return CriticResult(VERIFIED, str(data.get("reason", "")))
    except Exception as exc:  # network/parse failure must not break generation
        return CriticResult(SKIPPED, f"critic unavailable: {exc}")
