"""Phase 9 - Knowledge Graph.

Builds a directed concept graph with typed edges (parent/child, cause/effect,
prerequisite/dependent, theory/application, related) plus node weight, edge
weight, and centrality scores (degree, betweenness, pagerank).
"""
from __future__ import annotations

import re

import networkx as nx

from ..models import (
    Concept,
    ConceptType,
    GraphCentrality,
    GraphEdge,
    GraphNode,
    KnowledgeGraph,
    RelationType,
)

_CAUSE_RE = re.compile(r"\b(causes|leads to|results in|produces|drives|triggers)\b", re.IGNORECASE)
_EDGE_WEIGHT = {
    RelationType.PREREQUISITE_DEPENDENT: 1.0,
    RelationType.PARENT_CHILD: 0.9,
    RelationType.CAUSE_EFFECT: 0.8,
    RelationType.THEORY_APPLICATION: 0.7,
    RelationType.RELATED: 0.5,
}
_APPLICATION_TYPES = {
    ConceptType.CASE_STUDY,
    ConceptType.PROCESS,
    ConceptType.PROCEDURE,
    ConceptType.FORMULA,
}
_THEORY_TYPES = {ConceptType.THEORY, ConceptType.PRINCIPLE, ConceptType.MODEL}


def run(concepts: list[Concept]) -> KnowledgeGraph:
    by_id = {c.concept_id: c for c in concepts}
    nodes = [
        GraphNode(
            id=c.concept_id,
            label=c.concept_name,
            concept_type=c.concept_type.value,
            weight=round(c.importance_score, 3),
            difficulty=c.difficulty.value,
        )
        for c in concepts
    ]

    edges: list[GraphEdge] = []
    seen: set[tuple[str, str, str]] = set()

    def add_edge(src: str, dst: str, rel: RelationType) -> None:
        if src == dst:
            return
        key = (src, dst, rel.value)
        if key in seen:
            return
        seen.add(key)
        w = _EDGE_WEIGHT[rel]
        if dst in by_id:
            w = round(w * (0.5 + 0.5 * by_id[dst].confidence_score), 3)
        edges.append(GraphEdge(source=src, target=dst, relation=rel, weight=w))

    # topic buckets for parent/child
    by_topic: dict[str, list[Concept]] = {}
    for c in concepts:
        by_topic.setdefault(c.topic.lower(), []).append(c)

    for c in concepts:
        for prereq in c.prerequisites:
            add_edge(prereq, c.concept_id, RelationType.PREREQUISITE_DEPENDENT)

        blob = " ".join([c.definition] + c.facts + c.examples)
        cause = _CAUSE_RE.search(blob) is not None

        for rel_id in c.related_concepts:
            if rel_id in c.prerequisites:
                continue
            other = by_id.get(rel_id)
            if not other:
                continue
            if c.concept_type in _THEORY_TYPES and other.concept_type in _APPLICATION_TYPES:
                add_edge(c.concept_id, rel_id, RelationType.THEORY_APPLICATION)
            elif cause and re.search(rf"\b{re.escape(other.concept_name.lower())}\b", blob.lower()):
                add_edge(c.concept_id, rel_id, RelationType.CAUSE_EFFECT)
            else:
                add_edge(c.concept_id, rel_id, RelationType.RELATED)

    # parent/child: the most foundational, important concept anchors each topic
    for topic_concepts in by_topic.values():
        if len(topic_concepts) < 2:
            continue
        anchor = min(
            topic_concepts,
            key=lambda x: (_diff_rank(x), -x.importance_score),
        )
        for child in topic_concepts:
            if child.concept_id != anchor.concept_id:
                add_edge(anchor.concept_id, child.concept_id, RelationType.PARENT_CHILD)

    centrality = _centrality(nodes, edges)
    return KnowledgeGraph(nodes=nodes, edges=edges, centrality=centrality)


def _diff_rank(c: Concept) -> int:
    order = {"foundational": 0, "intermediate": 1, "advanced": 2}
    return order.get(c.difficulty.value, 1)


def _centrality(nodes: list[GraphNode], edges: list[GraphEdge]) -> list[GraphCentrality]:
    g = nx.DiGraph()
    for n in nodes:
        g.add_node(n.id)
    for e in edges:
        g.add_edge(e.source, e.target, weight=e.weight)

    if g.number_of_nodes() == 0:
        return []

    degree = nx.degree_centrality(g)
    try:
        betweenness = nx.betweenness_centrality(g, weight="weight")
    except Exception:
        betweenness = {n: 0.0 for n in g.nodes}
    try:
        pagerank = nx.pagerank(g, weight="weight")
    except Exception:
        pagerank = {n: 1.0 / g.number_of_nodes() for n in g.nodes}

    return [
        GraphCentrality(
            concept_id=n.id,
            degree=round(degree.get(n.id, 0.0), 4),
            betweenness=round(betweenness.get(n.id, 0.0), 4),
            pagerank=round(pagerank.get(n.id, 0.0), 4),
        )
        for n in nodes
    ]
