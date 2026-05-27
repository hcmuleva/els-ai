# Quiz Service (`quiz-service`)

Owns quizzes, the questions attached to them, quiz attempts, and the teacher dashboards built on quiz data.

## What this service does
- Create, list, fetch, publish/unpublish, and add questions to quizzes.
- Clone questions from the question bank into a quiz.
- Record student quiz attempts with per-question answers and scoring.
- Power the teacher dashboards: quiz library (with filters) and overview/summary.
- Serve the background-music catalog used by the quiz UI.
- Provide a legacy media-upload shim for callers that haven't switched to `media-service`.

## Routes (gateway-prefixed: `/quizzes`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List quizzes (org-scoped + globals). |
| GET | `/:id` | Quiz detail (with signed media URLs). |
| POST | `/` | Create a quiz. |
| PATCH | `/:id/publish` | Toggle publish state. |
| POST | `/:id/questions` | Add a new question to a quiz. |
| POST | `/:quizId/questions/reuse` | Clone a question from the bank into this quiz. |
| POST | `/attempts` | Record a quiz attempt + per-question answers. |
| GET | `/teacher/library` | Teacher quiz library with filters (`search`, `class_level`, `subject`, `quiz_type`, `difficulty_level`, `status`, `source`, `limit`). |
| GET | `/teacher/overview` | Teacher dashboard summary. |
| GET | `/bgm` | Static background-music catalog. |
| POST | `/uploads/media` | Legacy media upload shim (new callers must use `POST /assets/upload`). |

## Tables owned
- `quizzes`
- `quiz_questions`
- `student_attempts`
- `question_attempts`

## Cross-service reads
- `learning_contents` — for quiz-attached learning content metadata (owned by `content-service`).
- `users` — to resolve creator / student names (owned by `auth-service`).

## Events emitted
- `quiz.created`
- `quiz.submitted`

## Environment
| Var | Default | Description |
|---|---|---|
| `PORT` | `4002` | |
| `DATABASE_URL` | from `.env` | Shared Postgres cluster |
| `JWT_SECRET` | shared with gateway | JWT fallback |
| `INTERNAL_SECRET` | shared with gateway | Trust gateway headers |
| `S3_BUCKET`, `S3_REGION`, `AWS_*` | optional | Media uploads / signing |

## Layout
```
src/
  routes/quizzes.ts   quiz/attempt/teacher routes + legacy upload shim
  middleware/auth.ts  delegates to @els-ai/internal-auth
  repositories/       skeleton
  services/s3.ts      media helpers
  db.ts
  server.ts           PORT=4002
```

## Dev
```bash
npm --workspace backend/quiz-service run dev
npm --workspace backend/quiz-service run typecheck
```

## Shared deps
- `@els-ai/internal-auth`
- `@els-ai/event-bus`
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
