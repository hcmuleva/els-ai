# ELS-AI App Structure Plan (Current + Permanent Direction)

## 1) Objective
Define a stable folder layout and module ownership so implementation remains consistent and non-temporary.

## 2) Canonical Monorepo Layout
```txt
els-ai/
├── backend/
│   ├── gateway/
│   ├── auth-service/
│   ├── quiz-service/
│   └── ai-service/
├── frontend/
│   ├── app/
│   └── src/
├── agents/
├── scripts/
├── docs/
└── assets/            # static media served at /media (audio, images, icons, flags)
```

## 3) Module Ownership

### 3.1 Backend
- `gateway`: ingress routing, CORS, service proxying, static media serving
- `auth-service`: users, roles, login/register/refresh, active-role updates
- `quiz-service`: quiz templates, questions, attempts, scoring primitives
- `ai-service`: generation pipelines and recommendation payloads

### 3.2 Frontend
- `src/context`: auth/session/role context
- `src/config`: role tab map and API config
- `src/modules`: role-specific feature modules
- `src/components`: shared UI building blocks

## 4) Role-Driven UI Structure
- Screen tree must be segmented by `active_role`.
- Role switching must recompose navigation without app restart.
- Navigation visibility is role-guarded, not just hidden visually.

## 5) Environment-Driven Layout (No Hardcoding)

Environment files:
- `.env.local`
- `.env.dev`
- `.env.test`
- `.env.uat`
- `.env.production`

Required groups:
- DB config (`DB_*`)
- Service URLs (`AUTH_SERVICE_URL`, `QUIZ_SERVICE_URL`, `AI_SERVICE_URL`, `EXPO_PUBLIC_API_BASE_URL`)
- Ports (`PORT`)
- Security (`JWT_*`)
- Storage (`AWS_*`, `S3_*`)

## 6) Service Port Baseline
- gateway: `4000`
- auth-service: `4101`
- quiz-service: `4002`
- ai-service: `4003`

> Ports are env-overridable; defaults are used only when env is absent.

## 7) Permanent Stability Rules
- Every service validates env on startup.
- `scripts/manage-services.js` is the single entrypoint for local orchestration.
- Port conflicts are resolved before service launch.
- Any new service must include: health route, env validation, and gateway mapping.

## 8) Delivery Checklist
- [ ] Role-based navigation matrix implemented
- [ ] Active-role persistence implemented
- [ ] Service URLs sourced from env only
- [ ] Gateway mappings aligned with service ownership
- [ ] Startup and typecheck pass from repo root
