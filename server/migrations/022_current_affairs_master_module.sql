-- Migration 022: Current Affairs Data Reliability, Source Metadata, Banking Categories & Indexes
-- Additive, idempotent, and backward-compatible with all existing HHK tables and student records.
-- Note: server/migrate.js wraps each migration file in a BEGIN ... COMMIT transaction.

-- 1. Additive source metadata, editorial tracking, and deduplication columns on current_affairs
ALTER TABLE current_affairs
  ADD COLUMN IF NOT EXISTS source_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS priority_level TEXT NOT NULL DEFAULT 'important',
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS target_exams JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_hash TEXT NOT NULL DEFAULT '';

-- 2. Add safe CHECK constraints only if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_current_affairs_verification_status'
  ) THEN
    ALTER TABLE current_affairs
      ADD CONSTRAINT chk_current_affairs_verification_status
      CHECK (verification_status IN ('unverified', 'verified', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_current_affairs_approval_status'
  ) THEN
    ALTER TABLE current_affairs
      ADD CONSTRAINT chk_current_affairs_approval_status
      CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_revision'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_current_affairs_priority_level'
  ) THEN
    ALTER TABLE current_affairs
      ADD CONSTRAINT chk_current_affairs_priority_level
      CHECK (priority_level IN ('must_study', 'important', 'additional'));
  END IF;
END $$;

-- 3. Backfill updated_at and ingested_at from created_at for legacy rows where needed
UPDATE current_affairs
SET
  ingested_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, created_at, now()),
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

-- 5. Add missing Banking Examination categories without duplicating existing IDs
INSERT INTO current_affairs_categories(name) VALUES
  ('Reports, Rankings & Indexes'),
  ('MoUs & Agreements'),
  ('Important Days & Themes'),
  ('Resignations')
ON CONFLICT (name) DO NOTHING;

-- 6. Performance & Deduplication Indexes (non-unique where legacy duplicates may exist)
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

/*
-- NON-DESTRUCTIVE ROLLBACK STRATEGY (Reference Only — Do Not Execute Automatically):
-- Preserves all existing articles, questions, answers, bookmarks, and reading history.
-- To revert Migration 022 metadata & indexes without touching core data:
--   DROP INDEX IF EXISTS idx_ca_reads_student_affair;
--   DROP INDEX IF EXISTS idx_ca_questions_affair_id;
--   DROP INDEX IF EXISTS idx_ca_source_name;
--   DROP INDEX IF EXISTS idx_ca_content_hash;
--   DROP INDEX IF EXISTS idx_ca_lower_title;
--   DROP INDEX IF EXISTS idx_ca_source_url;
--   DROP INDEX IF EXISTS idx_ca_category_id;
--   DROP INDEX IF EXISTS idx_ca_status_published_at;
--   DROP TABLE IF EXISTS current_affairs_feed_runs;
--   ALTER TABLE current_affairs
--     DROP CONSTRAINT IF EXISTS chk_current_affairs_verification_status,
--     DROP CONSTRAINT IF EXISTS chk_current_affairs_approval_status,
--     DROP CONSTRAINT IF EXISTS chk_current_affairs_priority_level;
--   -- (Keep added columns or drop only if confirmed unused; keep added categories if articles reference them.)
*/
