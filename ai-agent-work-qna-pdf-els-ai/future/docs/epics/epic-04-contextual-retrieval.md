# Epic 04: Contextual Retrieval

## Goal

Deliver a version-aware retrieval service that selects source-grounded educational evidence using tenant-authorized hybrid search, metadata filters, graph context, and explainable ranking. The service must return coherent context within a caller-declared token budget and disclose exactly which source and index versions produced each result.

## Business and User Value

- Learners receive relevant explanations and practice grounded in approved materials.
- Educators can filter retrieval by curriculum, source, grade, level, and approval status.
- Assessment services obtain sufficient evidence without inventing unsupported content.
- Institutions can pin experiences to approved content versions and audit every citation.
- Platform teams can evaluate, canary, and roll back retrieval changes independently of content ingestion.

## Scope

### In Scope

- Versioned retrieval API for search, evidence bundles, and source citation resolution.
- Authorization-aware filtering before candidate content can be returned.
- Dense vector, lexical, metadata, and approved graph-neighborhood candidate generation.
- Query normalization, language detection, spelling-tolerant lexical search, and policy-bounded query expansion.
- Reciprocal or learned rank fusion and optional reranking through approved models.
- Filters for tenant, snapshot, source, curriculum, subject, grade, language, concept, objective, level, rights, status, and content type.
- Diversity, redundancy suppression, concept coverage, prerequisite ordering, and token-budget packing.
- Atomic selection of knowledge, chunk, graph, and index manifests.
- Retrieval explanation containing ranks, scores, filters, versions, and citations without exposing sensitive model internals.
- Offline relevance evaluation, online quality signals, canary routing, and replay testing.
- Graceful degradation when vector, lexical, graph, or reranking dependencies are unavailable.

### Out of Scope

- Source extraction, concept extraction, and chunk construction.
- Embedding generation and physical vector index administration.
- New educational claim generation.
- Assessment item generation.
- Learner mastery updates and final learning-path decisions.
- Open-web search or retrieval from unapproved external repositories.

## Personas

- **Learner:** asks a question and receives relevant, citable learning context.
- **Educator:** searches approved tenant content using pedagogical and curriculum filters.
- **Assessment service:** requests evidence for a declared concept, objective, and level.
- **Learning workflow agent:** obtains bounded context and records retrieval provenance.
- **Content auditor:** reproduces a historical retrieval using pinned manifests.
- **Retrieval operator:** monitors relevance, latency, dependency health, and index rollouts.

## User Stories

### 1. Grounded educational search

As a learner, I want results from approved course content so that answers reflect the material I am expected to learn.

**Testable outcomes**

1. Each result includes a resolvable source citation, active revision, approval status, and retrieval score.
2. The response identifies when no evidence meets the minimum relevance threshold.
3. No result comes from a source outside the learner's tenant, course entitlement, or selected content snapshot.

### 2. Pedagogical filtering

As an educator, I want to filter by curriculum, subject, grade, concept, objective, and level so that results fit my instructional intent.

**Testable outcomes**

1. Applied filters are echoed in normalized form.
2. Invalid filter combinations return field-level validation instead of silently broadening the search.
3. Every returned result satisfies all mandatory filters in automated tests.

### 3. Evidence bundles

As an assessment service, I want a compact, concept-complete evidence bundle so that item generation has enough context and stays within its token budget.

**Testable outcomes**

1. The caller declares purpose, target concepts, maximum context tokens, and reserved generation tokens.
2. The bundle reports concept coverage, omitted candidates, token count, and ordering rationale.
3. The service does not truncate a protected definition, formula, table header, or worked-solution step.

### 4. Hybrid and graph-aware ranking

As a learner, I want terminology matches and semantically related concepts considered so that retrieval succeeds for both exact and natural-language queries.

**Testable outcomes**

1. Candidate provenance identifies lexical, vector, metadata, and graph channels.
2. Graph expansion uses only approved edge types, depth limits, and the selected graph snapshot.
3. Fusion and reranking are deterministic for a fixed candidate set and model configuration.

### 5. Reproducible retrieval

As a content auditor, I want to replay a historical retrieval with pinned versions so that I can explain what evidence an agent used.

**Testable outcomes**

1. The retrieval record stores normalized query hash, authorization scope hash, all selected manifests, policy version, model versions, and result identifiers.
2. An authorized replay against retained assets returns the same ordered result IDs for deterministic configurations.
3. Historical replay cannot bypass current authorization or legal-hold restrictions.

### 6. Safe degraded operation

As a platform operator, I want retrieval to degrade explicitly when one search dependency fails so that learning workflows remain safe and observable.

**Testable outcomes**

1. The response identifies active channels and a degradation code.
2. Results still satisfy authorization, approval, provenance, and minimum relevance requirements.
3. The service returns a typed unavailable response rather than ungrounded context when no safe channel remains.

### 7. Ranking rollout

As a retrieval operator, I want to evaluate and canary a candidate ranking policy so that quality regressions are detected before broad release.

**Testable outcomes**

1. Offline evaluation reports relevance and citation metrics overall and by subject, language, grade, and query type.
2. Canary responses identify the candidate policy while control traffic remains pinned.
3. A kill switch returns all tenants to the last approved policy without rebuilding indexes.

## Acceptance Criteria

1. One hundred percent of requests resolve an authorized tenant, actor or service identity, purpose, content snapshot, chunk set, graph snapshot when used, index manifest, and retrieval policy before candidate generation.
2. Mandatory authorization and rights filters execute within every retrieval channel before result material is returned; post-filter-only implementations do not pass release security tests.
3. On the versioned educational relevance benchmark, hybrid retrieval reaches evidence recall of at least 0.90 at `k=10`, normalized discounted cumulative gain of at least 0.82 at `k=10`, and citation precision of at least 0.95.
4. No enabled subject, language, grade, or query-type cohort with at least 100 judged queries regresses by more than 2 percentage points in recall or nDCG against the approved baseline.
5. Exact-title, formula-symbol, and named-concept benchmark queries reach top-3 success of at least 0.97 using lexical and metadata channels.
6. Every returned chunk satisfies all mandatory filters and has active or explicitly pinned approval status, source provenance, and rights eligibility.
7. Evidence-bundle assembly fits the declared context budget in 100% of contract tests and reports exact tokenizer version and token count.
8. Duplicate or near-duplicate content consumes no more than 20% of a bundle's token budget unless the caller explicitly requests comparative-source evidence.
9. Search requests over a warmed production-sized index complete within 300 ms at p95 and 800 ms at p99 without external reranking; with approved reranking they complete within 900 ms at p95 and 2 seconds at p99.
10. The service sustains the documented peak of 200 search requests per second per production deployment with error rate below 0.5% and without crossing dependency saturation limits.
11. In 10,000 concurrent manifest-activation/read tests, each response uses one internally consistent set of knowledge, chunk, graph, and index versions.
12. Tenant and entitlement isolation tests across vector, lexical, graph, cache, replay, citation, and export paths show zero unauthorized result identifiers, text, counts, or timing-based existence disclosures.
13. When all safe retrieval channels fail or no candidate reaches the configured threshold, the service returns a typed `insufficient_evidence` or `dependency_unavailable` result and no fabricated context.
14. One hundred percent of responses include request ID, policy version, selected manifests, active channel list, applied filters, result ranks, stable result IDs, and resolvable citations.
15. Query text and result content are absent from logs, metrics, and trace attributes; approved audit storage uses encryption, access control, retention, and query hashing.

## Deliverables

- Versioned search, evidence-bundle, replay, explanation, and citation APIs.
- Authorization and rights filter adapter shared by all candidate channels.
- Dense, lexical, metadata, and graph candidate providers with typed degradation.
- Query normalization and bounded expansion policies.
- Rank fusion, reranking, diversity, deduplication, coverage, and token-packing components.
- Atomic retrieval manifest containing compatible knowledge, chunk, graph, lexical, and vector versions.
- Evaluation framework with judged query sets, cohort metrics, replay suites, and regression gates.
- Canary, feature-flag, policy selection, kill-switch, and rollback controls.
- Dashboards, alerts, tracing, audit records, service-level objectives, and operator runbooks.
- Threat tests for tenant leakage, filter bypass, cache poisoning, query injection, and unauthorized replay.

## Dependencies

- Epic 02 supplies approved knowledge snapshots and taxonomy metadata.
- Epic 03 supplies active concept-complete chunk sets and tokenizer metadata.
- Epic 05 supplies approved graph snapshots and bounded traversal APIs.
- Epic 06 supplies compatible vector and lexical index manifests and search adapters.
- Identity, tenant, entitlement, policy, audit, cache, event, and feature-flag services.
- Approved reranking models and model gateway when reranking is enabled.
- Epic 07, Epic 08, Epic 09, and Epic 10 consume retrieval records and evidence bundles.

## Architecture and ADR Links

- [ULIP architecture documentation](../architecture/)
- [ULIP architecture decision records](../adrs/)
- [Epic 03: Adaptive Chunking Engine](epic-03-adaptive-chunking-engine.md)
- [Epic 05: Knowledge Graph](epic-05-knowledge-graph.md)
- [Epic 06: Vector Database Layer](epic-06-vector-database-layer.md)

The implementation must follow architecture contracts for the serving plane, authorization propagation, compatible manifests, and model gateways. Controlling ADR topics are hybrid retrieval, pre-retrieval authorization, source-grounded responses, bounded graph expansion, retrieval record retention, and explicit degradation.

## Data and Security Considerations

- Treat query text as potentially sensitive learner data and minimize its retention. Store a keyed hash for correlation unless raw text is explicitly required and policy-authorized.
- Apply tenant, course entitlement, source rights, lifecycle status, residency, and legal-hold filters independently in each retrieval backend.
- Include authorization scope in every cache key and prohibit shared caches from returning content across scopes.
- Treat queries and retrieved text as untrusted input to downstream models. Delimit evidence, block instruction execution from sources, and preserve citation identity.
- Do not expose raw embeddings, hidden tenant counts, inaccessible source titles, or score distributions that reveal unauthorized content.
- Verify signed retrieval records and manifest IDs before replay. Current authorization always supersedes historical authorization.
- Delete query records, cached content, and derived bundles according to learner and source retention policies while preserving permitted non-content audit evidence.
- Rate-limit abusive queries and bound expansion, graph traversal, result counts, and token budgets.

## Observability

- Emit request, success, insufficient-evidence, degraded, timeout, and error counts by purpose, policy, channel set, and non-identifying cohort.
- Measure p50, p95, and p99 latency for authorization, candidate channels, fusion, reranking, packing, and citation resolution.
- Track recall, nDCG, citation precision, click or educator-selection signals, zero-result rate, duplicate ratio, concept coverage, channel contribution, and canary deltas.
- Trace all retrieval stages with request ID, tenant-safe identifiers, manifest versions, and content-free reason codes.
- Alert when p95 exceeds its SLO for 10 minutes, insufficient-evidence rate doubles from the seven-day baseline, any authorization mismatch occurs, dependency error budget is exhausted, or canary relevance crosses a rollback gate.
- Provide dashboards for traffic, latency, quality, degradation, dependency saturation, cache performance, index freshness, and policy cohorts.

## Rollout and Migration

1. Freeze judged query sets and baseline results for each enabled subject, language, grade, and purpose.
2. Build compatible lexical, vector, and graph indexes in isolated namespaces and validate manifest integrity.
3. Replay production-safe historical queries in shadow mode and compare relevance, citations, latency, and authorization decisions.
4. Enable internal users and pilot tenants with policy and manifest feature flags.
5. Run a 5% canary for at least seven days or the minimum sample needed for the declared quality confidence interval.
6. Increase traffic only when acceptance metrics and all cohort regression gates pass.
7. During migration, support legacy result identifiers through authorized aliases but emit only new retrieval records for new requests.
8. Roll back by changing the tenant's atomic retrieval manifest and policy pointer; cached bundles for the candidate are invalidated by versioned keys.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Semantic search returns plausible but irrelevant context | Combine retrieval channels, calibrate thresholds, rerank, and enforce judged relevance gates. |
| Post-filtering leaks restricted content | Apply authorization in every backend before content return and test identifier, count, cache, and timing channels. |
| Graph expansion overwhelms primary evidence | Restrict edge types and depth, cap graph contribution, and require explicit concept-coverage benefit. |
| Reranker outage raises latency or breaks search | Use deadlines, circuit breakers, typed lexical/vector fallback, and a safe no-result response. |
| Version mismatch produces stale citations | Activate one compatibility-checked retrieval manifest atomically and include it in every response. |
| Personalized queries expose learner data | Minimize query retention, use purpose limitation, encrypt approved audit records, and prohibit content in telemetry. |
| Offline metrics do not reflect classroom use | Use expert judgments, cohort analysis, educator feedback, and guarded online canaries without sacrificing grounding. |

## Definition of Done

- Search, evidence bundle, replay, explanation, citation, and manifest contracts are versioned and documented.
- All acceptance criteria pass on frozen evaluation sets and a production-like load environment.
- Security review confirms pre-retrieval authorization, cache isolation, replay controls, prompt-injection defenses, and learner-data handling.
- Consumers in Epics 07, 08, 09, and 10 pass integration tests using pinned retrieval records.
- Degradation, dependency failure, manifest rollback, and cache invalidation are rehearsed.
- Dashboards, alerts, SLOs, error budgets, quality review cadence, ownership, and incident runbooks are operational.
- Pilot tenants remain within latency, relevance, grounding, and security gates for seven consecutive days.
- Product, education quality, retrieval, security, privacy, and operations owners approve general availability.
