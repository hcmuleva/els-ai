# ELS-AI (Experiential Learning System)

Shree Ganeshay Namah 🙏

ELS-AI is a next-generation, multi-tenant EdTech platform powered by AI. It focuses on personalized, experiential learning for students across all grades, with a specialized "Interactive Playroom" for KIDS (LKG–5th).

## 🚀 Quick Links
- **[Agent Implementation Roadmap](./docs/agents/MASTER_GUIDE.md)**: Step-by-step guide for developers and AI agents.
- **[Architecture & Guidelines](./docs/README-AGENTS.md)**: Style guides, API specs, and quality controls.
- **[System Design](./docs/SystemDesign.md)**: Architectural overview and diagrams.
- **[App Structure Plan](./docs/APP_STRUCTURE_PLAN.md)**: Monorepo and file structure details.

## 🏗️ Core Architecture
- **Monorepo**: `/backend/gateway`, `/backend/auth-service`, `/backend/quiz-service`, `/backend/ai-service` (Services) and `/frontend` (React Native app).
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
Start all background microservices (API Gateway, Auth, Quiz, and AI services) with a single command:
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


  Done. Here's what I found and added.

   Key finding

   Your DB tables are owned by the postgres superuser. The app roles els_app (services) and els_admin (a few services) are not owners and cannot run DDL (ERROR: must be owner of table). This is a deliberate RLS decision (see 
   docs/RLS_ROLLOUT.md), so on-boot per-service schema creation isn't possible — schema must be applied by the file-based runner as postgres.

   I also discovered migrations 0022-0026 existed physically but were never recorded in the schema_migrations tracker (they'd been applied by hand). I synced them.

   What I did

   1. `migrations/README.md` (new) - how migrations work (ordered files, schema_migrations tracker, checksums, idempotent DDL), which role can run them (superuser/owner, not els_app/els_admin), the exact commands, how to write a new 
      migration (naming, IF NOT EXISTS, RLS pattern for new tenant tables), and a reference table for 0022-0026.

   2. `scripts/migrate.cjs` - added a read-only --status mode so npm run migrate:status reports applied/pending/drifted without applying anything (previously it would have applied).

   3. `backend/manage-services.sh` - added an opt-in, non-breaking auto-migrate step on start/restart. It runs only when you provide superuser creds and never blocks startup otherwise:

        MIGRATE_DB_USER=postgres MIGRATE_DB_PASSWORD=<pw> ./backend/manage-services.sh start

      Without those vars it prints a hint and continues.

   4. Synced the tracker - ran DB_USER=postgres DB_PASSWORD=postgres npm run migrate; 0022-0026 are now recorded and npm run migrate:status reports "DB is up to date." (the DDL is IF NOT EXISTS/DROP IF EXISTS, so re-running didn't change 
      existing schema).

   How you do a migration going forward
   •  Create migrations/NNNN_description.sql with idempotent DDL.
   •  Apply: DB_USER=postgres DB_PASSWORD=<pw> npm run migrate
   •  Check: npm run migrate:status
