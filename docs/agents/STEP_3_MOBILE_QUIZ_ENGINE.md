# Step 3: Mobile Role-Based Experience & Quiz Renderer

## 1) Core Principle
Frontend must be role-driven and API-driven.
- Role-driven: layout/navigation/actions depend on `active_role`.
- API-driven: quiz UI is rendered from `question_type` + `question_data`.

## 2) Profile Switching (Mandatory)
- One user can have multiple roles.
- Profile switch updates `active_role` in client state and backend.
- UI changes immediately without restart.

Expected behavior after role change:
1. Fetch role-specific permissions.
2. Rebuild bottom tabs.
3. Reload role-scoped dashboard data.

## 3) Role-Wise Screen Segregation

### Student
- Home (assigned content)
- Practice/Quiz
- Reports
- Recommendations

### Teacher
- Home
- Planner
- Exam/Question setup
- Assessment dashboard
- Content review (AI vs manual)
- Reports

### Parent
- Home
- Child reports (academic + behavioral)
- Recommendations

### Admin
- Home
- User/role management
- Class/subject/course setup
- Mapping and governance reports

## 4) Navigation Matrix (Bottom Tabs)
- Student: `Home | Practice | Reports | Recommendations`
- Teacher: `Home | Planner | Assessment | Content | Reports`
- Parent: `Home | Reports | Recommendations`
- Admin: `Home | Users | Setup | Reports | Admin`

No cross-role tab leakage is allowed.

## 5) Dynamic Quiz Renderer
Renderer switches by `question_type`:
- `drag_drop`
- `image_select`
- extensible for future types

`question_data` must be schema-validated before rendering.

## 6) State & Storage
- Tokens stored via secure storage utility.
- `active_role` and selected learner context must persist.
- API base URL from environment (`EXPO_PUBLIC_API_BASE_URL`), no hardcoded URLs.

## 7) Completion Checklist
- [ ] Role switch updates tabs, permissions, and data scope in one flow
- [ ] Role-specific screen guards are enforced
- [ ] QuizRenderer supports current question types safely
- [ ] Audio/interaction feedback implemented for student UX
- [ ] Active role update API integrated (`PATCH /users/:id/active-role`)
- [ ] No hardcoded API URL in mobile modules
