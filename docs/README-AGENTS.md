# ELS-AI Agent Implementation Guide

## 1) Non-Negotiable Standards
- Use `snake_case` for database columns and API payload keys.
- Use UUIDs for all primary IDs.
- Enforce role + organization-aware authorization on protected routes.
- Do not hardcode ports, credentials, URLs, or secrets in feature code.

## 2) Canonical Service Map (Current)

| Service | Default Port | Responsibility |
|---|---:|---|
| gateway | 4000 | Public API entrypoint, route proxy, media serving |
| auth-service | 4101 | Auth, users, roles, token rotation |
| quiz-service | 4002 | Quiz templates, questions, attempts, scoring |
| ai-service | 4003 | AI content/question generation and recommendations |

Gateway route mapping:
- `/auth/*` -> auth-service
- `/users/*` -> auth-service
- `/quizzes/*` -> quiz-service
- `/ai/*` -> ai-service

## 3) Core API Contracts
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /users/:id`
- `PATCH /users/:id/active-role`
- `GET /quizzes`
- `GET /quizzes/:id`
- `POST /quizzes`
- `POST /quizzes/:id/questions`
- `POST /quizzes/attempts`
- `POST /ai/generate`

## 4) Role System Rules
- A user may have multiple roles.
- `active_role` is persisted and drives:
  - role-specific tabs/views
  - API permission guards
  - role-scoped data loading

Supported roles:
- student
- teacher
- parent
- admin
- superadmin

## 5) Environment & Startup Rules
- Read all configuration from env files.
- Validate required env values on service startup.
- Fail fast for missing config.
- Keep environment-specific files for local/dev/test/uat/prod.

## 6) Quality Gate
Before finalizing code changes:
1. Run `npm run typecheck`.
2. Run workspace lint/tests when available for touched areas.
3. Ensure no route/port regressions in gateway-service integration.
