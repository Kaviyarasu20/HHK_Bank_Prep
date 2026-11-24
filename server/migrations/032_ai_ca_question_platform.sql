-- Migration 032: Complete Replacement of Current Affairs Module with AI-Powered Question Generator
-- Safe, non-destructive migration: preserves historical legacy tables (marked deprecated via comments)
-- while creating the normalized schema for the new HHK AI Current Affairs Question Platform.

-- 1. Non-destructive deprecation annotations on legacy tables (if present)
DO $$
DECLARE
  legacy_tbl TEXT;
BEGIN
  FOREACH legacy_tbl IN ARRAY ARRAY[
    'current_affairs',
    'current_affairs_reads',
    'current_affairs_questions',
    'current_affairs_answers',
    'current_affairs_ai_results',
    'current_affairs_generated_questions',
    'current_affairs_one_liners',
    'current_affairs_flashcards',
    'monthly_capsules'
  ] LOOP
    IF to_regclass('public.' || legacy_tbl) IS NOT NULL THEN
      EXECUTE format('COMMENT ON TABLE public.%I IS %L', legacy_tbl, 'DEPRECATED by Migration 032 (preserved for historical record safety).');
    END IF;
  END LOOP;
END $$;

-- 2. Categories (Banking Exam Current Affairs Taxonomy)
CREATE TABLE IF NOT EXISTS ca_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ca_categories (name, slug, description, sort_order) VALUES
  ('Banking & Financial Awareness', 'banking-financial', 'Commercial banking, NPCI, UPI, Basel norms, financial inclusion, and banking reforms', 1),
  ('RBI & Monetary Policy', 'rbi-monetary-policy', 'MPC decisions, policy rates, RBI circulars, regulatory actions, and digital currency', 2),
  ('Government Schemes', 'government-schemes', 'Central & state welfare, financial inclusion, agriculture, and MSME schemes', 3),
  ('Economy & Union Budget', 'economy-budget', 'GDP forecasts, CPI/WPI inflation, fiscal policy, GST, trade, and Union Budget', 4),
  ('Appointments & Resignations', 'appointments', 'Key leadership appointments in banks, regulators, ministries, and global bodies', 5),
  ('Reports & Indices', 'reports-indices', 'National and international rankings, RBI/World Bank/IMF/NITI Aayog reports', 6),
  ('National Affairs', 'national-affairs', 'Major policy decisions, legislation, infrastructure, and national initiatives', 7),
  ('International Affairs', 'international-affairs', 'Global economic alliances, bilateral agreements, multilateral banks, and summits', 8),
  ('Awards & Honours', 'awards-honours', 'Banking, economic, civilian, and international recognitions', 9),
  ('Agreements & MoUs', 'agreements-mous', 'Strategic partnerships, bank tie-ups, sovereign loans, and trade MoUs', 10),
  ('Summits & Conferences', 'summits-conferences', 'G20, BRICS, IMF-World Bank meetings, and financial conclaves', 11),
  ('Science, Defence & Sports', 'science-defence-sports', 'High-probability exam events in space, defence exercises, and major sports', 12)
ON CONFLICT (slug) DO NOTHING;

-- 3. Trusted Configurable News & Official Sources
CREATE TABLE IF NOT EXISTS ca_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'official_rss' CHECK (
    source_type IN ('official_rss', 'authorized_api', 'manual_editorial', 'document_upload', 'structured_import')
  ),
  feed_url TEXT NOT NULL DEFAULT '',
  trust_level TEXT NOT NULL DEFAULT 'verified' CHECK (
    trust_level IN ('verified', 'trusted', 'requires_review')
  ),
  default_category_id UUID REFERENCES ca_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_fetched_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ca_sources (name, source_type, feed_url, trust_level) VALUES
  ('Reserve Bank of India (RBI) Press Releases', 'official_rss', 'https://rbi.org.in/pressreleases_rss.xml', 'verified'),
  ('Press Information Bureau (PIB) Finance & Banking', 'official_rss', 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3', 'verified'),
  ('SEBI Official Releases', 'official_rss', 'https://www.sebi.gov.in/sebirss.xml', 'verified'),
  ('Manual Editorial Submission', 'manual_editorial', '', 'verified')
ON CONFLICT DO NOTHING;

-- 4. Daily Content Batches (Manual, Multi-Article Paste, Document Upload, Structured Import, Automated)
CREATE TABLE IF NOT EXISTS ca_daily_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  submission_mode TEXT NOT NULL DEFAULT 'manual' CHECK (
    submission_mode IN ('manual', 'bulk_paste', 'document_upload', 'structured_import', 'automated')
  ),
  source_id UUID REFERENCES ca_sources(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  category_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_exams JSONB NOT NULL DEFAULT '["IBPS PO","SBI PO","IBPS Clerk","SBI Clerk","RBI Assistant","RBI Grade B"]'::jsonb,
  raw_content TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    processing_status IN ('pending', 'processing', 'processed', 'failed')
  ),
  events_extracted INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ca_daily_batches_date ON ca_daily_batches(event_date DESC, created_at DESC);

-- 5. Ingested Articles (Normalized source records for deduplication & provenance)
CREATE TABLE IF NOT EXISTS ca_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES ca_daily_batches(id) ON DELETE CASCADE,
  source_id UUID REFERENCES ca_sources(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  publication_date TIMESTAMPTZ,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content_hash TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (
    verification_status IN ('verified', 'unverified_flagged', 'rejected')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_articles_hash ON ca_articles(content_hash) WHERE content_hash <> '';
CREATE INDEX IF NOT EXISTS idx_ca_articles_event_date ON ca_articles(event_date DESC);

-- 6. AI-Extracted Current Affairs Events (Structured Knowledge Points & Relevance Scoring)
CREATE TABLE IF NOT EXISTS ca_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES ca_daily_batches(id) ON DELETE SET NULL,
  article_id UUID REFERENCES ca_articles(id) ON DELETE SET NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  main_event TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  organizations JSONB NOT NULL DEFAULT '[]'::jsonb,
  numerical_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  people JSONB NOT NULL DEFAULT '[]'::jsonb,
  locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  schemes JSONB NOT NULL DEFAULT '[]'::jsonb,
  banking_implications TEXT NOT NULL DEFAULT '',
  knowledge_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  category_id UUID REFERENCES ca_categories(id) ON DELETE SET NULL,
  target_exams JSONB NOT NULL DEFAULT '[]'::jsonb,
  relevance_score INTEGER NOT NULL DEFAULT 0 CHECK (relevance_score >= 0 AND relevance_score <= 100),
  relevance_tier TEXT NOT NULL DEFAULT 'low_priority' CHECK (
    relevance_tier IN ('extremely_important', 'highly_important', 'moderately_important', 'low_priority')
  ),
  admin_override_score INTEGER CHECK (admin_override_score IS NULL OR (admin_override_score >= 0 AND admin_override_score <= 100)),
  admin_override_tier TEXT,
  duplicate_status TEXT NOT NULL DEFAULT 'unique' CHECK (
    duplicate_status IN ('unique', 'duplicate', 'near_duplicate')
  ),
  duplicate_of_event_id UUID REFERENCES ca_events(id) ON DELETE SET NULL,
  content_hash TEXT NOT NULL DEFAULT '',
  uncertain_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_reference TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  publication_date TIMESTAMPTZ,
  ai_provider TEXT NOT NULL DEFAULT '',
  ai_model TEXT NOT NULL DEFAULT '',
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    approval_status IN ('pending', 'approved', 'rejected', 'archived')
  ),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_events_date_status ON ca_events(event_date DESC, approval_status);
CREATE INDEX IF NOT EXISTS idx_ca_events_relevance ON ca_events(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_ca_events_hash ON ca_events(content_hash) WHERE content_hash <> '';

-- 7. AI Processing Jobs Log
CREATE TABLE IF NOT EXISTS ca_ai_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (
    job_type IN ('content_analysis', 'question_generation', 'question_regeneration', 'daily_automation')
  ),
  batch_id UUID REFERENCES ca_daily_batches(id) ON DELETE SET NULL,
  event_id UUID REFERENCES ca_events(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'running' CHECK (
    status IN ('queued', 'running', 'completed', 'failed')
  ),
  input_count INTEGER NOT NULL DEFAULT 0,
  output_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  usage_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ca_ai_jobs_started ON ca_ai_processing_jobs(started_at DESC);

-- 8. AI-Generated Banking Exam Questions (14 Formats)
CREATE TABLE IF NOT EXISTS ca_generated_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES ca_events(id) ON DELETE SET NULL,
  job_id UUID REFERENCES ca_ai_processing_jobs(id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (
    question_type IN (
      'mcq', 'multiple_statement', 'correct_incorrect', 'match_following',
      'fill_blank', 'assertion_reason', 'chronology', 'pair_based',
      'banking_financial', 'static_gk_ca', 'numerical_data', 'institution_hq',
      'appointment', 'scheme'
    )
  ),
  correct_answer TEXT NOT NULL,
  detailed_explanation TEXT NOT NULL DEFAULT '',
  why_correct TEXT NOT NULL DEFAULT '',
  why_others_incorrect JSONB NOT NULL DEFAULT '{}'::jsonb,
  important_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_reference TEXT NOT NULL DEFAULT '',
  ca_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES ca_categories(id) ON DELETE SET NULL,
  exam_relevance JSONB NOT NULL DEFAULT '[]'::jsonb,
  difficulty TEXT NOT NULL DEFAULT 'moderate' CHECK (difficulty IN ('easy', 'moderate', 'difficult')),
  language TEXT NOT NULL DEFAULT 'English',
  content_hash TEXT NOT NULL DEFAULT '',
  duplicate_status TEXT NOT NULL DEFAULT 'unique' CHECK (
    duplicate_status IN ('unique', 'exact_duplicate', 'near_duplicate')
  ),
  duplicate_of_question_id UUID REFERENCES ca_generated_questions(id) ON DELETE SET NULL,
  uncertain_flag BOOLEAN NOT NULL DEFAULT FALSE,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    review_status IN ('pending', 'approved', 'rejected', 'archived')
  ),
  ai_provider TEXT NOT NULL DEFAULT '',
  ai_model TEXT NOT NULL DEFAULT '',
  version_number INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_gen_questions_review ON ca_generated_questions(review_status, ca_date DESC);
CREATE INDEX IF NOT EXISTS idx_ca_gen_questions_cat ON ca_generated_questions(category_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_ca_gen_questions_hash ON ca_generated_questions(content_hash) WHERE content_hash <> '';

-- 9. Normalized Question Options
CREATE TABLE IF NOT EXISTS ca_question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES ca_generated_questions(id) ON DELETE CASCADE,
  option_label TEXT NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (question_id, option_label)
);

CREATE INDEX IF NOT EXISTS idx_ca_question_options_qid ON ca_question_options(question_id, sort_order);

-- 10. Question Provenance / Source Links
CREATE TABLE IF NOT EXISTS ca_question_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES ca_generated_questions(id) ON DELETE CASCADE,
  event_id UUID REFERENCES ca_events(id) ON DELETE SET NULL,
  article_id UUID REFERENCES ca_articles(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  publication_date TIMESTAMPTZ
);

-- 11. Practice Sets (Daily Quick/Standard/Complete/Advanced, Weekly, Monthly, Custom)
CREATE TABLE IF NOT EXISTS ca_practice_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  set_type TEXT NOT NULL DEFAULT 'daily_standard' CHECK (
    set_type IN ('daily_quick', 'daily_standard', 'daily_complete', 'daily_advanced', 'weekly', 'monthly', 'custom')
  ),
  date_from DATE NOT NULL DEFAULT CURRENT_DATE,
  date_to DATE NOT NULL DEFAULT CURRENT_DATE,
  instructions TEXT NOT NULL DEFAULT 'Read each question carefully. Each correct answer carries +1 mark and each wrong answer carries -0.25 negative marking unless specified otherwise.',
  total_questions INTEGER NOT NULL DEFAULT 0,
  total_marks NUMERIC(6, 2) NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 15 CHECK (duration_minutes >= 1 AND duration_minutes <= 240),
  marks_per_question NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
  negative_marking NUMERIC(4, 2) NOT NULL DEFAULT 0.25,
  difficulty_distribution JSONB NOT NULL DEFAULT '{"easy":30,"moderate":50,"difficult":20}'::jsonb,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_exams JSONB NOT NULL DEFAULT '[]'::jsonb,
  question_formats JSONB NOT NULL DEFAULT '[]'::jsonb,
  language TEXT NOT NULL DEFAULT 'English',
  access_tier TEXT NOT NULL DEFAULT 'free' CHECK (access_tier IN ('free', 'premium')),
  allow_retry BOOLEAN NOT NULL DEFAULT TRUE,
  publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    publication_status IN ('draft', 'published', 'unpublished', 'archived')
  ),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_practice_sets_pub ON ca_practice_sets(publication_status, date_to DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_ca_practice_sets_type ON ca_practice_sets(set_type, date_to DESC);

-- 12. Practice Set Questions Join Table
CREATE TABLE IF NOT EXISTS ca_practice_set_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_set_id UUID NOT NULL REFERENCES ca_practice_sets(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES ca_generated_questions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  marks NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
  UNIQUE (practice_set_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_ca_psq_set ON ca_practice_set_questions(practice_set_id, sort_order);

-- 13. Student Practice Attempts
CREATE TABLE IF NOT EXISTS ca_student_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_set_id UUID NOT NULL REFERENCES ca_practice_sets(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (
    status IN ('in_progress', 'submitted', 'auto_submitted')
  ),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  time_taken_sec INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  attempted_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  unattempted_count INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(7, 2) NOT NULL DEFAULT 0,
  max_score NUMERIC(7, 2) NOT NULL DEFAULT 0,
  accuracy_pct NUMERIC(5, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ca_student_attempts_student ON ca_student_attempts(student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ca_student_attempts_set ON ca_student_attempts(practice_set_id, status, score DESC);

-- 14. Student Per-Question Answers
CREATE TABLE IF NOT EXISTS ca_student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES ca_student_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES ca_generated_questions(id) ON DELETE CASCADE,
  selected_answer TEXT,
  is_marked_review BOOLEAN NOT NULL DEFAULT FALSE,
  is_correct BOOLEAN,
  marks_awarded NUMERIC(5, 2) NOT NULL DEFAULT 0,
  time_spent_sec INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_ca_student_answers_attempt ON ca_student_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_ca_student_answers_q_correct ON ca_student_answers(question_id, is_correct);

-- 15. PDF Exports Audit & Student Download History
CREATE TABLE IF NOT EXISTS ca_pdf_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_set_id UUID NOT NULL REFERENCES ca_practice_sets(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  pdf_format TEXT NOT NULL CHECK (
    pdf_format IN ('questions_only', 'answer_key', 'detailed_solutions', 'complete_booklet')
  ),
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  sha256_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_pdf_exports_student ON ca_pdf_exports(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ca_pdf_exports_set ON ca_pdf_exports(practice_set_id, pdf_format);

-- 16. Admin Editorial Review Audit Trail
CREATE TABLE IF NOT EXISTS ca_admin_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES ca_generated_questions(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'edited', 'regenerated', 'archived')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_admin_reviews_q ON ca_admin_reviews(question_id, created_at DESC);

-- 17. Admin Automation & AI Workflow Configuration (No secrets stored in DB!)
CREATE TABLE IF NOT EXISTS ca_automation_config (
  config_key TEXT PRIMARY KEY,
  automation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  daily_run_time_ist TEXT NOT NULL DEFAULT '06:30',
  min_relevance_score INTEGER NOT NULL DEFAULT 60 CHECK (min_relevance_score >= 0 AND min_relevance_score <= 100),
  default_questions_per_event INTEGER NOT NULL DEFAULT 2 CHECK (default_questions_per_event >= 1 AND default_questions_per_event <= 5),
  require_admin_approval BOOLEAN NOT NULL DEFAULT TRUE,
  default_target_exams JSONB NOT NULL DEFAULT '["IBPS PO","SBI PO","IBPS Clerk","SBI Clerk","IBPS RRB PO","IBPS RRB Clerk","RBI Assistant","RBI Grade B"]'::jsonb,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ca_automation_config (config_key) VALUES ('default') ON CONFLICT (config_key) DO NOTHING;
