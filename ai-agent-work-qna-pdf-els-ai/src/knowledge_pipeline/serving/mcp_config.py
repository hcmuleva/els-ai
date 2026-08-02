"""Launch specs for the MCP servers, shared by the retriever, the langchain-mcp
client, and the Droid `.factory/mcp.json` generator.

Servers exposed:
  - qdrant       : vector retrieval        (mcp-server-qdrant, via uvx)
  - postgres     : metadata + relations    (@modelcontextprotocol/server-postgres, via npx)
  - filesystem   : PDFs / generated assets  (@modelcontextprotocol/server-filesystem, via npx)
  - kp-workflows : custom LangGraph trigger (this package, via python)

NOTE: the Qdrant MCP server embeds queries itself, so its EMBEDDING_MODEL must
match the model used to upsert vectors (config.stores.embedding_model).
"""
from __future__ import annotations

import sys
from typing import Any, Dict

from ..config import PipelineConfig


def mcp_server_specs(config: PipelineConfig, include_workflows: bool = True) -> Dict[str, Dict[str, Any]]:
    s = config.stores
    specs: Dict[str, Dict[str, Any]] = {
        "qdrant": {
            "command": "uvx",
            "args": ["mcp-server-qdrant"],
            "transport": "stdio",
            "env": {
                "QDRANT_URL": s.qdrant_url,
                "COLLECTION_NAME": s.qdrant_collection,
                "EMBEDDING_MODEL": s.embedding_model,
            },
        },
        "postgres": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-postgres", s.postgres_dsn],
            "transport": "stdio",
        },
        "filesystem": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem", str(config.base_dir)],
            "transport": "stdio",
        },
    }
    if include_workflows:
        specs["kp-workflows"] = {
            "command": sys.executable,
            "args": ["-m", "knowledge_pipeline.mcp_server.workflows_server"],
            "transport": "stdio",
            "env": {"PYTHONPATH": str(config.base_dir / "src")},
        }
    return specs
