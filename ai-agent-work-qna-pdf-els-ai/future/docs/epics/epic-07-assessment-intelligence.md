# Epic 07: Assessment Intelligence

## Goal

Create a governed assessment intelligence layer that turns approved concepts, learning objectives, competencies, misconceptions, and evidence into versioned blueprints, validated item-bank records, assessment forms, scoring rules, and quality signals. The layer must make validity, coverage, provenance, fairness, and scoring behavior explicit before any assessment reaches a learner.

## Business and User Value

- Educators can design assessments against measurable objectives rather than collecting unrelated questions.
- Learners receive fair, level-appropriate assessments with explainable scoring and feedback.
- Institutions can prove which curriculum outcomes were assessed and which content supported each item.
- Question generation gains precise constraints and objective quality gates.
- Product and curriculum teams can improve item quality using governed performance evidence.

## Scope

### In Scope

- Assessment suitability classification for concepts and evidence.
- Versioned assessment blueprints by curriculum, objective, competency, Bloom level, difficulty band, item type, and content coverage.
- Governed item bank for generated and human-authored items.
- Item lifecycle: `draft`, `review_required`, `approved`, `pilot`, `active`, `retired`, and `rejected`.
- Validation for content grounding, answer correctness, ambiguity, distractor plausibility, level fit, objective fit, duplication, accessibility, bias indicators, and answer leakage.
- Assessment form assembly with blueprint coverage, exposure controls, randomization policy, and deterministic version identity.
- Scoring policies for single choice, multiple choice, numeric, short answer, rubric-based response, and partial credit where explicitly configured.
- Reviewer workflows, adjudication, exception policy, and immutable revision history.
- Pilot and operational item statistics including facility, discrimination, option selection, omission, time, reliability, and differential-item-functioning review signals.
- Feedback contracts that link outcomes to objectives, misconceptions, and source-grounded explanations.
- Audit and reproducibility of blueprint, form, item, and scoring versions.

### Out of Scope

- Generation of item text and distractors.
- Learner mastery-model updates and recommendation decisions.
- High-stakes certification without separate legal, psychometric, security, and proctoring approval.
- Automated retirement based solely on a single statistical signal.
- Storage of canonical content graph relationships.
- Open-ended response grading by an unconstrained model without an approved rubric and human escalation policy.

## Personas

- **Assessment designer:** creates blueprints and assembles forms.
- **Subject-matter expert:** validates correctness, relevance, and source grounding.
- **Educator:** assigns assessments and interprets objective-level outcomes.
- **Learner:** completes a fair assessment and receives understandable feedback.
- **Psychometrician:** evaluates reliability, item performance, and fairness signals.
- **Accessibility reviewer:** verifies that items and media can be perceived and answered equitably.
- **Compliance auditor:** reproduces what was presented, scored, and reported.

## User Stories

### 1. Blueprint design

As an assessment designer, I want a blueprint with explicit objective, competency, difficulty, and item-type targets so that the final assessment measures intended outcomes.

**Testable outcomes**

1. Blueprint constraints use stable revisions from one curriculum, knowledge, and graph snapshot.
2. The planner identifies infeasible targets before form assembly.
3. Every approved form reports achieved versus requested coverage.

### 2. Evidence-based suitability

As a subject-matter expert, I want concepts classified by appropriate assessment type so that items match what can be validly measured.

**Testable outcomes**

1. Suitability records identify concept, objective, permitted item types, rationale, confidence, and evidence.
2. Low-confidence or unsupported classifications require review.
3. Item validation rejects a type prohibited by the active suitability policy unless an authorized exception exists.

### 3. Item quality review

As a subject-matter expert, I want a structured review of correctness, ambiguity, distractors, level, and citations so that invalid items never reach learners.

**Testable outcomes**

1. Reviewers see item content, answer and rationale, source evidence, objective, generation lineage, and automated findings.
2. Blocking findings prevent activation.
3. Reviewer edits create a successor item revision and trigger all validations again.

### 4. Reproducible form assembly

As an educator, I want an assessment form assembled from approved items according to a blueprint so that every learner receives a valid version.

**Testable outcomes**

1. Form identity is derived from ordered item revisions, blueprint revision, and assembly policy.
2. Randomization uses an auditable seed and never changes answer correctness.
3. Exposure, overlap, and content-enemy constraints are enforced before publication.

### 5. Deterministic scoring

As a learner, I want my responses scored consistently according to disclosed rules so that results are fair and reviewable.

**Testable outcomes**

1. The scoring record identifies form, item, scoring-rule, rubric, and response revisions.
2. Replaying the same eligible response against the same rule produces the same score.
3. Feedback distinguishes earned credit, correct response, rationale, and objective outcome subject to release policy.

### 6. Assessment quality monitoring

As a psychometrician, I want item and form statistics by governed cohorts so that weak, exposed, or potentially unfair items are reviewed.

**Testable outcomes**

1. Statistics declare sample size, collection window, cohort policy, item revision, and uncertainty.
2. Small cohorts are suppressed according to privacy policy.
3. Threshold breaches open review findings rather than silently changing scores or retiring items.

### 7. Auditable appeal

As a learner or auditor, I want an assessment result reproduced from immutable inputs so that scoring disputes can be resolved.

**Testable outcomes**

1. Authorized replay reconstructs presented item revisions, option order, response, scoring rule, and result.
2. Regrading uses an explicit new scoring revision and preserves the original result.
3. Every administrative score change records actor, reason, authorization, prior value, and new value.

## Acceptance Criteria

1. One hundred percent of approved blueprints identify tenant, curriculum version, knowledge snapshot, target objectives and competencies, item-type distribution, difficulty distribution, total points, timing policy, and review status.
2. One hundred percent of active items identify tenant, immutable item revision, source and evidence references, concept revisions, objective, competency when applicable, Bloom level or `unrated`, difficulty basis, item type, correct response, scoring rule, validation report, and lifecycle state.
3. No item reaches `active` with a blocking correctness, grounding, ambiguity, answer-leakage, duplicate, accessibility, policy, or cross-version validation finding.
4. On an expert-adjudicated validation benchmark, automated answer-correctness checks reach recall of at least 0.95 for seeded errors, ambiguity checks reach recall of at least 0.85, and false-positive rate for all blocking checks remains below 0.10.
5. Blueprint assembly meets 100% of hard constraints and at least 95% of weighted soft targets, or returns a typed infeasibility report and publishes no form.
6. Every active form contains only approved item revisions compatible with the same declared content snapshots and meets configured exposure, enemy-item, duplicate, and source-diversity constraints.
7. Deterministic item types produce byte-equivalent scoring outcomes for identical form, option order, response, and scoring-rule revisions in 100,000 replay cases.
8. Multiple-choice randomization retains the correct-answer mapping in 100% of property-based tests and stores the presented option order for audit.
9. Numeric scoring declares units, tolerance mode, tolerance value, and equivalent representation policy; boundary tests at and around each tolerance pass.
10. Rubric-based scoring stores criterion-level scores and evidence. Responses below configured confidence or with conflicting evaluator outputs enter human review and do not receive a final automated score.
11. Active items have no exact duplicate and no semantic duplicate above the approved similarity threshold within the configured exposure pool unless explicitly grouped as variants.
12. Accessibility validation covers keyboard operation, screen-reader labels, color independence, text alternatives, reading order, and scalable rendering; all blocking WCAG 2.2 AA checks pass for the supported delivery surface.
13. Item statistics suppress cohorts below the configured minimum of 30 learners, and fairness comparisons require at least 200 eligible responses per reported group unless a psychometrician approves a documented alternative.
14. Assessment submission and deterministic scoring complete within 1 second at p95 and 3 seconds at p99 for forms of up to 100 items, excluding human or model rubric evaluation.
15. Tenant-isolation tests cover blueprints, items, forms, responses, scoring, statistics, exports, review queues, caches, and audit replay and show zero unauthorized disclosure.
16. Every published result is reproducible from retained form, item, response, scoring, and release-policy revisions, subject to authorized retention.

## Deliverables

- Versioned suitability, blueprint, item-bank, validation, form, scoring, rubric, response, result, statistics, finding, and appeal schemas.
- Blueprint feasibility and constrained form-assembly services.
- Item validation pipeline for grounding, correctness, ambiguity, leakage, duplication, level, objective, accessibility, and policy.
- Item lifecycle and reviewer workflow with adjudication and immutable revisions.
- Deterministic scoring engine and bounded rubric-evaluation interface.
- Exposure, randomization, enemy-item, overlap, and release-policy controls.
- Item and form analytics jobs with privacy thresholds and uncertainty reporting.
- Auditable replay, regrade, administrative adjustment, export, and retention workflows.
- Expert-labeled error corpus, scoring property tests, accessibility tests, performance tests, fairness test fixtures, and tenant-isolation tests.
- Assessment governance and incident runbooks.

## Dependencies

- Epic 01 supplies source provenance.
- Epic 02 supplies approved concepts, objectives, competencies, misconceptions, level profiles, and suitability evidence.
- Epic 04 supplies version-pinned evidence bundles.
- Epic 05 supplies approved prerequisite and concept relationships.
- Epic 08 supplies candidate generated item revisions and generation lineage.
- Identity, tenant, role, curriculum, feature-flag, audit, event, key management, and secure response stores.
- Qualified subject-matter experts, accessibility reviewers, and psychometricians.
- Epic 09 consumes objective-level results and misconception evidence, not raw answers unless policy permits.

## Architecture and ADR Links

- [ULIP architecture documentation](../architecture/)
- [ULIP architecture decision records](../adrs/)
- [Epic 02: Knowledge Intelligence](epic-02-knowledge-intelligence.md)
- [Epic 04: Contextual Retrieval](epic-04-contextual-retrieval.md)
- [Epic 08: Question Generation](epic-08-question-generation.md)
- [Epic 09: Adaptive Learning](epic-09-adaptive-learning.md)

The implementation must follow architecture contracts for the assessment domain, immutable content lineage, learner-data separation, and policy-controlled models. Controlling ADR topics are blueprint-first assessment, human approval for production items, deterministic scoring, versioned regrading, and learner-result privacy.

## Data and Security Considerations

- Treat item banks, answer keys, forms, learner responses, accommodations, results, and appeals as restricted data with separate role permissions.
- Never send answer keys to a delivery client before release policy permits; avoid embedding correct-answer signals in predictable identifiers, markup, or asset names.
- Separate canonical item content from learner response and identity stores. Use pseudonymous learner identifiers in analytics.
- Encrypt data in transit and at rest, apply least privilege, log privileged reads, and use short-lived credentials for scoring workers.
- Limit model access to the minimum response and rubric fields needed. Do not permit provider training or retention of learner responses without explicit authorization.
- Propagate source rights and deletion lineage while preserving assessment records required by educational or legal policy.
- Apply privacy thresholds and purpose limitations to cohort analytics, accommodations, fairness analysis, and exports.
- Treat generated items, responses, HTML, SVG, formulas, and imported rubrics as untrusted input and validate before rendering or evaluation.

## Observability

- Track blueprint feasibility, item validation findings, review age, approval rate, item activation, exposure, retirement, and form assembly by non-identifying cohort.
- Measure scoring latency, scoring errors, rubric escalation, regrade volume, administrative adjustments, submission failures, and result-release lag.
- Track facility, discrimination, option selection, omission, timing, reliability, duplicate similarity, and fairness review signals with privacy suppression.
- Trace blueprint, evidence retrieval, item revision, validation, review, form assembly, delivery, submission, scoring, and result publication using protected identifiers.
- Alert on answer-key exposure indicators, cross-version form errors, scoring nondeterminism, active blocking findings, p95 scoring above 1 second, or abnormal administrative adjustment volume.
- Provide dashboards for blueprint coverage, item-bank health, review SLA, form quality, scoring health, item statistics, exposure, and appeals.

## Rollout and Migration

1. Freeze schemas, scoring rules, validation fixtures, blueprint examples, and expert-adjudicated error corpus.
2. Import existing items as immutable draft revisions and attach available provenance; items without verifiable answers or evidence remain `review_required`.
3. Run automated validations and two-reviewer adjudication on an internal item pool.
4. Publish internal low-stakes forms, replay every submission, and compare scoring with an independent reference implementation.
5. Pilot selected educator-reviewed forms with consented cohorts and privacy-safe statistics.
6. Enable generated-item intake from Epic 08 only after contract, grounding, and validator gates pass.
7. Expand item types and automated rubric use separately, each behind a feature flag and quality threshold.
8. Roll back by retiring affected form revisions, stopping new assignments, preserving submissions, and regrading through an explicit approved scoring revision when required.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| A grounded item still has a wrong answer | Run independent answer validation, require expert review, and block disagreements. |
| Blueprint constraints produce narrow or biased forms | Add source diversity, item exposure, accessibility, and fairness review gates. |
| Generated distractors reveal the answer | Check lexical and structural leakage and require plausibility and misconception alignment. |
| Item statistics are overinterpreted with small samples | Report uncertainty, suppress small cohorts, and require psychometric review before action. |
| Scoring-rule changes rewrite history | Version rules and results and use explicit regrade events rather than mutation. |
| Answer keys leak through APIs or telemetry | Separate delivery and scoring permissions, defer answer release, redact telemetry, and test client payloads. |
| Automated rubric scoring disadvantages a cohort | Use criterion evidence, confidence thresholds, human escalation, and monitored fairness evaluation. |

## Definition of Done

- Blueprint, item, validation, form, scoring, response, result, statistics, and appeal contracts are versioned and documented.
- All acceptance criteria pass with retained expert, scoring, accessibility, privacy, security, and load-test evidence.
- Security and privacy reviews confirm answer-key protection, learner-data isolation, model handling, authorization, audit, and retention.
- Epics 08 and 09 pass candidate-item intake and objective-result integration tests.
- Form assembly, delivery, scoring, replay, regrade, rollback, and answer-key incident drills succeed in a production-like environment.
- Dashboards, alerts, SLOs, quality governance, psychometric review cadence, ownership, and runbooks are operational.
- Pilot assessments remain within validity, reliability, scoring, accessibility, and availability gates for the approved evaluation window.
- Product, assessment, curriculum, psychometric, accessibility, security, privacy, and operations owners approve general availability.
