"""kp-workflows MCP server.

Exposes the LangGraph workflows as MCP tools so Droid can trigger them:
  - generate_quiz(topic, level_band, count, persist)
  - generate_explanation(query, top_k, level_band)
  - generate_learning_path(topic, target_level)

Run standalone:  python -m knowledge_pipeline.mcp_server.workflows_server
Registered with Droid via `.factory/mcp.json` (see scripts/register_mcp.py).
"""
from __future__ import annotations

from typing import Any, Dict

from mcp.server.fastmcp import FastMCP

from ..config import PipelineConfig
from ..serving import Workflows

mcp = FastMCP("kp-workflows")

_config = PipelineConfig.load()
_workflows = Workflows(_config)


@mcp.tool()
def generate_quiz(
    topic: str, level_band: str = "intermediate", count: int = 3, persist: bool = False
) -> Dict[str, Any]:
    """Generate a quiz (target schema, with SVG diagrams) for a topic and level."""
    return _workflows.generate_quiz(topic, level_band=level_band, count=count, persist=persist)


@mcp.tool()
def generate_explanation(query: str, top_k: int = 5, level_band: str = "intermediate") -> Dict[str, Any]:
    """Retrieve context and produce a step-by-step explanation for a question."""
    return _workflows.generate_explanation(query, top_k=top_k, level_band=level_band)


@mcp.tool()
def generate_learning_path(topic: str, target_level: str = "advanced") -> Dict[str, Any]:
    """Produce an ordered learning path (prerequisites -> topic) at a target level."""
    return _workflows.generate_learning_path(topic, target_level=target_level)


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
