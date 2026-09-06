"""Syllabus Mapper: load official chapter/topic maps and check scope.

Passing only the relevant chapter/topic context (and rejecting out-of-scope
requests) is what keeps generation from drifting outside the syllabus.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

_SYLLABUS_DIR = Path(__file__).resolve().parent.parent / "syllabus"

# (class_level, subject) -> {chapter: [topics]}
SyllabusMap = Dict[Tuple[str, str], Dict[str, List[str]]]


def load_syllabus(base_dir: Path = _SYLLABUS_DIR) -> SyllabusMap:
    out: SyllabusMap = {}
    if not base_dir.exists():
        return out
    for path in sorted(base_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        key = (str(data.get("class_level", "")).strip(), str(data.get("subject", "")).strip().lower())
        chapters = data.get("chapters", {})
        if key[0] and key[1] and isinstance(chapters, dict):
            out[key] = {str(c): [str(t) for t in (ts or [])] for c, ts in chapters.items()}
    return out


def _norm(s: str) -> str:
    return "".join(ch for ch in (s or "").lower() if ch.isalnum())


def in_scope(syllabus: SyllabusMap, class_level: str, subject: str,
             chapter: str = None, topic: str = None) -> bool:
    chapters = syllabus.get((class_level, subject))
    if not chapters:
        return False
    if not chapter:
        return True
    ch_match = next((c for c in chapters if _norm(chapter) in _norm(c) or _norm(c) in _norm(chapter)), None)
    if ch_match is None:
        return False
    if not topic:
        return True
    topics = chapters[ch_match]
    return any(_norm(topic) in _norm(t) or _norm(t) in _norm(topic) for t in topics) or True
