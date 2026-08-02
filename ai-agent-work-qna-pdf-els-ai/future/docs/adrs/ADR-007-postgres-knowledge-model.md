# ADR-007: PostgreSQL Knowledge Model

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

ULIP needs an authoritative model for documents, provenance, concepts, graph relationships, chunk hierarchy, vector projections, educational objectives, competencies, misconceptions, assessments, and agent workflow records. These records have strong integrity requirements and evolve independently. The platform must support tenant isolation, source correction, replay, audit, deletion, and bounded graph traversal.

Neither JSON files nor the vector store can provide the required transactional boundaries, relational constraints, authorization policy, and lineage. At the same time, forcing all evolving educational metadata into wide tables would create frequent migrations and brittle ingestion.

## Decision

ULIP will use **PostgreSQL as the authoritative transactional knowledge and workflow store**, with a normalized core, immutable version records, constrained JSONB extensions, row-level security, and an outbox for derived projections.

### Identity and Tenancy

Every tenant-owned table includes `tenant_id`. Natural educational labels are never primary keys. Stable UUIDs identify logical entities; immutable version UUIDs identify a particular representation. Foreign keys include tenant scope so a relationship cannot cross tenants accidentally.

Shared catalog content resides under designated catalog tenants and is exposed through explicit entitlement mappings. It is not copied into or implicitly joined with customer tenants.

### Core Domains

The schema is organized into these domains:

- **Sources:** `documents`, `document_versions`, `document_sections`, `source_blocks`, `source_assets`, and parsing manifests
- **Knowledge:** `concepts`, `concept_versions`, `concept_aliases`, `concept_evidence`, `learning_objectives`, `competencies`, and `misconceptions`
- **Graph:** `concept_edges` and `concept_edge_versions`
- **Retrieval:** `retrieval_units`, `retrieval_unit_sources`, `retrieval_hierarchy`, `vector_projections`, and `index_outbox`
- **Assessment:** `assessment_blueprints`, `assessment_items`, `assessment_item_versions`, `options`, `rubric_criteria`, `item_evidence`, `validation_runs`, and `review_decisions`
- **Workflow:** `workflow_runs`, `workflow_steps`, `artifacts`, `approval_events`, and idempotency records
- **Governance:** entitlements, policy labels, retention state, deletion tombstones, model and prompt versions, and audit events

Logical entities store stable identity and current lifecycle state. Version tables store content, confidence, creator type, processing run, model or rule version, validity interval, and supersession link. Published records are append-and-supersede. Corrections do not rewrite the evidence used by historical assessments or workflow runs.

### Provenance and Lineage

Every publishable concept, relation, retrieval unit, and assessment item links to one or more source blocks through normalized evidence tables. Evidence links record role, extracted span, confidence, and claim scope. Synthetic summaries and generated assessments also record prompt, model, decoding policy, graph, retrieval, and validator versions through immutable artifact references.

Large binaries, rendered pages, and model payload archives are stored in the approved object store. PostgreSQL stores checksums, media type, size, policy scope, and immutable object references.

### Graph Convention

Canonical graph artifacts use pedagogical direction. The serving `concept_edges` projection stores prerequisite lookup in query-oriented form: for physical relation type `prerequisite`, `source_id` is the dependent concept and `target_id` is the prerequisite. The adapter is the only component allowed to invert `prerequisite_dependent` edges. All other relation types preserve canonical direction.

Edge version records include confidence, weight, evidence, derivation, review state, and graph version. Recursive traversal always has tenant, lifecycle, relation, depth, row, and statement-time limits.

### Flexible Metadata

JSONB is permitted only for namespaced, non-key extension attributes and immutable model diagnostics. Fields used for identity, authorization, joins, filtering, ordering, constraints, retention, or audit are typed columns. JSONB payloads have schema versions and size limits; promoted operational fields receive typed migrations.

### Transactions and Projections

A publication transaction atomically writes the knowledge version, evidence, hierarchy, policy metadata, and an `index_outbox` event. Idempotent workers project active retrieval units to Qdrant and store point identifier, collection version, content checksum, projection status, attempts, and timestamps in `vector_projections`.

Consumers claim outbox rows with skip-locked batching. Events carry aggregate version and idempotency key. A failed projection never makes unpublished content visible. Reconciliation compares desired relational state with external projections.

## Decision Drivers

- Transactional integrity across educational content and provenance
- Reproducible historical versions and corrections
- Tenant isolation and row-level authorization
- Efficient bounded graph and metadata queries
- Reliable Qdrant projection and deletion workflows
- Extensibility without uncontrolled schemaless records
- Support for assessment review and agent workflow audit
- Mature backup, recovery, observability, and tooling

## Detailed Design Implications

PostgreSQL 16 or later is the supported production baseline. Extensions are limited to approved operational needs. Migrations are forward-only, reviewed, backward-compatible during rolling deployment, and executed by a dedicated migration role.

Row-level security uses transaction-local tenant and actor claims set by a trusted data-access service. Application roles do not own tables and cannot disable policies. Service repositories automatically include tenant predicates even when row-level security is active, providing defense in depth. Privileged maintenance and compliance roles are separate and fully audited.

Unique constraints enforce tenant-scoped source checksums, logical identifiers, active aliases, graph edge identity, hierarchy membership, assessment option positions, and outbox idempotency. Check constraints enforce confidence ranges, lifecycle transitions, version ordering, and approved vocabulary values. Deferrable constraints are used only for atomic publication graphs that cannot be ordered simply.

High-volume append tables such as workflow events, validation observations, and audit events are range-partitioned by time with tenant-aware indexes. Core knowledge tables are not partitioned until measured size and query plans justify it. Indexes follow production query shapes: tenant plus lifecycle, topic and level, evidence source, edge endpoints and type, hierarchy parent, projection state, and outbox availability. Searchable labels use controlled text indexes; semantic search remains in Qdrant.

Connection pooling, statement timeouts, lock timeouts, slow-query tracing, and query-plan regression tests are mandatory. Read replicas may serve non-critical reporting and offline evaluation, but publication, authorization-sensitive reads, learning paths, and projection coordination use the primary or a consistency-verified endpoint.

## Alternatives Considered

### Store all knowledge as JSONB documents

Rejected because referential integrity, graph endpoints, evidence joins, row-level authorization, and migration discipline would be weak and query plans unpredictable.

### Event sourcing as the only persistence model

Rejected because reconstructing current educational graphs and serving state for every query would add unnecessary complexity. ULIP preserves immutable versions and audit events while maintaining authoritative current-state tables.

### Dedicated graph database as the authoritative store

Rejected because documents, assessments, workflows, entitlements, and lineage are relational. A second authority would introduce distributed transactions and duplicate security controls.

### Qdrant as both metadata and vector store

Rejected because it cannot provide ULIP's transactions, foreign keys, version lineage, workflow coordination, or row-level security.

### Separate database per tenant

Rejected as the default because migrations, pooling, reporting, and operations would not scale across standard tenants. Dedicated deployments remain available when contractual isolation requires them.

### Mutable rows with history only in audit logs

Rejected because historical generated assets must resolve to the exact content and policy versions they used, not a reconstructed best effort.

## Consequences

### Positive

- Knowledge, evidence, graph, assessment, and workflow state share transactional integrity.
- Immutable versions make generation and correction reproducible.
- Row-level security and tenant-scoped keys provide strong isolation.
- The outbox makes external projections recoverable and auditable.
- Typed core columns keep critical queries and policies predictable.

### Negative

- Versioned normalized schemas require more joins and migration discipline.
- Cross-store publication is eventually consistent.
- Row-level security and partitioning complicate operations and testing.
- Evidence and version records increase database size.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Cross-tenant joins or missing predicates expose data | Use tenant-inclusive foreign keys, row-level security, trusted repositories, policy tests, and separate privileged roles |
| JSONB becomes an uncontrolled schema | Restrict its purpose, require namespaces and schema versions, limit size, and promote queried fields |
| Outbox backlog makes search stale | Monitor age and failures, autoscale workers, use idempotent retries and dead-letter review, and expose projection freshness |
| Recursive graph queries exhaust resources | Index endpoints, enforce bounds and statement timeouts, and expose intent-level stored queries |
| Version growth harms performance | Use appropriate indexes, archive eligible artifacts, partition append-only observations, and enforce retention |
| Migration locks disrupt service | Use expand-and-contract migrations, online index creation, lock timeouts, rehearsal, and rollback plans |

## Compliance and Security Implications

Data classification, license, residency, retention, legal hold, and deletion state are typed attributes propagated through lineage. Row-level security applies to source, knowledge, retrieval, assessment, and workflow domains. Learner performance and accommodations are stored in a separately restricted schema with independent encryption keys and access roles; shared knowledge rows contain no direct learner identifiers.

PostgreSQL uses encrypted transport, encrypted volumes and backups, managed secret rotation, private networking, audit logging, and point-in-time recovery. Sensitive text is not written to ordinary query logs. Erasure creates an auditable tombstone, disables serving synchronously, and drives cascading object, vector, cache, and derived-artifact deletion subject to legal holds.

## Validation Measures

- Migration tests create, upgrade, and roll back a production-shaped database without data loss.
- Constraint tests cover tenant-scoped references, lifecycle transitions, evidence completeness, version supersession, graph direction, and outbox idempotency.
- Row-level-security tests run every repository operation under multiple tenant and role combinations.
- Property tests verify publication atomicity and deterministic resolution of active versions.
- Outbox failure tests cover duplicates, retries, worker crashes, Qdrant outages, deletion, and reconciliation repair.
- Query-plan and load tests validate topic lookup, bounded graph traversal, evidence resolution, assessment publication, and outbox throughput.
- Backup restoration and point-in-time recovery exercises meet recovery objectives and replay deletion tombstones before serving.

## Related Architecture

- [PostgreSQL Design](../architecture/15_postgres_design.md)
- [Educational Ontology](../architecture/04_educational_ontology.md)
- [Knowledge Graph Architecture](../architecture/09_knowledge_graph_architecture.md)
- [Security and Governance](../architecture/22_security_and_governance.md)
