# ADR-008: Assessment Intelligence Design

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

ULIP transforms educational sources into knowledge and assessments for school, higher education, professional certification, and experiential learning. Assessment quality requires more than generating questions. The platform must connect claims about capability to observable evidence, balance blueprints, validate items, support formative adaptation, preserve fairness and accessibility, and explain learner recommendations.

Requirements differ by use case. A classroom practice quiz can tolerate automated drafting and rapid feedback, while a certification or summative examination requires expert review, controlled forms, stronger security, and psychometric evidence. A single opaque score or difficulty label cannot serve all contexts safely.

## Decision

ULIP will implement an **evidence-centered, competency-aligned assessment intelligence service** with separate authoring, validation, delivery, and analytics boundaries.

### Evidence Model

Every assessment begins with a versioned blueprint that defines:

- purpose and stakes
- target population, curriculum or professional standard, and language
- knowledge concepts and competency claims
- observable evidence statements
- task and response types
- Bloom or domain-specific cognitive targets
- level and difficulty distribution
- content, source, time, accessibility, and exposure constraints
- scoring and review policy

Items link to concepts, learning objectives, competencies, misconceptions, graph prerequisites, and atomic source evidence. An item can support multiple claims with explicit weights, but one primary claim controls blueprint accounting. Experiential tasks additionally define performance context, observable behavior, artifact evidence, and rubric criteria.

### Item Lifecycle

The item lifecycle is `draft`, `validated`, `in_review`, `pilot`, `operational`, `suspended`, `retired`, and `revoked`. State transitions are policy-controlled and auditable. Generated items enter as drafts and never become operational merely because generation succeeded. Psychometric calibration is versioned separately against the exact pilot or operational item version and population.

Low-stakes formative use may advance a validated item directly to operational only when all hard gates and the tenant's automatic-publication thresholds pass. Summative, progression, credentialing, and other high-stakes uses require independent content and fairness review. Adaptive scored use additionally requires pilot evidence and calibrated parameters.

Item versions are immutable. Corrections create a new version, and prior learner responses remain linked to the delivered version. Exposure, copyright, bias, validity, and source-revocation events can suspend an item immediately.

### Validation

Automated validation checks schema, source entailment, answerability, one or more correct responses as declared, distractor plausibility, mathematical verification, rubric consistency, level and Bloom alignment, duplication, ambiguity, language quality, accessibility, sensitive-content policy, and citation coverage. Subject-matter and assessment reviewers receive the item, rationale, evidence, model provenance, and machine findings.

No single quality score hides a failed critical dimension. Critical failures block progression. Non-critical dimensions are retained separately with thresholds determined by assessment purpose.

### Assembly and Adaptation

Assessment assembly is constraint-based. It selects eligible item versions to satisfy the blueprint while enforcing concept coverage, objective weights, item-type mix, difficulty range, source diversity, time, accessibility, exposure, and enemy-item constraints. Every assembled form stores the blueprint, item versions, selection seed or optimization result, and policy version.

Formative adaptation uses a bounded mastery model over competencies and prerequisites. The initial production model maintains a Beta distribution per learner, concept, curriculum context, and model version. Quality-qualified partial or complete scores add weighted fractional evidence to its alpha and beta parameters, producing a mastery probability and credible-interval uncertainty. Graph prerequisites influence readiness but do not rewrite observed mastery. The next-activity policy balances prerequisite repair, current objective practice, retrieval spacing, and challenge, while honoring blueprint and accessibility constraints.

Calibrated adaptive tests use the two-parameter logistic item response model, with partial-credit extensions for rubric-scored tasks. Selection maximizes information subject to blueprint, exposure, content, accessibility, and stopping constraints. An adaptive score is not used for high-stakes decisions until calibration stability and validity evidence meet the tenant's approved policy.

### Scoring and Feedback

Selected response and deterministic numerical items are machine-scored. Constructed responses use explicit rubrics and may receive model-assisted scoring, but high-stakes scores require human confirmation unless an approved validation study authorizes automation. Feedback cites evidence, identifies the misconception or missing prerequisite, and provides a bounded next step without revealing protected test content.

Learner-facing mastery is shown as a confidence range and evidence history, not as an immutable trait. Recommendations can be overridden by authorized educators and retain the reason for the original and final decision.

## Decision Drivers

- Valid alignment from source knowledge to competency claims
- Different assurance levels for practice and high-stakes use
- Explainable adaptation and learner recommendations
- Item quality, fairness, accessibility, and source defensibility
- Immutable delivery and scoring history
- Support for objective, constructed, and experiential evidence
- Psychometric calibration without premature automation
- Interoperability with learning and assessment systems

## Detailed Design Implications

Authoring and validation run asynchronously. Delivery reads only immutable active forms and item versions. Analytics cannot edit delivered records. Tenant policies define permitted lifecycle states by stakes, reviewer roles, exposure ceilings, scoring methods, and adaptation modes.

Blueprint constraints are represented as typed rules with hard and soft classes. Hard constraints include authorization, active status, required review, accessibility, enemy items, and minimum content coverage. Soft objectives optimize information, diversity, time fit, and exposure. A form that cannot satisfy hard constraints fails assembly with explicit deficits rather than silently relaxing them.

Response events are append-only and record learner pseudonym, assessment and item version, presented option order, timing, attempt, accommodation context, response, score, scoring version, and integrity signals. The mastery service consumes authorized events idempotently. Corrections create compensating scoring events and deterministic mastery replay.

Psychometric statistics are computed only for cohorts meeting privacy and sample-size thresholds. Classical item statistics support early monitoring; item response parameters become operational only after fit, stability, differential-item-functioning, and reviewer checks. Parameters are versioned and scoped to the relevant population.

QTI-compatible export represents portable items and tests. LTI supports launch and grade exchange, and xAPI-style statements support authorized learning-event interoperability. ULIP's richer evidence, lineage, and adaptive metadata remain in versioned extension fields.

## Alternatives Considered

### Generate a quiz directly from retrieved text

Rejected because it omits competency claims, blueprint coverage, lifecycle review, exposure control, calibration, and defensible scoring.

### Use one aggregate quality score

Rejected because a high average could conceal a wrong answer, unsupported claim, accessibility failure, or severe bias issue.

### Fully adaptive testing from first publication

Rejected because stable item parameters and validity evidence require field data. New items can support formative practice but cannot drive calibrated high-stakes adaptation.

### Use an LLM as the sole scorer

Rejected because model drift, prompt sensitivity, bias, and limited auditability are unacceptable, especially for constructed responses and credentialing.

### Treat Bloom level as the competency model

Rejected because Bloom describes cognitive demand, not the domain claim, observable evidence, prerequisite structure, or mastery state.

### Store only final learner scores

Rejected because rescoring, audit, mastery replay, item analysis, and appeals require immutable response and scoring events.

## Consequences

### Positive

- Assessments are traceable from competency claims to source evidence and responses.
- Lifecycle gates match assurance to stakes.
- Blueprint assembly provides balanced, reproducible forms.
- Adaptation is bounded, explainable, and uncertainty-aware.
- Versioned events support rescoring, calibration, and appeals.

### Negative

- Expert review and field testing increase publication time.
- Competency and blueprint authoring require specialized expertise.
- Adaptive and psychometric services add operational and statistical complexity.
- Fine-grained evidence and response events increase protected-data volume.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Generated item is plausible but wrong | Require atomic evidence, deterministic answer checks where possible, critical-dimension validation, and lifecycle review |
| Adaptation reinforces early mistakes | Preserve uncertainty, require repeated evidence, include exploration and spacing, cap path changes, and allow educator override |
| Item exposure damages validity | Apply exposure limits, randomize within constraints, detect scraping, suspend compromised items, and maintain secure pools |
| Bias disadvantages a group | Review content, test accessibility, monitor differential item functioning at safe cohort sizes, and suspend flagged items |
| Model-assisted scoring drifts | Version scoring models and rubrics, use anchor responses, monitor agreement, and require human confirmation by stakes policy |
| Sparse data yields unstable parameters | Keep items in formative or field-test states until sample size, fit, and stability gates pass |

## Compliance and Security Implications

Learner responses, mastery estimates, accommodations, and integrity signals are protected educational records. They are separated from shared knowledge, encrypted, access-controlled by role and purpose, retained according to tenant policy, and excluded from vector embeddings and general model training. Child and student deployments support applicable parental, institutional, and regional controls.

High-stakes item banks use stricter network, role, export, audit, and exposure controls. Accessibility follows WCAG-aligned delivery requirements, including keyboard access, screen-reader semantics, alternatives for diagrams, timing accommodations, and equivalent constructs. Automated recommendations do not make unreviewed consequential decisions. Learners and authorized educators can access explanations, corrections, and appeal paths appropriate to the use case.

## Validation Measures

- Blueprint conformance is verified for every assembled form before publication.
- Critical automated checks must pass, and required reviewer approvals must exist for the declared stakes.
- Gold-set evaluation measures correctness, source entailment, answerability, distractor quality, rubric agreement, Bloom and level alignment, accessibility, and duplication.
- Delivery tests prove immutable item versions, deterministic scoring, option-order capture, idempotent events, and reliable resume behavior.
- Calibration reports evaluate fit, information, stability, exposure, differential item functioning, and construct coverage.
- Mastery-model backtests measure calibration, predictive accuracy, uncertainty, recommendation benefit, and subgroup parity.
- Security exercises cover item extraction, role escalation, tampering, replay, and protected feedback leakage.
- Periodic validity reviews connect scores and recommendations to intended interpretations and use.

## Related Architecture

- [Assessment Intelligence](../architecture/10_assessment_intelligence.md)
- [Competency Mapping](../architecture/11_competency_mapping.md)
- [Adaptive Learning](../architecture/19_adaptive_learning.md)
- [Security and Governance](../architecture/22_security_and_governance.md)
