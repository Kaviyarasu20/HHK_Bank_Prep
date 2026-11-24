-- Migration 029: Phase 8 Smart Revision & Monthly Capsules
-- Additive, idempotent migration using plain immutable columns in all indexes.
-- Preserves all existing student data, Phases 1-7 tables, and historical migrations.

-- ============================================================================
-- A. SMART REVISION TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_revision_preferences (
  student_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  target_exams JSONB NOT NULL DEFAULT '["IBPS PO","SBI PO"]'::jsonb,
  daily_item_limit INTEGER NOT NULL DEFAULT 10 CHECK (daily_item_limit >= 3 AND daily_item_limit <= 50),
  signal_weights JSONB NOT NULL DEFAULT '{"repeated_incorrect":25,"low_topic_accuracy":20,"overdue_flashcards":20,"difficult_flashcards":10,"bookmarked":10,"high_priority":10,"slow_response":5}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_revision_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (
    content_type IN ('article', 'banking_fact', 'one_liner', 'flashcard', 'mcq', 'static_gk')
  ),
  content_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  priority_level TEXT NOT NULL DEFAULT 'important' CHECK (
    priority_level IN ('must_study', 'important', 'additional')
  ),
  priority_score INTEGER NOT NULL DEFAULT 50 CHECK (priority_score >= 0 AND priority_score <= 100),
  recommendation_reason TEXT NOT NULL DEFAULT '',
  revision_state TEXT NOT NULL DEFAULT 'new' CHECK (
    revision_state IN ('new', 'due', 'overdue', 'in_progress', 'reviewed', 'needs_improvement', 'mastered')
  ),
  revision_stage INTEGER NOT NULL DEFAULT 0 CHECK (revision_stage >= 0 AND revision_stage <= 10),
  interval_days INTEGER NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  estimated_minutes INTEGER NOT NULL DEFAULT 3,
  last_studied_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_sri_student_due
  ON student_revision_items(student_id, due_at ASC, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_sri_student_state
  ON student_revision_items(student_id, revision_state);

CREATE TABLE IF NOT EXISTS student_revision_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revision_item_id UUID REFERENCES student_revision_items(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  review_outcome TEXT NOT NULL CHECK (
    review_outcome IN ('again', 'hard', 'good', 'easy', 'reviewed', 'difficult', 'understood')
  ),
  previous_due_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ NOT NULL,
  review_interval_days INTEGER NOT NULL DEFAULT 0,
  revision_stage INTEGER NOT NULL DEFAULT 1,
  source_recommendation TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_srh_student_reviewed
  ON student_revision_history(student_id, reviewed_at DESC);

CREATE TABLE IF NOT EXISTS student_weak_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_name TEXT NOT NULL,
  attempts_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  accuracy_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_response_seconds INTEGER NOT NULL DEFAULT 0,
  explanation TEXT NOT NULL DEFAULT '',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, topic_name)
);

CREATE INDEX IF NOT EXISTS idx_swt_student_acc
  ON student_weak_topics(student_id, accuracy_percent ASC);

CREATE TABLE IF NOT EXISTS student_daily_revision_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_sdrp_student_date
  ON student_daily_revision_plans(student_id, plan_date DESC);

-- ============================================================================
-- B. MONTHLY CAPSULES TABLES (Relational Links — Zero Content Duplication)
-- ============================================================================
CREATE TABLE IF NOT EXISTS monthly_capsules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_year INTEGER NOT NULL CHECK (capsule_year >= 2020 AND capsule_year <= 2100),
  capsule_month INTEGER NOT NULL CHECK (capsule_month >= 1 AND capsule_month <= 12),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  estimated_read_minutes INTEGER NOT NULL DEFAULT 30,
  publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    publication_status IN ('draft', 'pending_review', 'approved', 'published', 'archived', 'rejected')
  ),
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    validation_status IN ('pending', 'passed', 'warnings', 'failed')
  ),
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (capsule_year, capsule_month, title)
);

CREATE INDEX IF NOT EXISTS idx_mc_status_ym
  ON monthly_capsules(publication_status, capsule_year DESC, capsule_month DESC);

CREATE TABLE IF NOT EXISTS monthly_capsule_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID NOT NULL REFERENCES monthly_capsules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category_name TEXT NOT NULL DEFAULT 'RBI and Monetary Policy',
  introduction TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcs_capsule_order
  ON monthly_capsule_sections(capsule_id, sort_order ASC);

CREATE TABLE IF NOT EXISTS monthly_capsule_content_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID NOT NULL REFERENCES monthly_capsules(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES monthly_capsule_sections(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (
    content_type IN ('article', 'one_liner', 'mcq', 'flashcard', 'banking_reference')
  ),
  content_id UUID NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  effective_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_mccl_capsule_section
  ON monthly_capsule_content_links(capsule_id, section_id, sort_order ASC);

CREATE TABLE IF NOT EXISTS monthly_capsule_exam_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID NOT NULL REFERENCES monthly_capsules(id) ON DELETE CASCADE,
  exam_code TEXT NOT NULL,
  UNIQUE (capsule_id, exam_code)
);

CREATE INDEX IF NOT EXISTS idx_mcet_exam_code
  ON monthly_capsule_exam_tags(exam_code);

CREATE TABLE IF NOT EXISTS student_monthly_capsule_progress (
  capsule_id UUID NOT NULL REFERENCES monthly_capsules(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_section_id UUID REFERENCES monthly_capsule_sections(id) ON DELETE SET NULL,
  completed_sections_count INTEGER NOT NULL DEFAULT 0,
  total_sections_count INTEGER NOT NULL DEFAULT 0,
  completion_percent INTEGER NOT NULL DEFAULT 0 CHECK (completion_percent >= 0 AND completion_percent <= 100),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (capsule_id, student_id)
);

CREATE TABLE IF NOT EXISTS student_monthly_capsule_section_progress (
  section_id UUID NOT NULL REFERENCES monthly_capsule_sections(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capsule_id UUID NOT NULL REFERENCES monthly_capsules(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (section_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_smcsp_student_capsule
  ON student_monthly_capsule_section_progress(student_id, capsule_id, is_completed);
