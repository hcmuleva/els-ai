"""Run the local document-ingestion and question-generation API."""
from __future__ import annotations

import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))


def main() -> int:
    import uvicorn

    host = os.getenv("KP_API_HOST", "127.0.0.1")
    port = int(os.getenv("KP_API_PORT", "8000"))
    uvicorn.run(
        "knowledge_pipeline.api.app:app",
        host=host,
        port=port,
        reload=False,
        app_dir=str(_SRC),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
