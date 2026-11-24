-- Migration 018: Intelligent Exam-Wise Mock Test Creator
-- Safely extends existing HHK tables (exams, exam_stages, exam_sections, questions, mock_tests)
-- with versioned data-driven exam patterns, section topic/difficulty distribution rules,
-- subject generator registry metadata, and question fingerprinting for repetition control.

-- 1. Versioned Exam Pattern Configuration (linked to existing exams & exam_stages)
CREATE TABLE IF NOT EXISTS exam_pattern_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES exam_stages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1 CHECK (version_number > 0),
  version_label TEXT NOT NULL DEFAULT 'v1',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  total_questions INTEGER NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  total_marks NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (total_marks >= 0),
  duration_seconds INTEGER NOT NULL DEFAULT 3600 CHECK (duration_seconds > 0),
  negative_marking_ratio NUMERIC(6,4) NOT NULL DEFAULT 0.25 CHECK (negative_marking_ratio >= 0 AND negative_marking_ratio <= 1),
  sectional_timing_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  option_count INTEGER NOT NULL DEFAULT 5 CHECK (option_count BETWEEN 2 AND 8),
  shortage_policy TEXT NOT NULL DEFAULT 'FAIL_STRICT'
    CHECK (shortage_policy IN ('FAIL_STRICT', 'USE_BANK_FALLBACK', 'ALLOW_PARTIAL_DRAFT')),
  repetition_policy JSONB NOT NULL DEFAULT '{"withinTest":"STRICT_NO_DUPLICATES","recentTestsWindow":5,"globalPolicy":"ALLOW_AFTER_WINDOW"}'::jsonb,
  source_notes TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, stage_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_exam_pattern_versions_active
  ON exam_pattern_versions(exam_id, stage_id, is_active);

-- 2. Section-level Topic & Difficulty Distribution Rules per Pattern Version
CREATE TABLE IF NOT EXISTS exam_pattern_section_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_version_id UUID NOT NULL REFERENCES exam_pattern_versions(id) ON DELETE CASCADE,
  section_id UUID REFERENCES exam_sections(id) ON DELETE SET NULL,
  section_name TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 0 CHECK (question_count >= 0),
  marks_per_question NUMERIC(6,3) NOT NULL DEFAULT 1.000 CHECK (marks_per_question >= 0),
  negative_marks NUMERIC(6,3) NOT NULL DEFAULT 0.250 CHECK (negative_marks >= 0),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  difficulty_distribution JSONB NOT NULL DEFAULT '{"easy":30,"medium":50,"hard":20}'::jsonb,
  topic_distributions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pattern_section_rules_version
  ON exam_pattern_section_rules(pattern_version_id, sort_order);

-- 3. Persistent Subject Generator Registry Metadata
CREATE TABLE IF NOT EXISTS question_generator_registry (
  subject_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNAVAILABLE'
    CHECK (status IN ('ACTIVE', 'PLANNED', 'UNAVAILABLE')),
  engine_version TEXT NOT NULL DEFAULT '1.0.0',
  supported_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed honest initial registry status (ONLY Quantitative Aptitude is ACTIVE)
INSERT INTO question_generator_registry (subject_key, display_name, status, engine_version, notes)
VALUES
  ('quant', 'Quantitative Aptitude', 'ACTIVE', '2.0.0', 'Backed by modular HHK Question Engine (20 verified Quant topic generators).'),
  ('reasoning', 'Reasoning Ability', 'UNAVAILABLE', '0.0.0', 'Planned future subject generator. Not yet integrated.'),
  ('english', 'English Language', 'UNAVAILABLE', '0.0.0', 'Planned future subject generator. Not yet integrated.'),
  ('general_awareness', 'General Awareness', 'UNAVAILABLE', '0.0.0', 'Planned future subject generator. Not yet integrated.'),
  ('computer_knowledge', 'Computer Knowledge', 'UNAVAILABLE', '0.0.0', 'Planned future subject generator. Not yet integrated.')
ON CONFLICT (subject_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  updated_at = now();

-- 4. Safely extend questions table with mathematical/structural fingerprint for deduplication
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_questions_fingerprint
  ON questions(fingerprint)
  WHERE fingerprint IS NOT NULL;

-- 5. Safely extend mock_tests with pattern version linkage, generation audit report, and repetition policy
ALTER TABLE mock_tests
  ADD COLUMN IF NOT EXISTS pattern_version_id UUID REFERENCES exam_pattern_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS repetition_policy JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Allow 'intelligent_engine' as a valid selection_mode alongside existing 'manual' and 'rule_based'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mock_tests_selection_mode_check'
  ) THEN
    ALTER TABLE mock_tests DROP CONSTRAINT mock_tests_selection_mode_check;
  END IF;
  ALTER TABLE mock_tests
    ADD CONSTRAINT mock_tests_selection_mode_check
    CHECK (selection_mode IN ('manual', 'rule_based', 'intelligent_engine'));
EXCEPTION
  WHEN undefined_column THEN NULL;
END $$;
