# Fix: `GET /bookmarks` → 500 "Failed to list bookmarks"

## Symptom
The bookmarks endpoint returns a 500 even when there are no bookmarks:

```
GET http://localhost:4000/bookmarks?
500 Internal Server Error
{"message":"Failed to list bookmarks"}
```

The content-service log shows the real cause:

```
error: permission denied for table teacher_bookmarks
code: '42501'
```

The teacher class-assignments endpoint (`GET /users/teachers/assignments`) can fail the
same way (`permission denied for table teacher_class_assignments`).

## Root cause
The app connects to Postgres as the RLS-bound role **`els_app`**.

Migration `0010_app_roles.sql` grants CRUD to `els_app` on all then-existing tables and sets
`ALTER DEFAULT PRIVILEGES` so future tables auto-grant. But default privileges only apply to
tables created by the **same role** that set them. The tables added by later migrations were
created without granting to `els_app`:

- `0018_teacher_class_assignments.sql` → `teacher_class_assignments`
- `0019_teacher_bookmarks.sql` → `teacher_bookmarks`, `teacher_bookmark_items`

So `els_app` has no access to them and every query fails with `42501`.

## Permanent fix (already in the repo)
Explicit grants were added to the two migrations:

```sql
-- migrations/0018_teacher_class_assignments.sql
GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_class_assignments TO els_app;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON teacher_class_assignments TO els_admin;

-- migrations/0019_teacher_bookmarks.sql
GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_bookmarks, teacher_bookmark_items TO els_app;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON teacher_bookmarks, teacher_bookmark_items TO els_admin;
```

The migration runner re-applies a file when its checksum changes, so these grants apply on the
next `migrate` run.

## How to apply on another system

### Option A — run migrations (recommended)
From the repo root:

```bash
npm run migrate
```

Expected output:

```
[migrate] WARN: checksum drift for 0018_teacher_class_assignments.sql; re-running.
[migrate] applying 0018_teacher_class_assignments.sql
[migrate] WARN: checksum drift for 0019_teacher_bookmarks.sql; re-running.
[migrate] applying 0019_teacher_bookmarks.sql
[migrate] 2 migration(s) applied.
```

> The runner reads DB connection from `backend/auth-service/.env` (and root `.env`):
> `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

### Option B — apply the grant directly (if you can't run migrations)
Run as the table owner / a superuser (e.g. `postgres`):

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d els_ai_db <<'SQL'
GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_class_assignments TO els_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_bookmarks, teacher_bookmark_items TO els_app;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON teacher_class_assignments TO els_admin;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON teacher_bookmarks, teacher_bookmark_items TO els_admin;
SQL
```

Replace `els_ai_db` with your actual `DB_NAME`.

### Option C — fresh / cloned database (e.g. schema-only clone)
A schema-only clone can miss grants for these tables. Re-apply the full role grants once:

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d <DB_NAME> <<'SQL'
GRANT USAGE ON SCHEMA public TO els_app, els_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO els_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO els_app;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO els_admin;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO els_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO els_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO els_app;
REVOKE ALL ON TABLE schema_migrations FROM els_app;
SQL
```

## Verify

```bash
# 1. Privileges present
PGPASSWORD=postgres psql -h localhost -U postgres -d els_ai_db -c \
  "SELECT has_table_privilege('els_app','teacher_bookmarks','SELECT') AS bm,
          has_table_privilege('els_app','teacher_bookmark_items','SELECT') AS bmi,
          has_table_privilege('els_app','teacher_class_assignments','SELECT') AS tca;"
# Expect: t | t | t

# 2. Endpoint works (login as a teacher first to get a token)
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"teacher@els.ai","password":"welcome"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

curl -s -o /dev/null -w "status=%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" "http://localhost:4000/bookmarks?"
# Expect: status=200
```

No service restart is required — grants take effect immediately.
