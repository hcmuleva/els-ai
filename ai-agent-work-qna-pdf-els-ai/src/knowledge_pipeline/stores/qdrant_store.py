"""Qdrant vector store: embed chunks and upsert points with rich payload."""
from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional, Sequence

from .embedder import Embedder

_NAMESPACE = uuid.UUID("6f9619ff-8b86-d011-b42d-00cf4fc964ff")


def point_id_for(chunk_id: str) -> str:
    """Stable UUID for a string chunk id (Qdrant requires int/UUID point ids)."""
    return str(uuid.uuid5(_NAMESPACE, chunk_id))


class QdrantStore:
    def __init__(self, url: str, collection: str, dim: int, embedder: Embedder, timeout: int = 5) -> None:
        self.url = url
        self.collection = collection
        self.dim = dim
        self.embedder = embedder
        self.timeout = timeout
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from qdrant_client import QdrantClient  # type: ignore

            url = self.url
            if url.startswith("http://") or url.startswith("https://"):
                try:
                    c = QdrantClient(url=url, timeout=self.timeout, check_compatibility=False)
                    c.collection_exists(self.collection)
                    self._client = c
                except Exception:
                    from pathlib import Path
                    local_path = "./data/qdrant"
                    Path(local_path).mkdir(parents=True, exist_ok=True)
                    self._client = QdrantClient(path=local_path)
            elif url in (":memory:", "memory://"):
                self._client = QdrantClient(location=":memory:")
            else:
                # Embedded/on-disk local mode (no server): url is a filesystem path.
                path = url[len("file://"):] if url.startswith("file://") else url
                from pathlib import Path

                Path(path).mkdir(parents=True, exist_ok=True)
                self._client = QdrantClient(path=path)
        return self._client

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    def ensure_collection(self, recreate: bool = False) -> None:
        from qdrant_client.models import Distance, VectorParams  # type: ignore

        exists = self.client.collection_exists(self.collection)
        if exists and recreate:
            self.client.delete_collection(self.collection)
            exists = False
        if not exists:
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config=VectorParams(size=self.dim, distance=Distance.COSINE),
            )

    def upsert_chunks(self, chunks: Sequence[Dict[str, Any]], batch_size: int = 128) -> int:
        """chunks: [{chunk_id, content, payload{...}}]. Returns count upserted."""
        from qdrant_client.models import PointStruct  # type: ignore

        total = 0
        for start in range(0, len(chunks), batch_size):
            batch = chunks[start : start + batch_size]
            vectors = self.embedder.embed([c["content"] for c in batch])
            points = []
            for chunk, vec in zip(batch, vectors):
                payload = dict(chunk.get("payload", {}))
                payload.setdefault("chunk_id", chunk["chunk_id"])
                payload.setdefault("content", chunk["content"])
                points.append(
                    PointStruct(id=point_id_for(chunk["chunk_id"]), vector=vec, payload=payload)
                )
            self.client.upsert(collection_name=self.collection, points=points)
            total += len(points)
        return total

    def search(
        self, query: str, top_k: int = 5, flt: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        from qdrant_client.models import (  # type: ignore
            FieldCondition,
            Filter,
            MatchAny,
            MatchValue,
        )

        qfilter = None
        if flt:
            qfilter = Filter(
                must=[
                    FieldCondition(
                        key=key,
                        match=(
                            MatchAny(any=value)
                            if isinstance(value, (list, tuple, set))
                            else MatchValue(value=value)
                        ),
                    )
                    for key, value in flt.items()
                ]
            )
        vec = self.embedder.embed_one(query)
        hits = self.client.query_points(
            collection_name=self.collection,
            query=vec,
            limit=top_k,
            query_filter=qfilter,
            with_payload=True,
        ).points
        return [{"score": h.score, "payload": h.payload} for h in hits]
