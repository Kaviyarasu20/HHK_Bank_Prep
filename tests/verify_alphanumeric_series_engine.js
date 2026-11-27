import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  alphabeticalGapBetween,
  applyMainsSteps,
  countPrecededFollowed,
  solveDropAndFind,
  solvePositionalNav,
  transformThreeDigitNumber,
  transformWordVowelConsonant,
} from "../server/question-engine/generators/reasoning/alphanumericSeries/solver.js";
import { generateAlphanumericSeriesBatch } from "../server/question-engine/generators/reasoning/alphanumericSeries/index.js";
import { validateAlphanumericQuestion } from "../server/question-engine/generators/reasoning/alphanumericSeries/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK Alphanumeric Series Question Engine Verification ===\n");

// 1. Formal Solver Unit Tests
{
  const seq = ["R", "4", "@", "K", "7", "#", "E", "2", "$", "M"];
  const m = countPrecededFollowed(seq, "NUMBER", "SYMBOL", "LETTER");
  assert.equal(m.length, 3); // 4@K, 7#E, 2$M

  const drop = solveDropAndFind(seq, "SYMBOL", 3, "LEFT");
  assert.equal(drop.element, "K"); // R, 4, K, 7, E, 2, M

  const nav = solvePositionalNav(seq, "LEFT_OF_RIGHT", 2, 3); // 5th from right = 6th from left = "#"
  assert.equal(nav.element, "#");

  assert.equal(transformThreeDigitNumber(472, "SWAP_FIRST_THIRD"), 274);
  assert.equal(transformThreeDigitNumber(472, "SORT_DIGITS_DESC"), 742);
  assert.equal(transformThreeDigitNumber(472, "EVEN_PLUS_1_ODD_MINUS_1"), 563);

  assert.equal(transformWordVowelConsonant("CAT", 1, -1), "BBS");
  assert.equal(alphabeticalGapBetween("A", "E"), 3);

  const mains = applyMainsSteps(["@", "4", "E", "K", "2"], [
    "SWAP_SYMBOL_FOLLOWED_BY_NUMBER",
    "DROP_VOWELS_BEFORE_CONSONANT",
    "MOVE_EVEN_NUMBERS_TO_RIGHT_ASC",
  ]);
  // Step 1: 4 @ E K 2 -> Step 2: 4 @ K 2 -> Step 3: @ K 2 4
  assert.deepEqual(mains.finalSeq, ["@", "K", "2", "4"]);

  console.log("[PASS] 1. Formal solver unit tests (Preceded/Followed, Drop, Positional Nav, 3-Digit, 3-Letter, Mains Steps)");
}

// 2. Bulk Stress Verification (500 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 100, seed: 131 },
    { difficulty: "Medium", count: 150, seed: 242 },
    { difficulty: "Hard", count: 150, seed: 353 },
    { difficulty: "Easy", count: 20, subtopicName: "Symbol Preceded Followed", seed: 431 },
    { difficulty: "Easy", count: 20, subtopicName: "Positional Navigation Midway", seed: 432 },
    { difficulty: "Medium", count: 20, subtopicName: "3-Digit Number Ops", seed: 433 },
    { difficulty: "Medium", count: 20, subtopicName: "3-Letter Word Ops", seed: 434 },
    { difficulty: "Hard", count: 20, subtopicName: "Step Mains Transformation", seed: 435 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateAlphanumericSeriesBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateAlphanumericQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
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
  const res = generateAlphanumericSeriesBatch({ difficulty: "Medium", count: 20, seed: 929 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Alphanumeric Series"), true);
  assert.equal(isEngineSupportedTopic("alphanumeric"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Alphanumeric Series",
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

console.log("\nALL ALPHANUMERIC SERIES ENGINE CHECKS PASSED (4/4).");
