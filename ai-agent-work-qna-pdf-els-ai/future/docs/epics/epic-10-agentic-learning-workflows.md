# Epic 10: Agentic Learning Workflows

## Goal

Provide controlled agentic workflows that orchestrate ULIP retrieval, explanation, assessment, question-generation, and adaptive-learning capabilities through versioned state machines and typed tools. Workflows must be source-grounded, tenant-authorized, observable, resumable, budget-bounded, and unable to bypass domain approval or learner-safety policies.

## Business and User Value

- Learners can ask for explanations, practice, and learning paths through one coherent interaction.
- Educators can launch repeatable workflows and approve consequential outputs.
- Institutions can extend ULIP through stable tools without giving agents unrestricted database or model access.
- Platform teams can replay, inspect, resume, and roll back workflows instead of debugging opaque chains.
- Compliance teams can identify every tool call, content version, model decision, and human approval that produced an outcome.

## Scope

### In Scope

- Versioned LangGraph state machines for quiz preparation, explanation, and adaptive learning-path workflows.
- A workflow service exposed through authenticated MCP tools and service APIs.
- Typed tools for contextual retrieval, graph traversal, assessment blueprint resolution, candidate generation, approved item selection, mastery retrieval, recommendation, citation resolution, and persistence.
- Tenant, actor, learner, purpose, entitlement, content snapshot, policy, and budget context propagation.
- Durable checkpoints, idempotent steps, resumability, cancellation, timeout, retry, compensation, and dead-letter handling.
- Explicit planning from a constrained action set and deterministic routing where model judgment is unnecessary.
- Human approval gates for generated assessment publication, educator overrides, sensitive exports, and configured high-impact actions.
- Evidence and citation checks before learner-facing output.
- Per-workflow limits for wall time, model calls, tool calls, tokens, cost, graph depth, retrieval results, and output size.
- Model-provider routing through an approved gateway, with structured inputs and outputs.
- Complete workflow lineage, state-transition audit, replay, version migration, canary, and kill switch.
- Direct SDK mode for controlled development and recovery while preserving the same authorization and tool contracts as MCP.

### Out of Scope

- General-purpose autonomous browsing, shell access, arbitrary code execution, or unrestricted database queries.
- Allowing an agent to approve generated assessment items or change canonical knowledge.
- Autonomous high-stakes grading, placement, discipline, admissions, or certification decisions.
- Treating model chain-of-thought as an audit artifact or exposing it to users.
- Long-term conversational memory outside approved learner and interaction data contracts.
- Tool discovery from untrusted sources at runtime.

## Personas

- **Learner:** requests an explanation, practice activity, or learning path and receives cited results.
- **Educator:** starts workflows, sets constraints, reviews outputs, and approves selected actions.
- **Learning agent client:** invokes typed ULIP MCP tools under delegated authority.
- **Workflow designer:** defines state transitions, policies, schemas, and compensation.
- **Platform operator:** monitors executions, checkpoints, dependencies, budgets, and incidents.
- **Security auditor:** reviews tool authorization, prompt-injection defenses, and action history.
- **Compliance auditor:** reproduces the versions and approvals behind an outcome.

## User Stories

### 1. Grounded explanation workflow

As a learner, I want an explanation built from my approved course sources so that I can verify and understand it.

**Testable outcomes**

1. The workflow retrieves evidence before generation and pins the retrieval record.
2. The final response maps every material factual claim to one or more citations.
3. Insufficient or conflicting evidence produces an explicit limitation or escalation rather than an unsupported answer.

### 2. Governed quiz workflow

As an educator, I want a workflow to resolve a blueprint, retrieve evidence, generate candidates, validate them, and submit them for review so that no orchestration step bypasses assessment governance.

**Testable outcomes**

1. The workflow records each blueprint, evidence, candidate, and validation revision.
2. Generated candidates finish in an Epic 07 review state, never `active`.
3. Publication waits for an authorized human or domain-service approval event.

### 3. Adaptive learning-path workflow

As a learner, I want a path based on my goals and learning evidence so that activities address prerequisites and current mastery.

**Testable outcomes**

1. The workflow uses one compatible mastery, graph, content, assessment, and policy version set.
2. Each activity includes eligibility, prerequisite, objective, and recommendation rationale.
3. Educator locks and learner accessibility constraints are enforced before presentation.

### 4. Resumable execution

As a platform operator, I want long-running workflows checkpointed so that transient failures do not repeat completed external side effects.

**Testable outcomes**

1. Each state transition writes an atomic checkpoint with state schema version and idempotency key.
2. Resume continues from the last valid checkpoint and revalidates current authorization.
3. A side-effecting tool call stores its outcome before the workflow advances.

### 5. Controlled tool authority

As a security auditor, I want each tool call separately authorized and schema-validated so that an agent cannot expand its own privileges.

**Testable outcomes**

1. Tool credentials are short-lived and scoped to tenant, actor, purpose, workflow, and allowed operation.
2. Tool arguments are validated against a versioned schema and server-side policy.
3. Text from users or sources cannot register tools, change policy, or override system instructions.

### 6. Budget and cancellation control

As an educator or operator, I want limits and cancellation so that workflows cannot consume unbounded time or model cost.

**Testable outcomes**

1. The workflow reports remaining tool, model, token, cost, and time budgets at every decision step.
2. Budget exhaustion follows a declared fallback or terminates with a typed result.
3. Cancellation stops new side effects within the defined SLA and records the final checkpoint.

### 7. Reproducible audit

As a compliance auditor, I want to replay a completed workflow with retained versions so that I can explain how the outcome was produced.

**Testable outcomes**

1. The execution record identifies workflow definition, state schema, prompts, models, tools, policies, manifests, approvals, and outputs.
2. Deterministic replay stubs external effects and reproduces the same transition path from recorded tool results.
3. Replay uses current authorization and cannot reveal content that is no longer accessible.

### 8. Safe workflow rollout

As a workflow designer, I want a candidate definition shadowed and canaried so that transition, quality, latency, and cost regressions are caught before broad release.

**Testable outcomes**

1. Existing executions stay pinned to their starting workflow version unless an explicit compatible migration runs.
2. Shadow mode cannot create external side effects.
3. A kill switch blocks new starts and routes eligible requests to the last approved workflow or a typed unavailable response.

## Acceptance Criteria

1. One hundred percent of workflow executions identify tenant, actor or service identity, delegated learner when applicable, purpose, workflow and state-schema versions, policy version, content manifests, budget, start time, and correlation ID.
2. Every tool is allowlisted, versioned, schema-validated, independently authorized, deadline-bounded, idempotency-aware, and classified as read-only or side-effecting.
3. No workflow can call a raw database, vector store, shell, filesystem path, network URL, or model provider outside approved typed adapters and network policy.
4. One hundred percent of learner-facing material factual claims from the explanation workflow have resolvable authorized citations, or the response explicitly identifies insufficient evidence and contains no unsupported claim.
5. Quiz workflow tests show zero paths from generated candidate to `active` without the Epic 07 approval contract and authorized approval identity.
6. Adaptive path workflow tests show zero violations of tenant entitlement, educator hard constraints, accessibility requirements, item approval, source rights, or prerequisite safety.
7. Checkpoint recovery across 10,000 injected worker, network, timeout, and dependency failures produces no duplicate side effect and no skipped committed state.
8. Repeated delivery of the same start or resume request with an idempotency key returns the same workflow identity and does not duplicate external effects.
9. Cancellation prevents initiation of new side-effecting calls within 2 seconds at p95 and reaches a terminal `cancelled` or `compensation_required` state within 30 seconds at p95.
10. Default workflow policy limits one execution to at most 8 model calls, 20 tool calls, 50,000 input and output tokens combined, 5 minutes wall time, and the tenant's configured cost ceiling; exceeding any limit cannot trigger another model or tool call.
11. Explanation requests complete within 15 seconds at p95, learning-path requests within 20 seconds at p95, and synchronous quiz preparation acknowledgement within 2 seconds at p95 with long generation continuing asynchronously.
12. Structured model decisions pass schema validation before routing. Invalid decisions receive at most one repair attempt before deterministic fallback or typed failure.
13. Tenant-isolation tests cover workflow state, checkpoints, queues, tool calls, model prompts, retrieval, learner context, approvals, caches, exports, replay, and operator interfaces and show zero unauthorized disclosure.
14. Prompt-injection tests covering user text, source documents, retrieved chunks, tool output, and generated content show zero successful changes to tool allowlists, authorization scope, system policy, approval state, or data destination.
15. Every state transition and tool invocation records timestamp, actor or service, input hash, output hash, schema version, authorization decision, model or tool version, latency, result code, and predecessor state without storing secrets or hidden chain-of-thought.
16. Candidate workflow rollout blocks activation if success rate is below 99%, grounding or policy-violation rate is nonzero, p95 latency regresses by more than 20%, or median model cost regresses by more than the approved budget.

## Deliverables

- Versioned workflow envelope, state, checkpoint, transition, tool, budget, approval, cancellation, replay, and terminal-result schemas.
- LangGraph definitions for grounded explanation, governed quiz preparation, and adaptive learning path.
- Authenticated MCP workflow server and equivalent internal API.
- Typed adapters for Epics 04, 05, 07, 08, and 09 plus citation and persistence services.
- Tenant and delegated-authority propagation, per-tool authorization, short-lived credentials, and policy enforcement.
- Durable checkpoint store, idempotency, leases, resume, cancellation, compensation, timeout, queue, and dead-letter components.
- Approved model gateway integration with structured routing, bounded repair, and deterministic fallback.
- Evidence-grounding guard, output policy checks, human approval gates, and safe terminal responses.
- Workflow registry, compatibility rules, shadow mode, canary, migration, kill switch, replay, and audit viewer.
- Fault-injection, prompt-injection, authorization, deterministic replay, load, cost, and tenant-isolation test suites.
- Workflow authoring, operations, security incident, cost control, and recovery runbooks.

## Dependencies

- Epic 04 supplies versioned contextual retrieval and citation resolution.
- Epic 05 supplies bounded, version-pinned graph traversal.
- Epic 07 supplies blueprints, approved items, validation, review, scoring, and approval boundaries.
- Epic 08 supplies candidate generation and generation lineage.
- Epic 09 supplies mastery, eligibility, recommendations, explanations, and educator controls.
- Identity, tenant, delegated authorization, policy, secrets, model gateway, queue, checkpoint, audit, feature-flag, and notification services.
- LangGraph runtime, MCP transport, Droid client integration, and approved direct adapters.
- Security, education, assessment, privacy, and operations owners for workflow approval.

## Architecture and ADR Links

- [ULIP architecture documentation](../architecture/)
- [ULIP architecture decision records](../adrs/)
- [Epic 04: Contextual Retrieval](epic-04-contextual-retrieval.md)
- [Epic 07: Assessment Intelligence](epic-07-assessment-intelligence.md)
- [Epic 08: Question Generation](epic-08-question-generation.md)
- [Epic 09: Adaptive Learning](epic-09-adaptive-learning.md)

The implementation must follow architecture contracts for the serving plane, MCP boundary, LangGraph orchestration, identity propagation, and domain ownership. Controlling ADR topics are deterministic-first orchestration, typed least-privilege tools, durable checkpoints, bounded agent budgets, human approval gates, and no chain-of-thought retention.

## Data and Security Considerations

- Reauthorize every tool call. Starting a workflow does not grant permanent authority, and resume must evaluate current tenant, actor, learner, entitlement, consent, and source status.
- Give agents no raw credentials. Issue short-lived, audience-bound tokens to the workflow service or tool adapter.
- Treat user input, retrieved evidence, tool output, generated content, and checkpoint payloads as untrusted data, never as executable instructions.
- Separate system policy, workflow definitions, tool schemas, and tenant configuration from model-visible untrusted content.
- Minimize learner data in model prompts, use pseudonymous identifiers, and route only through approved regions and providers.
- Encrypt checkpoints and audit records, redact secrets and content from telemetry, and apply per-domain retention and deletion.
- Do not retain or request hidden chain-of-thought. Store structured decisions, selected actions, citations, policy outcomes, and concise user-facing rationale.
- Protect MCP and internal APIs with mutual authentication, replay protection, rate limits, schema size limits, and network allowlists.

## Observability

- Track workflow starts, active states, completions, cancellations, failures, compensation, dead letters, resumes, and version distribution.
- Measure end-to-end and state latency, queue wait, tool and model calls, retries, tokens, cost, budget exhaustion, checkpoint age, and duplicate suppression.
- Track grounding completeness, insufficient evidence, approval wait, policy denial, prompt-injection findings, fallback use, and human correction.
- Trace every state transition and tool call under one correlation ID with workflow, policy, schema, and content manifest versions.
- Alert on any policy or tenant violation, duplicate side effect, grounding failure, checkpoint write failure, dead-letter growth, stuck state age, p95 SLO breach, or cost-budget anomaly.
- Provide dashboards for workflow health, state funnels, dependencies, versions, quality, cost, approvals, safety, and tenant-safe usage.

## Rollout and Migration

1. Freeze workflow, state, tool, approval, and audit contracts and create deterministic golden execution fixtures.
2. Run workflows against recorded tool responses and inject failures at every transition and side effect.
3. Enable internal direct mode, then MCP mode, while comparing authorization and outputs for contract equivalence.
4. Shadow production-safe requests with all side effects stubbed and compare transition paths, grounding, latency, and cost.
5. Enable internal educators and designated pilot tenants with conservative budgets and mandatory approvals.
6. Canary one workflow type and version at a time; keep executions pinned to their start version.
7. Migrate active executions only through a tested state-schema transformation with validation and a preserved pre-migration checkpoint.
8. Roll back by disabling new starts for the candidate, allowing safe pinned executions to finish or cancel, and routing new requests to the prior approved workflow.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Agent follows malicious instructions in source text | Delimit untrusted data, constrain actions to typed tools, enforce server-side policy, and run adversarial tests. |
| Retries duplicate generated items or notifications | Require idempotency keys, atomic checkpoints, recorded side effects, and compensation states. |
| Model planning is costly and nondeterministic | Use deterministic routing where possible and cap model calls, tokens, cost, and repair. |
| Workflow bypasses domain approval | Keep state transitions subordinate to Epic 07 and policy APIs and prove no direct activation path. |
| Long-lived workflow resumes with stale authority | Reauthorize on resume and each tool call and pin or validate all dependent versions. |
| Checkpoints expose learner or content data | Encrypt, minimize, authorize, redact telemetry, and apply domain retention and deletion. |
| Workflow rollout strands in-flight executions | Pin versions, define compatibility migrations, preserve checkpoints, and provide drain and cancellation controls. |

## Definition of Done

- Workflow, state, checkpoint, transition, tool, approval, budget, replay, and terminal-result contracts are versioned and documented.
- All acceptance criteria pass with retained fault-injection, prompt-injection, authorization, grounding, replay, cost, and load-test evidence.
- Security and privacy reviews confirm least-privilege tools, MCP protection, model routing, learner-data minimization, checkpoint controls, and audit design.
- Epics 04, 05, 07, 08, and 09 pass end-to-end contract tests through MCP and approved direct mode.
- Resume, duplicate delivery, cancellation, compensation, dependency outage, kill switch, version migration, and rollback drills succeed.
- Dashboards, alerts, SLOs, cost budgets, on-call ownership, workflow approval governance, and incident runbooks are operational.
- Pilot workflows remain within grounding, safety, latency, cost, authorization, and human-approval gates for seven consecutive days.
- Product, education, assessment, learning science, security, privacy, compliance, and operations owners approve general availability.
