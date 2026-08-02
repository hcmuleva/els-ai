# Epic 02: Knowledge Intelligence

## Goal

Transform approved document versions into a governed educational knowledge layer containing concepts, definitions, examples, formulas, processes, learning objectives, competencies, prerequisites, misconceptions, and curriculum alignments. Every claim must be versioned, tenant-scoped, confidence-scored, and supported by one or more resolvable source spans.

## Business and User Value

- Educators receive structured, reusable knowledge assets instead of searching raw pages.
- Curriculum teams can compare source coverage with required learning outcomes.
- Assessment and learning services can reason over explicit concepts, competencies, and misconceptions.
- Learners receive explanations that disclose source evidence and uncertainty.
- Institutions can review, approve, revise, and audit machine-generated educational interpretations.

## Scope

### In Scope

- Subject, domain, chapter, topic, and subtopic discovery from ready document versions.
- Extraction and normalization of concepts, definitions, facts, formulas, processes, frameworks, examples, and case studies.
- Learning-objective classification using Bloom cognitive levels.
- Competency, skill, outcome, prerequisite, dependency, and related-concept mapping.
- Misconception, correction, and diagnostic-cue extraction.
- Curriculum and grade-band alignment against versioned tenant taxonomies.
- Evidence aggregation from one or more source spans.
- Confidence, educational value, assessment suitability, and completeness scoring.
- Entity resolution within a tenant and explicit cross-document equivalence proposals.
- Human review, approval, rejection, correction, and supersession.
- Deterministic fallback behavior that marks semantic classifications `unrated` when no approved semantic model is available.
- Immutable knowledge snapshots and change sets keyed by pipeline, model, prompt, taxonomy, and source versions.

### Out of Scope

- Final chunk sizing and retrieval indexing.
- Graph persistence and graph analytics beyond emitting relationship candidates.
- Generation of learner-facing questions.
- Learner mastery estimation or recommendations.
- Automatic cross-tenant sharing of knowledge assets.
- Silent model-generated claims without source evidence.

## Personas

- **Subject-matter expert:** reviews extracted concepts and corrects educational meaning.
- **Curriculum designer:** aligns knowledge to standards, objectives, and competencies.
- **Educator:** finds approved definitions, examples, and misconceptions for instruction.
- **Assessment designer:** selects source-grounded concepts and objectives for item creation.
- **Learner:** receives explainable instructional content based on approved knowledge.
- **Knowledge steward:** manages duplicates, version activation, and quality queues.
- **Downstream intelligence service:** consumes stable knowledge snapshot contracts.

## User Stories

### 1. Structured knowledge extraction

As a subject-matter expert, I want educational elements extracted from an approved source so that I can review concepts and evidence rather than manually transcribing content.

**Testable outcomes**

1. Every proposed element has a stable identifier, type, canonical label, source evidence, confidence, and generation lineage.
2. Definitions, formulas, and factual claims preserve the source wording or identify a normalized interpretation.
3. Unsupported proposals are rejected by validation before they appear in a review queue.

### 2. Curriculum alignment

As a curriculum designer, I want concepts mapped to a versioned curriculum taxonomy so that I can measure coverage by standard, subject, grade, and competency.

**Testable outcomes**

1. Each alignment identifies taxonomy version, node identifier, match method, score, and evidence.
2. Low-confidence or ambiguous mappings require review and do not become active automatically.
3. A curriculum-version change creates a new alignment set without rewriting historical mappings.

### 3. Learning-objective and competency mapping

As an assessment designer, I want each approved concept associated with measurable learning objectives and competencies so that generated assessments target explicit outcomes.

**Testable outcomes**

1. Objectives use an observable verb, Bloom level, expected evidence, and assessment suitability.
2. Competency mappings distinguish knowledge, skill, outcome, and recommended assessment type.
3. Contradictory objective and assessment combinations are reported as validation failures.

### 4. Misconception intelligence

As an educator, I want common misconceptions linked to concepts and corrections so that feedback can diagnose why an answer is wrong.

**Testable outcomes**

1. Each misconception contains the incorrect belief, diagnostic cue, correction, explanation, and source or reviewer evidence.
2. A misconception cannot be activated solely from an unverified model assertion.
3. Approved misconception versions remain traceable when a correction is superseded.

### 5. Human governance

As a knowledge steward, I want to approve, reject, merge, split, or correct proposed assets so that production knowledge reflects accountable educational judgment.

**Testable outcomes**

1. Every action records actor, reason, timestamp, prior value, new value, and affected snapshot.
2. Approved assets are never mutated in place; correction creates a successor revision.
3. Merge and split operations retain aliases and lineage from every retired identifier.

### 6. Reproducible regeneration

As a platform operator, I want extraction reruns to produce a comparable change set so that model or taxonomy upgrades can be evaluated before activation.

**Testable outcomes**

1. A run records source, parser, pipeline, model, prompt, policy, and taxonomy versions.
2. Comparison classifies additions, removals, field changes, confidence changes, and relationship changes.
3. Activation is atomic and can be rolled back to the prior snapshot without recomputation.

### 7. Explainable consumption

As a learner or educator, I want each knowledge claim to expose supporting passages and review status so that I can assess trustworthiness.

**Testable outcomes**

1. The API returns claim status, confidence, active revision, and authorized citations.
2. Citations resolve to the immutable document version and exact source span.
3. The response distinguishes quoted source content from model-normalized interpretation.

## Acceptance Criteria

1. One hundred percent of active knowledge assets contain `tenant_id`, stable entity ID, revision ID, asset type, lifecycle status, source version IDs, evidence span IDs, confidence, and complete generation lineage.
2. No active claim, definition, formula, example, objective, competency, prerequisite, or misconception exists without at least one authorized source span or an identified human-reviewed evidence record.
3. On the versioned subject-matter-expert benchmark, concept extraction reaches precision of at least 0.90 and recall of at least 0.85; definition-to-concept linkage reaches macro F1 of at least 0.90.
4. On the approved curriculum benchmark, top-1 taxonomy alignment accuracy is at least 0.88 and top-3 recall is at least 0.95; mappings below the calibrated automatic-activation threshold enter review.
5. Bloom-level classification reaches weighted kappa of at least 0.80 against adjudicated expert labels; deterministic fallback records `unrated` rather than inventing a level.
6. Formula extraction preserves normalized expression equivalence in at least 98% of benchmark cases; non-equivalent or unparseable expressions are flagged and excluded from automatic assessment generation.
7. Entity resolution achieves pairwise precision of at least 0.97 on the duplicate benchmark; no merge is automatically applied below the approved confidence threshold.
8. Every active learning objective includes an observable verb, Bloom level or `unrated`, linked concept, competency or outcome, assessment type, evidence, and review status.
9. Every active misconception includes a diagnostic cue, correction, rationale, linked concept revision, and human or source evidence.
10. Repeating a run with identical inputs and deterministic provider configuration produces byte-equivalent normalized assets excluding timestamps and run IDs; non-deterministic providers produce the same complete lineage and a reviewable diff.
11. Snapshot activation updates all reads atomically. In 10,000 concurrent activation/read tests, no response mixes entities from different snapshot IDs.
12. Knowledge extraction for a 300-page ready source completes within 20 minutes at p95 under the documented production load, excluding time awaiting human review.
13. Cross-tenant authorization tests cover extraction jobs, review queues, aliases, curriculum mappings, evidence lookup, exports, caches, and snapshot activation and show zero unauthorized reads or writes.
14. A rejected or archived source version is removed from new active snapshots within 15 minutes, while historical references remain available only to authorized audit roles.
15. API and event consumers can request a specific snapshot or use the tenant's active snapshot; all responses identify the selected snapshot ID.

## Deliverables

- Versioned schemas for all knowledge asset types and relationship candidates.
- Extraction orchestration for discovery, distillation, concepts, objectives, misconceptions, competencies, and validation.
- Curriculum alignment service using versioned taxonomy inputs.
- Confidence calibration and policy-based auto-activation thresholds.
- Entity resolution, alias, merge, split, revision, and snapshot models.
- Review APIs and reviewer work queues with complete audit history.
- Snapshot comparison, activation, rollback, export, and evidence-resolution APIs.
- Versioned knowledge proposal, review, activation, and retirement event contracts.
- Expert-labeled benchmark datasets, evaluation harnesses, lineage tests, and tenant-isolation tests.
- Operations and educational-quality runbooks.

## Dependencies

- Epic 01 supplies ready normalized document versions and resolvable source spans.
- Tenant identity, authorization, taxonomy registry, event bus, metadata store, and immutable asset storage.
- Approved semantic model providers and deterministic fallback extractor.
- Subject-matter experts and curriculum owners for benchmark adjudication and activation policy.
- Epic 03 consumes approved knowledge and structural evidence for chunking.
- Epic 05 consumes approved entities and relationship candidates.
- Epic 07 and Epic 08 consume objectives, competencies, misconceptions, and assessment suitability.

## Architecture and ADR Links

- [ULIP architecture documentation](../architecture/)
- [ULIP architecture decision records](../adrs/)
- [Epic 01: Document Intelligence](epic-01-document-intelligence.md)
- [Epic 03: Adaptive Chunking Engine](epic-03-adaptive-chunking-engine.md)
- [Epic 05: Knowledge Graph](epic-05-knowledge-graph.md)

The implementation must conform to architecture contracts for source lineage, semantic processing, snapshot publication, and model gateways. Controlling ADR topics are evidence-required claims, immutable revisions, human review policy, tenant-specific taxonomies, and semantic fallback behavior.

## Data and Security Considerations

- Propagate tenant, residency, retention, rights, sensitivity, and legal-hold metadata from every source.
- Keep proposed, approved, rejected, and superseded revisions distinct so downstream systems cannot consume unreviewed content accidentally.
- Treat model prompts and responses as tenant-confidential. Redact unnecessary personal data and prevent provider training or retention unless contractually authorized.
- Enforce provider allowlists by tenant and region. Route data only to models approved for its classification.
- Defend extraction prompts against instructions embedded in source material by treating all source text as untrusted data, never as system instructions.
- Store complete lineage including model family and version, prompt template hash, policy version, taxonomy version, and reviewer decisions.
- Prevent cross-tenant entity resolution. Shared knowledge requires an explicit publication and import contract that creates a tenant-owned revision.
- Apply field-level validation to formulas, links, markup, and generated text before storage or rendering.

## Observability

- Measure proposed and activated assets by type, subject, language, pipeline version, confidence band, and review status.
- Track precision and recall evaluation trends, curriculum alignment accuracy, auto-activation rate, reviewer disagreement, correction rate, unsupported-claim rejection, and duplicate rate.
- Trace each asset from source span through extraction, validation, review, snapshot activation, and downstream event.
- Alert when unsupported claims are nonzero in active snapshots, expert benchmark precision falls below release gates, review backlog age exceeds 48 hours, or activation errors occur.
- Provide dashboards for throughput, model latency and cost, fallback usage, confidence calibration, review SLA, snapshot churn, and source coverage.
- Emit content-free structured error codes and identifiers; never emit source passages or model prompts in telemetry.

## Rollout and Migration

1. Freeze benchmark and taxonomy versions used for release qualification.
2. Generate proposals from an internal, rights-cleared corpus and have two experts adjudicate disagreements.
3. Run the new pipeline in shadow mode beside current repositories and compare entity coverage, evidence, and relationship changes.
4. Permit only manual activation for the first internal and pilot-tenant cohorts.
5. Enable policy-based auto-activation by asset type only after its benchmark and seven-day correction-rate gates pass.
6. Import legacy assets as a separately identified baseline snapshot, attach available source evidence, and route unsupported assets to review instead of fabricating citations.
7. Dual-read legacy and new identifiers during the compatibility window, using aliases generated by reviewed entity resolution.
8. Roll back by atomically selecting the prior snapshot and pausing proposal event consumption; immutable historical revisions remain intact.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Model hallucination creates unsupported educational claims | Require evidence for activation, validate claim coverage, and route uncertain proposals to expert review. |
| Curriculum mappings encode the wrong standard version | Store taxonomy versions on every mapping and regenerate rather than overwrite when standards change. |
| Aggressive deduplication merges distinct concepts | Optimize automatic resolution for precision, preserve aliases, and require review for ambiguous pairs. |
| Model upgrade changes difficulty or objective labels | Calibrate against frozen benchmarks and compare immutable snapshots before activation. |
| Source bias becomes platform truth | Preserve source attribution, support multiple sources and dissenting revisions, and expose confidence and review status. |
| Reviewer workload blocks onboarding | Prioritize by downstream value and uncertainty, batch similar decisions, and activate only high-confidence asset types under explicit policy. |
| Prompt injection in educational text changes extraction behavior | Isolate source text in structured inputs, enforce output schemas, deny tool authority, and test adversarial corpora. |

## Definition of Done

- All knowledge schemas, lifecycle states, evidence rules, APIs, event contracts, and snapshot operations are versioned and documented.
- All acceptance criteria pass with retained automated and expert-adjudicated evidence.
- Two qualified reviewers approve benchmark labels and the release quality report for each enabled subject or language.
- Security and privacy reviews confirm model routing, prompt-injection controls, tenant isolation, auditability, and deletion propagation.
- Epics 03, 05, 07, and 08 pass contract integration tests against a selected knowledge snapshot.
- Dashboards, alerts, service-level objectives, cost controls, ownership, and educational-quality escalation are operational.
- Legacy migration and rollback are rehearsed in a production-like environment.
- Product, curriculum, subject-matter, security, privacy, data governance, and operations owners approve general availability.
