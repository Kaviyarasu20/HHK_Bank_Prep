import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  countValidRankings,
  solveInterchange,
  solveMaxMinOverlap,
  solveMidpointInRow,
  solveOppositeRank,
  solveRatioClassRanking,
  solveTotalFromRanks,
} from "../server/question-engine/generators/reasoning/orderRanking/solver.js";
import { generateOrderRankingBatch } from "../server/question-engine/generators/reasoning/orderRanking/index.js";
import { validateOrderRankingQuestion } from "../server/question-engine/generators/reasoning/orderRanking/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK Order & Ranking Question Engine Verification ===\n");

// 1. Formal Solver Unit Tests
{
  assert.equal(solveTotalFromRanks(14, 21), 34);
  assert.equal(solveOppositeRank(50, 17), 34);

  const inter = solveInterchange(10, 15, 18);
  assert.equal(inter.total, 32);
  assert.equal(inter.newRightB, 23);
  assert.equal(inter.between, 7);

  const mm = solveMaxMinOverlap(14, 18, 5);
  assert.equal(mm.maxTotal, 37);
  assert.equal(mm.minTotal, 25);
  assert.equal(mm.canOverlap, true);

  const mid = solveMidpointInRow(40, 10, 11); // leftB = 30, mid = 20
  assert.equal(mid.midFromLeft, 20);
  assert.equal(mid.midFromRight, 21);

  const ratio = solveRatioClassRanking({
    totalStudents: 60,
    girlsRatio: 2,
    boysRatio: 1,
    targetRankFromTop: 17,
    targetGender: "BOY",
    girlsAhead: 9,
  });
  assert.equal(ratio.totalGirls, 40);
  assert.equal(ratio.totalBoys, 20);
  assert.equal(ratio.boysAhead, 7);
  assert.equal(ratio.boysAfter, 12);

  const sols = countValidRankings(
    ["A", "B", "C", "D"],
    [
      { type: "FIXED_POS", a: "B", pos: 1 },
      { type: "GT", a: "A", b: "B" },
      { type: "GT", a: "B", b: "C" },
      { type: "GT", a: "C", b: "D" },
    ],
    2,
  );
  assert.equal(sols.length, 1);
  assert.deepEqual(sols[0], ["A", "B", "C", "D"]);

  console.log("[PASS] 1. Formal solver unit tests (Total/Rank, Interchange, Max/Min/Midpoint, Ratio, Backtracking Comparison)");
}

// 2. Bulk Stress Verification (500 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 100, seed: 121 },
    { difficulty: "Medium", count: 150, seed: 232 },
    { difficulty: "Hard", count: 150, seed: 343 },
    { difficulty: "Easy", count: 20, subtopicName: "Single-Row Total", seed: 421 },
    { difficulty: "Medium", count: 20, subtopicName: "Interchanging Positions", seed: 422 },
    { difficulty: "Hard", count: 20, subtopicName: "Max/Min Overlap", seed: 423 },
    { difficulty: "Medium", count: 20, subtopicName: "Comparison Ranking", seed: 424 },
    { difficulty: "Hard", count: 20, subtopicName: "Ratio Class Ranking", seed: 425 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateOrderRankingBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateOrderRankingQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
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
  const res = generateOrderRankingBatch({ difficulty: "Medium", count: 20, seed: 919 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Order & Ranking"), true);
  assert.equal(isEngineSupportedTopic("order and ranking"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Order & Ranking",
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
  console.log(`[PASS] 4. Full questionGenerator.js integration (15/15 HHK-formatted questions, keys: ${[...formattedKeys].sort().join(",")})`);
}

console.log("\nALL ORDER & RANKING ENGINE CHECKS PASSED (4/4).");
