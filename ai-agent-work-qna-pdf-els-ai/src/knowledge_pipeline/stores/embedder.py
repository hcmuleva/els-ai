"""Local text embeddings.

Primary backend is fastembed (local ONNX, no server). If the model cannot be
loaded (e.g. offline, model not yet downloaded), we fall back to a deterministic
hashing embedder so the pipeline still runs. The fallback is lexical only, not
semantic, and is clearly reported via `.backend`.
"""
from __future__ import annotations

import hashlib
import math
import re
from typing import List, Sequence

_TOKEN_RE = re.compile(r"[a-z0-9]+")


class _HashEmbedder:
    """Deterministic bag-of-hashed-tokens vector, L2-normalized. Offline fallback."""

    def __init__(self, dim: int) -> None:
        self.dim = dim

    def embed(self, texts: Sequence[str]) -> List[List[float]]:
        out: List[List[float]] = []
        for text in texts:
            vec = [0.0] * self.dim
            for tok in _TOKEN_RE.findall(text.lower()):
                h = int(hashlib.sha1(tok.encode("utf-8")).hexdigest(), 16)
                idx = h % self.dim
                sign = 1.0 if (h >> 8) & 1 else -1.0
                vec[idx] += sign
            norm = math.sqrt(sum(v * v for v in vec)) or 1.0
            out.append([v / norm for v in vec])
        return out


class Embedder:
    def __init__(self, model_name: str, dim: int) -> None:
        self.model_name = model_name
        self.dim = dim
        self.backend = "uninitialized"
        self._impl = None

    def _ensure(self) -> None:
        if self._impl is not None:
            return
        if self.model_name == "hash":  # explicit offline embedder (no download)
            self._impl = _HashEmbedder(self.dim)
            self.backend = "hash-fallback"
            return
        try:
            try:  # use the OS trust store so corporate TLS interception works
                import truststore  # type: ignore

                truststore.inject_into_ssl()
            except Exception:
                pass
            from fastembed import TextEmbedding  # type: ignore

            self._impl = TextEmbedding(model_name=self.model_name)
            self.backend = "fastembed"
        except Exception as exc:  # offline / model missing / import error
            print(f"[embedder] fastembed unavailable ({exc}); using hash fallback.")
            self._impl = _HashEmbedder(self.dim)
            self.backend = "hash-fallback"

    def embed(self, texts: Sequence[str]) -> List[List[float]]:
        self._ensure()
        if self.backend == "fastembed":
            return [list(map(float, v)) for v in self._impl.embed(list(texts))]
        return self._impl.embed(texts)

    def embed_one(self, text: str) -> List[float]:
        return self.embed([text])[0]
