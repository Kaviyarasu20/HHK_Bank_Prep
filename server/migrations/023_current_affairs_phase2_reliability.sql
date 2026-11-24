-- Migration 023: Phase 2 Current Affairs Data Reliability & Feed Telemetry
-- Safe, additive, idempotent migration compatible with live databases that already
-- applied an earlier 022_current_affairs_master_module.sql (with JSONB target_exams
-- and verification_status default 'draft').

-- 1. Add only the missing Phase 2 metadata columns (never altering existing JSONB types)
ALTER TABLE current_affairs
  ADD COLUMN IF NOT EXISTS source_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS content_hash TEXT NOT NULL DEFAULT '';

-- 2. Add safe CHECK constraint on approval_status only if absent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_current_affairs_approval_status'
  ) THEN
    ALTER TABLE current_affairs
      ADD CONSTRAINT chk_current_affairs_approval_status
      CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_revision'));
  END IF;
END $$;

-- 3. Backfill ingested_at and approval_status safely for existing rows
UPDATE current_affairs
SET
  ingested_at = COALESCE(created_at, now()),
  approval_status = CASE
    WHEN status = 'published' AND approval_status = 'pending' THEN 'approved'
    ELSE approval_status
  END
WHERE created_at IS NOT NULL;

-- 4. RSS Feed Ingestion Telemetry & Failure Audit Table
CREATE TABLE IF NOT EXISTS current_affairs_feed_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_key TEXT NOT NULL,
  feed_name TEXT NOT NULL,
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  discovered_count INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  last_successful_fetch TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_feed_runs_key_created
  ON current_affairs_feed_runs(feed_key, created_at DESC);

-- 5. Ensure missing banking categories exist without duplicating existing ones
INSERT INTO current_affairs_categories(name) VALUES
  ('Reports, Rankings & Indexes'),
  ('MoUs & Agreements'),
  ('Important Days & Themes'),
  ('Resignations')
ON CONFLICT (name) DO NOTHING;

-- 6. Required Phase 2 Performance & Deduplication Indexes
CREATE INDEX IF NOT EXISTS idx_ca_status_published_at
  ON current_affairs(status, published_at DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ca_category_id
  ON current_affairs(category_id);

CREATE INDEX IF NOT EXISTS idx_ca_source_url
  ON current_affairs(source_url)
  WHERE source_url <> '';

CREATE INDEX IF NOT EXISTS idx_ca_lower_title
  ON current_affairs(lower(title));

CREATE INDEX IF NOT EXISTS idx_ca_content_hash
  ON current_affairs(content_hash)
  WHERE content_hash <> '';

CREATE INDEX IF NOT EXISTS idx_ca_source_name
  ON current_affairs(source_name)
  WHERE source_name <> '';

CREATE INDEX IF NOT EXISTS idx_ca_questions_affair_id
  ON current_affairs_questions(affair_id);

CREATE INDEX IF NOT EXISTS idx_ca_reads_student_affair
  ON current_affairs_reads(student_id, affair_id);
