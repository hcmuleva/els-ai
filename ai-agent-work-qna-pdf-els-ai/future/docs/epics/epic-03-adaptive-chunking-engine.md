# Epic 03: Adaptive Chunking Engine

## Goal

Create a deterministic, policy-driven chunking engine that assembles concept-complete educational units from approved source spans and knowledge assets. Chunk boundaries must adapt to semantic structure, learning purpose, model context limits, and content form while preserving exact provenance, version identity, and tenant isolation.

## Business and User Value

- Learners receive coherent retrieved context rather than arbitrary page or token fragments.
- Educators can verify each chunk against the source and understand why its boundaries were chosen.
- Retrieval and assessment services gain fit-for-purpose units for explanations, practice, and composite reasoning.
- Institutions can tune chunking by subject, language, grade, and model without losing historical reproducibility.
- Platform operators can re-chunk safely and compare quality before moving production traffic.

## Scope

### In Scope

- Semantic boundary candidates from headings, paragraphs, lists, tables, formulas, examples, definitions, and approved concept evidence.
- Atomic concept chunks that keep a definition or proposition with essential explanation and examples.
- Composite chunks that combine explicitly related concepts for advanced reasoning within a configured context budget.
- Adaptive minimum, target, and maximum token policies by content type, language, level, and retrieval purpose.
- Controlled overlap using referenced span identifiers rather than untracked text duplication.
- Formula, table, diagram description, code sample, and worked-solution integrity rules.
- Contextual headers containing subject, curriculum, chapter, topic, subtopic, concept, and source identity.
- Chunk completeness, coherence, redundancy, provenance, and budget validation.
- Immutable chunk-set versions keyed by source snapshot, knowledge snapshot, policy, tokenizer, and engine versions.
- Incremental re-chunking of affected source and concept revisions.
- Review and explainability APIs that expose boundary rationale and validation results.

### Out of Scope

- Source parsing and OCR.
- Knowledge concept extraction or approval.
- Embedding model execution and vector persistence.
- Query-time retrieval and ranking.
- Graph storage and learner-path generation.
- Summarization that introduces claims absent from approved evidence.

## Personas

- **Learner:** receives complete, understandable context for a question or explanation.
- **Educator:** inspects chunk text, structure, evidence, and boundary rationale.
- **Retrieval engineer:** configures chunk policy for target models and use cases.
- **Assessment designer:** selects concept-complete and composite evidence units.
- **Knowledge steward:** approves policy changes and reviews failed chunks.
- **Platform operator:** monitors throughput, regressions, and incremental reprocessing.

## User Stories

### 1. Concept-complete atomic chunks

As a retrieval engineer, I want chunks to follow concept and instructional boundaries so that retrieval returns self-contained educational context.

**Testable outcomes**

1. Each atomic chunk identifies its primary concept and includes all required source spans for the selected content type.
2. Definitions are not separated from their defined term, and formulas are not separated from required variable definitions.
3. A validator records completeness and coherence scores plus any excluded candidate spans.

### 2. Adaptive policy selection

As a knowledge steward, I want chunk policy selected by subject, language, grade, content form, and purpose so that one fixed token size does not distort diverse educational material.

**Testable outcomes**

1. Every chunk records the resolved policy and every policy input.
2. Policy resolution is deterministic for the same tenant, snapshot, and purpose.
3. An invalid or missing tenant override falls back to a versioned platform policy and emits a visible warning.

### 3. Structure preservation

As an educator, I want tables, formulas, diagrams, and worked examples preserved as meaningful units so that downstream explanations are not misleading.

**Testable outcomes**

1. A table header is repeated or referenced with every table segment.
2. A split worked solution retains ordered step identifiers and links to adjacent segments.
3. A formula chunk includes notation definitions and source references required to interpret it, or fails validation.

### 4. Advanced composite context

As an assessment designer, I want reviewed prerequisite and related concepts assembled into bounded composite chunks so that advanced questions can require valid multi-concept reasoning.

**Testable outcomes**

1. Every included concept is linked by an approved relationship and listed in the assembly rationale.
2. The composite identifies a primary learning objective and prerequisite order.
3. No composite exceeds the model-specific context budget after contextualization and reserved response tokens.

### 5. Reproducible re-chunking

As a platform operator, I want policy upgrades to create a new comparable chunk set so that production can roll back without rewriting indexed evidence.

**Testable outcomes**

1. A chunk set records source snapshot, knowledge snapshot, policy, engine, tokenizer, and normalization versions.
2. A comparison reports added, removed, retained, split, merged, and materially changed chunks.
3. Activation changes the tenant's selected chunk set atomically.

### 6. Boundary explainability

As an educator, I want to understand why a chunk begins and ends where it does so that I can trust or challenge the segmentation.

**Testable outcomes**

1. The inspection response lists boundary signals, policy constraints, related spans, and validation scores.
2. Every output span maps to one or more immutable source span identifiers.
3. Review corrections create a versioned policy exception rather than directly editing an active chunk.

### 7. Incremental processing

As a content administrator, I want only affected content re-chunked after a source or concept correction so that updates are timely and cost-efficient.

**Testable outcomes**

1. The impact planner identifies changed source spans, concepts, and dependent composites.
2. Unaffected chunks retain stable content-derived identities.
3. The new chunk set is published only when referential and completeness validation passes for the entire affected partition.

## Acceptance Criteria

1. One hundred percent of committed chunks include `tenant_id`, stable chunk ID, chunk revision, chunk-set ID, purpose, primary concept, source and knowledge snapshot IDs, ordered source span IDs, policy version, engine version, tokenizer version, and validation results.
2. One hundred percent of chunk text is attributable to ordered approved source spans or explicitly labeled contextual metadata; the engine introduces no unsupported factual sentence.
3. On an expert-adjudicated benchmark, at least 95% of atomic chunks are rated concept-complete and at least 92% are rated coherent, with inter-rater agreement reported.
4. Fewer than 1% of benchmark definitions are separated from their term, fewer than 1% of formulas lack required symbol definitions, and zero table segments omit their applicable header context.
5. At least 99% of normal chunks fit the resolved token budget. Oversized indivisible units are labeled with a reason, excluded from incompatible indexes, and routed to the configured specialized policy.
6. For each supported serving model, the final contextualized chunk plus reserved prompt and response allowance does not exceed the declared context window in automated contract tests.
7. Provenance reconstruction returns the same normalized source text for at least 99.9% of sampled chunk spans; the remaining cases block activation until resolved.
8. Redundant token ratio caused by overlap is at most 20% per chunk set unless a tenant policy approved through governance declares a higher bound for a measured retrieval benefit.
9. Repeating a run with identical snapshots, policies, tokenizer, and engine produces identical chunk IDs, ordered spans, and normalized content excluding run timestamps.
10. Incremental processing retains IDs for 100% of chunks whose inputs and resolved policy are unchanged and produces the same affected outputs as a full rebuild.
11. A 300-page normalized source is chunked and validated within 5 minutes at p95 under the documented production load.
12. Chunk-set activation is atomic. In 10,000 concurrent activation/read tests, no read returns mixed chunk-set IDs.
13. Tenant-isolation tests cover policy lookup, source spans, chunk inspection, caches, exports, events, and activation and show zero unauthorized access.
14. Every failed unit records a stable reason code and source location; no invalid chunk is published to embedding or retrieval consumers.
15. Offline evaluation demonstrates that the candidate policy improves or preserves retrieval evidence recall at `k=10` and answer citation precision relative to the approved baseline, with no subject cohort degrading by more than 2 percentage points.

## Deliverables

- Versioned chunk, chunk-set, boundary-rationale, policy, validation, and comparison schemas.
- Boundary candidate generation and deterministic policy resolver.
- Atomic concept chunk assembler and graph-informed composite chunk assembler.
- Integrity handlers for definitions, formulas, tables, lists, diagrams, and worked solutions.
- Tokenizer registry and serving-model budget contracts.
- Completeness, coherence, provenance, redundancy, and context-budget validators.
- Incremental impact planner, chunk identity algorithm, activation, and rollback APIs.
- Review inspection API and governed policy-exception workflow.
- Versioned chunk-set proposal, activation, retirement, and failure events.
- Golden segmentation corpus, retrieval evaluation fixtures, property tests, performance tests, and tenant-isolation tests.
- Operations and policy-tuning runbooks.

## Dependencies

- Epic 01 supplies normalized structure, page blocks, and immutable source spans.
- Epic 02 supplies approved concepts, objectives, prerequisites, and knowledge snapshots.
- Epic 05 supplies approved relationship traversals for composite assembly when available.
- Tokenizer implementations and declared context limits for supported embedding and generation models.
- Tenant policy registry, metadata store, event bus, immutable asset storage, and authorization.
- Epic 04 consumes active chunk sets for retrieval.
- Epic 06 consumes eligible chunks for embedding and indexing.
- Epic 07 and Epic 08 consume chunk evidence and composite units for assessment workflows.

## Architecture and ADR Links

- [ULIP architecture documentation](../architecture/)
- [ULIP architecture decision records](../adrs/)
- [Epic 01: Document Intelligence](epic-01-document-intelligence.md)
- [Epic 02: Knowledge Intelligence](epic-02-knowledge-intelligence.md)
- [Epic 04: Contextual Retrieval](epic-04-contextual-retrieval.md)
- [Epic 06: Vector Database Layer](epic-06-vector-database-layer.md)

The implementation must conform to architecture contracts for immutable asset lineage, semantic processing, and index publication. Controlling ADR topics are semantic rather than page-based boundaries, deterministic content identity, contextual metadata, composite assembly, and model-specific token budgets.

## Data and Security Considerations

- Propagate source rights, retention, residency, sensitivity, legal hold, and tenant identity to every chunk and chunk-set manifest.
- Authorize source span resolution and chunk inspection independently; possession of a chunk ID must not grant access.
- Keep source text out of logs, metrics, trace attributes, error messages, and policy evaluation telemetry.
- Validate and escape markup, formulas, links, and diagram descriptions before rendering or model use.
- Treat tenant policy expressions as configuration data, not executable code, and validate them against a constrained schema.
- Never combine chunks across tenants. Cross-tenant public content must be imported as a tenant-owned, versioned source and knowledge snapshot.
- Ensure deletion lineage reaches active and retired chunk sets, indexes, caches, exports, and downstream derivative manifests.

## Observability

- Track chunks created, retained, split, merged, rejected, and oversized by policy version, content type, language, purpose, and subject.
- Measure chunk token distributions, completeness, coherence, redundancy, provenance failures, contextualization size, and incremental-change ratio.
- Trace source and knowledge snapshot selection, policy resolution, boundary decisions, validation, publication, and downstream event delivery.
- Alert when invalid chunks are published, provenance failures are nonzero, p95 processing exceeds 5 minutes, oversized rate exceeds 1%, or queue age exceeds 10 minutes.
- Provide comparison dashboards for candidate versus active policy, including retrieval recall, citation precision, storage growth, and per-subject regressions.
- Use stable content-free reason codes in telemetry; expose source text only through authorized inspection endpoints.

## Rollout and Migration

1. Build a versioned golden corpus covering prose, formulas, tables, lists, diagrams, multilingual text, and worked solutions.
2. Qualify the initial platform policy against expert segmentation and retrieval benchmarks.
3. Shadow-generate candidate chunk sets for existing sources and compare boundaries, storage, retrieval, and citation quality.
4. Index candidate sets into isolated collections and run replay queries before any traffic shift.
5. Enable internal and pilot tenants by feature flag, with reads pinned to one explicit chunk-set version.
6. Migrate legacy chunks by retaining legacy IDs as aliases and creating source-span lineage where it can be verified; quarantine unverifiable chunks.
7. Shift traffic by tenant cohort only after seven consecutive days within quality, latency, and error-budget gates.
8. Roll back by atomically selecting the prior chunk and index manifests; never mutate the retired set.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Token targets split educational meaning | Treat token size as a constraint after semantic integrity rules and evaluate with expert-labeled boundaries. |
| Large tables or solutions exceed model limits | Use structure-aware segmentation with repeated headers, ordered links, and specialized large-unit policies. |
| Contextual headers bias retrieval | Keep headers structured and versioned, evaluate ablations, and cap contextual metadata size. |
| Excessive overlap raises storage and retrieval duplication | Use span references, redundancy budgets, and deduplication in result assembly. |
| Policy changes invalidate downstream indexes | Publish immutable chunk sets and require a paired index manifest before activation. |
| Graph errors produce incoherent composites | Use only approved edges, bound traversal, expose rationale, and validate composites independently. |
| Manual exceptions become unmaintainable | Scope exceptions to stable concepts or structural signatures, require owners and expiry review, and measure usage. |

## Definition of Done

- Chunk, policy, rationale, validation, comparison, and lifecycle contracts are versioned and documented.
- All acceptance criteria pass with retained expert, automated, and performance evidence.
- Golden segmentation and retrieval benchmarks cover every enabled content form, language, and subject cohort.
- Security review confirms tenant isolation, policy safety, content handling, authorization, and deletion propagation.
- Epics 04 and 06 pass contract and activation integration tests with the same chunk-set manifest.
- Candidate shadow indexing, traffic migration, and rollback are rehearsed in a production-like environment.
- Dashboards, alerts, service-level objectives, capacity limits, ownership, and incident runbooks are active.
- Product, retrieval, education quality, security, data governance, and operations owners approve general availability.
