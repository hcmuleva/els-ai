# Topic Service (`topic-service`)

Owns the **topic taxonomy** — class × subject × topic — plus the mappings from a topic to its learning content, quizzes, and content assignments. Also serves the student subject feed and the teacher subject catalog.

## What this service does
- Store the class/subject/topic hierarchy with cover images.
- Map learning content into topics (ordered) and quizzes into topics (1:1 via `quizzes.topic_id`).
- Resolve teacher topic-detail screens with full content sections and signed media URLs.
- Resolve the student Subjects → Topics feed scoped to the student's current class level.
- Resolve the org subject catalog (`/catalog/subjects`) so authoring screens can pre-populate class + subject pickers.
- Enforce ownership: only the creator (or admin/superadmin) can edit/delete a topic; only callers with `canPublishGlobal` may mark a topic global.

## Routes (gateway-prefixed)
| Method | Path | Purpose |
|---|---|---|
| GET | `/topics` | List topics (`classLevel`, `subject`, `search`). |
| POST | `/topics` | Create topic. |
| PATCH | `/topics/:id` | Update topic. |
| DELETE | `/topics/:id` | Delete topic. |
| GET | `/topics/:id/details` | Topic + content items + sections + signed media. |
| PUT | `/topics/:id/sections` | Replace the ordered topic-section list. |
| GET | `/topics/:id/assignments` | Content assigned to a topic. |
| PUT | `/topics/:id/assignments` | Replace assigned content for a topic. |
| GET | `/topics/:id/quizzes` | Quizzes mapped to a topic. |
| PUT | `/topics/:id/quizzes` | Bulk-replace quiz mappings for a topic. |
| PUT | `/topics/:id/quizzes/:quizId` | Assign a single quiz to a topic. |
| DELETE | `/topics/:id/quizzes/:quizId` | Unassign a single quiz from a topic. |
| GET | `/catalog/subjects` | Admin-defined class × subject catalog for the org. |
| GET | `/students/subjects` | Student subject feed (current class level). |
| GET | `/students/subjects/:topicId` | Student topic detail with ordered content. |

## Tables owned
- `content_topics`
- `topic_content_assignments`
- `topic_content_sections`

## Cross-service reads
- `learning_contents`, `learning_content_sections` (owned by `content-service`).
- `quizzes` (owned by `quiz-service`).
- `subjects` (owned by `content-service`).
- `users` — student class-level lookup (owned by `auth-service`).

## Events emitted (planned)
- `topic.created`
- `topic.updated`
- `topic.deleted`

## Environment
| Var | Default | Description |
|---|---|---|
| `PORT` | `4010` | |
| `DATABASE_URL` | from `.env` | Shared Postgres cluster |
| `JWT_SECRET` | shared with gateway | JWT fallback |
| `INTERNAL_SECRET` | shared with gateway | Trust `x-internal-*` headers |
| `USE_S3`, `S3_BUCKET_NAME`, `AWS_REGION`, `S3_PUBLIC_BASE_URL`, `S3_SIGNED_URL_TTL_SECONDS` | optional | Signed cover image URLs |

## Layout
```
src/
  routes/topics.ts         handlers for /topics, /catalog/subjects, /students/subjects
  services/s3.ts           cover-image signing / canonicalization
  middleware/auth.ts       delegates to @els-ai/internal-auth
  repositories/topics.repository.ts
  events/bus.ts
  db.ts
  server.ts                PORT=4010
```

## Dev
```bash
npm --workspace backend/topic-service run dev
npm --workspace backend/topic-service run typecheck
```

## Shared deps
- `@els-ai/internal-auth`
- `@els-ai/event-bus`
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
