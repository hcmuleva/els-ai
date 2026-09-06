# ELS-AI Backend Architecture

**Status:** Proposed target architecture  
**Version:** 1.0  
**Date:** 2026-09-05  
**Scope:** Backend services, PostgreSQL, asynchronous processing, media, Kubernetes, security, and delivery  
**Source brief:** [`ELS_BACLEND_REFACTOR.md`](./ELS_BACLEND_REFACTOR.md)

---

## 0. Project Identity and Scope

This document belongs exclusively to the **ELS project**.

| Identifier | Value |
| --- | --- |
| Product identifier | `ELS` |
| Repository/application identifier | `els-ai` |
| Architecture document identifier | `ELS-BACKEND-ARCHITECTURE` |
| Kubernetes namespace | `els-ai` |
| Database/application name | `els_ai` |
| Scope | Educational learning platform backend |
| Explicitly excluded | AgentOps platform, MSSRE automation, GitHub App automation, generic plugin platform, and shared runtime infrastructure |

ELS and AgentOps are separate products. They must have separate repositories or repository roots, deployment namespaces, cloud subscriptions/projects where practical, databases, secrets, service accounts, message brokers/topics, CI/CD pipelines, and ownership. They may integrate later through an explicitly versioned external API or event contract. They must not share internal packages, database tables, credentials, or an implicit event bus.

The AI service described in this document means **ELS educational content generation only**. It does not mean an autonomous AgentOps system.

---

## 1. Executive Summary

ELS-AI already has a useful domain-oriented starting point: an API gateway, authentication, classroom, content, topic, quiz, assignment, media, AI, notification, achievement, organization, question-bank, and story services. The repository is a TypeScript/Node.js monorepo with PostgreSQL and shared packages.

The main problem is not the number of services. It is that the current services behave like independently deployed applications over a shared, highly coupled database. Business logic, authorization, SQL, schema initialization, event publishing, and external integrations are mixed together. Kubernetes manifests provide basic deployment, but not the controls required for safe production operation.

The recommended target is:

1. Merge the current fine-grained services into six logical runtime applications plus a migration Job.
2. Keep domain modules and ownership boundaries inside those applications, so the deployment simplification does not create a new monolith with uncontrolled coupling.
3. Standardize every application on API, application, domain, and infrastructure layers.
4. Make PostgreSQL the system of record, with managed high availability, connection pooling, versioned migrations, strict tenant isolation, and context-owned schemas.
5. Replace direct synchronous chains with durable commands and domain events where work is long-running or independently retryable.
6. Run stateless HTTP applications and separate worker modes on Kubernetes. Keep PostgreSQL and object storage outside the application cluster unless there is a deliberate platform decision to operate them in-cluster.
7. Move secrets out of Git and default values out of production code.
8. Introduce operational standards: health endpoints, graceful shutdown, structured logs, metrics, traces, resource policies, autoscaling, disruption budgets, network policies, and progressive delivery.

The target architecture is a **modular educational platform with a small number of deployable applications**. A module is not automatically a Kubernetes Deployment. A separate runtime is justified only when it has a distinct scaling, security, availability, or release profile.

### 1.1 Consolidation implementation status

The repository now has a compatibility consolidation path:

- `backend/core-api` mounts the current educational routers behind one HTTP process.
- `backend/shared/db-runtime` gives a consolidated process one bounded PostgreSQL pool.
- `backend/workers` hosts notification handlers and story scheduling outside the HTTP process.
- `k8s-els-ai/kustomization.yaml` uses the consolidated profile by default.
- The previous service manifests remain available as rollback/reference files during migration.

This is an incremental bridge. The next step is to move route logic into the module folders described below, not to keep importing service source trees permanently.

---

## 2. Architectural Principles

These principles are mandatory for new code and should guide refactoring of existing code.

### 2.1 Domain ownership

Each bounded context owns:

- Its domain model and invariants.
- Its application use cases.
- Its database tables and migrations.
- Its public API contract.
- Its emitted domain events.
- Its operational SLOs.

Other contexts consume APIs or events. They do not read or write another context's tables.

### 2.2 Dependency direction

Dependencies point inward:

```text
Transport/API
    -> Application
        -> Domain
            <- Infrastructure adapters
```

The domain must not import Express, `pg`, AWS SDKs, Ably, filesystem APIs, or environment access. Infrastructure implements interfaces defined by the application or domain layers.

### 2.3 Secure by default

- No production secret has a code default.
- Authentication and authorization are separate decisions.
- Tenant context is required for tenant-scoped operations.
- Database row-level security fails closed for application roles.
- Internal service calls use workload identity or short-lived signed credentials, not one shared static header secret.
- Every sensitive action produces an audit record.

### 2.4 Explicit failure behavior

Every external call has a timeout, bounded retry policy, idempotency strategy, and observable failure mode. A notification failure must not roll back a completed quiz. A media upload must not keep an HTTP request open while an expensive transformation runs.

### 2.5 Operational consistency

Every HTTP service exposes:

- `/livez`: process is alive.
- `/readyz`: dependencies required to serve traffic are ready.
- `/version`: build and API metadata.
- `/metrics`: Prometheus-compatible metrics, where permitted.

Every service supports graceful shutdown and emits a correlation ID.

### 2.6 Evolution over replacement

Refactoring must be incremental. Existing API routes and data are preserved behind compatibility adapters until the new module is proven. No rewrite or large-scale service split should be a prerequisite for production hardening.

---

## 3. Current-State Assessment

### 3.1 Verified repository shape

The current backend contains these deployable areas:

| Area | Current implementation | Primary responsibility |
| --- | --- | --- |
| `gateway` | Express proxy and static media entry point | Public API entry point, JWT verification, routing |
| `auth-service` | Express routes, SQL, seed/bootstrap code | Users, authentication, students, counseling, feedback, billing |
| `org-service` | Express routes, SQL, migration-related initialization | Organizations and memberships |
| `classroom-service` | Express routes and SQL | Classrooms and classroom operations |
| `content-service` | Express routes, SQL, S3 helpers | Learning content, sections, bookmarks |
| `topic-service` | Express routes and SQL | Topics, subjects, catalog |
| `question-bank-service` | Express routes and SQL | Questions and question bank |
| `quiz-service` | Express routes and SQL | Quiz lifecycle and submissions |
| `assignment-service` | Express routes and SQL | Assignments and submissions |
| `achievement-service` | Express routes and SQL | Achievements |
| `story-service` | Express routes, scheduler, SQL | Stories and story progress |
| `notification-service` | Express routes, Ably integration, SQL | Notifications and realtime delivery |
| `media-service` | Express routes, local filesystem/S3 | Asset upload, storage, and signed access |
| `ai-service` | Express routes, content pipeline | AI-assisted generation and persistence |

Shared packages currently include:

- `@els-ai/event-bus`
- `@els-ai/internal-auth`
- `@els-ai/media-client`
- `@els-ai/db-tenant`

The root workspace builds all services together. `Dockerfile.service` builds a selected workspace, while `Dockerfile.all-in-one` starts all services in one container. Kubernetes manifests currently deploy one Deployment per service.

### 3.2 Current-state scores

Scores are architectural maturity scores, not product-quality scores.

| Dimension | Score | Rationale |
| --- | ---: | --- |
| Overall architecture | 5/10 | Domain services exist, but ownership, contracts, and runtime standards are inconsistent. |
| Maintainability | 4/10 | Large route modules contain SQL, policy checks, mapping, and orchestration. Repeated service bootstrap and database code increases change cost. |
| Scalability | 4/10 | Services can scale independently in principle, but all depend on one shared PostgreSQL surface and several endpoints perform long-running work synchronously. |
| Extensibility | 5/10 | The workspace and event-bus packages are useful extension points, but educational AI provider interfaces and module contracts are not yet stable platform contracts. |
| Security | 3/10 | Tenant isolation is being introduced, but current RLS policies include fail-open behavior, internal credentials are shared, and placeholder/default secrets are present in code and manifests. |
| Operability | 3/10 | Basic health probes exist, but readiness does not verify dependencies and Kubernetes lacks resources, disruption budgets, network policies, autoscaling, and standard telemetry. |
| Testability | 4/10 | Pure domain boundaries are not consistently separated from Express and PostgreSQL, making isolated testing difficult. |

### 3.3 Current strengths

- The repository uses TypeScript and workspaces.
- SQL uses parameterized values in the inspected paths.
- `zod` is already used for some configuration and request validation.
- There is a migration directory with ordered SQL files and a migration tracker.
- A shared tenant package uses `AsyncLocalStorage` to carry request context.
- PostgreSQL RLS has been introduced for part of the schema.
- The event bus has a production provider and an in-memory development fallback.
- Media has a path toward S3-backed storage.
- Services already have basic Kubernetes readiness and liveness probes.

These strengths should be preserved and standardized rather than replaced.

### 3.4 Current anti-patterns and risks

#### A. Shared database without enforced ownership

Most services create their own `pg.Pool` against the same PostgreSQL database and query common tables directly. This creates:

- Hidden coupling between services.
- Schema changes that require coordinated releases.
- Unclear data ownership.
- A large blast radius for a bad query or migration.
- Difficulty proving that a service can be extracted later.

**Target:** one logical owner per table. During migration, shared tables can remain in one PostgreSQL cluster, but cross-context access must move behind APIs, read models, or events.

#### B. Route modules are application services and repositories at the same time

Examples include very large route files in `auth-service`, `users`, `counseling`, `feedback`, and organization-related paths. A single handler often:

1. Parses request data.
2. Determines permissions.
3. Builds SQL.
4. Executes a transaction.
5. Maps database rows.
6. Publishes a notification.
7. Returns an HTTP response.

This is a god-controller pattern and makes business rules hard to reuse or test.

**Target:** controllers only translate transport data. Use cases own orchestration and policies. Repositories own persistence. Domain objects own invariants.

#### C. Authentication is implemented as shared mutable headers

The gateway verifies a JWT and forwards identity as `x-internal-*` headers protected by `x-internal-secret`. Services can also accept JWTs directly. This creates two authentication paths and makes header forgery protection dependent on one static secret.

**Target:** use a standard OIDC/JWT validation library with issuer, audience, algorithm, and key rotation checks. Use Kubernetes workload identity plus mTLS or short-lived service tokens for service-to-service calls. Keep identity claims in a typed request context.

#### D. Secrets have unsafe defaults

The inspected code and manifests include values such as default JWT/internal secrets and a Git-managed Secret manifest with `changeme` placeholders. A missing event-bus API key falls back to an in-memory bus.

**Target:** fail startup in production when required secrets are absent. Store only Secret references or encrypted secret manifests in Git. Do not log credentials or place real credentials in comments, examples, or image layers.

#### E. Tenant isolation can fail open

The current RLS migration explicitly allows requests with no `app.org_id` to pass through, and the database wrapper permits queries outside a tenant context. That is acceptable only as a temporary migration state. It is unsafe as a steady-state production model.

**Target:** separate migration/administrative roles from application roles, use `FORCE ROW LEVEL SECURITY`, reject missing tenant context for tenant tables, and test cross-tenant reads and writes in CI.

#### F. Event bus is not a durable workflow bus

The current `@els-ai/event-bus` uses Ably for realtime/event delivery and falls back to an in-memory implementation. Ably is suitable for client-facing realtime notifications, but the fallback loses events on process restart and neither path is a durable transactional outbox.

**Target:** use a durable broker or managed queue for commands and integration events. Use Ably/WebSockets only as a notification projection, after the durable event is committed.

#### G. Migrations are coupled to application deployment

The Kubernetes `org-service` init container runs the migration command, while local startup scripts can also auto-run migrations. The runner re-runs a migration after checksum drift. This can create concurrent migration races and makes a modified applied migration executable in production.

**Target:** run migrations as a separately versioned, singleton CI/CD job with an advisory lock. Applied migration files are immutable. Checksum drift fails the job and requires a new corrective migration.

#### H. Kubernetes is missing production controls

The current manifests generally use one replica and basic probes. The inspected manifests do not define resource requests/limits, security contexts, service accounts, PodDisruptionBudgets, autoscaling, topology spread, startup probes, NetworkPolicies, or a controlled rollout strategy.

**Target:** standardize a secure Deployment/Service template and scale each workload based on its traffic and workload profile.

#### I. Static media is coupled to application pods

Gateway and media deployment use a shared PVC/local paths while S3 is also supported. A shared writable volume is a poor fit for horizontally scaled stateless pods and makes backup, CDN delivery, and rollout behavior more difficult.

**Target:** object storage is authoritative. Applications issue presigned upload/download URLs. A read-only local asset bundle may be shipped for immutable built-in assets; user-generated media must not depend on pod-local or shared-PVC writes.

#### J. Synchronous educational AI and persistence chains

The educational AI service can call back through the gateway to persist generated content. This creates a service loop and couples a long-running operation to a user request.

**Target:** submit a generation command, persist a job, process it in a worker, record status, and emit completion/review events. The client polls or subscribes to job status.

---

## 4. Target Logical Architecture

### 4.1 High-level topology

```text
Clients
  |
  v
CDN / WAF / Ingress
  |
  v
ELS Gateway
  |
  +--> ELS Core API
  |       (identity, organizations, catalog, content, assessment,
  |        classrooms, assignments, progress, stories, notifications)
  |
  +--> ELS Media API
  |
  +--> ELS Educational AI API
  |
  +--> ELS Realtime Edge
  |
  +--> ELS Workers
          (outbox, notifications, media, educational AI)
                  |
                  v
       Durable ELS message broker
                  |
                  v
       Managed PostgreSQL + PgBouncer + Object Storage
          (context schemas, RLS, backups, replicas)
```

### 4.2 Request flow

1. The WAF terminates external TLS and applies rate limits and body-size limits.
2. Ingress routes only to the gateway/BFF.
3. The gateway validates the external token or delegates token validation to the identity provider.
4. The gateway establishes a typed principal and correlation ID. It must not trust client-supplied identity headers.
5. The gateway routes to a domain service. It does not contain domain business rules.
6. The service validates the request DTO, establishes tenant context, and executes an application use case.
7. The use case loads aggregates through interfaces, enforces invariants, and commits changes in one transaction where appropriate.
8. Domain events are written to an outbox in the same transaction as the state change.
9. An outbox publisher sends events to the broker. Consumers are idempotent.
10. The service returns a resource or accepted job response. Long-running operations are asynchronous.

### 4.3 Simplified deployment units

The current 14 service areas should be consolidated into **six logical application units**, plus a migration Job. Each unit remains internally modular and may contain multiple domain modules. The first implementation can mount the existing route modules behind a new composition root, then extract files into the target modules gradually.

| Target unit | Current modules to merge | Runtime shape | Why this boundary |
| --- | --- | --- | --- |
| `els-gateway` | `gateway` | HTTP Deployment | External edge, routing, rate limits, token verification, and API composition. |
| `els-core-api` | `auth-service`, `org-service`, `topic-service`, `content-service`, `question-bank-service`, `quiz-service`, `classroom-service`, `assignment-service`, `achievement-service`, `story-service`, `notification-service` | HTTP Deployment, optionally with a separate realtime process | These are transactional educational domains with similar latency, database, and release profiles. They should share technical foundations but retain module ownership. |
| `els-media-api` | `media-service` | HTTP Deployment | Upload/download bandwidth, object storage permissions, malware scanning, and large request limits require isolation. |
| `els-education-ai-api` | `ai-service` | HTTP Deployment | Provider credentials, request budgets, long-running generation commands, and model-specific scaling require isolation. |
| `els-workers` | New worker entry points for outbox, notification, achievement, story scheduling, media jobs, and educational AI jobs | Worker Deployments by queue profile | Workers scale by queue depth and must not consume HTTP capacity. Start as one worker image with separate commands; split only when load requires it. |
| `els-migrations` | Root `migrations` and migration runner | Kubernetes Job | Schema changes must be serialized and independently controlled from application startup. |

#### Recommended deployment count

The normal production profile is:

```text
1  els-gateway
1  els-core-api
1  els-media-api
1  els-education-ai-api
1  els-workers
1  els-migrations (run-to-completion Job per release)
-----------------------------------------------
5 long-running Deployments + 1 migration Job
```

Add a separate `els-realtime` Deployment only if WebSocket connection count or notification fan-out requires independent scaling. Add separate media or AI worker Deployments only when queue metrics justify them.

This is not an all-in-one process. Each target unit is independently built, health-checked, rolled out, and scaled. `Dockerfile.all-in-one` remains a local demo option only.

#### Merge rules inside `els-core-api`

The merge is a deployment simplification, not permission to create a shared god module:

- Each domain keeps its own `api`, `application`, `domain`, and `infrastructure` directories.
- Modules may not import another module's repositories or database tables.
- Cross-module calls use application ports, typed internal commands, or events.
- One composition root wires modules together.
- One HTTP process may expose routes for all modules, but each route maps to exactly one module owner.
- The core application can later be split without changing domain code if a module earns an independent runtime.

#### Do not merge

Keep the gateway, media API, and educational AI API separate. Their security boundaries, payload sizes, external dependencies, and scaling profiles are materially different. Do not merge AgentOps code into any of these units; AgentOps is a separate project.

---

## 5. Bounded Contexts and Ownership

### 5.1 Recommended contexts

| Bounded context | Owns | Does not own |
| --- | --- | --- |
| Identity and Access | Users, credentials, refresh sessions, roles, permissions, token/session lifecycle | Classroom content and quiz results |
| Organization and Tenancy | Organizations, memberships, tenant settings, tenant lifecycle | Authentication secrets |
| Learning Catalog | Subjects, topics, global content definitions, publishing metadata | Student submissions |
| Content Authoring | Learning contents, content sections, media references, content versions | Object bytes and user identity |
| Assessment | Question bank, quiz definitions, attempts, answers, scoring | Classroom membership |
| Classroom and Assignment | Classrooms, teacher/student enrollment, assignments, submission coordination | Canonical user credentials |
| Progress and Achievement | Student activity, progress projections, achievements, badges | Raw quiz definition ownership |
| Story and Experience | Stories, story sections, story progress, scheduled story publication | General content catalog |
| Media | Asset metadata, upload sessions, virus scanning, object storage lifecycle | Learning content semantics |
| Notification | Notification preferences, notification records, delivery attempts, realtime projection | Source business transaction |
| Educational AI | Content-generation jobs, model/provider runs, age-appropriateness checks, review state, generated drafts | Canonical catalog, identity, or autonomous external operations |
| Platform Governance and Audit | Immutable audit records, authorization decisions, content approvals, retention | Mutable business aggregates and autonomous operations |

### 5.2 Initial service mapping

The current services map to these contexts as follows:

```text
auth-service             -> Identity and Access
org-service              -> Organization and Tenancy
topic-service            -> Learning Catalog
content-service          -> Content Authoring
question-bank-service    -> Assessment / Question Bank
quiz-service             -> Assessment / Quiz
classroom-service        -> Classroom
assignment-service       -> Assignment
achievement-service      -> Progress and Achievement
story-service            -> Story and Experience
media-service            -> Media
notification-service     -> Notification
ai-service               -> Educational AI
gateway                  -> Edge/API composition only
```

This mapping is ownership guidance, not an instruction to immediately create more repositories or databases.

### 5.3 ELS module grouping inside the target applications

`els-core-api` should contain these modules:

```text
identity/
organization/
catalog/
content/
assessment/
classroom/
assignment/
progress/
story/
notification/
governance/
```

`els-education-ai-api` should contain only ELS educational capabilities:

```text
generation/
content-review/
age-appropriateness/
provider-adapters/
```

There is no `agentops/`, `mssre/`, `github/`, autonomous plugin, or generic tool-execution module in ELS. If ELS later needs an integration with another product, expose a versioned adapter at the boundary and keep the external product's implementation in its own project.

### 5.4 Boundary rules

- `auth-service` must not own content, subjects, quizzes, or classroom SQL.
- `org-service` may answer membership and authorization questions through an API or projection. Other services must not update membership tables directly.
- `content-service` must reference asset IDs, not implement S3 lifecycle logic in route handlers.
- `quiz-service` owns quiz attempts and scoring facts. Achievement and notification consume events.
- `assignment-service` owns assignment lifecycle and submission state. It can reference classroom IDs through an API or validated event projection.
- `notification-service` never becomes part of the source transaction for quiz or assignment completion.
- The educational AI module may create drafts and generation records, but publication remains owned by content/catalog and requires ELS authorization.
- `gateway` must not call the gateway from another service.
- Shared packages may contain technical primitives and contracts, but not business rules that span contexts.

### 5.5 When to split or merge

Split a service only when at least two of these are true:

- It has independently changing domain behavior.
- It has a distinct scaling or availability profile.
- It requires separate security or compliance controls.
- It has a stable API/event contract.
- It has a clearly owned data set.

Merge modules when they cannot be deployed, tested, or migrated independently and have no distinct operational profile. In particular, do not split a thin CRUD service merely because it has a different URL prefix.

---

## 6. Standard Service Architecture

Every domain service should converge on this shape:

```text
service/
├── src/
│   ├── bootstrap/
│   │   ├── config.ts
│   │   ├── composition-root.ts
│   │   └── server.ts
│   ├── api/
│   │   ├── http/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── middleware/
│   │   │   └── presenters/
│   │   └── contracts/
│   ├── application/
│   │   ├── commands/
│   │   ├── queries/
│   │   ├── ports/
│   │   └── services/
│   ├── domain/
│   │   ├── aggregates/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── events/
│   │   ├── policies/
│   │   └── errors/
│   ├── infrastructure/
│   │   ├── postgres/
│   │   │   ├── repositories/
│   │   │   ├── mappers/
│   │   │   └── transaction.ts
│   │   ├── messaging/
│   │   ├── storage/
│   │   ├── providers/
│   │   └── observability/
│   └── workers/
│       ├── consumers/
│       ├── jobs/
│       └── schedulers/
├── test/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   └── e2e/
├── migrations/
├── Dockerfile
└── package.json
```

### 6.1 Layer responsibilities

| Layer | Allowed | Forbidden |
| --- | --- | --- |
| API/transport | HTTP parsing, DTO validation, status codes, auth middleware, response mapping | Business rules, SQL, provider SDKs |
| Application | Use-case orchestration, transaction boundaries, authorization decisions, ports | Express request/response types, raw SQL |
| Domain | Invariants, value objects, aggregate behavior, domain events | Database, network, environment, framework |
| Infrastructure | PostgreSQL, broker, object storage, provider SDKs, concrete adapters | Deciding business policy |
| Worker | Consume command/event, invoke use case, acknowledge/retry | Duplicating business rules outside the application layer |

### 6.2 Interface-driven design

Ports should be owned by the consuming application layer:

```ts
export interface QuizRepository {
  getById(id: QuizId, scope: TenantScope): Promise<Quiz | null>;
  save(quiz: Quiz, tx: TransactionContext): Promise<void>;
}

export interface EventPublisher {
  publish(events: readonly DomainEvent[]): Promise<void>;
}

export interface AssetStore {
  createUploadSession(input: CreateUploadSession): Promise<UploadSession>;
  delete(assetId: AssetId): Promise<void>;
}

export interface ModelProvider {
  generate(input: ModelRequest, options: ProviderOptions): Promise<ModelResponse>;
}

export interface AuditLog {
  append(entry: AuditEntry): Promise<void>;
}
```

The composition root selects implementations:

```ts
const config = loadConfig();
const pool = createPostgresPool(config.database);
const unitOfWork = new PostgresUnitOfWork(pool);
const quizRepository = new PostgresQuizRepository(pool);
const eventPublisher = new OutboxEventPublisher(unitOfWork);
const submitQuiz = new SubmitQuizUseCase({
  quizRepository,
  eventPublisher,
  clock: new SystemClock(),
});
```

Avoid:

- Global mutable singletons for domain dependencies.
- Service locator calls from handlers.
- `process.env` reads outside configuration loading.
- Instantiating provider SDKs inside route modules.
- Interfaces that merely mirror every method of a concrete class without a use-case need.

### 6.3 Transactions

Use one explicit unit-of-work transaction for a business command:

```text
BEGIN
  set tenant context
  load aggregate
  enforce invariant
  persist aggregate changes
  insert outbox events
COMMIT
```

Do not hold a database transaction open while calling an AI provider, S3, Ably, GitHub, or another HTTP service. Persist a pending state and continue asynchronously.

---

## 7. PostgreSQL Architecture

### 7.1 Production topology

Preferred production topology:

```text
Services -> PgBouncer -> Managed PostgreSQL primary
                              |
                              +--> synchronous/managed HA standby
                              +--> read replicas for approved read workloads
                              +--> point-in-time backup storage
```

Use a managed PostgreSQL service where available. If PostgreSQL is operated in Kubernetes, use a mature PostgreSQL operator with replication, fencing, backups, restore testing, and upgrade procedures. Do not deploy a single PostgreSQL Pod with a local volume as the production design.

### 7.2 Database ownership model

Start with one PostgreSQL database and move toward schema ownership:

```text
identity.*
organization.*
catalog.*
content.*
assessment.*
classroom.*
assignment.*
progress.*
story.*
media.*
notification.*
education_ai.*
governance.*
platform.outbox
platform.schema_migrations
```

A schema is an ownership boundary, not a license for another service to query it. During transition, compatibility views or APIs may bridge legacy tables.

Long-term options:

1. **Shared cluster, schema-per-context:** recommended first target. Lower operational cost and supports cross-context reporting through controlled projections.
2. **Database-per-context on the same cluster:** use when privilege isolation or migration independence requires it.
3. **Cluster-per-context:** reserve for high-scale, compliance, or failure-isolation requirements.

Do not use database-per-service before the domain contracts and event flows are stable.

### 7.3 Roles and privileges

Use separate roles:

- `els_migrator`: migration owner, used only by the migration Job.
- `els_<context>_app`: application role for one bounded context.
- `els_readonly_reporting`: controlled reporting role, never used by request services.
- `els_backup`: backup-only role.

Application roles must not own tables and must not have `CREATE`, `ALTER`, `DROP`, or database-wide superuser privileges. Revoke public schema access and grant only the required schema/table privileges.

### 7.4 Tenant isolation

Every tenant-scoped row must have a non-null `organization_id` unless it is explicitly global. The request scope must include:

```ts
type TenantScope = {
  organizationId: string;
  subjectId: string;
  roles: readonly string[];
};
```

Required controls:

1. Validate tenant membership before establishing context.
2. Set tenant context with `set_config('app.org_id', $1, true)` through parameterized SQL.
3. Use transaction-local settings for request queries.
4. Enable and force RLS on all tenant tables.
5. Make missing context deny access for application roles.
6. Keep migrations and controlled administrative jobs on separate roles.
7. Add automated tests for cross-tenant select, insert, update, delete, and joins.
8. Ensure background workers carry tenant scope in a signed command or event envelope.

The current policy pattern that treats missing `app.org_id` as unrestricted must be removed after all code paths are audited.

### 7.5 Migration policy

Migration requirements:

- One immutable, ordered migration per change.
- No application startup migration.
- No migration mutation after it has reached a shared environment.
- Advisory lock around migration execution.
- Transactional migration by default.
- Expand/contract for breaking changes.
- `CREATE INDEX CONCURRENTLY` in a separately managed non-transactional migration where required.
- Checksum drift fails the pipeline rather than re-running an altered migration.
- Restore production backups into an isolated environment and run migrations before production rollout.

Migration Job flow:

```text
build image -> run migration Job -> verify status -> deploy application
```

Rollback is normally an application rollback plus a forward database fix. Do not assume schema rollback is safe.

### 7.6 Query and data rules

- Repositories own SQL and row mapping.
- Every list endpoint has bounded pagination.
- Use keyset pagination for large or frequently changing collections.
- Add indexes from query plans, not intuition.
- Test query plans for hot paths.
- Avoid `SELECT *` in public read models.
- Avoid N+1 queries; use explicit joins or batch loaders.
- Use optimistic concurrency (`version` or `updated_at`) where concurrent updates are possible.
- Use idempotency keys for client retries on commands.
- Keep large blobs out of PostgreSQL. Store metadata and object keys in PostgreSQL; store bytes in object storage.

### 7.7 Outbox and inbox

For every state change that emits an event:

```text
same transaction:
  update owned tables
  insert platform.outbox event
```

The publisher marks events as published only after broker acknowledgement. Consumers record an inbox key such as `(consumer_name, event_id)` before applying side effects. Both publisher and consumer operations must be safe to retry.

---

## 8. API Architecture

### 8.1 Public API

Use a stable versioned prefix:

```text
/api/v1/auth
/api/v1/organizations
/api/v1/classrooms
/api/v1/content
/api/v1/quizzes
/api/v1/assignments
/api/v1/media
/api/v1/ai/jobs
```

Keep gateway routes as composition and policy boundaries. Avoid exposing internal service hostnames or port-specific routes to clients.

### 8.2 API standards

- JSON request and response format.
- OpenAPI contract checked in or generated in CI.
- UUID resource identifiers.
- ISO-8601 UTC timestamps.
- Consistent error envelope:

```json
{
  "error": {
    "code": "QUIZ_ATTEMPT_ALREADY_SUBMITTED",
    "message": "The quiz attempt has already been submitted.",
    "requestId": "req_01..."
  }
}
```

- `201` for created resources.
- `202` for accepted asynchronous work.
- `204` for successful empty responses.
- `409` for concurrency or state conflicts.
- `422` for semantically invalid input.
- `429` for rate limiting.
- Never return stack traces, SQL, provider responses, or secret material.

### 8.3 Validation and authorization

Validate at the boundary with shared technical validation primitives and context-owned schemas. Authorization must be explicit in the use case:

```text
authenticate principal
resolve tenant membership
authorize action on resource
execute use case
```

Do not treat a role string from a forwarded header as proof of authorization. The principal must be verified and the organization membership must be current or represented by a controlled, short-lived claim.

### 8.4 Idempotency and long-running jobs

Commands that can be retried must accept `Idempotency-Key`. Persist the key, principal, tenant, request hash, result reference, and status. AI generation, media transformation, bulk imports, and video processing return a job resource:

```text
POST /api/v1/ai/jobs       -> 202 { "jobId": "...", "status": "queued" }
GET  /api/v1/ai/jobs/{id}  -> 200 { "status": "running|succeeded|failed" }
```

---

## 9. Event-Driven Architecture

### 9.1 Event categories

Use three distinct concepts:

1. **Command:** directed request to one owner, for example `GenerateContent`.
2. **Domain event:** fact emitted by the owner, for example `QuizAttemptSubmitted`.
3. **Notification projection:** client-facing representation, for example a realtime notification.

Suggested events:

```text
OrganizationCreated
MembershipChanged
ContentPublished
QuestionPublished
QuizAttemptStarted
QuizAttemptSubmitted
AssignmentSubmitted
AchievementGranted
MediaAssetUploaded
MediaAssetScanCompleted
ContentGenerationRequested
ContentGenerationCompleted
HumanReviewRequested
HumanReviewCompleted
NotificationCreated
```

### 9.2 Broker requirements

The durable broker must provide:

- At-least-once delivery.
- Consumer groups.
- Dead-letter queues.
- Retry with backoff.
- Message retention appropriate to replay needs.
- Correlation and causation IDs.
- Tenant and data classification metadata.
- Operational metrics for age, lag, retry, and dead letters.

The specific product may be Kafka, Azure Service Bus, RabbitMQ, or another managed equivalent. Ably remains suitable for realtime client delivery, not as the sole durable integration bus.

### 9.3 Event envelope

```json
{
  "eventId": "evt_01...",
  "eventType": "QuizAttemptSubmitted",
  "eventVersion": 1,
  "occurredAt": "2026-09-05T12:00:00Z",
  "producer": "assessment-service",
  "correlationId": "req_01...",
  "causationId": "cmd_01...",
  "tenantId": "org_01...",
  "subjectId": "user_01...",
  "data": {}
}
```

Consumers must tolerate unknown fields and support versioned schema evolution.

---

## 10. Educational AI Architecture

ELS includes an educational AI capability, not a general autonomous-agent platform. Its purpose is to help authorized teachers or administrators generate, review, and publish age-appropriate learning content.

### 10.1 Responsibilities

The ELS educational AI module owns:

- Generation request and job state.
- Model/provider adapter selection.
- Prompt template versioning.
- Candidate content and question drafts.
- Source metadata and content provenance.
- Age-level and content-safety validation.
- Human review state.
- Usage, latency, and cost metadata.

It does not own:

- User credentials or organization membership.
- Canonical subjects, topics, or published learning content.
- Media object storage.
- Autonomous tools or external repository operations.
- AgentOps workflows, MSSRE findings, GitHub operations, or generic plugins.

### 10.2 Generation flow

```text
authorized request
    -> generation job created
    -> worker selects provider
    -> provider response normalized
    -> schema and safety validation
    -> draft stored
    -> human review
    -> content-service publication command
```

Generation must be asynchronous. The API returns a job ID, and the worker records provider, model, prompt version, input hash, output hash, token usage, duration, and failure reason.

### 10.3 Provider abstraction

```ts
export interface EducationalModelProvider {
  generate(input: EducationalGenerationInput): Promise<EducationalGenerationOutput>;
}

export interface ContentSafetyValidator {
  validate(
    draft: EducationalDraft,
    context: { classLevel: string; subject: string; tenantId: string },
  ): Promise<ValidationResult>;
}
```

Provider adapters must have timeouts, bounded retries, rate limits, budget limits, and redaction rules. A provider response is untrusted data and must be validated before it is stored or shown to a learner.

### 10.4 Review and publication

Use explicit states:

```text
queued -> running -> draft_ready -> approved
                         |             |
                         v             v
                      rejected       published
```

Only the content owner can publish. Educational AI can submit a typed publication request after approval; it must not write directly to content tables owned by the content module.

### 10.5 Data and privacy

- Do not send unnecessary student personal data to providers.
- Prefer tenant-approved prompt context and pseudonymous identifiers.
- Store provider request/response evidence according to retention policy.
- Redact secrets and personal data before logging.
- Record the model and prompt template used to create every published draft.
- Provide a deletion path for generated drafts and provider evidence.

---

## 11. Security Architecture

### 11.1 Identity and access

- Use an OIDC-compatible identity provider.
- Validate `iss`, `aud`, `exp`, `nbf`, algorithm, and signing key ID.
- Prefer short-lived access tokens and rotating refresh tokens.
- Hash refresh tokens at rest.
- Rotate signing keys with overlapping validation windows.
- Separate authentication, tenant membership, role authorization, and resource ownership.
- Enforce server-side authorization on every command and sensitive query.

### 11.2 Service-to-service security

Preferred order:

1. Kubernetes workload identity for cloud APIs.
2. mTLS through a service mesh or trusted internal gateway where justified.
3. Short-lived signed service tokens with audience and expiry.

Do not use one `INTERNAL_SECRET` for all services as the long-term design. If compatibility requires it during migration, rotate it, scope it per caller, validate the caller identity, and put a retirement date on the compatibility path.

### 11.3 Secrets

- Use an external secret manager and CSI/provider integration or sealed/encrypted secrets.
- Never commit live secrets or provider keys.
- Do not use placeholder values in a production overlay.
- Mark required settings and fail fast if absent.
- Rotate database passwords, signing keys, broker credentials, and provider keys.
- Keep secret values out of logs, crash dumps, traces, and generated support bundles.

### 11.4 Network controls

- Only ingress and gateway are externally reachable.
- Default-deny ingress and egress NetworkPolicies.
- Permit each service only to its required dependencies.
- Permit database access from approved service namespaces and migration Jobs.
- Restrict AI/provider egress to approved domains.
- Use private endpoints for PostgreSQL and object storage where supported.

### 11.5 Input, output, and data protection

- Enforce content type and body size at ingress and application layers.
- Scan uploaded media for malware before publication.
- Validate file extension, MIME type, magic bytes, and object size.
- Use presigned URLs with short TTLs and scoped object keys.
- Redact personal data from logs and model prompts.
- Encrypt data in transit and at rest.
- Define retention and deletion rules for student and AI-generated data.

### 11.6 Audit

Audit at the application boundary for:

- Login, logout, failed login, token rotation.
- Membership and role changes.
- Content publication and unpublication.
- Quiz/assignment override or grading changes.
- Media access to protected assets.
- AI prompt/provider/tool execution.
- Human approvals and policy decisions.
- Administrative data export or deletion.

Audit records are append-only, tenant-scoped where applicable, and exported to immutable retention storage.

---

## 12. Kubernetes and Cloud-Native Design

### 12.1 Namespace and environments

Use separate namespaces and cloud resources for:

```text
els-ai-dev
els-ai-staging
els-ai-prod
```

Production should not share a PostgreSQL database, object bucket, secret store path, or broker namespace with development.

### 12.2 Workload baseline

Each HTTP Deployment should define:

- Immutable image digest, not a mutable tag.
- Non-root user.
- Read-only root filesystem where possible.
- Dropped Linux capabilities.
- `allowPrivilegeEscalation: false`.
- `seccompProfile: RuntimeDefault`.
- Resource requests and limits.
- Startup, readiness, and liveness probes.
- Graceful termination period.
- PodDisruptionBudget for critical services.
- Topology spread or anti-affinity for replicas.
- Service account with minimum permissions.
- ConfigMap for non-secret configuration and external Secret references.

Example baseline:

```yaml
securityContext:
  runAsNonRoot: true
  seccompProfile:
    type: RuntimeDefault
containers:
  - name: service
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
    resources:
      requests:
        cpu: 100m
        memory: 256Mi
      limits:
        cpu: "1"
        memory: 512Mi
```

Values must be tuned from load tests and production telemetry, not copied blindly.

### 12.3 Probes and shutdown

- `/livez` checks only that the process event loop is responsive.
- `/readyz` checks required dependencies with short timeouts.
- Do not make liveness depend on PostgreSQL; a database outage should not cause a restart storm.
- On `SIGTERM`, stop accepting traffic, stop pulling new jobs, finish bounded work, close broker consumers, flush telemetry, and close database pools.
- Set `terminationGracePeriodSeconds` according to the workload.

### 12.4 Scaling

Use HPA for HTTP services based on CPU plus request rate/latency where metrics are available. Use queue-depth or oldest-message age for workers. Set a maximum replica count that the database and provider quotas can support.

Scale separately:

- Gateway: requests per second and latency.
- Quiz/assignment write services: request rate and database saturation.
- AI workers: queue depth, provider rate limits, token budget.
- Media workers: queue depth and object-processing latency.
- Notification consumers: broker lag and delivery latency.

### 12.5 Ingress and edge

- TLS with automatic certificate renewal.
- WAF and rate limiting.
- Request ID propagation.
- Strict body-size limits by route class.
- Separate upload endpoints from ordinary JSON APIs.
- No regex rewrite that makes API path behavior ambiguous; prefer explicit `/api/v1` routing.
- CDN for public immutable assets.

### 12.6 Storage

Use object storage for:

- Images, audio, video, documents.
- AI evidence and generated artifacts.
- Export files and backups.

PostgreSQL stores asset metadata, ownership, checksums, content type, lifecycle, and publication state. Shared PVCs are permitted only for explicitly ephemeral or legacy transition workloads with a documented retirement plan.

### 12.7 Delivery

Use Kustomize or Helm with:

- Base manifests.
- Environment overlays.
- Image digest pinning.
- Resource and replica profiles.
- Policy checks.
- `kubectl diff` or server-side dry run.
- Automated rollout status and smoke tests.
- Rollback procedure.

Deploy order:

```text
validate -> build -> scan -> publish immutable image
        -> apply migration Job
        -> deploy compatible application
        -> smoke test
        -> progressive traffic increase
```

---

## 13. Observability and Reliability

### 13.1 Structured logging

Emit JSON logs with:

```text
timestamp
level
service
version
environment
requestId
traceId
spanId
tenantId (hashed or approved identifier)
principalId (hashed or approved identifier)
operation
durationMs
outcome
errorCode
```

Never log access tokens, passwords, cookies, raw student records, full prompts containing personal data, or provider secrets.

### 13.2 Metrics

Minimum metrics:

- HTTP request count, duration, status, and payload size.
- Dependency call count, duration, timeout, and error.
- PostgreSQL pool usage, wait time, query duration, and errors.
- Broker publish/consume count, lag, retries, and dead letters.
- Outbox age and unpublished count.
- Job duration, queue age, success, failure, and retry.
- Authentication failures and authorization denials.
- AI provider latency, token usage, cost estimate, and policy blocks.
- Media upload, scan, transformation, and delivery status.

### 13.3 Tracing

Use OpenTelemetry for HTTP, PostgreSQL, broker, object storage, and provider calls. Propagate W3C trace context through gateway, services, events, and jobs. Record tenant and user identifiers only according to the privacy policy.

### 13.4 SLOs

Set initial service objectives:

| Capability | Initial objective |
| --- | --- |
| Gateway availability | 99.9% monthly |
| Read APIs | p95 under 500 ms for normal payloads |
| Command APIs | p95 under 1 s excluding accepted async jobs |
| Async job acceptance | p95 under 300 ms |
| Notification event delivery | 99% within 30 seconds |
| Migration success | 100% before production rollout |
| Tenant isolation | Zero confirmed cross-tenant data exposure |

Tune these after baseline measurements.

### 13.5 Resilience

- Timeouts on every network call.
- Retries only for transient errors and only for idempotent operations.
- Circuit breakers for provider dependencies.
- Bulkheads for AI/media workloads.
- Dead-letter queues with replay tooling.
- Backpressure when queues or database pools are saturated.
- Graceful degradation for non-critical notifications and recommendations.

---

## 14. Testing Architecture

### 14.1 Test pyramid

```text
              small number
          End-to-end / smoke
        Contract and component
      Integration with PostgreSQL/broker
      Unit tests for domain/use cases
              large number
```

Required coverage:

- Domain invariant tests.
- Use-case authorization tests.
- Repository tests against PostgreSQL, not only mocks.
- RLS tenant isolation tests.
- API contract tests.
- Event schema compatibility tests.
- Outbox/inbox idempotency tests.
- Provider contract tests with fakes.
- Media upload security tests.
- AI policy and prompt-injection tests.
- Kubernetes manifest policy tests.
- End-to-end smoke test through ingress.

### 14.2 Test environments

Use ephemeral PostgreSQL and broker instances in CI. Seed only deterministic fixtures. Do not run production seed code during application startup.

### 14.3 Quality gates

Pull requests must pass:

```text
format/lint
typecheck
unit tests
integration tests
contract tests
dependency and container scan
secret scan
SQL migration validation
Kubernetes policy validation
OpenAPI compatibility check
```

---

## 15. CI/CD and Supply Chain

### 15.1 Build pipeline

1. Validate changed workspace dependencies.
2. Run tests and static checks.
3. Build a minimal service image.
4. Run the image as a non-root user.
5. Generate SBOM.
6. Scan image and dependencies.
7. Sign the image and attest build provenance.
8. Push by immutable digest.
9. Deploy to a non-production environment.
10. Run migration and smoke gates.

### 15.2 Repository and package strategy

Keep the monorepo while shared domain contracts and cross-service migrations are being untangled. Enforce workspace dependency rules:

- Technical shared packages may be imported by any service.
- Domain packages may be imported only by their owner or explicitly approved consumers.
- Services must not import another service's `src` directory.
- API and event contracts are versioned packages.
- No service imports another service's database module.

### 15.3 Release strategy

- Backward-compatible API and event changes first.
- Expand schema.
- Deploy readers and writers.
- Backfill asynchronously.
- Switch traffic or feature flag.
- Contract/remove old schema only after all consumers are migrated.

Use canary or progressive rollout for gateway and high-risk services.

---

## 16. Recommended Repository Structure

The following structure is the target after incremental extraction:

```text
els-ai/
├── apps/
│   ├── gateway/
│   ├── core-api/
│   │   └── modules/
│   │       ├── identity/
│   │       ├── organization/
│   │       ├── catalog/
│   │       ├── content/
│   │       ├── assessment/
│   │       ├── classroom/
│   │       ├── assignment/
│   │       ├── progress/
│   │       ├── story/
│   │       ├── notification/
│   │       └── governance/
│   ├── media-api/
│   ├── education-ai-api/
│   └── workers/
├── packages/
│   ├── config/
│   ├── http/
│   ├── auth-contracts/
│   ├── event-contracts/
│   ├── database/
│   ├── tenancy/
│   ├── observability/
│   ├── idempotency/
│   └── testkit/
├── database/
│   ├── migrations/
│   ├── seeds/
│   ├── policies/
│   └── scripts/
├── contracts/
│   ├── openapi/
│   ├── asyncapi/
│   └── json-schema/
├── deploy/
│   ├── base/
│   ├── overlays/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── prod/
│   └── policies/
├── docs/
│   ├── architecture/
│   ├── runbooks/
│   └── adr/
└── scripts/
```

The existing `backend/*-service` layout can be migrated to this shape without changing runtime URLs first. Folder movement should follow ownership decisions, not precede them.

---

## 17. Refactoring Roadmap

### Phase 0: Production safety baseline

**Effort:** 1–2 weeks  
**Risk:** Medium  
**Benefits:** Removes immediate security and operational hazards.

Actions:

- Remove real/placeholder secret material from tracked manifests and comments.
- Make production configuration fail fast on missing secrets.
- Add `/livez`, `/readyz`, graceful shutdown, request IDs, and structured error handling.
- Pin images by digest and add non-root security contexts.
- Add resource requests/limits, startup probes, PDBs, and default-deny NetworkPolicies.
- Disable startup/sidecar migrations.
- Add database backups and restore verification.
- Set explicit timeouts and body limits.

Dependencies: secret manager, PostgreSQL backup policy, cluster administrator support.

### Phase 1: Stabilize shared foundations

**Effort:** 2–4 weeks  
**Risk:** Medium  
**Benefits:** Makes all later refactoring cheaper.

Actions:

- Create a typed configuration package.
- Standardize HTTP middleware and error envelopes.
- Standardize auth principal and tenant scope.
- Create database pool and transaction abstractions.
- Add OpenTelemetry and metrics.
- Add contract validation and service dependency rules.
- Introduce an application composition root in each service.

Dependencies: Phase 0.

### Phase 2: Extract application and domain layers

**Effort:** 4–8 weeks  
**Risk:** Medium  
**Benefits:** Improves testability and reduces route complexity.

Actions:

- Start with `quiz-service`, `content-service`, and `assignment-service`.
- Move SQL from routes into repositories.
- Move orchestration into use cases.
- Add domain errors, value objects, and authorization policies.
- Add repository and RLS integration tests.
- Keep current routes as adapters.

Dependencies: Phase 1; representative test fixtures.

### Phase 3: Establish database ownership and strict tenancy

**Effort:** 4–8 weeks  
**Risk:** High  
**Benefits:** Reduces data leakage and cross-service coupling.

Actions:

- Inventory every table and query by service.
- Assign one owner to each table.
- Introduce context schemas or ownership views.
- Create service-scoped roles.
- Add outbox/inbox tables.
- Replace fail-open RLS with fail-closed policies.
- Remove cross-context writes.
- Migrate reporting and denormalized reads to projections.

Dependencies: Phase 2; complete query inventory; cross-tenant test suite.

### Phase 4: Consolidate runtime applications

**Effort:** 4–8 weeks  
**Risk:** Medium  
**Benefits:** Reduces deployment, configuration, and operational overhead without losing domain ownership.

Actions:

- Create `els-core-api` with one composition root.
- Mount identity, organization, catalog, content, assessment, classroom, assignment, progress, story, notification, and governance modules.
- Preserve current public URLs through route adapters.
- Create `els-media-api` and `els-education-ai-api` as separate applications.
- Build one `els-workers` image with explicit commands for queue profiles.
- Remove direct service-to-service calls inside the core application.
- Retain module-level tests and ownership checks.

Dependencies: Phases 1–3; route and database ownership inventory.

### Phase 5: Durable eventing and workers

**Effort:** 4–8 weeks  
**Risk:** Medium  
**Benefits:** Better reliability and independent scaling.

Actions:

- Choose a durable broker.
- Publish domain events through a transactional outbox.
- Move notification, achievement, media processing, story scheduling, and educational AI generation to consumers/workers.
- Add retries, dead-letter handling, idempotency, and replay tools.
- Retain Ably only for client-facing realtime projection.

Dependencies: Phase 4; broker platform and operational ownership.

### Phase 6: Educational AI hardening

**Effort:** 6–12 weeks  
**Risk:** High  
**Benefits:** Safe educational content generation, human review, provider independence.

Actions:

- Introduce asynchronous generation jobs and provider interfaces.
- Add age-level validation, content safety, provenance, and usage budgets.
- Add review workflow and publication approval records.
- Keep generated drafts separate from canonical published content.
- Add provider contract tests and prompt/version audit records.

Dependencies: Phase 5; education content policy; security review; model/provider budget.

### Phase 7: Selective runtime extraction

**Effort:** Ongoing  
**Risk:** High  
**Benefits:** Independent scaling and failure isolation where justified.

Actions:

- Extract only contexts with stable contracts and clear data ownership.
- Use compatibility APIs and events.
- Migrate one context at a time.
- Keep modules inside `els-core-api` when independent deployment is not justified.

Dependencies: Phases 4–6 and measured operational need.

---

## 18. Migration Strategy and Compatibility

### 18.1 Strangler approach

For each route:

```text
legacy route
  -> adapter
  -> new use case
  -> old repository or new repository
  -> contract test
  -> feature flag
  -> remove legacy implementation
```

Do not change URL, schema, and service ownership in one release.

### 18.2 Data migration sequence

1. Inventory tables, foreign keys, RLS policies, and query callers.
2. Mark each table as owned, shared legacy, derived, or obsolete.
3. Add missing IDs, timestamps, version columns, tenant keys, and indexes.
4. Add compatibility views for old column names.
5. Backfill in bounded batches with progress tracking.
6. Dual-write only when necessary, and monitor divergence.
7. Switch reads.
8. Stop old writes.
9. Validate counts, checksums, and tenant boundaries.
10. Remove compatibility code in a later release.

### 18.3 Event migration sequence

For a current synchronous call:

```text
old: request -> service A -> service B -> notification
new: request -> service A + outbox -> broker
                               -> service B consumer
                               -> notification consumer
```

During transition, consumers must tolerate both old and new paths, with deduplication to prevent duplicate side effects.

---

## 19. Sample Refactoring

### 19.1 Before: route with SQL and policy logic

```ts
router.post('/quizzes/:id/submit', async (req, res) => {
  const quiz = await db.query('SELECT ...', [req.params.id]);
  if (!quiz.rows[0]) return res.status(404).json({ message: 'Not found' });
  if (quiz.rows[0].organization_id !== req.user.organizationId) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  await db.query('INSERT INTO quiz_attempts ...', [...]);
  await eventBus.publish({ type: 'QuizSubmitted', ... });
  return res.status(201).json({ ok: true });
});
```

### 19.2 After: transport adapter and use case

```ts
router.post('/quizzes/:id/submit', async (req, res, next) => {
  try {
    const input = submitQuizSchema.parse({
      quizId: req.params.id,
      answers: req.body.answers,
      idempotencyKey: req.header('Idempotency-Key'),
    });

    const result = await submitQuiz.execute({
      actor: requestPrincipal(req),
      input,
      requestId: requestId(req),
    });

    return res.status(result.created ? 201 : 200).json(toQuizAttemptResponse(result));
  } catch (error) {
    return next(error);
  }
});
```

The use case owns authorization, transaction scope, scoring, idempotency, and outbox creation. The repository owns SQL. The event publisher does not run before the transaction commits.

### 19.3 Configuration

```ts
const config = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']),
  port: z.coerce.number().int().positive(),
  databaseUrl: z.string().url(),
  jwtIssuer: z.string().url(),
  jwtAudience: z.string().min(1),
  jwtJwksUrl: z.string().url(),
}).parse({
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  databaseUrl: process.env.DATABASE_URL,
  jwtIssuer: process.env.JWT_ISSUER,
  jwtAudience: process.env.JWT_AUDIENCE,
  jwtJwksUrl: process.env.JWT_JWKS_URL,
});
```

Production should not provide a fallback secret or a localhost dependency URL.

---

## 20. Architecture Decision Records Required

Create and approve these ADRs before the corresponding implementation:

1. PostgreSQL managed service versus operator-managed PostgreSQL.
2. Durable broker selection.
3. OIDC provider and token validation model.
4. Shared cluster/schema-per-context versus database-per-context.
5. Object storage and CDN strategy.
6. RLS policy and application-role model.
7. API gateway versus BFF responsibilities.
8. Educational AI provider abstraction, safety validation, and data retention.
9. ELS versus external-product integration contract, if an integration is later required.
10. SLOs, on-call ownership, and disaster recovery targets.

---

## 21. Production Readiness Checklist

### Application

- [ ] Every service has a typed configuration module.
- [ ] No production secret has a code or manifest fallback.
- [ ] Every service has live, ready, and version endpoints.
- [ ] Every service supports graceful shutdown.
- [ ] Controllers contain no raw SQL.
- [ ] All external calls have timeout and retry policies.
- [ ] Long-running work uses jobs, not open HTTP requests.

### PostgreSQL

- [ ] Managed HA or an approved operator is in place.
- [ ] Connection pooling is sized from a database connection budget.
- [ ] Every table has an owner.
- [ ] Application roles cannot run DDL.
- [ ] RLS is enabled and forced where required.
- [ ] Missing tenant context fails closed.
- [ ] Migrations run as a serialized Job.
- [ ] Backups and point-in-time restore are tested.
- [ ] Query plans and indexes are reviewed for hot paths.

### Kubernetes

- [ ] Images are immutable and signed.
- [ ] Containers run as non-root with dropped capabilities.
- [ ] Requests/limits are defined.
- [ ] Startup/readiness/liveness probes are correct.
- [ ] PDB and topology spread are defined for critical services.
- [ ] NetworkPolicies are default-deny.
- [ ] HPA or worker autoscaling has been load-tested.
- [ ] Secrets come from an approved secret manager.
- [ ] Ingress has TLS, rate limiting, and explicit routing.

### Security and compliance

- [ ] JWT issuer, audience, algorithm, expiry, and key rotation are verified.
- [ ] Service-to-service authentication is caller-scoped and short-lived.
- [ ] File uploads are scanned and stored outside the application filesystem.
- [ ] Audit events are immutable and retained according to policy.
- [ ] Sensitive logs and traces are redacted.
- [ ] Educational AI has provider allowlists, budgets, age-level validation, review, and audit records.

### Delivery and operations

- [ ] CI runs unit, integration, contract, security, and manifest checks.
- [ ] SBOM, image scanning, and signing are enabled.
- [ ] Migration status gates deployment.
- [ ] Smoke tests run through the public ingress.
- [ ] Dashboards and alerts exist for SLOs, database health, queues, and error rates.
- [ ] Rollback and restore runbooks have been exercised.

---

## 22. Final Recommendation

Do not begin by splitting the backend into more microservices. Begin by making the current services honest:

1. Define their domain ownership.
2. Move route logic into use cases and repositories.
3. Make PostgreSQL tenancy fail closed.
4. Remove startup migrations and shared secrets.
5. Add durable events, workers, and operational controls.
6. Then extract only the contexts that have earned independent deployment.

This sequence produces a professional-grade ELS backend on Kubernetes and PostgreSQL without forcing a risky rewrite. It simplifies deployment to a small number of applications while preserving domain ownership and a future path to selective extraction. ELS remains an independent educational product; any future AgentOps integration must be implemented through an explicit external contract rather than shared code, data, credentials, or runtime infrastructure.
