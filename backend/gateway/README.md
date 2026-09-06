# Gateway (`gateway`)

The single ingress point of the ELS-AI backend. All external traffic must come through it.

## What this service does
- **JWT verification:** validates the `Authorization: Bearer <token>` header once at the edge.
- **Identity propagation:** decodes the JWT and writes signed `x-internal-*` headers (user id, org id, email, role, isSuperAdmin, canPublishGlobal) before forwarding — downstream services trust these via `@els-ai/internal-auth` instead of re-verifying the JWT.
- **Tenant isolation guard:** the shared internal secret is required on every header set so a downstream service cannot be tricked by raw client headers.
- **Routing:** forwards each top-level prefix to the matching microservice.
- **Static media:** serves `/media/*` from the local `assets/` folder for dev environments.

## Route map
All previously separate per-domain services (auth, org, classroom, achievement, question-bank, content, topic, assignment, quiz, counseling, feedback, notifications, stories) are now consolidated into a single `core-api` deployable unit. Only `ai-service` and `media-service` remain independent.

| Prefix | Forwarded to | Port |
|---|---|---|
| `/auth`, `/users`, `/organizations`, `/billing`, `/classrooms`, `/achievements`, `/questions`, `/question-bank`, `/content`, `/video-sections`, `/bookmarks`, `/topics`, `/catalog/subjects`, `/students/subjects`, `/assignments`, `/students`, `/counseling`, `/feedback`, `/quizzes`, `/notifications`, `/stories`, `/ai-conversations` | `core-api` | 4020 |
| `/ai` | `ai-service` (`education-ai-api`) | 4003 |
| `/assets` | `media-service` (`media-api`) | 4004 |
| `/media` | served locally by the gateway from `assets/` (not proxied) | — |

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
| `CORE_API_URL` | `http://localhost:4020` | Target for all core-api routes. Falls back to `AUTH_SERVICE_URL` if set (legacy alias — leave unset to avoid confusion), then the hardcoded default. |
| `EDUCATION_AI_API_URL` | `http://localhost:4003` | Target for `/ai`. Falls back to `AI_SERVICE_URL`. |
| `MEDIA_API_URL` | `http://localhost:4004` | Target for `/assets`. Falls back to `MEDIA_SERVICE_URL`. |
| `INTERNAL_SECRET` | `els-internal-secret-change-me` | Shared secret with downstream services — must match the value (or default) used by `core-api`. |

## Dev
```bash
npm --workspace backend/gateway run dev
npm --workspace backend/gateway run typecheck
```

## Shared deps
- `@els-ai/internal-auth` — JWT verification + header propagation helpers.
