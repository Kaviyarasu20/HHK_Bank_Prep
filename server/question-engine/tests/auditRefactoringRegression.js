// server/question-engine/tests/auditRefactoringRegression.js
import assert from "node:assert/strict";
import {
  normalizeDifficulty,
  pickWeightedTemplate,
  runPrelimsMainsBatch,
} from "../core/batchUtils.js";
import {
  resolveSubtopicEngineFilter,
  generateFromQuestionEngine,
} from "../core/engineRouter.js";
import {
  SUPPORTED_AUTO_TOPICS,
  isEngineSupportedTopic,
  isTopicAutoGeneratable,
  generateTopicQuestions,
} from "../../services/questionGenerator.js";
import { generateProbabilityBatch } from "../generators/quant/probability/index.js";
import { generatePartnershipBatch } from "../generators/quant/partnership/index.js";
import { generateAgesBatch } from "../generators/quant/problemsOnAges/index.js";
import { generateMixtureAlligationBatch } from "../generators/quant/mixtureAlligation/index.js";
import { generatePncBatch } from "../generators/quant/permutationCombination/index.js";
import { generateTsdBatch } from "../generators/quant/timeSpeedDistance/index.js";
import { generateDIQuestionsForHHK } from "../generators/quant/dataInterpretation/index.js";

console.log("=== HHK QUESTION ENGINE REGRESSION AUDIT ===");

// 1. Unit checks for shared core/batchUtils.js
assert.equal(normalizeDifficulty("easy"), "Easy");
assert.equal(normalizeDifficulty("IBPS Clerk"), "Easy");
assert.equal(normalizeDifficulty("hard"), "Hard");
assert.equal(normalizeDifficulty("SBI PO Mains"), "Hard");
assert.equal(normalizeDifficulty("Medium"), "Medium");
assert.equal(normalizeDifficulty(undefined), "Medium");

const mockPool = [
  { id: "T1", category: "A" },
  { id: "T2", category: "B" },
];
const picked = pickWeightedTemplate(mockPool, { A: 1, B: 9 }, { random: () => 0.5 }, 5);
assert.equal(picked.id, "T2");

const mockPrelimsMains = runPrelimsMainsBatch({
  topicLabel: "Mock",
  prelimsMap: { 1: (exam, diff) => ({ exam, diff, tier: "P" }) },
  mainsMap: { 1: (exam, diff) => ({ exam, diff, tier: "M" }) },
  defaultPrelimsPool: [1],
  defaultMainsPool: [1],
  exam: "IBPS_PO_PRELIMS",
  level: "BOTH",
  difficulty: "MEDIUM",
  count: 4,
});
assert.deepEqual(
  mockPrelimsMains.map((q) => q.tier),
  ["P", "M", "P", "M"]
);
console.log("1. Shared batchUtils unit checks: PASS");

// 2. Determinism checks for all seeded batch generators
const seededGenerators = [
  ["Probability", generateProbabilityBatch, { count: 10, difficulty: "Medium", seed: 424242 }],
  ["Partnership", generatePartnershipBatch, { count: 10, difficulty: "Hard", seed: 424242 }],
  ["Problems on Ages", generateAgesBatch, { count: 10, difficulty: "Easy", seed: 424242 }],
  ["Mixture & Alligation", generateMixtureAlligationBatch, { count: 10, difficulty: "Medium", seed: 424242 }],
  ["Permutation & Combination", generatePncBatch, { count: 10, difficulty: "Hard", seed: 424242 }],
  ["Time, Speed & Distance", generateTsdBatch, { count: 10, difficulty: "Medium", seed: 424242 }],
  ["Data Interpretation", generateDIQuestionsForHHK, { count: 5, difficulty: "Medium", seed: 424242 }],
];

for (const [label, fn, opts] of seededGenerators) {
  const run1 = fn(opts);
  const run2 = fn(opts);
  assert.deepStrictEqual(run1, run2, `Non-deterministic output detected in ${label}`);
}
console.log(`2. Seeded determinism checks (${seededGenerators.length} generators): PASS`);

// 3. Router + questionGenerator API contract check across ALL 26 supported quant topics
assert.equal(isTopicAutoGeneratable, isEngineSupportedTopic);
assert.equal(isEngineSupportedTopic("Unsupported Fictional Topic"), false);

const expectedFourOptionTopics = new Set(["Pipes & Cisterns", "Time, Speed & Distance", "Boats & Streams", "Mixture & Alligation"]);

for (const topic of SUPPORTED_AUTO_TOPICS.quant) {
  assert.equal(isEngineSupportedTopic(topic), true, `Topic not recognized: ${topic}`);
  const filter = resolveSubtopicEngineFilter(topic, "");
  assert.ok(filter && typeof filter.engine === "string", `Invalid router filter for ${topic}`);

  const response = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: topic,
    difficulty: "medium",
    count: 5,
    optionCount: 5,
  });

  assert.equal(response.mode, "standalone");
  assert.equal(response.engine, "HHK_QUESTION_ENGINE_V2");
  assert.equal(response.totalQuestions, 5);
  assert.equal(response.standaloneQuestions.length, 5);

  const expectedOpts = expectedFourOptionTopics.has(topic) ? 4 : 5;
  for (const q of response.standaloneQuestions) {
    assert.ok(q.questionId, `Missing questionId in ${topic}`);
    assert.ok(q.questionText && !q.questionText.includes("NaN") && !q.questionText.includes("undefined"), `Invalid questionText in ${topic}`);
    assert.equal(q.questionType, "mcq");
    assert.equal(q.options.length, expectedOpts, `Unexpected option count in ${topic}: got ${q.options.length}, expected ${expectedOpts}`);
    const optionKeys = q.options.map((o) => o.key);
    assert.ok(optionKeys.includes(q.correctAnswer), `correctAnswer not in option keys for ${topic}`);
    const uniqueOptionTexts = new Set(q.options.map((o) => o.text.trim().toLowerCase()));
    assert.equal(uniqueOptionTexts.size, q.options.length, `Duplicate options in ${topic}`);
    assert.ok(typeof q.explanation === "string" && q.explanation.length > 0, `Missing explanation in ${topic}`);
  }
}
console.log(`3. Full router & API contract checks (${SUPPORTED_AUTO_TOPICS.quant.length} topics): PASS`);

// 4. Verify 4-option formatting mode still works cleanly
const fourOptBatch = generateFromQuestionEngine({
  examCode: "IBPS_CLERK",
  stageName: "Prelims",
  topicName: "Percentage",
  difficulty: "easy",
  count: 5,
  optionCount: 4,
});
assert.equal(fourOptBatch.length, 5);
for (const q of fourOptBatch) {
  assert.equal(q.options.length, 4);
  assert.ok(q.options.some((o) => o.key === q.correctAnswer));
}
console.log("4. 4-option formatting compatibility check: PASS");
console.log("=== ALL REGRESSION CHECKS PASSED (0 ERRORS) ===");
