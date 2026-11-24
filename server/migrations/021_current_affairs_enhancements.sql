-- Migration 021: Structured Current Affairs Exam Notes & Student Read/Bookmark Tracking

ALTER TABLE current_affairs
  ADD COLUMN IF NOT EXISTS key_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS static_gk TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS current_affairs_reads (
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  affair_id UUID NOT NULL REFERENCES current_affairs(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, affair_id)
);

CREATE INDEX IF NOT EXISTS idx_ca_reads_student_bookmarked
  ON current_affairs_reads(student_id, is_bookmarked)
  WHERE is_bookmarked = TRUE;