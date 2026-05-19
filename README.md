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
