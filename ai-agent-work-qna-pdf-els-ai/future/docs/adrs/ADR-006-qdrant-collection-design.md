# ADR-006: Qdrant Collection Design

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

ULIP uses Qdrant for low-latency semantic and lexical candidate retrieval across atomic, concept, topic, and document units. Points must be filterable by tenant, authorization, content lifecycle, source, educational level, and resolution. Embedding models and index schemas change over time, while learner-facing retrieval needs atomic cutovers and rollback.

Qdrant is optimized for search, not for relational integrity, lineage, or workflow state. Treating it as the system of record would make graph joins, erasure, audit, and index reconciliation fragile. Creating a collection for every tenant, subject, or document would also produce excessive operational overhead and uneven resource use.

## Decision

ULIP will use a **small, shared set of versioned collections per embedding generation**, selected through Qdrant aliases, with mandatory tenant and policy payload filtering. PostgreSQL remains the source of truth.

### Collection and Alias

Published knowledge uses physical collections named `ulip_knowledge__{generation}` and the serving alias `ulip_knowledge_read`. Editorially approved, non-secure question exemplars use `ulip_question_exemplars__{generation}` and `ulip_question_exemplars_read`. Drafts, learner responses, live item banks, secure examinations, and answer keys are prohibited from both collections. An optional write alias identifies the generation accepting writes; shadow evaluation addresses the candidate physical collection explicitly. A generation fixes:

- dense embedding model and revision
- vector dimensions and distance function
- sparse encoder and tokenizer
- payload schema and indexed fields
- contextual-header and chunker compatibility
- HNSW and quantization policy

The initial dense vector is named `text_dense`, uses `BAAI/bge-small-en-v1.5`, 384 dimensions, and cosine distance. The sparse vector is named `text_sparse` and uses the approved generation-frozen sparse encoder over the same versioned retrieval text. Dense vectors remain in memory when the working set fits, with memory mapping permitted in measured high-capacity tiers; sparse indexes and payloads are stored on disk. Quantization is disabled for the initial production projection because assessment grounding favors recall and citation precision over memory reduction.

All semantic resolutions are stored in the knowledge collection so hybrid and filtered search can compare candidates under one snapshot. Resolution-specific budgets and reranking are application concerns.

### Point Identity and Payload

One point represents one immutable retrieval-unit version in one embedding generation. Its point identifier is UUIDv5 over `tenant_id`, logical entity identifier, entity version, and embedding generation. Upserts are idempotent; changed content receives a new entity version.

Required payload fields are:

- `tenant_id`, `visibility`, `entitlement_tags`, `safety_tags`
- `publication_state`, `valid_from`, `valid_to`, `source_deleted`
- `chunk_id`, `chunk_version`, `source_id`, `source_version_id`
- `concept_id`, `parent_id`, `ancestor_ids`, `knowledge_snapshot_id`
- `resolution`, `chunk_type`, `language`
- `domain`, `subject`, `curriculum_ids`, `grade_bands`, `exam_ids`, `bloom_levels`, `topic`, `subtopic`
- `quality_score`, `quality_status`, `confidence_band`
- `content_text`, `retrieval_text`, `context_template_version`
- `chunker_version`, `embedding_generation`, `embedding_model_id`
- `canonical_hash`, `postgres_record_version`, `created_at`

Keyword payload indexes are created for tenant, visibility, publication state, language, domain, subject, curriculum, grade, exam, resolution, chunk type, source, concept, parent, ancestors, entitlement tags, safety tags, embedding generation, and quality status. Datetime indexes support validity windows. Full-text matching is provided by the sparse vector, not by indexing arbitrary payload text.

Content payload contains only publishable educational text. Original binaries, unrestricted parser output, learner records, secrets, and direct personal identifiers are never stored in Qdrant.

### Isolation, Sharding, and Replication

Each physical collection starts with six shards distributed by point identifier. ULIP does not use tenant custom sharding because tenant sizes are uneven and custom shard operations add operational complexity. The production cluster uses three replicas and a write-consistency factor of two across three failure domains. Snapshots are encrypted and copied to the approved backup store.

Tenants whose contractual or regulatory boundary requires physical isolation use a dedicated Qdrant cluster with the identical collection schema and aliases. They do not share the standard collection.

Every search includes a server-derived `tenant_id` condition plus lifecycle, authorization, and license conditions. Client requests can only narrow these predicates.

### Synchronization and Migration

PostgreSQL stores the desired projection state and an outbox event. An idempotent indexer reads events, verifies that the unit is publishable, creates dense and sparse vectors from the exact `retrieval_text`, upserts Qdrant, and records the point identifier, collection version, checksum, and completion state in PostgreSQL. Search exposes only units whose relational projection state is active.

Deletion first marks relational records unavailable, then issues point deletions to all active and retained projection collections and invalidates caches. A reconciliation job compares active PostgreSQL projection records with Qdrant point identifiers and checksums.

Model, vector-schema, or material payload changes create a new collection. ULIP backfills it from immutable retrieval units, runs shadow evaluation, stops writes briefly through the index coordinator, drains the outbox to both collections, atomically switches the active alias, verifies serving, and retains the previous collection for the approved rollback window.

## Decision Drivers

- Fast hybrid retrieval with mandatory metadata filters
- Safe tenant isolation and content authorization
- Atomic model migrations and rapid rollback
- Idempotent indexing and auditable reconciliation
- Efficient support for all semantic resolutions
- Avoidance of per-document and per-subject collection sprawl
- Clear separation between search projection and source of truth
- Predictable availability across failure domains

## Detailed Design Implications

Only the retrieval service can query Qdrant in production. It supplies named dense and sparse searches, applies policy filters to each branch, fuses ranks, and performs application-level authorization again. Direct client access and arbitrary payload retrieval are prohibited.

Collection creation is managed as infrastructure code. Startup code validates alias target, vector dimensions, named-vector configuration, indexed payload fields, replication, and write consistency. It never recreates a production collection in place.

Operational metrics include point count, filtered-query rate, index size, segment count, HNSW search latency, exact-versus-approximate recall samples, replica lag, failed upserts, outbox age, reconciliation drift, and deletion lag. Capacity is managed by adding shards and nodes through rehearsed operations, not by increasing result limits.

Backups complement, but do not replace, rebuild capability. Any Qdrant collection can be reconstructed from active PostgreSQL projection records and versioned retrieval text.

## Alternatives Considered

### One collection per tenant

Rejected for standard tenants because collection count, uneven shard sizes, migrations, aliases, monitoring, and backups become operationally expensive. Dedicated clusters remain a mandatory isolation pattern only when required by contract or regulation.

### One collection per subject or content resolution

Rejected because cross-subject and cross-resolution queries require fan-out, duplicate policy logic, and score normalization across collections.

### Store different embedding models as unnamed vectors in one collection

Rejected because vector dimensions and semantics would be ambiguous, and collection-level migrations would not be atomic. Each projection receives a versioned collection and named vectors.

### Use Qdrant as the source of truth

Rejected because Qdrant does not provide ULIP's relational lineage, graph integrity, workflow transactions, or audit model.

### Overwrite vectors in place during model upgrades

Rejected because mixed-model vectors corrupt similarity and prevent rollback. A new collection plus alias cutover provides a coherent snapshot.

### Enable scalar quantization immediately

Rejected because no ULIP benchmark yet demonstrates acceptable quality for high-stakes assessment grounding. The initial projection preserves full vectors.

## Consequences

### Positive

- Alias cutovers make projection migrations coherent and reversible.
- A shared knowledge collection supports efficient hybrid, filtered, multi-resolution retrieval.
- PostgreSQL outbox and reconciliation provide recovery from partial failures.
- Indexed tenant predicates enforce isolation without tenant-specific shard operations.
- Search data can be fully rebuilt from authoritative records.

### Negative

- Shared infrastructure requires rigorous filter enforcement and testing.
- Dual dense and sparse vectors increase index and ingestion cost.
- Full vectors consume more disk and memory than quantized vectors.
- Cross-store publication and deletion are eventually consistent and need reconciliation.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Missing tenant filter exposes another tenant's point | Centralize filter compilation, deny unscoped searches, require indexed tenant predicates, reauthorize results, and run isolation tests |
| Qdrant and PostgreSQL diverge | Use transactional outbox, idempotent upserts, active projection state, checksum reconciliation, and repair jobs |
| Alias cutover loses recent writes | Dual-write through the coordinator, drain outbox, verify counts and checksums, then switch atomically |
| Approximate search misses critical evidence | Measure exact-versus-HNSW recall, tune search parameters, preserve sparse search, and rerank a sufficient candidate set |
| Large payloads harm latency and storage | Keep only retrieval-required text and metadata, bound text size, and store rich lineage in PostgreSQL |
| Deletion remains in old projections or backups | Delete across retained collections, track deletion receipts, expire rollback collections, and enforce backup retention |

## Compliance and Security Implications

Qdrant runs on private networks with mutual service authentication, encrypted transport, encrypted disks and snapshots, least-privilege service credentials, audit logging, and no public endpoint. Policy fields are supplied from trusted relational records and cannot be overridden by clients.

Payload minimization excludes learner profiles and direct personal identifiers. Physical isolation is used when contractual or regulatory requirements prohibit shared infrastructure. Erasure tracks active, shadow, and rollback collections as well as snapshots and caches. Backup restoration requires replaying deletion tombstones before a collection can serve traffic.

## Validation Measures

- Collection-schema conformance verifies vectors, dimensions, distance, sparse configuration, payload indexes, aliases, replicas, and consistency.
- Retrieval benchmarks measure hybrid Recall@K, nDCG@K, filter selectivity, exact-versus-approximate recall, and latency percentiles.
- Tenant-isolation tests prove that omitted or manipulated client filters cannot broaden server scope.
- Failure tests cover replica loss, partial upserts, duplicate events, delayed outbox processing, alias rollback, and restore.
- Reconciliation reports zero unexplained active-record, point-ID, checksum, and deletion drift.
- Migration rehearsals verify shadow comparison, dual-write catch-up, atomic alias switch, and rollback.
- Capacity tests validate the expected corpus size, filter cardinality, concurrency, ingestion rate, and failure-domain behavior.

## Related Architecture

- [Qdrant Design](../architecture/14_qdrant_design.md)
- [Vector Store Architecture](../architecture/13_vector_store_architecture.md)
- [PostgreSQL Design](../architecture/15_postgres_design.md)
- [Deployment Architecture](../architecture/21_deployment_architecture.md)
