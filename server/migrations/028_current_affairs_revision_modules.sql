-- Migration 028: Phase 7 One-Liner Digest & Interactive Flashcards with Spaced Repetition
-- Additive, idempotent migration compatible with both fresh DBs and live DBs where
-- earlier master-module flashcard tables may already exist.

-- ============================================================================
-- A. ONE-LINER DIGEST TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS current_affairs_one_liners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_article_id UUID REFERENCES current_affairs(id) ON DELETE SET NULL,
  source_ai_result_id UUID REFERENCES current_affairs_ai_results(id) ON DELETE SET NULL,
  source_reference_type TEXT NOT NULL DEFAULT '',
  source_reference_id UUID,
  fact_text TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES current_affairs_categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL DEFAULT 'Banking Static GK',
  topic TEXT NOT NULL DEFAULT '',
  subtopic TEXT NOT NULL DEFAULT '',
  related_institution TEXT NOT NULL DEFAULT '',
  related_person TEXT NOT NULL DEFAULT '',
  important_date DATE,
  important_figure TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  effective_date DATE,
  study_priority TEXT NOT NULL DEFAULT 'important' CHECK (
    study_priority IN ('must_study', 'important', 'additional')
  ),
  banking_relevance_score INTEGER CHECK (banking_relevance_score IS NULL OR (banking_relevance_score >= 0 AND banking_relevance_score <= 100)),
  exam_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash TEXT NOT NULL DEFAULT '',
  duplicate_status TEXT NOT NULL DEFAULT 'unique' CHECK (
    duplicate_status IN ('unique', 'exact_duplicate', 'near_duplicate')
  ),
  validation_status TEXT NOT NULL DEFAULT 'passed' CHECK (
    validation_status IN ('passed', 'warnings', 'failed')
  ),
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (
    verification_status IN ('unverified', 'verified', 'rejected')
  ),
  publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    publication_status IN ('draft', 'approved', 'published', 'rejected', 'archived')
  ),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_ol_pub_date
  ON current_affairs_one_liners(publication_status, important_date DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ca_ol_pub_cat_priority
  ON current_affairs_one_liners(publication_status, category_name, study_priority);
CREATE INDEX IF NOT EXISTS idx_ca_ol_hash
  ON current_affairs_one_liners(content_hash) WHERE content_hash <> '';

CREATE TABLE IF NOT EXISTS current_affairs_one_liner_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  one_liner_id UUID NOT NULL REFERENCES current_affairs_one_liners(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_status TEXT NOT NULL DEFAULT 'not_started' CHECK (
    review_status IN ('not_started', 'revised', 'needs_revision')
  ),
  is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (one_liner_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_ca_ol_rev_student
  ON current_affairs_one_liner_reviews(student_id, review_status, is_bookmarked);

-- ============================================================================
-- B. FLASHCARD DECKS, CARDS, REVIEW HISTORY, PROGRESS & BOOKMARKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS current_affairs_flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  deck_type TEXT NOT NULL DEFAULT 'topic' CHECK (
    deck_type IN ('daily', 'weekly', 'monthly', 'topic', 'exam', 'must_study')
  ),
  category TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  exam_code TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'moderate' CHECK (difficulty IN ('easy', 'moderate', 'difficult')),
  start_date DATE,
  end_date DATE,
  publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    publication_status IN ('draft', 'published', 'archived')
  ),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_fc_decks_pub_type
  ON current_affairs_flashcard_decks(publication_status, deck_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS current_affairs_flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID REFERENCES current_affairs_flashcard_decks(id) ON DELETE SET NULL,
  source_article_id UUID REFERENCES current_affairs(id) ON DELETE SET NULL,
  source_ai_result_id UUID REFERENCES current_affairs_ai_results(id) ON DELETE SET NULL,
  source_reference_type TEXT NOT NULL DEFAULT '',
  source_reference_id UUID,
  card_type TEXT NOT NULL DEFAULT 'direct_fact',
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'moderate',
  category TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  subtopic TEXT NOT NULL DEFAULT '',
  exam_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  study_priority TEXT NOT NULL DEFAULT 'important',
  source_url TEXT NOT NULL DEFAULT '',
  effective_date DATE,
  content_hash TEXT NOT NULL DEFAULT '',
  duplicate_status TEXT NOT NULL DEFAULT 'unique',
  validation_status TEXT NOT NULL DEFAULT 'passed',
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  publication_status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Additive columns if current_affairs_flashcards already existed in live DB
ALTER TABLE current_affairs_flashcards
  ADD COLUMN IF NOT EXISTS deck_id UUID REFERENCES current_affairs_flashcard_decks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_article_id UUID REFERENCES current_affairs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_ai_result_id UUID REFERENCES current_affairs_ai_results(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_reference_type TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_reference_id UUID,
  ADD COLUMN IF NOT EXISTS card_type TEXT NOT NULL DEFAULT 'direct_fact',
  ADD COLUMN IF NOT EXISTS front_text TEXT,
  ADD COLUMN IF NOT EXISTS back_text TEXT,
  ADD COLUMN IF NOT EXISTS explanation TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'moderate',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS topic TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subtopic TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS exam_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS study_priority TEXT NOT NULL DEFAULT 'important',
  ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS content_hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS duplicate_status TEXT NOT NULL DEFAULT 'unique',
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'passed',
  ADD COLUMN IF NOT EXISTS validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ca_fc_deck_pub
  ON current_affairs_flashcards(deck_id, publication_status);
CREATE INDEX IF NOT EXISTS idx_ca_fc_hash
  ON current_affairs_flashcards(content_hash) WHERE content_hash <> '';

-- Immutable Review History Log
CREATE TABLE IF NOT EXISTS current_affairs_flashcard_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id UUID NOT NULL REFERENCES current_affairs_flashcards(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('again', 'hard', 'good', 'easy')),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_interval_days INTEGER NOT NULL DEFAULT 0,
  next_interval_days INTEGER NOT NULL DEFAULT 0,
  next_review_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_fc_reviews_student_card
  ON current_affairs_flashcard_reviews(student_id, flashcard_id, reviewed_at DESC);

-- Per-Student Scheduling Snapshot (1 row per student+card; avoids duplicating cards)
CREATE TABLE IF NOT EXISTS current_affairs_flashcard_progress (
  flashcard_id UUID NOT NULL REFERENCES current_affairs_flashcards(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_response TEXT NOT NULL CHECK (last_response IN ('again', 'hard', 'good', 'easy')),
  successful_reviews INTEGER NOT NULL DEFAULT 0,
  missed_reviews INTEGER NOT NULL DEFAULT 0,
  current_interval_days INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_review_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (flashcard_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_ca_fc_progress_due
  ON current_affairs_flashcard_progress(student_id, next_review_at ASC);

CREATE TABLE IF NOT EXISTS current_affairs_flashcard_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id UUID NOT NULL REFERENCES current_affairs_flashcards(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flashcard_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_ca_fc_bookmarks_student
  ON current_affairs_flashcard_bookmarks(student_id);
