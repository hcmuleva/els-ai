"""Ontology, graph, and supplemental repository builders."""
from __future__ import annotations

from collections import Counter

import networkx as nx

from ..models import (
    AssessmentProfile,
    CompetencyRecord,
    Concept,
    KnowledgeGraph,
    LearningObjective,
    Misconception,
)
from ..utils import stable_id


def build_ontology(
    concepts: list[Concept],
    competencies: list[CompetencyRecord],
    assessments: list[AssessmentProfile],
    misconceptions: list[Misconception],
) -> dict:
    entities: list[dict] = []
    for concept in concepts:
        entities.append(
            {
                "entity_id": concept.concept_id,
                "entity_type": concept.concept_type.value,
                "name": concept.concept_name,
                "book_id": concept.book_id,
                "source_pages": concept.source_pages,
            }
        )
        for index, formula in enumerate(concept.formulae):
            entities.append(
                {
                    "entity_id": stable_id("formula", concept.concept_id, index),
                    "entity_type": "Formula",
                    "name": formula,
                    "concept_id": concept.concept_id,
                    "book_id": concept.book_id,
                    "source_pages": concept.source_pages,
                }
            )
        for index, example in enumerate(concept.examples):
            entities.append(
                {
                    "entity_id": stable_id("example", concept.concept_id, index),
                    "entity_type": "Example",
                    "name": example,
                    "concept_id": concept.concept_id,
                    "book_id": concept.book_id,
                    "source_pages": concept.source_pages,
                }
            )
    entities.extend(
        {
            "entity_id": item.competency_id,
            "entity_type": "Competency",
            "name": item.skill,
            "concept_id": item.concept_id,
        }
        for item in competencies
    )
    entities.extend(
        {
            "entity_id": stable_id("assessment", item.concept_id),
            "entity_type": "Assessment",
            "name": ", ".join(item.recommended_types),
            "concept_id": item.concept_id,
        }
        for item in assessments
    )
    entities.extend(
        {
            "entity_id": item.misconception_id,
            "entity_type": "Misconception",
            "name": item.misconception,
            "concept_id": item.concept_id,
        }
        for item in misconceptions
    )
    return {
        "entities": entities,
        "entity_type_counts": dict(sorted(Counter(item["entity_type"] for item in entities).items())),
    }


def validate_graph(graph: KnowledgeGraph, concepts: list[Concept]) -> dict:
    directed = nx.DiGraph()
    directed.add_nodes_from(node.id for node in graph.nodes)
    directed.add_edges_from((edge.source, edge.target) for edge in graph.edges)
    undirected = directed.to_undirected()
    isolates = sorted(nx.isolates(undirected))
    components = sorted(
        (sorted(component) for component in nx.connected_components(undirected)),
        key=len,
        reverse=True,
    ) if undirected.number_of_nodes() else []
    prerequisite = nx.DiGraph()
    prerequisite.add_nodes_from(directed.nodes)
    prerequisite.add_edges_from(
        (edge.source, edge.target)
        for edge in graph.edges
        if edge.relation.value == "prerequisite_dependent"
    )
    cycles = [cycle for cycle in nx.simple_cycles(prerequisite)]
    labels = Counter(node.label.strip().lower() for node in graph.nodes)
    duplicates = sorted(label for label, count in labels.items() if count > 1)
    missing_parents = [
        concept.concept_id
        for concept in concepts
        if concept.prerequisites
        and not any(edge.target == concept.concept_id for edge in graph.edges)
    ]
    weak_edges = [
        {"source": edge.source, "target": edge.target, "relation": edge.relation.value}
        for edge in graph.edges
        if edge.weight < 0.45
    ]
    node_count = directed.number_of_nodes()
    connected_count = node_count - len(isolates)
    coverage = connected_count / node_count if node_count else 0.0
    density = nx.density(directed) if node_count > 1 else 0.0
    passed = (
        coverage >= 0.95
        and not duplicates
        and not cycles
        and not missing_parents
    )
    return {
        "passed": passed,
        "target_connectivity": 0.95,
        "metrics": {
            "nodes": node_count,
            "edges": directed.number_of_edges(),
            "density": round(density, 6),
            "connectivity": round(coverage, 4),
            "coverage": round(coverage, 4),
            "components": len(components),
        },
        "orphan_nodes": isolates,
        "duplicate_concepts": duplicates,
        "circular_prerequisites": cycles,
        "weak_relationships": weak_edges,
        "missing_parents": missing_parents,
        "disconnected_clusters": components[1:],
    }


def build_formula_repository(concepts: list[Concept]) -> list[dict]:
    return [
        {
            "formula_id": stable_id("formula", concept.concept_id, index),
            "expression": formula,
            "variables": [],
            "concepts": [concept.concept_id],
            "source_book": concept.book_id,
            "source_pages": concept.source_pages,
        }
        for concept in concepts
        for index, formula in enumerate(concept.formulae)
    ]


def build_figure_repository(document_structure: dict) -> list[dict]:
    figures: list[dict] = []
    for book in document_structure["books"]:
        for page in book["pages"]:
            for index, figure in enumerate(page["figures"]):
                figures.append(
                    {
                        "figure_id": stable_id("figure", book["book_id"], page["page"], index),
                        "caption": figure["caption"],
                        "description": figure["description"],
                        "concepts": [],
                        "page": page["page"],
                        "source_book": book["book_id"],
                        "reference": figure["reference"],
                    }
                )
    return figures


def build_learning_paths(concepts: list[Concept]) -> list[dict]:
    by_id = {concept.concept_id: concept for concept in concepts}
    return [
        {
            "concept": concept.concept_id,
            "prerequisites": concept.prerequisites,
            "next_concepts": [
                other.concept_id
                for other in concepts
                if concept.concept_id in other.prerequisites
            ],
            "recommended_sequence": [
                *concept.prerequisites,
                concept.concept_id,
                *[
                    related
                    for related in concept.related_concepts
                    if related in by_id and related not in concept.prerequisites
                ][:3],
            ],
        }
        for concept in concepts
    ]


def enrich_embedding_metadata(
    chunks,
    embedding_units,
    *,
    concepts: list[Concept],
    objectives: list[LearningObjective],
    competencies: list[CompetencyRecord],
    assessments: list[AssessmentProfile],
    graph: KnowledgeGraph,
    inventory,
) -> None:
    concept_by_id = {concept.concept_id: concept for concept in concepts}
    subject_by_book = {book.book_id: book.subject for book in inventory.books}
    objectives_by_concept: dict[str, list[str]] = {}
    for objective in objectives:
        objectives_by_concept.setdefault(objective.concept_id, []).append(objective.bloom_level.value)
    competencies_by_concept: dict[str, list[str]] = {}
    for competency in competencies:
        competencies_by_concept.setdefault(competency.concept_id, []).append(competency.skill)
    assessments_by_concept = {
        assessment.concept_id: assessment.recommended_types for assessment in assessments
    }
    neighbors: dict[str, list[str]] = {}
    for edge in graph.edges:
        neighbors.setdefault(edge.source, []).append(edge.target)
        neighbors.setdefault(edge.target, []).append(edge.source)

    for record in [*chunks, *embedding_units]:
        concept = concept_by_id.get(record.concept_id)
        if not concept:
            continue
        pages = sorted(set(concept.source_pages))
        record.metadata.update(
            {
                "subject": subject_by_book.get(concept.book_id, ""),
                "concept": concept.concept_name,
                "bloom": sorted(set(objectives_by_concept.get(concept.concept_id, []))),
                "competencies": sorted(set(competencies_by_concept.get(concept.concept_id, []))),
                "prerequisites": concept.prerequisites,
                "formulae": concept.formulae,
                "graph_neighbors": sorted(set(neighbors.get(concept.concept_id, []))),
                "assessment_types": assessments_by_concept.get(concept.concept_id, []),
                "source_book": concept.book_id,
                "page_range": f"{pages[0]}-{pages[-1]}" if pages else "",
            }
        )
