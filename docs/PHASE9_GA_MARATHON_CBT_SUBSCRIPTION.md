# HHK Phase 9 — GA Marathon & CBT / Subscription Integration

## 1. Architecture Overview
Phase 9 integrates General Awareness & Banking Awareness testing directly into HHK's existing Computer-Based Test (CBT) engine and Subscription/Entitlement system without creating any duplicate CBT engine, question bank, payment gateway, or subscription tables:

- **CBT Reuse**: Every GA Marathon test is stored as a first-class row in `mock_tests` (`test_type = 'GA_MARATHON'`) paired with a 1-to-1 extension row in `ga_marathon_configs`. Attempts run through `server/routes/attempts.js` (`test_attempts`, immutable `student_answers.question_snapshot`, server-side `scoreAttempt`, `advanceAttempt` timer auto-submit, `leaderboard_records`, `recordStudyDay`, `syncMilestones`) and the existing frontend `ExamInstructionsView.jsx` + `TestRunner.jsx`.
- **Subscription & Payment Reuse**: Entitlement evaluation runs through `server/services/testAccess.js` (`evaluateTestAccess`) + `gaEntitlementService.js` (`checkGaTestEligibility` adding attempt-limit checks and cancelled-within-paid-period support), with `CheckoutModal.jsx` and `server/routes/payments.js` (Razorpay server-side verification + idempotent HMAC-SHA256 webhooks) handling purchases/upgrades.
- **Canonical Question Bank Reuse**: GA Marathon tests assign approved Phase 6 MCQs (`current_affairs_generated_questions.review_status = 'approved'`) already synced to canonical `questions` (`status = 'published'`) via `mock_test_questions` and link source learning entities via `ga_marathon_question_links`.

## 2. HHK Practice Tests vs Official Examination Papers
`ga_marathon_configs.is_official_pattern` defaults to `FALSE`. Unless an administrator explicitly configures a verified official examination pattern, GA Marathon tests are clearly labeled as **HHK Practice Tests** and never fabricate official examination question counts, marks, or negative marking rules.

## 3. Database Migration (`030_ga_marathon_integration.sql`)
- Extends `mock_tests_test_type_check` and `mock_tests_mode_fields_check` to permit `test_type = 'GA_MARATHON'`.
- Adds `ga_marathon_configs` (category, target exams, official-pattern flag, optional `capsule_id`, `attempt_limit`, randomization flags, `answer_release_policy`, `answer_release_at`, distributions, filters).
- Adds `ga_marathon_question_links` (maps `mock_test_id` + `question_id` back to `generated_question_id`, `source_article_id`, `source_reference_type`, `source_reference_id`, `ga_domain`).

## 4. Answer-Release Policy & Scoring
- Scoring is strictly server-side (`attempts.js` `scoreAttempt`) using immutable `question_snapshot` marks and negative marks.
- `gaResultAnalysisService.js` enforces `immediate`, `scheduled`, `after_end`, and `never` answer-release policies and redacts `correctAnswer`, `isCorrect`, and `explanation` whenever release is not yet permitted.

## 5. API Endpoints
- **Student (`/api/ga-marathon`, `requireAuth`)**: `GET /dashboard`, `GET /tests`, `GET /tests/:testId/eligibility`, `GET /attempts/:attemptId/result` (plus existing CBT endpoints `/api/tests/:testId/access`, `POST /api/tests/:testId/attempts`, `PUT /api/attempts/:attemptId/answers`, `POST /api/attempts/:attemptId/submit`).
- **Admin (`/api/admin/ga-marathon`, `requireAdmin`, audited)**: `GET /metadata`, `GET /tests`, `GET /tests/:testId`, `POST /tests`, `POST /tests/:testId/select-questions`, `POST /tests/:testId/status`, `GET /tests/:testId/attempts`.

## 6. Verification Commands
```bash
npm run db:migrate
node tests/verify_phase9_ga_marathon.js
```
