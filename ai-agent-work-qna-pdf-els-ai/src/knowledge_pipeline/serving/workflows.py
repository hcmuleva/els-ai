"""High-level workflow facade. This is what the kp-workflows MCP server and the
CLI call to trigger the LangGraph graphs."""
from __future__ import annotations

from typing import Any, Dict, Optional

from ..config import PipelineConfig
from ..generation import QuestionGenerator
from .context import Retriever, build_retriever
from .graph import GraphFactory
from .llm import LLM, build_llm


class Workflows:
    def __init__(
        self,
        config: Optional[PipelineConfig] = None,
        retriever: Optional[Retriever] = None,
        llm: Optional[LLM] = None,
        prefer_mcp: bool = True,
    ) -> None:
        self.config = config or PipelineConfig.load()
        self.retriever = retriever or build_retriever(self.config, prefer_mcp=prefer_mcp)
        self.llm = llm or build_llm(self.config)
        self.factory = GraphFactory(
            self.config, self.retriever, self.llm, QuestionGenerator(self.config)
        )
        self._quiz = None
        self._explain = None
        self._path = None

    def generate_quiz(
        self, topic: str, level_band: str = "intermediate", count: int = 3, persist: bool = False
    ) -> Dict[str, Any]:
        if self._quiz is None:
            self._quiz = self.factory.build_quiz()
        state = self._quiz.invoke({"topic": topic, "level_band": level_band, "count": count})
        result = state["result"]
        if persist:
            result["persisted"] = self._persist_quiz(result)
        return result

    def generate_explanation(self, query: str, top_k: int = 5, level_band: str = "intermediate") -> Dict[str, Any]:
        if self._explain is None:
            self._explain = self.factory.build_explanation()
        state = self._explain.invoke({"query": query, "top_k": top_k, "level_band": level_band})
        return state["result"]

    def generate_learning_path(self, topic: str, target_level: str = "advanced") -> Dict[str, Any]:
        if self._path is None:
            self._path = self.factory.build_learning_path()
        state = self._path.invoke({"topic": topic, "target_level": target_level})
        return state["result"]

    def persist_quiz(self, quiz: Dict[str, Any]) -> bool:
        """Public wrapper: write a quiz (target-schema) to the relational store."""
        return self._persist_quiz(quiz)

    # ---------------------------------------------------------------- persist
    def _persist_quiz(self, quiz: Dict[str, Any]) -> bool:
        try:
            from ..stores import build_relational_store

            pg = build_relational_store(self.config.stores.postgres_dsn)
            quiz_id = quiz.get("quiz_id") or f"quiz_{abs(hash(quiz.get('topic', ''))) % (10**10)}"
            questions, options_by_q = [], {}
            for wrapped in quiz["questions"]:
                q = wrapped["question"]
                questions.append(
                    {
                        "question_id": q["id"],
                        "quiz_id": quiz_id,
                        "concept_id": (q["question_data"]["_meta"].get("concept_ids") or [None])[0],
                        "question_type": q["question_type"],
                        "level_band": q["question_data"]["_meta"].get("level_band"),
                        "bloom_level": q["question_data"]["_meta"].get("bloom_level"),
                        "stem": q["question_title"],
                        "explanation": q.get("explanation"),
                        "svg": q.get("question_svg"),
                        "diagram": q["question_data"].get("diagram"),
                        "metadata": {
                            "instruction": q.get("question_instruction"),
                            "topic": q["question_data"]["_meta"].get("topic"),
                            "source_run_id": q["question_data"]["_meta"].get(
                                "source_run_id"
                            ),
                            "source_book_id": q["question_data"]["_meta"].get(
                                "source_book_id"
                            ),
                            "source_pages": q["question_data"]["_meta"].get(
                                "source_pages", []
                            ),
                            "source_chunk_ids": q["question_data"]["_meta"].get(
                                "source_chunk_ids", []
                            ),
                        },
                    }
                )
                options_by_q[q["id"]] = [
                    {
                        "option_id": o["id"] + "_" + q["id"][:8],
                        "question_id": q["id"],
                        "position": o.get("slot_position", 1),
                        "text": o["label"],
                        "is_correct": o["is_correct"],
                        "svg": o.get("svg"),
                        "diagram": o.get("diagram"),
                        "rationale": o.get("rationale"),
                    }
                    for o in q["question_data"]["options"]
                ]
            pg.insert_quiz(
                {
                    "quiz_id": quiz_id,
                    "book_id": None,
                    "title": quiz.get("quiz_title", "Question Bank"),
                    "subject": quiz.get("subject"),
                    "class_level": quiz.get("class_level"),
                    "level_band": quiz.get("level_band"),
                    "creator_id": self.config.identity.creator_id,
                    "organization_id": self.config.identity.organization_id,
                    "metadata": {
                        "topic": quiz.get("topic"),
                        "source_run_id": quiz.get("source_run_id"),
                        "diagram_mode": quiz.get("diagram_mode", "auto"),
                    },
                },
                questions,
                options_by_q,
            )
            return True
        except Exception as exc:
            print(f"[workflows] quiz persist skipped: {exc}")
            return False
