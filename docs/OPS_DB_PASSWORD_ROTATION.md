# DB Password Rotation Runbook

Rotate the two Postgres roles that every backend service authenticates as,
and roll the new credentials into every service's environment without
downtime.

This runbook is **deploy-time only**. Do not run it during the RLS rollout
work or against a developer laptop — local dev keeps the seeded
`els_app` / `els_admin` passwords in `backend/*/.env`.

---

## 1. Why we rotate these two roles

The RLS rollout (see `docs/RLS_ROLLOUT.md`) split application traffic
across two Postgres roles:

| Role         | `BYPASSRLS` | Used by                                                                                                                |
|--------------|-------------|------------------------------------------------------------------------------------------------------------------------|
| `els_app`    | **false**   | topic, content, assignment, achievement, question-bank, quiz, classroom, org, media services                            |
| `els_admin`  | **true**    | story, notification, auth services (cross-tenant schedulers, login lookups, billing fan-out)                            |

Both roles connect from every backend pod. If either credential leaks, an
attacker who already has network access to Postgres can:

- With `els_app`: read/write **only inside the tenant their JWT names**
  (RLS enforced).
- With `els_admin`: read/write **across all tenants**.

Routine rotation keeps the blast radius of a stolen credential bounded in
time.

---

## 2. Rotation cadence

| Environment | Cadence              | Notes                                                              |
|-------------|----------------------|--------------------------------------------------------------------|
| dev / local | never                | seeded values are committed-with-the-team; not a real secret       |
| staging     | every 90 days        | run alongside the regular dependency-bump cadence                  |
| prod        | every 60 days        | also rotate immediately on any incident or contractor offboarding  |

Track each rotation in the on-call log with the date, the engineer, and
the migration window.

---

## 3. Pre-flight

Before you start:

1. **Pick a maintenance window.** The cutover is read-only for the apps
   for ~30 seconds while pods restart. Pick low-traffic.
2. **Confirm the secrets store path.** Production keeps these under the
   following keys (adjust per environment):
   ```
   secrets://els/<env>/postgres/els_app/password
   secrets://els/<env>/postgres/els_admin/password
   ```
3. **Confirm migration state is clean.** Running migrations against a
   role with stale credentials will fail mid-flight.
   ```bash
   DB_USER=postgres DB_PASSWORD=<superuser> node scripts/migrate.cjs
   # → expect: "0 migration(s) applied" (everything already up to date)
   ```
4. **Get the connection string for the postgres superuser.** Only the
   superuser can `ALTER ROLE … PASSWORD …`; neither `els_app` nor
   `els_admin` can rotate themselves.

---

## 4. Rotation steps

### 4.1 Generate the new passwords

Use a 32-byte URL-safe random string per role.

```bash
openssl rand -base64 32 | tr -d '/+=' | head -c 40   # els_app
openssl rand -base64 32 | tr -d '/+=' | head -c 40   # els_admin
```

Treat each output as a single-line secret. **Do not paste it into Slack,
chat history, or git.**

### 4.2 Stage the new password in the secrets manager

For each environment, write the new value alongside the old one so the
running pods can keep using the old value while we apply the change in
Postgres. Most secrets managers support versioned values out of the box:

```bash
# Vault example
vault kv put secrets/els/<env>/postgres \
  els_app/password=$NEW_ELS_APP_PASSWORD \
  els_admin/password=$NEW_ELS_ADMIN_PASSWORD

# AWS SecretsManager example
aws secretsmanager update-secret \
  --secret-id els/<env>/postgres \
  --secret-string '{"els_app":"…","els_admin":"…"}'
```

Do **not** delete the previous version yet — pods still hold it in
memory.

### 4.3 Apply the rotation in Postgres

Connect as the superuser and rotate both roles:

```sql
ALTER ROLE els_app   WITH PASSWORD :'NEW_ELS_APP_PASSWORD';
ALTER ROLE els_admin WITH PASSWORD :'NEW_ELS_ADMIN_PASSWORD';
```

Existing connections stay alive — Postgres only checks the password on
new authentication. This is exactly what we want for a hot rotation.

### 4.4 Roll the pods

For every backend service that mounts these passwords, trigger a rolling
restart. The deployment platform should re-read the secrets manager on
pod start.

**Services that read `els_app`** (do these first; they are RLS-enforced
and far more numerous):

```
topic-service           content-service        assignment-service
achievement-service     question-bank-service  quiz-service
classroom-service       org-service            media-service
```

**Services that read `els_admin`** (do these second):

```
story-service           notification-service   auth-service
```

After each batch:

1. Watch error rate in observability.
2. `kubectl logs -l app=<service> | grep -i 'authentication failed'` —
   should be empty.
3. Hit the service's healthcheck (`/healthz`) to confirm it can talk to
   Postgres.

### 4.5 Decommission the old password

Once **every** pod has restarted and is healthy on the new credential
for at least one full healthcheck cycle:

```bash
# Vault: remove the previous version
vault kv metadata delete-version secrets/els/<env>/postgres -version=<old>
```

(Adjust per secrets manager; AWS SecretsManager rotates by default.)

The old password is now invalid. Anyone holding a copy of it cannot
authenticate.

---

## 5. Local-dev expectations

Developers running on their laptops continue to use the committed
defaults from `backend/<service>/.env`:

| Service                                          | DB_USER       | DB_PASSWORD          |
|--------------------------------------------------|---------------|----------------------|
| topic, content, assignment, achievement,         | `els_app`     | seeded value         |
| question-bank, quiz, classroom, org, media       |               |                      |
| story, notification, auth                        | `els_admin`   | seeded value         |

These files are gitignored (`*/.env` is in `.gitignore`) but are
recreated by the bootstrap script with the seeded development passwords.
**Local dev passwords are not secrets** — they only ever protect a
laptop's local Postgres.

If you accidentally rotate against your laptop, restore the seeded
passwords with:

```bash
psql -h localhost -U postgres -d els_ai_db -c "
  ALTER ROLE els_app   WITH PASSWORD 'els_app_dev_password';
  ALTER ROLE els_admin WITH PASSWORD 'els_admin_dev_password';"
```

(Replace with whatever your local seed script set them to — see
`scripts/init_db_roles.sql` if it exists, or your team's onboarding
doc.)

---

## 6. Rollback

If the rotation breaks production traffic:

1. **Restore the old password.** Re-run the `ALTER ROLE … PASSWORD …`
   statement with the previous value (you stashed it in 4.2).
2. **Revert the secrets-manager version** so pods that are mid-restart
   pull the old value.
3. **Roll the pods again** to ensure they're all on the same value.
4. Then investigate the failure offline before re-attempting.

The whole rollback takes <2 minutes if you do not panic.

---

## 7. Audit log

After the rotation completes, log it in
`docs/RLS_ROLLOUT.md` § "Operations" with:

- date / environment
- engineer who performed it
- ticket / change-management ID
- any anomalies or pod restart spikes seen during the window

That's it. Keep this runbook updated as the secrets-manager backend
changes.
