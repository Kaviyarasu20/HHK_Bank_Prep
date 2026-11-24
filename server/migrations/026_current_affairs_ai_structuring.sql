-- Migration 026: Phase 5 AI Structuring & Banking Relevance Triage
-- Additive, idempotent migration preserving all existing Current Affairs & Phase 4 Reference tables.
-- Supports multiple AI processing attempts per article without overwriting approved results.

-- A. Main AI Processing Results Table
CREATE TABLE IF NOT EXISTS current_affairs_ai_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_affairs_id UUID NOT NULL REFERENCES current_affairs(id) ON DELETE CASCADE,
  article_content_hash TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'disabled',
  model TEXT NOT NULL DEFAULT '',
  prompt_version TEXT NOT NULL DEFAULT 'ca-phase5-v1.0',
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    processing_status IN (
      'pending', 'processing', 'completed', 'validation_failed',
      'review_required', 'approved', 'rejected', 'failed'
    )
  ),
  exam_headline TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  detailed_explanation TEXT NOT NULL DEFAULT '',
  why_it_matters TEXT NOT NULL DEFAULT '',
  takeaways JSONB NOT NULL DEFAULT '[]'::jsonb,
  important_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  banking_relevance_score INTEGER CHECK (banking_relevance_score IS NULL OR (banking_relevance_score >= 0 AND banking_relevance_score <= 100)),
  banking_relevance_level TEXT NOT NULL DEFAULT 'low_relevance' CHECK (
    banking_relevance_level IN ('highly_relevant', 'relevant', 'moderately_relevant', 'low_relevance')
  ),
  relevance_reason TEXT NOT NULL DEFAULT '',
  study_priority TEXT NOT NULL DEFAULT 'additional' CHECK (
    study_priority IN ('must_study', 'important', 'additional')
  ),
  confidence_score NUMERIC(4,3) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  usage_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_ai_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    validation_status IN ('pending', 'passed', 'warnings', 'failed')
  ),
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_ai_results_article_status
  ON current_affairs_ai_results(current_affairs_id, processing_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ca_ai_results_status_priority
  ON current_affairs_ai_results(processing_status, study_priority, banking_relevance_level);

-- Prevent duplicate concurrent in-flight AI jobs for the same article
CREATE UNIQUE INDEX IF NOT EXISTS uq_ca_ai_one_inflight_per_article
  ON current_affairs_ai_results(current_affairs_id)
  WHERE processing_status IN ('pending', 'processing');

-- B. Extracted Structured Facts
CREATE TABLE IF NOT EXISTS current_affairs_ai_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_result_id UUID NOT NULL REFERENCES current_affairs_ai_results(id) ON DELETE CASCADE,
  fact_type TEXT NOT NULL DEFAULT 'general',
  fact_text TEXT NOT NULL,
  fact_value TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  event_stage TEXT NOT NULL DEFAULT 'unspecified' CHECK (
    event_stage IN ('announced', 'proposed', 'approved', 'implemented', 'completed', 'unspecified')
  ),
  context TEXT NOT NULL DEFAULT '',
  source_reference TEXT NOT NULL DEFAULT '',
  confidence_score NUMERIC(4,3) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);

CREATE INDEX IF NOT EXISTS idx_ca_ai_facts_result_id
  ON current_affairs_ai_facts(ai_result_id);

-- C. Identified Banking Topics
CREATE TABLE IF NOT EXISTS current_affairs_ai_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_result_id UUID NOT NULL REFERENCES current_affairs_ai_results(id) ON DELETE CASCADE,
  topic_name TEXT NOT NULL,
  topic_category TEXT NOT NULL DEFAULT '',
  relevance_score INTEGER CHECK (relevance_score IS NULL OR (relevance_score >= 0 AND relevance_score <= 100))
);

CREATE INDEX IF NOT EXISTS idx_ca_ai_topics_result_id
  ON current_affairs_ai_topics(ai_result_id);

CREATE INDEX IF NOT EXISTS idx_ca_ai_topics_name
  ON current_affairs_ai_topics(lower(topic_name));

-- D. Exam-Wise Relevance Tags
CREATE TABLE IF NOT EXISTS current_affairs_ai_exam_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_result_id UUID NOT NULL REFERENCES current_affairs_ai_results(id) ON DELETE CASCADE,
  exam_code TEXT NOT NULL,
  relevance_reason TEXT NOT NULL DEFAULT '',
  confidence_score NUMERIC(4,3) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);

CREATE INDEX IF NOT EXISTS idx_ca_ai_exam_tags_result_id
  ON current_affairs_ai_exam_tags(ai_result_id);

CREATE INDEX IF NOT EXISTS idx_ca_ai_exam_tags_code
  ON current_affairs_ai_exam_tags(exam_code);

-- E. Static GK Connections (Optionally Linked to Phase 4 Reference Hub)
CREATE TABLE IF NOT EXISTS current_affairs_ai_static_gk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_result_id UUID NOT NULL REFERENCES current_affairs_ai_results(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference_type TEXT NOT NULL DEFAULT 'general',
  reference_id UUID,
  source_reference TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_ca_ai_static_gk_result_id
  ON current_affairs_ai_static_gk(ai_result_id);

-- F. Admin Editorial Review Audit Trail
CREATE TABLE IF NOT EXISTS current_affairs_ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_result_id UUID NOT NULL REFERENCES current_affairs_ai_results(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('approved', 'rejected', 'edited')),
  admin_feedback TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_ai_reviews_result_id
  ON current_affairs_ai_reviews(ai_result_id, reviewed_at DESC);
