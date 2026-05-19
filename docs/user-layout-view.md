# ELS-AI Role Layout and Functionality Specification

## 1) Profile Switching Contract
- A user may have multiple roles.
- Active role selector is shown in the top bar.
- On role switch:
  - update `active_role` in backend
  - refresh permissions
  - recompose role navigation
  - reload role-scoped data
- No app restart is allowed for role change.

## 2) Role Responsibilities

### Student
Purpose: learning execution
- consume assigned content
- attempt quizzes/self-assessments
- view score and topic trends
- receive recommendations

### Teacher
Purpose: planning and evaluation
- manage lesson plans
- create exams/question sets
- review AI-generated content
- evaluate student/class performance

### Parent
Purpose: monitoring and support
- view child progress reports
- view behavioral/engagement indicators
- follow support recommendations

### Admin
Purpose: organizational control
- user and role management
- class/subject/course setup
- assignment mapping
- reporting and governance views

## 3) Navigation Matrix

| Role | Bottom Tabs |
|---|---|
| Student | Home, Practice, Reports, Recommendations |
| Teacher | Home, Planner, Assessment, Content, Reports |
| Parent | Home, Reports, Recommendations |
| Admin | Home, Users, Setup, Reports, Admin |

Rule: no role can access tabs outside its permission scope.

## 4) Screen-Level Guarding
- Route access must be permission checked (not only hidden in UI).
- Unauthorized route access returns role error and redirect.
- API calls include role context from active session.

## 5) Environment and Config Contract
- All URLs/ports/keys loaded from env.
- Supported envs: local/dev/test/uat/prod.
- Missing required env must block startup.

## 6) Implementation Checklist
- [ ] Role selector integrated in top bar
- [ ] `PATCH /users/:id/active-role` wired and persisted
- [ ] Dynamic tab config by role implemented
- [ ] Screen guards enforced per role
- [ ] Role-based dashboard APIs connected
- [ ] No hardcoded endpoints in frontend modules

## 7) Acceptance Criteria
- Switching role updates layout and allowed actions instantly.
- Gateway and backend enforce role restrictions.
- Parent never sees teacher/admin pages.
- Student never sees admin controls.
- Admin has setup and governance workflows available.