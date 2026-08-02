"""Convenience entry point: `python run.py [--input ... --output ... --provider ...]`.

Avoids needing an editable install; adds src/ to sys.path then runs the CLI.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from knowledge_pipeline.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
