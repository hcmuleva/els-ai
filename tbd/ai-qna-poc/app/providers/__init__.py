from __future__ import annotations

from app.config import settings
from app.providers.base import LLMProvider, GenerationContext
from app.providers.droid_authored import DroidAuthoredProvider
from app.providers.external_llm import ExternalLLMProvider


def get_provider() -> LLMProvider:
    """Resolve the active generation provider.

    The POC default is the Droid-authored provider (the "LLM" for this project).
    When GENERATION_PROVIDER=external and a key is present, the external provider
    is used, but it falls back to the Droid-authored bank on any failure.
    """
    if settings.generation_provider == "external" and settings.openai_api_key:
        return ExternalLLMProvider(fallback=DroidAuthoredProvider())
    return DroidAuthoredProvider()


__all__ = [
    "LLMProvider",
    "GenerationContext",
    "DroidAuthoredProvider",
    "ExternalLLMProvider",
    "get_provider",
]
