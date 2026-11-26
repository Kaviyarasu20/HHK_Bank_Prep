-- ============================================================================
-- Migration 033: HHK AI-Based Reading Comprehension Question Generator Module
-- ============================================================================
-- Normalized relational schema supporting:
-- - All 15 Reading Comprehension categories (10 Subject + 5 Question-Focused)
-- - All 10 Banking Exam question types
-- - Passage-level Draft/Published workflow (never auto-published)
-- - Strict ON DELETE CASCADE so deleting a passage never leaves orphaned questions/vocab
-- - Passage-based Vocabulary with English & Tamil meanings
-- - Student CBT practice attempts, review flags, and score evaluation
-- ============================================================================

CREATE TABLE IF NOT EXISTS rc_passages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  examination TEXT NOT NULL,
  category TEXT NOT NULL,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  difficulty TEXT NOT NULL DEFAULT 'moderate'
    CHECK (difficulty IN ('easy', 'moderate', 'hard', 'expert')),
  passage_length TEXT NOT NULL DEFAULT 'medium'
    CHECK (passage_length IN ('short', 'medium', 'long')),
  passage_text TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0 CHECK (word_count >= 0),
  option_count INTEGER NOT NULL DEFAULT 5 CHECK (option_count IN (4, 5)),
  include_explanations BOOLEAN NOT NULL DEFAULT TRUE,
  include_vocabulary BOOLEAN NOT NULL DEFAULT TRUE,
  recommended_time_seconds INTEGER NOT NULL DEFAULT 600 CHECK (recommended_time_seconds > 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  content_hash TEXT NOT NULL DEFAULT '',
  ai_provider TEXT NOT NULL DEFAULT '',
  ai_model TEXT NOT NULL DEFAULT '',
  quality_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rc_passages_exam_cat_diff
  ON rc_passages (examination, category, difficulty, status);

CREATE INDEX IF NOT EXISTS idx_rc_passages_status_created
  ON rc_passages (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rc_passages_content_hash
  ON rc_passages (content_hash)
  WHERE content_hash <> '';

CREATE TABLE IF NOT EXISTS rc_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passage_id UUID NOT NULL REFERENCES rc_passages(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL DEFAULT 1 CHECK (question_number > 0),
  question_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'moderate'
    CHECK (difficulty IN ('easy', 'moderate', 'hard', 'expert')),
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  passage_reference TEXT NOT NULL DEFAULT '',
  marks NUMERIC(6, 2) NOT NULL DEFAULT 1.00 CHECK (marks >= 0),
  negative_marks NUMERIC(6, 2) NOT NULL DEFAULT 0.25 CHECK (negative_marks >= 0),
  validation_status TEXT NOT NULL DEFAULT 'verified'
    CHECK (validation_status IN ('verified', 'flagged', 'edited')),
  validation_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rc_questions_passage_order
  ON rc_questions (passage_id, question_number ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_rc_questions_type_diff
  ON rc_questions (question_type, difficulty);

CREATE TABLE IF NOT EXISTS rc_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passage_id UUID NOT NULL REFERENCES rc_passages(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  meaning_english TEXT NOT NULL,
  meaning_tamil TEXT NOT NULL DEFAULT '',
  synonym TEXT NOT NULL DEFAULT '',
  antonym TEXT NOT NULL DEFAULT '',
  pronunciation TEXT NOT NULL DEFAULT '',
  example_sentence TEXT NOT NULL DEFAULT '',
  passage_context TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rc_vocabulary_passage
  ON rc_vocabulary (passage_id, sort_order ASC);

CREATE TABLE IF NOT EXISTS rc_student_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  passage_id UUID NOT NULL REFERENCES rc_passages(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'auto_submitted')),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  marked_for_review JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  unanswered_count INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(8, 2) NOT NULL DEFAULT 0,
  max_score NUMERIC(8, 2) NOT NULL DEFAULT 0,
  accuracy_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rc_attempts_student_passage
  ON rc_student_attempts (student_id, passage_id, started_at DESC);
