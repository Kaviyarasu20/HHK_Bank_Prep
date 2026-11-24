-- Phase 9: GA Marathon & CBT / Subscription Integration
-- Strictly additive migration. Preserves all existing tables, historical migrations (001-029),
-- mock_tests, questions, attempts, subscriptions, and payment records.
-- All indexes use plain immutable column expressions (PostgreSQL 42P17 safe).

-- 1. Extend mock_tests check constraints to support test_type = 'GA_MARATHON'
ALTER TABLE mock_tests DROP CONSTRAINT IF EXISTS mock_tests_test_type_check;
ALTER TABLE mock_tests
  ADD CONSTRAINT mock_tests_test_type_check
  CHECK (test_type IN ('EXAM_WISE', 'TOPIC_WISE', 'GA_MARATHON'));

ALTER TABLE mock_tests DROP CONSTRAINT IF EXISTS mock_tests_mode_fields_check;
ALTER TABLE mock_tests
  ADD CONSTRAINT mock_tests_mode_fields_check
  CHECK (
    (test_type = 'EXAM_WISE' AND exam_id IS NOT NULL AND stage_id IS NOT NULL AND subject IS NULL AND topic IS NULL)
    OR (test_type = 'TOPIC_WISE' AND subject IS NOT NULL AND btrim(subject) <> '' AND topic IS NOT NULL AND btrim(topic) <> '')
    OR (test_type = 'GA_MARATHON')
  );

-- 2. GA Marathon 1-to-1 configuration extension table (reuses mock_tests for CBT, pricing & subscriptions)
CREATE TABLE IF NOT EXISTS ga_marathon_configs (
  mock_test_id UUID PRIMARY KEY REFERENCES mock_tests(id) ON DELETE CASCADE,
  ga_category TEXT NOT NULL CHECK (
    ga_category IN (
      'daily_ga',
      'weekly_marathon',
      'monthly_marathon',
      'monthly_capsule_test',
      'banking_awareness',
      'current_affairs',
      'static_banking_gk',
      'exam_wise_ga',
      'full_length_ga',
      'previous_month_revision'
    )
  ),
  target_exams JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_official_pattern BOOLEAN NOT NULL DEFAULT FALSE,
  capsule_id UUID REFERENCES monthly_capsules(id) ON DELETE SET NULL,
  attempt_limit INTEGER CHECK (attempt_limit IS NULL OR attempt_limit > 0),
  randomize_questions BOOLEAN NOT NULL DEFAULT FALSE,
  randomize_options BOOLEAN NOT NULL DEFAULT FALSE,
  answer_release_policy TEXT NOT NULL DEFAULT 'immediate' CHECK (
    answer_release_policy IN ('immediate', 'scheduled', 'after_end', 'never')
  ),
  answer_release_at TIMESTAMPTZ,
  topic_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  difficulty_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  selection_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ga_marathon_configs_category
  ON ga_marathon_configs (ga_category);
CREATE INDEX IF NOT EXISTS idx_ga_marathon_configs_capsule
  ON ga_marathon_configs (capsule_id);

-- 3. Relational metadata linking GA Marathon mock_test_questions back to Phase 4-8 source learning entities
-- (Zero duplication of question text or options; canonical questions live in questions / mock_test_questions)
CREATE TABLE IF NOT EXISTS ga_marathon_question_links (
  mock_test_id UUID NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  generated_question_id UUID REFERENCES current_affairs_generated_questions(id) ON DELETE SET NULL,
  source_article_id UUID REFERENCES current_affairs(id) ON DELETE SET NULL,
  source_reference_type TEXT,
  source_reference_id TEXT,
  ga_domain TEXT NOT NULL DEFAULT 'current_affairs' CHECK (
    ga_domain IN ('current_affairs', 'banking_awareness', 'static_gk', 'economy_finance', 'government_schemes', 'other')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (mock_test_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_ga_qlinks_mock_test
  ON ga_marathon_question_links (mock_test_id);
CREATE INDEX IF NOT EXISTS idx_ga_qlinks_article
  ON ga_marathon_question_links (source_article_id);
