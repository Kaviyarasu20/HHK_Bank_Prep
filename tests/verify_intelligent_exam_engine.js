/**
 * Comprehensive Automated Verification Suite for HHK Intelligent Exam-Wise Mock Test Creator
 *
 * Covers all 17 requirements:
 *  1. Every supported examination pattern (IBPS RRB OA/PO, IBPS Clerk/CSA, IBPS PO, SBI Clerk, SBI PO — Prelims & Mains)
 *  2. Section-wise question counts & total marks consistency
 *  3. Examination timing & sectional timing integrity
 *  4. Negative marking consistency (1/4th ratio)
 *  5. Topic-wise distribution engine (bounded ranges & exact sums)
 *  6. Arithmetic weighted subtopic sampling & rotation across 5 mock tests
 *  7. Exam-specific difficulty distribution apportionment
 *  8. Subject Generator Registry (Quant ACTIVE, Reasoning/English/GA/Computer honestly UNAVAILABLE)
 *  9. Missing generator handling & FAIL_STRICT enforcement (never claims fulfilled when short)
 * 10. Insufficient question availability with ALLOW_PARTIAL_DRAFT and USE_BANK_FALLBACK
 * 11. Duplicate prevention (strict zero duplicates within test + cross-test repetition minimization + sequence variation)
 * 12. Invalid question rejection (wrong option count, empty/duplicate options, NaN leaks, answer mismatch, quant calc mismatch)
 * 13. Full validated Quant section generation across all 6 exams (exact 5 options, valid answer key, valid explanation)
 * 14. Admin pattern updates & pattern version changes (custom overrides without touching engine code)
 * 15. Future subject generator dynamic registration (plugging in Reasoning + English adapters -> 100% full multi-subject mock test!)
 * 16. Student result scoring & analytics (negative marking, topic-wise, difficulty-wise, strengths & weaknesses)
 */

import assert from "node:assert/strict";
import {
  EXAM_PATTERN_CATALOG,
  findCatalogPattern,
} from "../server/exam-engine/examPatternCatalog.js";
import {
  SubjectGeneratorRegistry,
  subjectGeneratorRegistry,
} from "../server/exam-engine/subjectGeneratorRegistry.js";
import { validateMockTestQuestion } from "../server/exam-engine/questionQualityValidator.js";
import {
  buildSectionDistributionPlan,
  allocateDifficultyCounts,
} from "../server/exam-engine/topicDistributionEngine.js";
import {
  previewExamWiseDistribution,
  generateIntelligentExamWiseMockTest,
} from "../server/exam-engine/intelligentMockTestEngine.js";
import {
  computeAttemptBreakdown,
  computeStrengthsAndWeaknesses,
} from "../server/services/attemptAnalytics.js";

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

console.log("=== HHK Intelligent Exam-Wise Mock Test Creator — Automated Verification ===\n");

// 1-4. Verify all 12 Exam Patterns (6 Exams x Prelims & Mains)
await runTest("1. All 6 banking exams (Prelims & Mains = 12 patterns) have consistent section counts, marks, timing & negative marking", () => {
  assert.equal(EXAM_PATTERN_CATALOG.length, 12, "Expected 12 exam patterns (6 exams x 2 stages)");
  const expectedCodes = ["IBPS-RRB-OA", "IBPS-RRB-PO", "IBPS-CSA", "IBPS-PO", "SBI-JA", "SBI-PO"];
  for (const code of expectedCodes) {
    for (const stage of ["Prelims", "Mains"]) {
      const p = findCatalogPattern(code, stage);
      assert.ok(p, `Missing catalog pattern for ${code} ${stage}`);
      const sumQ = p.sections.reduce((s, sec) => s + sec.questionCount, 0);
      const sumMarks = Number(
        p.sections.reduce((s, sec) => s + sec.questionCount * sec.marksPerQuestion, 0).toFixed(2)
      );
      const sumDuration = p.sections.reduce((s, sec) => s + (sec.durationSeconds || 0), 0);
      assert.equal(sumQ, p.totalQuestions, `${code} ${stage}: section question sum mismatch`);
      assert.equal(sumMarks, p.totalMarks, `${code} ${stage}: section marks sum mismatch`);
      if (p.sectionalTimingEnabled) {
        assert.equal(sumDuration, p.durationSeconds, `${code} ${stage}: sectional duration sum mismatch`);
      }
      for (const sec of p.sections) {
        const expectedNeg = Number((sec.marksPerQuestion * p.negativeMarkingRatio).toFixed(4));
        assert.equal(
          Number(sec.negativeMarks.toFixed(4)),
          expectedNeg,
          `${code} ${stage} ${sec.sectionName}: negative marking ratio mismatch`
        );
      }
    }
  }
});

// 5-7. Topic Distribution Engine, Difficulty Apportionment & Variation across 5 RRB Clerk Mock Tests
await runTest("2. Topic Distribution Engine respects exact counts, exam-specific difficulty, and varies arithmetic subtopics across 5 RRB Clerk tests", () => {
  const rrbClerk = findCatalogPattern("IBPS-RRB-OA", "Prelims");
  const quantSec = rrbClerk.sections.find((s) => s.subjectKey === "quant");
  assert.equal(quantSec.questionCount, 40);

  const recentUsage = {};
  const subtopicSets = [];
  for (let i = 0; i < 5; i++) {
    const plan = buildSectionDistributionPlan(quantSec, {
      seed: 1000 + i * 777,
      varyWithinRanges: true,
      recentSubtopicCounts: recentUsage,
    });
    const sumPlan = plan.topicPlan.reduce((s, t) => s + t.count, 0);
    assert.equal(sumPlan, 40, `Run ${i + 1}: topic plan sum must equal 40`);
    const sumDiff =
      plan.difficultyTargets.easy + plan.difficultyTargets.medium + plan.difficultyTargets.hard;
    assert.equal(sumDiff, 40, `Run ${i + 1}: difficulty targets sum must equal 40`);

    const arithSlots = plan.topicPlan.filter((t) => t.parentGroup === "Arithmetic");
    assert.ok(arithSlots.length >= 4 && arithSlots.length < 15, "Arithmetic must sample a realistic subset (not all 15 every time)");
    const names = arithSlots.map((a) => a.topic).sort().join("|");
    subtopicSets.push(names);
    for (const a of arithSlots) {
      recentUsage[a.topic] = (recentUsage[a.topic] || 0) + a.count;
    }
  }
  assert.ok(new Set(subtopicSets).size >= 3, "5 generated tests should vary arithmetic subtopics across sets");

  // Verify exam-specific difficulty differentiation (RRB Clerk Prelims vs SBI PO Mains)
  const sbiPoMains = findCatalogPattern("SBI-PO", "Mains");
  const sbiQuant = sbiPoMains.sections.find((s) => s.subjectKey === "quant");
  const rrbDiff = allocateDifficultyCounts(40, quantSec.difficultyDistribution);
  const sbiDiff = allocateDifficultyCounts(30, sbiQuant.difficultyDistribution);
  assert.ok(rrbDiff.easy > sbiDiff.easy, "RRB Clerk Prelims must have more Easy questions than SBI PO Mains");
  assert.ok(sbiDiff.hard > rrbDiff.hard, "SBI PO Mains must have more Hard questions than RRB Clerk Prelims");
});

// 8. Subject Generator Registry honest status reporting
await runTest("3. Subject Generator Registry reports Quant as ACTIVE and Reasoning/English/GA/Computer honestly as UNAVAILABLE", () => {
  const statuses = subjectGeneratorRegistry.listStatuses();
  const byKey = new Map(statuses.map((s) => [s.subjectKey, s]));
  assert.equal(byKey.get("quant").status, "ACTIVE");
  assert.ok(byKey.get("quant").supportedTopicCount >= 20);
  assert.equal(byKey.get("reasoning").status, "UNAVAILABLE");
  assert.equal(byKey.get("english").status, "UNAVAILABLE");
  assert.equal(byKey.get("general_awareness").status, "UNAVAILABLE");
  assert.equal(byKey.get("computer_knowledge").status, "UNAVAILABLE");
});

// 9. Missing generator handling & FAIL_STRICT enforcement
await runTest("4. Missing generator blocks under FAIL_STRICT with transparent shortage report (never claims exact pattern)", async () => {
  let caught = null;
  try {
    await generateIntelligentExamWiseMockTest({
      examCode: "IBPS-RRB-OA",
      stageName: "Prelims",
      shortagePolicy: "FAIL_STRICT",
      seed: 42,
    });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, "Expected FAIL_STRICT to throw when Reasoning generator is UNAVAILABLE");
  assert.equal(caught.code, "PATTERN_SHORTAGE");
  assert.equal(caught.generationReport.patternFulfilled, false);
  assert.ok(
    caught.generationReport.shortages.some((s) => s.subjectKey === "reasoning" && s.missing === 40),
    "Shortage report must explicitly list 40 missing Reasoning questions"
  );
});

// 10. Insufficient availability with ALLOW_PARTIAL_DRAFT & USE_BANK_FALLBACK
await runTest("5. ALLOW_PARTIAL_DRAFT generates active Quant section accurately while reporting Reasoning shortage; USE_BANK_FALLBACK fills from bank", async () => {
  const partial = await generateIntelligentExamWiseMockTest({
    examCode: "IBPS-RRB-OA",
    stageName: "Prelims",
    shortagePolicy: "ALLOW_PARTIAL_DRAFT",
    seed: 101,
  });
  assert.equal(partial.patternFulfilled, false, "Must NOT claim patternFulfilled when Reasoning is missing");
  const quantRes = partial.mockTest.sections.find((s) => s.subjectKey === "quant");
  const reasRes = partial.mockTest.sections.find((s) => s.subjectKey === "reasoning");
  assert.equal(quantRes.generatedQuestions, 40, "Quant section should generate all 40 valid questions");
  assert.equal(quantRes.fulfilled, true);
  assert.equal(reasRes.generatedQuestions, 0);
  assert.equal(reasRes.missingQuestions, 40);

  // Now test USE_BANK_FALLBACK supplying 40 valid Reasoning questions from a mock bank provider
  const withFallback = await generateIntelligentExamWiseMockTest({
    examCode: "IBPS-RRB-OA",
    stageName: "Prelims",
    shortagePolicy: "USE_BANK_FALLBACK",
    seed: 102,
    bankFallbackProvider: async ({ subjectKey, count }) => {
      if (subjectKey !== "reasoning") return [];
      return Array.from({ length: count }, (_, idx) => ({
        questionText: `Bank Reasoning Question #${idx + 1}: If all A are B and some B are C, which conclusion follows?`,
        options: [
          { key: "A", text: `Only I follows (${idx})` },
          { key: "B", text: `Only II follows (${idx})` },
          { key: "C", text: `Either I or II follows (${idx})` },
          { key: "D", text: `Neither I nor II follows (${idx})` },
          { key: "E", text: `Both I and II follow (${idx})` },
        ],
        correctAnswer: "A",
        explanation: "Standard syllogism deduction.",
        topicName: "Syllogism",
        difficulty: "medium",
      }));
    },
  });
  assert.equal(withFallback.patternFulfilled, true, "With bank fallback covering Reasoning, full 80-question pattern should be fulfilled");
  assert.equal(withFallback.mockTest.totalQuestions, 80);
});

// 11. Invalid Question Rejection
await runTest("6. QuestionQualityValidator rejects invalid questions (wrong option count, NaN leak, duplicate options, answer mismatch, quant math mismatch)", () => {
  // Wrong option count (4 instead of 5)
  const badCount = validateMockTestQuestion(
    {
      questionText: "What is 25% of 400?",
      options: [
        { key: "A", text: "50" },
        { key: "B", text: "100" },
        { key: "C", text: "150" },
        { key: "D", text: "200" },
      ],
      correctAnswer: "B",
      explanation: "25% of 400 is 100.",
      topicName: "Percentage",
      difficulty: "easy",
    },
    { requiredOptionCount: 5, subjectKey: "quant" }
  );
  assert.equal(badCount.valid, false);

  // NaN leak
  const nanLeak = validateMockTestQuestion(
    {
      questionText: "Find the value of NaN + 50.",
      options: ["10", "20", "30", "40", "50"].map((t, i) => ({ key: String.fromCharCode(65 + i), text: t })),
      correctAnswer: "E",
      explanation: "Invalid calculation.",
      topicName: "Simplification",
      difficulty: "easy",
    },
    { requiredOptionCount: 5, subjectKey: "quant" }
  );
  assert.equal(nanLeak.valid, false);

  // Duplicate options
  const dupOpts = validateMockTestQuestion(
    {
      questionText: "What is 10 + 10?",
      options: ["20", "20", "30", "40", "50"].map((t, i) => ({ key: String.fromCharCode(65 + i), text: t })),
      correctAnswer: "A",
      explanation: "10 + 10 = 20.",
      topicName: "Simplification",
      difficulty: "easy",
    },
    { requiredOptionCount: 5, subjectKey: "quant" }
  );
  assert.equal(dupOpts.valid, false);

  // Quant calculation mismatch
  const mathMismatch = validateMockTestQuestion(
    {
      questionText: "What is 15 * 4?",
      options: ["45", "50", "55", "60", "65"].map((t, i) => ({ key: String.fromCharCode(65 + i), text: t })),
      correctAnswer: "A",
      numericAnswer: 60,
      explanation: "15 * 4 = 60.",
      topicName: "Simplification",
      difficulty: "easy",
    },
    { requiredOptionCount: 5, subjectKey: "quant" }
  );
  assert.equal(mathMismatch.valid, false);
});

// 12-13. Full Quant Generation across ALL 6 exams + Strict Deduplication & 5-Option Verification
await runTest("7. Full Quantitative Aptitude generation succeeds with 100% valid 5-option unique questions across all 6 banking exams", async () => {
  const examsToTest = [
    ["IBPS-RRB-OA", "Prelims", "Numerical Ability", 40],
    ["IBPS-RRB-PO", "Prelims", "Quantitative Aptitude", 40],
    ["IBPS-CSA", "Prelims", "Numerical Ability", 35],
    ["IBPS-PO", "Prelims", "Quantitative Aptitude", 35],
    ["SBI-JA", "Prelims", "Numerical Ability", 35],
    ["SBI-PO", "Prelims", "Quantitative Aptitude", 30],
  ];

  for (const [examCode, stageName, sectionName, expectedCount] of examsToTest) {
    const res = await generateIntelligentExamWiseMockTest({
      examCode,
      stageName,
      targetSectionNames: [sectionName],
      shortagePolicy: "FAIL_STRICT",
      seed: 2026 + expectedCount,
    });
    assert.equal(res.patternFulfilled, true, `${examCode} ${stageName} Quant must fulfill 100%`);
    assert.equal(res.mockTest.totalQuestions, expectedCount, `${examCode} expected ${expectedCount} Qs`);

    const fps = new Set();
    for (const q of res.mockTest.questions) {
      assert.equal(q.options.length, 5, `${examCode}: every MCQ must have exactly 5 options`);
      assert.ok(q.options.some((o) => o.key === q.correctAnswer), `${examCode}: correctAnswer must match option key`);
      assert.ok(q.explanation && q.explanation.length >= 5, `${examCode}: must have explanation`);
      assert.ok(!fps.has(q.fingerprint), `${examCode}: strict within-test duplicate detected!`);
      fps.add(q.fingerprint);
    }
  }
});

// 14. Cross-test duplicate prevention & sequence variation
await runTest("8. Consecutive mock tests minimize repetition and vary question sequence", async () => {
  const test1 = await generateIntelligentExamWiseMockTest({
    examCode: "SBI-PO",
    stageName: "Prelims",
    targetSectionNames: ["Quantitative Aptitude"],
    shortagePolicy: "FAIL_STRICT",
    seed: 5001,
  });
  const test1Fps = test1.mockTest.questions.map((q) => q.fingerprint);

  const test2 = await generateIntelligentExamWiseMockTest({
    examCode: "SBI-PO",
    stageName: "Prelims",
    targetSectionNames: ["Quantitative Aptitude"],
    shortagePolicy: "FAIL_STRICT",
    excludeFingerprints: test1Fps,
    seed: 5002,
  });
  const test2Fps = new Set(test2.mockTest.questions.map((q) => q.fingerprint));
  const overlap = test1Fps.filter((fp) => test2Fps.has(fp)).length;
  assert.equal(overlap, 0, "Test 2 should have zero overlap with Test 1 fingerprints");

  const seq1 = test1.mockTest.questions.map((q) => q.topicName).join(",");
  const seq2 = test2.mockTest.questions.map((q) => q.topicName).join(",");
  assert.notEqual(seq1, seq2, "Consecutive mock tests must not have identical topic sequences");
});

// 15. Admin Pattern Updates & Version Changes (data-driven without changing engine code)
await runTest("9. Admin custom pattern override (changing counts, timing, marks & disabling a topic) works dynamically", async () => {
  const customPattern = findCatalogPattern("IBPS-RRB-OA", "Prelims");
  const quantSec = customPattern.sections.find((s) => s.subjectKey === "quant");
  quantSec.questionCount = 20;
  quantSec.durationSeconds = 12 * 60;
  quantSec.marksPerQuestion = 2;
  quantSec.negativeMarks = 0.5;
  // Disable Quadratic Equations
  quantSec.topicDistributions = quantSec.topicDistributions.map((t) =>
    t.topic === "Quadratic Equations" ? { ...t, enabled: false } : t
  );
  customPattern.sections = [quantSec];
  customPattern.totalQuestions = 20;
  customPattern.durationSeconds = 12 * 60;

  const res = await generateIntelligentExamWiseMockTest({
    pattern: customPattern,
    shortagePolicy: "FAIL_STRICT",
    seed: 7070,
  });
  assert.equal(res.patternFulfilled, true);
  assert.equal(res.mockTest.totalQuestions, 20);
  assert.equal(res.mockTest.durationSeconds, 720);
  assert.ok(
    res.mockTest.questions.every((q) => q.topicName !== "Quadratic Equations"),
    "Disabled topic 'Quadratic Equations' must not appear in generated test"
  );
  assert.ok(
    res.mockTest.questions.every((q) => q.marks === 2 && q.negativeMarks === 0.5),
    "Custom marks & negative marking must propagate to generated questions"
  );
});

// 16. Future Subject Generator Registration (Extensibility test — zero core engine changes!)
await runTest("10. Dynamically registering future Reasoning & English generators enables 100% full multi-subject IBPS PO Prelims mock test", async () => {
  const isolatedRegistry = new SubjectGeneratorRegistry();

  // Plug in a new Reasoning generator adapter
  isolatedRegistry.register({
    subjectKey: "reasoning",
    displayName: "Reasoning Ability (Plugged-in v1)",
    status: "ACTIVE",
    version: "1.0.0",
    supportedTopics: ["Puzzles", "Seating Arrangement", "Syllogism", "Inequality", "Coding-Decoding", "Blood Relations", "Direction & Distance"],
    supportsTopic: () => true,
    getAvailableCount: () => Number.POSITIVE_INFINITY,
    generateQuestions: ({ topic, difficulty, count }) => ({
      questions: Array.from({ length: count }, (_, idx) => ({
        questionText: `[Reasoning/${topic}/${difficulty}] Logical problem #${idx + 1} with deterministic unique seed ${Math.random().toString(36).slice(2, 8)}.`,
        options: ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"].map((t, i) => ({
          key: String.fromCharCode(65 + i),
          text: `${t} (${topic}-${idx})`,
        })),
        correctAnswer: "C",
        explanation: `Logical deduction step for ${topic}.`,
        topicName: topic,
        difficulty,
      })),
    }),
  });

  // Plug in a new English generator adapter
  isolatedRegistry.register({
    subjectKey: "english",
    displayName: "English Language (Plugged-in v1)",
    status: "ACTIVE",
    version: "1.0.0",
    supportedTopics: ["Reading Comprehension", "Cloze Test", "Error Detection", "Para Jumbles", "Fill in the Blanks"],
    supportsTopic: () => true,
    getAvailableCount: () => Number.POSITIVE_INFINITY,
    generateQuestions: ({ topic, difficulty, count }) => ({
      questions: Array.from({ length: count }, (_, idx) => ({
        questionText: `[English/${topic}/${difficulty}] Identify the grammatically accurate choice for passage context #${idx + 1} (${Math.random().toString(36).slice(2, 8)}).`,
        options: ["Choice A", "Choice B", "Choice C", "Choice D", "No error"].map((t, i) => ({
          key: String.fromCharCode(65 + i),
          text: `${t} (${idx})`,
        })),
        correctAnswer: "B",
        explanation: `Grammar/context rule for ${topic}.`,
        topicName: topic,
        difficulty,
        passageText: topic === "Reading Comprehension" ? "Sample banking economy passage text." : undefined,
      })),
    }),
  });

  // Preview should now show 100% readiness for full 100-question IBPS PO Prelims!
  const preview = previewExamWiseDistribution({
    examCode: "IBPS-PO",
    stageName: "Prelims",
    registry: isolatedRegistry,
    seed: 9001,
  });
  assert.equal(preview.allSectionsReady, true);
  assert.equal(preview.autoGeneratableQuestions, 100);

  // Generate full 100-question 3-subject IBPS PO Prelims test
  const fullTest = await generateIntelligentExamWiseMockTest({
    examCode: "IBPS-PO",
    stageName: "Prelims",
    shortagePolicy: "FAIL_STRICT",
    registry: isolatedRegistry,
    seed: 9001,
  });
  assert.equal(fullTest.patternFulfilled, true);
  assert.equal(fullTest.mockTest.totalQuestions, 100);
  assert.equal(fullTest.mockTest.sections.length, 3);
  assert.equal(fullTest.mockTest.sections[0].generatedQuestions, 30); // English
  assert.equal(fullTest.mockTest.sections[1].generatedQuestions, 35); // Quant
  assert.equal(fullTest.mockTest.sections[2].generatedQuestions, 35); // Reasoning
});

// 17. Student Attempt Analytics (Negative Marking, Topic-wise, Difficulty-wise, Strengths & Weaknesses)
await runTest("11. Student Attempt Analytics computes exact negative marking, topic-wise, difficulty-wise, and strengths/weaknesses", () => {
  const sampleAnswers = [
    { topic_name: "Percentage", difficulty: "easy", question_type: "mcq", selected_answer: "A", correct_answer: "A", marks: 1, negative_marks: 0.25, time_spent_seconds: 25 },
    { topic_name: "Percentage", difficulty: "medium", question_type: "mcq", selected_answer: "B", correct_answer: "B", marks: 1, negative_marks: 0.25, time_spent_seconds: 35 },
    { topic_name: "Percentage", difficulty: "hard", question_type: "mcq", selected_answer: "C", correct_answer: "C", marks: 1, negative_marks: 0.25, time_spent_seconds: 45 },
    { topic_name: "Number Series", difficulty: "medium", question_type: "mcq", selected_answer: "A", correct_answer: "D", marks: 1, negative_marks: 0.25, time_spent_seconds: 40 },
    { topic_name: "Number Series", difficulty: "hard", question_type: "mcq", selected_answer: "B", correct_answer: "E", marks: 1, negative_marks: 0.25, time_spent_seconds: 50 },
    { topic_name: "Number Series", difficulty: "easy", question_type: "mcq", selected_answer: "A", correct_answer: "A", marks: 1, negative_marks: 0.25, time_spent_seconds: 20 },
    { topic_name: "Data Interpretation", difficulty: "hard", question_type: "mcq", selected_answer: null, correct_answer: "B", marks: 1, negative_marks: 0.25, time_spent_seconds: 10 },
  ];

  const { topicPerformance, difficultyPerformance } = computeAttemptBreakdown(sampleAnswers);
  const pct = topicPerformance.find((t) => t.topicName === "Percentage");
  const ns = topicPerformance.find((t) => t.topicName === "Number Series");
  const di = topicPerformance.find((t) => t.topicName === "Data Interpretation");

  assert.equal(pct.score, 3);
  assert.equal(pct.accuracy, 100);
  assert.equal(ns.score, 0.5); // 1 correct (+1) - 2 wrong (-0.5) = 0.5
  assert.equal(ns.accuracy, 33.3);
  assert.equal(di.unattempted, 1);
  assert.equal(di.score, 0);

  const easyPerf = difficultyPerformance.find((d) => d.difficulty === "easy");
  assert.equal(easyPerf.correct, 2);
  assert.equal(easyPerf.accuracy, 100);

  const sw = computeStrengthsAndWeaknesses(
    topicPerformance.map((t) => ({ topic_name: t.topicName, attempted: t.attempted, correct: t.correct })),
    3
  );
  assert.equal(sw.hasSufficientData, true);
  assert.equal(sw.strengths[0].topicName, "Percentage");
  assert.equal(sw.weaknesses[0].topicName, "Number Series");
});

console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
