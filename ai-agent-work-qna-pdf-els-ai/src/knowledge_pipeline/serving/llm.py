"""LLM abstraction for pipeline and serving workflows."""
from __future__ import annotations

import json
import re
from typing import Any, Optional, Protocol

from ..config import PipelineConfig

_JSON_BLOCK_RE = re.compile(r"\{.*\}|\[.*\]", re.DOTALL)


class LLM(Protocol):
    def complete(self, prompt: str) -> str: ...


class DroidLLM:
    def __init__(self, config: PipelineConfig) -> None:
        self.config = config

    def complete(self, prompt: str) -> str:
        from ..extractors.droid import run_droid

        return run_droid(
            prompt,
            cli=self.config.droid_cli_path,
            autonomy=self.config.droid_autonomy,
            model=self.config.droid_model,
            timeout=self.config.droid_timeout_s,
            cwd=str(self.config.base_dir),
        )

    def complete_json(self, prompt: str) -> Any:
        raw = self.complete(prompt + "\n\nRespond with ONLY valid JSON.")
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            m = _JSON_BLOCK_RE.search(raw)
            if m:
                return json.loads(m.group(0))
            raise


class LocalLLM:
    """OpenAI-compatible local server, including Ollama, vLLM, and LM Studio."""

    def __init__(self, config: PipelineConfig) -> None:
        from .openai_compatible import OpenAICompatibleClient

        self.client = OpenAICompatibleClient(
            base_url=config.local_llm_base_url,
            model=config.local_llm_model,
            api_key=config.local_llm_api_key,
            timeout_s=config.local_llm_timeout_s,
            temperature=config.local_llm_temperature,
            max_tokens=config.local_llm_max_tokens,
        )

    def complete(self, prompt: str) -> str:
        return self.client.complete(prompt)

    def models(self) -> list[str]:
        return self.client.models()


class HostedLLM:
    def __init__(self, config: PipelineConfig, provider: str) -> None:
        self.provider = provider
        if provider == "openai":
            from openai import OpenAI  # type: ignore

            if not config.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY not set")
            self.client = OpenAI(api_key=config.openai_api_key)
            self.model = config.openai_model
        elif provider == "anthropic":
            import anthropic  # type: ignore

            if not config.anthropic_api_key:
                raise RuntimeError("ANTHROPIC_API_KEY not set")
            self.client = anthropic.Anthropic(api_key=config.anthropic_api_key)
            self.model = config.anthropic_model
        else:
            raise ValueError(f"Unsupported hosted provider: {provider}")

    def complete(self, prompt: str) -> str:
        if self.provider == "openai":
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
            )
            return response.choices[0].message.content or ""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(
            block.text for block in response.content if hasattr(block, "text")
        )


class StubLLM:
    """Deterministic offline LLM for tests / no-Droid environments."""

    def __init__(self, canned: Optional[str] = None) -> None:
        self.canned = canned

    def complete(self, prompt: str) -> str:
        if self.canned is not None:
            return self.canned
        head = prompt.strip().splitlines()[0][:160] if prompt.strip() else ""
        return f"[offline explanation] {head}"


def build_llm(config: PipelineConfig) -> LLM:
    provider = config.resolved_provider()
    if provider == "local":
        return LocalLLM(config)
    if provider == "droid":
        return DroidLLM(config)
    if provider in {"openai", "anthropic"}:
        return HostedLLM(config, provider)
    return StubLLM()
