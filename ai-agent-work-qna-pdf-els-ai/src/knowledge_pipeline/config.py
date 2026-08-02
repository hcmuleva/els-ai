"""Runtime configuration loaded from YAML with environment-variable overrides."""
from __future__ import annotations

import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import yaml

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_SETTINGS = _REPO_ROOT / "config" / "settings.yaml"


def _load_dotenv(path: Path = _REPO_ROOT / ".env") -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip().lstrip("\ufeff")
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and value and key not in os.environ:
            os.environ[key] = value


def _postgres_dsn_from_env(default: str) -> str:
    explicit = os.getenv("KP_POSTGRES_DSN")
    if explicit:
        return explicit
    password = os.getenv("POSTGRES_PASSWORD")
    if not password:
        return default
    user = os.getenv("POSTGRES_USER", "kp")
    host = os.getenv("POSTGRES_HOST", "127.0.0.1")
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "kp")
    return (
        f"postgresql://{quote(user, safe='')}:{quote(password, safe='')}"
        f"@{host}:{port}/{quote(database, safe='')}"
    )


@dataclass
class ValidationThresholds:
    min_relevance: float = 0.45
    min_educational_value: float = 0.45
    min_assessment_value: float = 0.40
    min_embedding_value: float = 0.45
    min_completeness: float = 0.35
    min_accuracy: float = 0.50
    min_confidence: float = 0.45

    def as_dict(self) -> dict[str, float]:
        return self.__dict__.copy()


@dataclass
class GenerationConfig:
    enabled: bool = True
    questions_per_item: int = 1
    bands: tuple[str, ...] = (
        "beginner", "intermediate", "advanced", "jee_main", "jee_advanced", "expert",
    )
    composite_min_band: str = "jee_main"   # bands >= this are built from multi-concept bundles
    max_composite_members: int = 4


@dataclass
class IdentityConfig:
    """Ownership/classification fields. Never hardcoded; supplied via env or CLI."""
    creator_id: Optional[str] = None
    organization_id: Optional[str] = None
    subject: Optional[str] = None
    class_level: Optional[str] = None
    language: str = "en"


@dataclass
class StoreConfig:
    """Vector DB (Qdrant), relational store (Postgres), and embedding model."""
    embedding_model: str = "BAAI/bge-small-en-v1.5"  # fastembed, 384-dim, fully local
    embedding_dim: int = 384
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "kp_chunks"
    postgres_dsn: str = "postgresql://kp@127.0.0.1:5432/kp"


@dataclass
class PipelineConfig:
    provider: str = "local"                # mock | local | droid | openai | anthropic | auto
    level_provider: Optional[str] = None   # override just the level-tagging phase (hybrid runs)
    local_llm_base_url: str = "http://127.0.0.1:11434/v1"
    local_llm_model: str = "qwen3.6:35b"
    local_llm_api_key: str = "ollama"
    local_llm_timeout_s: int = 240
    local_llm_temperature: float = 0.2
    local_llm_max_tokens: int = 4096
    openai_model: str = "gpt-4o-mini"
    anthropic_model: str = "claude-3-5-sonnet-latest"
    # Droid CLI provider settings.
    droid_cli_path: str = "droid"
    droid_model: Optional[str] = None      # None -> droid's own default model
    droid_autonomy: str = "low"            # read-only autonomy is enough for generation
    droid_timeout_s: int = 240
    base_dir: Path = _REPO_ROOT
    input_dir: Path = _REPO_ROOT / "data" / "input"
    output_dir: Path = _REPO_ROOT / "data" / "output" / "runs"
    output_run_id: Optional[str] = None
    thresholds: ValidationThresholds = field(default_factory=ValidationThresholds)
    chunk_max_chars: int = 2200
    generation: GenerationConfig = field(default_factory=GenerationConfig)
    identity: IdentityConfig = field(default_factory=IdentityConfig)
    stores: StoreConfig = field(default_factory=StoreConfig)
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    _resolved: Optional[str] = field(default=None, repr=False)

    def resolved_provider(self) -> str:
        """Resolve ``auto`` without probing network services."""
        if self._resolved:
            return self._resolved
        if self.provider != "auto":
            self._resolved = self.provider
            return self._resolved
        self._resolved = "local"
        return self._resolved

    @classmethod
    def load(cls, settings_path: Optional[Path] = None) -> "PipelineConfig":
        _load_dotenv()
        path = Path(settings_path) if settings_path else _DEFAULT_SETTINGS
        raw: dict = {}
        if path.exists():
            raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}

        paths = raw.get("paths", {})
        val = raw.get("validation", {})
        chunk = raw.get("chunking", {})
        droid = raw.get("droid", {})
        local_llm = raw.get("local_llm", {})
        gen = raw.get("generation", {})
        ident = raw.get("identity", {})
        stores = raw.get("stores", {})

        gen_cfg = GenerationConfig(
            enabled=bool(gen.get("enabled", True)),
            questions_per_item=int(gen.get("questions_per_item", 1)),
            bands=tuple(gen.get("bands", GenerationConfig().bands)),
            composite_min_band=str(gen.get("composite_min_band", "jee_main")),
            max_composite_members=int(gen.get("max_composite_members", 4)),
        )

        ident_cfg = IdentityConfig(
            creator_id=os.getenv("KP_CREATOR_ID", ident.get("creator_id")) or None,
            organization_id=os.getenv("KP_ORG_ID", ident.get("organization_id")) or None,
            subject=os.getenv("KP_SUBJECT", ident.get("subject")) or None,
            class_level=os.getenv("KP_CLASS_LEVEL", ident.get("class_level")) or None,
            language=os.getenv("KP_LANGUAGE", ident.get("language", "en")),
        )

        store_defaults = StoreConfig()
        store_cfg = StoreConfig(
            embedding_model=os.getenv(
                "KP_EMBEDDING_MODEL", stores.get("embedding_model", store_defaults.embedding_model)
            ),
            embedding_dim=int(
                os.getenv("KP_EMBEDDING_DIM", stores.get("embedding_dim", store_defaults.embedding_dim))
            ),
            qdrant_url=os.getenv("KP_QDRANT_URL", stores.get("qdrant_url", store_defaults.qdrant_url)),
            qdrant_collection=os.getenv(
                "KP_QDRANT_COLLECTION", stores.get("qdrant_collection", store_defaults.qdrant_collection)
            ),
            postgres_dsn=_postgres_dsn_from_env(
                stores.get("postgres_dsn", store_defaults.postgres_dsn)
            ),
        )

        cfg = cls(
            provider=os.getenv("KP_PROVIDER", raw.get("provider", "local")),
            level_provider=os.getenv("KP_LEVEL_PROVIDER", raw.get("level_provider")) or None,
            local_llm_base_url=os.getenv(
                "KP_LOCAL_LLM_BASE_URL",
                local_llm.get("base_url", "http://127.0.0.1:11434/v1"),
            ),
            local_llm_model=os.getenv(
                "KP_LOCAL_LLM_MODEL",
                local_llm.get("model", "qwen3.6:35b"),
            ),
            local_llm_api_key=os.getenv(
                "KP_LOCAL_LLM_API_KEY", local_llm.get("api_key", "ollama")
            ),
            local_llm_timeout_s=int(
                os.getenv("KP_LOCAL_LLM_TIMEOUT", local_llm.get("timeout_s", 240))
            ),
            local_llm_temperature=float(
                os.getenv(
                    "KP_LOCAL_LLM_TEMPERATURE",
                    local_llm.get("temperature", 0.2),
                )
            ),
            local_llm_max_tokens=int(
                os.getenv(
                    "KP_LOCAL_LLM_MAX_TOKENS",
                    local_llm.get("max_tokens", 4096),
                )
            ),
            openai_model=os.getenv("KP_OPENAI_MODEL", raw.get("openai_model", "gpt-4o-mini")),
            anthropic_model=os.getenv(
                "KP_ANTHROPIC_MODEL", raw.get("anthropic_model", "claude-3-5-sonnet-latest")
            ),
            droid_cli_path=os.getenv("KP_DROID_CLI", droid.get("cli_path", "droid")),
            droid_model=os.getenv("KP_DROID_MODEL", droid.get("model")) or None,
            droid_autonomy=os.getenv("KP_DROID_AUTONOMY", droid.get("autonomy", "low")),
            droid_timeout_s=int(os.getenv("KP_DROID_TIMEOUT", droid.get("timeout_s", 240))),
            input_dir=_abs(paths.get("input_dir", "data/input")),
            output_dir=_abs(paths.get("output_dir", "data/output/runs")),
            output_run_id=os.getenv("KP_RUN_ID") or None,
            thresholds=ValidationThresholds(**{k: float(v) for k, v in val.items()}),
            chunk_max_chars=int(chunk.get("max_chars", 2200)),
            generation=gen_cfg,
            identity=ident_cfg,
            stores=store_cfg,
            openai_api_key=os.getenv("OPENAI_API_KEY") or None,
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY") or None,
        )
        return cfg


def _abs(p: str | Path) -> Path:
    path = Path(p)
    return path if path.is_absolute() else (_REPO_ROOT / path)
