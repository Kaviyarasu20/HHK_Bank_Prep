# HHK Phase 10 — Analytics, Performance Optimization & Production Readiness Handover

## 1. End-to-End Platform Dependency Map (Phases 1–10)
```
Approved RSS/Admin Source (Phase 2)
  → Current Affairs Article (Phase 3) + Banking Awareness Reference Hub (Phase 4)
    → AI Structuring & Banking Relevance Triage [Draft → Admin Approved] (Phase 5)
      → Exam-Wise MCQ Generation & Canonical Sync [questions.id] (Phase 6)
        → One-Liner Digest & Spaced-Repetition Flashcards (Phase 7)
          → Monthly Capsules [Relational Links] & Smart Revision Engine (Phase 8)
            → GA Marathon [mock_tests + CBT + Subscription Entitlements] (Phase 9)
              → Platform & Student Analytics + Operational Monitoring + Performance Indexes (Phase 10)
```

## 2. Analytics Metric Definitions & Integrity
- **Timezone Policy**: All database date-range aggregations normalize to `UTC` ISO-8601 boundaries.
- **Active Students (DAU / WAU / MAU)**: Distinct `student_id` with at least one recorded action in `test_attempts`, `practice_sessions`, `current_affairs_reads`, or `student_revision_history` in the trailing 1 / 7 / 30 days.
- **Financial Metrics**: Gross collected INR sums `payment_orders.total_amount_paise` strictly where `status = 'PAID'`. Failed, pending, cancelled orders, duplicate webhooks, and manual admin entitlement grants are excluded. Refunds (`refund_requests` with status `PROCESSED` / `APPROVED` / `REFUNDED`) are reported separately to compute net collected INR.
- **Weak Topics**: Enforces a minimum sample threshold of 5 answered questions (`selected_answer IS NOT NULL`) via `weakTopicAnalyzer.js`; unanswered questions are never counted as incorrect.

## 3. Performance & Indexing (`031_phase10_analytics_and_performance_indexes.sql`)
- Adds 8 composite immutable-column indexes on `users`, `test_attempts`, `student_answers`, `payment_orders`, `student_subscriptions`, `current_affairs_reads`, and `student_revision_history`.
- `SafeTtlCache` (`server/services/safeCacheService.js`) caches read-only admin analytics aggregates for 60s with explicit `POST /api/admin/analytics/cache/invalidate` and `?refresh=true` bypass. User-specific and subscription-sensitive endpoints are never cached in shared memory.

## 4. Operational Reliability & Monitoring
- **Request Correlation**: `requestCorrelationMiddleware` attaches `X-Request-Id` to every response and emits structured JSON logs (`method`, `path`, `status`, `durationMs`, `requestId`) while redacting sensitive keys (`password`, `token`, `secret`, `cookie`, `authorization`, `razorpay_signature`).
- **Health & Readiness**:
  - `GET /api/health` — liveness + DB ping (`SELECT 1`).
  - `GET /api/ready` — verifies DB connectivity, `SESSION_SECRET` length (`>= 32`), AI enabled flag, and Razorpay configuration status without exposing any secret values.

## 5. PostgreSQL Backup, Restore & Migration Rollback
- **Daily Logical Backup**:
  ```bash
  pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="hhk_backup_$(date -u +%Y%m%d_%H%M%S).dump"
  ```
- **Retention**: Keep 14 daily, 8 weekly, and 6 monthly encrypted off-host backups.
- **Restore Verification (Staging)**:
  ```bash
  pg_restore --clean --if-exists --no-owner --dbname="$STAGING_DATABASE_URL" hhk_backup_YYYYMMDD.dump
  ```
- **Migration Rollback**: Migrations `022`–`031` are strictly additive; never modify applied migrations. To recover from a failed deployment, restore the pre-migration snapshot taken before `npm run db:migrate`.

## 6. Production Release Checklist
1. Copy `.env.example` to `.env` and populate production `DATABASE_URL` (`DATABASE_SSL=true`), 32+ char `SESSION_SECRET`, `APP_URL` (HTTPS), Razorpay live keys + webhook secret, and `CA_AI_ENABLED` (`false` unless AI key configured).
2. Take a verified pre-release `pg_dump` backup.
3. Run `npm ci` (or `npm install --omit=dev`), `npm run db:migrate`, and `npm run build`.
4. Verify `GET /api/health` returns `200 { status: "ok" }` and `GET /api/ready` returns `200 { status: "ready" }`.
5. Run automated verification suites (`verify_phase2` through `verify_phase10` + `npm run test:exam-engine`).
6. Configure Razorpay production webhook pointing to `https://<domain>/api/payments/webhook`.
7. Execute smoke tests for student login, Current Affairs, GA Marathon CBT start/submit, subscription checkout, and Admin Platform Analytics.
