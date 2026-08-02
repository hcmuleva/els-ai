"""Validated RAG question generation shared by CLI and HTTP interfaces."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from ..assessment.validation import normalize_latex, validate_latex
from ..config import PipelineConfig
from ..diagram.catalog import supported_diagram_types
from ..stores import build_relational_store
from ..topic_labels import clean_topic_label
from ..validators import QuizValidator
from .context import DirectRetriever
from .llm import build_llm
from .rag_quiz import RagQuizGenerator
from .workflows import Workflows

_LEVELS = {
    "very_easy",
    "easy",
    "moderate",
    "difficult",
    "very_difficult",
}
_LEVEL_ALIASES = {
    "beginner": "very_easy",
    "intermediate": "moderate",
    "advanced": "difficult",
    "jee_main": "difficult",
    "jee_advanced": "very_difficult",
    "expert": "very_difficult",
}
_DIAGRAM_MODES = {"auto", "diagram_only"}
_GENERATION_PROFILES = {"standard", "jee_geometry_complex"}
_COMPLEX_GEOMETRY_FAMILIES = {
    "triangle-geometry",
    "circle-geometry",
    "solid-geometry",
}


class QuestionGenerationError(RuntimeError):
    pass


def _normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def normalize_generated_item(item: dict[str, Any]) -> dict[str, Any]:
    for field in ("stem", "explanation"):
        if isinstance(item.get(field), str):
            item[field] = normalize_latex(item[field])
    for option in item.get("options") or []:
        for field in ("label", "rationale"):
            if isinstance(option.get(field), str):
                option[field] = normalize_latex(option[field])
    return item


def validate_generated_item(item: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    stem = str(item.get("stem", "")).strip()
    options = list(item.get("options") or [])
    if not stem:
        issues.append("empty stem")
    if len(options) != 4:
        issues.append("question must contain exactly four options")
    labels = [_normalized(str(option.get("label", ""))) for option in options]
    if any(not label for label in labels):
        issues.append("option labels must be non-empty")
    if len(labels) != len(set(labels)):
        issues.append("option labels must be unique")
    correct = sum(1 for option in options if option.get("is_correct"))
    if correct != 1:
        issues.append("question must contain exactly one correct option")
    if not str(item.get("explanation", "")).strip():
        issues.append("explanation is required")
    for value in [stem, str(item.get("explanation", "")), *labels]:
        valid, latex_issues = validate_latex(value)
        if not valid:
            issues.extend(latex_issues)
    return sorted(set(issues))


def validate_complex_geometry_item(
    item: dict[str, Any],
    diagram_families: list[str],
) -> list[str]:
    diagram = item.get("question_diagram")
    if not diagram:
        return ["complex geometry questions require a valid controlled diagram"]
    raw = diagram.model_dump() if hasattr(diagram, "model_dump") else diagram
    kind = str(raw.get("kind") or "").casefold()
    issues: list[str] = []
    if diagram_families and kind not in diagram_families:
        issues.append(
            f"diagram kind {kind!r} is not one of the requested geometry families"
        )
    elements = list(raw.get("elements") or [])
    structural = [
        element
        for element in elements
        if element.get("type")
        in {
            "segment",
            "polygon",
            "circle",
            "angle",
            "right-angle",
            "tick-mark",
            "parallel-mark",
            "dimension",
        }
    ]
    labels = {
        str(element.get("label") or element.get("text") or "").strip()
        for element in elements
        if str(element.get("label") or element.get("text") or "").strip()
    }
    if len(structural) < 5:
        issues.append(
            "complex geometry diagrams require at least five structural elements"
        )
    if len(labels) < 3:
        issues.append(
            "complex geometry diagrams require at least three labeled points or relations"
        )
    return issues


class QuestionGenerationService:
    def __init__(
        self,
        config: PipelineConfig,
        retriever: Any | None = None,
        llm: Any | None = None,
        relational: Any | None = None,
    ) -> None:
        self.config = config
        self.retriever = retriever
        self.llm = llm
        self.relational = relational

    def generate(
        self,
        *,
        class_level: str | None = None,
        subject: str | None = None,
        topic: str | None = None,
        query: str = "",
        level_band: str = "moderate",
        count: int = 5,
        source_run_id: str | None = None,
        diagram_mode: str = "auto",
        question_style: str = "standard",
        generation_profile: str = "standard",
        diagram_families: list[str] | None = None,
        persist: bool = False,
        max_attempts: int = 5,
    ) -> dict[str, Any]:
        class_level = class_level.strip() if class_level else None
        topic = topic.strip() if topic else None
        requested_subject = subject.strip() if subject else None
        if not topic and not requested_subject:
            raise ValueError("subject or topic is required")
        subject = requested_subject or self.config.identity.subject
        level_band = _LEVEL_ALIASES.get(level_band, level_band)
        if level_band not in _LEVELS:
            raise ValueError(f"unsupported level_band: {level_band}")
        if diagram_mode not in _DIAGRAM_MODES:
            raise ValueError(f"unsupported diagram_mode: {diagram_mode}")
        if generation_profile not in _GENERATION_PROFILES:
            raise ValueError(
                f"unsupported generation_profile: {generation_profile}"
            )
        diagram_families = list(dict.fromkeys(diagram_families or []))
        unsupported_families = sorted(
            set(diagram_families) - set(supported_diagram_types())
        )
        if unsupported_families:
            raise ValueError(
                "unsupported diagram families: "
                + ", ".join(unsupported_families)
            )
        if generation_profile == "jee_geometry_complex":
            if diagram_mode != "diagram_only":
                raise ValueError(
                    "jee_geometry_complex requires diagram_mode='diagram_only'"
                )
            if level_band not in {"difficult", "very_difficult", "jee_main", "jee_advanced", "expert"}:
                raise ValueError(
                    "jee_geometry_complex requires a higher difficulty level"
                )
            if not diagram_families:
                diagram_families = sorted(_COMPLEX_GEOMETRY_FAMILIES)
        if count < 1 or count > 50:
            raise ValueError("count must be between 1 and 50")
        if max_attempts < 1 or max_attempts > 5:
            raise ValueError("max_attempts must be between 1 and 5")
        provider = self.config.resolved_provider()
        if provider == "mock":
            raise QuestionGenerationError(
                "No LLM is configured. Set KP_PROVIDER=local, droid, openai, or anthropic."
            )

        retriever = self.retriever or DirectRetriever(self.config)
        relational = self.relational or build_relational_store(
            self.config.stores.postgres_dsn
        )
        if topic:
            selected_topics = [topic]
            selected_run_ids = [source_run_id] if source_run_id else []
            selected_book_ids: list[str] = []
            concept_rows = relational.concepts_by_topic(
                topic,
                limit=8,
                source_run_id=source_run_id,
            )
            generation_scope = topic
            retrieval_filter: dict[str, Any] = {"topic": topic}
            if subject:
                retrieval_filter["subject"] = subject
            if source_run_id:
                retrieval_filter["run_id"] = source_run_id
        else:
            catalog_rows = relational.catalog_topics(
                class_level=class_level,
                subject=subject,
                source_run_id=source_run_id,
                limit=500,
            )
            selected_topics = list(dict.fromkeys(
                row["topic"] for row in catalog_rows if row.get("topic")
            ))
            selected_run_ids = list(dict.fromkeys(
                row["source_run_id"]
                for row in catalog_rows
                if row.get("source_run_id")
            ))
            selected_book_ids = list(dict.fromkeys(
                book_id
                for row in catalog_rows
                for book_id in row.get("book_ids", [])
                if book_id
            ))
            if not selected_topics or not selected_run_ids:
                run_scope = f" in source run '{source_run_id}'" if source_run_id else ""
                raise ValueError(
                    f"No persisted topics were found for subject '{subject}'{run_scope}."
                )
            concept_rows = relational.concepts_by_subject(
                subject,
                limit=200,
                source_run_ids=selected_run_ids,
            )
            generation_scope = (
                f"{subject}, across all embedded topics: "
                + ", ".join(selected_topics)
            )
            retrieval_filter = {
                "subject": subject,
                "topic": selected_topics,
            }
            if source_run_id:
                retrieval_filter["run_id"] = source_run_id
        concept_ids = [
            row["concept_id"] for row in concept_rows if row.get("concept_id")
        ]
        generator = RagQuizGenerator(
            self.config, retriever, self.llm or build_llm(self.config)
        )
        generation_context = generator.retrieve_context(
            generation_scope,
            query=query,
            retrieval_filter=retrieval_filter,
        )
        if not generation_context.get("source_chunk_ids"):
            scope = f" for source run '{source_run_id}'" if source_run_id else ""
            raise QuestionGenerationError(
                f"No approved vector context was found for '{generation_scope}'{scope}."
            )
        stem_validator = QuizValidator()
        accepted: list[dict[str, Any]] = []
        seen_stems: set[str] = set()
        rejected: list[dict[str, Any]] = []
        contexts: list[dict[str, Any]] = []
        repair_feedback: list[str] = []
        for attempt in range(1, max_attempts + 1):
            remaining = count - len(accepted)
            if remaining <= 0:
                break
            requested_batch = remaining if attempt == 1 else min(remaining + 1, 50)
            try:
                items, context = generator.generate_topic(
                    generation_scope,
                    query=query,
                    level=level_band,
                    count=requested_batch,
                    prefer_diagrams=diagram_families,
                    diagram_only=diagram_mode == "diagram_only",
                    subject=subject,
                    class_level=class_level,
                    question_style=question_style,
                    generation_profile=generation_profile,
                    repair_instructions=repair_feedback[-12:],
                    concept_ids=concept_ids,
                    retrieval_filter=retrieval_filter,
                    require_context=True,
                    context=generation_context,
                )
            except Exception as exc:
                rejected.append(
                    {
                        "attempt": attempt,
                        "stem": "",
                        "issues": [f"generation failed: {exc}"],
                    }
                )
                continue
            contexts.append(context)
            for item in items:
                item = normalize_generated_item(item)
                item["subject"] = subject
                if class_level:
                    item["class_level"] = class_level
                item["topic"] = clean_topic_label(item.get("topic"), subject)
                issues = validate_generated_item(item)
                if diagram_mode == "diagram_only" and not item.get(
                    "question_diagram"
                ):
                    issues.append(
                        "diagram-only mode requires a valid, meaningful diagram"
                    )
                if generation_profile == "jee_geometry_complex":
                    issues.extend(
                        validate_complex_geometry_item(item, diagram_families)
                    )
                stem_key = _normalized(str(item.get("stem", "")))
                if stem_key in seen_stems:
                    issues.append("duplicate stem")
                validation_report = None
                if not issues:
                    candidate = generator.adapt_items(
                        [item],
                        "candidate-validation",
                        "Candidate Validation",
                        None,
                    )
                    if not candidate:
                        issues.append("target schema adaptation failed")
                    else:
                        validation_report = stem_validator.validate_question(
                            candidate[0],
                            quiz_subject=subject,
                            require_diagram=diagram_mode == "diagram_only",
                        )
                        if (
                            validation_report["decision"] not in {"accept", "repair_required"}
                            or validation_report.get("overall_status") == "fail"
                        ):
                            repair_feedback.extend(
                                str(repair)
                                for repair in validation_report[
                                    "repair_instructions"
                                ]
                            )
                            repair_feedback = list(
                                dict.fromkeys(repair_feedback)
                            )
                            for check_name, check in validation_report[
                                "checks"
                            ].items():
                                if check["status"] == "fail":
                                    issues.extend(
                                        f"{check_name}: {issue}"
                                        for issue in check.get("issues", [])
                                    )
                            if not issues:
                                issues.append(
                                    "STEM validation decision: "
                                    + validation_report["decision"]
                                )
                if issues:
                    repair_feedback.extend(sorted(set(issues)))
                    repair_feedback = list(dict.fromkeys(repair_feedback))
                    rejection = {
                        "attempt": attempt,
                        "stem": str(item.get("stem", ""))[:240],
                        "issues": sorted(set(issues)),
                    }
                    if validation_report:
                        rejection["validation_report"] = validation_report
                    rejected.append(rejection)
                    continue
                seen_stems.add(stem_key)
                accepted.append(item)
                if len(accepted) == count:
                    break

        if not accepted:
            raise QuestionGenerationError(
                f"Generated 0 of {count} valid questions after "
                f"{max_attempts} attempts."
            )

        quiz_id = f"quiz-{uuid.uuid4().hex[:12]}"
        created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        title = (
            f"{topic} {'Diagram ' if diagram_mode == 'diagram_only' else ''}Questions"
            if topic
            else (
                f"{subject} All Topics "
                f"{'Diagram ' if diagram_mode == 'diagram_only' else ''}Questions"
            )
        )
        wrapped = generator.adapt_items(
            accepted, quiz_id, title, created_at
        )
        if not wrapped:
            raise QuestionGenerationError(
                "No validated questions passed schema adaptation."
            )
        final_questions: list[dict[str, Any]] = []
        question_reports: list[dict[str, Any]] = []
        for question in wrapped:
            report = stem_validator.validate_question(
                question,
                quiz_subject=subject,
                require_diagram=diagram_mode == "diagram_only",
            )
            if report["decision"] in {"accept", "repair_required"} and report.get("overall_status") != "fail":
                final_questions.append(question)
                question_reports.append(report)
            else:
                rejected.append(
                    {
                        "attempt": "final",
                        "stem": str(
                            question["question"].get("question_title", "")
                        )[:240],
                        "issues": report["critical_failures"]
                        or ["final STEM validation requires repair"],
                        "validation_report": report,
                    }
                )
        wrapped = final_questions
        if not wrapped:
            raise QuestionGenerationError(
                "No generated questions passed final STEM validation."
            )
        partial = len(wrapped) < count

        source_chunk_ids = sorted(
            {
                chunk_id
                for context in contexts
                for chunk_id in context.get("source_chunk_ids", [])
            }
        )
        source_pages = sorted(
            {
                page
                for context in contexts
                for page in context.get("source_pages", [])
                if isinstance(page, int)
            }
        )
        result = {
            "quiz_id": quiz_id,
            "quiz_title": title,
            "topic": topic,
            "topics": selected_topics,
            "scope": "topic" if topic else "subject",
            "query": query,
            "level_band": level_band,
            "subject": subject,
            "class_level": class_level or self.config.identity.class_level,
            "provider": provider,
            "model": (
                self.config.local_llm_model if provider == "local" else None
            ),
            "source_run_id": source_run_id,
            "source_run_ids": selected_run_ids,
            "source_book_ids": selected_book_ids,
            "diagram_mode": diagram_mode,
            "generation_profile": generation_profile,
            "diagram_families": diagram_families,
            "requested_count": count,
            "count": len(wrapped),
            "context_used": any(context.get("text") for context in contexts),
            "source_chunk_ids": source_chunk_ids,
            "source_pages": source_pages,
            "validation": {
                "passed": True,
                "complete": not partial,
                "partial": partial,
                "attempts": len(contexts),
                "accepted": len(wrapped),
                "rejected": len(rejected),
                "message": (
                    f"Generated {len(wrapped)} of {count} requested valid questions."
                    if partial
                    else f"Generated all {count} requested valid questions."
                ),
                "rules": (["exact_count"] if not partial else [])
                + (
                    ["valid_meaningful_diagram"]
                    if diagram_mode == "diagram_only"
                    else []
                )
                + (
                    ["complex_jee_geometry"]
                    if generation_profile == "jee_geometry_complex"
                    else []
                )
                + [
                    "non_empty_stem",
                    "exactly_four_unique_options",
                    "exactly_one_correct_option",
                    "explanation_required",
                    "latex_balanced",
                    "target_schema_valid",
                    "metadata_consistency",
                    "answer_key_consistency",
                    "physics_formula_consistency",
                    "diagram_concept_match",
                    "required_visual_objects",
                    "required_labels_values_units",
                    "svg_schema_valid",
                    "layout_readable",
                    "placeholder_free",
                ],
            },
            "question_validation_reports": question_reports,
            "questions": wrapped,
        }
        if persist:
            result["persisted"] = Workflows(
                config=self.config, prefer_mcp=False
            ).persist_quiz(result)
        return result
