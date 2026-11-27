import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  clusterGapSignature,
  evalAlphaPairValue,
  findUniqueOddIndex,
  matchesNumberPair,
  matchesNumberProperty,
} from "../server/question-engine/generators/reasoning/classification/solver.js";
import { generateClassificationBatch } from "../server/question-engine/generators/reasoning/classification/index.js";
import { validateClassificationQuestion } from "../server/question-engine/generators/reasoning/classification/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK Classification Question Engine Verification ===\n");

// 1. Formal 4-vs-1 Invariant Solver Unit Tests
{
  assert.equal(
    findUniqueOddIndex([17, 23, 31, 45, 53], (n) => matchesNumberProperty(n, { type: "PRIME" })),
    3,
  );
  assert.equal(
    findUniqueOddIndex(
      [[4, 17], [5, 26], [6, 37], [7, 50], [8, 69]],
      (p) => matchesNumberPair(p, { type: "SQUARE_PLUS_K", k: 1 }),
    ),
    4,
  );
  assert.equal(clusterGapSignature("ACEG"), "2,2,2");
  assert.equal(
    findUniqueOddIndex(["ACEG", "BDFH", "CEGI", "DFHJ", "EGIL"], (cl) => clusterGapSignature(cl) === "2,2,2"),
    4,
  );
  assert.equal(evalAlphaPairValue("BANK", "FWD_SUM"), 28);
  console.log("[PASS] 1. Formal 4-vs-1 invariant unit tests (Number, Number-Pair, Letter-Cluster, Alphanumeric)");
}

// 2. Bulk Stress Verification (500 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 100, seed: 108 },
    { difficulty: "Medium", count: 150, seed: 208 },
    { difficulty: "Hard", count: 150, seed: 308 },
    { difficulty: "Easy", count: 20, subtopicName: "Number Property", seed: 418 },
    { difficulty: "Medium", count: 20, subtopicName: "Number Pair", seed: 419 },
    { difficulty: "Medium", count: 20, subtopicName: "Letter Cluster", seed: 420 },
    { difficulty: "Hard", count: 20, subtopicName: "Alphanumeric Pair", seed: 421 },
    { difficulty: "Easy", count: 20, subtopicName: "Semantic Word", seed: 422 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateClassificationBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateClassificationQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(check.valid, true, `Validation failed: ${check.errors.join("; ")}`);
      subTypeCounts[q.subType] = (subTypeCounts[q.subType] || 0) + 1;
      ansDist[q.correctAnswer] += 1;
      totalVerified += 1;
    }
  }

  assert.equal(totalVerified, 500);
  console.log(`[PASS] 2. Bulk verification: ${totalVerified}/500 questions verified across all 5 subtopics`);
  console.log("       Subtypes:", JSON.stringify(subTypeCounts));
  console.log("       Answer distribution A–E:", JSON.stringify(ansDist));
}

// 3. Performance Benchmark (20-question Medium batch)
{
  const t0 = performance.now();
  const res = generateClassificationBatch({ difficulty: "Medium", count: 20, seed: 998 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration + 100% Reasoning Ability Coverage Audit
{
  const allReasoningTopics = [
    "Puzzles",
    "Seating Arrangement",
    "Syllogism",
    "Inequality",
    "Coding-Decoding",
    "Blood Relations",
    "Direction & Distance",
    "Order & Ranking",
    "Alphanumeric Series",
    "Number Series",
    "Letter Series",
    "Input-Output",
    "Data Sufficiency",
    "Logical Reasoning",
    "Statement & Conclusion",
    "Statement & Assumption",
    "Cause & Effect",
    "Analogy",
    "Classification",
  ];
  for (const t of allReasoningTopics) {
    assert.equal(isEngineSupportedTopic(t), true, `Expected ${t} to be Auto-Generate Ready`);
  }

  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Classification",
    difficulty: "Medium",
    count: 15,
  });
  const generated = generatedRes.standaloneQuestions;
  assert.equal(generated.length, 15);
  for (const q of generated) {
    assert.ok(q.questionText && q.questionText.length > 25);
    assert.ok(Array.isArray(q.options) && q.options.length === 5);
    assert.ok(["A", "B", "C", "D", "E"].includes(q.correctAnswer));
    assert.ok(q.explanation && q.explanation.length > 15);
  }
  const formattedKeys = new Set(generated.map((q) => q.correctAnswer));
  assert.ok(formattedKeys.size >= 3, `Expected varied formatted correctAnswer keys, got ${[...formattedKeys]}`);
  console.log(`[PASS] 4. Full questionGenerator.js integration (15/15 HHK-formatted, keys: ${[...formattedKeys].sort().join(",")}) + 19/19 Reasoning topics 100% Auto-Generate Ready!`);
}

console.log("\nALL CLASSIFICATION ENGINE CHECKS PASSED (4/4).");
