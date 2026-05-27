# Question Bank Service (`question-bank-service`)

Owns the **reusable question bank** — questions authored independently of any single quiz, browsable and clonable into quizzes by `quiz-service`.

## What this service does
- CRUD over the standalone question bank with filtering by subject, class level, type, category, and free-text search.
- Serve the browse view used by the "Clone from bank" UI.
- Sign any S3-hosted media references inside question payloads and audio fields.
- Enforce per-question/per-quiz edit permissions when a bank question is linked to a quiz.

## Routes (gateway-prefixed)
| Method | Path | Purpose |
|---|---|---|
| GET | `/questions` | List with filters (`search`, `class_level`, `subject`, `category`, `quiz_type`, `quiz_id`, `limit`). |
| GET | `/questions/:questionId` | Single question with signed media. |
| POST | `/questions` | Create (optionally linked to a quiz via `quizId`). |
| PATCH | `/questions/:questionId` | Update. |
| DELETE | `/questions/:questionId` | Delete. |
| GET | `/question-bank` | Bank browse view (`search`, `class_level`, `subject`, `question_type`, `limit`). |

> Cloning a bank question into a specific quiz lives at `POST /quizzes/:quizId/questions/reuse` in **quiz-service** (it mutates the quiz, not the bank).

## Tables owned
- `quiz_questions` (the bank shares this table with quiz-attached questions; bank-only rows have `quiz_id IS NULL`).

## Cross-service reads
- `quizzes` — for permission checks when a question is linked to a quiz.

## Events emitted (planned)
- `questionbank.question.created`
- `questionbank.question.updated`
- `questionbank.question.deleted`

## Environment
| Var | Default | Description |
|---|---|---|
| `PORT` | `4008` | |
| `DATABASE_URL` | from `.env` | Shared Postgres cluster |
| `JWT_SECRET` | shared with gateway | |
| `INTERNAL_SECRET` | shared with gateway | |

## Layout
```
src/
  routes/questions.ts       all 6 handlers + helpers
  middleware/auth.ts        delegates to @els-ai/internal-auth
  repositories/questions.repository.ts
  events/bus.ts
  services/s3.ts
  db.ts
  server.ts                 PORT=4008
```

## Dev
```bash
npm --workspace backend/question-bank-service run dev
npm --workspace backend/question-bank-service run typecheck
```

## Shared deps
- `@els-ai/internal-auth`
- `@els-ai/event-bus`
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
