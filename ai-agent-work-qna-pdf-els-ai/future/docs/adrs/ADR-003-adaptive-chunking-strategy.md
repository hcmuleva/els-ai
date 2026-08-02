# ADR-003: Adaptive Chunking Strategy

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

ULIP needs chunks that work for semantic search, citations, explanations, question generation, and adaptive learning. Fixed page windows split definitions from conditions and examples, while fixed token windows mix unrelated concepts at page boundaries. Educational material also varies widely: a short fact, a multi-step procedure, a theorem with proof, a table, and an experiential case cannot be represented well by one uniform size.

Chunking must be reproducible, provenance-preserving, model-aware, and safe to regenerate. It must preserve educational completeness without creating oversized retrieval units that waste context or hide relevance. The strategy must also cooperate with the multi-resolution retrieval decision rather than attempt to satisfy every query with one text representation.

## Decision

ULIP will use **hierarchical, concept-centered adaptive chunking** over the canonical document model and validated knowledge model.

### Chunk Families

For each validated concept, the chunker creates one or more typed leaf chunks:

- `definition`: meaning, qualifiers, scope, and exceptions
- `explanation`: significance, mechanism, and conceptual connections
- `learning_objective`: measurable Bloom-aligned outcomes
- `formula`: expression, variable meanings, constraints, derivation or use, and example
- `derivation`: premises and contiguous reasoning to a result
- `process`: ordered steps, preconditions, outputs, and failure modes
- `framework`: elements, relationships, and application guidance
- `worked_example`: problem, method, ordered steps, result, and interpretation
- `case_study`: situation, evidence, application, result, and lesson
- `misconception`: incorrect belief, why it fails, correction, and discriminating example
- `correction`: an evidence-backed correction paired with its misconception

Chunks are assembled from semantic units, not raw page or token intervals. A chunk must be understandable without an adjacent chunk. It includes a concept label and enough local qualifiers to resolve pronouns, symbols, abbreviations, and references. It does not repeat an entire chapter merely to be self-contained.

### Adaptive Boundaries

The chunker starts from concept and document-structure boundaries. It keeps tightly coupled material together and separates independently retrievable facts or examples. The configured size is a soft target measured with the active embedding tokenizer. A hard ceiling is enforced for storage and model compatibility.

When a unit exceeds the hard ceiling, it is split only at semantic sub-boundaries. The resulting siblings each carry a concise shared concept frame and explicit `part_index` and `part_count`. Tables split by repeated headers and logical row groups. Procedures split by stage while preserving prerequisites and inputs. Proofs split into claim, premises, and contiguous reasoning segments. A single indivisible equation, table row, or short quotation is never truncated; it is routed to exception handling and excluded if the serving model cannot safely represent it.

Small adjacent units may merge only when they share the same primary concept, source section, authorization scope, language, and pedagogical role. Cross-concept merges are prohibited in ordinary leaf chunks. Explicit comparison and composite-problem leaves may reference multiple concepts but retain one declared educational purpose. Broader multi-concept context is represented by graph bundles and parent summaries.

### Identity, Metadata, and Versioning

Every chunk stores:

- stable chunk and concept identifiers
- chunk family and hierarchy links
- document, section, page or slide, and block provenance
- source checksum and extraction confidence
- subject, topic, subtopic, curriculum, language, and level band
- importance, validation, and review status
- tenant, authorization, retention, and license scope
- chunker, canonical-schema, embedding-model, and tokenizer versions
- token and character counts

The chunk identifier is a deterministic digest of tenant scope, concept identity, family, semantic source span, normalized content, and chunker version. Reprocessing is idempotent. Changed chunks receive new identifiers; lineage records connect superseded versions.

Only knowledge units that pass publication validation are indexed for learner-facing retrieval. Low-confidence units remain in review storage and cannot be rescued by chunking.

## Decision Drivers

- Concept completeness and educational usefulness
- Precise retrieval with bounded prompt cost
- Stable citations and source traceability
- Support for formulas, procedures, tables, and cases
- Level, curriculum, tenant, and policy filtering
- Deterministic regeneration and index migration
- Compatibility with multiple embedding and generation models
- Separation of atomic evidence from broader synthesis

## Detailed Design Implications

Chunk construction occurs after concept extraction, learning-objective generation, assessment classification, and quality validation. It consumes the canonical document structure and knowledge records together. The chunker may reference only evidence linked to the concept. Generated connective language is templated and marked, while source-derived statements retain block citations.

Each family uses a schema rather than a free-form concatenation. The rendered `text` field is optimized for embedding and generation, while structured fields support validation and alternative rendering. For example, a formula chunk retains a structured expression and constraints in addition to readable text.

Concept, section, and document summaries are generated as separate, explicitly synthetic parent chunks with sentence-level evidence maps and links to child identifiers. They cannot serve as sole evidence for factual answers. Chunk siblings and hierarchy relations are persisted in PostgreSQL; searchable text and filter metadata are projected into Qdrant.

Chunk size distributions are calibrated per content family and language using retrieval evaluation, not chosen solely from a nominal context window. A model migration creates a new embedding projection and may create a new chunker version when tokenizer or hard-ceiling differences materially affect boundaries. The old version remains available until shadow validation and cutover complete.

## Alternatives Considered

### Fixed token windows with overlap

Rejected because they frequently split educational units, duplicate evidence, and mix unrelated concepts. Overlap also inflates index size and can cause redundant retrieval.

### One chunk per page or slide

Rejected because layout pages are publication artifacts, not reliable semantic boundaries. Pages can contain several concepts or split one concept across a turn.

### One chunk per chapter

Rejected because chapters are too broad for precise retrieval and consume excessive context.

### LLM-only chunk boundary selection

Rejected because unconstrained boundaries are costly, less reproducible, and harder to audit. LLMs may enrich structure proposals, but deterministic schemas and limits control publication.

### Store only structured fields and assemble text at query time

Rejected because it complicates embedding reproducibility and makes historical retrieval results difficult to reconstruct. ULIP stores both structured content and the exact rendered embedding text.

## Consequences

### Positive

- Retrieved chunks are concept-complete and suitable for explanation or assessment grounding.
- Semantic splitting reduces irrelevant and duplicate context.
- Typed families support specialized validation and query routing.
- Stable identities and exact rendered text make embeddings reproducible.
- Hierarchical links support atomic and broad retrieval without oversized base chunks.

### Negative

- Chunking depends on upstream concept and structure quality.
- Family-specific rules are more complex than windowing.
- Rich metadata and hierarchy increase storage.
- Model or tokenizer migrations may require parallel chunk projections.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Incorrect concept extraction creates bad boundaries | Require validation gates, preserve source structure, measure boundary quality, and support reviewer correction |
| Self-contained framing introduces unsupported claims | Use deterministic templates, cite source blocks, mark synthetic summaries, and run entailment checks |
| Oversized units exceed model limits | Enforce tokenizer-based hard ceilings, semantic split rules, and exception quarantine |
| Small chunks lose necessary context | Add concept frames, hierarchy links, query-time parent expansion, and context sufficiency checks |
| Repeated framing harms retrieval diversity | Deduplicate by semantic source span and cap sibling selection during retrieval |
| Authorization differs across merged evidence | Prohibit merging across tenant, policy, license, or retention scopes |

## Compliance and Security Implications

Authorization, license, retention, and provenance metadata are mandatory chunk fields and are immutable within a chunk version. Chunk assembly cannot combine content with different policy scopes. Search filtering occurs before results are returned, and application-layer authorization is rechecked after retrieval.

Source text included in chunks is minimized to educational necessity. Sensitive personal information detected during ingestion is redacted or quarantined before chunking. Deletion uses lineage to remove chunk records, vector points, summaries, caches, and generated assets derived from the affected evidence.

## Validation Measures

- Schema, provenance, policy-scope, and identifier checks pass for every published chunk.
- Boundary evaluation measures concept purity, semantic completeness, and unsupported cross-boundary references on a labeled corpus.
- Token counts remain under the hard ceiling for every active embedding and generation model.
- Retrieval evaluation reports recall, precision, redundancy, citation correctness, and context sufficiency by chunk family, subject, level, language, and format.
- Reprocessing unchanged inputs with the same versions produces identical chunk identifiers and text.
- Split and merge property tests verify ordering, complete source-span coverage, no unauthorized scope mixing, and no silent truncation.
- Human reviewers score representative chunks for coherence, educational usefulness, and fidelity to source evidence.

## Related Architecture

- [Knowledge Intelligence](../architecture/05_knowledge_intelligence.md)
- [Multi-Resolution Chunks](../architecture/08_multiresolution_chunks.md)
- [Vector Store Architecture](../architecture/13_vector_store_architecture.md)
- [Testing Strategy](../architecture/20_testing_strategy.md)
