import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  buildJumbledMapping,
  reconstructFromLabelSequence,
} from "../server/question-engine/generators/english/paraJumbles/solver.js";
import { generateParaJumblesBatch } from "../server/question-engine/generators/english/paraJumbles/index.js";
import { validateParaJumblesQuestion } from "../server/question-engine/generators/english/paraJumbles/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK English Language — Para Jumbles Engine Verification ===\n");

// 1. Formal Permutation & Inverse-Mapping Unit Tests
{
  const ordered = ["S0", "S1", "S2", "S3", "S4"];
  const perm = [2, 0, 4, 1, 3]; // A=S2, B=S0, C=S4, D=S1, E=S3 => true order B-D-A-E-C
  const mapped = buildJumbledMapping(ordered, perm, ["A", "B", "C", "D", "E"]);
  assert.equal(mapped.correctSequenceStr, "B-D-A-E-C");
  assert.deepEqual(mapped.mandatoryPairs, ["B-D", "D-A", "A-E", "E-C"]);
  assert.deepEqual(reconstructFromLabelSequence(mapped.displayed, mapped.correctSequenceStr), ordered);
  console.log("[PASS] 1. Permutation & inverse-label reconstruction unit tests");
}

// 2. Bulk Stress Verification (150 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 30, seed: 801 },
    { difficulty: "Medium", count: 40, seed: 802 },
    { difficulty: "Hard", count: 40, seed: 803 },
    { difficulty: "Easy", count: 8, subtopicName: "Five Sentence Complete", seed: 811 },
    { difficulty: "Easy", count: 8, subtopicName: "Positional First Last", seed: 812 },
    { difficulty: "Medium", count: 8, subtopicName: "Fixed Anchor S1", seed: 813 },
    { difficulty: "Hard", count: 8, subtopicName: "Odd Sentence Out", seed: 814 },
    { difficulty: "Hard", count: 8, subtopicName: "Mandatory Pair", seed: 815 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateParaJumblesBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateParaJumblesQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(check.valid, true, `Validation failed: ${check.errors.join("; ")}`);
      subTypeCounts[q.subType] = (subTypeCounts[q.subType] || 0) + 1;
      ansDist[q.correctAnswer] += 1;
      totalVerified += 1;
    }
  }

  assert.equal(totalVerified, 150);
  console.log(`[PASS] 2. Bulk verification: ${totalVerified}/150 questions verified across all 5 Para Jumbles subtopics`);
  console.log("       Subtopics:", JSON.stringify(subTypeCounts));
  console.log("       Answer distribution A–E:", JSON.stringify(ansDist));
}

// 3. Performance Benchmark (20-question Medium batch)
{
  const t0 = performance.now();
  const res = generateParaJumblesBatch({ difficulty: "Medium", count: 20, seed: 994 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Para Jumbles"), true);
  assert.equal(isEngineSupportedTopic("para jumbles"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Para Jumbles",
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

console.log("\nALL ENGLISH PARA JUMBLES ENGINE CHECKS PASSED (4/4).");
