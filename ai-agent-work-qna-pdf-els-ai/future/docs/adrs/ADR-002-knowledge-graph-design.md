# ADR-002: Knowledge Graph Design

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

ULIP must represent educational knowledge across school, university, professional, and experiential domains. Retrieval similarity alone cannot answer prerequisite, dependency, progression, misconception, transfer, or curriculum-alignment questions. The platform therefore needs a graph that supports learning paths, composite assessments, context expansion, gap analysis, and explanations of why content was selected.

The graph is extracted from imperfect source material and may combine multiple books. It must not present inferred relationships as unquestionable facts. At the same time, operating a separate graph database would duplicate identity, authorization, backup, and operational controls already required for relational metadata.

## Decision

ULIP will use a **versioned, property-graph domain model persisted in PostgreSQL adjacency tables**, with deterministic graph analytics performed in processing jobs and recursive SQL used for bounded online traversal.

### Nodes

The primary semantic node is a canonical `Concept`. Concepts have stable identifiers, preferred and alternate labels, concept type, definition, subject and topic scope, difficulty and level profile, provenance, confidence, lifecycle state, and version. The typed graph also includes competencies, learning objectives, curricula and standards, misconceptions, assessment items, learning resources, evidence spans, and public people or works. These entities retain authoritative relational records and are projected as graph nodes without being collapsed into the concept table.

Concept identity is tenant-scoped. Automatic matching may propose equivalence, but merging concepts requires deterministic evidence thresholds or approval. A merge preserves aliases and redirects so citations and generated assets remain resolvable.

### Edges

The controlled semantic edge vocabulary is `prerequisite_of`, `part_of`, `is_a`, `related_to`, `contrasts_with`, `causes`, `explains`, `applies_to`, `example_of`, `misconception_of`, `teaches`, `measures`, `requires`, `aligned_with`, `supported_by`, and `supersedes`.

The canonical graph artifact uses educational direction. For example, `A prerequisite_of B` means A is learned before B. Each edge is a versioned assertion and records source, target, type, scope, conditions, confidence, strength, derivation method, evidence references, valid interval, creator or model identity, and review state. Symmetric relations use canonical endpoint order and are stored once.

The PostgreSQL traversal projection optimizes prerequisite lookup by storing `source_id = dependent` and `target_id = prerequisite` under the private physical relation type `prerequisite`. The projection adapter performs this single documented inversion from `prerequisite_of`. Canonical assertion records and public graph APIs retain prerequisite-to-dependent direction. Intent-level serving APIs hide the private traversal projection so clients never construct traversal SQL from storage assumptions.

### Governance and Analytics

Graph publication is append-and-supersede. Invalid edges are retired, not silently overwritten. Inferred edges remain distinguishable from source-stated and reviewer-approved edges. Only active, authorized, minimum-confidence edges are exposed in learner-facing workflows.

Offline jobs calculate degree, betweenness, PageRank, prerequisite depth, cycle reports, and connected components against a pinned graph version. Metrics are features, not truth. They are never the sole basis for high-stakes recommendations.

Online traversals are bounded by depth, result count, tenant, lifecycle state, and authorization. Learning-path traversal excludes cycles and follows reviewed prerequisite edges. Composite question construction requires a connected subgraph and retains the path that justified the bundle.

## Decision Drivers

- Explicit prerequisite and dependency reasoning
- Evidence-backed, explainable educational recommendations
- Stable concept identity across multiple sources
- Clear separation of facts, inferences, and review decisions
- Bounded operational complexity
- Efficient tenant-scoped traversal and filtering
- Support for offline analytics and online serving
- Compatibility with relational lineage and assessment records

## Detailed Design Implications

Extraction first emits document-scoped concepts and candidate edges. Entity resolution then compares normalized labels, definitions, subject scope, level, and neighborhood. Ambiguous candidates remain separate and receive a possible-match record. Cross-tenant concepts are not merged unless a shared catalog has been explicitly licensed and authorized.

Edges cannot refer to missing or retired nodes. Schema constraints enforce identifiers and vocabulary values. Publication validation checks self-loops, duplicates, confidence ranges, provenance completeness, and relation-specific direction. Prerequisite cycles are not accepted into the learning-path projection. A cycle report identifies the evidence and weakest edge for review; ULIP does not remove one silently.

All graph-derived outputs carry `graph_version`. Rebuilding a graph creates a new immutable artifact and updates the active version atomically after validation. Serving caches include tenant, graph version, policy version, relation set, and traversal bounds in their key.

The graph service exposes intent-level operations such as `get_prerequisites`, `get_dependents`, `get_related_concepts`, `explain_path`, and `build_learning_subgraph`. These operations return evidence and edge confidence. Raw SQL access is restricted to trusted internal components.

## Alternatives Considered

### Neo4j or another dedicated graph database

Rejected for the initial production architecture because ULIP's online traversals are bounded and fit recursive PostgreSQL queries. A separate graph database would duplicate tenancy, authorization, operations, backups, and consistency controls. The domain model remains portable if future measured workloads justify a graph projection.

### RDF and a triple store as the primary model

Rejected because ontology reasoning and open-world semantics add complexity not required by current product queries. The controlled property graph provides simpler confidence, provenance, lifecycle, and assessment links.

### Store graph data only in JSON artifacts

Rejected because online traversal, concurrent publication, constraints, authorization, and incremental correction would be inefficient and fragile.

### Treat vector similarity as graph edges

Rejected because similarity does not establish prerequisite, causality, hierarchy, or theory-application semantics. Similarity may propose candidates but cannot publish a typed relationship without evidence and validation.

### Automatically merge concepts with similar names

Rejected because terms are curriculum- and domain-dependent. Incorrect merges contaminate retrieval, learning paths, and assessments across sources.

## Consequences

### Positive

- Learning paths and retrieval expansion are explicit and explainable.
- Graph, metadata, lineage, and authorization share one transactional store.
- Inferred relationships retain provenance and confidence.
- Graph versions make generated outputs reproducible.
- A dedicated graph engine can be added later as a derived projection without changing semantics.

### Negative

- PostgreSQL is less expressive than a graph query language for complex exploratory traversals.
- Canonical and query-oriented prerequisite directions require a carefully tested adapter.
- Entity resolution and graph review introduce workflow and storage overhead.
- Offline metric recomputation is required after material graph changes.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Incorrect prerequisite edges produce harmful learning paths | Require evidence, confidence thresholds, cycle checks, reviewer overrides, and path explanations |
| Direction is misinterpreted between artifact and database | Centralize the inversion in one adapter, expose intent-level APIs, and maintain direction conformance tests |
| Dense inferred relationships make traversal noisy | Cap candidate edges, calibrate by relation type, filter by confidence, and monitor degree distributions |
| Concept merges corrupt historical references | Use immutable merge records, aliases, redirects, and reversible canonicalization |
| Recursive queries cause resource exhaustion | Enforce depth and row limits, indexed endpoints and relation types, statement timeouts, and query budgets |
| Centrality is mistaken for educational importance | Label metrics as derived features and combine them with curriculum, evidence, and reviewer signals |

## Compliance and Security Implications

Every node and edge carries tenant and authorization scope through its owning entities. Traversal must apply row-level authorization before expansion to prevent graph-neighbor leakage. Shared catalog nodes are read-only and have explicit licensing and jurisdiction metadata.

Provenance identifies source documents, processing version, model or rule, reviewer action, and timestamp. Learner analytics are not embedded as concept properties; personal mastery and accommodations remain in a separately protected domain linked through opaque identifiers. Erasure of licensed or personal source material retires affected evidence and triggers graph republishing.

## Validation Measures

- Referential integrity, vocabulary, confidence, provenance, and lifecycle constraints pass before publication.
- Prerequisite projections are acyclic, or explicitly quarantined from learning-path use.
- Canonical-to-physical direction tests verify prerequisite and dependent queries in both directions.
- Golden learning paths are compared with subject-matter-expert judgments.
- Entity-resolution precision and recall are measured on labeled cross-source concept pairs.
- Degree, component size, edge-type distribution, orphan rate, and cycle count are monitored by graph version.
- Traversal load tests verify depth limits, tenant isolation, latency budgets, and statement timeouts.
- Every generated path or composite assessment can return the graph version and supporting edge evidence.

## Related Architecture

- [Educational Ontology](../architecture/04_educational_ontology.md)
- [Knowledge Graph Architecture](../architecture/09_knowledge_graph_architecture.md)
- [PostgreSQL Design](../architecture/15_postgres_design.md)
- [RAG Architecture](../architecture/16_rag_architecture.md)
