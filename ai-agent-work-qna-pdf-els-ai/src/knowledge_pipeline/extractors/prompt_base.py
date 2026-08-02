"""Shared prompt-driven extractor logic.

Any backend that can turn a prompt into text (OpenAI/Anthropic, or Droid via
`droid exec`) implements a single `_complete` method; all semantic extraction
methods are shared here and fall back to the heuristic extractor on any failure.
"""
from __future__ import annotations

import json
import re
from abc import abstractmethod
from typing import Any

from . import prompts
from .base import KnowledgeExtractor
from .heuristic import HeuristicExtractor

_JSON_BLOCK_RE = re.compile(r"\{.*\}|\[.*\]", re.DOTALL)
_LEVEL_BANDS = {"beginner", "intermediate", "advanced", "jee_main", "jee_advanced", "expert"}


class PromptExtractor(KnowledgeExtractor):
    name = "prompt"

    def __init__(self) -> None:
        self._fallback = HeuristicExtractor()

    # ------------------------------------------------------ backend contract
    @abstractmethod
    def _complete(self, user_prompt: str) -> str:
        """Return the raw model response for a prompt (system prompt applied by backend)."""

    def _complete_json(self, user_prompt: str) -> Any:
        raw = self._complete(user_prompt)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            match = _JSON_BLOCK_RE.search(raw)
            if match:
                return json.loads(match.group(0))
            raise

    # ----------------------------------------------------------- interface
    def classify_book(self, title: str, sample_text: str) -> dict:
        try:
            data = self._complete_json(
                prompts.CLASSIFY_BOOK.format(title=title, sample=sample_text[:6000])
            )
            return {
                "subject": data.get("subject", "General Studies"),
                "curriculum": data.get("curriculum", "Higher Education"),
                "domain": data.get("domain", "General"),
            }
        except Exception:
            return self._fallback.classify_book(title, sample_text)

    def page_value(self, text: str) -> dict:
        try:
            data = self._complete_json(prompts.PAGE_VALUE.format(text=text[:6000]))
            return {
                "value_class": data.get("value_class", "MEDIUM"),
                "categories": list(data.get("categories", [])),
                "noise_reasons": list(data.get("noise_reasons", [])),
            }
        except Exception:
            return self._fallback.page_value(text)

    def distill_units(
        self, book_id: str, chapter_index: int, chapter_title: str, text: str
    ) -> list[dict]:
        try:
            data = self._complete_json(
                prompts.DISTILL.format(chapter_title=chapter_title, text=text[:12000])
            )
            units = data.get("units", []) if isinstance(data, dict) else data
            cleaned = [self._coerce_unit(u, chapter_title) for u in units if u.get("concept")]
            return cleaned or self._fallback.distill_units(
                book_id, chapter_index, chapter_title, text
            )
        except Exception:
            return self._fallback.distill_units(book_id, chapter_index, chapter_title, text)

    def misconceptions(self, concept_name: str, definition: str) -> list[dict]:
        try:
            data = self._complete_json(
                prompts.MISCONCEPTIONS.format(concept=concept_name, definition=definition[:1000])
            )
            items = data.get("misconceptions", []) if isinstance(data, dict) else data
            out = [
                {
                    "misconception": i.get("misconception", ""),
                    "explanation": i.get("explanation", ""),
                    "correction": i.get("correction", ""),
                }
                for i in items
                if i.get("misconception")
            ]
            return out or self._fallback.misconceptions(concept_name, definition)
        except Exception:
            return self._fallback.misconceptions(concept_name, definition)

    def assess_level(self, payload: dict) -> dict:
        try:
            supporting = " | ".join(
                (payload.get("facts") or []) + (payload.get("formulae") or [])
            )[:1200]
            data = self._complete_json(
                prompts.ASSESS_LEVEL.format(
                    concept=payload.get("concept_name", ""),
                    concept_type=payload.get("concept_type", ""),
                    topic=payload.get("topic", ""),
                    prerequisite_depth=payload.get("prerequisite_depth", 0),
                    definition=payload.get("definition", "")[:1500],
                    supporting=supporting,
                )
            )
            band = str(data.get("level_band", "")).strip().lower()
            if band not in _LEVEL_BANDS:  # off-ladder -> do not fabricate
                return self._fallback.assess_level(payload)
            return {
                "level_band": band,
                "intrinsic_difficulty": data.get("intrinsic_difficulty", "medium"),
                "reasoning_level": data.get("reasoning_level", ""),
                "steps_required": int(data.get("steps_required", 1) or 1),
                "concepts_combined": int(data.get("concepts_combined", 1) or 1),
                "confidence": float(data.get("confidence", 0.6) or 0.6),
                "rationale": data.get("rationale", ""),
            }
        except Exception:
            return self._fallback.assess_level(payload)

    def generate_question(self, spec: dict) -> dict | None:
        try:
            concepts = spec.get("concepts") or []
            if not concepts:
                return None
            concepts_block = "\n".join(
                f"- {c['name']}: {c.get('definition', '')}"
                + (f" (e.g. {c['examples'][0]})" if c.get("examples") else "")
                for c in concepts
            )
            misc_block = (
                "\n".join(f"- {m}" for m in (spec.get("misconceptions") or [])) or "- (none)"
            )
            mode = (
                "This is a MULTI-CONCEPT problem: fuse the concepts into a single multi-step item."
                if spec.get("composite")
                else "This is a single-concept item."
            )
            data = self._complete_json(
                prompts.GENERATE_QUESTION.format(
                    level_band=spec.get("level_band", "intermediate"),
                    bloom_level=spec.get("bloom_level", "Apply"),
                    assessment_type=spec.get("assessment_type", "MCQ"),
                    mode_instruction=mode,
                    concepts_block=concepts_block,
                    misconceptions_block=misc_block,
                )
            )
            if not data.get("stem"):
                return None
            return {
                "stem": data.get("stem", ""),
                "options": list(data.get("options", []) or []),
                "correct_answer": data.get("correct_answer", ""),
                "distractors": list(data.get("distractors", []) or []),
                "worked_solution": data.get("worked_solution", ""),
                "source": self.name,
            }
        except Exception:
            return self._fallback.generate_question(spec)

    @staticmethod
    def _coerce_unit(u: dict, chapter_title: str) -> dict:
        def as_list(v: Any) -> list[str]:
            if isinstance(v, list):
                return [str(x) for x in v if x]
            if isinstance(v, str) and v.strip():
                return [v.strip()]
            return []

        return {
            "topic": u.get("topic") or chapter_title,
            "subtopic": u.get("subtopic") or u.get("concept", ""),
            "concept": u.get("concept", ""),
            "definition": u.get("definition", ""),
            "examples": as_list(u.get("examples")),
            "frameworks": as_list(u.get("frameworks")),
            "processes": as_list(u.get("processes")),
            "formulae": as_list(u.get("formulae")),
            "case_studies": as_list(u.get("case_studies")),
            "facts": as_list(u.get("facts")),
        }
