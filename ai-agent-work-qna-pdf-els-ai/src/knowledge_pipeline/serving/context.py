"""Retrieval + context building for the serving plane.

Three retrievers implement the same protocol:
  - McpRetriever    : reaches stores strictly THROUGH MCP (langchain-mcp-adapters).
  - DirectRetriever : uses Qdrant/Postgres SDKs directly (dependable fallback).
  - StubRetriever   : in-memory, for tests / no-service environments.

`build_retriever` prefers MCP (per the target architecture) and transparently
falls back to direct stores, then to the stub, so a workflow never hard-fails.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Protocol

from ..config import PipelineConfig
from .mcp_config import mcp_server_specs


class Retriever(Protocol):
    def vector_search(self, query: str, top_k: int = 5, flt: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]: ...
    def concepts_by_topic(self, topic: str, level_band: Optional[str] = None, limit: int = 25) -> List[Dict[str, Any]]: ...
    def prerequisites(self, concept_id: str, max_depth: int = 6) -> List[Dict[str, Any]]: ...
    def related(self, concept_id: str, limit: int = 10) -> List[Dict[str, Any]]: ...


# --------------------------------------------------------------------- direct
class DirectRetriever:
    def __init__(self, config: PipelineConfig) -> None:
        self.config = config
        self._qdrant = None
        self._pg = None

    def _q(self):
        if self._qdrant is None:
            from ..stores import Embedder, QdrantStore

            s = self.config.stores
            emb = Embedder(s.embedding_model, s.embedding_dim)
            self._qdrant = QdrantStore(s.qdrant_url, s.qdrant_collection, s.embedding_dim, emb)
        return self._qdrant

    def _p(self):
        if self._pg is None:
            from ..stores import build_relational_store

            self._pg = build_relational_store(self.config.stores.postgres_dsn)
        return self._pg

    def vector_search(self, query, top_k=5, flt=None):
        try:
            return self._q().search(query, top_k=top_k, flt=flt)
        except Exception:
            return []

    def concepts_by_topic(self, topic, level_band=None, limit=25):
        try:
            return self._p().concepts_by_topic(topic, level_band=level_band, limit=limit)
        except Exception:
            return []

    def prerequisites(self, concept_id, max_depth=6):
        try:
            return self._p().prerequisite_chain(concept_id, max_depth=max_depth)
        except Exception:
            return []

    def related(self, concept_id, limit=10):
        try:
            return self._p().related_concepts(concept_id, limit=limit)
        except Exception:
            return []


# ------------------------------------------------------------------------ mcp
class McpRetriever:
    """Reaches stores through MCP tools. Postgres via a `query` tool (SQL),
    Qdrant via a `qdrant-find` tool. Falls back to `fallback` on any error."""

    def __init__(self, config: PipelineConfig, fallback: Optional[Retriever] = None) -> None:
        self.config = config
        self.fallback = fallback or DirectRetriever(config)
        self._specs = mcp_server_specs(config, include_workflows=False)

    def _run(self, coro):
        import asyncio

        return asyncio.run(coro)

    async def _call(self, server: str, name_contains: List[str], args: Dict[str, Any]):
        from langchain_mcp_adapters.client import MultiServerMCPClient  # type: ignore

        client = MultiServerMCPClient({server: self._specs[server]})
        tools = await client.get_tools()
        tool = next(
            (t for t in tools if any(k in t.name.lower() for k in name_contains)), None
        )
        if tool is None:
            raise RuntimeError(f"no matching MCP tool on '{server}' for {name_contains}")
        return await tool.ainvoke(args)

    def _pg_query(self, sql: str) -> List[Dict[str, Any]]:
        import json

        raw = self._run(self._call("postgres", ["query", "sql", "read"], {"sql": sql}))
        if isinstance(raw, str):
            try:
                data = json.loads(raw)
            except Exception:
                return []
        else:
            data = raw
        return data if isinstance(data, list) else data.get("rows", [])

    def vector_search(self, query, top_k=5, flt=None):
        try:
            raw = self._run(self._call("qdrant", ["find", "search"], {"query": query}))
            if isinstance(raw, list):
                return [{"payload": r} if not isinstance(r, dict) else r for r in raw]
            return []
        except Exception:
            return self.fallback.vector_search(query, top_k, flt)

    def concepts_by_topic(self, topic, level_band=None, limit=25):
        try:
            safe = topic.replace("'", "''")
            cond = f" AND level_band = '{level_band}'" if level_band else ""
            sql = (
                "SELECT concept_id, name, topic, level_band, definition FROM concepts "
                f"WHERE topic ILIKE '%{safe}%'{cond} ORDER BY centrality DESC LIMIT {int(limit)}"
            )
            return self._pg_query(sql)
        except Exception:
            return self.fallback.concepts_by_topic(topic, level_band, limit)

    def prerequisites(self, concept_id, max_depth=6):
        try:
            cid = concept_id.replace("'", "''")
            sql = (
                "WITH RECURSIVE chain(concept_id, depth) AS ("
                f"SELECT target_id,1 FROM concept_edges WHERE source_id='{cid}' AND relation_type='prerequisite' "
                "UNION SELECT e.target_id,c.depth+1 FROM concept_edges e JOIN chain c ON e.source_id=c.concept_id "
                f"WHERE e.relation_type='prerequisite' AND c.depth<{int(max_depth)}) "
                "SELECT DISTINCT ch.concept_id, co.name, co.level_band, ch.depth FROM chain ch "
                "JOIN concepts co ON co.concept_id=ch.concept_id ORDER BY ch.depth"
            )
            return self._pg_query(sql)
        except Exception:
            return self.fallback.prerequisites(concept_id, max_depth)

    def related(self, concept_id, limit=10):
        try:
            cid = concept_id.replace("'", "''")
            sql = (
                "SELECT co.concept_id, co.name, e.relation_type, e.weight FROM concept_edges e "
                f"JOIN concepts co ON co.concept_id=e.target_id WHERE e.source_id='{cid}' "
                f"ORDER BY e.weight DESC LIMIT {int(limit)}"
            )
            return self._pg_query(sql)
        except Exception:
            return self.fallback.related(concept_id, limit)


# ----------------------------------------------------------------------- stub
class StubRetriever:
    def __init__(
        self,
        vector_hits: Optional[List[Dict[str, Any]]] = None,
        concepts: Optional[List[Dict[str, Any]]] = None,
        prereqs: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        self._v = vector_hits or []
        self._c = concepts or []
        self._p = prereqs or []

    def vector_search(self, query, top_k=5, flt=None):
        return self._v[:top_k]

    def concepts_by_topic(self, topic, level_band=None, limit=25):
        return self._c[:limit]

    def prerequisites(self, concept_id, max_depth=6):
        return self._p

    def related(self, concept_id, limit=10):
        return []


def build_retriever(config: PipelineConfig, prefer_mcp: bool = True) -> Retriever:
    direct = DirectRetriever(config)
    if not prefer_mcp:
        return direct
    try:
        import langchain_mcp_adapters  # noqa: F401

        return McpRetriever(config, fallback=direct)
    except Exception:
        return direct


# ------------------------------------------------------------- context builder
def build_context(
    vector_hits: List[Dict[str, Any]],
    concepts: List[Dict[str, Any]],
    prereqs: List[Dict[str, Any]],
    max_chunks: int = 5,
) -> Dict[str, Any]:
    lines: List[str] = []
    if concepts:
        lines.append("Concepts:")
        for c in concepts[:10]:
            lines.append(f"- {c.get('name')} ({c.get('level_band', 'unrated')}): {c.get('definition', '')[:200]}")
    if prereqs:
        lines.append("\nPrerequisites (learn first):")
        for p in prereqs:
            lines.append(f"- {p.get('name')} (depth {p.get('depth')})")
    if vector_hits:
        lines.append("\nRelevant passages:")
        for h in vector_hits[:max_chunks]:
            payload = h.get("payload", {})
            content = payload.get("content", "")
            lines.append(f"- {content[:300]}")
    topic = concepts[0].get("topic") if concepts else (
        vector_hits[0].get("payload", {}).get("topic") if vector_hits else None
    )
    payloads = [
        hit.get("payload", {})
        for hit in vector_hits[:max_chunks]
        if isinstance(hit.get("payload", {}), dict)
    ]
    source_pages: set[int] = set()
    for payload in payloads:
        pages = payload.get("source_pages") or payload.get("pages") or []
        if isinstance(pages, int):
            pages = [pages]
        for page in pages if isinstance(pages, list) else []:
            if isinstance(page, int):
                source_pages.add(page)
        for key in ("page_start", "page_end", "page"):
            if isinstance(payload.get(key), int):
                source_pages.add(payload[key])
    return {
        "text": "\n".join(lines).strip(),
        "topic": topic,
        "concept_ids": [c.get("concept_id") for c in concepts if c.get("concept_id")],
        "source_chunk_ids": [
            payload.get("chunk_id") for payload in payloads if payload.get("chunk_id")
        ],
        "source_run_ids": sorted(
            {str(payload["run_id"]) for payload in payloads if payload.get("run_id")}
        ),
        "source_book_ids": sorted(
            {str(payload["book_id"]) for payload in payloads if payload.get("book_id")}
        ),
        "source_pages": sorted(source_pages),
    }
