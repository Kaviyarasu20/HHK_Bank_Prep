import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  entailsUnderImplication,
  evaluateConclusionVerdict,
  evaluateQuantClaim,
  isEitherOrUnderImplication,
} from "../server/question-engine/generators/reasoning/statementConclusion/solver.js";
import { generateStatementConclusionBatch } from "../server/question-engine/generators/reasoning/statementConclusion/index.js";
import { validateStatementConclusionQuestion } from "../server/question-engine/generators/reasoning/statementConclusion/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK Statement & Conclusion Question Engine Verification ===\n");

// 1. Formal Solver Unit Tests
{
  // Modus Ponens & Modus Tollens
  assert.equal(entailsUnderImplication("P", "Q"), true);
  assert.equal(entailsUnderImplication("NOT_Q", "NOT_P"), true);
  // Affirming the Consequent & Denying the Antecedent (must be false!)
  assert.equal(entailsUnderImplication("Q", "P"), false);
  assert.equal(entailsUnderImplication("NOT_P", "NOT_Q"), false);
  // Exact Either-Or check
  assert.equal(isEitherOrUnderImplication("Q", "P", "NOT_P"), true);
  assert.equal(isEitherOrUnderImplication("P", "Q", "NOT_Q"), false);

  // Quantitative claim evaluator
  assert.equal(evaluateQuantClaim({ a: 320, b: 200 }, { type: "A_SHARE_GT_50" }), true);
  assert.equal(evaluateQuantClaim({ a: 320, b: 200 }, { type: "TOTAL_GT_T", threshold: 500 }), true);
  assert.equal(evaluateQuantClaim({ a: 320, b: 200 }, { type: "DIFF_GT_D", threshold: 150 }), false);

  assert.equal(evaluateConclusionVerdict({ followsI: false, followsII: false, eitherOr: true }), "EITHER_OR");

  console.log("[PASS] 1. Formal solver unit tests (Modus Ponens/Tollens, Fallacies, Either-Or, Quantitative Entailment)");
}

// 2. Bulk Stress Verification (250 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 50, seed: 171 },
    { difficulty: "Medium", count: 75, seed: 282 },
    { difficulty: "Hard", count: 75, seed: 393 },
    { difficulty: "Medium", count: 10, subtopicName: "Banking Policy", seed: 471 },
    { difficulty: "Medium", count: 10, subtopicName: "Quantitative Data", seed: 472 },
    { difficulty: "Hard", count: 10, subtopicName: "Conditional Logic", seed: 473 },
    { difficulty: "Easy", count: 10, subtopicName: "Civic Policy", seed: 474 },
    { difficulty: "Easy", count: 10, subtopicName: "Corporate Workplace", seed: 475 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateStatementConclusionBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateStatementConclusionQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
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
  const res = generateStatementConclusionBatch({ difficulty: "Medium", count: 20, seed: 969 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Statement & Conclusion"), true);
  assert.equal(isEngineSupportedTopic("statement and conclusion"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Mains",
    topicName: "Statement & Conclusion",
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

console.log("\nALL STATEMENT & CONCLUSION ENGINE CHECKS PASSED (4/4).");
