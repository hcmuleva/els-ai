"""Re-run the validation layer over a saved assessment set and rewrite it with
refreshed validation reports. No LLM calls - useful after tightening/fixing the
validators.

    python scripts/revalidate_assessments.py data/output/assessment_set.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.assessment.schema import Assessment  # noqa: E402
from knowledge_pipeline.assessment.validation import normalize_assessment, run_validation  # noqa: E402


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "data/output/assessment_set.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    out = []
    for item in data.get("assessments", []):
        a = Assessment.model_validate(item)
        normalize_assessment(a)
        a.validation = run_validation(a)
        out.append(a.model_dump())
    data["assessments"] = out
    data["passed"] = sum(1 for a in out if a["validation"]["status"] == "PASSED")
    data["count"] = len(out)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[revalidate] {path}: {data['passed']}/{data['count']} PASSED")
    for a in out:
        v = a["validation"]
        print(f"  {a['metadata']['topic']:26s} {v['status']:6s} score={v['qualityScore']:3d} "
              f"{('; '.join(v['issues'][:2])) if v['issues'] else ''}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
