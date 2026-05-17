Shree Ganeshay Namah 🙏

You are a senior EdTech architect, AI system designer, and full‑stack engineering expert.

Your task is to design and generate a complete ELS‑AI (Experiential Learning System) platform
supporting multi‑tenant organizations, AI‑driven content, assessment, analytics, and reporting.

This system must be scalable, modular, and production‑ready.

────────────────────────────────
1. SYSTEM OVERVIEW
────────────────────────────────

Build a multi‑tenant ELS platform supporting:

• Student categories:
  - KIDS (LKG–5)
  - HIGHSCHOOL (6–10)
  - HIGHER (11–12)

• User roles:
  - Student
  - Teacher
  - Parent
  - Admin
  - SuperAdmin

• Technology:
  - Backend: Node.js
  - Database: PostgreSQL
  - Mobile App: React Native
  - Storage: AWS S3 (configured via .env)
  - Monorepo structure (backend + mobile)

────────────────────────────────
2. MULTI‑TENANCY MODEL
────────────────────────────────

• Each organization (Org) is isolated
• SuperAdmin manages ORGs
• Admin operates within a given Org
• All data must be scoped per Org

────────────────────────────────
3. MONOREPO STRUCTURE
────────────────────────────────

📁 /els-ai/
   ├── backend/
   │    ├── auth-service
   │    ├── user-service
   │    ├── content-service
   │    ├── assessment-service
   │    ├── reporting-service
   │    ├── analytics-service
   │    └── storage-service (S3 integration)
   │
   ├── mobile/
   │    ├── screens/
   │    ├── components/
   │    ├── modules/
   │    │     ├── home/
   │    │     ├── reports/
   │    │     ├── admin/
   │    │     └── profile/
   │
   └── agents/
         ├── content/
         ├── assessment/
         ├── analytics/

────────────────────────────────
4. MOBILE APP UX STRUCTURE
────────────────────────────────

TOP BAR:
• Left → logo.png
• Right →
   - Profile avatar
   - Profile settings dropdown
   - Logout

• Profile switch dropdown (before avatar)
   - Allows switching roles:
     (Student / Teacher / Parent / Admin)

BOTTOM NAV:
• Home
• Reports
• Admin (only for Admin/SuperAdmin)

────────────────────────────────
5. PROFILE SYSTEM (CRITICAL)
────────────────────────────────

• One user can have multiple profiles
• Profile switch dynamically changes UI & permissions

Example:
User = Raj
Profiles = [Teacher, Parent, Student]

UI + functionality MUST adapt instantly on profile switch

────────────────────────────────
6. ADMIN CAPABILITIES
────────────────────────────────

Admin can:

• Manage Users (multi‑profile)
• Assign roles
• Create & map:
  - Classes (LKG–12)
  - Subjects
  - Courses
• Assign:
  - Students ↔ Classes
  - Teachers ↔ Subjects

• Temple-Based Configuration:
  - Central configuration template
  - Apply → creates full system structure

────────────────────────────────
7. SUPERADMIN CAPABILITIES
────────────────────────────────

• Create and manage organizations
• Bulk import:
  - Students
  - Teachers
  - Subjects
  - Classes
• Assign roles & org mapping

────────────────────────────────
8. TEACHER FEATURE SET
────────────────────────────────

A) Planning:
• Classroom planner:
  - Subject
  - Topic
  - Date & time
  - Lesson plan

B) Exam & Question Setup:
• Question difficulty levels:
  - Easy / Medium / Hard
• Types:
  - Mock, Practice, Weekly, CT, Monthly

C) Assessment:
• Academic:
  - Student → subject → topic → marks
• Behavioral:
  - Engagement, participation
• Extra Curricular:
  - Activities tracking

D) Content Evaluation:
• AI vs Manual mode toggle
• Teacher can:
  - Edit AI-generated content
  - Approve/reject

E) Content Management:
Provide:
• Subject
• Class
• Title
• Description
• Level
• Content type:
   - Audio, Video, Text, Image

AI must:
• Generate content prompts accordingly

F) Question Management:
• Create/edit question banks
• Assign to exams

────────────────────────────────
9. STUDENT EXPERIENCE
────────────────────────────────

• Personalized learning dashboard
• Content per class + level
• Categories:
  - Stories
  - Creativity
  - Puzzles
  - Jr Scientist
  - Mind Modulation

• Assessment tracking:
  - Correct / Wrong / Not attempted
  - Topic-level breakdown

• Score Trends:
  - Subject-wise
  - Course-wise

────────────────────────────────
10. PARENT EXPERIENCE
────────────────────────────────

• View child reports
• Understand:
  - Strength
  - Weakness
  - Behavior
• Recommendations:
  - Actions to support child

────────────────────────────────
11. ASSESSMENT SYSTEM
────────────────────────────────

Two types:
1) Self Assessment
2) Actual Participation

Track:
• Skill level
• Concept clarity
• Behavioral traits

────────────────────────────────
12. REPORTS & ANALYTICS
────────────────────────────────

Reports for:
• Teacher
• Student
• Parent
• Principal

Frequency:
• Daily
• Monthly
• Half-yearly

Include:
• Detailed insights
• Graph trends
• Recommendations

Teacher Analytics:
• Class performance
• Topic mastery

Student Analytics:
• Accuracy trends
• Learning progress

────────────────────────────────
13. AI AGENT SYSTEM (CORE)
────────────────────────────────

Create Multi-Agent System:

Agents must include:

1. Context Agent
• Reads Student + Teacher journey

2. Content Generator Agent
• Creates learning content

3. Question Generator Agent
• Creates MCQ, match, logic questions

4. Assessment Agent
• Evaluates student

5. Recommendation Agent
• Generates path forward

6. Report Generator Agent
• Generates stakeholder reports

────────────────────────────────
14. AI GENERATION RULES
────────────────────────────────

• Age-aware content generation
• Encourage thinking, not memorization
• Every output must include:
  - Explanation
  - Reasoning
• Avoid harmful or biased suggestions

────────────────────────────────
15. S3 STORAGE
────────────────────────────────

All media:
• Images
• Videos
• Documents

Stored in:
• S3 bucket (from .env)

────────────────────────────────
16. SECURITY & RBAC
────────────────────────────────

• Role-based access control
• Org-level data isolation
• Profile-level permission enforcement

────────────────────────────────
17. OUTPUT EXPECTATION
────────────────────────────────

System must produce:

✅ Mobile (React Native)
✅ Backend APIs (Node.js)
✅ Multi-agent AI layer
✅ Reports (PDF/JSON)
✅ Analytics dashboards

────────────────────────────────
FINAL GOAL
────────────────────────────────

Build a platform that acts as:

“A complete AI-powered experiential learning ecosystem
connecting students, teachers, and parents,
enabling personalized growth, continuous assessment,
and outcome-driven learning.”

The system must feel:
• Intelligent
• Human-like
• Trustworthy
• Scalable