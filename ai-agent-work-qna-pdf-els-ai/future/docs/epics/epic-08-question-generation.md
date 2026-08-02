# Epic 08: Question Generation

## Goal

Generate source-grounded, level-calibrated candidate questions from approved educational evidence and assessment blueprints. Every question, option, answer, solution, rationale, and diagram must be versioned, explainable, machine-validatable, tenant-scoped, and routed through Assessment Intelligence before learner use.

## Business and User Value

- Educators can create reviewed practice material faster while retaining control over correctness.
- Learners receive varied questions aligned to concepts, objectives, level, and curriculum.
- Assessment designers can request exact blueprint gaps instead of accepting generic model output.
- Institutions can audit source evidence, model lineage, validation, and reviewer decisions for each item.
- The platform can operate with multiple approved model providers and refuse unsafe generation when evidence or level calibration is insufficient.

## Scope

### In Scope

- Generation requests constrained by blueprint, concept, objective, competency, Bloom level, item type, difficulty band, language, count, and evidence.
- Retrieval and pinning of source-grounded evidence bundles.
- Single-concept generation for foundational levels and governed composite generation for advanced multi-concept items.
- Candidate item types: single choice, multiple choice, numeric or problem-solving, short answer, scenario, case-based, and configured rubric-based response.
- Misconception-informed distractors with option-level rationale.
- Worked solutions whose steps cite supporting evidence or deterministic calculations.
- Level calibration from beginner through configured competitive and expert bands.
- Structured output validation and repair within a bounded attempt budget.
- Deterministic parametric math templates and deterministic SVG diagram specifications and rendering where appropriate.
- Similarity detection, variant lineage, answer verification, and candidate quality scoring.
- Provider routing through approved Droid, hosted, or deterministic generators with complete lineage.
- Safe fallback: offline generation may create only item forms supported by deterministic evidence and must mark semantic level `unrated`; it cannot fabricate competitive-level items.
- Persistence to the candidate item repository and handoff to Epic 07 review and validation.

### Out of Scope

- Automatic activation of generated items.
- Final assessment form assembly and learner scoring.
- Learner mastery estimation or recommendation.
- Generation from unapproved web content or uncited model knowledge.
- Image generation by non-deterministic models in the initial release.
- High-stakes use without the additional governance required by Epic 07.

## Personas

- **Educator:** requests candidate practice questions and reviews them.
- **Assessment designer:** fills blueprint coverage gaps with constrained items.
- **Subject-matter expert:** verifies answer, solution, level, and evidence.
- **Learner:** consumes only approved generated items and explanations.
- **Generation operator:** manages providers, prompts, cost, latency, and failure modes.
- **Compliance auditor:** inspects generation lineage and source rights.

## User Stories

### 1. Blueprint-constrained generation

As an assessment designer, I want to request items for a precise objective, difficulty, and item type so that generated candidates fill a known blueprint gap.

**Testable outcomes**

1. The request resolves exact knowledge, graph, chunk, retrieval-policy, and blueprint revisions.
2. The generator returns the requested count of valid candidates or a typed shortfall with reason codes.
3. Every candidate repeats the target constraints and reports automated fit scores.

### 2. Source-grounded item and solution

As a subject-matter expert, I want every candidate tied to evidence so that I can verify its stem, answer, and explanation.

**Testable outcomes**

1. Claims in the stem, correct answer, and solution map to authorized evidence spans or deterministic derivation steps.
2. The item stores the retrieval record and evidence bundle identity.
3. Missing or contradictory evidence rejects the candidate rather than inviting the model to guess.

### 3. Misconception-informed distractors

As an educator, I want plausible distractors based on approved misconceptions so that wrong answers reveal useful learning gaps.

**Testable outcomes**

1. Each distractor has a linked misconception or explicit deterministic error pattern and a rationale.
2. Distractors are distinct, grammatically parallel, and not partially correct under the stem.
3. The correct option cannot be inferred from option length, formatting, or rationale leakage.

### 4. Level-aware composition

As an educator, I want advanced questions to combine concepts only when their relationship and prerequisites support it so that difficulty reflects reasoning, not obscure wording.

**Testable outcomes**

1. Advanced composites identify all concept revisions and approved graph paths.
2. The solution demonstrates the required concept transitions.
3. Competitive-band generation is blocked when any required concept level is `unrated` or confidence is below policy.

### 5. Deterministic diagrams

As a learner, I want diagrams that match the question and remain accessible so that visual information is correct on every device.

**Testable outcomes**

1. Diagram-capable items store a validated diagram specification and deterministic SVG.
2. The SVG renders without scripts, external resources, or unbounded coordinates.
3. Text alternatives describe all information required to answer the question.

### 6. Provider-safe retry and fallback

As a generation operator, I want malformed or failed model output handled within a bounded policy so that jobs do not loop or silently degrade quality.

**Testable outcomes**

1. Each attempt records provider, model revision, prompt hash, response-schema version, latency, usage, validation failures, and disposition.
2. Repair attempts cannot change target evidence or blueprint constraints.
3. Exhausted jobs return typed failures and persist no apparently valid candidate.

### 7. Variant creation

As an educator, I want controlled variants of an approved item pattern so that learners can practice without receiving semantic duplicates.

**Testable outcomes**

1. Every variant links to its family and declares changed parameters.
2. Deterministic regeneration with the same seed and template version produces the same content.
3. Similarity and answer-equivalence validation runs across the active exposure pool.

## Acceptance Criteria

1. One hundred percent of persisted candidates contain tenant, candidate and revision IDs, generation request, blueprint revision, concept and objective revisions, source and evidence references, retrieval record, item type, level, correct response, solution, model or template lineage, validation report, and `draft` or `review_required` state.
2. No generated candidate can enter `approved` or `active` directly; all candidates are accepted through Epic 07 lifecycle and policy checks.
3. Every factual statement required to solve an item is supported by the pinned evidence bundle or an explicit deterministic calculation whose inputs are supported by that evidence.
4. On an expert-adjudicated benchmark of at least 1,000 generated candidates across enabled subjects and types, answer correctness is at least 0.97, source-grounding precision is at least 0.98, and objective-fit acceptance is at least 0.90 before human edits.
5. Automated answer verification detects at least 95% of seeded wrong-answer cases and sends all verifier disagreements to `review_required`.
6. Single-choice items contain exactly one fully correct option; multiple-choice items declare the complete correct set and scoring rule; numeric items declare accepted representation, unit, and tolerance.
7. Every distractor is unique after normalization, has an option-level rationale, and is either linked to an approved misconception or labeled with a validated deterministic error pattern.
8. Leakage checks reject candidates where answer position, wording overlap, option length, formatting, metadata, SVG labels, or solution text exposed to the learner makes the correct answer trivially identifiable.
9. Competitive or expert-band generation is rejected when level calibration is `unrated`, confidence is below the approved threshold, evidence is incomplete, or required composite graph edges are not active.
10. Structured generation output passes schema validation in at least 98% of jobs within at most two repair attempts; no job performs more than the configured maximum of three provider calls.
11. Generation of 10 text-only candidates completes within 60 seconds at p95 for the approved interactive provider profile and within 5 minutes at p95 for the approved batch profile.
12. Deterministic template generation produces byte-equivalent question data, answer, solution, diagram specification, and SVG for the same template version and seed.
13. SVG outputs contain no script, event handler, foreign object, external network reference, or disallowed element and pass accessibility, view-box, size, and rendering snapshot tests.
14. Candidate similarity checks prevent exact duplicates and route candidates above the approved semantic-similarity threshold to review unless they are declared variants in the same family.
15. Tenant-isolation tests cover requests, prompts, provider routing, evidence bundles, candidate repository, similarity index, media, caches, and review handoff and show zero unauthorized disclosure.
16. Provider failure, timeout, malformed output, policy rejection, insufficient evidence, and exhausted retry each produce a stable reason code, complete traceable lineage, and no partially published item.

## Deliverables

- Versioned generation request, evidence binding, candidate item, option, solution step, diagram, variant, lineage, validation, and failure schemas.
- Blueprint-to-generation constraint adapter.
- Evidence retrieval and immutable pinning integration with Epic 04.
- Provider gateway for Droid and approved hosted models with deadlines, rate limits, budgets, routing policy, and no-training controls.
- Structured prompt templates, output parsers, bounded repair, and safe fallback orchestration.
- Deterministic math templates, parameter constraints, symbolic answer checks, diagram specifications, and SVG renderer.
- Misconception-based distractor builder and option-level rationale generator.
- Grounding, correctness, level, objective-fit, ambiguity, leakage, duplication, accessibility, and safety validators.
- Candidate repository, variant family model, and Epic 07 item-intake events.
- Expert benchmark, adversarial prompt corpus, deterministic fixtures, rendering snapshots, load tests, and tenant-isolation tests.
- Generation quality, cost, provider incident, and review runbooks.

## Dependencies

- Epic 02 supplies approved concepts, objectives, competencies, misconceptions, and level profiles.
- Epic 03 supplies atomic and composite evidence units.
- Epic 04 supplies pinned evidence bundles and retrieval records.
- Epic 05 supplies approved relationships for multi-concept composition.
- Epic 07 supplies blueprint constraints, candidate intake, validation, review, and activation.
- Approved model providers, model gateway, symbolic math library, SVG renderer, secrets, event, audit, and feature-flag services.
- Subject-matter experts and accessibility reviewers for qualification.
- Epic 09 consumes only approved item revisions selected through Assessment Intelligence.

## Architecture and ADR Links

- [ULIP architecture documentation](../architecture/)
- [ULIP architecture decision records](../adrs/)
- [Epic 04: Contextual Retrieval](epic-04-contextual-retrieval.md)
- [Epic 05: Knowledge Graph](epic-05-knowledge-graph.md)
- [Epic 07: Assessment Intelligence](epic-07-assessment-intelligence.md)

The implementation must follow architecture contracts for model gateways, retrieval records, deterministic rendering, and assessment boundaries. Controlling ADR topics are evidence-constrained generation, generated items as unapproved candidates, semantic level fallback to `unrated`, misconception-based distractors, and deterministic SVG diagrams.

## Data and Security Considerations

- Treat source evidence, prompts, model responses, candidates, answer keys, and review findings as tenant-confidential.
- Route content only to tenant-approved providers and regions; use no-training and minimum-retention provider settings.
- Treat source passages as untrusted data, delimit them from instructions, deny model tool authority, and validate all structured output.
- Do not include learner identity or raw learner responses in generation prompts.
- Keep answer keys and solutions out of learner delivery payloads until Epic 07 release policy permits.
- Sanitize Markdown, HTML, LaTeX, URLs, SVG, and diagram labels before persistence or rendering.
- Propagate source rights, residency, retention, and deletion lineage to candidate items and media.
- Record provider, model revision, prompt template hash, policy, evidence, and validation lineage without logging prompt or response content.

## Observability

- Track requests, candidates, valid yield, shortfall, failure reason, repair attempts, provider fallback, deterministic fallback, review disposition, and edit rate.
- Measure provider and end-to-end latency, token use, estimated cost, schema validity, grounding, correctness disagreement, level fit, duplicate rate, and diagram failure.
- Trace blueprint resolution, retrieval, prompt construction, provider attempts, parsing, validation, persistence, and Epic 07 handoff using content-free identifiers.
- Alert when answer-verifier disagreements exceed 3%, grounding failures exceed 2%, schema validity drops below 98%, p95 interactive latency exceeds 60 seconds, or provider cost exceeds tenant budget.
- Provide dashboards by provider, model, prompt version, subject, item type, level, tenant tier, and review outcome without exposing content.
- Retain sampled content for quality review only in an access-controlled evaluation store with explicit policy and expiry.

## Rollout and Migration

1. Freeze prompt, schema, validator, deterministic template, and expert benchmark versions.
2. Generate only into a non-production candidate repository and adjudicate at least 1,000 items across enabled subjects, levels, and item types.
3. Compare candidate providers and templates on correctness, grounding, objective fit, edit rate, latency, and cost.
4. Enable internal educators with mandatory review and conservative quotas.
5. Pilot selected tenants one subject and item type at a time, maintaining mandatory Epic 07 approval.
6. Enable advanced composites only after graph, level, and multi-concept solution benchmarks pass independently.
7. Import legacy generated questions as draft revisions with known lineage; unsupported or untraceable items require full review.
8. Roll back by disabling the provider, prompt, template, or item-type feature flag and retaining candidates for audit; active items are governed separately by Epic 07.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Fluent output hides a wrong answer | Use independent answer checks, source evidence, expert review, and candidate-only lifecycle. |
| Model uses knowledge outside approved sources | Constrain prompts to evidence, validate claims, and reject unsupported steps. |
| Difficulty reflects wording rather than reasoning | Calibrate concepts, require objective and solution analysis, and benchmark expert level judgments. |
| Distractors are implausible or partially correct | Tie them to reviewed misconceptions or deterministic errors and validate option correctness independently. |
| Prompt injection changes generator behavior | Separate instructions from evidence, remove tool authority, constrain schemas, and test adversarial sources. |
| Diagram content is unsafe or inconsistent | Use constrained deterministic specifications, sanitize SVG, and verify answer and accessibility semantics. |
| Provider outage or cost spike blocks educators | Use budgets, circuit breakers, qualified alternatives, batch queues, and typed shortfall rather than unsafe generation. |

## Definition of Done

- Request, candidate, evidence, solution, diagram, variant, lineage, validation, and failure contracts are versioned and documented.
- All acceptance criteria pass with retained expert, deterministic, adversarial, accessibility, security, and load-test evidence.
- Security and privacy reviews confirm provider routing, prompt-injection defenses, answer-key handling, content sanitization, and tenant isolation.
- Epic 07 passes candidate intake, independent validation, review, activation prevention, and lineage replay tests.
- Provider failure, retry exhaustion, cost limit, feature rollback, and unsafe-output incident drills succeed.
- Dashboards, alerts, SLOs, provider budgets, quality review cadence, ownership, and runbooks are operational.
- Pilot generation remains within correctness, grounding, latency, cost, and review-edit gates for the approved evaluation window.
- Product, assessment, curriculum, subject-matter, accessibility, security, and operations owners approve general availability.
