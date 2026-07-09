-- Migration 0023 — Scope video sections to a specific content section.
--
-- Previously video_sections were linked only to a learning_contents row
-- (content_id). A content item can hold several content sections
-- (learning_content_sections), each potentially its own video. This migration
-- adds content_section_order so a set of video learning sections belongs to one
-- content section (identified by its 1-based section_order), matching the
-- existing `${contentId}:${sectionOrder}` convention used elsewhere.
--
-- No media is cut; playback is still bounded by start_time/end_time.
-- Safe to re-apply (IF NOT EXISTS / DROP IF EXISTS).

BEGIN;

-- 1-based position of the content section this video-section belongs to.
-- Existing rows default to 1 (the first content section).
ALTER TABLE video_sections
  ADD COLUMN IF NOT EXISTS content_section_order INTEGER NOT NULL DEFAULT 1;

-- Overlap exclusion must now be scoped per content section, so two different
-- videos (different content sections) can each start at 0s without conflict.
ALTER TABLE video_sections
  DROP CONSTRAINT IF EXISTS video_sections_no_overlap;

ALTER TABLE video_sections
  ADD CONSTRAINT video_sections_no_overlap EXCLUDE USING gist (
    content_id WITH =,
    content_section_order WITH =,
    int4range(start_time, end_time) WITH &&
  );

-- Hot path: list sections for one content section.
CREATE INDEX IF NOT EXISTS idx_video_sections_content_section
  ON video_sections(content_id, content_section_order, section_order);

COMMIT;
