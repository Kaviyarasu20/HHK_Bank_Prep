import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  renderNewPatternClozePassage,
  renderStandardClozePassage,
  verifyClozeBlankConsistency,
} from "../server/question-engine/generators/english/clozeTest/solver.js";
import { generateClozeTestBatch } from "../server/question-engine/generators/english/clozeTest/index.js";
import { validateClozeQuestion } from "../server/question-engine/generators/english/clozeTest/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK English Language — Cloze Test Engine Verification ===\n");

// 1. Formal Blank-Slot Verifier Unit Tests
{
  const tpl = "Digital rails have {{1}} payments and {{2}} costs.";
  const blanks = [
    { num: 1, answer: "transformed" },
    { num: 2, answer: "reduced" },
  ];
  const std = renderStandardClozePassage(tpl, blanks, 1);
  assert.ok(std.includes("_____(1)_____") && std.includes("___(2)___"));
  const np = renderNewPatternClozePassage(tpl, blanks, 2, "inflated");
  assert.ok(np.includes("transformed") && np.includes("[inflated] (2)"));
  const check = verifyClozeBlankConsistency({
    templateText: tpl,
    blanks,
    activeBlankNum: 1,
    options: ["transformed", "blocked", "hidden", "delayed", "erased"],
    correctIndex: 0,
    expectedAnswer: "transformed",
  });
  assert.equal(check.valid, true);
  console.log("[PASS] 1. Cloze blank-slot & New-Pattern replacement unit tests");
}

// 2. Bulk Stress Verification (100 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 15, seed: 601 },
    { difficulty: "Medium", count: 25, seed: 602 },
    { difficulty: "Hard", count: 25, seed: 603 },
    { difficulty: "Medium", count: 8, subtopicName: "Banking Digital", seed: 611 },
    { difficulty: "Medium", count: 8, subtopicName: "Economy Policy", seed: 612 },
    { difficulty: "Medium", count: 5, subtopicName: "Climate Finance", seed: 613 },
    { difficulty: "Hard", count: 5, subtopicName: "Governance Cyber", seed: 614 },
    { difficulty: "Hard", count: 9, subtopicName: "New Pattern Mains", seed: 615 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateClozeTestBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateClozeQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(check.valid, true, `Validation failed: ${check.errors.join("; ")}`);
      subTypeCounts[q.subType] = (subTypeCounts[q.subType] || 0) + 1;
      ansDist[q.correctAnswer] += 1;
      totalVerified += 1;
    }
  }

  assert.equal(totalVerified, 100);
  console.log(`[PASS] 2. Bulk verification: ${totalVerified}/100 questions verified across all 5 Cloze subtopics`);
  console.log("       Subtopics:", JSON.stringify(subTypeCounts));
  console.log("       Answer distribution A–E:", JSON.stringify(ansDist));
}

// 3. Performance Benchmark (15-question Medium batch)
{
  const t0 = performance.now();
  const res = generateClozeTestBatch({ difficulty: "Medium", count: 15, seed: 992 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 15);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 15-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Cloze Test"), true);
  assert.equal(isEngineSupportedTopic("cloze"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Cloze Test",
    difficulty: "Medium",
    count: 15,
  });
  const generated = generatedRes.standaloneQuestions;
  assert.equal(generated.length, 15);
  for (const q of generated) {
    assert.ok(q.questionText && q.questionText.length > 80);
    assert.ok(Array.isArray(q.options) && q.options.length === 5);
    assert.ok(["A", "B", "C", "D", "E"].includes(q.correctAnswer));
    assert.ok(q.explanation && q.explanation.length > 15);
  }
  const formattedKeys = new Set(generated.map((q) => q.correctAnswer));
  assert.ok(formattedKeys.size >= 3, `Expected varied formatted correctAnswer keys, got ${[...formattedKeys]}`);
  console.log(`[PASS] 4. Full questionGenerator.js integration (15/15 HHK-formatted questions, keys: ${[...formattedKeys].sort().join(",")})`);
}

console.log("\nALL ENGLISH CLOZE TEST ENGINE CHECKS PASSED (4/4).");
