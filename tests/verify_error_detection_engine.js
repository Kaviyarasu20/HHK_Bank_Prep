import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  assembleErrorDetectionItem,
  verifySingleErrorInvariant,
} from "../server/question-engine/generators/english/errorDetection/solver.js";
import { generateErrorDetectionBatch } from "../server/question-engine/generators/english/errorDetection/index.js";
import { validateErrorDetectionQuestion } from "../server/question-engine/generators/english/errorDetection/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK English Language — Error Detection Engine Verification ===\n");

// 1. Formal Single-Error Invariant Unit Tests
{
  const errItem = assembleErrorDetectionItem({
    segments: ["One of the reports", "submitted yesterday", "has been approved", "by the board."],
    errorSlot: 2,
    errorVariant: "have been approved",
    ruleCode: "SVA_ONE_OF",
    correction: "Use 'has been'.",
  });
  assert.equal(errItem.correctAnswer, "C");
  assert.equal(verifySingleErrorInvariant(errItem).valid, true);

  const noErrItem = assembleErrorDetectionItem({
    segments: ["One of the reports", "submitted yesterday", "has been approved", "by the board."],
    errorSlot: 4,
    errorVariant: "have been approved",
    ruleCode: "SVA_ONE_OF",
    correction: "No error.",
  });
  assert.equal(noErrItem.correctAnswer, "E");
  assert.equal(verifySingleErrorInvariant(noErrItem).valid, true);
  console.log("[PASS] 1. Single-error & No-Error invariant unit tests");
}

// 2. Bulk Stress Verification (150 questions across Easy/Medium/Hard & all 5 grammar families)
{
  const batches = [
    { difficulty: "Easy", count: 30, seed: 501 },
    { difficulty: "Medium", count: 40, seed: 502 },
    { difficulty: "Hard", count: 40, seed: 503 },
    { difficulty: "Medium", count: 8, subtopicName: "Subject Verb Agreement", seed: 511 },
    { difficulty: "Hard", count: 8, subtopicName: "Tenses Conditionals", seed: 512 },
    { difficulty: "Medium", count: 8, subtopicName: "Prepositions Phrasal", seed: 513 },
    { difficulty: "Easy", count: 8, subtopicName: "Pronouns Modifiers", seed: 514 },
    { difficulty: "Hard", count: 8, subtopicName: "Parallelism Conjunctions", seed: 515 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateErrorDetectionBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateErrorDetectionQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(check.valid, true, `Validation failed: ${check.errors.join("; ")}`);
      subTypeCounts[q.subType] = (subTypeCounts[q.subType] || 0) + 1;
      ansDist[q.correctAnswer] += 1;
      totalVerified += 1;
    }
  }

  assert.equal(totalVerified, 150);
  console.log(`[PASS] 2. Bulk verification: ${totalVerified}/150 questions verified across all 5 grammar families`);
  console.log("       Families:", JSON.stringify(subTypeCounts));
  console.log("       Answer distribution A–E:", JSON.stringify(ansDist));
}

// 3. Performance Benchmark (20-question Medium batch)
{
  const t0 = performance.now();
  const res = generateErrorDetectionBatch({ difficulty: "Medium", count: 20, seed: 991 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Error Detection"), true);
  assert.equal(isEngineSupportedTopic("error detection"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Error Detection",
    difficulty: "Medium",
    count: 15,
  });
  const generated = generatedRes.standaloneQuestions;
  assert.equal(generated.length, 15);
  for (const q of generated) {
    assert.ok(q.questionText && q.questionText.length > 40);
    assert.ok(Array.isArray(q.options) && q.options.length === 5);
    assert.ok(["A", "B", "C", "D", "E"].includes(q.correctAnswer));
    assert.ok(q.explanation && q.explanation.length > 15);
  }
  const formattedKeys = new Set(generated.map((q) => q.correctAnswer));
  assert.ok(formattedKeys.size >= 3, `Expected varied formatted correctAnswer keys, got ${[...formattedKeys]}`);
  console.log(`[PASS] 4. Full questionGenerator.js integration (15/15 HHK-formatted questions, keys: ${[...formattedKeys].sort().join(",")})`);
}

console.log("\nALL ENGLISH ERROR DETECTION ENGINE CHECKS PASSED (4/4).");
