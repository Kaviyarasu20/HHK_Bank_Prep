import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXAM_PROFILES,
  getExamProfile,
  mapDifficultyToCanonical,
  SUPPORTED_EXAM_CODES,
} from "../server/services/caExamMapper.js";
import {
  buildMcqGenerationPrompt,
  QUESTION_FORMATS,
  SUPPORTED_QUESTION_TYPES,
} from "../server/services/caQuestionTemplates.js";
import { classifyQuestionDifficulty } from "../server/services/caQuestionDifficulty.js";
import { detectDuplicateQuestion } from "../server/services/caDuplicateDetector.js";
import { validateGeneratedQuestion } from "../server/services/caQuestionValidator.js";
import { scoreQuestionQuality } from "../server/services/caQuestionQuality.js";
import { generateExamMcqs } from "../server/services/caQuestionGenerator.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  [FAIL] ${name}\n         ${err.stack || err.message}`);
  }
}

console.log("=== HHK Phase 6: Exam-Wise MCQ Generation & Validation — Automated Verification ===\n");

const SOURCE_TEXT =
  "On 9 October 2024, the Reserve Bank of India (RBI) Monetary Policy Committee (MPC) kept the policy repo rate unchanged at 6.50% and shifted its stance to neutral. The SDF rate stands at 6.25% and MSF rate at 6.75%.";

await test("1. All 8 banking exam profiles & all 9 MCQ formats are configured and build grounded prompts", () => {
  assert.equal(SUPPORTED_EXAM_CODES.length, 8);
  assert.equal(SUPPORTED_QUESTION_TYPES.length, 9);
  for (const code of SUPPORTED_EXAM_CODES) {
    const profile = getExamProfile(code);
    assert.equal(profile.examCode, code);
    assert.equal(profile.optionCount, 5);
  }
  assert.equal(mapDifficultyToCanonical("easy"), "easy");
  assert.equal(mapDifficultyToCanonical("moderate"), "medium");
  assert.equal(mapDifficultyToCanonical("difficult"), "hard");

  for (const fmt of SUPPORTED_QUESTION_TYPES) {
    const p = buildMcqGenerationPrompt({
      sourceText: SOURCE_TEXT,
      sourceTitle: "RBI MPC Review",
      sourceReferenceLabel: "RBI (2024-10-09)",
      examProfile: EXAM_PROFILES["SBI PO"],
      questionType: fmt,
      difficulty: "moderate",
      count: 2,
    });
    assert.ok(p.userPrompt.includes(QUESTION_FORMATS[fmt].label));
    assert.ok(p.userPrompt.includes("<UNTRUSTED_SOURCE_DATA>"));
  }
});

await test("2. Cognitive difficulty classifier distinguishes Easy, Moderate, and Difficult MCQs", () => {
  const easy = classifyQuestionDifficulty({
    questionText: "What does the abbreviation SDF stand for in RBI monetary policy?",
    questionType: "institution_abbreviation",
  });
  assert.equal(easy.difficulty, "easy");

  const mod = classifyQuestionDifficulty({
    questionText: "Which of the following statements regarding the RBI MPC review is incorrect?",
    questionType: "correct_incorrect",
  });
  assert.equal(mod.difficulty, "moderate");

  const diff = classifyQuestionDifficulty({
    questionText: "Consider the following statements: Statement 1... Statement 2... Statement 3...",
    questionType: "statement_based",
  });
  assert.equal(diff.difficulty, "difficult");
});

await test("3. Deterministic validator catches structural, numeric, contradictory, duplicate-option & stale-reference errors", () => {
  // Valid 5-option grounded MCQ
  const valid = validateGeneratedQuestion({
    question: {
      questionText: "In the October 2024 RBI MPC review, what was the policy repo rate maintained at?",
      questionType: "numerical_data",
      difficulty: "easy",
      options: [
        { key: "A", text: "6.00%" },
        { key: "B", text: "6.25%" },
        { key: "C", text: "6.50%" },
        { key: "D", text: "6.75%" },
        { key: "E", text: "7.00%" },
      ],
      correctAnswer: "C",
      explanation: "The RBI MPC kept the policy repo rate unchanged at 6.50% on 9 October 2024.",
      sourceReference: "keep the policy repo rate unchanged at 6.50%",
    },
    sourceText: SOURCE_TEXT,
    expectedOptionCount: 5,
  });
  assert.equal(valid.overallStatus, "passed");

  // Hallucinated number in correct answer fails
  const wrongNum = validateGeneratedQuestion({
    question: {
      questionText: "What was the RBI policy repo rate announced on 9 October 2024?",
      questionType: "numerical_data",
      difficulty: "easy",
      options: [
        { key: "A", text: "8.90%" },
        { key: "B", text: "6.25%" },
        { key: "C", text: "6.50%" },
        { key: "D", text: "6.75%" },
      ],
      correctAnswer: "A",
      explanation: "The repo rate was set to 8.90%.",
      sourceReference: "repo rate",
    },
    sourceText: SOURCE_TEXT,
  });
  assert.equal(wrongNum.overallStatus, "failed");

  // Contradictory explanation & duplicate option fail
  const badStruct = validateGeneratedQuestion({
    question: {
      questionText: "Which institution announced the neutral monetary stance in October 2024?",
      questionType: "direct_factual",
      difficulty: "easy",
      options: [
        { key: "A", text: "RBI" },
        { key: "B", text: "RBI" },
        { key: "C", text: "SEBI" },
        { key: "D", text: "NABARD" },
      ],
      correctAnswer: "A",
      explanation: "The correct answer is option C because SEBI regulates markets.",
    },
    sourceText: SOURCE_TEXT,
  });
  assert.equal(badStruct.overallStatus, "failed");
  assert.equal(badStruct.ambiguityStatus, "failed");

  // Outdated Phase 4 reference source fails validation
  const staleRef = validateGeneratedQuestion({
    question: {
      questionText: "What is the policy repo rate as per the RBI circular dated 2024-10-09?",
      questionType: "numerical_data",
      difficulty: "easy",
      options: [
        { key: "A", text: "6.50%" },
        { key: "B", text: "6.25%" },
        { key: "C", text: "6.75%" },
        { key: "D", text: "6.00%" },
      ],
      correctAnswer: "A",
      explanation: "The RBI circular specified 6.50%.",
      sourceReference: "6.50%",
    },
    sourceText: SOURCE_TEXT,
    sourceFreshness: { state: "outdated", label: "Outdated" },
  });
  assert.equal(staleRef.overallStatus, "failed");
});

await test("4. Duplicate detector classifies exact_duplicate, near_duplicate, same_fact, and unique accurately", () => {
  const existing = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      question_text: "What was the RBI policy repo rate maintained in October 2024?",
      options: [{ key: "A", text: "6.50%" }],
      correct_answer: "A",
      source_reference: "RBI MPC kept policy repo rate unchanged at 6.50% on 9 October 2024",
    },
  ];

  const exact = detectDuplicateQuestion(
    {
      questionText: "What was the RBI policy repo rate maintained in October 2024?",
      options: [{ key: "A", text: "6.50%" }],
      correctAnswer: "A",
    },
    existing,
  );
  assert.equal(exact.status, "exact_duplicate");

  const near = detectDuplicateQuestion(
    {
      questionText: "What was the RBI policy repo rate maintained during October 2024?",
      options: [{ key: "A", text: "6.50%" }],
      correctAnswer: "A",
    },
    existing,
  );
  assert.equal(near.status, "near_duplicate");

  const sameFact = detectDuplicateQuestion(
    {
      questionText: "Which benchmark interest rate did MPC hold steady at its October review?",
      options: [{ key: "A", text: "6.50%" }],
      correctAnswer: "A",
      sourceReference: "RBI MPC kept policy repo rate unchanged at 6.50% on 9 October 2024",
    },
    existing,
  );
  assert.equal(sameFact.status, "same_fact");

  const unique = detectDuplicateQuestion(
    {
      questionText: "Where is the headquarters of NABARD located?",
      options: [{ key: "A", text: "Mumbai" }],
      correctAnswer: "A",
    },
    existing,
  );
  assert.equal(unique.status, "unique");
});

await test("5. End-to-end mocked MCQ generator enforces quality hard gate & produces draft-only questions", async () => {
  const mockedAi = {
    questions: [
      {
        questionText: "In the 9 October 2024 RBI MPC review, what was the policy repo rate maintained at?",
        questionType: "numerical_data",
        difficulty: "easy",
        options: [
          { key: "A", text: "6.00%" },
          { key: "B", text: "6.25%" },
          { key: "C", text: "6.50%" },
          { key: "D", text: "6.75%" },
          { key: "E", text: "7.00%" },
        ],
        correctAnswer: "C",
        explanation: "On 9 October 2024, the RBI Monetary Policy Committee kept the policy repo rate unchanged at 6.50% and shifted stance to neutral.",
        sourceReference: "kept the policy repo rate unchanged at 6.50%",
        topic: "Monetary Policy",
      },
    ],
  };

  const out = await generateExamMcqs({
    sourceTitle: "RBI MPC October 2024 Review",
    sourceText: SOURCE_TEXT,
    examCode: "RBI Grade B",
    questionType: "numerical_data",
    difficulty: "easy",
    count: 1,
    providerFn: async () => ({
      provider: "mock",
      model: "mock-v1",
      rawText: JSON.stringify(mockedAi),
      usage: { totalTokens: 250 },
    }),
  });

  assert.equal(out.questions.length, 1);
  assert.equal(out.questions[0].reviewStatus, "draft");
  assert.equal(out.questions[0].validation.overallStatus, "passed");
  assert.ok(out.questions[0].quality.qualityScore >= 90);
  assert.equal(out.questions[0].quality.qualityStatus, "excellent");

  // Hard gate test: failed validation forces qualityStatus = 'rejected'
  const gated = scoreQuestionQuality({
    question: { examCodes: ["IBPS PO"] },
    validation: {
      overallStatus: "failed",
      structuralStatus: "passed",
      answerValidationStatus: "failed",
      sourceValidationStatus: "passed",
      ambiguityStatus: "passed",
      explanation: "Long explanation text that is over sixty characters long to test hard gate.",
    },
    duplicateResult: { status: "unique" },
  });
  assert.equal(gated.qualityStatus, "rejected");
});

await test("6. Migration 027, router mounting, canonical question-bank sync & frontend integration are complete", () => {
  const sql = fs.readFileSync(
    path.join(projectRoot, "server/migrations/027_current_affairs_mcq_generation.sql"),
    "utf8",
  );
  for (const tbl of [
    "current_affairs_question_batches",
    "current_affairs_generated_questions",
    "current_affairs_question_options",
    "current_affairs_question_validation",
    "current_affairs_question_reviews",
    "canonical_question_id",
  ]) {
    assert.ok(sql.includes(tbl), `Migration 027 missing: ${tbl}`);
  }

  const indexJs = fs.readFileSync(path.join(projectRoot, "server/index.js"), "utf8");
  assert.ok(indexJs.includes("currentAffairsQuestionsAdminRouter"), "server/index.js must mount currentAffairsQuestionsAdminRouter");

  const routerJs = fs.readFileSync(
    path.join(projectRoot, "server/routes/currentAffairsQuestionsAdmin.js"),
    "utf8",
  );
  assert.ok(routerJs.includes("requireAdmin"), "MCQ admin router must enforce requireAdmin");
  assert.ok(routerJs.includes("Cannot approve a question that failed mandatory validation"), "Must block approval of failed questions");
  assert.ok(routerJs.includes("INSERT INTO questions"), "Approval must sync to canonical HHK questions table");

  const admView = fs.readFileSync(
    path.join(projectRoot, "client/src/components/admin/CurrentAffairsView.jsx"),
    "utf8",
  );
  assert.ok(admView.includes("CurrentAffairsQuestionGenerator"), "CurrentAffairsView must integrate CurrentAffairsQuestionGenerator");
});

console.log(`\n=== PHASE 6 SUMMARY: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
