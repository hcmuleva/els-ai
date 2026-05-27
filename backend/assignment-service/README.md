# Assignment Service (`assignment-service`)

Owns **student assignment submissions** for assignments attached to classrooms.

## What this service does
- Accept student submissions (text and/or attachment) for an assignment within a classroom.
- Idempotent submit / re-submit on `(classroom_assignment_id, student_id)`.
- Verify the caller has the `student` active role inside the org.
- Verify the assignment actually belongs to the given classroom (and org) before recording.

## Routes (gateway-prefixed: `/assignments`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/classrooms/:classroomId/:assignmentId/submissions` | Student submits / re-submits an assignment. |

> Related flows owned elsewhere:
> - Attaching an assignment to a classroom — `POST /classrooms/:classroomId/assignment` (**classroom-service**).
> - Topic-content assignments — `GET/PUT /topics/:topicId/assignments` (**topic-service**).

## Tables owned
- `classroom_assignment_submissions`

## Cross-service reads
- `classroom_assignments` (owned by `classroom-service`) — validate the assignment belongs to the classroom.
- `classrooms` — validate org scoping.
- `users` / `user_roles` — verify the submitter is a student.

## Events emitted (planned)
- `assignment.submitted`
- `assignment.graded`

## Environment
| Var | Default | Description |
|---|---|---|
| `PORT` | `4011` | |
| `DATABASE_URL` | from `.env` | Shared Postgres cluster |
| `JWT_SECRET` | shared with gateway | |
| `INTERNAL_SECRET` | shared with gateway | |

## Layout
```
src/
  routes/assignments.ts       submission handler + helpers
  middleware/auth.ts          delegates to @els-ai/internal-auth
  repositories/assignments.repository.ts
  events/bus.ts
  services/s3.ts
  db.ts
  server.ts                   PORT=4011
```

## Dev
```bash
npm --workspace backend/assignment-service run dev
npm --workspace backend/assignment-service run typecheck
```

## Shared deps
- `@els-ai/internal-auth`
- `@els-ai/event-bus`
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
