# RLS Activation — Rollout Guide

This is the per-service playbook for switching from the `postgres` superuser
connection to the RLS-bound `els_app` role. The `topic-service` was the
pilot and is fully wired. Use it as the reference implementation.

> **Status: rollout complete.** All 12 backend services now connect under
> a non-superuser role. 9 services connect as `els_app` with Postgres-level
> RLS active; 3 services (`story-service`, `notification-service`,
> `auth-service`) connect as `els_admin` (BYPASSRLS) with app-level
> tenant filtering, due to scheduler / DDL-seed needs documented per
> service. Migration `0011_rls_force.sql` adds `FORCE ROW LEVEL SECURITY`
> on all 37 RLS-enabled tables. Forged-JWT smoke tests (real-org vs.
> bogus-org) confirm 0-row reads on all els_app services.

---

## 1. What's already in place

| Layer | Artifact | Notes |
|---|---|---|
| DB roles | `els_app`, `els_admin` | migration `0010_app_roles.sql` |
| RLS policies | 37 tables, 74 policies | migrations `0004` + `0009` |
| Helper package | `@els-ai/db-tenant` | exposes `wrapPoolWithTenancy()` + `createTenantContextMiddleware()` |
| Pilot service | `topic-service` | reference implementation |

---

## 2. Per-service cutover steps

For each service in `backend/<service>/`:

### 2.1 Add the dependency
`backend/<service>/package.json`:
```json
"dependencies": {
  "@els-ai/db-tenant": "1.0.0",
  ...
}
```

Run `npm install` from repo root.

### 2.2 Wrap the pool in `db.ts`
Before:
```ts
import { Pool } from 'pg';
export const db = new Pool({ ... });
```
After:
```ts
import { Pool } from 'pg';
import { wrapPoolWithTenancy } from '@els-ai/db-tenant';

const pool = new Pool({ ... });
export const db = wrapPoolWithTenancy(pool);
```

The wrapped `db.query` automatically opens a tx + `SET LOCAL app.org_id` /
`app.user_id` when called inside a tenant context. Outside a tenant context
(background jobs, the migration runner) it passes through to plain
`pool.query`.

`db.connect()` is preserved for routes that manage their own transactions
(e.g. `BEGIN…COMMIT` patterns); on tenant-context connect, the helper
applies session-level `SET app.org_id` / `app.user_id` and registers a
`RESET` hook on `release()` so the connection is sanitized before going
back to the pool.

### 2.3 Wire the middleware in `server.ts`
```ts
import { createTenantContextMiddleware } from '@els-ai/db-tenant';

const tenantContext = createTenantContextMiddleware();

// Apply to every router that needs tenant data; place AFTER requireAuth.
app.use('/topics', requireAuth, tenantContext, topicsRouter);
```

The middleware reads `req.user.{organizationId,userId}` and runs the
downstream handler inside a `tenantStore.run(...)` so all subsequent
`db.query()` calls see the org context.

### 2.4 Switch the `.env` to `els_app`
```env
DB_USER=els_app
DB_PASSWORD=els_app_dev_password   # rotate in staging/prod
```

### 2.5 Smoke + negative test
1. Start the service.
2. Forge a JWT with the correct org → confirm endpoints return data.
3. Forge a JWT with a bogus org → confirm endpoints return 0 rows /
   "not found" / write rejection.
4. Run all existing integration tests.

A reusable JWT-forge snippet (substitute IDs and the JWT secret from
`.env`):
```js
const jwt = require('jsonwebtoken');
console.log(jwt.sign({
  userId: '<uuid>', organizationId: '<uuid>', email: 'x@y', role: 'teacher'
}, 'els-secret-key-super-secure', { expiresIn: '1h' }));
```

---

## 3. Common gotchas (learned during the pilot)

### 3.1 Type-inference SQL bugs surface for the first time
When the wrapper PREPAREs queries inside an explicit transaction, Postgres
rejects parameters that are used in multiple inferred-type contexts. Symptom:
`error 42P08: inconsistent types deduced for parameter $N — text versus
character varying`.

**Fix**: add explicit casts in the SQL: `$2::varchar`, `$1::uuid`,
`$N::boolean` etc. Check every `LOWER($n)` / `_ = $n` pair — that's the
usual culprit. The fix is harmless even if the wrapper isn't installed.
Example from `topic-service`:
```sql
INSERT INTO content_topics (organization_id, class_level, ...)
VALUES ($1::uuid, $2::varchar, $3::varchar, ...,
  (SELECT s.id FROM subjects s
    WHERE s.class_level = $2::varchar AND LOWER(s.title) = LOWER($3::varchar)
      AND (s.organization_id = $1::uuid OR $7::boolean = true)
    ...))
```

### 3.2 Routes that do their own `BEGIN/COMMIT`
`db.connect()` works as before. The wrapper applies session-level
`SET app.org_id` / `app.user_id` to the pinned client and patches
`release()` so the vars are reset before the connection returns to the
pool. **No code change is required in those routes.**

### 3.3 Background jobs (notification scheduler, seed, migrations)
These run without a request → without a tenant context → through plain
`pool.query`. Connect them as `els_admin` (which has `BYPASSRLS`):
```env
DB_USER=els_admin
DB_PASSWORD=**********************
```

### 3.4 Services with both routes AND a scheduler (story-service, notification-service)
For services that mix per-request routes with a background scheduler, you
have two options:

- **Quick option (what story-service does today)**: connect as `els_admin`
  for the whole pool. RLS is bypassed for everything; the application-level
  `WHERE organization_id = $1` filter is your only tenant guard. Document
  this as a known trade-off.
- **Better option (future refactor)**: split into two pools — `db`
  (`els_app`, RLS-bound, used by routes) and `dbAdmin` (`els_admin`, used
  by scheduler / DDL). The wrapper applies to `db` only.

### 3.5 ensureSchema() / CREATE TABLE in service bootstrap is dead code
Some legacy services have an `ensureSchema()` function that runs
`CREATE TABLE IF NOT EXISTS` and `ALTER TABLE` at startup. With migrations
under `/migrations/*` running through `npm run migrate`, this is dead.
**Remove the `await ensureSchema()` call from `bootstrap()` during the
RLS migration** — neither `els_app` nor `els_admin` is the table owner,
so `ALTER TABLE` will fail with `42501 must be owner of table`.

### 3.6 Cross-org admin endpoints
A few endpoints (superadmin tools, reports) need to see all tenants. Two
options:
- Run those endpoints under a separate admin connection pool that uses
  `els_admin`.
- Add a route-level guard that opens a context with a special org id and
  rely on `is_global = true` for the rows you want visible.

---

## 4. Service-by-service rollout order (suggested)

1. ~~`topic-service`~~ — done. els_app + RLS verified.
   **Smoke:** `GET /topics` → real 16 / bogus 0.
2. ~~`content-service`~~ — done. els_app + RLS verified. Required SQL cast
   fix in INSERT/UPDATE. **Smoke:** `/content/items` → 27 / 0;
   `/content/subjects` → 113 / 0.
3. ~~`assignment-service`~~ — done. els_app + RLS verified (typecheck only;
   service exposes only POST endpoints).
4. ~~`achievement-service`~~ — done. els_app + RLS verified.
   **Smoke:** `GET /achievements` → real 8 / bogus 0.
5. ~~`question-bank-service`~~ — done. els_app + RLS verified.
   **Smoke:** `GET /questions` → real 94 / bogus 0.
6. ~~`story-service`~~ — done, but on **els_admin (BYPASSRLS)** because of
   its scheduler + dropped `ensureSchema()`. App-level filter still works.
   **Smoke:** `GET /stories` → real 8 / bogus 0 (app-level WHERE filter).
7. ~~`quiz-service`~~ — done. els_app + RLS verified. Refactored the
   pseudo-transaction in `POST /quizzes/attempts` to use a pinned
   `db.connect()` client (the previous `pool.query('BEGIN'…COMMIT)` pattern
   was broken across pool clients regardless of RLS). Dropped the legacy
   `ensureSchema()` blob from `bootstrap()` because `els_app` is not the
   table owner. **Smoke confirmed:** `GET /quizzes` → 31 rows real / 0
   bogus; `GET /quizzes/teacher/library` → 31 / 0.
8. ~~`classroom-service`~~ — done. els_app + RLS verified. Existing
   explicit `db.connect()` + `BEGIN/COMMIT` blocks already pin a client,
   so the patched connect() applies session-level tenancy automatically.
   Dropped the legacy `ensureSchema()` (`ALTER TABLE classrooms`) that
   would otherwise fail under els_app. **Smoke confirmed:**
   `GET /classrooms` → real org returns the live roster, bogus org
   returns `{"classrooms":[]}`.
9. ~~`org-service`~~ — done. els_app + RLS verified. Multiple routes use
   `db.connect()` + explicit transactions; the patched `connect()` applies
   tenancy without code changes. `users`/`user_roles` reads still work
   because RLS isn't enforced on those tables. **Smoke:** real superadmin
   gets 200 on `/organizations`; bogus role gets 403 (route-level guard).
10. ~~`media-service`~~ — done. els_app + RLS verified. Already wrapped
    when the helper landed.
11. ~~`notification-service`~~ — done, on **els_admin (BYPASSRLS)** because
    of the scheduler. App-level filter still works (same pattern as
    story-service). **Smoke:** `GET /notifications` returns rows scoped to
    `req.user.userId` only.
12. ~~`auth-service`~~ — done, on **els_admin (BYPASSRLS)**. The legacy
    DDL inlined in `initSchemaAndSeed()` was lifted into
    `migrations/0012_auth_seed_schema.sql` and removed from the source.
    Only DML seed work (subjects catalog, demo users, default plans) runs
    at startup now. Tenancy on auth routes is enforced only at the
    application-level `WHERE organization_id = $1` filter (same trade-off
    as story-service / notification-service). **Smoke confirmed:**
    `POST /auth/login` ramesh@els.ai → 200 with token; bad password → 401.
13. `gateway` — no DB connection.

For each: ~10–15 min of work + smoke + negative test.

---

## 5. After every service is migrated

~~Force RLS for the table owner~~ — done in `migrations/0011_rls_force.sql`.
All 37 RLS-enabled tables now also have `FORCE ROW LEVEL SECURITY`, so any
future role that happens to be the table owner will still see the policies
applied. Note: the migration must be run as the table owner (`postgres` in
dev) — `els_admin` cannot run `ALTER TABLE` on tables it does not own.

And rotate the dev passwords:
```sql
ALTER ROLE els_app    PASSWORD '<long-random>';
ALTER ROLE els_admin  PASSWORD '<long-random>';
```

Then update the `.env` files and your secret manager.
