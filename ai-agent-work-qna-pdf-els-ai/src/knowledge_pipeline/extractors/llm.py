"""Local or hosted LLM extractor.

Any initialization failure delegates to the heuristic extractor through the
extractor factory.
"""
from __future__ import annotations

from ..config import PipelineConfig
from . import prompts
from .prompt_base import PromptExtractor


class LLMExtractor(PromptExtractor):
    def __init__(self, config: PipelineConfig, provider: str) -> None:
        super().__init__()
        self.config = config
        self.provider = provider
        self.name = f"llm:{provider}"
        self._client, self._model = self._init_client(config, provider)

    @staticmethod
    def _init_client(config: PipelineConfig, provider: str):
        if provider == "local":
            from ..serving.openai_compatible import OpenAICompatibleClient

            return (
                OpenAICompatibleClient(
                    base_url=config.local_llm_base_url,
                    model=config.local_llm_model,
                    api_key=config.local_llm_api_key,
                    timeout_s=config.local_llm_timeout_s,
                    temperature=config.local_llm_temperature,
                    max_tokens=config.local_llm_max_tokens,
                ),
                config.local_llm_model,
            )
        if provider == "openai":
            from openai import OpenAI  # type: ignore

            if not config.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY not set")
            return OpenAI(api_key=config.openai_api_key), config.openai_model
        if provider == "anthropic":
            import anthropic  # type: ignore

            if not config.anthropic_api_key:
                raise RuntimeError("ANTHROPIC_API_KEY not set")
            return anthropic.Anthropic(api_key=config.anthropic_api_key), config.anthropic_model
        raise ValueError(f"Unsupported provider: {provider}")

    def _complete(self, user_prompt: str) -> str:
        if self.provider == "local":
            return self._client.complete(user_prompt, system_prompt=prompts.SYSTEM)
        if self.provider == "openai":
            resp = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": prompts.SYSTEM},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            return resp.choices[0].message.content or ""
        resp = self._client.messages.create(
            model=self._model,
            max_tokens=4096,
            temperature=0.2,
            system=prompts.SYSTEM,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return "".join(block.text for block in resp.content if hasattr(block, "text"))
