-- 0017_achievements_is_global_policy.sql
--
-- Fix two related production-readiness bugs on `achievements`:
--
-- 1. The SELECT policy on `achievements` predates the `is_global` column.
--    It only returned rows where `organization_id = app_current_org()`,
--    so any row with `is_global = true` AND a NULL or different
--    organization_id was invisible to every tenant. Eight system
--    achievements (Best Performer, Star Student, etc.) seeded with
--    NULL organization_id and is_global = true could not be read.
--
-- 2. The seed left two copies of each system achievement: one with
--    organization_id = NULL and one re-anchored to the default org by
--    the org-service backfill. The duplicates triggered the
--    `idx_achievements_unique_identity` constraint and printed a
--    `[org-service migrate] could not backfill achievements: duplicate
--    key value` warning on every restart.
--
-- This migration:
--   a. Replaces the SELECT policy so it accepts `is_global = true`.
--   b. Removes the orphan NULL-org rows whose same-name org-owned twin
--      already exists. The kept row is the org-owned global copy.
--   c. The org-service warning will stop because the orphan rows it
--      tried to backfill are gone.

-- (a) Allow tenants to read globally-published achievements.
DROP POLICY IF EXISTS achievements_tenant_select ON public.achievements;
CREATE POLICY achievements_tenant_select ON public.achievements
  FOR SELECT
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
    OR is_global = true
  );

-- (b) Drop NULL-org global rows that are duplicates of an org-owned twin.
DELETE FROM public.achievements a
 WHERE a.organization_id IS NULL
   AND a.is_global = true
   AND EXISTS (
     SELECT 1 FROM public.achievements b
      WHERE b.id <> a.id
        AND b.is_global = true
        AND b.organization_id IS NOT NULL
        AND lower(b.name) = lower(a.name)
   );
