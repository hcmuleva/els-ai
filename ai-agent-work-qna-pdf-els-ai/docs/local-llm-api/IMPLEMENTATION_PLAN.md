# Local LLM and HTTP API Production Plan

## Purpose

This plan separates the completed local baseline from the work required for a production service. The baseline is suitable for local development and controlled single-process use. Future phases add security, durable execution, operational controls, and deployment safeguards without changing the core ingestion and validated RAG behavior.

## Current state

### Phase 0: completed baseline

The repository currently implements:

- A `PipelineConfig` local provider selected with `KP_PROVIDER=local`
- Configurable OpenAI-compatible base URL, model, bearer token, timeout, temperature, and token limit
- A standard-library HTTP client for model discovery and non-streaming chat completions
- `LocalLLM` support shared by extraction and serving workflows
- Ollama defaults using `qwen3.6:35b`
- Compatibility with vLLM, LM Studio, and equivalent OpenAI-style servers
- A FastAPI process started by [`../../scripts/api_server.py`](../../scripts/api_server.py)
- A static administration page at `GET /`
- Health reporting at `GET /api/health`
- Multipart upload and queued ingestion at `POST /api/documents`
- Persistent job inspection at `GET /api/jobs/{job_id}`
- Validated RAG generation at `POST /api/questions`
- Persistent job JSON, immutable run output, Qdrant vectors, and PostgreSQL or SQLite metadata
- Document integrity, chunk quality, semantic retrieval, and store-loading gates
- Exact question count, four unique options, one correct option, explanation, LaTeX, duplicate-stem, and target-schema checks
- Optional run-scoped retrieval and optional quiz persistence

### Baseline operating constraints

The current service has these characteristics:

- It has no authentication or authorization.
- It has no application-level TLS termination.
- Upload workers are daemon threads in the API process.
- Each ingestion job invokes a local subprocess with a 24-hour timeout.
- Job state is JSON on the local filesystem.
- Jobs that were active during restart become `interrupted` and do not resume.
- There is no admission queue limit, concurrency limit, cancellation endpoint, or retry endpoint.
- Health checks probe the local model only when the resolved provider is `local`.
- Health checks report Qdrant and relational configuration but do not probe those stores.
- Logs are captured as a bounded text tail in the job record.
- There are no service metrics, traces, audit events, or alert definitions.
- Uploaded source paths and job details are returned to callers.
- `KP_API_MAX_UPLOAD_MB` limits bytes read, but file inspection is based on extension and emptiness only.
- API versioning is not encoded in the route path.
- Question generation is synchronous in the HTTP request.
- Generated questions fail as a whole when the exact valid count is not achieved.

## Target architecture

The target production design preserves the current domain services and places operational boundaries around them.

```text
Client
  |
  v
TLS ingress / API gateway
  | authentication, authorization, request IDs,
  | rate limits, body limits, access logs
  v
Stateless API service
  | upload metadata and object reference
  | enqueue ingestion
  | enqueue generation when asynchronous mode is selected
  v
Durable queue
  |
  +--> Ingestion worker pool
  |      | malware and file validation
  |      | extraction and local LLM calls
  |      | document, chunk, retrieval gates
  |      +--> transactional publication to stores
  |
  +--> Question worker pool
         | relational concept lookup
         | Qdrant retrieval
         | local LLM generation
         +--> validation and persistence

Durable systems
  Object storage: original uploads and immutable run artifacts
  Job database: state, attempts, ownership, timestamps, errors
  PostgreSQL: knowledge metadata and persisted quizzes
  Qdrant: approved vectors and retrieval metadata

Operational plane
  Metrics, structured logs, distributed traces, audit log,
  dashboards, alerts, backup and recovery

Model plane
  OpenAI-compatible local inference endpoint
  model allowlist, capacity policy, timeout and retry policy
```

The API should remain stateless after request acceptance. Worker leases and idempotency keys should ensure only one active transition owns a job. Publishing a run should happen only after all validation reports pass.

## Contracts

### Configuration contract

The following names are the current stable local-provider contract:

| Variable | Type | Current behavior |
| --- | --- | --- |
| `KP_PROVIDER` | string | `local` selects the OpenAI-compatible adapter. |
| `KP_LOCAL_LLM_BASE_URL` | URL | Base URL used for `models` and `chat/completions`. |
| `KP_LOCAL_LLM_MODEL` | string | Exact model identifier sent in requests. |
| `KP_LOCAL_LLM_API_KEY` | string | Sent as a bearer token when non-empty. |
| `KP_LOCAL_LLM_TIMEOUT` | integer | Per-request timeout in seconds. |
| `KP_LOCAL_LLM_TEMPERATURE` | float | Completion temperature. |
| `KP_LOCAL_LLM_MAX_TOKENS` | integer | Completion token limit. |
| `KP_API_HOST` | string | Uvicorn bind host. |
| `KP_API_PORT` | integer | Uvicorn bind port. |
| `KP_API_MAX_UPLOAD_MB` | integer | Maximum upload size in MiB. |

Production configuration should add validated startup checks, typed bounds, secret references rather than inline credentials, and explicit store and model connectivity policies. Existing variables should remain supported during migration.

### Local model contract

The completed client expects:

```http
GET {KP_LOCAL_LLM_BASE_URL}/models
Authorization: Bearer {KP_LOCAL_LLM_API_KEY}
Accept: application/json
```

The model list response must be an object with model identifiers in `data[].id`.

Completion requests use:

```http
POST {KP_LOCAL_LLM_BASE_URL}/chat/completions
Authorization: Bearer {KP_LOCAL_LLM_API_KEY}
Content-Type: application/json
Accept: application/json
```

```json
{
  "model": "qwen3.6:35b",
  "messages": [
    {
      "role": "user",
      "content": "prompt"
    }
  ],
  "temperature": 0.2,
  "max_tokens": 4096,
  "stream": false
}
```

The response must contain a non-empty string at `choices[0].message.content`.

### HTTP API contract

#### `GET /`

Returns the local administration HTML page. If the file is absent, the completed implementation returns a minimal HTML link to `/docs`.

#### `GET /api/health`

Returns HTTP `200` when the API handler runs. Current fields are:

- `status`
- `provider`
- `llm`
- `qdrant.url`
- `qdrant.collection`
- `relational_backend`

For the local provider, `llm` includes reachability, configured model, base URL, and model availability when model discovery succeeds. This is currently a status report, not a full readiness contract.

#### `POST /api/documents`

- Content type: `multipart/form-data`
- Form field: `file`
- Accepted suffixes: `.pdf`, `.txt`, `.md`, `.markdown`
- Success: HTTP `202`
- Oversize: HTTP `413`
- Invalid filename, extension, or empty content: HTTP `400`

The response is the initial job record, including `job_id`, `run_id`, state, timestamps, provider, output location, error, and log tail.

#### `GET /api/jobs/{job_id}`

- Success: HTTP `200` and the current persisted job record
- Unknown identifier: HTTP `404`

#### `POST /api/questions`

Current JSON request:

```json
{
  "topic": "Applications of Derivatives",
  "query": "increasing functions",
  "level_band": "jee_main",
  "count": 5,
  "source_run_id": "document-example",
  "persist": false,
  "max_attempts": 3
}
```

Constraints:

- `topic`: required, 1 through 200 characters
- `query`: optional, at most 1000 characters
- `level_band`: one of `beginner`, `intermediate`, `advanced`, `jee_main`, `jee_advanced`, `expert`
- `count`: 1 through 50
- `source_run_id`: optional, at most 200 characters
- `persist`: optional Boolean
- `max_attempts`: 1 through 5

Success returns quiz metadata, provenance, validation summary, and exactly `count` target-schema question envelopes. Domain input errors return HTTP `400`. Exhausted generation or validation returns HTTP `502`. Other generation failures currently return HTTP `500`.

### Compatibility policy for future phases

Before production rollout:

1. Capture the current OpenAPI document as a reviewed baseline.
2. Add contract tests for every status code and response field used by clients.
3. Treat additive optional fields as backward compatible.
4. Require a versioned route or negotiated media type for removals, renames, or semantic changes.
5. Standardize errors with a machine-readable code, safe message, request ID, and optional field violations.
6. Stop exposing internal filesystem paths in external responses in the next major contract.

## Job state machine

### Current ingestion state machine

```text
POST /api/documents
        |
        v
      queued
        |
        v
      running
       /   \
      v     v
completed failed

queued or running
        |
        | API process restart
        v
   interrupted
```

Current transitions:

| From | To | Trigger |
| --- | --- | --- |
| none | `queued` | Valid upload is stored and job JSON is written. |
| `queued` | `running` | Worker thread starts the ingestion subprocess. |
| `running` | `completed` | Subprocess exits with code 0 after store loading. |
| `running` | `failed` | Subprocess exits nonzero, times out, or raises an exception. |
| `queued` or `running` | `interrupted` | Job records are loaded after API restart. |

All current terminal states are final. There is no implemented cancellation, resume, or retry transition.

### Target durable state machine

```text
received -> validating -> queued -> leased -> running -> validating_output
    |          |           |        |          |              |
    |          |           |        |          |              v
    |          |           |        |          |          publishing
    |          |           |        |          |              |
    |          |           |        |          |              v
    |          |           |        |          +----------> succeeded
    |          |           |        |
    +----------+-----------+--------+---------------------> failed
                           |
                           +-----------------------------> cancelled

leased or running -- expired lease --> queued, if attempts remain
leased or running -- expired lease --> failed, if attempts are exhausted
```

Future transition requirements:

- Compare-and-set transitions in the job database
- Worker lease owner, lease expiration, heartbeat, and attempt number
- Idempotency key and source checksum
- Retry classification for transient and permanent failures
- Cancellation request plus worker acknowledgement
- Separate failure code from sanitized public error text
- Append-only transition history for audit and diagnosis
- Transactional or compensating publication across Qdrant and PostgreSQL
- Explicit `published_run_id` only after all writes complete

## Phased delivery plan

### Phase 1: contract hardening and process safety

Status: future.

Scope:

- Freeze and test the baseline OpenAPI contract.
- Introduce standard error envelopes and request IDs.
- Validate configuration at process startup.
- Add bounded upload and generation concurrency.
- Add queue-depth rejection before accepting work that cannot be serviced.
- Sanitize filenames and remove internal paths from public responses.
- Add graceful shutdown behavior that stops new work and records active work consistently.
- Add explicit liveness and dependency-aware readiness endpoints.
- Add model and store startup diagnostics.
- Document supported Ollama, vLLM, and LM Studio versions in a tested compatibility matrix.

Exit criteria:

- Contract tests cover all endpoints and failure mappings.
- The service rejects invalid startup configuration before binding.
- Concurrency and queue limits are measurable and tested.
- Shutdown behavior has deterministic tests.
- Public API errors contain no stack traces, credentials, prompts, or filesystem paths.

### Phase 2: durable jobs and artifact storage

Status: future.

Scope:

- Replace in-process worker threads with a durable queue and separate worker service.
- Store jobs, attempts, leases, and transitions in PostgreSQL.
- Store uploaded documents and immutable artifacts in managed object storage.
- Add checksum-based idempotency and configurable duplicate handling.
- Add retry, cancellation, lease recovery, and dead-letter handling.
- Keep current pipeline validation gates inside the worker.
- Publish store visibility only after successful gate completion and coordinated writes.
- Define artifact retention, deletion, and legal-hold controls.

Exit criteria:

- API restart does not lose or interrupt accepted jobs.
- Worker termination causes safe lease recovery without duplicate publication.
- Duplicate idempotency keys return the original job contract.
- Cancellation reaches a documented terminal state.
- Recovery tests prove job and artifact restoration from backups.

### Phase 3: security controls

Status: future.

Scope:

- Terminate TLS at a controlled ingress.
- Add workload identity for internal service calls.
- Add user or service authentication for all non-public endpoints.
- Enforce tenant and role authorization for upload, status, generation, and persistence.
- Associate each job, run, and quiz with an authenticated owner and organization.
- Add per-identity rate, byte, token, and concurrency quotas.
- Verify file type by content, reject polyglots, and scan uploads before extraction.
- Isolate extraction and model workloads with restricted filesystem, network, CPU, memory, and execution time.
- Store secrets in a secret manager and rotate them.
- Protect model prompts from untrusted document instructions and constrain outbound access.
- Redact sensitive content from logs and traces.
- Add immutable security audit events.

Exit criteria:

- Cross-tenant access tests fail closed.
- Unauthenticated requests are rejected according to policy.
- Malicious upload fixtures are blocked before extraction.
- Workers run without unnecessary privileges or unrestricted egress.
- Secret scanning and dependency scanning pass in CI.
- Audit events identify actor, action, resource, outcome, and request ID.

### Phase 4: observability and service objectives

Status: future.

Scope:

- Emit structured JSON logs with request, job, run, tenant, model, and attempt identifiers.
- Add OpenTelemetry traces across ingress, API, queue, worker, model, Qdrant, and relational operations.
- Export metrics for:
  - HTTP request count, latency, and error rate
  - Upload bytes and rejected uploads
  - Queue depth, queue age, lease expiry, and active workers
  - Ingestion duration by phase
  - Gate pass rate and rejection reason
  - Model latency, timeout, response size, and invalid-output rate
  - Question attempts, accepted and rejected items, exact-count failure rate
  - Qdrant retrieval latency and context-hit rate
  - Store publication duration and failure rate
- Define dashboards and alerts tied to service-level objectives.
- Add runbooks for model unavailability, queue backlog, gate regressions, and store failures.

Initial service-level indicators:

- API availability and latency by endpoint
- Accepted-job completion rate
- Time from acceptance to terminal state
- Exact-count generation success rate
- Retrieval context-use rate
- Dependency error rate

Targets must be established from measured load and product requirements rather than invented in this plan.

Exit criteria:

- A request can be correlated through API, queue, worker, model, and stores.
- Alerts are tested with controlled failure injection.
- Dashboards distinguish client errors, model failures, gate failures, and infrastructure failures.
- Logs and traces pass sensitive-data redaction tests.

### Phase 5: performance, capacity, and resilience

Status: future.

Scope:

- Benchmark supported document sizes and question counts.
- Model GPU and CPU capacity for extraction and question workloads separately.
- Add backpressure based on queue age, model saturation, and store latency.
- Batch embeddings and store writes within measured safe bounds.
- Add circuit breakers and bounded retries with jitter for transient dependencies.
- Preserve the exact-count validation contract under retry.
- Add Qdrant collection lifecycle and reindex procedures.
- Define PostgreSQL indexes, connection pools, and migration controls.
- Test backup, restore, regional failure, and dependency degradation.
- Decide whether question generation remains synchronous or gains an asynchronous job contract.

Exit criteria:

- Load tests meet approved objectives at expected peak capacity.
- Overload produces bounded, documented rejection rather than resource exhaustion.
- Dependency outages recover without corrupting or partially publishing runs.
- Capacity dashboards identify API, worker, model, vector, and relational bottlenecks.

### Phase 6: deployment and rollout

Status: future.

Scope:

- Package API and worker services as reproducible, pinned images.
- Add database migrations and rollback procedures.
- Use infrastructure as code for queue, object storage, Qdrant, PostgreSQL, secrets, ingress, and observability.
- Deploy isolated development, staging, and production environments.
- Qualify each supported model and serving backend before promotion.
- Run shadow traffic or replay sanitized fixtures in staging.
- Roll out with canary percentages and automatic rollback conditions.
- Preserve a kill switch for uploads, generation, and persistence independently.

Exit criteria:

- Images have provenance, software bills of materials, vulnerability results, and immutable digests.
- Staging promotion tests cover the full upload-to-question path.
- Canary health, rollback triggers, and rollback execution are rehearsed.
- On-call ownership, runbooks, and escalation paths are assigned.

## Security design

### Threat boundaries

Treat all of the following as untrusted:

- Uploaded bytes and filenames
- Topics, queries, run identifiers, and generation parameters
- Extracted document text, including prompt-injection content
- Model responses
- OpenAI-compatible model servers outside the deployment trust boundary
- Store metadata loaded from prior runs

### Required controls

| Area | Required production control |
| --- | --- |
| Network | TLS, private dependency networks, explicit ingress, restricted egress |
| Identity | Authenticated principals, tenant ownership, least-privilege service identities |
| Upload | Content signature verification, malware scanning, decompression and parser limits |
| Extraction | Sandboxed workers, read-only base image, temporary workspace, resource quotas |
| LLM | Model allowlist, endpoint allowlist, prompt boundaries, output validation, timeout |
| API | Schema validation, body limit at ingress and app, rate limit, CSRF policy if cookies are used |
| Storage | Encryption, tenant scoping, backups, retention, deletion, immutable audit history |
| Secrets | Secret manager references, rotation, redaction, no credentials in images or logs |
| Supply chain | Locked dependencies, image signing, SBOM, vulnerability and license checks |

The current local server should bind to `127.0.0.1`. Binding to all interfaces is not a substitute for implementing these controls.

## Observability design

### Correlation identifiers

Add and propagate:

- `request_id`
- `job_id`
- `run_id`
- `attempt_id`
- `tenant_id`
- `model_id`
- `trace_id`

Do not include raw document content, complete prompts, complete model responses, API keys, or database credentials in default telemetry.

### Error taxonomy

Define stable codes for:

- Request validation
- Authentication and authorization
- Upload policy
- Queue admission
- Extraction
- Document integrity gate
- Chunk quality gate
- Retrieval validation gate
- Embedding
- Qdrant
- Relational store
- Model unavailable, timeout, invalid response, and capacity
- Question validation and exact-count exhaustion
- Publication
- Cancellation and retry exhaustion

The public error should be safe and actionable. Detailed internal context should be linked by request and job identifiers.

## Testing strategy

### Unit tests

- Configuration precedence, defaults, type bounds, and provider selection
- OpenAI-compatible URL construction, headers, request bodies, response parsing, and error mapping
- Model discovery and exact model matching
- Upload extension, emptiness, and size validation
- Job transition guards and serialization
- Question request bounds and level values
- Four unique options, one correct option, explanation, duplicate stem, LaTeX, exact count, and schema validation
- Run filter propagation to retrieval
- Public error redaction

### Contract tests

- Snapshot and validate OpenAPI
- Test each endpoint's success and documented error statuses
- Verify multipart field naming and JSON request constraints
- Verify question response envelopes against the target Pydantic schema
- Run the local client against recorded Ollama, vLLM, and LM Studio compatible fixtures

### Integration tests

- Start disposable Qdrant and PostgreSQL or SQLite.
- Use a deterministic model-server stub that implements `/v1/models` and `/v1/chat/completions`.
- Upload representative PDF, TXT, MD, and Markdown fixtures.
- Poll each job to a terminal state.
- Assert that failed gates prevent store loading.
- Assert that approved chunks and relational metadata share the same run identity.
- Generate run-filtered questions and verify provenance.
- Exercise `persist: false` and `persist: true` separately.

### End-to-end tests

- Ollama plus Qwen smoke test on approved hardware
- Browser administration flow
- Upload, poll, generate, and retrieve persisted result
- API restart during queued and running work
- Worker termination and lease recovery after Phase 2
- Store and model dependency failures
- Oversized, malformed, encrypted, corrupted, and scanned document fixtures

### Nonfunctional tests

- Concurrent uploads and generations
- Queue saturation and backpressure
- Maximum configured upload and question count
- Long model latency and timeout
- Memory, temporary disk, CPU, and GPU exhaustion
- Security tests for cross-tenant access, parser abuse, path traversal, prompt injection, and data leakage
- Backup and restore
- Deployment rollback

## CI and release gates

### Pull request CI

Future CI should run:

1. Markdown link and fence checks for documentation.
2. Formatting, lint, type checks, and unit tests.
3. OpenAPI and target-schema contract tests.
4. Integration tests with disposable stores and a deterministic model stub.
5. Dependency, secret, license, and static security scans.
6. Container build, SBOM generation, and image vulnerability scan.

### Main branch and release CI

Future release pipelines should additionally run:

1. Full end-to-end ingestion and generation fixtures.
2. Database migration forward and rollback tests.
3. Model-backend compatibility smoke tests.
4. Performance regression checks against an approved baseline.
5. Artifact signing, provenance generation, and immutable publication.
6. Staging deployment and automated acceptance suite.

No release should bypass failing validation, security, migration, or contract gates without a recorded, time-bounded exception and owner.

## Rollout strategy

1. **Local qualification:** Keep the completed baseline as the developer reference using Ollama and Qwen.
2. **Development environment:** Introduce durable jobs, object storage, authentication, and telemetry behind internal access.
3. **Staging:** Use production-equivalent topology with synthetic and approved sanitized fixtures.
4. **Shadow evaluation:** Replay representative requests without publishing results and compare quality, latency, and cost.
5. **Internal canary:** Permit a small authorized user group and monitor exact-count success, gate outcomes, and queue behavior.
6. **Percentage rollout:** Increase traffic only while approved error, latency, quality, and security indicators remain healthy.
7. **General availability:** Enable documented support, retention, backup, and incident response.

Rollback conditions should include authentication bypass, cross-tenant exposure, corrupted publication, sustained dependency failure, queue instability, severe quality regression, or inability to restore service safely.

## Acceptance criteria

### Completed baseline acceptance

The local baseline is complete when:

- `KP_PROVIDER=local` routes extraction and question generation to the configured compatible server.
- `GET /api/health` reports local model reachability and availability.
- A supported document upload returns a job and run identifier.
- Job polling reaches `completed` only after ingestion, all gates, and store loading succeed.
- The completed run is retrievable through the configured Qdrant and relational stores.
- Question generation can filter by `source_run_id`.
- A successful generation returns exactly the requested count.
- Every returned item has four unique options, one correct option, an explanation, valid LaTeX according to the project validator, and a valid target schema.
- Ollama Qwen works with the documented variables, and other compatible servers can be selected by base URL and model identifier.

These behaviors are implemented. They still require environment-specific dependencies and successful runtime validation.

### Production acceptance

Production readiness requires all of the following:

- Authenticated, tenant-scoped authorization on every data operation
- TLS and secret-manager integration
- Durable queue, worker leases, retries, cancellation, and restart recovery
- Durable job and artifact storage with tested backup and restore
- Content-based file policy, scanning, sandboxing, and resource limits
- Transactionally safe publication or proven compensation
- Dependency-aware readiness and controlled shutdown
- Structured logs, metrics, traces, dashboards, alerts, and runbooks
- Contract, integration, end-to-end, security, load, resilience, and recovery tests passing
- Reproducible signed artifacts with SBOM and acceptable vulnerability results
- Staging, canary, rollback, incident ownership, retention, and support procedures approved

## Explicit remaining gaps

The following are not implemented by the current baseline:

1. Authentication, authorization, tenant isolation, and user ownership enforcement
2. TLS termination and production ingress controls
3. Durable queue and independent worker deployment
4. Automatic resume, lease recovery, retries, cancellation, and dead-letter handling
5. Database-backed job transitions and append-only job history
6. Object storage for uploads and run artifacts
7. Content-signature checks, malware scanning, and extraction sandboxing
8. Admission control, rate limits, quotas, and bounded concurrency
9. Qdrant and relational readiness probes
10. Structured error codes and removal of internal paths from responses
11. Structured logs, metrics, traces, dashboards, and alerts
12. Formal service-level objectives and measured capacity limits
13. Backup, restore, retention, deletion, and disaster-recovery procedures
14. Transactional publication across Qdrant and the relational store
15. Model version pinning, quality evaluation, and a tested compatibility matrix
16. API versioning and a formal deprecation policy
17. Production CI, image signing, SBOM, deployment automation, and canary rollback
18. Asynchronous question generation for requests that exceed safe HTTP latency
19. Automated cleanup of uploads, job records, and interrupted run artifacts
20. Security review of optional quiz persistence and its external store permissions

These gaps are future work. The current local behavior should not be represented as satisfying production security, durability, or availability requirements.
