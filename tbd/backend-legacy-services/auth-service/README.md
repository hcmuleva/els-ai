# Auth Service (`auth-service`)

Identity, tenancy, role membership, students/parents/teachers, and billing — the foundation service of ELS-AI.

## What this service does
- **Auth**: register, login, refresh token rotation (JWT + refresh-token table), logout.
- **Users**: CRUD, role assignment, profile fields, active-role switching.
- **Students & parents**: parent ↔ student linking, student profile lookup, activity feed, analytics, quiz attempts.
- **Teachers**: subject and class-level assignments.
- **Subjects & content seeds**: bootstraps initial subjects, topics, and learning content rows on first run.
- **Billing**: subscription plans, organization subscriptions, invoices, 14-day trial enforcement (`402 PAYMENT_REQUIRED` past trial except for superadmin).

## Routes (gateway-prefixed)
### Auth — `/auth`
| Method | Path | Purpose |
|---|---|---|
| POST | `/register` | Register a new user. |
| POST | `/login` | Login → access + refresh token. |
| POST | `/refresh` | Rotate refresh token. |
| POST | `/logout` | Invalidate refresh token. |

### Users — `/users`
- CRUD on users, role assignment, profile, active role switching.

### Students — `/students`
- `GET /students/parent/:userId/students` — parent's linked students.
- `GET /students/:studentId/activity` — activity feed.
- `GET /students/:studentId/quiz-attempts` — full attempt list.
- `GET /students/:studentId/quiz-attempts/:attemptId` — single attempt detail.
- `GET /students/:studentId/assignments` — assignments visible to the student.
- `GET /students/:studentId/upcoming-classrooms`
- `GET /students/:studentId/classroom-remarks`
- `GET /students/:studentId/analytics`
- `POST /students/:studentId/activity` — append activity record.

> Organization CRUD and membership are owned by **org-service** (port 4012). Auth-service only writes to `user_roles` and reads `user_org_mapping`.

### Billing — `/billing`
- `GET /billing/plans`
- `GET/POST /billing/organizations/:id/subscription`
- `POST /billing/organizations/:id/subscribe`
- `POST /billing/organizations/:id/renew`
- `POST /billing/organizations/:id/deactivate`
- `GET /billing/organizations/:id/invoices`
- `GET /billing/invoices/pending`
- `GET /billing/invoices/:id`
- `POST /billing/invoices/:id/pay`
- `POST /billing/organizations/:id/trial/reset`

## Tables owned
- `users`, `user_roles`, `refresh_tokens`
- `parent_student_links`, `student_activities`
- `subscription_plans`, `organization_subscriptions`, `invoices`
- `subjects` (initial seed; content-service writes new ones at runtime)

> `organizations` and `user_org_mapping` are owned by **org-service**.

## Events emitted
- `auth.user.logged_in`
- `billing.subscription.activated`
- `billing.subscription.renewed`
- `billing.subscription.cancelled`
- `billing.invoice.issued`
- `billing.invoice.paid`

## Events consumed
- `billing.invoice.issued` → pushes a real-time notification on `org.<orgId>.notifications`.
- `billing.invoice.paid` → same.

## Environment
| Var | Default | Description |
|---|---|---|
| `PORT` | `4101` | |
| `DATABASE_URL` | from `.env` | Shared Postgres cluster |
| `JWT_SECRET` | `els-secret-key-super-secure` | Sign + verify JWT (must match gateway) |
| `INTERNAL_SECRET` | `els-internal-secret-change-me` | Trust gateway-supplied headers |
| `ABLY_API_KEY` | _empty_ | Enables Ably for real-time + push notifications; falls back to in-memory bus |

## Layout
```
src/
  routes/         auth, users, students, organizations, billing
  services/       use-cases (billing trial enforcement, subscription state)
  repositories/   SQL adapters (users, invoices, …)
  events/         event bus + notification consumers
  seed/           idempotent schema + seed data
  db.ts
  server.ts       PORT=4101
```

## Dev
```bash
npm --workspace backend/auth-service run dev
npm --workspace backend/auth-service run typecheck
```

## Shared deps
- `@els-ai/internal-auth` — `requireAuth` / `requireRole`
- `@els-ai/event-bus` — `getEventBus()` (Ably or in-memory)
