# Gateway (`gateway`)

The single ingress point of the ELS-AI backend. All external traffic must come through it.

## What this service does
- **JWT verification:** validates the `Authorization: Bearer <token>` header once at the edge.
- **Identity propagation:** decodes the JWT and writes signed `x-internal-*` headers (user id, org id, email, role, isSuperAdmin, canPublishGlobal) before forwarding — downstream services trust these via `@els-ai/internal-auth` instead of re-verifying the JWT.
- **Tenant isolation guard:** the shared internal secret is required on every header set so a downstream service cannot be tricked by raw client headers.
- **Routing:** forwards each top-level prefix to the matching microservice.
- **Static media:** serves `/media/*` from the local `assets/` folder for dev environments.

## Route map
| Prefix | Forwarded to | Port |
|---|---|---|
| `/auth`, `/users`, `/billing`, `/students` | `auth-service` | 4101 |
| `/organizations` | `org-service` | 4012 |
| `/classrooms` | `classroom-service` | 4006 |
| `/achievements` | `achievement-service` | 4007 |
| `/questions`, `/question-bank` | `question-bank-service` | 4008 |
| `/content` | `content-service` | 4009 |
| `/topics`, `/catalog/subjects`, `/students/subjects` | `topic-service` | 4010 |
| `/assignments` | `assignment-service` | 4011 |
| `/quizzes` | `quiz-service` | 4002 |
| `/ai` | `ai-service` | 4003 |
| `/assets` | `media-service` | 4004 |

## Public paths (no JWT required)
- `/auth/login`
- `/auth/register`
- `/auth/refresh`
- `/health`
- `/media/*`
- `/assets/public/*`

## Environment
| Var | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `NODE_ENV` | `development` | |
| `AUTH_SERVICE_URL` | `http://localhost:4101` | |
| `QUIZ_SERVICE_URL` | `http://localhost:4002` | |
| `CLASSROOM_SERVICE_URL` | `http://localhost:4006` | |
| `ACHIEVEMENT_SERVICE_URL` | `http://localhost:4007` | |
| `QUESTION_BANK_SERVICE_URL` | `http://localhost:4008` | |
| `CONTENT_SERVICE_URL` | `http://localhost:4009` | |
| `TOPIC_SERVICE_URL` | `http://localhost:4010` | |
| `ASSIGNMENT_SERVICE_URL` | `http://localhost:4011` | |
| `AI_SERVICE_URL` | `http://localhost:4003` | |
| `MEDIA_SERVICE_URL` | `http://localhost:4004` | |
| `ORG_SERVICE_URL` | `http://localhost:4012` | |
| `INTERNAL_SECRET` | `els-internal-secret-change-me` | Shared secret with downstream services |

## Dev
```bash
npm --workspace backend/gateway run dev
npm --workspace backend/gateway run typecheck
```

## Shared deps
- `@els-ai/internal-auth` — JWT verification + header propagation helpers.
