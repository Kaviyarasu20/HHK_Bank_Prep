import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  applyFillToTemplate,
  buildHalfReversedAlphabet,
  extractFillChars,
  findAlphabeticalPairs,
  generateClusterSequence,
  generateSingleLetterSequence,
} from "../server/question-engine/generators/reasoning/letterSeries/solver.js";
import { generateLetterSeriesBatch } from "../server/question-engine/generators/reasoning/letterSeries/index.js";
import { validateLetterSeriesQuestion } from "../server/question-engine/generators/reasoning/letterSeries/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK Letter Series Question Engine Verification ===\n");

// 1. Formal Solver Unit Tests
{
  const seq1 = generateSingleLetterSequence({ type: "PROGRESSIVE_DIFF", start: 2, d0: 3, step: 1 }, 6);
  // B(2), E(5), I(9), N(14), T(20), A(27->1)
  assert.deepEqual(seq1, ["B", "E", "I", "N", "T", "A"]);

  const cl = generateClusterSequence([1, 3, 6], [3, 3, 3], 4);
  assert.deepEqual(cl, ["ACF", "DFI", "GIL", "JLO"]);

  const filled = applyFillToTemplate("ab_da_cd", extractFillChars("abcdabcd", [2, 5]));
  assert.equal(filled, "abcdabcd");

  // BANKING: B(2) A(1) N(14) K(11) I(9) N(14) G(7)
  // B(0)-A(1): |1-2|=1 -> Backward
  // I(4)-G(6): |7-9|=2 -> Backward
  const pairs = findAlphabeticalPairs("BANKING");
  assert.equal(pairs.length, 2);

  const halfRev = buildHalfReversedAlphabet("FIRST_HALF");
  assert.equal(halfRev[0], "M");
  assert.equal(halfRev[12], "A");
  assert.equal(halfRev[13], "N");

  console.log("[PASS] 1. Formal solver unit tests (Single Letter, Clusters, Pattern Fill, Alpha Pairs, Half-Reverse)");
}

// 2. Bulk Stress Verification (500 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 100, seed: 141 },
    { difficulty: "Medium", count: 150, seed: 252 },
    { difficulty: "Hard", count: 150, seed: 363 },
    { difficulty: "Easy", count: 20, subtopicName: "Single Letter Progressive", seed: 441 },
    { difficulty: "Medium", count: 20, subtopicName: "Letter Cluster Triplet", seed: 442 },
    { difficulty: "Medium", count: 20, subtopicName: "Continuous Repeating Fill", seed: 443 },
    { difficulty: "Hard", count: 20, subtopicName: "Wrong Term Cluster", seed: 444 },
    { difficulty: "Medium", count: 20, subtopicName: "Alphabetical Pair Half", seed: 445 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateLetterSeriesBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateLetterSeriesQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
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
  const res = generateLetterSeriesBatch({ difficulty: "Medium", count: 20, seed: 939 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Letter Series"), true);
  assert.equal(isEngineSupportedTopic("letter series"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Letter Series",
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

console.log("\nALL LETTER SERIES ENGINE CHECKS PASSED (4/4).");
