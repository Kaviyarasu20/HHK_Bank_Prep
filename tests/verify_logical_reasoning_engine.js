import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  evaluateDualVerdict,
  evaluateEligibilityDecision,
} from "../server/question-engine/generators/reasoning/logicalReasoning/solver.js";
import { generateLogicalReasoningBatch } from "../server/question-engine/generators/reasoning/logicalReasoning/index.js";
import { validateLogicalReasoningQuestion } from "../server/question-engine/generators/reasoning/logicalReasoning/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK Logical Reasoning Question Engine Verification ===\n");

// 1. Formal Solver Unit Tests
{
  assert.equal(evaluateDualVerdict({ validI: true, validII: false }), "ONLY_I");
  assert.equal(evaluateDualVerdict({ validI: false, validII: true }), "ONLY_II");
  assert.equal(evaluateDualVerdict({ validI: false, validII: false }), "NEITHER");
  assert.equal(evaluateDualVerdict({ validI: true, validII: true }), "BOTH");
  assert.equal(evaluateDualVerdict({ validI: true, validII: true, mutuallyExclusive: true }), "EITHER_OR");

  const rules = { minAge: 22, maxAge: 30, minGrad: 60, minTest: 70, minExp: 2, minPg: 65, highTest: 85 };
  assert.equal(evaluateEligibilityDecision({ age: 25, gradPct: 68, testPct: 75, expYears: 3, pgPct: null }, rules), "SELECT");
  assert.equal(evaluateEligibilityDecision({ age: 25, gradPct: 55, testPct: 75, expYears: 3, pgPct: 70 }, rules), "REFER_GM");
  assert.equal(evaluateEligibilityDecision({ age: 25, gradPct: 68, testPct: 88, expYears: 1, pgPct: null }, rules), "REFER_HR");
  assert.equal(evaluateEligibilityDecision({ age: 33, gradPct: 72, testPct: 90, expYears: 4, pgPct: 75 }, rules), "REJECT");
  assert.equal(evaluateEligibilityDecision({ age: null, gradPct: 68, testPct: 75, expYears: 3, pgPct: null }, rules), "DATA_INADEQUATE");
  assert.equal(evaluateEligibilityDecision({ age: 25, gradPct: 55, testPct: 75, expYears: 3, pgPct: null }, rules), "DATA_INADEQUATE");

  console.log("[PASS] 1. Formal evaluator unit tests (Dual Verdict & Eligibility Logic Gate)");
}

// 2. Bulk Stress Verification (250 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 50, seed: 161 },
    { difficulty: "Medium", count: 75, seed: 272 },
    { difficulty: "Hard", count: 75, seed: 383 },
    { difficulty: "Medium", count: 10, subtopicName: "Course of Action", seed: 461 },
    { difficulty: "Medium", count: 10, subtopicName: "Strong Weak Arguments", seed: 462 },
    { difficulty: "Hard", count: 10, subtopicName: "Passage Inference", seed: 463 },
    { difficulty: "Hard", count: 10, subtopicName: "Strengthen Weaken", seed: 464 },
    { difficulty: "Medium", count: 10, subtopicName: "Decision Making Eligibility", seed: 465 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateLogicalReasoningBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateLogicalReasoningQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(check.valid, true, `Validation failed: ${check.errors.join("; ")}`);
      subTypeCounts[q.subType] = (subTypeCounts[q.subType] || 0) + 1;
      ansDist[q.correctAnswer] += 1;
      totalVerified += 1;
    }
  }

  assert.equal(totalVerified, 250);
  console.log(`[PASS] 2. Bulk verification: ${totalVerified}/250 questions verified across all 5 subtopics`);
  console.log("       Subtypes:", JSON.stringify(subTypeCounts));
  console.log("       Answer distribution A–E:", JSON.stringify(ansDist));
}

// 3. Performance Benchmark (20-question Medium batch)
{
  const t0 = performance.now();
  const res = generateLogicalReasoningBatch({ difficulty: "Medium", count: 20, seed: 959 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Logical Reasoning"), true);
  assert.equal(isEngineSupportedTopic("logical reasoning"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Mains",
    topicName: "Logical Reasoning",
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

console.log("\nALL LOGICAL REASONING ENGINE CHECKS PASSED (4/4).");
