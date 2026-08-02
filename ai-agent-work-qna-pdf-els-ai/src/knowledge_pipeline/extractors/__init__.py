"""Knowledge extraction backends (offline heuristic + Droid/optional LLM providers)."""
from __future__ import annotations

from ..config import PipelineConfig
from .base import KnowledgeExtractor
from .heuristic import HeuristicExtractor


def build_extractor(
    config: PipelineConfig, provider: str | None = None
) -> KnowledgeExtractor:
    """Factory: return an extractor for the resolved provider.

    Default LLM is Droid (`droid exec`). Falls back to the deterministic
    heuristic extractor if the requested provider is unavailable, so the
    pipeline never breaks. Pass ``provider`` to override the config default
    (used for hybrid runs where only level tagging goes through the LLM).
    """
    provider = provider or config.resolved_provider()
    if provider == "mock":
        return HeuristicExtractor()

    try:
        if provider == "droid":
            from .droid import DroidExtractor

            return DroidExtractor(config)
        from .llm import LLMExtractor

        return LLMExtractor(config, provider=provider)
    except Exception as exc:  # missing CLI/SDK, unreachable server, bad key, etc.
        print(f"[extractors] '{provider}' unavailable ({exc}); using heuristic mode.")
        return HeuristicExtractor()


__all__ = ["KnowledgeExtractor", "HeuristicExtractor", "build_extractor"]
