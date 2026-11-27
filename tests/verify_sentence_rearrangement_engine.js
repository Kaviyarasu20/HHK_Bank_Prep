import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  applyWordSwaps,
  mapJumbledFragments,
  reconstructFragments,
} from "../server/question-engine/generators/english/sentenceRearrangement/solver.js";
import { generateSentenceRearrangementBatch } from "../server/question-engine/generators/english/sentenceRearrangement/index.js";
import { validateSentenceRearrangementQuestion } from "../server/question-engine/generators/english/sentenceRearrangement/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK English Language — Sentence Rearrangement Engine Verification ===\n");

// 1. Formal Permutation & Word-Swap Unit Tests
{
  const canon = ["F0", "F1", "F2", "F3"];
  const mapped = mapJumbledFragments(canon, [2, 0, 3, 1], ["A", "B", "C", "D"]);
  assert.equal(mapped.correctSequenceStr, "B-D-A-C");
  assert.deepEqual(reconstructFragments(mapped.displayed, "B-D-A-C"), canon);

  const swapped = applyWordSwaps(["raised", "curb", "credit", "manufacturing"], [["A", "C"]]);
  assert.deepEqual(swapped, ["credit", "curb", "raised", "manufacturing"]);
  assert.deepEqual(applyWordSwaps(swapped, [["A", "C"]]), ["raised", "curb", "credit", "manufacturing"]);
  console.log("[PASS] 1. Fragment permutation & word-swap reconstruction unit tests");
}

// 2. Bulk Stress Verification (120 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 25, seed: 901 },
    { difficulty: "Medium", count: 30, seed: 902 },
    { difficulty: "Hard", count: 30, seed: 903 },
    { difficulty: "Easy", count: 7, subtopicName: "Four Part Sentence", seed: 911 },
    { difficulty: "Hard", count: 7, subtopicName: "Five Part Sentence", seed: 912 },
    { difficulty: "Medium", count: 7, subtopicName: "Fixed Start", seed: 913 },
    { difficulty: "Easy", count: 7, subtopicName: "Word Swap", seed: 914 },
    { difficulty: "Hard", count: 7, subtopicName: "Double Word Swap", seed: 915 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateSentenceRearrangementBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateSentenceRearrangementQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(check.valid, true, `Validation failed: ${check.errors.join("; ")}`);
      subTypeCounts[q.subType] = (subTypeCounts[q.subType] || 0) + 1;
      ansDist[q.correctAnswer] += 1;
      totalVerified += 1;
    }
  }

  assert.equal(totalVerified, 120);
  console.log(`[PASS] 2. Bulk verification: ${totalVerified}/120 questions verified across all 5 subtopics`);
  console.log("       Subtopics:", JSON.stringify(subTypeCounts));
  console.log("       Answer distribution A–E:", JSON.stringify(ansDist));
}

// 3. Performance Benchmark (20-question Medium batch)
{
  const t0 = performance.now();
  const res = generateSentenceRearrangementBatch({ difficulty: "Medium", count: 20, seed: 999 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Sentence Rearrangement"), true);
  assert.equal(isEngineSupportedTopic("word swap"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Sentence Rearrangement",
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

console.log("\nALL ENGLISH SENTENCE REARRANGEMENT ENGINE CHECKS PASSED (4/4).");
