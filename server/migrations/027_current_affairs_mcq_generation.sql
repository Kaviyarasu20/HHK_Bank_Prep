-- Migration 027: Phase 6 Exam-Wise MCQ Generation, Validation & Canonical Question Bank Sync
-- Additive, idempotent migration preserving all existing questions, mock_tests, CBT, and Phases 2-5 tables.

-- A. Generation Batches
CREATE TABLE IF NOT EXISTS current_affairs_question_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL CHECK (source_type IN ('current_affairs', 'banking_reference')),
  exam_code TEXT NOT NULL DEFAULT 'IBPS PO',
  topic TEXT NOT NULL DEFAULT '',
  difficulty_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_question_count INTEGER NOT NULL DEFAULT 1 CHECK (requested_question_count >= 1 AND requested_question_count <= 100),
  generated_question_count INTEGER NOT NULL DEFAULT 0,
  accepted_question_count INTEGER NOT NULL DEFAULT 0,
  rejected_question_count INTEGER NOT NULL DEFAULT 0,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    processing_status IN ('pending', 'processing', 'completed', 'partial', 'failed')
  ),
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  prompt_version TEXT NOT NULL DEFAULT 'ca-mcq-phase6-v1.0',
  usage_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ca_q_batches_created
  ON current_affairs_question_batches(created_at DESC);

-- B. Generated Questions (Staging + Link to Canonical questions & current_affairs_questions)
CREATE TABLE IF NOT EXISTS current_affairs_generated_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES current_affairs_question_batches(id) ON DELETE SET NULL,
  source_article_id UUID REFERENCES current_affairs(id) ON DELETE SET NULL,
  source_ai_result_id UUID REFERENCES current_affairs_ai_results(id) ON DELETE SET NULL,
  source_reference_type TEXT NOT NULL DEFAULT '',
  source_reference_id UUID,
  canonical_question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  ca_question_id UUID REFERENCES current_affairs_questions(id) ON DELETE SET NULL,
  exam_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  topic TEXT NOT NULL DEFAULT '',
  subtopic TEXT NOT NULL DEFAULT '',
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'direct_factual' CHECK (
    question_type IN (
      'direct_factual', 'statement_based', 'match_following', 'correct_incorrect',
      'fill_blank', 'assertion_reason', 'chronology', 'numerical_data', 'institution_abbreviation'
    )
  ),
  difficulty TEXT NOT NULL DEFAULT 'moderate' CHECK (difficulty IN ('easy', 'moderate', 'difficult')),
  difficulty_reason TEXT NOT NULL DEFAULT '',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  source_reference TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  quality_score INTEGER NOT NULL DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  quality_status TEXT NOT NULL DEFAULT 'needs_review' CHECK (
    quality_status IN ('excellent', 'good', 'needs_review', 'rejected')
  ),
  validation_status TEXT NOT NULL DEFAULT 'failed' CHECK (
    validation_status IN ('passed', 'warnings', 'failed')
  ),
  duplicate_status TEXT NOT NULL DEFAULT 'unique' CHECK (
    duplicate_status IN ('unique', 'exact_duplicate', 'near_duplicate', 'same_fact')
  ),
  duplicate_of_id UUID REFERENCES current_affairs_generated_questions(id) ON DELETE SET NULL,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    review_status IN ('draft', 'approved', 'rejected', 'archived')
  ),
  version_number INTEGER NOT NULL DEFAULT 1,
  parent_question_id UUID REFERENCES current_affairs_generated_questions(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_gen_q_batch ON current_affairs_generated_questions(batch_id);
CREATE INDEX IF NOT EXISTS idx_ca_gen_q_review_status ON current_affairs_generated_questions(review_status, validation_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ca_gen_q_hash ON current_affairs_generated_questions(content_hash) WHERE content_hash <> '';
CREATE INDEX IF NOT EXISTS idx_ca_gen_q_article ON current_affairs_generated_questions(source_article_id) WHERE source_article_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ca_gen_q_canonical ON current_affairs_generated_questions(canonical_question_id) WHERE canonical_question_id IS NOT NULL;

-- C. Normalized Options Table (in addition to JSONB snapshot for canonical compatibility)
CREATE TABLE IF NOT EXISTS current_affairs_question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES current_affairs_generated_questions(id) ON DELETE CASCADE,
  option_label TEXT NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (question_id, option_label)
);

CREATE INDEX IF NOT EXISTS idx_ca_q_options_qid ON current_affairs_question_options(question_id);

-- D. Deterministic & Source Validation Audit Records
CREATE TABLE IF NOT EXISTS current_affairs_question_validation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES current_affairs_generated_questions(id) ON DELETE CASCADE,
  structural_status TEXT NOT NULL CHECK (structural_status IN ('passed', 'warnings', 'failed')),
  answer_validation_status TEXT NOT NULL CHECK (answer_validation_status IN ('passed', 'warnings', 'failed')),
  source_validation_status TEXT NOT NULL CHECK (source_validation_status IN ('passed', 'warnings', 'failed')),
  ambiguity_status TEXT NOT NULL CHECK (ambiguity_status IN ('passed', 'warnings', 'failed')),
  duplicate_status TEXT NOT NULL CHECK (duplicate_status IN ('unique', 'exact_duplicate', 'near_duplicate', 'same_fact')),
  quality_score INTEGER NOT NULL DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  quality_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  validated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_q_validation_qid ON current_affairs_question_validation(question_id, validated_at DESC);

-- E. Editorial Review History
CREATE TABLE IF NOT EXISTS current_affairs_question_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES current_affairs_generated_questions(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('approved', 'rejected', 'edited', 'flagged_duplicate')),
  admin_feedback TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_q_reviews_qid ON current_affairs_question_reviews(question_id, reviewed_at DESC);
