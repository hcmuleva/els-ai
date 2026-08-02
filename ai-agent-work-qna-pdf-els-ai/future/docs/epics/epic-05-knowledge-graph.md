# Epic 05: Knowledge Graph

## Goal

Build a versioned, tenant-isolated educational knowledge graph that connects approved concepts, learning objectives, competencies, prerequisites, misconceptions, sources, and curriculum nodes. The graph must support explainable traversal, graph quality validation, and reproducible analytics through relational persistence and bounded recursive queries.

## Business and User Value

- Learners receive prerequisite-aware explanations and learning sequences.
- Educators can inspect how concepts, objectives, competencies, and misconceptions relate.
- Curriculum teams can measure coverage, gaps, and dependency structure.
- Assessment services can select valid single-concept and multi-concept targets.
- Institutions can audit every node and edge back to source evidence or an accountable reviewer.

## Scope

### In Scope

- Typed nodes for concepts, objectives, competencies, skills, outcomes, misconceptions, curriculum nodes, source assets, and governed composite concepts.
- Typed directed edges for `prerequisite_of`, `depends_on`, `part_of`, `related_to`, `supports_objective`, `develops_competency`, `assessed_by`, `has_misconception`, `aligned_to`, and `evidenced_by`.
- Edge confidence, weight, direction, review status, evidence, and validity interval.
- Immutable graph snapshots assembled from approved knowledge revisions and edge candidates.
- Validation of referential integrity, allowed node-edge combinations, self-loops, duplicate edges, prerequisite cycles, orphan nodes, and conflicting direction.
- Explainable bounded traversal using tenant-filtered recursive SQL queries.
- Shortest prerequisite paths, neighborhood expansion, curriculum coverage, orphan detection, and impact analysis.
- Snapshot-scoped degree, weighted degree, PageRank, and betweenness metrics.
- Human review, edge correction, merge and split propagation, and graph snapshot activation.
- Import and export in a versioned, implementation-neutral graph contract.

### Out of Scope

- Source parsing, semantic chunk construction, and embedding generation.
- Silent creation of concepts or claims not approved by Knowledge Intelligence.
- Unbounded arbitrary graph queries from clients.
- Cross-tenant graph traversal.
- A separate graph database in the initial implementation.
- Learner-specific mastery state inside the canonical content graph.

## Personas

- **Learner:** follows an explainable prerequisite path toward a target concept.
- **Educator:** explores concept relationships and reviews questionable edges.
- **Curriculum designer:** analyzes standard coverage, gaps, and progression.
- **Assessment designer:** selects related concepts and misconceptions for valid items.
- **Knowledge steward:** governs edge proposals and graph snapshot activation.
- **Platform operator:** monitors graph integrity, traversal performance, and rebuilds.
- **Downstream service:** performs bounded, version-pinned graph queries.

## User Stories

### 1. Evidence-backed graph assembly

As a knowledge steward, I want approved entities and edge proposals assembled into a graph snapshot so that downstream services use a coherent relationship set.

**Testable outcomes**

1. Every node resolves to one approved entity revision in the selected knowledge snapshot.
2. Every edge includes type, direction, source and target, confidence, provenance, and review status.
3. Invalid node-edge type combinations and dangling references block graph activation.

### 2. Prerequisite traversal

As a learner, I want to see which concepts I should understand before a target so that I can close knowledge gaps in a sensible order.

**Testable outcomes**

1. The traversal accepts maximum depth, edge-type allowlist, result limit, and graph snapshot.
2. Each returned path lists ordered nodes, edges, evidence, and cumulative weight.
3. Prerequisite paths contain no cycles and never cross tenant or authorization scope.

### 3. Curriculum coverage

As a curriculum designer, I want to identify standards with missing or weak concept coverage so that content investment can be prioritized.

**Testable outcomes**

1. Coverage reports identify the curriculum version and selected graph snapshot.
2. Direct and inferred coverage are reported separately with path explanations.
3. Low-confidence or unapproved paths are excluded by default and can be requested only by authorized reviewers.

### 4. Multi-concept assessment support

As an assessment designer, I want bounded concept neighborhoods so that advanced items combine concepts with an educationally valid relationship.

**Testable outcomes**

1. The query declares permitted edge types, depth, target level, and maximum concepts.
2. Results expose why each concept is included and which objective or competency connects the set.
3. No relationship candidate lacking active approval is returned for production item generation.

### 5. Graph quality review

As an educator, I want to review cycles, orphans, contradictory edges, and low-confidence proposals so that the graph does not encode misleading learning sequences.

**Testable outcomes**

1. Findings are grouped by stable reason code and severity.
2. Reviewer decisions create successor edge revisions and preserve original evidence.
3. Resolving a finding triggers validation of the affected neighborhood before publication.

### 6. Versioned activation and impact

As a platform operator, I want a candidate graph compared and activated atomically so that consumers never observe mixed relationship versions.

**Testable outcomes**

1. Comparison reports nodes and edges added, removed, revised, merged, split, and affected.
2. Impact analysis lists dependent chunks, indexes, assessments, and paths through event contracts.
3. Rollback selects the prior immutable snapshot without rebuilding it.

### 7. Explainable graph analytics

As a curriculum designer, I want centrality and gap metrics tied to a snapshot so that prioritization is reproducible rather than opaque.

**Testable outcomes**

1. Every metric records algorithm, parameters, implementation version, and graph snapshot.
2. Repeated deterministic analytics produce equal results within the declared numeric tolerance.
3. Analytics never alter source edge weights or approval state.

## Acceptance Criteria

1. One hundred percent of active nodes contain tenant, stable entity ID, selected entity revision, node type, approval status, and knowledge snapshot; one hundred percent of active edges contain tenant, edge revision, type, direction, source, target, confidence, weight, evidence, and review status.
2. Graph activation fails if any active edge has a missing endpoint, cross-tenant endpoint, disallowed node-edge type combination, invalid weight, missing evidence, or incompatible knowledge revision.
3. The active `prerequisite_of` and `depends_on` subgraph is acyclic. Every detected cycle appears as a blocking validation finding with the complete cycle path.
4. Duplicate active edges with the same tenant, type, source revision, target revision, and semantic qualifier are prevented by a database constraint or equivalent transactional control.
5. On an expert-adjudicated edge benchmark, approved relationship extraction reaches precision of at least 0.92 and recall of at least 0.82; prerequisite direction accuracy is at least 0.95.
6. A bounded traversal over a production-sized tenant graph of 1 million edges completes within 250 ms at p95 for depth at most 3 and limit at most 100, excluding citation hydration.
7. Every client traversal requires an edge-type allowlist, maximum depth of 5 or less, result limit of 500 or less, timeout, tenant scope, and explicit or active graph snapshot.
8. Tenant-isolation tests cover nodes, edges, recursive queries, analytics tables, caches, exports, reviewer queues, and aggregate counts and show zero unauthorized disclosure.
9. Snapshot activation is atomic. In 10,000 concurrent read/activation tests, every traversal returns nodes, edges, and analytics from one graph snapshot.
10. Graph analytics are reproducible within an absolute tolerance of `1e-9` for the same ordered input, parameters, and implementation version.
11. Every returned path includes ordered node IDs, edge IDs, snapshot ID, cumulative score, and authorized evidence references sufficient to explain its selection.
12. Incremental graph rebuild produces the same affected nodes, edges, validations, and metrics as a full rebuild for the same knowledge snapshot.
13. A knowledge merge, split, archival, or deletion event is reflected in a candidate graph within 15 minutes at p95 and cannot activate until dependent edges are resolved.
14. Failed validation publishes no active snapshot and leaves the prior snapshot readable.
15. Export and import round-trip preserves 100% of node and edge identities, revisions, types, weights, evidence references, and snapshot metadata in the compatibility suite.

## Deliverables

- Versioned graph node, edge, snapshot, traversal, analytics, finding, import, and export schemas.
- Relational graph persistence with tenant-keyed constraints and indexes.
- Snapshot assembler and incremental impact planner consuming approved knowledge events.
- Graph validation engine with typed blocking and warning rules.
- Bounded recursive-query service for paths, neighborhoods, coverage, and impact.
- Deterministic degree, weighted degree, PageRank, and betweenness jobs.
- Review APIs and queues for relationship proposals and graph findings.
- Snapshot comparison, activation, rollback, retention, import, and export tooling.
- Versioned graph proposal, validation, activation, and retirement events.
- Expert edge benchmark, query correctness tests, cycle fixtures, load tests, and isolation tests.
- Operator and knowledge-governance runbooks.

## Dependencies

- Epic 01 supplies source and provenance identities.
- Epic 02 supplies approved entity revisions and relationship candidates.
- Relational metadata store with recursive common table expressions, transactions, indexes, and tenant controls.
- Identity, authorization, taxonomy, event, audit, feature-flag, and immutable manifest services.
- Epic 03 uses graph relationships for governed composite chunks.
- Epic 04 uses bounded graph expansion in retrieval.
- Epic 07 and Epic 08 use concepts, objectives, competencies, and misconceptions.
- Epic 09 uses prerequisite paths while retaining learner state outside the canonical graph.

## Architecture and ADR Links

- [ULIP architecture documentation](../architecture/)
- [ULIP architecture decision records](../adrs/)
- [Epic 02: Knowledge Intelligence](epic-02-knowledge-intelligence.md)
- [Epic 03: Adaptive Chunking Engine](epic-03-adaptive-chunking-engine.md)
- [Epic 04: Contextual Retrieval](epic-04-contextual-retrieval.md)

The implementation must follow architecture contracts for the relational metadata plane, immutable snapshots, and bounded serving APIs. Controlling ADR topics are relational graph persistence, typed evidence-backed edges, separation of content graph and learner state, acyclic prerequisites, and transactional snapshot activation.

## Data and Security Considerations

- Include `tenant_id` in primary and foreign keys or enforce an equivalent database policy that makes cross-tenant edges structurally impossible.
- Apply authorization before traversal and citation hydration; filter-by-result alone is insufficient.
- Treat relationship proposals from models and imported files as untrusted until schema, provenance, confidence, and approval validation succeeds.
- Keep personally identifiable learner data and individual mastery events out of the canonical graph. Learner-specific overlays reference graph node IDs from a separate protected store.
- Propagate source rights, residency, retention, legal hold, and deletion lineage to evidence-backed nodes and edges.
- Exports require scoped authorization, encryption, audit logging, and a manifest of included snapshots and rights.
- Protect traversal endpoints with depth, result, time, and cost limits to prevent resource exhaustion and graph enumeration.
- Avoid source labels, paths, evidence text, and tenant counts in logs or metrics.

## Observability

- Track active and proposed nodes and edges by type, status, confidence band, source, subject, and graph version.
- Measure validation findings, cycles, orphans, duplicate proposals, reviewer decisions, snapshot age, rebuild duration, and event lag.
- Measure traversal latency, recursion depth, rows visited, result count, timeout rate, cache hit rate, and citation-hydration latency.
- Trace knowledge event consumption, impact planning, assembly, validation, analytics, activation, and traversal using content-free identifiers.
- Alert on any cross-tenant integrity attempt, active prerequisite cycle, dangling active edge, activation failure, p95 traversal above 250 ms, or event lag above 15 minutes.
- Provide dashboards for graph health, quality, coverage, centrality drift, query performance, storage growth, and candidate-to-active differences.

## Rollout and Migration

1. Freeze graph schemas, allowed edge matrix, expert benchmark, and query fixtures.
2. Build graph snapshots from internal approved knowledge and adjudicate relationship quality.
3. Shadow-write relational nodes and edges while existing relationship consumers remain unchanged.
4. Replay bounded query fixtures and compare paths, latency, and curriculum coverage.
5. Enable read-only exploration for internal users, then pilot tenants, with explicit snapshot pinning.
6. Migrate legacy relationships as proposed revisions, attach verifiable evidence, and route unsupported or cyclic edges to review.
7. Enable downstream retrieval, chunking, assessment, and learning-path consumers one at a time after contract tests.
8. Roll back by changing the active snapshot pointer and pausing candidate activation; retain immutable candidate data for diagnosis.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Incorrect prerequisites create harmful learning sequences | Require direction confidence, expert benchmark gates, cycle validation, and review for ambiguous edges. |
| Recursive queries exhaust database capacity | Require bounded depth and result counts, add tenant-keyed indexes, enforce timeouts, and monitor rows visited. |
| Entity revisions leave dangling edges | Assemble against one knowledge snapshot and block activation on referential mismatch. |
| Graph analytics are mistaken for educational truth | Expose algorithms and parameters, separate analytics from approved facts, and require human interpretation. |
| Model proposals create dense noisy graphs | Calibrate for precision, cap edge types per purpose, and keep proposals separate from active edges. |
| Cross-tenant graph edges leak content | Make tenant identity part of relational constraints and test recursive paths and aggregates. |
| Migration invents provenance for legacy edges | Mark unsupported relationships as proposals and require evidence or reviewer attestation before activation. |

## Definition of Done

- Node, edge, snapshot, traversal, validation, analytics, and lifecycle contracts are versioned and documented.
- All acceptance criteria pass with retained expert, correctness, isolation, performance, import, and recovery evidence.
- Security review confirms structural tenant isolation, bounded queries, export controls, learner-data separation, and deletion propagation.
- Epics 03, 04, 07, 08, and 09 pass graph contract and pinned-snapshot integration tests.
- Full and incremental rebuilds, failed activation, migration, and rollback are rehearsed in a production-like environment.
- Dashboards, alerts, SLOs, capacity plans, quality review cadence, ownership, and runbooks are operational.
- Pilot tenants remain within quality, consistency, and latency gates for seven consecutive days.
- Product, curriculum, graph, data, security, and operations owners approve general availability.
