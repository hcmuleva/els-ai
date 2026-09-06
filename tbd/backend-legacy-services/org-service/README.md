# Org Service (`org-service`)

Owns the **organization tenancy** layer: organizations CRUD, the `user_org_mapping` membership table, the canonical default-org enforcement, and the schema migration that keeps existing data scoped to a single canonical org.

## What this service does
- Persist and serve the `organizations` table (id, name, subdomain, logo, settings, `is_default`, soft-delete).
- Maintain `user_org_mapping` — the source of truth for which users belong to which orgs and which org is their primary.
- Mirror the user's primary org id onto `users.primary_organization_id` for fast joins.
- Enforce that exactly one org is marked `is_default = true` (DB-level unique partial index).
- Run an idempotent boot migration that:
  - Adds `is_default`, `logo`, `updated_at`, `deleted_at` to `organizations`.
  - Creates `user_org_mapping` + indexes.
  - Adds `primary_organization_id` to `users`.
  - Renames the canonical org to `ELS ACADEMY`, marks it `is_default = true`.
  - Re-points every tenant table from the legacy `default-org` row to `ELS ACADEMY` and deletes the legacy row.
  - Backfills `user_org_mapping` from existing `user_roles` rows (first role join wins primary).
  - Backfills any NULL `organization_id` rows on tenant tables to the default org.
- Provide membership endpoints (`POST /:id/members`, `DELETE /:id/members/:userId`, `PATCH /:id/members/:userId/primary`) so other services can avoid touching `user_org_mapping` directly.

## Routes (gateway-prefixed: `/organizations`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/me` | any | Orgs the caller belongs to (with `isPrimary` flag). |
| GET | `/` | superadmin | List orgs (`search`, `is_default`). |
| GET | `/:id` | superadmin OR member | Org detail. |
| POST | `/` | superadmin | Create org (`isDefault` is atomic: flips existing default off). |
| PATCH | `/:id` | admin/superadmin (of that org) | Update name / subdomain / logo / settings / is_default. |
| DELETE | `/:id` | superadmin | Soft delete (sets `deleted_at`). Default org cannot be deleted. |
| GET | `/:id/users` | superadmin OR member | List members of an org with their roles + primary flag. |
| POST | `/:id/members` | superadmin OR org-admin | Add user (optionally with `roleName`, optionally `isPrimary=true`). |
| DELETE | `/:id/members/:userId` | superadmin OR org-admin | Remove user from org (drops `user_roles` + `user_org_mapping`). |
| PATCH | `/:id/members/:userId/primary` | superadmin, org-admin, or self | Set primary org for a user. |
| GET | `/_meta` | any auth | Service introspection. |

## Organization model
```json
{
  "id": "uuid",
  "name": "ELS ACADEMY",
  "subdomain": "els-academy",
  "logo": "https://.../logo.png",
  "isDefault": true,
  "settings": { "theme": "default" },
  "createdAt": "2025-...",
  "updatedAt": "2025-...",
  "deletedAt": null
}
```

## Tables owned
- `organizations`
- `user_org_mapping`
- (column) `users.primary_organization_id`

## Cross-service guarantees
- Every other service receives `x-internal-organization-id` from the gateway. Domain handlers MUST filter every read/write by that id.
- The shared helper `requireOrg` (in `@els-ai/internal-auth`) short-circuits with HTTP 400 if a downstream service is hit without an org context. `assertSameOrg(req, resourceOrgId)` is the canonical cross-org guard.

## Events emitted (planned)
- `org.created`
- `org.updated`
- `org.deleted`
- `org.member.added`
- `org.member.removed`

## Environment
| Var | Default | Description |
|---|---|---|
| `PORT` | `4012` | |
| `DATABASE_URL` | from `.env` | Shared Postgres cluster |
| `JWT_SECRET` | shared with gateway | JWT fallback |
| `INTERNAL_SECRET` | shared with gateway | Trust `x-internal-*` headers |
| `ABLY_API_KEY` | _empty_ | Optional real-time bus |

## Layout
```
src/
  routes/organizations.ts     CRUD + members + /me
  services/migrate.ts         idempotent schema + data migration
  middleware/auth.ts          delegates to @els-ai/internal-auth
  db.ts
  server.ts                   PORT=4012
```

## Dev
```bash
npm --workspace backend/org-service run dev
npm --workspace backend/org-service run typecheck
```

## Shared deps
- `@els-ai/internal-auth`
- `@els-ai/event-bus`
