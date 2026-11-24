import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeCurrentAffairsBatchWithAi,
  classifyRelevanceTier,
  detectDuplicateItem,
  generateBankingQuestionsWithAi,
  getAiIntegrationStatus,
  PRACTICE_SET_PRESETS,
  QUESTION_FORMATS_14,
  SUPPORTED_BANKING_EXAMS,
  SUPPORTED_QUESTION_FORMATS,
  validateAiQuestionPayload,
} from "../server/services/caAiEngineService.js";
import {
  generatePracticeSetPdf,
  SUPPORTED_PDF_FORMATS,
  validatePdfBuffer,
} from "../server/services/caPdfGeneratorService.js";
import { evaluateCaPracticeAccess } from "../server/services/caAccessService.js";

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

console.log("=== HHK AI Current Affairs Replacement Platform — End-to-End QA Verification ===\n");

await test("1. Phase 1 Removal: Obsolete legacy CA files removed & unrelated/preserved modules intact", () => {
  const mustBeRemoved = [
    "server/routes/currentAffairsStudent.js",
    "server/routes/currentAffairsAdmin.js",
    "server/routes/currentAffairsOneLinersStudent.js",
    "server/routes/currentAffairsFlashcardsStudent.js",
    "server/routes/monthlyCapsulesStudent.js",
    "server/routes/smartRevisionStudent.js",
    "client/src/components/student/StudentCurrentAffairs.jsx",
    "client/src/components/admin/CurrentAffairsView.jsx",
    "client/src/api/currentAffairs.js",
  ];
  for (const rel of mustBeRemoved) {
    assert.equal(fs.existsSync(path.join(projectRoot, rel)), false, `Legacy file still exists: ${rel}`);
  }

  const mustBePreserved = [
    "server/routes/auth.js",
    "server/routes/payments.js",
    "server/routes/examEngine.js",
    "server/routes/bankingAwarenessStudent.js",
    "server/routes/bankingAwarenessAdmin.js",
    "client/src/components/student/BankingAwarenessDashboard.jsx",
    "client/src/components/admin/CurrentAffairsReferenceAdmin.jsx",
  ];
  for (const rel of mustBePreserved) {
    assert.equal(fs.existsSync(path.join(projectRoot, rel)), true, `Preserved module missing: ${rel}`);
  }
});

await test("2. Phase 2–6 Catalogs: 9+ banking exams, 14 question formats, 6 practice presets & relevance tiers", () => {
  assert.ok(SUPPORTED_BANKING_EXAMS.length >= 9);
  assert.equal(SUPPORTED_QUESTION_FORMATS.length, 14);
  assert.equal(Object.keys(QUESTION_FORMATS_14).length, 14);
  assert.ok(PRACTICE_SET_PRESETS.daily_quick.defaultQuestions === 10);
  assert.ok(PRACTICE_SET_PRESETS.daily_standard.defaultQuestions === 20);
  assert.ok(PRACTICE_SET_PRESETS.daily_complete.defaultQuestions === 30);
  assert.ok(PRACTICE_SET_PRESETS.daily_advanced.defaultQuestions === 50);
  assert.ok(PRACTICE_SET_PRESETS.weekly.defaultQuestions === 50);
  assert.ok(PRACTICE_SET_PRESETS.monthly.defaultQuestions === 100);

  assert.equal(classifyRelevanceTier(95).tier, "extremely_important");
  assert.equal(classifyRelevanceTier(82).tier, "highly_important");
  assert.equal(classifyRelevanceTier(65).tier, "moderately_important");
  assert.equal(classifyRelevanceTier(40).tier, "low_priority");
});

await test("3. Phase 4 AI Guardrail: Never simulates AI when credentials are missing (throws HTTP 503)", async () => {
  const status = getAiIntegrationStatus({ CA_AI_ENABLED: "false", CA_AI_PROVIDER: "disabled" });
  assert.equal(status.ready, false);

  await assert.rejects(
    () =>
      analyzeCurrentAffairsBatchWithAi({
        rawContent: "Reserve Bank of India kept the policy repo rate unchanged at 6.50% in October 2024.",
        env: { CA_AI_ENABLED: "false", CA_AI_PROVIDER: "disabled" },
      }),
    (err) => err.status === 503,
  );
});

await test("4. Phase 4 & 5 AI Pipeline: Multi-event extraction, duplicate detection, 14-format generation & numeric grounding", async () => {
  const mockAnalysisProvider = async () => ({
    provider: "gemini",
    model: "gemini-2.0-flash",
    rawText: JSON.stringify({
      events: [
        {
          mainEvent: "RBI MPC Keeps Policy Repo Rate Unchanged at 6.50% and Shifts Stance to Neutral",
          summary: "The Monetary Policy Committee maintained the repo rate at 6.50% and changed stance to neutral.",
          facts: ["Policy repo rate at 6.50%", "SDF rate at 6.25%", "MSF rate at 6.75%"],
          organizations: ["Reserve Bank of India", "Monetary Policy Committee"],
          numericalData: [{ label: "Repo Rate", value: "6.50%", context: "Oct 2024 MPC" }],
          people: [],
          locations: ["Mumbai"],
          schemes: [],
          bankingImplications: "Core monetary policy question for IBPS PO, SBI PO, and RBI Grade B.",
          knowledgePoints: ["Repo Rate: 6.50%", "Stance: Neutral"],
          categoryName: "RBI & Monetary Policy",
          targetExams: ["IBPS PO", "SBI PO", "RBI Grade B"],
          relevanceScore: 96,
          uncertainFlags: [],
          sourceExcerpt: "kept the policy repo rate unchanged at 6.50%",
        },
        {
          mainEvent: "UPI123Pay Per-Transaction Limit Raised to Rs 10,000 by RBI",
          summary: "RBI enhanced the UPI123Pay transaction limit from Rs 5,000 to Rs 10,000.",
          facts: ["UPI123Pay limit increased to Rs 10,000"],
          organizations: ["Reserve Bank of India", "NPCI"],
          numericalData: [{ label: "UPI123Pay Limit", value: "Rs 10,000", context: "Per transaction" }],
          people: [],
          locations: ["India"],
          schemes: ["UPI123Pay"],
          bankingImplications: "Direct digital banking awareness question.",
          knowledgePoints: ["UPI123Pay limit: Rs 10,000"],
          categoryName: "Banking & Financial Awareness",
          targetExams: ["IBPS Clerk", "SBI Clerk", "RBI Assistant"],
          relevanceScore: 91,
          uncertainFlags: [],
          sourceExcerpt: "enhanced UPI123Pay limit to Rs 10,000",
        },
      ],
    }),
  });

  const analysis = await analyzeCurrentAffairsBatchWithAi({
    rawContent:
      "RBI MPC kept policy repo rate unchanged at 6.50% and shifted stance to neutral. Separately, RBI raised UPI123Pay per-transaction limit from Rs 5,000 to Rs 10,000.",
    eventDate: "2026-11-24",
    categories: [
      { id: "cat-1", name: "RBI & Monetary Policy" },
      { id: "cat-2", name: "Banking & Financial Awareness" },
    ],
    providerFn: mockAnalysisProvider,
  });

  assert.equal(analysis.events.length, 2);
  assert.equal(analysis.events[0].relevanceTier, "extremely_important");

  // Duplicate detection test
  const dupExact = detectDuplicateItem("What is the RBI policy repo rate?", [
    { id: "q-old", question_text: "What is the RBI policy repo rate?" },
  ]);
  assert.equal(dupExact.status, "exact_duplicate");

  // Question generation + grounding validation
  const mockQProvider = async () => ({
    provider: "gemini",
    model: "gemini-2.0-flash",
    rawText: JSON.stringify({
      questions: [
        {
          questionText: "In the RBI MPC review, what was the policy repo rate maintained at?",
          questionType: "numerical_data",
          difficulty: "easy",
          options: [
            { label: "A", text: "6.00%" },
            { label: "B", text: "6.25%" },
            { label: "C", text: "6.50%" },
            { label: "D", text: "6.75%" },
            { label: "E", text: "7.00%" },
          ],
          correctAnswer: "C",
          detailedExplanation: "The RBI Monetary Policy Committee kept the policy repo rate unchanged at 6.50%.",
          whyCorrect: "6.50% is directly stated in the RBI MPC decision.",
          whyOthersIncorrect: { B: "6.25% is the SDF rate.", D: "6.75% is the MSF rate." },
          importantFacts: ["Repo Rate: 6.50%", "SDF: 6.25%", "MSF: 6.75%"],
          sourceReference: "RBI MPC Review",
          examRelevance: ["IBPS PO", "SBI PO"],
        },
      ],
    }),
  });

  const qOut = await generateBankingQuestionsWithAi({
    event: analysis.events[0],
    questionFormats: ["numerical_data"],
    difficulty: "easy",
    count: 1,
    providerFn: mockQProvider,
  });
  assert.equal(qOut.questions.length, 1);
  assert.equal(qOut.questions[0].valid, true);
  assert.equal(qOut.questions[0].uncertainFlag, false);

  // Hallucinated number flags uncertainFlag=true
  const ungrounded = validateAiQuestionPayload({
    question: {
      questionText: "What was the RBI repo rate announced in the review?",
      questionType: "numerical_data",
      difficulty: "easy",
      options: [
        { label: "A", text: "9.85%" },
        { label: "B", text: "6.25%" },
        { label: "C", text: "6.50%" },
        { label: "D", text: "6.75%" },
      ],
      correctAnswer: "A",
      detailedExplanation: "Testing ungrounded numeric detection in validator.",
    },
    sourceText: "RBI kept repo rate unchanged at 6.50%.",
  });
  assert.equal(ungrounded.uncertainFlag, true);
});

await test("5. Phase 8 PDF Generation: All 4 A4 PDF formats generate valid, uncorrupted binaries & respect answer hiding", () => {
  const sampleSet = {
    title: "Daily Current Affairs Standard Practice — 24 Nov 2026",
    set_type: "daily_standard",
    date_from: "2026-11-24",
    date_to: "2026-11-24",
    total_marks: 2,
    duration_minutes: 15,
    marks_per_question: 1,
    negative_marking: 0.25,
    target_exams: ["IBPS PO", "SBI PO", "RBI Grade B"],
    instructions: "Attempt all questions carefully. +1 for correct, -0.25 for incorrect.",
  };

  const sampleQuestions = [
    {
      question_text: "In the Monetary Policy Committee review, what was the policy repo rate maintained at by RBI?",
      question_type: "numerical_data",
      difficulty: "easy",
      category_name: "RBI & Monetary Policy",
      options: [
        { option_label: "A", option_text: "6.00%" },
        { option_label: "B", option_text: "6.25%" },
        { option_label: "C", option_text: "6.50%" },
        { option_label: "D", option_text: "6.75%" },
        { option_label: "E", option_text: "7.00%" },
      ],
      correct_answer: "C",
      detailed_explanation: "RBI MPC retained the policy repo rate at 6.50% and shifted stance to neutral.",
      why_correct: "6.50% is the official policy repo rate.",
      why_others_incorrect: { B: "6.25% is SDF rate", D: "6.75% is MSF rate" },
      important_facts: ["Policy Repo Rate: 6.50%", "Monetary Policy Stance: Neutral"],
      source_reference: "RBI Press Release",
    },
    {
      question_text: "The Reserve Bank of India increased the per-transaction limit for UPI123Pay to which amount?",
      question_type: "banking_financial",
      difficulty: "moderate",
      category_name: "Banking & Financial Awareness",
      options: [
        { option_label: "A", option_text: "Rs. 2,000" },
        { option_label: "B", option_text: "Rs. 5,000" },
        { option_label: "C", option_text: "Rs. 10,000" },
        { option_label: "D", option_text: "Rs. 25,000" },
        { option_label: "E", option_text: "Rs. 50,000" },
      ],
      correct_answer: "C",
      detailed_explanation: "RBI enhanced the UPI123Pay per-transaction limit from Rs. 5,000 to Rs. 10,000.",
      why_correct: "Rs. 10,000 is the revised limit.",
      why_others_incorrect: { B: "Rs. 5,000 was the previous limit." },
      important_facts: ["UPI123Pay serves feature phone users", "Revised limit: Rs. 10,000"],
      source_reference: "RBI Statement on Developmental and Regulatory Policies",
    },
  ];

  const outDir = "/tmp/hhk_pdf_qa";
  fs.mkdirSync(outDir, { recursive: true });

  for (const fmt of SUPPORTED_PDF_FORMATS) {
    const out = generatePracticeSetPdf({ practiceSet: sampleSet, questions: sampleQuestions, format: fmt });
    const check = validatePdfBuffer(out.buffer);
    assert.equal(check.valid, true, `PDF ${fmt} failed validation: ${check.reason}`);
    assert.ok(out.fileSizeBytes > 500);
    const pdfStr = out.buffer.toString("latin1");
    if (fmt === "questions_only") {
      assert.equal(pdfStr.includes("OFFICIAL ANSWER KEY"), false, "Questions Only PDF must not contain answer key");
    }
    if (fmt === "answer_key") {
      assert.ok(pdfStr.includes("OFFICIAL ANSWER KEY"));
    }
    if (fmt === "detailed_solutions") {
      assert.ok(pdfStr.includes("DETAILED SOLUTIONS"));
    }
    if (fmt === "complete_booklet") {
      assert.ok(check.pageCount >= 5, `Complete Booklet should have cover + 4 sections (>=5 pages), got ${check.pageCount}`);
    }
    fs.writeFileSync(path.join(outDir, `${fmt}.pdf`), out.buffer);
  }
});

await test("6. Phase 8 & 10 Access Control: Enforces login, published status, free/premium subscriptions & admin preview", async () => {
  const mockDbNoSub = { query: async () => ({ rowCount: 0, rows: [] }) };
  const mockDbActiveSub = { query: async () => ({ rowCount: 1, rows: [{ id: "sub-1", status: "ACTIVE" }] }) };

  const unauth = await evaluateCaPracticeAccess({ db: mockDbNoSub, userId: null, userRole: null, practiceSet: { publication_status: "published", access_tier: "free" } });
  assert.equal(unauth.httpStatus, 401);

  const draft = await evaluateCaPracticeAccess({ db: mockDbNoSub, userId: "u1", userRole: "student", practiceSet: { publication_status: "draft", access_tier: "free" } });
  assert.equal(draft.httpStatus, 404);

  const freeOk = await evaluateCaPracticeAccess({ db: mockDbNoSub, userId: "u1", userRole: "student", practiceSet: { publication_status: "published", access_tier: "free" } });
  assert.equal(freeOk.allowed, true);

  const premDenied = await evaluateCaPracticeAccess({ db: mockDbNoSub, userId: "u1", userRole: "student", practiceSet: { publication_status: "published", access_tier: "premium" } });
  assert.equal(premDenied.httpStatus, 403);

  const premAllowed = await evaluateCaPracticeAccess({ db: mockDbActiveSub, userId: "u1", userRole: "student", practiceSet: { publication_status: "published", access_tier: "premium" } });
  assert.equal(premAllowed.allowed, true);

  const adminOk = await evaluateCaPracticeAccess({ db: mockDbNoSub, userId: "a1", userRole: "admin", practiceSet: { publication_status: "draft", access_tier: "premium" } });
  assert.equal(adminOk.allowed, true);
});

await test("7. Phase 10–13 Integration: Migration 032, server/index.js, AdminOverview.jsx & StudentWorkspace.jsx wired", () => {
  const mig = fs.readFileSync(path.join(projectRoot, "server/migrations/032_ai_ca_question_platform.sql"), "utf8");
  for (const tbl of [
    "ca_categories",
    "ca_sources",
    "ca_daily_batches",
    "ca_articles",
    "ca_events",
    "ca_ai_processing_jobs",
    "ca_generated_questions",
    "ca_question_options",
    "ca_practice_sets",
    "ca_practice_set_questions",
    "ca_student_attempts",
    "ca_student_answers",
    "ca_pdf_exports",
    "ca_admin_reviews",
    "ca_automation_config",
  ]) {
    assert.ok(mig.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`), `Missing table ${tbl} in migration 032`);
  }

  const srv = fs.readFileSync(path.join(projectRoot, "server/index.js"), "utf8");
  assert.ok(srv.includes("/api/ca-practice"));
  assert.ok(srv.includes("/api/admin/ca-studio"));
  assert.equal(srv.includes("currentAffairsStudentRouter"), false);
  assert.equal(srv.includes("currentAffairsAdminRouter"), false);

  const adminOv = fs.readFileSync(path.join(projectRoot, "client/src/AdminOverview.jsx"), "utf8");
  assert.ok(adminOv.includes("AdminCaStudio"));
  assert.equal(adminOv.includes("CurrentAffairsView"), false);

  const sw = fs.readFileSync(path.join(projectRoot, "client/src/StudentWorkspace.jsx"), "utf8");
  assert.ok(sw.includes("StudentCaPractice"));
  assert.equal(sw.includes("StudentCurrentAffairs"), false);
});

console.log(`\n=== AI CA PLATFORM QA SUMMARY: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
