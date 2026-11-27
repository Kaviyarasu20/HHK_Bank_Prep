import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  evaluateWordUsageTriple,
  verifyWordUsageIntegrity,
  WORD_USAGE_TRIPLE_OPTIONS,
} from "../server/question-engine/generators/english/wordUsage/solver.js";
import { generateWordUsageBatch } from "../server/question-engine/generators/english/wordUsage/index.js";
import { validateWordUsageQuestion } from "../server/question-engine/generators/english/wordUsage/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK English Language — Word Usage Engine Verification ===\n");

// 1. Formal Verifier Unit Tests
{
  assert.equal(evaluateWordUsageTriple(true, false, false), "Only I");
  assert.equal(evaluateWordUsageTriple(true, true, false), "Both I and II");
  assert.equal(evaluateWordUsageTriple(true, true, true), "All I, II and III");
  assert.equal(
    verifyWordUsageIntegrity({
      mode: "TRIPLE_SENTENCE_USAGE",
      options: WORD_USAGE_TRIPLE_OPTIONS,
      correctIndex: 3,
      tripleMask: [false, true, true],
    }).valid,
    true,
  );
  console.log("[PASS] 1. Triple-sentence & 1-of-5 usage verifier unit tests");
}

// 2. Bulk Stress Verification (100 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 20, seed: 981 },
    { difficulty: "Medium", count: 25, seed: 982 },
    { difficulty: "Hard", count: 25, seed: 983 },
    { difficulty: "Medium", count: 8, subtopicName: "Triple Sentence", seed: 984 },
    { difficulty: "Hard", count: 6, subtopicName: "Incorrect Outlier", seed: 985 },
    { difficulty: "Hard", count: 4, subtopicName: "Polysemy Match", seed: 986 },
    { difficulty: "Easy", count: 7, subtopicName: "Contextual Appropriateness", seed: 987 },
    { difficulty: "Medium", count: 5, subtopicName: "Dual Context", seed: 988 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateWordUsageBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateWordUsageQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(check.valid, true, `Validation failed: ${check.errors.join("; ")}`);
      subTypeCounts[q.subType] = (subTypeCounts[q.subType] || 0) + 1;
      ansDist[q.correctAnswer] += 1;
      totalVerified += 1;
    }
  }

  assert.equal(totalVerified, 100);
  console.log(`[PASS] 2. Bulk verification: ${totalVerified}/100 questions verified across all 5 subtopics`);
  console.log("       Subtopics:", JSON.stringify(subTypeCounts));
  console.log("       Answer distribution A–E:", JSON.stringify(ansDist));
}

// 3. Performance Benchmark (20-question Medium batch)
{
  const t0 = performance.now();
  const res = generateWordUsageBatch({ difficulty: "Medium", count: 20, seed: 993 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Word Usage"), true);
  assert.equal(isEngineSupportedTopic("word usage"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Word Usage",
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

console.log("\nALL ENGLISH WORD USAGE ENGINE CHECKS PASSED (4/4).");
