import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  calculateRevisionPriority,
  DEFAULT_SIGNAL_WEIGHTS,
} from "../server/services/revisionPriorityCalculator.js";
import {
  REVISION_STAGE_INTERVALS_DAYS,
  scheduleNextRevision,
} from "../server/services/revisionScheduler.js";
import { analyzeWeakTopics } from "../server/services/weakTopicAnalyzer.js";
import { buildDailyRevisionPlan } from "../server/services/revisionRecommendationService.js";
import { validateMonthlyCapsuleForPublish } from "../server/services/monthlyCapsuleValidator.js";
import {
  buildCapsuleDraftPlan,
  formatMonthYearTitle,
  generateAiCapsuleDraftIntro,
} from "../server/services/monthlyCapsuleGenerator.js";
import { computeCapsuleCompletion } from "../server/services/monthlyCapsuleProgressService.js";

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

console.log("=== HHK Phase 8: Smart Revision & Monthly Capsules — Automated Verification ===\n");

await test("1. Priority calculator applies transparent weights, bounds 0-100, and builds reasons", () => {
  const high = calculateRevisionPriority({
    repeatedIncorrect: true,
    lowTopicAccuracy: true,
    overdueFlashcard: true,
    difficultFlashcard: true,
    bookmarked: true,
    highPriorityBanking: true,
    slowResponse: true,
  });
  assert.equal(high.priorityScore, 100);
  assert.equal(high.priorityLevel, "must_study");
  assert.ok(high.reason.includes("Repeated incorrect answers"));
  assert.ok(high.reason.includes("Weak topic performance"));

  const low = calculateRevisionPriority({ slowResponse: true });
  assert.equal(low.priorityScore, DEFAULT_SIGNAL_WEIGHTS.slow_response);
  assert.equal(low.priorityLevel, "additional");

  const custom = calculateRevisionPriority({ bookmarked: true }, { bookmarked: 45 });
  assert.equal(custom.priorityScore, 45);
  assert.equal(custom.priorityLevel, "must_study");
});

await test("2. Spaced revision scheduler advances 6 stages & reuses Phase 7 flashcard scheduler", () => {
  assert.deepEqual(REVISION_STAGE_INTERVALS_DAYS, [0, 1, 3, 7, 15, 30]);
  const now = new Date("2026-11-24T10:00:00.000Z");

  const s1 = scheduleNextRevision({ contentType: "article", outcome: "good", currentStage: 0, now });
  assert.equal(s1.nextStage, 1);
  assert.equal(s1.nextIntervalDays, 1);
  assert.equal(s1.revisionState, "reviewed");

  const again = scheduleNextRevision({ contentType: "article", outcome: "again", currentStage: 3, now });
  assert.equal(again.nextStage, 0);
  assert.equal(again.nextIntervalDays, 0);
  assert.equal(again.revisionState, "needs_improvement");

  const mastered = scheduleNextRevision({ contentType: "article", outcome: "good", currentStage: 4, now });
  assert.equal(mastered.nextStage, 5);
  assert.equal(mastered.nextIntervalDays, 30);
  assert.equal(mastered.revisionState, "mastered");

  // Flashcard delegates to Phase 7 computeNextFlashcardReview
  const fc = scheduleNextRevision({
    contentType: "flashcard",
    outcome: "good",
    currentStage: 1,
    previousIntervalDays: 3,
    successfulReviews: 2,
    now,
  });
  assert.ok(fc.nextIntervalDays >= 1);
  assert.ok(new Date(fc.nextDueAt) > now);
});

await test("3. Weak topic analyzer enforces minAttempts=5 threshold and factual explanations", () => {
  const results = analyzeWeakTopics([
    { topic_name: "Tiny Sample", attempts_count: 3, incorrect_count: 3, avg_response_seconds: 90 },
    { topic_name: "Strong Topic", attempts_count: 10, incorrect_count: 1, avg_response_seconds: 30 },
    { topic_name: "Monetary Policy", attempts_count: 10, incorrect_count: 6, avg_response_seconds: 85 },
    { topic_name: "Slow But Accurate", attempts_count: 8, incorrect_count: 1, avg_response_seconds: 90 },
  ]);

  assert.equal(results.length, 2);
  assert.equal(results[0].topicName, "Monetary Policy");
  assert.equal(results[0].accuracyPercent, 40);
  assert.ok(results[0].explanation.includes("6 of 10"));
  assert.equal(results[1].topicName, "Slow But Accurate");
  assert.equal(results[1].isSlow, true);
});

await test("4. Daily revision plan deduplicates, sorts deterministically, respects limit, and never invents items", () => {
  const empty = buildDailyRevisionPlan({ candidates: [], dailyLimit: 10 });
  assert.equal(empty.totalItems, 0);
  assert.deepEqual(empty.items, []);

  const now = new Date("2026-11-24T10:00:00.000Z");
  const plan = buildDailyRevisionPlan({
    dailyLimit: 3,
    now,
    candidates: [
      { contentType: "article", contentId: "a1", title: "Art 1", signals: { bookmarked: true } },
      { contentType: "article", contentId: "a1", title: "Art 1 dup", signals: { bookmarked: true, lowTopicAccuracy: true } },
      { contentType: "mcq", contentId: "q1", title: "MCQ 1", signals: { repeatedIncorrect: true, lowTopicAccuracy: true } },
      { contentType: "flashcard", contentId: "f1", title: "FC 1", signals: { overdueFlashcard: true, difficultFlashcard: true } },
      { contentType: "one_liner", contentId: "o1", title: "OL 1", signals: { highPriorityBanking: true } },
    ],
  });
  assert.equal(plan.totalItems, 3);
  assert.equal(plan.totalCandidates, 4); // deduplicated a1
  assert.equal(plan.items[0].contentId, "q1"); // score 45 highest
  assert.ok(plan.totalEstimatedMinutes > 0);
});

await test("5. Monthly capsule validator blocks empty sections, invalid URLs, bad exams, and unapproved links", () => {
  const bad = validateMonthlyCapsuleForPublish({
    capsule: { title: "Hi", capsule_year: 2026, capsule_month: 13 },
    sections: [],
    links: [{ content_type: "article", source_url: "javascript:alert(1)" }],
    examTags: ["FAKE EXAM"],
    unapprovedLinks: [{ content_type: "article", content_id: "x" }],
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.status, "failed");
  assert.ok(bad.errors.length >= 5);

  const good = validateMonthlyCapsuleForPublish({
    capsule: { title: "November 2026 Banking Capsule", capsule_year: 2026, capsule_month: 11 },
    sections: [{ id: "s1", title: "Highlights" }],
    links: [{ content_type: "article", content_id: "a1", source_url: "https://rbi.org.in/press" }],
    examTags: ["IBPS PO", "SBI PO"],
    unapprovedLinks: [],
  });
  assert.equal(good.ok, true);
  assert.equal(good.status, "passed");
});

await test("6. Monthly capsule generator builds relational sections and safely falls back when AI disabled", async () => {
  assert.equal(formatMonthYearTitle(2026, 11), "November 2026 Banking & Current Affairs Capsule");
  const plan = buildCapsuleDraftPlan({
    year: 2026,
    month: 11,
    candidates: {
      articles: [{ content_type: "article", content_id: "a1", source_url: "https://rbi.org.in" }],
      oneLiners: [{ content_type: "one_liner", content_id: "o1" }],
      flashcards: [],
      mcqs: [],
      bankingReferences: [],
    },
  });
  assert.equal(plan.sections.length, 2);
  assert.equal(plan.sections[0].links[0].content_id, "a1");

  const aiFallback = await generateAiCapsuleDraftIntro({
    year: 2026,
    month: 11,
    sectionTitles: ["Key Current Affairs Highlights"],
    totalItems: 2,
    env: { CA_AI_ENABLED: "false" },
  });
  assert.equal(aiFallback.usedAi, false);
  assert.ok(aiFallback.description.includes("November 2026"));
});

await test("7. Capsule completion calculation requires explicit section completions (never completed on open)", () => {
  assert.deepEqual(computeCapsuleCompletion({ totalSections: 4, completedSections: 0 }), {
    completionPercent: 0,
    status: "in_progress",
  });
  assert.deepEqual(computeCapsuleCompletion({ totalSections: 4, completedSections: 2 }), {
    completionPercent: 50,
    status: "in_progress",
  });
  assert.deepEqual(computeCapsuleCompletion({ totalSections: 4, completedSections: 4 }), {
    completionPercent: 100,
    status: "completed",
  });
});

await test("8. Migration 029 is additive, creates all 11 tables, and uses only plain immutable index columns", () => {
  const sql = fs.readFileSync(
    path.join(root, "server/migrations/029_smart_revision_monthly_capsules.sql"),
    "utf8",
  );
  assert.ok(!/\bDROP\s+TABLE\b/i.test(sql), "Migration 029 must not drop tables");
  assert.ok(!/\bTRUNCATE\b/i.test(sql), "Migration 029 must not truncate tables");
  assert.ok(!/::date/i.test(sql), "Migration 029 indexes must not use non-immutable ::date casts");

  const expectedTables = [
    "student_revision_preferences",
    "student_revision_items",
    "student_revision_history",
    "student_weak_topics",
    "student_daily_revision_plans",
    "monthly_capsules",
    "monthly_capsule_sections",
    "monthly_capsule_content_links",
    "monthly_capsule_exam_tags",
    "student_monthly_capsule_progress",
    "student_monthly_capsule_section_progress",
  ];
  for (const tbl of expectedTables) {
    assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`), `Missing table ${tbl}`);
  }
});

await test("9. Routers enforce requireAuth/requireAdmin, publishedOnly isolation, and server/index.js mounts", () => {
  const sr = fs.readFileSync(path.join(root, "server/routes/smartRevisionStudent.js"), "utf8");
  const mcs = fs.readFileSync(path.join(root, "server/routes/monthlyCapsulesStudent.js"), "utf8");
  const mca = fs.readFileSync(path.join(root, "server/routes/monthlyCapsulesAdmin.js"), "utf8");
  const idx = fs.readFileSync(path.join(root, "server/index.js"), "utf8");

  assert.ok(sr.includes("requireAuth"));
  assert.ok(mcs.includes("requireAuth"));
  assert.ok(mcs.includes("publishedOnly: true"));
  assert.ok(mca.includes("requireAdmin"));
  assert.ok(mca.includes("INSERT INTO audit_logs"));
  assert.ok(idx.includes("/api/smart-revision"));
  assert.ok(idx.includes("/api/monthly-capsules"));
  assert.ok(idx.includes("/api/admin/monthly-capsules"));
});

await test("10. Frontend components are integrated into student and admin hubs and use safeUrl", () => {
  const sca = fs.readFileSync(
    path.join(root, "client/src/components/student/StudentCurrentAffairs.jsx"),
    "utf8",
  );
  const cav = fs.readFileSync(
    path.join(root, "client/src/components/admin/CurrentAffairsView.jsx"),
    "utf8",
  );
  const mc = fs.readFileSync(
    path.join(root, "client/src/components/student/MonthlyCapsules.jsx"),
    "utf8",
  );

  assert.ok(sca.includes("SmartRevisionDashboard"));
  assert.ok(sca.includes("MonthlyCapsules"));
  assert.ok(cav.includes("MonthlyCapsuleAdmin"));
  assert.ok(mc.includes("getSafeExternalUrl"));
});

console.log(`\nPhase 8 verification summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
