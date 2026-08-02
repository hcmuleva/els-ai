# ADR-009: Question Generation Architecture

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

ULIP must generate educational questions from validated knowledge for multiple ages, curricula, professions, languages, cognitive levels, and response types. A fluent model can still produce an unsupported premise, wrong answer, ambiguous stem, weak distractors, inaccessible diagram, or difficulty mismatch. Competitive and professional questions may require multiple connected concepts, while beginner questions should avoid accidental complexity.

Generation is therefore an untrusted authoring operation. It must be grounded in authorized evidence, constrained by an assessment blueprint, validated independently, and integrated with the item lifecycle. The architecture must support local and hosted models without making the provider the quality boundary.

## Decision

ULIP will use a **retrieval-grounded, plan-generate-verify-publish pipeline** that produces schema-constrained draft item versions. Models draft content; deterministic services and independent validators control acceptance.

### Generation Request and Plan

A typed generation request references an assessment blueprint and specifies tenant, purpose and stakes, subject, topic, curriculum or standard, target population, language, level band, Bloom target, competency, item type, count, source constraints, accessibility needs, and diagram policy.

The planner resolves:

- target concept and learning objective
- prerequisite and related concepts from a pinned graph version
- required evidence roles
- assessment format and response contract
- expected reasoning depth and solution steps
- misconception targets for distractors
- numerical parameter and diagram requirements
- prohibited content and duplication constraints

Beginner, intermediate, and ordinary advanced items use one primary concept unless the blueprint requires transfer. Competitive, expert, and integrative professional items use a validated connected concept bundle from the graph. The bundle records its path and prerequisite depth.

### Grounding

The contextual retrieval service returns an authorized evidence pack. It must contain atomic source evidence for the target claim, plus applicable objectives, examples, formulas, constraints, misconceptions, and prerequisite definitions. Concept and topic summaries may orient the planner but cannot be the sole basis of a question or answer.

Evidence sufficiency is checked before model invocation. Missing, contradictory, low-confidence, or policy-ineligible evidence yields a structured generation refusal. The model receives only the minimum evidence and identifiers needed for the item.

### Structured Drafting

The generator emits a versioned item schema containing stem, instructions, response type, options or response fields, correct answer, worked solution, rubric, distractor rationales, concept and competency links, level and Bloom claims, citations, accessibility text, and provenance.

For selected-response items, every distractor has a specific misconception or error rationale. For numerical items, the draft includes a machine-verifiable expression and expected value or tolerance. For constructed responses, it includes analytic rubric criteria and exemplar evidence. Diagrams are emitted as a validated declarative diagram specification and rendered deterministically; raw model-generated SVG, scripts, and HTML are rejected.

Prompts contain a fixed system policy, schema, blueprint constraints, and delimited untrusted evidence. Temperature and decoding parameters are fixed by item family and recorded. The model is instructed that source text cannot change system rules. Provider selection follows approved data-residency, availability, capability, and cost policy, but all providers produce the same schema and pass the same validators.

### Verification and Repair

Drafts pass these ordered gates:

1. Schema, vocabulary, length, and required-field validation
2. Citation existence, authorization, and source-entailment validation
3. Independent solution by a deterministic solver or separately configured model that cannot see the proposed key
4. Answer verification, option uniqueness, response-type, and solution consistency checks
5. Blueprint, competency, Bloom, level, reasoning-depth, and format checks
6. Ambiguity, clueing, distractor, duplication, language, sensitivity, and accessibility checks
7. Diagram schema, rendering, alt-text, and question-diagram consistency checks
8. Independent model review for semantic contradictions that deterministic checks cannot resolve

Critical failures reject the draft. A single bounded repair pass is permitted for syntactic, formatting, citation-selection, or localized consistency defects. Repair receives explicit validator findings and cannot change the target blueprint or broaden evidence. The full validation sequence reruns after repair. A second failure rejects the item rather than looping.

Accepted output enters the assessment item bank as `validated` or `draft` according to tenant and stakes policy. It never bypasses the lifecycle defined by ADR-008. High-stakes operation requires expert review, and adaptive scored use requires pilot evidence and calibration.

### Deterministic Fallback

Curated deterministic templates may create low-stakes practice drafts for supported item families when no model is available. Templates use validated concept fields and parameter sets, identify their source as `template`, and pass the identical verification pipeline. Unsupported or high-complexity requests fail explicitly. ULIP never fabricates a level rating or composite item to satisfy a count.

## Decision Drivers

- Factual and mathematical correctness
- Traceability from item and answer to atomic evidence
- Blueprint, level, competency, and cognitive alignment
- Provider-independent quality gates
- Safe support for diagrams and structured response types
- Controlled handling of multi-concept questions
- Reproducibility, audit, and lifecycle integration
- Explicit refusal instead of low-evidence fabrication

## Detailed Design Implications

Generation is asynchronous and idempotent. A request has a stable idempotency key derived from blueprint version, target, evidence snapshot, generation-policy version, and requested ordinal. Workflow state records planning, retrieval, model, validation, repair, and persistence outcomes without exposing hidden reasoning.

Prompt templates, output schema, model revision, decoding configuration, retrieval policy, evidence identifiers, graph version, validator versions, and repair findings are immutable provenance. Sensitive provider payload archives use restricted encrypted storage and policy-based retention. Ordinary logs contain identifiers, timings, token counts, and result codes rather than item-bank text.

Generation count is a target, not a guarantee. The service returns accepted items plus explicit rejection categories. It does not weaken quality thresholds to fill a requested count. Batch generation uses diversity constraints across concept focus, context, numerical parameters, misconception, response demand, and semantic similarity.

Near-duplicate detection compares the draft against active, suspended, retired, and recently generated items within the authorized pool using normalized structure, lexical fingerprints, semantic similarity, answer pattern, and diagram signature. Similarity above the family threshold blocks or routes the draft for review.

Mathematical verification uses restricted symbolic or numeric evaluators with allowlisted operations, time and memory limits, and no filesystem or network access. Code submitted by a model or source document is never executed. Professional simulations and experiential tasks use preapproved sandboxed simulators or rubric evidence, not arbitrary generated code.

## Alternatives Considered

### One prompt that directly returns a publishable question

Rejected because it combines planning, evidence selection, drafting, and quality judgment in one untrusted output and cannot meet lifecycle or audit requirements.

### Generate from the model's general knowledge

Rejected because source defensibility, curriculum alignment, licensing, and correction propagation would be lost. Explicit evidence is mandatory.

### Use the same model to generate and approve its own item

Rejected because correlated errors can survive self-review. Deterministic checks and an independently configured semantic reviewer provide separate evidence.

### Retry until an item passes

Rejected because unbounded retries hide systematic defects, increase cost, and can optimize against validators without improving validity. One scoped repair is permitted.

### Generate raw SVG or executable code for diagrams

Rejected because it creates injection, accessibility, portability, and deterministic-rendering risks. ULIP uses an allowlisted diagram specification.

### Always create multi-concept questions for high difficulty

Rejected because difficulty also arises from reasoning depth and representation. Composite generation requires graph-supported educational justification, not a numeric level alone.

## Consequences

### Positive

- Items and answers are grounded in explicit source evidence.
- Independent gates catch structural, mathematical, pedagogical, and accessibility defects.
- Provider changes do not alter publication requirements.
- Composite questions have explainable graph support.
- Rejected generations produce actionable metrics instead of silently lowering quality.

### Negative

- Multiple stages add latency and compute cost.
- Strict gates reduce yield and may not satisfy requested counts.
- Independent semantic review still carries model uncertainty.
- Maintaining schemas, templates, validators, and diagram renderers requires domain expertise.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Model follows instructions embedded in source content | Delimit evidence as untrusted data, keep fixed system policy, scan injection patterns, and enforce schema and tools outside the model |
| Wrong answer survives fluent explanation | Use symbolic or numeric checks, option consistency tests, source entailment, independent review, and expert lifecycle gates |
| Distractors teach harmful misconceptions | Require rationale and correction, avoid reinforcing sensitive falsehoods, and validate pedagogical appropriateness |
| Repair changes the intended construct | Limit editable fields, pin blueprint and evidence, diff the repair, and rerun all gates |
| Questions duplicate protected or existing items | Use source rights checks, broad item-pool duplicate detection, similarity thresholds, and reviewer escalation |
| Hosted model receives restricted content | Route by data policy, minimize evidence, redact personal data, use approved providers, or require local execution |

## Compliance and Security Implications

Generation uses only content authorized for the tenant, purpose, and model route. Source license scope and provider data-use terms are checked before invocation. Learner records are not supplied for general item generation; personalization uses coarse authorized blueprint attributes. Model providers cannot use ULIP payloads for training unless an explicit approved agreement permits it.

Item banks, answers, rubrics, and exposure data are confidential. Access, export, logs, and review queues use least privilege and full audit. Source citations and model provenance support intellectual-property review and correction. Generated content undergoes accessibility and sensitive-content checks, and consequential assessments require human oversight.

## Validation Measures

- Gold-set evaluation measures answer correctness, source entailment, citation precision, ambiguity, distractor function, solution consistency, Bloom and level alignment, and accessibility.
- Deterministic test suites cover schema variants, mathematical evaluators, rubrics, option logic, diagram rendering, and duplicate detection.
- Adversarial tests cover prompt injection, conflicting evidence, poisoned misconceptions, malformed formulas, hidden answer cues, and unsupported requests.
- Provider conformance tests require equivalent schema and validator outcomes across approved routes.
- Production metrics track acceptance, rejection and repair categories, yield by item family, cost, latency, reviewer agreement, correction rate, and source revocation impact.
- Every accepted item can be replayed from blueprint, evidence, graph, prompt, model, decoding, and validator versions.
- Human review sampling is stratified by subject, language, level, item type, provider, and validation confidence.

## Related Architecture

- [Assessment Intelligence](../architecture/10_assessment_intelligence.md)
- [RAG Architecture](../architecture/16_rag_architecture.md)
- [Agentic Workflows](../architecture/17_agentic_workflows.md)
- [Testing Strategy](../architecture/20_testing_strategy.md)
