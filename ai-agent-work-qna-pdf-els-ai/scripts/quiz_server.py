"""Local quiz player server.

Serves the unified question player backed by persisted relational quiz data.

    python scripts/quiz_server.py                 # http://localhost:8000
    python scripts/quiz_server.py --port 8080
"""
from __future__ import annotations

import argparse
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.topic_labels import clean_topic_label

_HTML = (_ROOT / "web" / "question_player.html")
_WEB_DIR = _ROOT / "web"
_VENDOR_DIR = _WEB_DIR / "vendor"
_ASSET_DIR = _WEB_DIR / "assets"
_OUTPUT_DIR = _ROOT / "data" / "output"

_CTYPES = {
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".svg": "image/svg+xml",
    ".map": "application/json; charset=utf-8",
}


# ----------------------------------------------------------------- normalize
def _norm_option(o: dict, i: int) -> dict:
    return {
        "id": o.get("id") or f"opt_{i}",
        "label": o.get("label", ""),
        "svg": o.get("svg"),
        "is_correct": bool(o.get("is_correct")),
        "rationale": o.get("rationale"),
        "position": o.get("slot_position", i + 1),
    }


def _norm_from_json_question(wrapped: dict, subject: str | None = None) -> dict:
    q = wrapped.get("question", wrapped)
    data = q.get("question_data", {})
    meta = data.get("_meta", {})
    return {
        "id": q.get("id"),
        "type": q.get("question_type") or data.get("variant") or "single_choice",
        "stem": q.get("question_title", ""),
        "stem_svg": q.get("question_svg"),
        "explanation": q.get("explanation"),
        "instruction": q.get("question_instruction"),
        "topic": clean_topic_label(meta.get("topic"), subject),
        "level_band": meta.get("level_band"),
        "bloom_level": meta.get("bloom_level"),
        "source_pages": meta.get("source_pages", []),
        "options": [_norm_option(o, i) for i, o in enumerate(data.get("options", []))],
    }


def load_json_quiz(path: Path) -> dict:
    obj = json.loads(path.read_text(encoding="utf-8"))
    subject = obj.get("subject")
    return {
        "quiz_id": obj.get("quiz_id") or path.stem,
        "quiz_title": obj.get("quiz_title") or path.stem,
        "level_band": obj.get("level_band"),
        "subject": obj.get("subject"),
        "class_level": obj.get("class_level"),
        "count": len(obj.get("questions", [])),
        "questions": [
            _norm_from_json_question(w, subject) for w in obj.get("questions", [])
        ],
    }

def _validated_question_runs() -> list[Path]:
    runs_root = _OUTPUT_DIR / "question-runs"
    if not runs_root.exists():
        return []
    candidates: list[Path] = []
    for manifest_path in runs_root.glob("*/manifest.json"):
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if (
            manifest.get("status") != "completed"
            or not manifest.get("validation_passed")
        ):
            continue
        relative = (
            (manifest.get("files") or {}).get("question_set.json")
            or "questions/question_set.json"
        )
        question_set = manifest_path.parent / relative
        if question_set.is_file():
            candidates.append(question_set)
    return sorted(candidates, key=lambda path: path.stat().st_mtime, reverse=True)


def load_player_quiz() -> dict:
    validated = _validated_question_runs()
    if validated:
        return load_json_quiz(validated[0])
    return {
        "quiz_id": "question-player",
        "quiz_title": "Question Player",
        "questions": [],
        "count": 0,
    }


def _relational_store():
    from knowledge_pipeline.config import PipelineConfig
    from knowledge_pipeline.stores import build_relational_store

    config = PipelineConfig.load()
    return build_relational_store(config.stores.postgres_dsn)


def load_persisted_player_quiz(subject: str | None = None, limit: int = 1000) -> dict:
    return _relational_store().load_player_quiz(subject=subject, limit=limit)


def load_persisted_subjects() -> dict:
    items = _relational_store().quiz_subjects()
    return {"count": len(items), "items": items}


# --------------------------------------------------------------------- server
class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        if ctype.startswith("text/html"):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj, code: int = 200) -> None:
        self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def log_message(self, *args) -> None:  # quieter console
        return

    def _static(self, route: str, prefix: str, root: Path) -> None:
        rel = route[len(prefix):].split("?", 1)[0]
        target = (root / rel).resolve()
        if root.resolve() not in target.parents or not target.is_file():
            self._json({"error": "not found"}, 404)
            return
        ctype = _CTYPES.get(target.suffix.lower(), "application/octet-stream")
        self._send(200, target.read_bytes(), ctype)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        route = parsed.path
        try:
            if route in ("/", "/index.html"):
                self._send(200, _HTML.read_bytes(), "text/html; charset=utf-8")
            elif route.startswith("/vendor/"):
                self._static(route, "/vendor/", _VENDOR_DIR)
            elif route.startswith("/assets/"):
                self._static(route, "/assets/", _ASSET_DIR)
            elif route == "/api/player/subjects":
                self._json(load_persisted_subjects())
            elif route == "/api/player":
                params = parse_qs(parsed.query)
                subject = (params.get("subject") or [None])[0]
                raw_limit = (params.get("limit") or ["1000"])[0]
                try:
                    limit = max(1, min(int(raw_limit), 1000))
                except ValueError:
                    self._json({"error": "limit must be an integer"}, 400)
                    return
                self._json(load_persisted_player_quiz(subject=subject, limit=limit))
            else:
                self._json({"error": "not found"}, 404)
        except Exception as exc:  # never crash the server on a bad request
            self._json({"error": str(exc)}, 500)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"[quiz_server] http://{args.host}:{args.port}  (Ctrl+C to stop)")
    print("[quiz_server] source: persisted relational quizzes")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[quiz_server] stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
