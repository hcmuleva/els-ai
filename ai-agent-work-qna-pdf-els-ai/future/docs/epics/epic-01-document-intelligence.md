# Epic 01: Document Intelligence

## Goal

Build a tenant-isolated ingestion service that converts educational PDF, EPUB, DOCX, PPT/PPTX, TXT, Markdown, and HTML files into immutable, versioned, source-grounded document assets. The service must preserve page, slide, section, and character provenance so every downstream concept, chunk, graph edge, retrieval result, and assessment item can be traced to the exact source version.

## Business and User Value

- Institutions can onboard curriculum material without manual transcription.
- Educators can inspect what was extracted and correct quality issues before publication.
- Learners receive answers and assessments backed by identifiable source passages.
- Platform operators can reprocess content safely as parsers and policies evolve.
- Compliance teams can prove who uploaded content, how it was processed, and which derivative assets used it.

## Scope

### In Scope

- Authenticated upload and batch import of PDF, EPUB, DOCX, PPT/PPTX, TXT, Markdown, and HTML.
- File validation, malware scanning, media-type verification, checksums, and tenant-scoped deduplication.
- Text and layout extraction for digitally generated PDFs.
- OCR routing for scanned or low-text PDF pages.
- Heading, page, paragraph, list, table, formula, and reading-order detection.
- Language detection at document and page level.
- Page-level content quality scoring and processing warnings.
- Immutable source versions with lineage to prior versions.
- Human review states: `processing`, `review_required`, `ready`, `rejected`, and `archived`.
- Provenance coordinates for every extracted span.
- Idempotent retry, quarantine, and reprocessing with a selected pipeline version.
- Events and APIs consumed by downstream intelligence services.

### Out of Scope

- Semantic concept extraction and curriculum alignment.
- Final semantic chunk boundaries.
- Embedding generation or vector indexing.
- Question generation and learner personalization.
- Digital rights acquisition or determination of whether an uploader owns distribution rights.
- Pixel-perfect reconstruction of the source document.

## Personas

- **Content administrator:** uploads licensed educational material and monitors processing.
- **Educator/reviewer:** verifies extraction quality and resolves flagged pages.
- **Learner:** consumes downstream content with trustworthy citations.
- **Platform operator:** investigates ingestion failures and manages reprocessing.
- **Compliance auditor:** reviews content lineage, access history, and deletion evidence.
- **Downstream service:** consumes ready document versions and provenance through stable contracts.

## User Stories

### 1. Secure source registration

As a content administrator, I want to register a document with subject, curriculum, grade band, language, and rights metadata so that ULIP can process it under the correct tenant and policy.

**Testable outcomes**

1. A successful request returns a globally unique `document_id`, immutable `document_version_id`, SHA-256 checksum, and upload status.
2. Missing tenant, rights basis, source title, or file produces a field-level validation response and no source asset.
3. The source object and every generated event carry `tenant_id` and `document_version_id`.

### 2. Reliable extraction

As an educator, I want text, headings, tables, formulas, and page boundaries extracted in reading order so that downstream educational intelligence preserves meaning.

**Testable outcomes**

1. Extracted spans include page number, block type, ordinal, character offsets, and source coordinates when coordinates exist.
2. Scanned pages are automatically routed to OCR when native text density falls below the configured threshold.
3. Pages with uncertain ordering, OCR, or formula extraction are visibly flagged for review.

### 3. Quality review

As an educator, I want a page-by-page quality report so that I can approve usable content and identify pages that need correction.

**Testable outcomes**

1. The report contains text coverage, OCR confidence, reading-order confidence, detected language, and warnings for every page.
2. The document cannot enter `ready` when a blocking quality rule fails.
3. Reviewer decisions store actor, timestamp, reason, and prior state.

### 4. Version-safe replacement

As a content administrator, I want to upload a revised edition without overwriting the prior edition so that existing learning assets remain reproducible.

**Testable outcomes**

1. A replacement creates a new immutable version linked by `supersedes_version_id`.
2. Existing downstream references continue to resolve to the original version.
3. The administrator can archive a version without deleting its audit record.

### 5. Idempotent reprocessing

As a platform operator, I want to rerun a failed or outdated extraction with a selected pipeline version so that recovery never creates duplicate versions or mixed outputs.

**Testable outcomes**

1. Repeating a request with the same tenant, source version, pipeline version, and idempotency key returns the same job identity.
2. Outputs are published atomically only after all blocking validations pass.
3. Failed temporary outputs are inaccessible to downstream consumers.

### 6. Verifiable provenance

As a learner or auditor, I want a citation to resolve to the exact source passage so that an explanation or assessment can be independently checked.

**Testable outcomes**

1. A provenance lookup returns document title, version, page, quoted span, and coordinate reference subject to authorization.
2. A citation cannot resolve across tenant boundaries.
3. Archived source versions remain resolvable for authorized audit use.

## Acceptance Criteria

1. The service accepts valid PDF, EPUB, DOCX, PPT/PPTX, UTF-8 TXT, UTF-8 Markdown, and sanitized HTML up to the configured tenant quota and rejects extension and media-type mismatches before parsing.
2. Every accepted binary is malware-scanned, encrypted in transit, encrypted at rest, and identified by a SHA-256 checksum before entering the processing queue.
3. Repeated ingestion of the same checksum within one tenant creates no duplicate source version unless the caller explicitly requests a separately governed copy; equal checksums in different tenants never disclose that another tenant owns the content.
4. On the approved digital-PDF benchmark, normalized text character recall is at least 99.0%, heading classification macro F1 is at least 0.92, and page sequence accuracy is 100%.
5. On the approved scanned-page benchmark, OCR character error rate is at most 5% for supported languages, or the affected page is placed in `review_required`.
6. One hundred percent of extracted spans contain `tenant_id`, `document_version_id`, page identifier, stable span identifier, parser version, and character offsets; spans from paginated formats also contain source coordinates.
7. A provenance round-trip test maps at least 99.9% of sampled extracted spans back to the same normalized source text and page.
8. Processing is idempotent for identical idempotency keys, and queue redelivery produces one committed output set in 10,000 automated replay attempts.
9. A 300-page, text-native PDF reaches `ready` or `review_required` within 10 minutes at p95 under the documented production load; upload acknowledgement completes within 2 seconds at p95 excluding client transfer time.
10. A parser failure records a stable error code, retains no partially published derivative, and can be retried without manual data repair.
11. Tenant-isolation tests cover API, object storage, job queue, cache, logs, and provenance lookup and show zero cross-tenant reads in the release test suite.
12. State changes and privileged reads create append-only audit events containing actor, tenant, action, target version, timestamp, request ID, and result.
13. Deletion honors configured retention and legal-hold policy: eligible source binaries and derivatives are removed within 24 hours of an approved purge, while non-content audit evidence is retained according to policy.
14. API and event schemas are versioned; backward-incompatible changes require a new major version and a tested dual-read or dual-publish migration.

## Deliverables

- Versioned upload, registration, status, review, archive, reprocess, and provenance APIs.
- Source object storage layout and immutable metadata model.
- Extraction and OCR orchestration with page-level quality evaluation.
- Normalized document schema for pages, blocks, spans, tables, formulas, and provenance.
- Tenant-scoped checksum and idempotency controls.
- Review workflow and rejection reason taxonomy.
- Versioned `document.ready`, `document.review_required`, `document.failed`, and `document.archived` event contracts.
- Benchmark corpus, golden extraction fixtures, isolation tests, load tests, and recovery tests.
- Operator runbook covering quarantine, retry, stuck jobs, parser rollback, and source purge.

## Dependencies

- Identity, tenant, role, entitlement, and quota services.
- Encrypted object storage, malware scanner, queue, relational metadata store, and key management.
- OCR and layout extraction runtimes with approved language packs.
- Curriculum and taxonomy identifiers supplied by tenant configuration.
- Epic 02 consumes ready, normalized document versions.
- Epic 03 consumes source spans and structural signals.
- Epic 07 and Epic 08 depend on preserved provenance for explainable assessments.

## Architecture and ADR Links

- [ULIP architecture documentation](../architecture/)
- [ULIP architecture decision records](../adrs/)
- [Epic 02: Knowledge Intelligence](epic-02-knowledge-intelligence.md)
- [Epic 03: Adaptive Chunking Engine](epic-03-adaptive-chunking-engine.md)

The implementation must follow the architecture contracts for ingestion, lineage, tenant context propagation, and event versioning. Controlling ADR topics are immutable source versions, tenant isolation, deletion semantics, and source citation identity.

## Data and Security Considerations

- Treat source content, uploader identity, annotations, and extracted text as tenant-confidential data.
- Store raw binaries separately from normalized assets and authorize each object operation with tenant and role context.
- Do not place source text, signed URLs, access tokens, learner data, or personally identifiable information in logs or metrics.
- Apply least privilege to parser workers and use short-lived credentials scoped to one job.
- Preserve rights basis, content classification, residency region, retention class, and legal-hold status on every version.
- Sanitize active content, embedded files, external links, and malformed parser payloads before downstream use.
- Use bounded parsing resources and decompression limits to prevent archive, image, and PDF resource-exhaustion attacks.
- Version normalization rules so downstream results can be reproduced from the source checksum and pipeline version.

## Observability

- Emit counters for uploads, pages, OCR routing, quality states, retries, failures, deduplications, archives, and purges by tenant tier and pipeline version without tenant content.
- Emit histograms for upload acknowledgement, queue delay, page processing, total processing, OCR confidence, text coverage, and job age.
- Trace registration, storage, extraction, review, and event publication with one correlation ID and document version attributes.
- Alert when ready-rate drops below 98% over 30 minutes, p95 job age exceeds 15 minutes, dead-letter count is nonzero for 10 minutes, or provenance round-trip failures exceed 0.1%.
- Provide dashboards for throughput, quality distribution, parser-version comparison, tenant quota pressure, backlog, and purge SLA.

## Rollout and Migration

1. Validate schemas and extraction metrics against a versioned golden corpus in a non-production environment.
2. Run shadow extraction on an authorized sample of existing documents without publishing downstream events.
3. Compare old and new outputs for text recall, block ordering, provenance, latency, and storage growth.
4. Enable ingestion for internal tenants, then designated pilot institutions, using tenant feature flags and conservative quotas.
5. Dual-publish the prior and new normalized contracts during one compatibility window when migrating existing consumers.
6. Backfill existing sources as new immutable document versions, retaining links to legacy identifiers.
7. Expand by format, language, and tenant tier only after the preceding cohort meets all quality and error-budget gates for seven consecutive days.
8. Roll back by disabling new registrations for the affected parser version and repointing downstream consumers to the last compatible committed output; never mutate already published source versions.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Complex layouts corrupt reading order | Use block-order confidence, format-specific golden tests, and mandatory review below threshold. |
| OCR errors propagate into assessments | Preserve OCR confidence per span and prevent low-confidence spans from assessment eligibility until reviewed. |
| Copyrighted content is uploaded without authority | Require rights metadata, support takedown and legal hold, and retain auditable uploader attestations. |
| Parser vulnerabilities expose workers | Isolate parsing, scan inputs, deny outbound network by default, and enforce CPU, memory, and time limits. |
| Reprocessing changes downstream meaning | Create immutable versioned outputs and require explicit downstream activation of a new version. |
| Duplicate content wastes storage | Use tenant-scoped checksums while avoiding cross-tenant deduplication disclosures. |
| Deletion leaves derived copies | Maintain a lineage index and execute verified cascades across normalized, chunk, graph, vector, cache, and assessment assets. |

## Definition of Done

- All in-scope APIs, events, schemas, review states, and runbooks are versioned and published.
- Every acceptance criterion passes in automated release evidence.
- Security review confirms tenant isolation, parser sandboxing, secrets handling, audit coverage, and deletion propagation.
- Golden-corpus, load, failure-recovery, idempotency, and provenance tests pass in the production-like environment.
- Epic 02 and Epic 03 consumers successfully process the published contract in integration tests.
- Dashboards, alerts, service-level objectives, ownership, and incident procedures are active before external tenant enablement.
- A pilot cohort meets quality, latency, and availability gates for seven consecutive days.
- Product, education quality, security, privacy, operations, and data governance owners approve general availability.
