-- ============================================================================
-- DEPRECATED REFERENCE SNAPSHOT — DO NOT EXECUTE AGAINST EXISTING DATABASES
-- Authoritative schema is maintained via incremental migrations in:
--   server/migrations/001_initial.sql .. 022_current_affairs_master_module.sql
-- Apply schema changes exclusively using: npm run db:migrate
-- ============================================================================

-- HHK Banking Exam Platform PostgreSQL Schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  mobile TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Public Sector Banks',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  pattern_cycle TEXT,
  pattern_source_url TEXT,
  pattern_verified_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration_seconds INT NOT NULL DEFAULT 3600,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exam_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES exam_stages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  question_count INT NOT NULL DEFAULT 35,
  duration_seconds INT,
  marks_per_correct NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  negative_marks NUMERIC(5,2) NOT NULL DEFAULT 0.25,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES exam_sections(id) ON DELETE CASCADE,
  parent_topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  UNIQUE(section_id, name)
);

CREATE TABLE IF NOT EXISTS passage_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES exam_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passage_text TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'English',
  image_url TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES exam_sections(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  topic_name TEXT NOT NULL,
  subtopic_name TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_type TEXT NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq', 'passage', 'image', 'numeric', 'descriptive')),
  language TEXT NOT NULL DEFAULT 'English',
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT NOT NULL DEFAULT 'A',
  explanation TEXT NOT NULL DEFAULT '',
  marks NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  negative_marks NUMERIC(5,2) NOT NULL DEFAULT 0.25,
  source TEXT NOT NULL DEFAULT '',
  source_year INT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  image_url TEXT,
  passage_group_id UUID REFERENCES passage_groups(id) ON DELETE SET NULL,
  content_hash TEXT UNIQUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
