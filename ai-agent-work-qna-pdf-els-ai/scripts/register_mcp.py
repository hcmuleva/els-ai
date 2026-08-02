"""Generate `.factory/mcp.json` so Droid can reach the stores and trigger workflows.

Writes the project-level Droid MCP config registering:
  qdrant, postgres, filesystem (data access) and kp-workflows (LangGraph trigger).

Usage:
    python scripts/register_mcp.py            # write .factory/mcp.json
    python scripts/register_mcp.py --print    # print config + `droid mcp add` hints
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.config import PipelineConfig  # noqa: E402
from knowledge_pipeline.serving.mcp_config import mcp_server_specs  # noqa: E402


def build_config() -> dict:
    cfg = PipelineConfig.load()
    specs = mcp_server_specs(cfg, include_workflows=True)
    servers = {}
    for name, spec in specs.items():
        entry = {"command": spec["command"], "args": spec["args"]}
        if spec.get("env"):
            entry["env"] = spec["env"]
        servers[name] = entry
    return {"mcpServers": servers}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--print", action="store_true", dest="show")
    args = ap.parse_args()

    config = build_config()
    if args.show:
        print(json.dumps(config, indent=2))
        print("\n# Equivalent CLI (Droid picks up .factory/mcp.json automatically):")
        for name in config["mcpServers"]:
            print(f"#   droid mcp add {name} ...  (see .factory/mcp.json)")
        return 0

    dest = _ROOT / ".factory" / "mcp.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    print(f"[register] wrote {dest}")
    print(f"[register] servers: {', '.join(config['mcpServers'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
