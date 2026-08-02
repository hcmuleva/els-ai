"""LangGraph workflow definitions.

Each graph follows the target architecture:
    retrieve (via MCP)  ->  build_context  ->  generate (configured LLM / templates)
Quiz generation uses the deterministic template engine so diagrams, options and
correct answers stay mutually consistent; explanation and learning-path use the
configured LLM over the retrieved context.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from ..config import PipelineConfig
from ..generation import QuestionGenerator
from .context import Retriever, build_context
from .llm import LLM


class QuizState(TypedDict, total=False):
    topic: str
    level_band: str
    count: int
    concepts: List[Dict[str, Any]]
    vector_hits: List[Dict[str, Any]]
    context: Dict[str, Any]
    result: Dict[str, Any]


class ExplainState(TypedDict, total=False):
    query: str
    level_band: str
    top_k: int
    vector_hits: List[Dict[str, Any]]
    concepts: List[Dict[str, Any]]
    context: Dict[str, Any]
    result: Dict[str, Any]


class PathState(TypedDict, total=False):
    topic: str
    target_level: str
    concepts: List[Dict[str, Any]]
    prereqs: List[Dict[str, Any]]
    context: Dict[str, Any]
    result: Dict[str, Any]


class GraphFactory:
    def __init__(
        self,
        config: PipelineConfig,
        retriever: Retriever,
        llm: LLM,
        generator: Optional[QuestionGenerator] = None,
    ) -> None:
        self.config = config
        self.retriever = retriever
        self.llm = llm
        self.generator = generator or QuestionGenerator(config)

    # --------------------------------------------------------------- quiz
    def build_quiz(self):
        def retrieve(state: QuizState) -> QuizState:
            topic = state["topic"]
            level = state.get("level_band", "intermediate")
            return {
                "concepts": self.retriever.concepts_by_topic(topic, level_band=None, limit=15),
                "vector_hits": self.retriever.vector_search(topic, top_k=5),
            }

        def context(state: QuizState) -> QuizState:
            return {"context": build_context(state.get("vector_hits", []), state.get("concepts", []), [])}

        def generate(state: QuizState) -> QuizState:
            ctx = state.get("context", {})
            topic = ctx.get("topic") or state["topic"]
            quiz = self.generator.generate_quiz(
                topic=topic,
                level_band=state.get("level_band", "intermediate"),
                count=state.get("count", 3),
                concept_ids=ctx.get("concept_ids"),
            )
            quiz["context_used"] = bool(ctx.get("text"))
            return {"result": quiz}

        g = StateGraph(QuizState)
        g.add_node("retrieve", retrieve)
        g.add_node("build_context", context)
        g.add_node("generate", generate)
        g.add_edge(START, "retrieve")
        g.add_edge("retrieve", "build_context")
        g.add_edge("build_context", "generate")
        g.add_edge("generate", END)
        return g.compile()

    # -------------------------------------------------------- explanation
    def build_explanation(self):
        def retrieve(state: ExplainState) -> ExplainState:
            q = state["query"]
            return {
                "vector_hits": self.retriever.vector_search(q, top_k=state.get("top_k", 5)),
                "concepts": self.retriever.concepts_by_topic(q, limit=5),
            }

        def context(state: ExplainState) -> ExplainState:
            return {"context": build_context(state.get("vector_hits", []), state.get("concepts", []), [])}

        def generate(state: ExplainState) -> ExplainState:
            ctx = state.get("context", {})
            prompt = (
                "You are a mathematics teacher. Using ONLY the context, explain the answer to the "
                f"student question clearly and step by step.\n\nQuestion: {state['query']}\n\n"
                f"Context:\n{ctx.get('text', '(no context retrieved)')}\n\nExplanation:"
            )
            explanation = self.llm.complete(prompt)
            return {
                "result": {
                    "query": state["query"],
                    "explanation": explanation,
                    "topic": ctx.get("topic"),
                    "sources": [h.get("payload", {}).get("chunk_id") for h in state.get("vector_hits", [])],
                    "context_used": bool(ctx.get("text")),
                }
            }

        g = StateGraph(ExplainState)
        g.add_node("retrieve", retrieve)
        g.add_node("build_context", context)
        g.add_node("generate", generate)
        g.add_edge(START, "retrieve")
        g.add_edge("retrieve", "build_context")
        g.add_edge("build_context", "generate")
        g.add_edge("generate", END)
        return g.compile()

    # ------------------------------------------------------ learning path
    def build_learning_path(self):
        def retrieve(state: PathState) -> PathState:
            topic = state["topic"]
            concepts = self.retriever.concepts_by_topic(topic, limit=15)
            prereqs: List[Dict[str, Any]] = []
            if concepts:
                prereqs = self.retriever.prerequisites(concepts[0]["concept_id"])
            return {"concepts": concepts, "prereqs": prereqs}

        def context(state: PathState) -> PathState:
            return {"context": build_context([], state.get("concepts", []), state.get("prereqs", []))}

        def generate(state: PathState) -> PathState:
            ctx = state.get("context", {})
            prereq_order = [p.get("name") for p in state.get("prereqs", [])]
            prompt = (
                "You are a curriculum designer. Using the context, produce an ordered learning path "
                f"toward mastering the topic '{state['topic']}' at level "
                f"'{state.get('target_level', 'advanced')}'. List steps from foundational to advanced.\n\n"
                f"Context:\n{ctx.get('text', '(no context)')}\n\nLearning path:"
            )
            narrative = self.llm.complete(prompt)
            return {
                "result": {
                    "topic": state["topic"],
                    "target_level": state.get("target_level", "advanced"),
                    "prerequisite_order": prereq_order,
                    "concepts": [c.get("name") for c in state.get("concepts", [])],
                    "narrative": narrative,
                    "context_used": bool(ctx.get("text")),
                }
            }

        g = StateGraph(PathState)
        g.add_node("retrieve", retrieve)
        g.add_node("build_context", context)
        g.add_node("generate", generate)
        g.add_edge(START, "retrieve")
        g.add_edge("retrieve", "build_context")
        g.add_edge("build_context", "generate")
        g.add_edge("generate", END)
        return g.compile()
