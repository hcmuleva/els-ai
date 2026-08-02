"""Deterministic diagnosis for concepts rejected by retrieval validation."""
from __future__ import annotations

from typing import Any


class RetrievalValidationImprover:
    """Explain retrieval failures without overriding the validation gate."""

    def diagnose(self, result: dict[str, Any]) -> dict[str, Any]:
        rejected = [
            self._diagnose_query(query)
            for query in result.get("queries", [])
            if not query.get("accepted", False)
        ]
        return {
            "rejected_concepts": len(rejected),
            "diagnostics": rejected,
            "policy": (
                "Recommendations may improve a future immutable run; only the "
                "deterministic per-concept gate can approve chunks for storage."
            ),
        }

    def _diagnose_query(self, query: dict[str, Any]) -> dict[str, Any]:
        causes: list[str] = []
        actions: list[str] = []
        expected_count = len(query.get("expected_chunks") or [])
        top_k = len(query.get("retrieved_chunks") or [])
        if query.get("mrr", 0) == 0:
            causes.append("query_alignment")
            actions.append("Rewrite the representative query from the concept definition.")
        if expected_count > top_k:
            causes.append("over_fragmentation")
            actions.append("Merge redundant chunks or increase retrieval depth for this concept.")
        if query.get("precision_at_k", 0) < 0.4:
            causes.append("concept_overlap")
            actions.append("Add concept-specific terminology and remove cross-topic duplication.")
        if query.get("ndcg", 0) < 0.6:
            causes.append("ranking_confusion")
            actions.append("Strengthen the chunk title and leading definition used for embedding.")
        if not causes:
            causes.append("insufficient_recall")
            actions.append("Review chunk boundaries and representative-query specificity.")
        return {
            "concept_id": query.get("concept_id"),
            "causes": causes,
            "recommended_actions": actions,
            "metrics": {
                "capped_recall_at_k": query.get("capped_recall_at_k"),
                "precision_at_k": query.get("precision_at_k"),
                "mrr": query.get("mrr"),
                "ndcg": query.get("ndcg"),
            },
        }
