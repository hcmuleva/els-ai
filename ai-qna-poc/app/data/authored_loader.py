"""Load Droid-authored question content from JSON into the in-memory bank.

This is what makes the "local agent authors, the app serves" loop work: drop a
JSON file under ``app/data/authored/`` and it is merged into ``BANK`` at import,
so the FastAPI service and the offline provider serve it and the local agents
(structural validator + sympy verifier + critic) grade it.

JSON file shape (one file may cover one class+subject)::

    {
      "class_level": "12",
      "subject": "physics",
      "topics": {
        "semiconductors": [
          {
            "type": "single_choice",          // single_choice|multi_choice|true_false (sc|mcq|tf)
            "difficulty": "medium",            // easy|medium|hard
            "title_md": "... $LaTeX$ ...",
            "options": [{"label_md": "...", "is_correct": true}, ...],
            "explanation_md": "teacher-voice worked solution",
            "source_style_ref": "optional string",
            "verification": {"kind": "numeric", "expression": "3*4", "expected": 12,
                              "exact_label": "$12$"}   // optional, for sympy checking
          }
        ]
      }
    }
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

from app.schemas import Difficulty, QuestionType

RawQuestion = Dict[str, object]

_AUTHORED_DIR = Path(__file__).resolve().parent / "authored"

_TYPE_ALIASES = {
    "sc": QuestionType.single_choice,
    "single_choice": QuestionType.single_choice,
    "mcq": QuestionType.multi_choice,
    "multi_choice": QuestionType.multi_choice,
    "tf": QuestionType.true_false,
    "true_false": QuestionType.true_false,
}

_DEFAULT_INSTR = {
    QuestionType.single_choice: "Choose the one correct option.",
    QuestionType.multi_choice: "Select all correct options.",
    QuestionType.true_false: "State whether the statement is True or False.",
}


def _coerce_question(raw: dict) -> RawQuestion | None:
    qtype = _TYPE_ALIASES.get(str(raw.get("type", "")).strip().lower())
    if qtype is None:
        return None
    try:
        difficulty = Difficulty(str(raw.get("difficulty", "medium")).strip().lower())
    except ValueError:
        difficulty = Difficulty.medium

    options = []
    for opt in raw.get("options", []):
        label = str(opt.get("label_md", "")).strip()
        if not label:
            continue
        options.append({"label_md": label, "is_correct": bool(opt.get("is_correct"))})

    title = str(raw.get("title_md", "")).strip()
    if not title or not options:
        return None

    item: RawQuestion = {
        "type": qtype,
        "difficulty": difficulty,
        "topic": str(raw.get("topic", "")).strip(),
        "title_md": title,
        "instruction": str(raw.get("instruction", "") or _DEFAULT_INSTR[qtype]),
        "options": options,
        "explanation_md": str(raw.get("explanation_md", "")).strip(),
        "source_style_ref": str(raw.get("source_style_ref", "") or "Droid-authored (exam-grade)"),
    }
    verification = raw.get("verification")
    if isinstance(verification, dict):
        item["verification"] = verification
    return item


def load_authored(base_dir: Path = _AUTHORED_DIR) -> Dict[Tuple[str, str], Dict[str, List[RawQuestion]]]:
    """Read every JSON file under ``base_dir`` into a BANK-shaped dict."""
    loaded: Dict[Tuple[str, str], Dict[str, List[RawQuestion]]] = {}
    if not base_dir.exists():
        return loaded

    for path in sorted(base_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        class_level = str(data.get("class_level", "")).strip()
        subject = str(data.get("subject", "")).strip().lower()
        topics = data.get("topics", {})
        if not class_level or not subject or not isinstance(topics, dict):
            continue

        bucket = loaded.setdefault((class_level, subject), {})
        for topic, items in topics.items():
            topic_key = str(topic).strip().lower().replace(" ", "_").replace("-", "_")
            out: List[RawQuestion] = []
            for raw in items if isinstance(items, list) else []:
                q = _coerce_question(raw)
                if q is None:
                    continue
                q["topic"] = q["topic"] or topic_key
                out.append(q)
            if out:
                bucket.setdefault(topic_key, []).extend(out)
    return loaded


def merge_into(bank: Dict[Tuple[str, str], Dict[str, List[RawQuestion]]],
               extra: Dict[Tuple[str, str], Dict[str, List[RawQuestion]]]) -> None:
    """Merge ``extra`` into ``bank`` in place (authored content extends the bank)."""
    for key, topics in extra.items():
        target = bank.setdefault(key, {})
        for topic, items in topics.items():
            target.setdefault(topic, []).extend(items)
