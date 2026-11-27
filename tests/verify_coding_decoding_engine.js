import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  encodeLetterShift,
  encodeNumberCoding,
  evaluateConditionalCode,
  evaluateNewPatternWord,
  solveChineseCoding,
} from "../server/question-engine/generators/reasoning/codingDecoding/solver.js";
import {
  CODING_SUBTOPICS,
  generateCodingDecodingBatch,
} from "../server/question-engine/generators/reasoning/codingDecoding/index.js";
import { validateCodingQuestion } from "../server/question-engine/generators/reasoning/codingDecoding/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK Coding-Decoding Question Engine Verification ===\n");

// 1. Formal Solver Unit Tests
{
  // Chinese coding exact propagation (unique + ambiguous pair)
  const solved = solveChineseCoding([
    { words: ["bank", "credit", "growth", "market"], codes: ["kp", "mx", "rt", "ql"] },
    { words: ["credit", "policy", "money", "digital"], codes: ["mx", "zn", "vx", "bd"] },
    { words: ["growth", "money", "reform", "profit"], codes: ["rt", "vx", "hj", "nm"] },
    { words: ["market", "digital", "reform", "profit"], codes: ["ql", "bd", "hj", "nm"] },
  ]);
  assert.equal(solved.uniqueWordToCode.get("bank"), "kp");
  assert.equal(solved.uniqueWordToCode.get("credit"), "mx");
  assert.equal(solved.uniqueWordToCode.get("growth"), "rt");
  assert.equal(solved.uniqueWordToCode.get("market"), "ql");
  assert.equal(solved.uniqueWordToCode.get("policy"), "zn");
  assert.equal(solved.uniqueWordToCode.get("money"), "vx");
  assert.equal(solved.uniqueWordToCode.get("digital"), "bd");
  assert.deepEqual([...solved.wordCandidates.get("reform")].sort(), ["hj", "nm"]);
  assert.deepEqual([...solved.wordCandidates.get("profit")].sort(), ["hj", "nm"]);

  // New-Pattern SNL
  const snl = evaluateNewPatternWord("BANK", {
    symbolType: "LENGTH_PARITY",
    symbols: { even: "@", odd: "#" },
    numberType: "FIRST_POS",
    letterType: "LAST_SHIFT",
    letterShift: 1,
    order: "SNL",
  });
  assert.equal(snl, "@2L");

  // Conditional Table Coding
  const condRes = evaluateConditionalCode(
    "34562",
    { 1: "@", 2: "#", 3: "$", 4: "%", 5: "&", 6: "*", 7: "M", 8: "K", 9: "P" },
    [{ id: "i", type: "FIRST_ODD_LAST_EVEN" }],
  );
  assert.equal(condRes.code, "#%&*$");
  assert.deepEqual(condRes.appliedConditions, ["i"]);

  // Letter Shift
  assert.equal(encodeLetterShift("BANK", { type: "UNIFORM_SHIFT", k: 1 }), "CBOL");
  assert.equal(encodeLetterShift("BANK", { type: "OPPOSITE_SHIFT", k: 0 }), "YZMP");

  // Number Coding
  assert.equal(encodeNumberCoding("BANK", { type: "FWD_SUM" }), 2 + 1 + 14 + 11);

  console.log("[PASS] 1. Formal solver unit tests (Chinese, New-Pattern SNL, Conditional, Letter-Shift, Number)");
}

// 2. Bulk Stress Verification (500 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 100, seed: 101 },
    { difficulty: "Medium", count: 150, seed: 202 },
    { difficulty: "Hard", count: 150, seed: 303 },
    { difficulty: "Medium", count: 20, subtopicName: "Chinese Coding", seed: 401 },
    { difficulty: "Hard", count: 20, subtopicName: "New-Pattern Symbol-Number-Letter", seed: 402 },
    { difficulty: "Medium", count: 20, subtopicName: "Conditional Table Coding", seed: 403 },
    { difficulty: "Easy", count: 20, subtopicName: "Letter-Shift Coding", seed: 404 },
    { difficulty: "Medium", count: 20, subtopicName: "Number Value Coding", seed: 405 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateCodingDecodingBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateCodingQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
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
  const res = generateCodingDecodingBatch({ difficulty: "Medium", count: 20, seed: 999 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Coding-Decoding"), true);
  assert.equal(isEngineSupportedTopic("coding decoding"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Coding-Decoding",
    difficulty: "Medium",
    count: 15,
  });
  const generated = generatedRes.standaloneQuestions;
  assert.equal(generated.length, 15);
  for (const q of generated) {
    const qText = q.question_text || q.questionText || q.question;
    const opts = q.options || {};
    const has5Opts = Array.isArray(opts)
      ? opts.length === 5
      : Boolean((q.option_a || q.optionA || opts.A) && (q.option_e || q.optionE || opts.E));
    const ans = q.correct_answer || q.correctAnswer;
    assert.ok(qText && qText.length > 25);
    assert.ok(has5Opts);
    assert.ok(["A", "B", "C", "D", "E"].includes(ans));
    assert.ok(q.explanation && q.explanation.length > 15);
  }
  console.log(`[PASS] 4. Full questionGenerator.js integration (15/15 HHK-formatted questions)`);
}

console.log("\nALL CODING-DECODING ENGINE CHECKS PASSED (4/4).");
