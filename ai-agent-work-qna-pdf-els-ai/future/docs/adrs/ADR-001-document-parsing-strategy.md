# ADR-001: Document Parsing Strategy

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

ULIP ingests educational material from PDF, EPUB, DOCX, PPT/PPTX, TXT, Markdown, and HTML. The inputs range from born-digital textbooks to scanned worksheets, slide decks, web exports, and instructor notes. Layout, reading order, tables, equations, figures, headings, and page boundaries carry educational meaning. A parser that only emits plain text loses evidence needed for concept extraction, citations, assessment generation, and review. A single third-party parser also creates unacceptable availability, licensing, and format-coverage risk.

Parsing is an evidence-acquisition stage, not a knowledge-generation stage. It must preserve what the source contains, report uncertainty, and never silently invent missing text or structure. Downstream phases need one stable contract regardless of source format, plus enough provenance to trace every derived asset to the original document location.

## Decision

ULIP will use a **format-adapter parsing pipeline with a canonical document model**, native extraction first, and selective OCR as a measured fallback.

1. A dispatcher identifies the format from validated content signatures and the extension. Mismatches are rejected or quarantined.
2. Each format has a bounded adapter:
   - PDF uses embedded text and layout coordinates first, with page-level OCR only when text usability or coverage is below threshold.
   - EPUB and HTML are parsed as a sanitized document tree with navigation order preserved.
   - DOCX and PPTX use package-aware parsers that preserve headings, lists, tables, notes, slide order, and media references. Legacy PPT is converted in a sandbox, and the versioned rendition is retained without replacing the source.
   - TXT and Markdown use deterministic decoding, heading detection, and synthetic page or section boundaries.
3. Adapters emit a versioned canonical model containing document, section, block, span, table, equation, figure, and source-location records. Blocks retain reading order, language, extraction method, confidence, and bounding information when available.
4. Parsing is loss-aware. The canonical model stores normalized text for processing and source-faithful text or a content hash for audit. Normalization is deterministic and does not rewrite educational claims.
5. OCR runs only on weak regions or pages. Its engine, language pack, confidence, and rendered-image checksum are recorded. Low-confidence content is retained with warnings but cannot pass knowledge validation without corroboration or review.
6. Every document receives a stable identifier derived from tenant scope and source checksum. Every block receives a stable identifier derived from document, location, and normalized content. Re-ingesting unchanged content is idempotent.
7. Password-protected, malformed, unsupported, or policy-prohibited inputs fail closed with a machine-readable reason. Successful intermediate artifacts from a partial extraction remain quarantined for review; ULIP publishes a complete canonical document representation only after all completeness and policy gates pass.
8. Original binaries are immutable evidence objects. Parsing outputs are separately versioned so parser upgrades can be compared and rolled back.

## Decision Drivers

- Accurate citations and defensible provenance
- Broad format coverage without weakening the downstream contract
- Preservation of educational structure, equations, tables, and figures
- Deterministic reprocessing and parser-version comparisons
- Efficient handling of mixed born-digital and scanned documents
- Isolation of untrusted document processing
- Graceful degradation without silent fabrication
- Local operation for privacy-sensitive institutions

## Detailed Design Implications

The canonical model is the only contract consumed by discovery, quality analysis, knowledge distillation, graph construction, and chunking. Format-specific details remain in namespaced metadata and cannot become required downstream fields.

Parsing produces a manifest with source checksum, media type, adapter and dependency versions, page or section count, extraction methods, confidence distribution, OCR coverage, warnings, and completeness. Reading-order decisions are explicit. Tables are represented structurally and also receive an accessible linearization. Equations retain source notation where possible and a normalized representation when conversion is reliable. Figures retain references, captions, alt text, and coordinates; visual interpretation is a separate, auditable enrichment step.

The service runs adapters in sandboxed workers with CPU, memory, wall-time, archive-expansion, and page-count limits. Network access is disabled during parsing. OCR concurrency is bounded and results are cached against source and rendering checksums. Parser output is schema-validated before it enters the knowledge pipeline.

Adapter conformance tests use the same canonical fixtures across formats. Parser upgrades run side-by-side on a representative corpus. A material drop in text coverage, reading-order quality, table fidelity, equation fidelity, or citation stability blocks rollout.

## Alternatives Considered

### One universal external parsing API

Rejected because it creates data-residency, availability, cost, and vendor-lock-in risks. It also prevents ULIP from guaranteeing deterministic offline processing and consistent provenance.

### Convert every input to PDF before parsing

Rejected because conversion frequently loses semantic structure, speaker notes, hyperlinks, heading levels, and accessibility information. It also adds rendering variability before evidence capture.

### OCR every page

Rejected because OCR is slower and less accurate than native extraction for born-digital content. It degrades equations and introduces errors that can appear authoritative.

### Emit plain text only

Rejected because plain text cannot reliably preserve reading order, tables, figures, equations, or source coordinates, and therefore cannot support production-grade citations and validation.

### Permit downstream components to parse source files directly

Rejected because it duplicates format logic, creates inconsistent interpretations, and breaks the single provenance chain.

## Consequences

### Positive

- All downstream services operate on one versioned, format-neutral contract.
- Citations can resolve to pages, slides, sections, blocks, and source coordinates.
- OCR cost and error are limited to content that needs it.
- Parser changes are measurable and reversible.
- New formats can be added without changing knowledge-processing interfaces.

### Negative

- Maintaining adapters and canonical-model migrations requires sustained engineering effort.
- Rich layout extraction uses more storage than plain text.
- Selective OCR and structure reconstruction add operational complexity.
- Some equations, reading orders, and complex tables will still require review.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Malicious or malformed documents exploit parser libraries | Run sandboxed, unprivileged workers with no network, strict resource limits, dependency scanning, and rapid patching |
| OCR errors become educational claims | Record confidence and method, require validation thresholds, preserve page evidence, and route low-confidence material to review |
| Incorrect reading order corrupts meaning | Use layout-aware ordering, format-specific fixtures, anomaly checks, and sampled human evaluation |
| Parser upgrades change stable citations | Version outputs, retain original binaries, compare block mappings, and publish migration aliases when locations move |
| Archive-based formats cause decompression exhaustion | Enforce compressed and expanded size, member count, nesting, and media limits before extraction |
| Duplicate uploads create inconsistent records | Use tenant-scoped source checksums and idempotent ingestion keys |

## Compliance and Security Implications

Uploaded files are untrusted. Malware scanning, MIME validation, sandboxing, encryption in transit and at rest, least-privilege object access, and retention enforcement are mandatory. Tenant and document authorization metadata is attached before parsing and propagated to every derived identifier. Logs contain identifiers and metrics, not document text.

The source checksum, parser manifest, and lineage records support auditability and content-rights investigations. Erasure propagates from the original object to canonical blocks, chunks, vectors, and generated assets through lineage. Accessibility information is preserved where present, and extracted alternatives are marked by source and confidence rather than presented as author-supplied.

## Validation Measures

- Canonical schema validation succeeds for every published parse.
- Golden-corpus tests cover every supported format, including malformed and adversarial samples.
- Born-digital text coverage, OCR character error rate, reading-order accuracy, table cell fidelity, equation fidelity, and citation resolution are measured by format.
- Re-ingesting identical input with the same parser version produces identical stable identifiers and equivalent canonical content.
- Selective OCR is verified to affect only weak regions and to record engine confidence.
- Security tests exercise oversized files, archive bombs, active content, path traversal, malformed packages, and parser timeouts.
- Production sampling compares parser output with rendered source pages and records reviewer agreement.

## Related Architecture

- [System Vision](../architecture/01_system_vision.md)
- [Document Intelligence](../architecture/03_document_intelligence.md)
- [Platform Architecture](../architecture/02_platform_architecture.md)
- [Security and Governance](../architecture/22_security_and_governance.md)
