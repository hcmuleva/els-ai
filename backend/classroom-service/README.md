# Classroom Service (`classroom-service`)

Owns the **classrooms** domain end-to-end: creating, scheduling, ending, restarting, attaching content/quiz/assignments, per-student remarks, and the student-facing classroom feed.

## What this service does
- Create instant or scheduled classrooms, list/fetch/update/delete them.
- End a classroom and restart it as a fresh duplicate.
- Attach learning content, quizzes, and assignments to a classroom.
- Record per-student teacher remarks and surface them in detail screens.
- Compute the per-classroom detail screen (resources + per-student status + completion %).
- Compute the student classroom feed scoped to the student's current class level (with completion stats and submission state).
- Return achievement grants tied to a classroom.

## Routes (gateway-prefixed: `/classrooms`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List classrooms for current org/user. |
| GET | `/history` | Completed classrooms. |
| GET | `/:classroomId` | Classroom + attached resources. |
| POST | `/` | Create classroom (instant / scheduled). |
| PUT | `/:classroomId` | Update classroom. |
| DELETE | `/:classroomId` | Delete classroom. |
| PATCH | `/:classroomId/end` | Mark classroom ended. |
| PATCH | `/:classroomId/restart` | Clone the classroom as a fresh one. |
| GET | `/:classroomId/class-details` | Aggregated teacher detail view. |
| GET | `/:classroomId/students/:studentId/details` | Per-student progress detail. |
| PUT | `/:classroomId/remarks/:studentId` | Save teacher remark for a student. |
| GET | `/:classroomId/achievements` | Achievements granted within a classroom. |
| POST | `/:classroomId/content` | Attach learning content. |
| POST | `/:classroomId/quiz` | Attach quiz. |
| POST | `/:classroomId/assignment` | Attach assignment. |
| GET | `/student` | Student-facing classroom feed (replaces legacy `/students/classrooms`). |

## Tables owned
- `classrooms`
- `classroom_contents`
- `classroom_quizzes`
- `classroom_assignments`
- `classroom_student_remarks`

## Cross-service reads
- `learning_contents` / `learning_content_sections` — hydrate attached content (owned by `content-service`).
- `quizzes` — hydrate attached quizzes (owned by `quiz-service`).
- `student_attempts` — compute completion in the student feed (owned by `quiz-service`).
- `classroom_assignment_submissions` — submission state (owned by `assignment-service`).
- `users` — student roles & class levels (owned by `auth-service`).

## Events emitted
- `classroom.scheduled`
- `classroom.ended`
- `classroom.restarted`

## Events consumed
- `classroom.scheduled` / `classroom.ended` — notification fan-out (`events/notifications.ts`).

## Environment
| Var | Default | Description |
|---|---|---|
| `PORT` | `4006` | |
| `DATABASE_URL` | from `.env` | Shared Postgres cluster |
| `JWT_SECRET` | shared with gateway | JWT fallback |
| `INTERNAL_SECRET` | shared with gateway | Trust `x-internal-*` headers |
| `ABLY_API_KEY` | _empty_ | Optional real-time bus |

## Layout
```
src/
  routes/classrooms.ts       all 16 handlers + helpers
  middleware/auth.ts         delegates to @els-ai/internal-auth
  repositories/classrooms.repository.ts
  events/{bus,notifications}.ts
  services/s3.ts
  db.ts
  server.ts                  PORT=4006
```

## Dev
```bash
npm --workspace backend/classroom-service run dev
npm --workspace backend/classroom-service run typecheck
```

## Shared deps
- `@els-ai/internal-auth`
- `@els-ai/event-bus`
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
