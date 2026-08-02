"""Serving-plane stores: local embeddings (fastembed), Qdrant, Postgres."""
from __future__ import annotations

from .embedder import Embedder
from .postgres_store import PostgresStore
from .qdrant_store import QdrantStore
from .sqlite_store import SqliteStore


def build_relational_store(dsn: str):
    """Return a relational store for the given DSN.

    - ``sqlite:PATH`` / ``sqlite:///PATH`` -> SqliteStore (no server)
    - ``postgres://`` / ``postgresql://``  -> PostgresStore
    """
    if dsn.startswith("sqlite:"):
        path = dsn[len("sqlite:"):]
        if path.startswith("///"):
            path = path[3:]  # sqlite:///relative or absolute
        elif path.startswith("//"):
            path = path[2:]
        return SqliteStore(path or ":memory:")
    return PostgresStore(dsn)


__all__ = ["Embedder", "QdrantStore", "PostgresStore", "SqliteStore", "build_relational_store"]
