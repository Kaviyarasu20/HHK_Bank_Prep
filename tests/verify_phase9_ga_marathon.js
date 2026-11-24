import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  GA_MARATHON_CATEGORIES,
  GA_SUPPORTED_EXAMS,
  validateGaTestConfig,
} from "../server/services/gaTestConfigurationService.js";
import {
  isQuestionEligibleForGaTest,
  selectQuestionsForGaTest,
} from "../server/services/gaQuestionSelectionService.js";
import {
  checkGaTestEligibility,
  evaluateSubscriptionStateForPeriod,
} from "../server/services/gaEntitlementService.js";
import {
  buildGaResultAnalysis,
  canReleaseAnswers,
} from "../server/services/gaResultAnalysisService.js";
import { rankRecommendedGaTests } from "../server/services/gaPerformanceService.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err?.stack || err}`);
    failed += 1;
  }
}

console.log("=== HHK Phase 9: GA Marathon & CBT / Subscription Integration — Verification ===\n");

await test("1. GA test configuration validates 10 categories, 8 exams, pricing, negative marks, and release policies", () => {
  assert.equal(GA_MARATHON_CATEGORIES.length, 10);
  assert.equal(GA_SUPPORTED_EXAMS.length, 8);

  const bad = validateGaTestConfig({
    title: "Hi",
    gaCategory: "invalid_cat",
    targetExams: ["UNKNOWN EXAM"],
    questionCount: 0,
    durationMinutes: 0,
    marksPerQuestion: 1,
    negativeMarks: 2,
    accessType: "PAID",
    pricePaise: 0,
    answerReleasePolicy: "scheduled",
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 7);

  const good = validateGaTestConfig({
    title: "November Banking Awareness Marathon",
    gaCategory: "banking_awareness",
    targetExams: ["IBPS PO", "SBI PO", "NABARD Grade A"],
    questionCount: 25,
    durationMinutes: 20,
    marksPerQuestion: 1,
    negativeMarks: 0.25,
    attemptLimit: 2,
    accessType: "SUBSCRIPTION_ONLY",
    answerReleasePolicy: "immediate",
  });
  assert.equal(good.ok, true);
  assert.equal(good.normalized.isOfficialPattern, false);
  assert.equal(good.normalized.durationSeconds, 1200);
  assert.equal(good.normalized.maxMarks, 25);
});

await test("2. Question eligibility & selector exclude unapproved/duplicates, enforce distributions, and report shortages", () => {
  assert.equal(isQuestionEligibleForGaTest({ review_status: "draft" }).eligible, false);
  assert.equal(isQuestionEligibleForGaTest({ review_status: "approved", status: "draft" }).eligible, false);
  assert.equal(isQuestionEligibleForGaTest({ review_status: "approved", status: "published", duplicate_status: "near_duplicate" }).eligible, false);

  const makeQ = (id, topic, difficulty) => ({
    canonical_question_id: id,
    review_status: "approved",
    status: "published",
    duplicate_status: "unique",
    validation_status: "passed",
    topic,
    difficulty,
    options: [{ key: "A", text: "1" }, { key: "B", text: "2" }, { key: "C", text: "3" }, { key: "D", text: "4" }],
    correct_answer: "A",
  });

  const pool = [
    makeQ("q1", "RBI Policy", "Easy"),
    makeQ("q2", "RBI Policy", "Moderate"),
    makeQ("q3", "Schemes", "Moderate"),
    makeQ("q4", "Schemes", "Difficult"),
    makeQ("q4", "Schemes", "Difficult"), // duplicate ID should be deduplicated
  ];

  const okSel = selectQuestionsForGaTest({
    pool,
    targetCount: 3,
    topicDistribution: { "RBI Policy": 1, Schemes: 2 },
    recentlyUsedIds: new Set(["q1"]),
  });
  assert.equal(okSel.ok, true);
  assert.equal(okSel.selected.length, 3);
  assert.equal(okSel.selected[0]._qid, "q2"); // prefers non-recently-used q2 over q1

  const shortage = selectQuestionsForGaTest({ pool, targetCount: 10 });
  assert.equal(shortage.ok, false);
  assert.ok(shortage.errors[0].includes("Insufficient approved questions"));
});

await test("3. Subscription period evaluation & attempt-limit entitlement checks work accurately", async () => {
  const now = new Date("2026-11-24T12:00:00.000Z");
  assert.equal(
    evaluateSubscriptionStateForPeriod({ status: "ACTIVE", expires_at: "2026-12-01T00:00:00.000Z" }, now).active,
    true,
  );
  assert.equal(
    evaluateSubscriptionStateForPeriod({ status: "CANCELLED", expires_at: "2026-12-01T00:00:00.000Z" }, now).active,
    true,
  );
  assert.equal(
    evaluateSubscriptionStateForPeriod({ status: "EXPIRED", expires_at: "2026-11-01T00:00:00.000Z" }, now).active,
    false,
  );

  // Mock DB for checkGaTestEligibility testing FREE test hitting attempt_limit = 1
  const mockDb = {
    async query(sql) {
      if (sql.includes("FROM mock_tests t")) {
        return {
          rowCount: 1,
          rows: [{
            id: "t1", name: "Daily GA", status: "published", test_type: "GA_MARATHON",
            is_visible: true, access_type: "FREE", availability_start: null, availability_end: null,
          }],
        };
      }
      if (sql.includes("FROM ga_marathon_configs")) {
        return { rowCount: 1, rows: [{ attempt_limit: 1 }] };
      }
      if (sql.includes("FROM test_attempts")) {
        return { rowCount: 1, rows: [{ cnt: 1 }] };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  const blocked = await checkGaTestEligibility({ db: mockDb, userId: "u1", userRole: "student", testId: "t1" });
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.access.code, "ATTEMPT_LIMIT_REACHED");
});

await test("4. Answer-release policy protects correct answers before release and computes accurate breakdowns when released", () => {
  const now = new Date("2026-11-24T12:00:00.000Z");
  assert.equal(canReleaseAnswers({ policy: "immediate", attemptStatus: "in_progress", now }).allowed, false);
  assert.equal(canReleaseAnswers({ policy: "never", attemptStatus: "submitted", now }).allowed, false);
  assert.equal(
    canReleaseAnswers({ policy: "scheduled", answerReleaseAt: "2026-11-25T00:00:00.000Z", attemptStatus: "submitted", now }).allowed,
    false,
  );
  assert.equal(
    canReleaseAnswers({ policy: "scheduled", answerReleaseAt: "2026-11-23T00:00:00.000Z", attemptStatus: "submitted", now }).allowed,
    true,
  );

  const attempt = {
    id: "att1", mock_test_id: "t1", test_name: "GA Test 1", status: "submitted",
    score: 0.75, max_score: 2, correct_count: 1, wrong_count: 1, unanswered_count: 0, elapsed_seconds: 120,
  };
  const answers = [
    {
      question_id: "q1", selected_answer: "A", time_spent_seconds: 50, ga_domain: "banking_awareness",
      question_snapshot: { question_text: "Repo rate?", topic_name: "RBI Policy", difficulty: "Easy", correct_answer: "A", explanation: "RBI sets it.", marks: 1, negative_marks: 0.25 },
    },
    {
      question_id: "q2", selected_answer: "B", time_spent_seconds: 70, ga_domain: "current_affairs",
      question_snapshot: { question_text: "Summit host?", topic_name: "Summits", difficulty: "Moderate", correct_answer: "C", explanation: "Hosted in India.", marks: 1, negative_marks: 0.25 },
    },
  ];

  // Locked policy redacts answers & explanations
  const locked = buildGaResultAnalysis({ attempt, answers, releasePolicy: { policy: "never" }, now });
  assert.equal(locked.answerRelease.allowed, false);
  assert.equal(locked.review[0].correctAnswer, null);
  assert.equal(locked.review[0].explanation, null);

  // Immediate policy reveals answers, computes negative marks & weak-topic recommendations
  const open = buildGaResultAnalysis({ attempt, answers, releasePolicy: { policy: "immediate" }, now });
  assert.equal(open.answerRelease.allowed, true);
  assert.equal(open.summary.negativeMarksDeducted, 0.25);
  assert.equal(open.review[0].correctAnswer, "A");
  assert.equal(open.topicBreakdown.length, 2);
  assert.equal(open.recommendations.length, 1);
  assert.equal(open.recommendations[0].topic, "Summits");
});

await test("5. Deterministic GA test recommendations rank exam & weak-topic matches first", () => {
  const ranked = rankRecommendedGaTests({
    targetExams: ["IBPS PO"],
    weakTopics: ["banking"],
    attemptedTestIds: new Set(["t2"]),
    tests: [
      { id: "t1", name: "Banking Awareness Drill", ga_category: "banking_awareness", target_exams: ["IBPS PO"], has_access: true },
      { id: "t2", name: "Sports Recap", ga_category: "current_affairs", target_exams: ["SBI Clerk"], has_access: true },
    ],
  });
  assert.equal(ranked[0].id, "t1");
  assert.ok(ranked[0].recommendation_reason.includes("IBPS PO"));
});

await test("6. Migration 030 is additive, supports GA_MARATHON, and uses plain immutable indexes", () => {
  const sql = fs.readFileSync(path.join(root, "server/migrations/030_ga_marathon_integration.sql"), "utf8");
  assert.ok(!/\bDROP\s+TABLE\b/i.test(sql));
  assert.ok(!/\bTRUNCATE\b/i.test(sql));
  assert.ok(!/::date/i.test(sql));
  assert.ok(sql.includes("'GA_MARATHON'"));
  assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS ga_marathon_configs"));
  assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS ga_marathon_question_links"));
});

await test("7. CBT engine, entitlement engine, routers, and frontend hubs are integrated cleanly", () => {
  const ta = fs.readFileSync(path.join(root, "server/services/testAccess.js"), "utf8");
  const att = fs.readFileSync(path.join(root, "server/routes/attempts.js"), "utf8");
  const idx = fs.readFileSync(path.join(root, "server/index.js"), "utf8");
  const sw = fs.readFileSync(path.join(root, "client/src/StudentWorkspace.jsx"), "utf8");
  const sca = fs.readFileSync(path.join(root, "client/src/components/student/StudentCurrentAffairs.jsx"), "utf8");
  const cav = fs.readFileSync(path.join(root, "client/src/components/admin/CurrentAffairsView.jsx"), "utf8");

  assert.ok(ta.includes("GA_MARATHON"));
  assert.ok(att.includes("GA_MARATHON"));
  assert.ok(att.includes("ATTEMPT_LIMIT_REACHED"));
  assert.ok(idx.includes("/api/ga-marathon"));
  assert.ok(idx.includes("/api/admin/ga-marathon"));
  assert.ok(sw.includes("onStartGaTest={handleSelectMockTest}"));
  assert.ok(sca.includes("GAMarathonDashboard"));
  assert.ok(cav.includes("GAMarathonAdmin"));
});

console.log(`\nPhase 9 verification summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
