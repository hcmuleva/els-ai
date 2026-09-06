# ELS-AI Implementation Roadmap for Agents

Follow this sequence for a complete, permanent implementation.

## Step 0: Canonical Alignment (Must finish first)
References:
- `docs/SystemDesign.md`
- `docs/README-AGENTS.md`
- `docs/APP_STRUCTURE_PLAN.md`
- `docs/user-layout-view.md`

Goal:
- Align ports, folder structure, role model, and environment rules before feature work.

## Step 1: Database & Authentication
See: [STEP_1_DATABASE_AND_AUTH.md](./STEP_1_DATABASE_AND_AUTH.md)

Goal:
- Multi-role identity, token rotation, active-role persistence, tenant-ready auth.

## Step 2: Backend Services & API Ownership
See: [STEP_2_BACKEND_SERVICES.md](./STEP_2_BACKEND_SERVICES.md)

Goal:
- Stable gateway + service boundaries with environment-driven startup and route ownership.

## Step 3: Mobile Role-Based Experience
See: [STEP_3_MOBILE_QUIZ_ENGINE.md](./STEP_3_MOBILE_QUIZ_ENGINE.md)

Goal:
- Strict role segregation with dynamic tabs/screens per active profile.

## Step 4: AI Agent Orchestration
See: [STEP_4_AI_AGENTS_LOGIC.md](./STEP_4_AI_AGENTS_LOGIC.md)

Goal:
- Context-aware generation + teacher review + publish flow + reporting agents.

## Step 5: Operations, Reliability, and Release
Goal:
- Environment safety, startup validation, observability, and release gates.

Minimum deliverables:
- Service health endpoints for all services
- Automated startup with deterministic ports and conflict handling
- Typecheck/test gates in CI
- No hardcoded URLs/secrets/credentials

## Global Standards
- Use `snake_case` for DB/API payload keys.
- Use UUID for primary IDs.
- Do not bypass gateway contracts.
- Role access checks must be server-enforced.
- Validate environment configuration on startup.

Companion checklist:
- [IMPLEMENTATION_COMPLETION_CHECKLIST.md](./IMPLEMENTATION_COMPLETION_CHECKLIST.md)
