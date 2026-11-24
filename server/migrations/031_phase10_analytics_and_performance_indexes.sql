-- Phase 10: Analytics & Performance Optimization Indexes
-- Strictly additive migration. Preserves all existing tables and historical migrations (001-030).
-- All indexes use plain immutable column expressions (PostgreSQL 42P17 safe).

CREATE INDEX IF NOT EXISTS idx_users_role_created_at
  ON users (role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_attempts_student_status_submitted
  ON test_attempts (student_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_attempts_test_status_score
  ON test_attempts (mock_test_id, status, score DESC);

CREATE INDEX IF NOT EXISTS idx_student_answers_attempt_question
  ON student_answers (attempt_id, question_id);

CREATE INDEX IF NOT EXISTS idx_payment_orders_status_created
  ON payment_orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_subs_status_expires
  ON student_subscriptions (status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_ca_reads_affair_read_bookmarked
  ON current_affairs_reads (affair_id, is_read, is_bookmarked);

CREATE INDEX IF NOT EXISTS idx_revision_history_student_reviewed
  ON student_revision_history (student_id, reviewed_at DESC);
