# ELS-AI System Design (Canonical)

## 1) Scope and Goal
This document is the system-level source of truth for ELS-AI architecture, role behavior, and environment-driven configuration.

Current implementation scope:
- API gateway + auth + quiz + AI services
- Role-based frontend/mobile experience
- PostgreSQL-backed user/auth + quiz model
- AI-generated quiz/content flow with teacher review

## 2) Repository Layout (Current)
```txt
els-ai/
├── backend/
│   ├── gateway/
│   ├── auth-service/
│   ├── quiz-service/
│   └── ai-service/
├── frontend/                  # mobile/web React Native app surface
├── agents/
├── assets/                    # static media served at /media (audio, images, icons, flags)
├── scripts/
└── docs/
```

## 3) Runtime Architecture

### 3.1 Service Topology
- `gateway` (public API): `PORT=4000`
- `auth-service`: `PORT=4101`
- `quiz-service`: `PORT=4002`
- `ai-service`: `PORT=4003`

### 3.2 Gateway Routing
- `/auth/*` -> auth-service
- `/users/*` -> auth-service
- `/quizzes/*` -> quiz-service
- `/ai/*` -> ai-service
- `/media/*` -> static media from `assets/`

### 3.3 Request Flow
1. Client calls gateway endpoint.
2. Gateway forwards request to target service by route prefix.
3. Target service validates auth + RBAC + payload.
4. Service returns normalized API response to client.

## 4) Multi-Tenancy and RBAC

### 4.1 Tenant Model
- Organization is the tenant boundary.
- Data must be filtered by `organization_id` for all role-bound operations.

### 4.2 Roles
- Student
- Teacher
- Parent
- Admin
- SuperAdmin (cross-organization governance)

### 4.3 Access Model
- A user can hold multiple roles.
- Active role is persisted as `active_role` and used for:
  - Route permission checks
  - Role-specific UI tabs/screens
  - Role-scoped data queries

## 5) Role-Wise Functional Responsibilities

| Role | Primary Goal | Core Actions |
|---|---|---|
| Student | Learn and practice | Consume content, attempt quizzes, view own progress/recommendations |
| Teacher | Plan and evaluate learning | Build lesson/exam plans, manage question banks, assess student performance, review AI output |
| Parent | Monitor child growth | View child academic/behavior insights and support recommendations |
| Admin | Run org operations | Manage users/roles/classes/subjects, mappings, content governance, org-level reporting |
| SuperAdmin | Multi-tenant governance | Create organizations, policy templates, global configuration and oversight |

## 6) Mobile/Profile Segregation (Mandatory)

### 6.1 Profile Switch
- One user can have multiple profiles.
- Switching profile must instantly update:
  - Visible tabs
  - Visible modules
  - Allowed actions
  - Data scope

### 6.2 Bottom Navigation by Active Role
- Student: `Home | Practice | Reports | Recommendations`
- Teacher: `Home | Planner | Assessment | Content | Reports`
- Parent: `Home | Child Reports | Recommendations`
- Admin: `Home | Users | Setup | Reports | Admin`

No role should see irrelevant tabs.

## 7) Data Design (Learning Hierarchy)
```txt
Course
  └─ Subject
      └─ Unit (for higher grades where applicable)
          └─ Topic
              ├─ Content
              ├─ Questions
              └─ Exams/Assessments
```

Additional rules:
- All DB columns use `snake_case`.
- IDs are UUIDs.
- Assessment records capture `correct`, `wrong`, `not_attempted`, topic mastery, and trend metadata.

## 8) AI Agent Layer
Required agents:
1. Context Agent
2. Content Generator Agent
3. Question Generator Agent
4. Assessment Agent
5. Recommendation Agent
6. Report Generator Agent

Teacher approval is mandatory before publishing AI-generated quizzes/content.

## 9) Environment-First Configuration (No Hardcoding)

### 9.1 Environments
- `.env.local`
- `.env.dev`
- `.env.test`
- `.env.uat`
- `.env.production`

### 9.2 Required Config Domains
- Database (`DB_*`)
- JWT/Auth (`JWT_*`)
- Service URLs (`*_SERVICE_URL`, `API_BASE_URL`)
- Ports (`PORT`)
- Storage (`AWS_*`, `S3_*`)
- Feature flags (`FEATURE_*`)

### 9.3 Startup Validation
- Every service validates required env variables at boot.
- Missing/invalid env must fail fast with a clear error.
- Partial startup is not allowed.

## 10) Operational Standards
- Services are managed via `scripts/manage-services.js`.
- On startup, service ports are reclaimed as needed before process launch.
- Health endpoints are mandatory for every service.
- Root-level validation gate: `npm run typecheck`.

## 11) Acceptance Criteria
- Role switch updates layout + permissions without restart.
- Gateway routes resolve correctly for all service prefixes.
- No hardcoded API URLs/ports/credentials in feature code.
- AI-generated content can be reviewed/edited/published by teacher/admin workflow.

