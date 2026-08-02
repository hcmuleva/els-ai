# ADR-004: Contextual Retrieval Strategy

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

Educational queries are often short and ambiguous. "Momentum," "normalization," or "reflection" can refer to different subjects, levels, curricula, or professional contexts. Atomic chunks improve precision but may omit the chapter and learning context that disambiguates them. Dense similarity alone can miss exact formulas and terminology, while keyword search alone misses paraphrases. Retrieval must also respect tenant, license, learner, and content-status policies before any content reaches a model.

ULIP serves explanations, question generation, learning paths, and evidence-backed agent workflows. These tasks need different evidence, but all require a common retrieval discipline: authorized candidates, educational context, provenance, calibrated ranking, diversity, and an explicit response when evidence is insufficient.

## Decision

ULIP will use a **policy-first hybrid contextual retrieval pipeline** with deterministic ingestion context, dense and sparse candidate generation, graph-aware expansion, learned reranking, and evidence sufficiency gates.

### Contextual Index Representation

Each searchable unit has two text representations:

- `content_text`: the source-faithful, human-readable chunk used for citations and generation
- `retrieval_text`: a deterministic contextual header followed by `content_text`

The contextual header contains only validated metadata and knowledge statements: subject, curriculum, level band, document title, chapter or section, topic and subtopic, concept name and type, chunk family, and prerequisite labels. It excludes learner data, access-control values, generated speculation, and unrelated sibling content. The header template and version are stored with the vector point. Dense and sparse representations are both created from the exact `retrieval_text`.

### Query Pipeline

1. Authenticate the caller and derive a non-bypassable policy filter for tenant, organization, license, lifecycle state, language visibility, and content entitlements.
2. Normalize the query and classify intent as fact, explanation, procedure, comparison, assessment grounding, misconception correction, or learning path. Extract explicit subject, topic, curriculum, level, language, and source constraints.
3. Generate dense and sparse candidate sets from Qdrant under the policy filter. Sparse search preserves formulas, names, and exact terminology. Dense search captures paraphrase and semantic intent.
4. Fuse candidate ranks using weighted reciprocal rank fusion. Weights are selected by the deterministic intent class and versioned retrieval policy.
5. Expand only the highest-confidence concepts through bounded PostgreSQL graph operations. Expansion may add prerequisites, definitions, or directly related applications. Expanded candidates pass the same authorization filters and retain the path that justified inclusion.
6. Rerank the bounded candidate set using a versioned cross-encoder against the original query and task instruction. Features may include semantic relevance, exact-term coverage, concept importance, level match, source quality, validation confidence, recency policy, and graph distance.
7. Apply maximal marginal relevance and per-concept and per-document caps to reduce duplicate evidence.
8. Construct an evidence pack with atomic chunks, citations, scores, graph paths, model versions, and policy-safe metadata. Parent summaries may orient the model but cannot replace atomic evidence.
9. Evaluate sufficiency using top score, score margin, source diversity where required, citation coverage, and task-specific evidence rules. If insufficient, the system asks for clarification or returns a bounded no-evidence response rather than inviting unsupported generation.

Query rewriting by an LLM is optional enrichment. The original query always runs, rewrites are limited and logged, and rewritten candidates cannot bypass policy filters or sufficiency gates.

## Decision Drivers

- Disambiguation across subjects, curricula, levels, and source contexts
- Recall for both semantic paraphrases and exact educational notation
- Strong tenant and content entitlement enforcement
- Evidence quality suitable for generation and assessment
- Explainable ranking and reproducible retrieval
- Controlled graph use without context explosion
- Graceful handling of ambiguous or unsupported queries
- Measurable relevance, diversity, latency, and cost

## Detailed Design Implications

The retrieval service is the only supported access path for model-facing educational content. It accepts a typed request containing caller context, task, query, filters, result budget, and retrieval-policy version. It returns a typed evidence pack, not a prebuilt prompt string.

Policy predicates are compiled from trusted identity claims and server-side entitlements. Client filters may narrow but never broaden them. Qdrant performs prefiltering during candidate generation. PostgreSQL graph expansion joins through authorized concepts and sources. A final policy check defends against stale or malformed vector payloads.

Scores from different retrievers are not compared directly. Rank fusion combines ranks, and the reranker produces the final relevance ordering. Raw and normalized scores, exclusion reasons, and stage latency are captured using identifiers, not source text. Retrieval caches are keyed by tenant, entitlement digest, policy version, query digest, index alias, graph version, and task.

Context assembly uses explicit token budgets by evidence role. Atomic supporting chunks are preserved without mid-chunk truncation. When the budget is exceeded, whole low-ranked units are removed. Citations map claims to chunk and source locations. Any generated answer is validated for citation coverage and must not cite contextual headers as source evidence.

## Alternatives Considered

### Dense vector search only

Rejected because exact formulas, names, uncommon terms, and curriculum codes are often poorly recalled, and dense similarity can overvalue broadly related content.

### Sparse keyword search only

Rejected because it performs poorly on paraphrases, conceptual questions, and multilingual wording.

### Put entire parent sections into every chunk

Rejected because it increases index size, dilutes atomic relevance, creates duplicates, and can cross authorization or citation boundaries. ULIP uses a compact deterministic header instead.

### LLM-generated contextual descriptions for every chunk

Rejected as the authoritative index representation because generated context may add unsupported claims and makes regeneration expensive. Validated metadata templates are deterministic; synthetic summaries are indexed separately and labeled.

### Rerank all corpus candidates with a large model

Rejected because it is expensive, slow, and difficult to capacity-plan. Candidate generation and bounded cross-encoder reranking provide predictable cost.

### Post-filter unauthorized vector results

Rejected because unauthorized content could influence ranks, logs, caches, and timing before removal. Mandatory policy filters apply during candidate generation and are checked again afterward.

## Consequences

### Positive

- Short educational queries are disambiguated with validated context.
- Hybrid retrieval covers semantic and exact-match needs.
- Evidence packs are traceable across vector, graph, and reranking stages.
- Policy enforcement occurs before content exposure.
- Sufficiency gates reduce hallucinated or weakly grounded output.

### Negative

- The pipeline introduces more models, indexes, and tuning parameters.
- Cross-encoder reranking adds latency and compute cost.
- Contextual headers increase embedding and sparse-index size.
- Intent classification and graph expansion require ongoing evaluation.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Contextual headers dominate the actual chunk | Keep headers compact, field-weight sparse terms, evaluate ablations, and rerank against content evidence |
| Query rewriting changes user intent | Always execute the original query, limit rewrites, record lineage, and require corroborating candidates |
| Graph expansion creates irrelevant context | Bound depth and degree, permit relation types by task, penalize graph distance, and rerank expanded candidates |
| Reranker bias harms subjects or levels | Evaluate segmented datasets, preserve fallback fusion rank, calibrate thresholds, and review drift |
| Stale policy metadata leaks content | Use immutable policy fields per point, versioned entitlement digests, final authorization checks, and deletion reconciliation |
| Low evidence still triggers confident generation | Enforce task-specific sufficiency gates and structured clarification or no-evidence outcomes |

## Compliance and Security Implications

Authentication, tenant scope, licensing, lifecycle, age suitability, and organizational entitlements are enforced as server-derived filters. Learner profile data used for adaptation is minimized to coarse authorized attributes such as target level and language; it is not embedded into shared indexes or contextual headers.

Queries and retrieved content can contain personal or confidential information. Logs store digests, identifiers, score traces, and policy decisions with controlled sampling of redacted text. Prompt-injection markers in source content do not change retrieval or agent policy; retrieved text is treated as untrusted evidence. Deletion and legal holds propagate to vector points, sparse representations, caches, graph projections, and generated evidence packs.

## Validation Measures

- Offline benchmarks measure Recall@K, nDCG@K, mean reciprocal rank, citation precision, context sufficiency, and duplicate rate.
- Metrics are segmented by subject, level, curriculum, language, format, task, and query ambiguity.
- Ablation tests compare dense, sparse, contextual, graph-expanded, and reranked stages.
- Authorization tests prove that forbidden points never enter candidate sets, graph expansion, logs, or caches.
- Adversarial tests cover prompt injection, metadata spoofing, formula-heavy queries, homonyms, and unsupported topics.
- Online evaluation monitors clarification rate, no-evidence rate, grounded-answer rate, latency percentiles, stage failures, and learner or reviewer feedback.
- Every evidence pack can be replayed from query digest, policy version, index alias, graph version, and model versions.

## Related Architecture

- [Contextual Retrieval](../architecture/07_contextual_retrieval.md)
- [RAG Architecture](../architecture/16_rag_architecture.md)
- [Vector Store Architecture](../architecture/13_vector_store_architecture.md)
- [Security and Governance](../architecture/22_security_and_governance.md)
