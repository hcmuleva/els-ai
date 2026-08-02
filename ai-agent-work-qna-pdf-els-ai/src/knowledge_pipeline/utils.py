"""Shared helpers: id generation, json io, and lightweight text utilities."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any, Iterable

_WORD_RE = re.compile(r"[A-Za-z][A-Za-z\-']+")
_SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")


def stable_id(prefix: str, *parts: Any) -> str:
    """Deterministic short id from the given parts (stable across runs)."""
    raw = "||".join(str(p) for p in parts)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:10]
    return f"{prefix}_{digest}"


def slugify(text: str, max_len: int = 60) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:max_len] or "item"


def sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text or "").strip()
    if not text:
        return []
    return [s.strip() for s in _SENT_SPLIT_RE.split(text) if s.strip()]


def words(text: str) -> list[str]:
    return _WORD_RE.findall(text or "")


def normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def round_scores(obj: Any, ndigits: int = 3) -> Any:
    """Recursively round floats for stable, readable JSON output."""
    if isinstance(obj, float):
        return round(obj, ndigits)
    if isinstance(obj, dict):
        return {k: round_scores(v, ndigits) for k, v in obj.items()}
    if isinstance(obj, list):
        return [round_scores(v, ndigits) for v in obj]
    return obj


def write_json(path: Path, data: Any) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(round_scores(data), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return path


def read_json(path: Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def dedupe_preserve(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        key = item.strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(item.strip())
    return out


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))
