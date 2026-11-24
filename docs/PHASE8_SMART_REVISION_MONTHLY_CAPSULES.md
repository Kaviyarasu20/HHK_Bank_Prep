# HHK Phase 8 — Smart Revision & Monthly Capsules

## 1. Overview
Phase 8 extends the HHK Banking Exam Preparation Platform with two integrated revision modules built strictly on top of Phases 1–7 without duplicating existing content or modifying historical migrations (`001`–`028`):

1. **Module A — Smart Revision**: Aggregates real student learning signals (incorrect practice/mock answers excluding unanswered questions, weak topics with a minimum 5-attempt threshold, slow response times, bookmarked questions/articles/flashcards, overdue/difficult flashcards, and high-priority banking content) into a deterministic daily revision queue and 6-stage spaced-revision schedule.
2. **Module B — Monthly Capsules**: Structured monthly current affairs & banking awareness digests that link relationally to approved/published HHK content (articles, one-liners, MCQs, flashcards, banking references) with publication safeguards, optional draft-only AI summary assistance, admin editorial controls, and student section-level progress/resume tracking.

## 2. Database Schema (`029_smart_revision_monthly_capsules.sql`)
11 additive tables with plain immutable column indexes (PostgreSQL `42P17` safe):
- **Smart Revision**: `student_revision_preferences`, `student_revision_items`, `student_revision_history`, `student_weak_topics`, `student_daily_revision_plans`.
- **Monthly Capsules**: `monthly_capsules`, `monthly_capsule_sections`, `monthly_capsule_content_links`, `monthly_capsule_exam_tags`, `student_monthly_capsule_progress`, `student_monthly_capsule_section_progress`.

## 3. Backend Architecture
- **Smart Revision Services**: `revisionPriorityCalculator.js`, `revisionScheduler.js` (reuses Phase 7 `caFlashcardReviewScheduler.js`), `weakTopicAnalyzer.js`, `revisionRecommendationService.js`, `smartRevisionEngine.js` (reuses `milestones.js`).
- **Monthly Capsule Services**: `monthlyCapsuleValidator.js`, `monthlyCapsuleGenerator.js` (reuses Phase 5 `caAiProvider.js` strictly as draft-only), `monthlyCapsuleProgressService.js`, `monthlyCapsuleService.js`.
- **Routers**:
  - `GET/POST/PUT /api/smart-revision/*` (`smartRevisionStudent.js`, `requireAuth`)
  - `GET/POST /api/monthly-capsules/*` (`monthlyCapsulesStudent.js`, `requireAuth`, published-only)
  - `GET/POST/PATCH/PUT/DELETE /api/admin/monthly-capsules/*` (`monthlyCapsulesAdmin.js`, `requireAdmin`, `audit()`, rate-limited generation)

## 4. Frontend Components
- API client: `client/src/api/phase8RevisionCapsules.js`
- Student UI: `SmartRevisionDashboard.jsx` and `MonthlyCapsules.jsx` integrated into `StudentCurrentAffairs.jsx` hub switcher.
- Admin UI: `MonthlyCapsuleAdmin.jsx` integrated into `CurrentAffairsView.jsx` sub-tabs.

## 5. Verification
Run:
```bash
npm run db:migrate
node tests/verify_phase8_smart_revision_capsules.js
```
