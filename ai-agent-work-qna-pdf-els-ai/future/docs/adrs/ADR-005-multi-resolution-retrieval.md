# ADR-005: Multi-Resolution Retrieval

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

ULIP must answer narrow factual questions, explain concepts, compare approaches, generate assessments, and build learning paths. These tasks operate at different semantic scales. Evidence spans and leaf chunks provide precise evidence but may not identify the right chapter or conceptual neighborhood. Document summaries provide orientation but are too broad to support individual claims. Retrieving only one scale either misses context or fills the prompt with low-precision content.

The platform also serves large corpora in which exhaustive fine-grained search can return many near-duplicate fragments. A multi-resolution strategy must improve orientation and coverage without allowing generated summaries to masquerade as primary evidence, multiplying authorization complexity, or making retrieval irreproducible.

## Decision

ULIP will maintain a **five-level retrieval hierarchy** and use task-directed coarse-to-fine retrieval with source evidence spans and leaf chunks as the grounding authority.

### Resolution Levels

1. **Evidence span:** The smallest citable source-grounded statement, equation, table or diagram region, or worked step.
2. **Leaf:** A coherent typed learning unit such as a definition with qualifiers, formula, process, worked example, case, misconception and correction, or learning objective.
3. **Concept:** A validated synthesis of a concept across its leaf children. It identifies definition, scope, key relations, and available evidence families.
4. **Section:** A chapter, module, or graph-aligned section summary with its concept inventory and progression.
5. **Document:** A source-level abstract, hierarchy, coverage profile, curriculum metadata, and quality summary.

Corpus-wide taxonomies and graph analytics guide routing but are not embedded as a fifth evidence level. They are queried structurally from PostgreSQL.

Every generated parent unit is explicitly marked `synthetic_summary`, stores sentence-level child evidence, exact child identifiers, and summarizer or template version, and inherits the strictest authorization, license, retention, and lifecycle policy of its children. It can orient retrieval and generation but cannot be cited as the sole support for a factual or assessment claim.

### Retrieval Modes

The retrieval policy selects a mode from task and query characteristics:

- Direct factual, formula, and known-concept queries search evidence, leaf, and concept levels in parallel.
- Broad explanation, comparison, and exploratory queries search section and concept levels first, then retrieve leaf and evidence descendants from the best parents.
- Assessment generation requires concept or section routing followed by source evidence, learning objectives, misconceptions, and prerequisites.
- Learning-path generation begins with structured graph traversal, uses concept and section units for explanation, and resolves every step to leaf chunks and evidence spans.
- Document-specific queries constrain all levels to the requested document before ranking.

Coarse results create routing constraints, not final answers. Fine retrieval searches their descendants and may also retain a small global leaf branch to recover when the coarse router is wrong. The final evidence pack applies cross-resolution reranking, diversity limits, and a token budget. Evidence spans and leaf content receive grounding priority; concept and section summaries receive orientation priority.

### Hierarchy and Identity

Hierarchy links are stored in PostgreSQL as versioned parent-child records. Each node has one structural parent within a document hierarchy, while concept membership and graph relationships may be many-to-many. Qdrant points carry `resolution`, `parent_id`, `ancestor_ids`, `concept_ids`, `document_id`, and versioned policy metadata for filtered search.

Changing children invalidates dependent summaries. Rebuilding creates new summary identifiers and a new hierarchy version. An active index alias and graph version identify the complete retrieval snapshot.

## Decision Drivers

- High precision for narrow questions and adequate context for broad tasks
- Lower duplicate rates and bounded context consumption
- Explicit separation of orientation summaries from source evidence
- Efficient routing over large educational corpora
- Support for assessments and learning paths
- Traceable hierarchy and reproducible retrieval
- Consistent authorization across all semantic scales
- Recovery from incorrect coarse routing

## Detailed Design Implications

Evidence spans come from the document representation, and leaf units are created by the adaptive chunker. Concept summaries are assembled from validated leaves and the canonical concept record. Section summaries are assembled directly from active concepts and supporting evidence in the source hierarchy. Document summaries use active sections and source metadata without treating generated summaries as authoritative evidence. Summarization prompts, models, decoding settings, and child lists are pinned and recorded. Deterministic templates are used where they produce adequate quality.

Summary publication requires source coverage, citation lineage, contradiction, policy-inheritance, and unsupported-claim checks. A summary that fails remains unavailable; its children stay searchable. Summaries are regenerated in dependency order after source or concept changes.

Search budgets specify candidate and final-result allocations by resolution. A broad query receives a small section budget, a larger concept budget, and leaf and evidence budgets. Per-parent caps prevent one chapter from dominating. Cross-resolution score normalization uses reranker scores and role features rather than raw vector scores.

Context assembly labels each item by role. Orientation items appear before supporting evidence but receive a smaller token allocation. The generator is instructed and validated to cite leaf or evidence identifiers. If selected parents have no sufficient source-grounded descendants, retrieval widens once under the same policy and then returns a clarification or insufficient-evidence result.

## Alternatives Considered

### Leaf chunks only

Rejected because broad and exploratory queries have poor orientation, retrieval becomes repetitive, and downstream context assembly must rediscover hierarchy on every request.

### Summaries only

Rejected because summaries omit details, cannot reliably support precise claims, and introduce synthesis risk into citations and assessment generation.

### Always search all resolutions equally

Rejected because it increases candidate volume, duplicate results, latency, and competition between incomparable semantic roles.

### Strict coarse-to-fine retrieval without a global leaf branch

Rejected because a mistaken parent match would hide the correct leaf evidence. A bounded global branch preserves recall.

### Generate parent summaries at query time

Rejected because it adds variable latency and cost, prevents stable embeddings, and makes retrieval results difficult to reproduce.

### Duplicate source text into every ancestor

Rejected because it increases storage, creates redundant hits, obscures citation granularity, and complicates policy changes.

## Consequences

### Positive

- Retrieval can match the semantic scale of each task.
- Broad queries gain orientation without sacrificing source-level grounding.
- Coarse routing reduces duplicate fine-grained candidates in large corpora.
- Hierarchy versions make summaries and retrieval snapshots reproducible.
- Source changes invalidate dependent summaries predictably.

### Negative

- Summary generation and invalidation add processing cost.
- Cross-resolution ranking is more complex than single-index search.
- Hierarchy and policy inheritance require strict consistency checks.
- More points and metadata increase vector and relational storage.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Synthetic summaries contain unsupported claims | Require child-level lineage, entailment and contradiction checks, reviewer sampling, and source-evidence citation rules |
| Coarse routing suppresses the correct branch | Preserve a bounded global leaf search and widen once when descendant evidence is insufficient |
| Summary policy is broader than a child policy | Compute strict policy inheritance, validate at publication, and recheck every returned point |
| Stale summaries survive child changes | Use dependency records, immutable versions, invalidation jobs, and reconciliation scans |
| One resolution dominates ranking | Use role-aware budgets, reranker normalization, per-parent caps, and segmented evaluation |
| Hierarchy does not fit cross-cutting concepts | Separate structural parents from many-to-many concept and graph membership |

## Compliance and Security Implications

Parent summaries inherit the intersection of child access rights and the earliest applicable retention limit. A parent is not published when its policy cannot be represented safely. Tenant boundaries are never crossed during summary assembly or search. Shared summaries are built only from explicitly shared and licensed children.

Summary lineage supports correction, erasure, legal hold, and rights audits. Learner-specific summaries are not stored in the shared hierarchy; personalized context is assembled transiently from authorized records. Logs identify resolution and hierarchy versions without recording source text by default.

## Validation Measures

- Offline benchmarks compare single-resolution and multi-resolution retrieval using Recall@K, nDCG@K, source coverage, duplicate rate, and token efficiency.
- Broad, narrow, assessment, and learning-path query sets are evaluated separately.
- Summary validation measures child coverage, claim entailment, contradiction rate, citation lineage completeness, and reviewer fidelity.
- Tests prove that every final factual claim and assessment item can resolve to leaf chunks and source evidence spans.
- Policy tests verify strict inheritance, tenant isolation, retention, deletion, and stale-summary removal.
- Routing evaluation measures parent accuracy and global-leaf recovery rate.
- Load tests verify bounded candidates, stage latency, vector-store utilization, and context budgets by mode.

## Related Architecture

- [Multi-Resolution Chunks](../architecture/08_multiresolution_chunks.md)
- [Contextual Retrieval](../architecture/07_contextual_retrieval.md)
- [Vector Store Architecture](../architecture/13_vector_store_architecture.md)
- [RAG Architecture](../architecture/16_rag_architecture.md)
