#!/usr/bin/env python3
"""Generate question JSON files locally (no server, no external API).

Reads one request - or a list of requests - from a JSON file, runs the pipeline
with whatever ``GENERATION_PROVIDER`` is configured in ``.env`` (default
``droid`` / text-grounded), and writes each result to a timestamped ``.json``
file in the output directory.

Usage:
    # uses samples/sample_request.json -> output/
    ./.venv/bin/python -m scripts.generate

    # custom request file and output directory
    ./.venv/bin/python -m scripts.generate --in samples/sample_request.json --out output

The request file may contain a single request object or a JSON array of them.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import List

from app.config import settings
from app.pipeline import run
from app.schemas import GenerateRequest

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_IN = ROOT / "samples" / "sample_request.json"
DEFAULT_OUT = ROOT / "output"


def _load_requests(path: Path) -> List[GenerateRequest]:
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data if isinstance(data, list) else [data]
    return [GenerateRequest(**item) for item in items]


def _slug(req: GenerateRequest) -> str:
    return f"{req.subject.value}_class{req.class_level.value}_{req.difficulty.value}"


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate question JSON files (offline).")
    ap.add_argument("--in", dest="inp", default=str(DEFAULT_IN),
                    help="request JSON file (object or array). Default: samples/sample_request.json")
    ap.add_argument("--out", dest="out", default=str(DEFAULT_OUT),
                    help="output directory. Default: output/")
    args = ap.parse_args()

    in_path = Path(args.inp)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    requests = _load_requests(in_path)
    print(f"provider={settings.generation_provider} | source_mode={settings.pdf_source_mode} "
          f"| requests={len(requests)} | out={out_dir}")

    for i, req in enumerate(requests, 1):
        resp = run(req)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        fpath = out_dir / f"{_slug(req)}_{ts}_{i:02d}.json"
        fpath.write_text(
            json.dumps(resp.model_dump(), indent=2, default=str, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"  [{i}] {resp.meta['returned_count']} questions "
              f"(source={resp.source.mode}, pdf={resp.source.pdf_path}) -> {fpath}")


if __name__ == "__main__":
    main()
