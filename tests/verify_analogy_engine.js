import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  applyLetterAnalogyRule,
  applyNumberAnalogyRule,
  applyWordValueAnalogyRule,
  matchesTriadRule,
} from "../server/question-engine/generators/reasoning/analogy/solver.js";
import { generateAnalogyBatch } from "../server/question-engine/generators/reasoning/analogy/index.js";
import { validateAnalogyQuestion } from "../server/question-engine/generators/reasoning/analogy/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK Analogy Question Engine Verification ===\n");

// 1. Formal Solver Unit Tests
{
  assert.equal(applyNumberAnalogyRule(7, { type: "SQUARE_PLUS_K", k: 3 }), 52);
  assert.equal(applyNumberAnalogyRule(4, { type: "CUBE_PLUS_SELF" }), 68);
  assert.equal(applyNumberAnalogyRule(27, { type: "DIGIT_SUM_SQ" }), 81);
  assert.equal(matchesTriadRule([6, 14, 30], { type: "DOUBLE_PLUS_K", k: 2 }), true);
  assert.equal(matchesTriadRule([6, 14, 31], { type: "DOUBLE_PLUS_K", k: 2 }), false);
  assert.equal(applyLetterAnalogyRule("ABCD", { type: "UNIFORM_SHIFT", k: 2 }), "CDEF");
  assert.equal(applyLetterAnalogyRule("ABCD", { type: "OPPOSITE_SHIFT", k: 0 }), "ZYXW");
  assert.equal(applyWordValueAnalogyRule("BANK", { type: "FWD_SUM" }), 28);
  console.log("[PASS] 1. Formal solver unit tests (Number, Triad Set, Letter Cluster, Word-Value)");
}

// 2. Bulk Stress Verification (500 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 100, seed: 105 },
    { difficulty: "Medium", count: 150, seed: 205 },
    { difficulty: "Hard", count: 150, seed: 305 },
    { difficulty: "Medium", count: 20, subtopicName: "Number Analogy", seed: 405 },
    { difficulty: "Hard", count: 20, subtopicName: "Number Set Triad", seed: 406 },
    { difficulty: "Medium", count: 20, subtopicName: "Letter Cluster", seed: 407 },
    { difficulty: "Medium", count: 20, subtopicName: "Alphanumeric Value", seed: 408 },
    { difficulty: "Easy", count: 20, subtopicName: "Semantic Word Analogy", seed: 409 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateAnalogyBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateAnalogyQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
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
  const res = generateAnalogyBatch({ difficulty: "Medium", count: 20, seed: 995 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Analogy"), true);
  assert.equal(isEngineSupportedTopic("analogy"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Analogy",
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

console.log("\nALL ANALOGY ENGINE CHECKS PASSED (4/4).");
