"""Generator: offline Droid-authored bank loader and candidate selection.

Loads every ``data/authored/*.json`` file, filters by class / subject / chapter /
topic / type, then orders candidates by the requested difficulty (the Mixed
distribution when difficulty == Mixed). No external API is used.
"""
from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Dict, List, Optional

from qfactory.calibrator import mixed_distribution
from qfactory.types import Level, QFRequest

_BANK_DIR = Path(__file__).resolve().parent.parent / "data" / "authored"


def _norm(s: str) -> str:
    return "".join(ch for ch in (s or "").lower() if ch.isalnum())


def _match(query: str, text: str) -> bool:
    q, t = _norm(query), _norm(text)
    return bool(q) and (q in t or t in q)


def load_bank(base_dir: Path = _BANK_DIR) -> List[dict]:
    items: List[dict] = []
    if not base_dir.exists():
        return items
    for path in sorted(base_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        cl = str(data.get("class_level", "")).strip()
        subj = str(data.get("subject", "")).strip().lower()
        for raw in data.get("items", []):
            it = dict(raw)
            it["class_level"] = cl
            it["subject"] = subj
            items.append(it)
    return items


def select(req: QFRequest, bank: Optional[List[dict]] = None) -> List[dict]:
    bank = bank if bank is not None else load_bank()
    rng = random.Random(req.seed) if req.seed is not None else random.Random()
    type_vals = {t.value for t in req.question_types}

    def ok(it: dict) -> bool:
        if it.get("class_level") != req.class_level:
            return False
        if it.get("subject") != req.subject:
            return False
        if it.get("questionType") not in type_vals:
            return False
        if req.chapter and not _match(req.chapter, str(it.get("chapter", ""))):
            return False
        if req.topic and not _match(req.topic, str(it.get("topic", ""))):
            return False
        return True

    pool = [it for it in bank if ok(it)]
    rng.shuffle(pool)

    if req.difficulty != Level.MIXED:
        # difficulty is a hard constraint -> exact level only (may return fewer)
        return [it for it in pool if it.get("difficulty") == req.difficulty.value]

    # Mixed: fill per distribution, then append leftovers as a buffer
    alloc = mixed_distribution(req.count, req.subject)
    by_level: Dict[str, List[dict]] = {}
    for it in pool:
        by_level.setdefault(str(it.get("difficulty")), []).append(it)

    ordered: List[dict] = []
    used = set()
    for lvl, n in alloc.items():
        for p in by_level.get(lvl.value, [])[:n]:
            ordered.append(p)
            used.add(id(p))
    for it in pool:
        if id(it) not in used:
            ordered.append(it)
    return ordered
