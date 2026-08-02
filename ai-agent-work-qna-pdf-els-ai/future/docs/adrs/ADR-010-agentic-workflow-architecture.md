# ADR-010: Agentic Workflow Architecture

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

ULIP coordinates long-running work across document parsing, knowledge extraction, validation, retrieval, question generation, explanation, learning-path creation, expert review, and publication. Some steps benefit from model reasoning, while identity, policy, state transitions, validation, and side effects require deterministic control.

Open-ended agents with unrestricted tools are unsuitable for educational content and learner-facing operations. They can loop, exceed budgets, follow instructions embedded in documents, invoke tools with excessive scope, or publish an output without required evidence. Workflows must survive process restarts, support approvals, remain replayable, and expose enough state for operations and audit without storing hidden model reasoning.

## Decision

ULIP will use **durable, typed LangGraph state machines with bounded specialist nodes and policy-controlled tools**. The workflow graph, not a model, owns control flow, budgets, approval gates, retries, and publication.

### Workflow Types

ULIP defines independently versioned graphs for:

- document ingestion and knowledge publication
- evidence-backed explanation
- learning-path generation
- assessment and question authoring
- assessment review and publication
- correction, source revocation, and deletion propagation

Each workflow has a typed request, typed state, explicit terminal states, and a versioned result schema. Specialist model nodes perform narrow tasks such as classification, extraction, drafting, critique, or summarization. Deterministic nodes perform authorization, retrieval, graph traversal, schema validation, answer verification, policy evaluation, persistence, and publication.

### Durable State and Execution

PostgreSQL stores the authoritative workflow run, graph version, request digest, actor and tenant context, policy version, current node, attempt, budgets, typed state references, artifacts, approval events, and terminal outcome. Large artifacts are content-addressed in the approved object store.

Steps execute with at-least-once delivery and idempotency keys derived from workflow run, node, input digest, and attempt policy. Side-effecting tools accept idempotency keys. A node commits its artifact and transition atomically where possible; external effects use the outbox and reconciliation pattern. Process restarts resume from the last committed transition.

Retries are allowed only for declared transient failures, use bounded exponential backoff with jitter, and never cause another model attempt after a policy or validation failure. The graph has fixed maximum node visits, tool calls, elapsed time, tokens, and cost. Budget exhaustion produces a typed terminal outcome.

### Tool Boundary

Agents do not receive database, filesystem, shell, network, or provider credentials. They call allowlisted, schema-validated capabilities through a tool gateway. MCP is the interoperability protocol for exposing approved retrieval and workflow capabilities to Droid and other authorized clients, but it does not replace the policy gateway.

Every tool definition declares input and output schema, required scope, tenant behavior, read or write classification, timeout, rate and result limits, idempotency semantics, and audit class. The gateway injects trusted identity and policy context, rejects scope broadening, validates outputs, and returns content as untrusted data. Tools cannot delegate arbitrary tool access.

Read tools provide retrieval, concept, graph, artifact, and policy-safe metadata operations. Write tools create draft artifacts or request transitions. Publication, destructive deletion, credential changes, external communication, and high-stakes scoring require deterministic policy gates and, where specified, human approval.

### Human Approval

Approval nodes pause durably and create a review task containing the proposed action, evidence, validation results, material differences, and policy reason. Decisions are `approve`, `reject`, or `request_changes`, with actor, role, timestamp, and rationale. The gateway checks current authorization when a decision is submitted, not only when the task was created.

Approval tokens are single-use and bound to the exact artifact digest and action. A changed artifact invalidates prior approval. Timeout follows the workflow's explicit expiry policy and never defaults to approval.

### Model Interaction

Prompts are versioned and contain a fixed instruction hierarchy, minimal state, task schema, and delimited untrusted evidence. Structured outputs are validated before state transition. Model text cannot choose tenant, change policy, approve an artifact, increase a budget, select arbitrary tools, or write directly to stores.

ULIP stores prompt and model provenance, input and output artifact digests, token and cost metrics, and validation outcomes. It does not require or persist hidden chain-of-thought. User-visible explanations use concise decision summaries, evidence, tool results, and validator findings.

### Failure and Compensation

Workflows distinguish transient infrastructure failure, invalid model output, insufficient evidence, policy denial, budget exhaustion, approval rejection, cancellation, and internal defect. Each has an explicit transition and safe terminal state.

Published artifacts are immutable, so correction uses supersession. Partial external projections are repaired from outbox state. Cancellation prevents new side effects and allows in-flight idempotent steps to finish. Destructive workflows first disable serving, then propagate deletion with receipts and reconciliation.

## Decision Drivers

- Deterministic control over model-assisted operations
- Durable execution and safe recovery from partial failure
- Tenant, authorization, and tool-scope enforcement
- Human oversight for high-impact actions
- Bounded latency, token, tool, and monetary cost
- Reproducible artifacts and audit trails
- Safe integration through MCP without credential exposure
- Independent evolution of ingestion, retrieval, assessment, and review workflows

## Detailed Design Implications

Workflow definitions are code-reviewed artifacts with semantic versions. A run stays on the graph version on which it began. Compatible hot fixes create a new version; they do not mutate active run semantics. State migrations are explicit and tested for resumable runs.

Node contracts are small and typed. State carries identifiers and artifact references rather than accumulating full source documents. Parallel branches are permitted only when they have independent side effects and a deterministic join. Fan-out and fan-in counts are bounded.

The initial serving graphs use a deterministic sequence:

- explanation: authorize, retrieve, check sufficiency, draft, validate citations, return
- learning path: authorize, resolve target, traverse prerequisites, retrieve evidence, assemble, validate path, return
- question authoring: authorize, plan, retrieve, check sufficiency, draft, verify, optionally repair once, persist draft, route review

An orchestrator may select one of these registered graphs from a validated request. It cannot synthesize a new graph at runtime.

Observability uses a trace identifier propagated through workflow, tool, retrieval, model, validator, database, and vector operations. Traces record node state, durations, result classes, budgets, and artifact identifiers. Source and learner text is redacted by default. Operational dashboards track queue age, stuck runs, retries, cost, model failures, policy denials, approval wait, and terminal outcomes.

## Alternatives Considered

### Open-ended autonomous agent loop

Rejected because control flow, tool selection, stopping, cost, and publication would depend on untrusted model output.

### Deterministic pipeline with no model-directed branching

Rejected as the only approach because some bounded classification, critique, and evidence-selection decisions benefit from model reasoning. Those decisions remain inside declared nodes and transitions.

### General-purpose tool access through shell and database clients

Rejected because it exposes credentials, makes scope enforcement weak, and permits side effects outside audited contracts.

### In-memory workflow execution

Rejected because long-running parsing, review, and generation cannot recover reliably after process loss and cannot provide durable approvals.

### Store complete prompts and documents in workflow rows

Rejected because it increases protected-data exposure and database load. ULIP stores restricted artifacts by content address and keeps state references.

### Let MCP servers enforce all security

Rejected because protocol interoperability is not an authorization model. Trusted policy context, scope checks, idempotency, and audit remain in the gateway and domain services.

## Consequences

### Positive

- Model behavior is contained inside explicit, reviewable workflow graphs.
- Runs resume safely and side effects are idempotent.
- Tool, token, time, and cost budgets are enforceable.
- High-impact actions receive durable, artifact-bound approval.
- Workflow traces make content generation and publication reproducible.

### Negative

- Durable graphs, checkpointers, and idempotent tools add implementation complexity.
- Explicit node schemas slow rapid prompt experimentation.
- Human gates increase end-to-end latency.
- Workflow version support and state migrations require operational discipline.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Source prompt injection manipulates an agent | Delimit evidence, restrict tools, keep policy outside prompts, validate outputs, and treat all retrieved content as data |
| Retry duplicates a write or external action | Require idempotency keys, use outbox coordination, and reconcile receipts |
| Workflow loops or consumes excessive cost | Enforce graph-level visit, tool, token, time, and cost budgets with typed exhaustion outcomes |
| Approval is reused after content changes | Bind single-use approval to artifact digest, action, actor role, and expiry |
| Compromised tool returns cross-tenant data | Inject tenant server-side, authorize before and after calls, validate schemas, minimize credentials, and audit every invocation |
| Active runs break after deployment | Pin graph and prompt versions, use backward-compatible workers, and test state migration and resume |

## Compliance and Security Implications

Workflow identity, tenant, purpose, policy, and data residency are immutable run attributes. Tool access follows least privilege and purpose limitation. Service credentials are short-lived, workload-bound, and unavailable to models. Network egress is denied by default and allowlisted per tool.

Artifacts inherit source and learner data classification, retention, legal hold, and deletion requirements. Human reviewers see only the content and evidence required for their role. Audit records capture actions and decisions without hidden reasoning or unnecessary personal data. Consequential educational decisions cannot be approved solely by an autonomous agent.

## Validation Measures

- Graph contract tests cover every node, edge, terminal state, retry class, and budget limit.
- Deterministic replay tests use recorded tool outputs to reproduce transitions and artifact digests.
- Crash-injection tests terminate workers before and after side effects and verify idempotent recovery.
- Security tests cover prompt injection, tool-argument injection, tenant spoofing, approval replay, credential exposure, excessive results, and unauthorized graph selection.
- Load tests verify queue latency, concurrency, backpressure, checkpoint performance, and approval resumption.
- End-to-end evaluations verify citation grounding, path validity, question lifecycle state, policy denial, cancellation, deletion propagation, and trace completeness.
- Production alerts cover stuck runs, repeated node failures, outbox age, budget anomalies, approval backlog, and cross-service trace gaps.

## Related Architecture

- [Agentic Workflows](../architecture/17_agentic_workflows.md)
- [Platform Architecture](../architecture/02_platform_architecture.md)
- [Deployment Architecture](../architecture/21_deployment_architecture.md)
- [Observability](../architecture/23_observability.md)
- [Security and Governance](../architecture/22_security_and_governance.md)
