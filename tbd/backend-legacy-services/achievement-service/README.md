# Achievement Service (`achievement-service`)

Owns the **achievement domain** — the catalog of badges/awards an organization can grant to its students plus the grant ledger.

## What this service does
- Expose the deduplicated global achievement catalog.
- Grant an achievement to a student inside a classroom (idempotent via the unique key `(student_id, classroom_id, achievement_id)`).
- Resolve the canonical achievement row before inserting so duplicates by name fold into the same award.
- Return the current student's full earned history, grouped by achievement name with per-achievement counts and chronological items.

## Routes (gateway-prefixed: `/achievements`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/achievements` | Global achievement catalog (deduped by name). |
| POST | `/achievements/grant` | Grant an achievement to a student in a classroom (teacher/admin/superadmin). |
| GET | `/achievements/my` | Caller's earned history. |

> The classroom-scoped variant `GET /classrooms/:id/achievements` lives in **classroom-service**.

## Tables owned
- `achievements`
- `student_achievements`

## Events emitted (planned)
- `achievement.granted`

## Environment
| Var | Default | Description |
|---|---|---|
| `PORT` | `4007` | |
| `DATABASE_URL` | from `.env` | Shared Postgres cluster |
| `JWT_SECRET` | shared with gateway | JWT fallback |
| `INTERNAL_SECRET` | shared with gateway | Trust `x-internal-*` headers |
| `ABLY_API_KEY` | _empty_ | Optional real-time bus |

## Layout
```
src/
  routes/achievements.ts     catalog / grant / my
  middleware/auth.ts         delegates to @els-ai/internal-auth
  repositories/achievements.repository.ts
  events/bus.ts
  db.ts
  server.ts                  PORT=4007
```

## Dev
```bash
npm --workspace backend/achievement-service run dev
npm --workspace backend/achievement-service run typecheck
```

## Shared deps
- `@els-ai/internal-auth` — `requireAuth`, `canManageTeacherContent`, `getUserId`
- `@els-ai/event-bus`
