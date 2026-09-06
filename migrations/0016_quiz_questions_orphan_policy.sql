-- 0016_quiz_questions_orphan_policy.sql
--
-- Fix the RLS policy on quiz_questions so the question-bank flow (rows with
-- quiz_id IS NULL) actually works.
--
-- Original policies (from the RLS rollout in 0010/0011) required that every
-- quiz_questions row point at a quizzes row owned by the current tenant.
-- That's correct for questions attached to a quiz, but the question-bank
-- writes orphan rows whose organization is recorded in
-- question_data->'_meta'->>'organizationId'. Under the old policy those
-- INSERTs failed with:
--   error: new row violates row-level security policy for table
--   "quiz_questions" (code 42501)
--
-- This migration replaces both policies so they accept either:
--   - quiz_id present and that quiz belongs to the current org, or
--   - quiz_id null and the _meta.organizationId matches the current org.
--
-- The SELECT policy keeps the existing is_global short-circuit for shared
-- quiz questions.

DROP POLICY IF EXISTS quiz_questions_tenant_modify ON public.quiz_questions;
DROP POLICY IF EXISTS quiz_questions_tenant_select ON public.quiz_questions;

CREATE POLICY quiz_questions_tenant_select ON public.quiz_questions
  FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
       WHERE q.id = quiz_questions.quiz_id
         AND (q.organization_id = app_current_org() OR q.is_global = true)
    )
    OR (
      quiz_questions.quiz_id IS NULL
      AND COALESCE(
            quiz_questions.question_data->'_meta'->>'organizationId',
            ''
          ) = app_current_org()::text
    )
  );

CREATE POLICY quiz_questions_tenant_modify ON public.quiz_questions
  FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
       WHERE q.id = quiz_questions.quiz_id
         AND q.organization_id = app_current_org()
    )
    OR (
      quiz_questions.quiz_id IS NULL
      AND COALESCE(
            quiz_questions.question_data->'_meta'->>'organizationId',
            ''
          ) = app_current_org()::text
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
       WHERE q.id = quiz_questions.quiz_id
         AND q.organization_id = app_current_org()
    )
    OR (
      quiz_questions.quiz_id IS NULL
      AND COALESCE(
            quiz_questions.question_data->'_meta'->>'organizationId',
            ''
          ) = app_current_org()::text
    )
  );
