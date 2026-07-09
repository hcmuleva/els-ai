-- Migration 0025 — Publish all existing video sections.
--
-- Publishing is now automatic (the Publish button and draft/ready workflow were
-- removed). Legacy sections created under the old flow may still be 'draft' or
-- 'ready', which caused the student views to hide them. Bring them all to
-- 'published'. Safe to re-apply.

BEGIN;

UPDATE video_sections
   SET status = 'published', updated_at = NOW()
 WHERE status <> 'published';

COMMIT;
