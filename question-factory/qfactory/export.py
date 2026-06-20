"""Export Adapter: render the response as JSON or a flat CSV worksheet."""
from __future__ import annotations

import csv
import io
import json

_CSV_COLUMNS = [
    "id", "questionType", "difficulty", "marks", "chapter", "topic",
    "question", "A", "B", "C", "D", "correctAnswer", "finalAnswer",
]


def to_json(resp: dict) -> str:
    return json.dumps(resp, indent=2, ensure_ascii=False)


def to_csv(resp: dict) -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=_CSV_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    for q in resp.get("questions", []):
        opts = {o.get("key"): o.get("text", "") for o in q.get("options", [])}
        ans = q.get("correctAnswer")
        if isinstance(ans, list):
            ans = ",".join(ans)
        writer.writerow({
            "id": q.get("id"),
            "questionType": q.get("questionType"),
            "difficulty": q.get("difficulty"),
            "marks": q.get("marks", ""),
            "chapter": q.get("chapter", ""),
            "topic": q.get("topic", ""),
            "question": q.get("question", ""),
            "A": opts.get("A", ""),
            "B": opts.get("B", ""),
            "C": opts.get("C", ""),
            "D": opts.get("D", ""),
            "correctAnswer": ans,
            "finalAnswer": (q.get("solution") or {}).get("finalAnswer", ""),
        })
    return buf.getvalue()
