import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  simulateDigitOpMachine,
  simulateDualEndWordNumber,
  simulateInterleavedAutoArrange,
  simulateNumberArithmeticMachine,
  simulateWordNumberTransform,
} from "../server/question-engine/generators/reasoning/inputOutput/solver.js";
import { generateInputOutputBatch } from "../server/question-engine/generators/reasoning/inputOutput/index.js";
import { validateInputOutputQuestion } from "../server/question-engine/generators/reasoning/inputOutput/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK Input-Output Question Engine Verification ===\n");

// 1. Formal Simulator Unit Tests
{
  const dual = simulateDualEndWordNumber(["gold", "42", "bank", "19", "cash", "75"], {
    wordOrder: "ASC",
    numOrder: "DESC",
    placement: "OUTER",
  });
  assert.equal(dual.steps.length, 3);
  assert.deepEqual(dual.steps[0], ["bank", "gold", "42", "19", "cash", "75"]);
  assert.deepEqual(dual.steps[2], ["bank", "cash", "gold", "19", "42", "75"]);

  const inter = simulateInterleavedAutoArrange(["gold", "42", "bank", "75"], {
    wordOrder: "ASC",
    numOrder: "DESC",
  });
  assert.deepEqual(inter.target, ["bank", "75", "gold", "42"]);
  assert.deepEqual(inter.steps[inter.steps.length - 1], ["bank", "75", "gold", "42"]);

  const arith = simulateNumberArithmeticMachine([24, 15, 32], "A");
  // S1: 15, 24, 32 -> S2: 20, 12, 16 -> S3: 2, 3, 7
  assert.deepEqual(arith.steps[2], ["2", "3", "7"]);

  const tr = simulateWordNumberTransform(["cash", "24", "bank", "15"], {
    wordOp: "REVERSE",
    evenDelta: 2,
    oddDelta: -1,
  });
  // S1: knab cash 24 14 -> S2: knab hsac 26 14
  assert.deepEqual(tr.steps[1], ["knab", "hsac", "26", "14"]);

  const dop = simulateDigitOpMachine([47, 23, 56], "DIFF");
  // S1: 28, 6, 30 -> S2: 6, 6, 3 -> S3: 3, 6, 6
  assert.deepEqual(dop.steps[2], ["3", "6", "6"]);

  console.log("[PASS] 1. Formal simulator unit tests (Dual-End, Interleaved, Number Arithmetic, Word-Number Transform, Digit-Op)");
}

// 2. Bulk Stress Verification (500 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 100, seed: 151 },
    { difficulty: "Medium", count: 150, seed: 262 },
    { difficulty: "Hard", count: 150, seed: 373 },
    { difficulty: "Medium", count: 20, subtopicName: "Dual-End Shifting", seed: 451 },
    { difficulty: "Easy", count: 20, subtopicName: "Interleaved Auto-Arrangement", seed: 452 },
    { difficulty: "Hard", count: 20, subtopicName: "Number-Only Arithmetic", seed: 453 },
    { difficulty: "Hard", count: 20, subtopicName: "Word Number Transform", seed: 454 },
    { difficulty: "Hard", count: 20, subtopicName: "Digit Operation Machine", seed: 455 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateInputOutputBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateInputOutputQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
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
  const res = generateInputOutputBatch({ difficulty: "Medium", count: 20, seed: 949 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Input-Output"), true);
  assert.equal(isEngineSupportedTopic("input output"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Mains",
    topicName: "Input-Output",
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

console.log("\nALL INPUT-OUTPUT ENGINE CHECKS PASSED (4/4).");
