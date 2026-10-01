# ELS-AI (Experiential Learning System)

Shree Ganeshay Namah 🙏

ELS-AI is a next-generation, multi-tenant EdTech platform powered by AI. It focuses on personalized, experiential learning for students across all grades, with a specialized "Interactive Playroom" for KIDS (LKG–5th).

## 🚀 Quick Links
- **[Jev System One Guide](./README_JEV.md)**: Fast structured evaluation, chatbot cascade, diagnostics, and content generation.
- **[Agent Implementation Roadmap](./docs/agents/MASTER_GUIDE.md)**: Step-by-step guide for developers and AI agents.
- **[Architecture & Guidelines](./docs/README-AGENTS.md)**: Style guides, API specs, and quality controls.
- **[System Design](./docs/SystemDesign.md)**: Architectural overview and diagrams.
- **[App Structure Plan](./docs/APP_STRUCTURE_PLAN.md)**: Monorepo and file structure details.

## 🏗️ Core Architecture
- **Monorepo**: `/backend/gateway`, `/backend/core-api` (consolidated auth/org/topics/content/quizzes/classrooms/assignments/achievements/stories/notifications), `/backend/workers` (background jobs), `/backend/media-service`, `/backend/ai-service`, and `/frontend` (React Native app).
- **Database**: PostgreSQL with RBAC and multi-tenancy.
- **AI Layer**: Multi-agent system located in `/agents`.
- **Media**: AWS S3 for all dynamic assets.

## 🌟 Key Features
- **Multi-Tenant**: Isolated data per organization.
- **Dynamic Quiz Engine**: Drag-and-drop, Sound-match, and Memory games for kids.
- **AI Generation**: Automated content and quiz creation reviewed by teachers.
- **Interactive UX**: Rich animations (Reanimated) and audio feedback (Expo-AV).

---

## 🛠️ Development Setup
See the **[Master Guide](./docs/agents/MASTER_GUIDE.md)** for detailed implementation instructions.

### Starting the Microservices locally
Start all background services (API Gateway, Core API, Workers, Media, and AI services) with a single command:
```bash
npm run services:start
```

Stop or restart services:
```bash
npm run services:stop
npm run services:restart
```

Check the running status:
```bash
npm run services:status
```

Logs are generated in `logs/*.log` for each running service.


## 🤖 Jev System One Integration in Chatbot & Content Generation

### 1. Two-Tier Architecture (Jev + LLM Verified Cascade)
- **Role Separation**:
  - **System One (Jev)**: Fast (<1s), deterministic, structured classification, confidence scoring, and fact validation. Jev answers structured queries (`choice`, `boolean`/`noul`, `score`) and never generates conversational text directly.
  - **System Two (LLM - GPT/Claude/Gemini)**: Handles natural conversational dialogue, empathetic tutoring, context synthesis, and rich content generation.
- **Provider-Agnostic Gateway**: The backend `JevClient` (`backend/ai-service/src/services/jevClient.ts`) supports OpenJev (`openjev.sh`), OpenRouter (`typesafe/jev-1.13`), Vercel AI Gateway, or local deterministic heuristic fallback if third-party endpoints are unreachable.
- **Client Security Boundary**: The frontend (React Native / Expo) never communicates directly with Jev or LLMs. All calls route securely through `core-api` and `ai-service` to protect API keys and validate organization/tenant authorization.

### 2. How Information is Gathered & Extracted
- **Survey Observation Categorization**: During parent/student survey check-ins, the chatbot sends the user's raw message and conversation state to Jev via `POST /ai/jev/evaluate`.
- **Structured Evaluation Primitives**:
  - `category` (`choice`): Classifies observations into `weakness_academic`, `strength_academic`, `behavior`, or `unclear`.
  - `specific_enough` (`boolean`/`noul`): Validates whether the observation contains enough actionable evidence to record without immediate follow-up.
  - `concern_level` (`score` 0–3): Rates concern severity (`No concern`, `Mild, monitor`, `Moderate, worth flagging`, `Needs teacher attention`).
- **Automated Clarification Loop**: If `specific_enough === false` and no clarification is pending, the chatbot immediately asks an automated clarifying follow-up before moving to the next survey topic.
- **Quality Gating & Teacher Review**:
  - High-confidence, specific entries are saved as `auto_accepted` in `chat_survey_entries`.
  - Ambiguous (`unclear`) or low-specificity entries are marked `pending_review` and dispatched via Ably (`chat.reviews.{orgId}`) to the teacher review queue.
- **Student Diagnostic Synthesis (`students.ts`)**:
  - The backend aggregates quiz history, average accuracy %, missed concepts, and teacher remarks into an evaluation state.
  - Jev evaluates this state in sub-second latency to produce:
    - `masteryTier` (*High Mastery*, *Steady Progress*, *Needs Targeted Support*, *Critical Intervention Required*)
    - `riskScore` (0 to 3 scale)
    - `primaryWeakDomain` (e.g., *Foundational Concepts*, *Problem Solving & Calculation*)
    - `recommendedIntervention` (e.g., *Assign 5-question remedial quiz*, *1-on-1 tutoring check-in*)

### 3. How Content is Generated
- **Targeted Remedial Quizzes**:
  - The chatbot UI (`StudentDiagnosticCard`, `StudentReportCardModal`, `ChatPanel`) consumes Jev's `primaryWeakDomain` and `riskScore`.
  - Quick-action prompts feed this diagnostic directly into the quiz generator: `Draft a 5-question remedial quiz for {student} targeting {primaryWeakDomain}`.
  - Quizzes and worksheets are tailored to the student's exact learning gap rather than generic grade-level material.
- **Action Plans & Comprehensive Report Cards**:
  - Jev pedagogical interventions and risk scores populate student report cards and action plans.
  - The LLM synthesizes structured Jev diagnostic facts with historical metrics to produce teacher-ready narratives, progress summaries, and study recommendations.

---

## 🗄️ Database Migrations
- **How Migrations Work**: Ordered SQL files in `/migrations` tracked via `schema_migrations`.
- **DDL Permissions**: App roles (`els_app`, `els_admin`) cannot run DDL under RLS policy. Migrations must be run as the database owner/superuser.
- **Commands**:
  - Apply migrations: `DB_USER=postgres DB_PASSWORD=<pw> npm run migrate`
  - Check migration status: `npm run migrate:status`
  - Service runner integration: `MIGRATE_DB_USER=postgres MIGRATE_DB_PASSWORD=<pw> ./backend/manage-services.sh start`

