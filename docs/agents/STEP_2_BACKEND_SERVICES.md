# Step 2: Backend Services & API Architecture

## 1) Current Service Topology

| Service | Default Port | Responsibility |
|---|---:|---|
| gateway | 4000 | Public ingress, CORS, proxy routing, media serving |
| auth-service | 4101 | Registration, login, refresh, users, roles |
| quiz-service | 4002 | Quiz templates, questions, attempts |
| ai-service | 4003 | AI generation and recommendation payloads |

## 2) Gateway Contract
Gateway owns route-level service mapping:
- `/auth/*` -> auth-service
- `/users/*` -> auth-service
- `/quizzes/*` -> quiz-service
- `/ai/*` -> ai-service

All clients must call gateway endpoints, not service-internal URLs.

## 3) Data Model (Quiz Domain)
Use relational + JSONB for flexible question rendering.

### 3.1 Core Tables
- `quizzes`
- `quiz_questions`
- `student_attempts`
- `question_attempts`
- `assets`

### 3.2 Quiz Question Payload
`question_data` is type-driven JSON (e.g., `drag_drop`, `image_select`).

Required metadata:
- `question_type`
- `question_instruction`
- `question_data`
- `sort_order`
- `points`

## 4) API Ownership by Service

### auth-service
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /users/:id`
- `PATCH /users/:id/active-role`

### quiz-service
- `GET /quizzes`
- `GET /quizzes/:id`
- `POST /quizzes`
- `POST /quizzes/:id/questions`
- `POST /quizzes/attempts`

### ai-service
- `POST /ai/generate`
- `POST /ai/recommend`

## 5) Environment Rules (Mandatory)
- No hardcoded service URLs/ports/credentials.
- Every service loads env via dotenv/config layer.
- Every service validates required env keys at startup.
- Missing config must fail startup immediately.

## 6) Reliability Requirements
- Health endpoint per service (`/health`).
- Startup orchestration through `scripts/manage-services.js`.
- Port conflicts resolved before launch.
- Logs written under `logs/`.

## 7) Completion Checklist
- [ ] Gateway routes verified against all service prefixes
- [ ] Service env validation implemented and tested
- [ ] Auth + quiz + AI endpoints reachable via gateway
- [ ] Attempt tracking tables and APIs implemented
- [ ] Role/org access checks enforced server-side
- [ ] Root typecheck passes
