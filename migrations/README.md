# Database Migrations

All schema changes for `els_ai_db` live here as ordered, immutable SQL files and
are applied by the runner in [`scripts/migrate.cjs`](../scripts/migrate.cjs).

This is the **only** supported way to change the schema. Application services
connect as the `els_app` role (and a few as `els_admin`), and **neither can run
DDL** — the tables are owned by the `postgres` superuser. See
[`docs/RLS_ROLLOUT.md`](../docs/RLS_ROLLOUT.md) for the role model.

---

## How it works

- Every file is named `NNNN_short_description.sql` (4-digit, zero-padded, ordered).
- `0000_schema_migrations.sql` bootstraps the tracker table `schema_migrations`.
- The runner applies, **in filename order**, every file whose version is not yet
  recorded in `schema_migrations`, then records `version, filename, checksum,
  duration_ms`.
- Each file is checksummed (SHA-256). If a **already-applied** file's contents
  change, the runner logs a checksum-drift warning and **re-runs** it — so keep
  applied migrations immutable and make every statement idempotent.
- The runner does not wrap files in a transaction. If you need all-or-nothing,
  add `BEGIN;` / `COMMIT;` inside the file yourself.

---

## Who can run migrations

DDL requires the **table owner / superuser** (`postgres` in local dev). The
runner reads DB connection env from `backend/auth-service/.env` then the repo
root `.env`, and only fills a variable if it isn't already set. Because
`auth-service/.env` sets `DB_USER=els_admin` (which cannot run DDL), you must
override the user/password with a superuser when running migrations:

```bash
# From the repo root
DB_USER=postgres DB_PASSWORD=<postgres-password> npm run migrate
```

Connection variables (with defaults): `DB_HOST` (localhost), `DB_PORT` (5432),
`DB_NAME` (els_ai_db), `DB_USER` (postgres), `DB_PASSWORD`.

---

## Commands

```bash
# Apply all pending migrations (as a superuser — see above)
DB_USER=postgres DB_PASSWORD=<pw> npm run migrate

# Read-only: show applied / pending / drifted migrations (safe as any role)
npm run migrate:status
```

You can also inspect state directly:

```sql
SELECT version, filename, applied_at FROM schema_migrations ORDER BY version;
```

### Auto-apply when starting services (optional)

`backend/manage-services.sh start` (and `restart`) will auto-apply pending
migrations **only if** you provide superuser credentials via env — otherwise it
prints a hint and continues (never blocks startup):

```bash
MIGRATE_DB_USER=postgres MIGRATE_DB_PASSWORD=<pw> ./backend/manage-services.sh start
```

---

## Creating a new migration

1. Create the next file: `migrations/NNNN_short_description.sql` (increment the
   highest existing number).
2. Write **idempotent** DDL so re-runs are safe:
   - `CREATE TABLE IF NOT EXISTS ...`
   - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
   - `CREATE INDEX IF NOT EXISTS ...`
   - `DROP ... IF EXISTS ...`
3. For a **new tenant-scoped table**, follow the existing pattern: add an
   `organization_id UUID` column and matching RLS policies (see
   `0004_rls_tenant_isolation.sql` / `0009_rls_extend_coverage.sql`), and grant
   privileges to `els_app` / `els_admin` as other tables do (`0010_app_roles.sql`).
4. Never edit a migration that has already been applied on any shared
   environment — add a new one instead.
5. Apply it: `DB_USER=postgres DB_PASSWORD=<pw> npm run migrate`, then
   `npm run migrate:status` to confirm.

### Minimal template

```sql
-- Migration NNNN — <what this does and why>.
BEGIN;

ALTER TABLE some_table
  ADD COLUMN IF NOT EXISTS new_col TEXT;

COMMIT;
```

---

## Recent migrations (reference)

| File | Purpose |
| --- | --- |
| `0022_video_sections.sql` | Per-content interactive video sections + progress |
| `0023_video_sections_per_content_section.sql` | `content_section_order` scoping |
| `0024_video_sections_multi_quiz.sql` | Multiple quizzes per video section |
| `0025_video_sections_publish_existing.sql` | Backfill/publish existing sections |
| `0026_quiz_question_explanation.sql` | `quiz_questions.explanation` column |
