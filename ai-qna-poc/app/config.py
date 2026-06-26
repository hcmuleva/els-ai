from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _get(name: str, default: str) -> str:
    value = os.environ.get(name)
    return value if value not in (None, "") else default


@dataclass(frozen=True)
class Settings:
    port: int = int(_get("PORT", "4500"))

    # live | sample | both
    pdf_source_mode: str = _get("PDF_SOURCE_MODE", "both").lower()

    hf_dataset: str = _get("HF_DATASET", "AdithyaSNair/cbse-papers-2009-2025")
    hf_timeout_seconds: float = float(_get("HF_TIMEOUT_SECONDS", "20"))

    # droid | external
    generation_provider: str = _get("GENERATION_PROVIDER", "droid").lower()

    openai_api_key: str = _get("OPENAI_API_KEY", "")
    openai_base_url: str = _get("OPENAI_BASE_URL", "https://api.openai.com/v1")
    openai_model: str = _get("OPENAI_MODEL", "gpt-4o-mini")

    # Correctness pipeline
    max_repair_attempts: int = int(_get("GENERATION_MAX_REPAIR", "2"))
    critic_temperature: float = float(_get("CRITIC_TEMPERATURE", "0"))

    @property
    def critic_enabled(self) -> bool:
        """LLM critic runs only when an API key is configured."""
        return bool(self.openai_api_key)


settings = Settings()
