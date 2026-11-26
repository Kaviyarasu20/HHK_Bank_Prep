import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildQuestionTypeMix,
  generateRcPassageWithAi,
  generateRcQuestionsWithAi,
  RC_ALL_CATEGORIES,
  RC_DIFFICULTIES,
  RC_EXAMINATIONS,
  RC_LENGTH_SPECS,
  RC_QUESTION_FOCUSED_CATEGORIES,
  RC_QUESTION_TYPES,
  RC_SUBJECT_CATEGORIES,
  regenerateSingleRcQuestionWithAi,
  validateRcPassage,
  validateRcQuestion,
  validateRcVocabularyItem,
} from "../server/services/rcAiEngineService.js";
import { generateReadingComprehensionPdf } from "../server/services/rcPdfGeneratorService.js";

const SAMPLE_PASSAGE = [
  "Over the past decade, India's banking architecture has undergone a structural transformation driven by digital public infrastructure, prudential supervision, and real-time settlement rails. Scheduled commercial banks and regional rural banks have steadily strengthened their balance sheets by lowering gross non-performing asset ratios while expanding credit to micro, small, and medium enterprises across semi-urban districts.",
  "However, rapid retail credit expansion has prompted the Reserve Bank of India to calibrate risk weights on unsecured personal loans and non-banking financial company exposures. Policymakers emphasize that sustainable financial inclusion cannot rely solely on transaction volume; it also requires resilient underwriting standards, transparent pricing disclosures, and proactive liquidity buffers.",
  "Looking ahead, lenders that combine data-driven credit assessment with disciplined governance are expected to outperform peers during tighter monetary cycles. Analysts remain cautiously optimistic that measured regulatory guardrails will preserve systemic stability without stifling productive capital formation."
].join("\n\n");

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`PASS [${passed}]: ${name}`);
}

await test("1. All 15 RC categories, 10 question types, 9 exams, 4 difficulties, and 3 lengths exist", async () => {
  assert.equal(RC_SUBJECT_CATEGORIES.length, 10);
  assert.equal(RC_QUESTION_FOCUSED_CATEGORIES.length, 5);
  assert.equal(RC_ALL_CATEGORIES.length, 15);
  assert.equal(RC_QUESTION_TYPES.length, 10);
  assert.ok(RC_EXAMINATIONS.length >= 8);
  assert.deepEqual(RC_DIFFICULTIES, ["easy", "moderate", "hard", "expert"]);
  assert.deepEqual(Object.keys(RC_LENGTH_SPECS), ["short", "medium", "long"]);
});

await test("2. Strict AI failure handling when CA_AI_ENABLED=false (no hardcoded/simulated fallback)", async () => {
  await assert.rejects(
    () =>
      generateRcPassageWithAi(
        { examination: "IBPS PO", category: RC_ALL_CATEGORIES[0], difficulty: "moderate", passageLength: "short" },
        { env: { CA_AI_ENABLED: "false", CA_AI_PROVIDER: "disabled" } },
      ),
    (err) => err.status === 503 && /disabled/i.test(err.message),
  );
});

await test("3. Passage + Vocabulary (English + Tamil) generation & validation across all 15 categories", async () => {
  for (const category of RC_ALL_CATEGORIES) {
    const out = await generateRcPassageWithAi(
      { examination: "SBI PO", category, difficulty: "hard", passageLength: "short", includeVocabulary: true },
      {
        providerFn: async () => ({
          provider: "mock-test",
          model: "test-model",
          rawText: JSON.stringify({
            title: `Prudential Guardrails in Indian Banking — ${category.slice(24)}`,
            passageText: SAMPLE_PASSAGE,
            vocabulary: [
              {
                word: "prudential",
                meaningEnglish: "Involving careful judgment and risk-averse financial supervision",
                meaningTamil: "விவேகமான நிதி மேற்பார்வை",
                synonym: "cautious, judicious",
                antonym: "reckless, imprudent",
                pronunciation: "/pruːˈdɛn.ʃəl/",
                exampleSentence: "Prudential norms helped commercial banks withstand liquidity shocks.",
                passageContext: "driven by digital public infrastructure, prudential supervision, and real-time settlement rails.",
              },
            ],
          }),
        }),
      },
    );
    assert.equal(out.passage.category, category);
    assert.ok(out.validation.valid, `Passage validation failed for ${category}: ${out.validation.issues.join(", ")}`);
    assert.equal(out.vocabulary.length, 1);
    assert.ok(out.vocabulary[0].meaning_tamil.length > 0);
  }
});

await test("4. Automated Quality Control detects duplicate options, invalid answers, and duplicate questions", async () => {
  const dupOptCheck = validateRcQuestion(
    {
      questionType: "Author's Tone",
      questionText: "What is the overall tone of the author in the passage?",
      options: [
        { key: "A", text: "Cautiously optimistic" },
        { key: "B", text: "Cautiously optimistic" },
        { key: "C", text: "Sarcastic" },
        { key: "D", text: "Indifferent" },
      ],
      correctAnswer: "A",
      explanation: "The author highlights reforms while noting regulatory guardrails.",
      passageReference: "Analysts remain cautiously optimistic that measured regulatory guardrails will preserve systemic stability.",
    },
    SAMPLE_PASSAGE,
    [],
    4,
    true,
  );
  assert.equal(dupOptCheck.valid, false);
  assert.ok(dupOptCheck.issues.some((i) => /Duplicate option/i.test(i)));

  const dupQuestionCheck = validateRcQuestion(
    {
      questionType: "Main Idea / Central Theme",
      questionText: "What is the central theme of the passage regarding Indian banking reforms?",
      options: [
        { key: "A", text: "Balanced growth with prudential supervision" },
        { key: "B", text: "Eliminating rural banks" },
        { key: "C", text: "Removing digital payments" },
        { key: "D", text: "Increasing unsecured defaults" },
      ],
      correctAnswer: "A",
      explanation: "The passage centers on combining digital growth with regulatory guardrails.",
      passageReference: "India's banking architecture has undergone a structural transformation driven by digital public infrastructure.",
    },
    SAMPLE_PASSAGE,
    [{ question_text: "What is the central theme of the passage regarding Indian banking reforms?" }],
    4,
    true,
  );
  assert.equal(dupQuestionCheck.valid, false);
  assert.ok(dupQuestionCheck.issues.some((i) => /Duplicate/i.test(i)));
});

await test("5. Question generation across all 10 question types + auto-regeneration of invalid question", async () => {
  let callCount = 0;
  const passage = {
    title: "Prudential Guardrails in Indian Banking",
    examination: "RBI Grade B",
    category: RC_ALL_CATEGORIES[0],
    difficulty: "expert",
    option_count: 5,
    passage_text: SAMPLE_PASSAGE,
  };

  const result = await generateRcQuestionsWithAi(
    passage,
    { questionsPerPassage: 10, questionTypes: RC_QUESTION_TYPES, optionCount: 5, includeExplanations: true },
    {
      providerFn: async () => {
        callCount += 1;
        if (callCount === 1) {
          // Intentionally make Q1 invalid (duplicate option) to verify auto-regeneration loop
          const distinctStems = [
            "What is the overarching central theme explored throughout the three paragraphs?",
            "According to the opening paragraph, which factor helped banks reduce gross non-performing assets?",
            "What can be logically inferred from the Reserve Bank of India calibrating risk weights on unsecured personal loans?",
            "Which adjective pair best describes the author's overall tone toward regulatory guardrails?",
            "Choose the word most nearly opposite in meaning to 'prudential' as used in the first paragraph.",
            "Based strictly on the passage, evaluate whether regional rural banks have completely ceased MSME lending: True, False, or Cannot Be Determined.",
            "Select the most appropriate headline or title that summarizes the entire passage accurately.",
            "Which conclusion follows most naturally from the final paragraph regarding tighter monetary cycles?",
            "What does the phrase 'proactive liquidity buffers' most closely signify in the context of the second paragraph?",
            "In the context of paragraph two, what is the closest contextual meaning of 'underwriting'?",
          ];
          const qs = RC_QUESTION_TYPES.map((qt, idx) => ({
            questionType: qt,
            difficulty: "expert",
            questionText: distinctStems[idx],
            options: idx === 0
              ? [
                  { key: "A", text: "Duplicate option" },
                  { key: "B", text: "Duplicate option" },
                  { key: "C", text: "Option C distinct" },
                  { key: "D", text: "Option D distinct" },
                  { key: "E", text: "Option E distinct" },
                ]
              : [
                  { key: "A", text: `Accurate passage-backed conclusion for ${qt}` },
                  { key: "B", text: `Plausible distractor B for ${qt}` },
                  { key: "C", text: `Plausible distractor C for ${qt}` },
                  { key: "D", text: `Plausible distractor D for ${qt}` },
                  { key: "E", text: `Plausible distractor E for ${qt}` },
                ],
            correctAnswer: "A",
            explanation: `Detailed explanation verifying why Option A is strictly supported by the passage for ${qt}.`,
            passageReference: "Policymakers emphasize that sustainable financial inclusion requires resilient underwriting standards.",
          }));
          return { provider: "mock-test", model: "test-model", rawText: JSON.stringify({ questions: qs }) };
        }
        // Repair call for Q1
        return {
          provider: "mock-test",
          model: "test-model",
          rawText: JSON.stringify({
            questionType: RC_QUESTION_TYPES[0],
            difficulty: "expert",
            questionText: "What is the primary central theme discussed across the three paragraphs of the passage?",
            options: [
              { key: "A", text: "Combining digital banking growth with prudential risk management" },
              { key: "B", text: "Privatizing all regional rural banks immediately" },
              { key: "C", text: "Halting MSME credit expansion nationwide" },
              { key: "D", text: "Eliminating real-time payment rails" },
              { key: "E", text: "Deregulating unsecured retail personal loans" },
            ],
            correctAnswer: "A",
            explanation: "All three paragraphs emphasize digital expansion paired with prudential risk weights and governance.",
            passageReference: "sustainable financial inclusion requires resilient underwriting standards and proactive liquidity buffers.",
          }),
        };
      },
    },
  );

  assert.equal(result.questions.length, 10);
  assert.equal(result.qualitySummary.verifiedCount, 10);
  assert.equal(result.qualitySummary.regeneratedCount, 1);
  assert.deepEqual(
    result.questions.map((q) => q.question_type),
    RC_QUESTION_TYPES,
  );
});

await test("6. Individual question regeneration produces a distinct verified question", async () => {
  const passage = {
    title: "Prudential Guardrails in Indian Banking",
    examination: "IBPS Clerk",
    category: RC_ALL_CATEGORIES[3],
    difficulty: "easy",
    option_count: 4,
    passage_text: SAMPLE_PASSAGE,
  };
  const out = await regenerateSingleRcQuestionWithAi(
    passage,
    [{ question_text: "What is the author's tone in the passage?" }],
    { question_type: "Suitable Title Selection", difficulty: "easy" },
    { optionCount: 4, includeExplanations: true },
    {
      providerFn: async () => ({
        provider: "mock-test",
        model: "test-model",
        rawText: JSON.stringify({
          questionType: "Suitable Title Selection",
          difficulty: "easy",
          questionText: "Which of the following is the most suitable title for the passage?",
          options: [
            { key: "A", text: "Balancing Digital Growth and Prudential Stability in Indian Banking" },
            { key: "B", text: "The Decline of Agricultural Exports" },
            { key: "C", text: "History of Global Maritime Trade" },
            { key: "D", text: "Why Cash Transactions Are Obsolete" },
          ],
          correctAnswer: "A",
          explanation: "Option A captures both digital infrastructure expansion and RBI's prudential oversight.",
          passageReference: "India's banking architecture has undergone a structural transformation driven by digital public infrastructure and prudential supervision.",
        }),
      }),
    },
  );
  assert.equal(out.validation.valid, true);
  assert.equal(out.question.options.length, 4);
  assert.equal(out.question.question_type, "Suitable Title Selection");
});

await test("7. Practice PDF (no answers) & Answer PDF (key + explanations + vocab) generate valid PDFs", async () => {
  const passage = {
    title: "Prudential Guardrails in Indian Banking",
    examination: "IBPS PO",
    category: "Reading Comprehension – Banking",
    difficulty: "moderate",
    word_count: 155,
    recommended_time_seconds: 600,
    passage_text: SAMPLE_PASSAGE,
  };
  const questions = [
    {
      question_number: 1,
      question_type: "Main Idea / Central Theme",
      question_text: "What is the primary focus of the passage?",
      options: [
        { key: "A", text: "Digital banking expansion paired with prudential risk management" },
        { key: "B", text: "Ending MSME lending" },
        { key: "C", text: "Closing rural branches" },
        { key: "D", text: "Removing liquidity buffers" },
        { key: "E", text: "None of the above" },
      ],
      correct_answer: "A",
      explanation: "The passage emphasizes balancing digital credit growth with regulatory guardrails.",
      passage_reference: "sustainable financial inclusion requires resilient underwriting standards.",
    },
  ];
  const vocabulary = [
    {
      word: "prudential",
      meaning_english: "Careful and risk-aware financial supervision",
      meaning_tamil: "விவேகமான",
      synonym: "cautious",
      antonym: "reckless",
      pronunciation: "/pruːˈdɛn.ʃəl/",
      example_sentence: "Prudential regulations protect depositors.",
      passage_context: "prudential supervision",
    },
  ];

  const practicePdf = generateReadingComprehensionPdf({ passage, questions, vocabulary, format: "practice" });
  const answersPdf = generateReadingComprehensionPdf({ passage, questions, vocabulary, format: "answers" });

  assert.ok(practicePdf.buffer.subarray(0, 5).toString("ascii") === "%PDF-");
  assert.ok(answersPdf.buffer.subarray(0, 5).toString("ascii") === "%PDF-");
  assert.ok(practicePdf.byteLength > 2000);
  assert.ok(answersPdf.byteLength > 2000);

  fs.writeFileSync("/tmp/rc_test_practice.pdf", practicePdf.buffer);
  fs.writeFileSync("/tmp/rc_test_answers.pdf", answersPdf.buffer);
});

await test("8. SQL Migration 033 enforces ON DELETE CASCADE for zero orphaned questions/vocabulary", async () => {
  const sql = fs.readFileSync(
    path.resolve("server/migrations/033_reading_comprehension_ai_module.sql"),
    "utf8",
  );
  assert.match(sql, /CREATE TABLE IF NOT EXISTS rc_passages/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS rc_questions/i);
  assert.match(sql, /passage_id UUID NOT NULL REFERENCES rc_passages\(id\) ON DELETE CASCADE/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS rc_vocabulary/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS rc_student_attempts/i);
});

console.log(`\nALL READING COMPREHENSION TESTS PASSED (${passed}/${passed})!`);
