# Epic 09: Adaptive Learning

## Goal

Deliver explainable, privacy-preserving adaptive learning that estimates learner mastery from authorized evidence and recommends the next approved learning or assessment activity. Recommendations must respect prerequisites, instructional goals, accessibility, content entitlements, uncertainty, and educator controls while keeping learner state separate from the canonical knowledge graph.

## Business and User Value

- Learners spend more time on appropriate gaps and less time repeating mastered content.
- Educators receive objective-level insight and retain control over goals and assignments.
- Institutions can provide personalized progression using their approved curriculum and sources.
- The platform can evaluate whether adaptation improves learning rather than optimizing only engagement.
- Learners and auditors can understand why an activity was recommended and challenge incorrect state.

## Scope

### In Scope

- Tenant-scoped learner profiles, enrollments, goals, accommodations, and content entitlements.
- Versioned learning-event ingestion for attempts, scores, hints, time, completion, educator observations, and approved imports.
- Objective and concept mastery estimates with uncertainty and complete model lineage.
- Configurable mastery models, including a transparent baseline and qualified Bayesian or item-response extensions.
- Cold-start diagnostics and prior selection based on declared course context.
- Candidate generation from approved content, assessments, prerequisites, and curriculum constraints.
- Policy-based next-activity ranking balancing prerequisite need, target relevance, predicted challenge, spacing, variety, and educator assignments.
- Learning paths with ordered activities, prerequisite rationale, expected outcome, and replan conditions.
- Explainable recommendations and learner-facing state corrections or data challenges.
- Educator override, lock, exclusion, reset, and approval controls.
- Offline evaluation, shadow recommendations, controlled trials, cohort fairness analysis, and safety monitoring.
- Data minimization, consent and guardian policy support, retention, export, and deletion.

### Out of Scope

- Diagnosing medical, cognitive, or psychological conditions.
- Replacing educator judgment or making disciplinary, admission, grading, or high-stakes placement decisions.
- Generating unapproved content directly in the recommender.
- Storing individual learner state in the canonical content graph.
- Optimizing solely for clicks, session duration, or platform dependency.
- Inferring sensitive attributes not supplied for an approved educational purpose.

## Personas

- **Learner:** receives an understandable next activity and can view or challenge relevant learning state.
- **Educator:** sets goals, reviews progress, and overrides recommendations.
- **Parent or guardian:** manages consent and visibility where policy requires.
- **Curriculum designer:** configures progression constraints and target outcomes.
- **Learning scientist:** evaluates model calibration and learning impact.
- **Privacy administrator:** enforces consent, minimization, access, retention, and deletion.
- **Platform operator:** monitors event freshness, model health, and recommendation safety.

## User Stories

### 1. Mastery estimation

As a learner, I want my mastery updated from valid learning evidence so that recommendations reflect what I currently understand.

**Testable outcomes**

1. Each estimate identifies concept or objective revision, probability or level, uncertainty, contributing event range, model version, and update time.
2. Late or corrected events produce a new estimate revision without rewriting prior state.
3. Unsupported or invalid events are quarantined and do not change mastery.

### 2. Explainable next activity

As a learner, I want to know why an activity was recommended so that adaptation feels useful rather than arbitrary.

**Testable outcomes**

1. The explanation names the learning goal, prerequisite or spacing need, evidence used, expected outcome, and approved content source.
2. It distinguishes observed evidence from model inference.
3. It does not reveal hidden answer keys, inaccessible content, or sensitive cohort comparisons.

### 3. Educator control

As an educator, I want to assign, lock, exclude, or reorder activities so that adaptation supports my instructional plan.

**Testable outcomes**

1. Hard educator constraints are applied before model ranking.
2. Overrides record actor, reason, scope, start, expiry, and affected plan version.
3. The interface shows when no eligible activity can satisfy all constraints.

### 4. Prerequisite-aware path

As a learner, I want a path that addresses missing prerequisites before advanced content so that I am not repeatedly presented with tasks I cannot yet solve.

**Testable outcomes**

1. Path construction uses one pinned approved graph snapshot.
2. Every prerequisite detour includes an explainable graph path and exit condition.
3. Cycles, unavailable content, and excessive detours produce typed planning findings.

### 5. Cold start and diagnostics

As a new learner, I want a short diagnostic or conservative starting path so that personalization begins without assuming unsupported mastery.

**Testable outcomes**

1. Initial priors identify their course, grade, curriculum, and policy basis.
2. Diagnostic items come from approved assessment forms and respect accommodations.
3. The system reports high uncertainty until sufficient valid evidence is collected.

### 6. Data rights and correction

As a learner or guardian, I want to inspect, export, correct, and delete eligible adaptive-learning data so that personalization remains accountable.

**Testable outcomes**

1. The export includes learning events, active mastery estimates, model versions, goals, overrides, and recommendation history in a documented format.
2. A correction creates an auditable compensating event and recalculates affected estimates.
3. Approved deletion removes eligible state, recommendations, caches, and model features within policy SLA.

### 7. Safe model rollout

As a learning scientist, I want candidate models evaluated in shadow mode and controlled trials so that changes improve learning and do not harm cohorts.

**Testable outcomes**

1. Offline reports include predictive calibration, ranking quality, prerequisite violations, coverage, and cohort metrics.
2. Shadow recommendations cannot affect learner-visible paths.
3. A trial has predeclared primary outcomes, guardrails, sample criteria, stopping rules, and educator opt-out.

## Acceptance Criteria

1. One hundred percent of accepted learning events contain tenant, pseudonymous learner ID, enrollment, event type, event time, ingestion time, source activity and revision, objective or concept references, provenance, consent basis, and schema version.
2. Event ingestion is idempotent by tenant and event identity; replaying 100,000 duplicate events changes no mastery estimate or aggregate.
3. Invalid, future-dated beyond policy, unauthorized, cross-tenant, or schema-incompatible events are quarantined with stable reason codes and do not enter model features.
4. Every active mastery estimate identifies model and parameter version, content snapshot, contributing event watermark, uncertainty, prior, update reason, and predecessor estimate.
5. On a frozen historical evaluation set, predicted success probabilities have Brier score at most 0.18 and expected calibration error at most 0.05 overall; no cohort with at least 500 eligible outcomes has expected calibration error above 0.08.
6. Recommendation offline evaluation improves or preserves next-activity success prediction and target-objective coverage versus the approved non-adaptive baseline, with no enabled cohort regressing by more than 3 percentage points.
7. One hundred percent of learner-visible recommendations satisfy tenant entitlement, active content status, educator hard constraints, accessibility requirements, age policy, declared goal, and prerequisite safety policy.
8. One hundred percent of recommendations include a learner-readable reason, model or policy version, selected content revisions, mastery revision, graph snapshot when used, and top policy factors.
9. When mastery uncertainty exceeds the configured threshold, the policy selects a diagnostic or conservative activity and does not present the estimate as certain.
10. No recommendation uses a canonical item or content revision that is retired, unapproved, outside rights scope, or incompatible with the selected curriculum snapshot.
11. Recommendation responses complete within 500 ms at p95 and 1.5 seconds at p99 for candidate pools up to 10,000 activities; event-to-estimate freshness is within 60 seconds at p95.
12. In 10,000 concurrent event, model-activation, and recommendation tests, each response uses one internally compatible mastery, content, graph, assessment, and policy version set.
13. Educator hard overrides take effect within 5 seconds at p95, appear in the recommendation explanation, and cannot be silently superseded by model ranking.
14. Tenant-isolation tests cover profiles, events, estimates, recommendations, explanations, experiments, exports, caches, aggregate counts, and administrative tools and show zero unauthorized disclosure.
15. Analytics suppress cohorts below the configured privacy threshold, exclude protected attributes from optimization features unless explicitly approved, and pass the release fairness and privacy review.
16. An approved learner-data deletion makes the profile unavailable to recommendation serving within 15 minutes and removes eligible primary data within 24 hours, with backup expiry and non-content audit retention governed by policy.

## Deliverables

- Versioned learner profile, enrollment, consent, event, mastery, goal, constraint, recommendation, path, explanation, experiment, export, and deletion schemas.
- Idempotent event ingestion, validation, quarantine, correction, and replay services.
- Transparent baseline mastery model and qualification framework for advanced models.
- Mastery feature pipeline with event-time watermarks, late-event handling, revisioning, and uncertainty.
- Candidate eligibility, prerequisite planner, ranking policy, spacing, diversity, and fallback components.
- Learner explanation and educator control APIs.
- Model registry, offline evaluator, shadow mode, experiment assignment, stopping, and rollback controls.
- Privacy-safe analytics, fairness reports, data export, correction, consent, retention, and deletion workflows.
- Historical replay fixtures, synthetic edge cases, load tests, concurrent-version tests, and tenant-isolation tests.
- Learning-science, model-risk, privacy, educator-override, and incident runbooks.

## Dependencies

- Epic 02 supplies approved objectives, competencies, concepts, levels, and curriculum alignments.
- Epic 04 supplies contextual evidence for explanations.
- Epic 05 supplies approved prerequisite paths and graph snapshots.
- Epic 07 supplies approved items, forms, scoring revisions, and objective-level outcomes.
- Epic 08 supplies candidates only through Epic 07 approval, never directly.
- Identity, enrollment, consent, entitlement, audit, feature flag, experiment, secure event, and learner-profile services.
- Learning scientists, educators, privacy owners, and accessibility reviewers.
- Epic 10 orchestrates adaptive activities through typed tools and consumes recommendation records.

## Architecture and ADR Links

- [ULIP architecture documentation](../architecture/)
- [ULIP architecture decision records](../adrs/)
- [Epic 05: Knowledge Graph](epic-05-knowledge-graph.md)
- [Epic 07: Assessment Intelligence](epic-07-assessment-intelligence.md)
- [Epic 10: Agentic Learning Workflows](epic-10-agentic-learning-workflows.md)

The implementation must follow architecture contracts for the learner data plane, canonical content plane, model registry, and policy service. Controlling ADR topics are separation of learner state from the knowledge graph, transparent mastery baselines, educator authority, uncertainty-aware recommendations, and experimentation governance.

## Data and Security Considerations

- Treat learner events, mastery, accommodations, consent, recommendations, and experiment assignments as highly sensitive educational records.
- Use pseudonymous learner keys in analytical and model systems; keep direct identity mapping in a separately controlled service.
- Collect only fields needed for declared learning purposes and prohibit secondary advertising, discipline, or sensitive-trait inference.
- Support age-appropriate consent and guardian workflows according to tenant and jurisdiction policy.
- Encrypt data in transit and at rest, restrict roles by purpose, audit privileged access, and use short-lived service credentials.
- Do not send learner profiles or raw response histories to external models unless separately approved; prefer structured, minimized features.
- Protect exports with step-up authorization, scoped links, encryption, expiry, and audit logging.
- Preserve content version references so estimates remain explainable after content changes, while honoring learner and source deletion policy.

## Observability

- Track accepted, duplicate, late, corrected, quarantined, and deleted events plus event-to-estimate lag.
- Measure mastery calibration, Brier score, expected calibration error, uncertainty, drift, coverage, and model-version distribution.
- Track recommendation eligibility, no-candidate rate, prerequisite detours, override rate, explanation availability, completion, and target progress.
- Report experiment outcomes and guardrails with privacy thresholds and predeclared cohorts.
- Trace event processing, estimate updates, candidate eligibility, graph traversal, ranking, explanation, override, and response using protected identifiers.
- Alert on cross-tenant access attempts, event lag above 60 seconds, explanation absence, prerequisite-policy violation, calibration threshold breach, unusual override spikes, or deletion SLA breach.
- Provide educator and operator dashboards with role-appropriate aggregation and no raw learner content in general telemetry.

## Rollout and Migration

1. Freeze event, mastery, recommendation, explanation, and privacy contracts plus historical evaluation datasets.
2. Import legacy events only when identity, consent, activity revision, objective mapping, and scoring meaning are verifiable; quarantine incomplete history.
3. Run the baseline mastery model and policy in offline replay and compare with expert expectations and non-adaptive progression.
4. Enable shadow estimates and recommendations for internal and pilot tenants without changing learner-visible assignments.
5. Expose mastery and reasons to educators, validate overrides, and correct mapping issues before learner adaptation.
6. Run an approved low-risk trial with predeclared outcomes, guardrails, stopping rules, consent, and educator opt-out.
7. Increase traffic by tenant and course only after learning, fairness, calibration, availability, and override gates pass.
8. Roll back by selecting the prior model and policy versions or returning to the non-adaptive approved sequence; retain immutable recommendation records for audit.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Sparse evidence produces false mastery certainty | Carry uncertainty, use conservative priors, select diagnostics, and communicate limitations. |
| Engagement optimization displaces learning outcomes | Optimize predeclared learning measures and enforce well-being, workload, and educator guardrails. |
| Historical data encodes inequity | Evaluate calibration and outcomes by governed cohorts, restrict features, and require human fairness review. |
| Incorrect graph prerequisites trap learners in detours | Pin approved graph versions, cap detour depth, expose rationale, and allow educator override. |
| Learner profiling violates privacy expectations | Minimize data, separate identity, support consent and rights, and prohibit secondary use. |
| Content changes invalidate mastery | Retain objective and content revision lineage and migrate estimates only through validated mappings. |
| Experimental model harms learning | Use shadow mode, controlled exposure, stopping rules, kill switches, and a safe non-adaptive baseline. |

## Definition of Done

- Learner event, mastery, recommendation, explanation, experiment, control, export, and deletion contracts are versioned and documented.
- All acceptance criteria pass with retained replay, calibration, fairness, privacy, security, concurrency, and load-test evidence.
- Security, privacy, legal, and model-risk reviews approve learner-data handling, consent, features, experiments, exports, and deletion.
- Epics 07 and 10 pass objective-outcome, recommendation, explanation, override, and version-pinning integration tests.
- Shadow, experiment stop, model rollback, non-adaptive fallback, data correction, export, and deletion drills succeed.
- Dashboards, alerts, SLOs, model monitoring, fairness review cadence, ownership, and runbooks are operational.
- Pilot courses meet learning, calibration, fairness, latency, and educator-control gates for the approved evaluation window.
- Product, education, learning science, accessibility, security, privacy, legal, and operations owners approve general availability.
