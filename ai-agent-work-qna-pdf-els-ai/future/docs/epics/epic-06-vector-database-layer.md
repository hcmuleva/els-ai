# Epic 06: Vector Database Layer

## Goal

Provide a production-grade, tenant-isolated embedding and vector indexing layer for approved ULIP chunks. The layer must support reproducible embeddings, metadata-filtered search, immutable index manifests, zero-downtime reindexing, verified deletion, and portable adapters with Qdrant as the initial production backend.

## Business and User Value

- Learners receive fast semantic retrieval from institution-approved content.
- Educators can constrain search by curriculum, source, grade, concept, level, and version.
- Retrieval services can switch models and indexes without mixing incompatible vectors.
- Institutions can enforce residency, retention, and tenant isolation across indexed content.
- Operators can measure index freshness, capacity, recall, and recovery rather than treating the vector store as an opaque dependency.

## Scope

### In Scope

- Embedding provider abstraction with approved local and hosted model adapters.
- Batched embedding generation for active, eligible chunks.
- Deterministic embedding input construction from chunk text and selected contextual metadata.
- Vector normalization, dimensionality, distance metric, model revision, and tokenizer validation.
- Qdrant collection and payload schema with tenant, snapshot, source, curriculum, concept, level, language, rights, and lifecycle metadata.
- Tenant authorization and mandatory payload filtering for all reads and writes.
- Immutable index manifests linking chunk set, embedding model, input template, vector parameters, backend collection or namespace, and build status.
- Idempotent upsert, incremental update, tombstone, compaction, rebuild, backup, restore, and reconciliation.
- Blue-green index creation and atomic alias or manifest activation.
- Exact or sampled quality validation against brute-force neighbors.
- Capacity planning, rate limiting, backpressure, retry, and dead-letter handling.
- Local embedded Qdrant and deterministic hash vectors for development and contract testing only.

### Out of Scope

- Chunk construction and educational concept extraction.
- Query fusion, reranking, evidence packing, and final retrieval policy.
- Learner-specific recommendation decisions.
- Direct client access to vector database administrative credentials.
- Treating hash vectors as a production semantic-retrieval model.
- Automatic sharing of vectors or payloads between tenants.

## Personas

- **Learner:** benefits from low-latency semantic retrieval.
- **Retrieval service:** performs authorized filtered vector search against one compatible manifest.
- **ML/retrieval engineer:** qualifies embedding models and input templates.
- **Content administrator:** observes indexing status and freshness for uploaded material.
- **Platform operator:** builds, scales, backs up, restores, reconciles, and rolls back indexes.
- **Security auditor:** verifies tenant filtering, credentials, network boundaries, and deletion.

## User Stories

### 1. Reproducible embedding

As an ML engineer, I want each vector tied to exact content and model inputs so that retrieval results can be reproduced and compared.

**Testable outcomes**

1. Each vector record includes content hash, chunk revision, model identifier and revision, input-template version, dimensions, and creation run.
2. The embedding input can be reconstructed from retained authorized assets.
3. A dimension, normalization, or model mismatch fails before any vector is committed.

### 2. Authorized filtered search

As a retrieval service, I want mandatory tenant and entitlement filters combined with educational metadata filters so that candidates are both relevant and authorized.

**Testable outcomes**

1. Tenant scope is injected by the service boundary and cannot be overridden by the caller.
2. Source, curriculum, grade, concept, level, language, rights, status, and snapshot filters use validated payload fields.
3. Search responses identify the index manifest and stable chunk revision for every hit.

### 3. Idempotent incremental indexing

As a content administrator, I want changed chunks indexed without duplicating unchanged vectors so that new content becomes searchable efficiently.

**Testable outcomes**

1. Repeated events for the same chunk revision and embedding configuration produce one active point.
2. Unchanged chunk hashes reuse eligible vectors under the same tenant and model policy.
3. Removed or ineligible chunks become unsearchable within the freshness SLA.

### 4. Safe model migration

As a retrieval engineer, I want to build a candidate model index beside production so that recall and latency can be evaluated before traffic moves.

**Testable outcomes**

1. Candidate and active vectors never share an ambiguous namespace.
2. An index cannot activate until manifest completeness, quality, filter, and compatibility checks pass.
3. Rollback changes the active alias or manifest without re-embedding.

### 5. Reconciliation and repair

As a platform operator, I want to compare the active chunk manifest with vector points so that missing, stale, duplicate, and orphan points are detected and repaired.

**Testable outcomes**

1. Reconciliation reports each discrepancy by stable reason code.
2. Repair is idempotent and operates within bounded tenant and manifest partitions.
3. Reconciliation never copies content or vectors across tenant boundaries.

### 6. Backup and restore

As a platform operator, I want tested snapshots and restoration so that a vector-cluster failure does not permanently remove searchable knowledge.

**Testable outcomes**

1. Backup metadata identifies backend version, collection, index manifest, encryption key reference, tenant scope, and timestamp.
2. Restore verifies point counts, payload hashes, filter behavior, and sampled nearest-neighbor quality.
3. Recovery meets documented recovery-point and recovery-time objectives.

### 7. Verified deletion

As a privacy or content administrator, I want deleted source versions removed from vector search and backups according to policy so that retention obligations are met.

**Testable outcomes**

1. A lineage lookup identifies all points and manifests derived from a source version.
2. Deletion creates an auditable tombstone and search exclusion before physical compaction.
3. A verifier confirms absence from active indexes, caches, exports, and expired backups.

## Acceptance Criteria

1. One hundred percent of vector points contain `tenant_id`, point ID, chunk ID and revision, chunk-set ID, source version IDs, content hash, embedding model and revision, input-template version, dimensions, distance metric, lifecycle status, and index manifest ID.
2. Point identity is deterministic for tenant, chunk revision, and embedding configuration; replaying 10,000 duplicate events produces exactly one active point per identity.
3. Production semantic indexes use a qualified embedding model. The deterministic hash embedder is rejected by production policy and is available only in development and contract-test environments.
4. The indexing pipeline rejects non-finite values, zero vectors when prohibited by model policy, wrong dimensions, incorrect normalization, missing mandatory payload, and incompatible model or collection configuration before commit.
5. On the frozen retrieval benchmark, approximate search retains at least 0.98 recall at `k=10` relative to exact search for the same embeddings and filters.
6. Filter correctness is 100% across the release matrix for tenant, snapshot, status, rights, source, curriculum, grade, language, concept, level, and their supported combinations.
7. Filtered vector search on the production-sized benchmark completes within 150 ms at p95 and 400 ms at p99 for `k <= 50`, excluding network time outside the ULIP service boundary.
8. The layer sustains 300 search requests per second and 5,000 point upserts per minute per production deployment with search error rate below 0.1% under the documented load profile.
9. Newly activated chunks become available in a complete candidate index within 15 minutes at p95 for incremental updates; retired chunks become unsearchable within 5 minutes at p95.
10. Before activation, an index manifest accounts for 100% of eligible chunks as indexed or explicitly failed. Any unresolved failure blocks activation.
11. Reconciliation detects all seeded missing, stale, duplicate, and orphan points in the fault suite and repairs them without changing correct points.
12. In 10,000 concurrent search and activation tests, each response uses exactly one index manifest and returns only chunk revisions compatible with it.
13. Tenant-isolation tests cover search, recommend or scroll APIs, point lookup, counts, payload indexes, aliases, snapshots, logs, caches, and administrative adapters and show zero unauthorized disclosure.
14. Encrypted backup and restore meet an RPO of 15 minutes and RTO of 60 minutes for the documented production data size, with 100% payload-hash agreement and at least 0.98 sampled neighbor agreement after restore.
15. An approved purge makes affected points unsearchable within 5 minutes and physically removes them from primary storage within 24 hours; backup expiry follows retention policy and is verified by an auditable deletion report.

## Deliverables

- Versioned embedding request, vector point, payload, index manifest, reconciliation, backup, and deletion schemas.
- Approved embedding adapters with batching, deadlines, retry, rate limits, cost controls, and model allowlists.
- Deterministic embedding-input builder and content hashing.
- Qdrant service adapter for filtered search, batch upsert, tombstone, collection build, alias activation, snapshot, and restore.
- Tenant-keyed payload schema, indexes, network policy, credential model, and authorization wrapper.
- Incremental index worker, idempotency store, dead-letter flow, and freshness tracking.
- Blue-green build, validation, activation, rollback, reconciliation, repair, and compaction tooling.
- Model qualification and approximate-neighbor evaluation harnesses.
- Capacity tests, chaos tests, backup and restore drills, deletion tests, and tenant-isolation tests.
- Operator runbooks and index compatibility documentation.

## Dependencies

- Epic 03 supplies eligible immutable chunk revisions and chunk-set manifests.
- Epic 04 consumes vector search through the ULIP service adapter and retrieval manifest.
- Identity, tenant, entitlement, rights policy, event bus, secrets, key management, object storage, cache, audit, and feature-flag services.
- Qdrant production deployment with approved availability, residency, backup, and monitoring configuration.
- Qualified embedding models and model artifact registry.
- Relational metadata store for manifests, jobs, idempotency, lineage, and deletion state.
- Source and knowledge lifecycle events from Epics 01 and 02.

## Architecture and ADR Links

- [ULIP architecture documentation](../architecture/)
- [ULIP architecture decision records](../adrs/)
- [Epic 03: Adaptive Chunking Engine](epic-03-adaptive-chunking-engine.md)
- [Epic 04: Contextual Retrieval](epic-04-contextual-retrieval.md)

The implementation must follow architecture contracts for the storage plane, model gateway, serving boundary, and immutable manifests. Controlling ADR topics are Qdrant as the initial vector backend, embeddings outside the analysis pipeline, hash vectors limited to non-production use, tenant filtering, and blue-green reindexing.

## Data and Security Considerations

- Treat vectors as potentially revealing derived tenant content; protect them with the same isolation and retention class as source text.
- Never expose vector database credentials or unrestricted APIs to browsers, agents, or tenant clients.
- Enforce tenant scope server-side in every operation, including count, scroll, lookup, recommendation, and administrative maintenance.
- Use encrypted transport, encrypted disks and snapshots, short-lived credentials, private networking, and separate administrative roles.
- Keep source text, vectors, payload labels, and query vectors out of logs and traces.
- Apply provider allowlists, regional routing, no-training terms, and data minimization for hosted embeddings.
- Include rights, status, source version, and snapshot fields in payload filters so archived or unauthorized content cannot be returned during deletion lag.
- Sign or integrity-check manifests and backups; reject activation when hashes or compatibility rules fail.

## Observability

- Track embedding requests, tokens, batches, latency, failures, retries, rate limits, model usage, and estimated cost.
- Track eligible, indexed, failed, stale, tombstoned, orphan, and duplicate points by manifest and non-identifying cohort.
- Measure search latency, filter latency, request rate, timeout, approximate recall samples, collection size, memory, disk, segment count, and compaction.
- Trace chunk event, embedding, upsert, validation, manifest activation, search, deletion, backup, and restore with content-free identifiers.
- Alert when freshness exceeds 15 minutes, active-manifest completeness is below 100%, filter mismatch is nonzero, search p95 exceeds 150 ms, disk exceeds 80%, or backup age exceeds the RPO.
- Provide dashboards for model cost and quality, index builds, active and candidate manifests, capacity, search health, reconciliation, backup, and purge SLA.

## Rollout and Migration

1. Qualify embedding models and Qdrant parameters on frozen relevance, exact-neighbor, filter, latency, and memory benchmarks.
2. Build a complete candidate index in an isolated collection and reconcile it to an immutable chunk manifest.
3. Run shadow queries through Epic 04 and compare recall, ranking contribution, latency, and filter correctness.
4. Enable internal traffic using an explicit candidate manifest, then canary selected pilot tenants.
5. Shift tenant aliases or retrieval manifests in cohorts after seven consecutive days within quality and error-budget gates.
6. Re-embed legacy points from retained chunk revisions; do not infer model identity for vectors lacking trustworthy lineage.
7. Keep the prior index read-only for the rollback and retention window, then delete it through the governed purge flow.
8. Roll back by atomically restoring the prior alias or retrieval manifest and invalidating version-keyed caches.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Embedding model change silently mixes vector spaces | Use separate immutable manifests and collections and reject model or dimension mismatch. |
| Payload filtering leaks another tenant's content | Inject tenant scope server-side, index mandatory fields, and test all read and administrative APIs. |
| Approximate settings reduce educational evidence recall | Compare with exact search and gate activation on recall and cohort relevance. |
| Index updates leave missing or orphan points | Reconcile every manifest, require completeness before activation, and run continuous drift scans. |
| Hosted embeddings expose confidential content | Prefer approved local models where required and enforce regional, retention, and no-training provider policies. |
| Cluster or snapshot corruption causes prolonged outage | Use replicated production topology, encrypted snapshots, checksums, restore drills, and tested manifest rollback. |
| Tombstones satisfy search but not deletion policy | Track lineage, compact within SLA, expire backups, and issue a verified deletion report. |

## Definition of Done

- Embedding, point, payload, manifest, reconciliation, backup, and deletion contracts are versioned and documented.
- All acceptance criteria pass on frozen quality benchmarks and production-like scale tests.
- Security review confirms service-boundary access, tenant filtering, credential isolation, provider policy, backup protection, and deletion.
- Epic 04 passes filtered search, manifest compatibility, activation, degradation, and rollback integration tests.
- Index build, failed build, concurrent activation, reconciliation, backup, restore, and purge drills succeed.
- Dashboards, alerts, SLOs, capacity forecasts, cost limits, ownership, and incident runbooks are operational.
- Pilot traffic remains within relevance, latency, freshness, and availability gates for seven consecutive days.
- Product, retrieval, ML, security, privacy, data governance, and operations owners approve general availability.
