-- Migration 016: Multi-Set Topicwise Tests & Exam Wise Tests
-- Extends mock_tests to support both full-length Exam Wise tests (multiple sets per exam/stage)
-- and single-topic Topicwise tests (multiple sets per subject/topic) while preserving all existing tests.

-- 1. Allow exam_id and stage_id to be NULL for TOPIC_WISE tests (EXAM_WISE tests still require them via CHECK)
ALTER TABLE mock_tests
  ALTER COLUMN exam_id DROP NOT NULL,
  ALTER COLUMN stage_id DROP NOT NULL;

-- 2. Add multi-set and topicwise columns cleanly
ALTER TABLE mock_tests
  ADD COLUMN IF NOT EXISTS test_type TEXT NOT NULL DEFAULT 'EXAM_WISE',
  ADD COLUMN IF NOT EXISTS set_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS set_label TEXT NOT NULL DEFAULT 'Set 1',
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS target_questions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marks_per_question NUMERIC(8,3) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS negative_marks NUMERIC(8,3) NOT NULL DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. Add integrity constraints (idempotent via DROP CONSTRAINT IF EXISTS)
ALTER TABLE mock_tests DROP CONSTRAINT IF EXISTS mock_tests_test_type_check;
ALTER TABLE mock_tests
  ADD CONSTRAINT mock_tests_test_type_check
  CHECK (test_type IN ('EXAM_WISE', 'TOPIC_WISE'));

ALTER TABLE mock_tests DROP CONSTRAINT IF EXISTS mock_tests_set_number_check;
ALTER TABLE mock_tests
  ADD CONSTRAINT mock_tests_set_number_check
  CHECK (set_number > 0);

ALTER TABLE mock_tests DROP CONSTRAINT IF EXISTS mock_tests_target_questions_check;
ALTER TABLE mock_tests
  ADD CONSTRAINT mock_tests_target_questions_check
  CHECK (target_questions >= 0);

ALTER TABLE mock_tests DROP CONSTRAINT IF EXISTS mock_tests_marks_check;
ALTER TABLE mock_tests
  ADD CONSTRAINT mock_tests_marks_check
  CHECK (marks_per_question >= 0 AND negative_marks >= 0);

ALTER TABLE mock_tests DROP CONSTRAINT IF EXISTS mock_tests_mode_fields_check;
ALTER TABLE mock_tests
  ADD CONSTRAINT mock_tests_mode_fields_check
  CHECK (
    (test_type = 'EXAM_WISE' AND exam_id IS NOT NULL AND stage_id IS NOT NULL AND subject IS NULL AND topic IS NULL)
    OR
    (test_type = 'TOPIC_WISE' AND subject IS NOT NULL AND btrim(subject) <> '' AND topic IS NOT NULL AND btrim(topic) <> '')
  );

-- 4. Backfill existing Exam Wise rows with accurate set_number, set_label, and target_questions
WITH stage_totals AS (
  SELECT stage_id, COALESCE(SUM(question_count), 0)::int AS total_q
  FROM exam_sections
  GROUP BY stage_id
),
ranked_existing AS (
  SELECT
    t.id,
    ROW_NUMBER() OVER (
      PARTITION BY t.exam_id, t.stage_id
      ORDER BY t.auto_generated ASC, t.created_at ASC, t.id ASC
    )::int AS computed_set_num,
    COALESCE(st.total_q, (SELECT count(*)::int FROM mock_test_questions mtq WHERE mtq.mock_test_id = t.id), 0) AS computed_target
  FROM mock_tests t
  LEFT JOIN stage_totals st ON st.stage_id = t.stage_id
  WHERE t.test_type = 'EXAM_WISE'
)
UPDATE mock_tests t
SET
  set_number = CASE WHEN t.set_number = 1 THEN r.computed_set_num ELSE t.set_number END,
  set_label = CASE WHEN t.set_label = 'Set 1' THEN 'Set ' || r.computed_set_num ELSE t.set_label END,
  target_questions = CASE WHEN t.target_questions = 0 THEN r.computed_target ELSE t.target_questions END
FROM ranked_existing r
WHERE t.id = r.id;

-- 5. Performance indexes for multi-set listing & student filtering
CREATE INDEX IF NOT EXISTS idx_mock_tests_type_status_set
  ON mock_tests(test_type, status, set_number);

CREATE INDEX IF NOT EXISTS idx_mock_tests_topic_sets
  ON mock_tests(subject, topic, set_number)
  WHERE test_type = 'TOPIC_WISE';

CREATE INDEX IF NOT EXISTS idx_mock_tests_exam_stage_sets
  ON mock_tests(exam_id, stage_id, set_number)
  WHERE test_type = 'EXAM_WISE';
