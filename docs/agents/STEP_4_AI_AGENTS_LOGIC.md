# Step 4: AI Agents & Automated Generation

## 1) Required Agent Set
1. **Context Agent**: builds learner + class context from progress data.
2. **Content Generator Agent**: creates age/level-appropriate teaching material.
3. **Question Generator Agent**: converts content into quiz-compatible `question_data`.
4. **Assessment Agent**: evaluates attempt quality and concept mastery.
5. **Recommendation Agent**: proposes next learning path.
6. **Report Generator Agent**: prepares role-specific summaries (student/parent/teacher/admin).

## 2) Generation Workflow
1. Input: `topic`, `class_level`, `quiz_type`, `difficulty_level`, role context.
2. Context Agent enriches prompt with student/class signals.
3. Content + Question agents produce structured output.
4. Validation layer checks schema and safety rules.
5. Teacher review/edit screen allows approval or rejection.
6. Publish marks output as available for student consumption.

## 3) Output Contract
AI output must be valid JSON and include:
- `quiz_metadata`
- `questions[]`
- role-safe language and age-safe content
- explanation/reasoning payload where required

Rejected generation must return actionable validation errors.

## 4) Safety and Quality Rules
- No harmful, biased, or age-inappropriate content.
- Encourage reasoning and conceptual understanding.
- All generated media references must resolve to allowed asset sources.
- Add guardrails for unsupported question types.

## 5) Human-in-the-Loop
- Teacher can edit prompt/result before publish.
- Admin can define organization policy constraints.
- Every publish action is auditable.

## 6) Completion Checklist
- [ ] Prompt packs created for all 6 agents
- [ ] JSON schema validation implemented before persistence
- [ ] Teacher review workflow implemented end-to-end
- [ ] Recommendation + report generation wired to role dashboards
- [ ] Safety checks and fallback messaging implemented
