"""Generate a validated, immutable question bank from an approved pipeline run."""
from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.assessment.validation import (  # noqa: E402
    normalize_latex,
    validate_latex,
    validate_svg,
)
from knowledge_pipeline.config import PipelineConfig  # noqa: E402
from knowledge_pipeline.output_layout import (  # noqa: E402
    create_run_directory,
    load_manifest,
    resolve_artifact,
)
from knowledge_pipeline.serving.llm import build_llm  # noqa: E402
from knowledge_pipeline.serving.rag_quiz import RagQuizGenerator  # noqa: E402
from knowledge_pipeline.serving.workflows import Workflows  # noqa: E402

_PAGES_SUFFIX_RE = re.compile(r"\s+practice pages\s+\d+-\d+\s*$", re.IGNORECASE)
_SECTION_RE = re.compile(r"^\s*([1-9]\.[1-9])\b")
_SAFE_RE = re.compile(r"[^a-zA-Z0-9]+")
_TOPIC_NAMES = {
    "3.2": "3.2 Problems on Percentages, Mixtures, Alloys, and Work",
    "4.1": "4.1 The Antiderivative and the Newton-Leibniz Formula",
    "4.2": "4.2 Calculating Areas of Plane Figures",
    "8.3": "8.3 Volumes of Solids of Revolution",
    "9.1": "9.1 Problems in Algebra",
    "9.2": "9.2 Limit of a Function and Continuity",
    "9.3": "9.3 The Derivative of a Function",
    "9.4": "9.4 Integral Calculus and Miscellaneous Problems",
}


class TopicRetriever:
    def __init__(self, chunks: list[dict[str, Any]]) -> None:
        self.chunks = chunks

    def vector_search(self, query: str, top_k: int = 6, flt=None) -> list[dict[str, Any]]:
        del query, flt
        return [
            {
                "score": 1.0,
                "payload": {
                    **(chunk.get("metadata") or {}),
                    "content": chunk.get("text", ""),
                    "chunk_id": chunk.get("chunk_id"),
                    "concept_id": chunk.get("concept_id"),
                },
            }
            for chunk in self.chunks[:top_k]
        ]

    def concepts_by_topic(
        self, topic: str, level_band: str | None = None, limit: int = 6
    ) -> list[dict[str, Any]]:
        del topic, level_band
        return [
            {
                "concept_id": chunk.get("concept_id"),
                "name": (chunk.get("metadata") or {}).get("concept") or chunk.get("title"),
                "topic": (chunk.get("metadata") or {}).get("topic"),
                "level_band": (chunk.get("metadata") or {}).get("level_band", "unrated"),
                "definition": _what_text(chunk.get("text", ""))[:400],
            }
            for chunk in self.chunks[:limit]
        ]


def _what_text(text: str) -> str:
    value = " ".join(str(text).split())
    if "WHAT:" in value:
        value = value.split("WHAT:", 1)[1].split("WHY IT MATTERS:", 1)[0]
    return value.strip()


def _topic_label(value: str) -> str:
    label = _PAGES_SUFFIX_RE.sub("", value).strip(" ,")
    label = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", label)
    label = re.sub(r"\s+", " ", label)
    label = re.sub(r"\s*,\s*", ", ", label)
    return label.strip(" ,")


def group_topics(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for chunk in chunks:
        metadata = chunk.get("metadata") or {}
        raw = str(metadata.get("topic") or metadata.get("concept") or chunk.get("title") or "")
        label = _topic_label(raw)
        section = _SECTION_RE.match(label)
        key = section.group(1) if section else _SAFE_RE.sub("", label).lower()
        if not key:
            continue
        label = _TOPIC_NAMES.get(key, label)
        group = grouped.setdefault(key, {"key": key, "topic": label, "chunks": []})
        group["chunks"].append(chunk)
        if len(label) > len(group["topic"]):
            group["topic"] = label
    return sorted(
        grouped.values(),
        key=lambda group: tuple(int(part) for part in group["key"].split("."))
        if "." in group["key"]
        else (999, group["key"]),
    )


def _validate_item(item: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    stem = str(item.get("stem") or "").strip()
    explanation = str(item.get("explanation") or "").strip()
    options = item.get("options") or []
    labels = [str(option.get("label") or "").strip() for option in options]
    if len(stem) < 20:
        issues.append("question stem is too short")
    if len(options) != 4:
        issues.append("question must have exactly four options")
    if len(set(labels)) != len(labels) or any(not label for label in labels):
        issues.append("options must be non-empty and unique")
    if sum(bool(option.get("is_correct")) for option in options) != 1:
        issues.append("question must have exactly one correct option")
    if len(explanation) < 20:
        issues.append("explanation is too short")
    for value in [stem, explanation, *labels]:
        latex_ok, latex_issues = validate_latex(value)
        if not latex_ok:
            issues.extend(latex_issues)
    return sorted(set(issues))


def _normalize_item(item: dict[str, Any]) -> dict[str, Any]:
    item["stem"] = normalize_latex(str(item.get("stem") or ""))
    item["explanation"] = normalize_latex(str(item.get("explanation") or ""))
    for option in item.get("options") or []:
        option["label"] = normalize_latex(str(option.get("label") or ""))
        if option.get("rationale") is not None:
            option["rationale"] = normalize_latex(str(option["rationale"]))
    return item


def _validate_wrapped(wrapped: dict[str, Any]) -> dict[str, Any]:
    question = wrapped.get("question") or {}
    data = question.get("question_data") or {}
    metadata = data.get("_meta") or {}
    issues: list[str] = []
    if not metadata.get("source_run_id"):
        issues.append("missing source run")
    if not metadata.get("source_chunk_ids"):
        issues.append("missing source chunks")
    if not metadata.get("source_pages"):
        issues.append("missing source pages")
    for value in [
        question.get("question_title") or "",
        question.get("explanation") or "",
        *[option.get("label") or "" for option in data.get("options") or []],
    ]:
        valid_latex, latex_issues = validate_latex(value)
        if not valid_latex:
            issues.extend(latex_issues)
    svg = question.get("question_svg") or ""
    if svg:
        valid_svg, svg_issues = validate_svg(svg)
        if not valid_svg:
            issues.extend(svg_issues)
    score = max(0, 100 - 20 * len(set(issues)))
    return {
        "question_id": question.get("id"),
        "topic": metadata.get("topic"),
        "status": "PASSED" if not issues and score >= 80 else "FAILED",
        "quality_score": score,
        "issues": sorted(set(issues)),
    }


def _wrapped_to_item(wrapped: dict[str, Any]) -> dict[str, Any]:
    question = wrapped["question"]
    data = question.get("question_data") or {}
    metadata = data.get("_meta") or {}
    return {
        "stem": question.get("question_title"),
        "options": [
            {
                "label": option.get("label"),
                "is_correct": option.get("is_correct"),
                "rationale": option.get("rationale"),
                "diagram": option.get("diagram"),
            }
            for option in data.get("options") or []
        ],
        "explanation": question.get("explanation"),
        "level_band": metadata.get("level_band"),
        "bloom_level": metadata.get("bloom_level"),
        "topic": metadata.get("topic"),
        "source": metadata.get("source"),
        "source_run_id": metadata.get("source_run_id"),
        "source_book_id": metadata.get("source_book_id"),
        "source_pages": metadata.get("source_pages") or [],
        "source_chunk_ids": metadata.get("source_chunk_ids") or [],
        "concept_ids": metadata.get("concept_ids") or [],
        "question_diagram": data.get("diagram"),
    }


def _source_gates(source_run: Path) -> dict[str, bool]:
    return {
        "document": bool(
            json.loads(
                resolve_artifact(source_run, "document_validation.json").read_text(
                    encoding="utf-8"
                )
            ).get("passed")
        ),
        "chunks": (
            json.loads(
                resolve_artifact(source_run, "chunk_quality_report.json").read_text(
                    encoding="utf-8"
                )
            ).get("approval_rate", 0)
            >= 0.8
        ),
        "retrieval": bool(
            json.loads(
                resolve_artifact(source_run, "retrieval_validation.json").read_text(
                    encoding="utf-8"
                )
            ).get("passed")
        ),
    }


def _generate_group(
    config: PipelineConfig,
    llm: Any,
    group: dict[str, Any],
    count: int,
    level: str,
    retries: int,
    source_run_id: str,
    quiz_id: str,
    quiz_title: str,
    created_at: str,
    seed_questions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    chunks = group["chunks"]
    generator = RagQuizGenerator(config, TopicRetriever(chunks), llm)
    concept_ids = sorted(
        {str(chunk.get("concept_id")) for chunk in chunks if chunk.get("concept_id")}
    )
    source_pages = sorted(
        {
            int(page)
            for chunk in chunks
            for page in ((chunk.get("metadata") or {}).get("source_pages") or [])
        }
    )
    source_chunk_ids = [
        str(chunk.get("chunk_id")) for chunk in chunks if chunk.get("chunk_id")
    ]
    source_book_ids = {
        str((chunk.get("metadata") or {}).get("book_id"))
        for chunk in chunks
        if (chunk.get("metadata") or {}).get("book_id")
    }
    accepted = [
        _normalize_item(_wrapped_to_item(wrapped))
        for wrapped in (seed_questions or [])[:count]
        if not _validate_item(_normalize_item(_wrapped_to_item(wrapped)))
    ]
    rejected: list[dict[str, Any]] = []
    seen = {
        re.sub(r"\s+", " ", str(item.get("stem") or "")).strip().lower()
        for item in accepted
    }
    repair_instructions: list[str] = []
    for attempt in range(1, retries + 2):
        remaining = count - len(accepted)
        if remaining <= 0:
            break
        exclusions = " | ".join(str(item.get("stem") or "")[:120] for item in accepted)
        prompt_topic = group["topic"]
        if exclusions:
            prompt_topic += (
                ". Generate new questions that do not repeat these existing stems: "
                f"{exclusions}"
            )
        try:
            items, context = generator.generate_topic(
                prompt_topic,
                query=group["topic"],
                level=level,
                count=remaining,
                repair_instructions=repair_instructions,
                concept_ids=concept_ids,
            )
        except (RuntimeError, ValueError) as exc:
            message = str(exc)
            rejected.append({"attempt": attempt, "issues": [message]})
            repair_instructions = [message]
            continue
        for item in items:
            item = _normalize_item(item)
            key = re.sub(r"\s+", " ", str(item.get("stem") or "")).strip().lower()
            if not key or key in seen:
                rejected.append({"attempt": attempt, "issues": ["duplicate question"]})
                continue
            seen.add(key)
            issues = _validate_item(item)
            if issues:
                rejected.append({"attempt": attempt, "stem": item.get("stem"), "issues": issues})
                repair_instructions = sorted(set(issues))
                continue
            item.update(
                {
                    "topic": group["topic"],
                    "source": f"rag:{source_run_id}:{group['key']}",
                    "source_run_id": source_run_id,
                    "source_book_id": next(iter(source_book_ids), None),
                    "source_pages": source_pages,
                    "source_chunk_ids": source_chunk_ids,
                    "concept_ids": concept_ids,
                }
            )
            accepted.append(item)
            if len(accepted) >= count:
                break
    wrapped = generator.adapt_items(
        accepted[:count],
        quiz_id=quiz_id,
        quiz_title=quiz_title,
        created_at=created_at,
    )
    return {
        "key": group["key"],
        "topic": group["topic"],
        "questions": wrapped,
        "requested": count,
        "generated": len(wrapped),
        "context_chunks": source_chunk_ids,
        "source_pages": source_pages,
        "rejected": rejected,
    }


def _safe_name(index: int, topic: str) -> str:
    slug = _SAFE_RE.sub("-", topic.lower()).strip("-")[:80]
    return f"{index:03d}-{slug or 'topic'}.json"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate five validated questions for every canonical topic in an approved run."
    )
    parser.add_argument("--source-run", type=Path, required=True)
    parser.add_argument(
        "--output-root",
        type=Path,
        default=_ROOT / "data" / "output" / "question-runs",
    )
    parser.add_argument("--run-id")
    parser.add_argument("--count", type=int, default=5)
    parser.add_argument(
        "--level",
        default="jee_main",
        choices=[
            "beginner",
            "intermediate",
            "advanced",
            "jee_main",
            "jee_advanced",
            "expert",
        ],
    )
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--no-persist", action="store_true")
    parser.add_argument(
        "--reuse-run",
        type=Path,
        help="Reuse already valid topic questions from a prior failed immutable run.",
    )
    parser.add_argument("--settings", type=Path)
    args = parser.parse_args()
    if args.count < 1 or args.workers < 1 or args.retries < 0:
        parser.error("--count and --workers must be positive; --retries cannot be negative")

    source_run = args.source_run.resolve()
    source_manifest = load_manifest(source_run)
    source_run_id = str(source_manifest.get("run_id") or source_run.name)
    gates = _source_gates(source_run)
    if not all(gates.values()):
        raise SystemExit(f"Question generation blocked by source validation gates: {gates}")

    chunks = json.loads(
        resolve_artifact(
            source_run, "retrieval_approved_chunk_repository.json"
        ).read_text(encoding="utf-8")
    )
    topics = group_topics(chunks)
    if not topics:
        raise SystemExit("No canonical topics were found in the approved source chunks.")

    config = PipelineConfig.load(args.settings)
    if config.resolved_provider() == "mock":
        raise SystemExit(
            "Question generation requires an LLM. Set KP_PROVIDER=local, droid, "
            "openai, or anthropic."
        )

    run_id, run_dir = create_run_directory(args.output_root, args.run_id)
    topic_dir = run_dir / "questions" / "topics"
    topic_dir.mkdir()
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    quiz_id = f"quiz-{uuid.uuid4().hex[:12]}"
    quiz_title = "Prilepko Mathematics Topic Question Bank"
    reusable: dict[str, list[dict[str, Any]]] = {}
    if args.reuse_run:
        reuse_run = args.reuse_run.resolve()
        reuse_manifest = load_manifest(reuse_run)
        if reuse_manifest.get("source_run_id") != source_run_id:
            raise SystemExit("--reuse-run must reference the same source pipeline run.")
        reuse_topics = reuse_run / "questions" / "topics"
        for path in reuse_topics.glob("*.json"):
            payload = json.loads(path.read_text(encoding="utf-8"))
            if payload.get("key"):
                reusable[str(payload["key"])] = list(payload.get("questions") or [])
    initial_manifest = {
        "run_id": run_id,
        "run_type": "topic_question_generation",
        "status": "running",
        "created_at": created_at,
        "source_run_id": source_run_id,
        "source_run": str(source_run),
        "source_validation": gates,
        "level_band": args.level,
        "questions_per_topic": args.count,
        "topic_count": len(topics),
        "expected_questions": len(topics) * args.count,
        "reused_from_run": str(args.reuse_run.resolve()) if args.reuse_run else None,
    }
    (run_dir / "manifest.json").write_text(
        json.dumps(initial_manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    llm = build_llm(config)
    results: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(
                _generate_group,
                config,
                llm,
                group,
                args.count,
                args.level,
                args.retries,
                source_run_id,
                quiz_id,
                quiz_title,
                created_at,
                reusable.get(group["key"], []),
            ): group
            for group in topics
        }
        for future in as_completed(futures):
            group = futures[future]
            try:
                result = future.result()
            except Exception as exc:
                result = {
                    "key": group["key"],
                    "topic": group["topic"],
                    "questions": [],
                    "requested": args.count,
                    "generated": 0,
                    "context_chunks": [
                        chunk.get("chunk_id") for chunk in group["chunks"]
                    ],
                    "source_pages": [],
                    "rejected": [{"issues": [str(exc)]}],
                }
            results[group["key"]] = result
            print(
                f"[questions] {group['key']} {group['topic']}: "
                f"{result['generated']}/{args.count}"
            )

    ordered = [results[group["key"]] for group in topics]
    questions: list[dict[str, Any]] = []
    validation_items: list[dict[str, Any]] = []
    order = 1
    for index, result in enumerate(ordered, start=1):
        for wrapped in result["questions"]:
            wrapped["question"]["sort_order"] = order
            questions.append(wrapped)
            validation_items.append(_validate_wrapped(wrapped))
            order += 1
        (topic_dir / _safe_name(index, result["topic"])).write_text(
            json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    failed_topics = [
        result["topic"] for result in ordered if result["generated"] != args.count
    ]
    failed_questions = [
        item["question_id"] for item in validation_items if item["status"] != "PASSED"
    ]
    passed = not failed_topics and not failed_questions
    question_set = {
        "quiz_id": quiz_id,
        "quiz_title": quiz_title,
        "topic": "Prilepko Mathematics Topics",
        "level_band": args.level,
        "subject": config.identity.subject,
        "class_level": config.identity.class_level,
        "source_run_id": source_run_id,
        "topic_count": len(topics),
        "questions_per_topic": args.count,
        "count": len(questions),
        "questions": questions,
    }
    (run_dir / "questions" / "question_set.json").write_text(
        json.dumps(question_set, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    validation_report = {
        "passed": passed,
        "expected_topics": len(topics),
        "completed_topics": len(topics) - len(failed_topics),
        "expected_questions": len(topics) * args.count,
        "generated_questions": len(questions),
        "failed_topics": failed_topics,
        "failed_questions": failed_questions,
        "questions": validation_items,
    }
    (run_dir / "validation" / "question_validation.json").write_text(
        json.dumps(validation_report, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    persisted = False
    if passed and not args.no_persist:
        persisted = Workflows(config=config, prefer_mcp=False).persist_quiz(question_set)
        if not persisted:
            passed = False
            validation_report["passed"] = False
            validation_report["persistence_error"] = True
            (run_dir / "validation" / "question_validation.json").write_text(
                json.dumps(validation_report, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )

    final_manifest = {
        **initial_manifest,
        "status": "completed" if passed else "failed",
        "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "generated_questions": len(questions),
        "completed_topics": len(topics) - len(failed_topics),
        "validation_passed": validation_report["passed"],
        "persisted": persisted,
        "files": {
            "question_set.json": "questions/question_set.json",
            "question_validation.json": "validation/question_validation.json",
            "topics": "questions/topics",
        },
    }
    (run_dir / "manifest.json").write_text(
        json.dumps(final_manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(
        f"[questions] run={run_dir} topics={len(topics)} "
        f"questions={len(questions)} passed={passed} persisted={persisted}"
    )
    return 0 if passed else 2


if __name__ == "__main__":
    raise SystemExit(main())
