#!/usr/bin/env python3
"""Offline CLI for the question-factory.

Reads a request (object or array) from JSON, runs the pipeline, and writes a
timestamped result per request to the output directory (JSON, plus CSV when the
request's outputFormat is CSV).

Usage:
    python -m scripts.generate                         # samples/sample_request.json
    python -m scripts.generate --in samples/mixed_pcm_request.json --out outputs
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from qfactory.export import to_csv, to_json  # noqa: E402
from qfactory.pipeline import run  # noqa: E402

DEFAULT_IN = ROOT / "samples" / "sample_request.json"
DEFAULT_OUT = ROOT / "outputs"


def _load(path: Path) -> List[Dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else [data]


def _slug(resp: dict) -> str:
    m = resp["metadata"]
    return f"{m['subject']}_class{m['class']}_{m['difficulty']}"


def main() -> None:
    ap = argparse.ArgumentParser(description="Offline CBSE/JEE/NEET question generator.")
    ap.add_argument("--in", dest="inp", default=str(DEFAULT_IN))
    ap.add_argument("--out", dest="out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    requests = _load(Path(args.inp))
    print(f"requests={len(requests)} | out={out_dir}")

    for i, raw in enumerate(requests, 1):
        resp = run(raw)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        base = out_dir / f"{_slug(resp)}_{ts}_{i:02d}"
        base.with_suffix(".json").write_text(to_json(resp), encoding="utf-8")
        if str(raw.get("outputFormat", "JSON")).upper() == "CSV":
            base.with_suffix(".csv").write_text(to_csv(resp), encoding="utf-8")
        v = resp["validation"]
        print(f"  [{i}] {resp['metadata']['totalQuestions']} Qs | verified={v['verified']} "
              f"rejected={v['qualityRejected']} schemaValid={v['schemaValid']} -> {base.with_suffix('.json').name}")


if __name__ == "__main__":
    main()
