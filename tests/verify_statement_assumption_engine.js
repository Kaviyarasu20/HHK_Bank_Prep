import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { evaluateAssumptionVerdict } from "../server/question-engine/generators/reasoning/statementAssumption/solver.js";
import { generateStatementAssumptionBatch } from "../server/question-engine/generators/reasoning/statementAssumption/index.js";
import { validateStatementAssumptionQuestion } from "../server/question-engine/generators/reasoning/statementAssumption/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK Statement & Assumption Question Engine Verification ===\n");

// 1. Formal Evaluator Unit Tests
{
  assert.equal(evaluateAssumptionVerdict({ implicitI: true, implicitII: false }), "ONLY_I");
  assert.equal(evaluateAssumptionVerdict({ implicitI: false, implicitII: true }), "ONLY_II");
  assert.equal(evaluateAssumptionVerdict({ implicitI: false, implicitII: false }), "NEITHER");
  assert.equal(evaluateAssumptionVerdict({ implicitI: true, implicitII: true }), "BOTH");
  assert.equal(evaluateAssumptionVerdict({ implicitI: false, implicitII: false, eitherOr: true }), "EITHER_OR");
  console.log("[PASS] 1. Formal assumption evaluator unit tests");
}

// 2. Bulk Stress Verification (250 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 50, seed: 181 },
    { difficulty: "Medium", count: 75, seed: 292 },
    { difficulty: "Hard", count: 75, seed: 394 },
    { difficulty: "Easy", count: 10, subtopicName: "Public Notice Warning", seed: 481 },
    { difficulty: "Medium", count: 10, subtopicName: "Banking Offer", seed: 482 },
    { difficulty: "Medium", count: 10, subtopicName: "Policy Directive", seed: 483 },
    { difficulty: "Hard", count: 10, subtopicName: "Management Decision", seed: 484 },
    { difficulty: "Hard", count: 10, subtopicName: "Threshold Policy", seed: 485 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateStatementAssumptionBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateStatementAssumptionQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
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
  const res = generateStatementAssumptionBatch({ difficulty: "Medium", count: 20, seed: 979 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Statement & Assumption"), true);
  assert.equal(isEngineSupportedTopic("statement and assumption"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Mains",
    topicName: "Statement & Assumption",
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

console.log("\nALL STATEMENT & ASSUMPTION ENGINE CHECKS PASSED (4/4).");
