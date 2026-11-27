import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { verifySentenceCorrectionSet } from "../server/question-engine/generators/english/sentenceCorrection/solver.js";
import { generateSentenceCorrectionBatch } from "../server/question-engine/generators/english/sentenceCorrection/index.js";
import { validateSentenceCorrectionQuestion } from "../server/question-engine/generators/english/sentenceCorrection/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK English Language — Sentence Correction Engine Verification ===\n");

// 1. Formal 1-of-5 Verifier Unit Tests
{
  const ok1 = verifySentenceCorrectionSet({
    mode: "FIND_CORRECT",
    taggedOptions: [
      { text: "A", isCorrect: false },
      { text: "B", isCorrect: true },
      { text: "C", isCorrect: false },
      { text: "D", isCorrect: false },
      { text: "E", isCorrect: false },
    ],
    correctIndex: 1,
  });
  assert.equal(ok1.valid, true);

  const ok2 = verifySentenceCorrectionSet({
    mode: "FIND_INCORRECT",
    taggedOptions: [
      { text: "A", isCorrect: true },
      { text: "B", isCorrect: true },
      { text: "C", isCorrect: true },
      { text: "D", isCorrect: false },
      { text: "E", isCorrect: true },
    ],
    correctIndex: 3,
  });
  assert.equal(ok2.valid, true);
  console.log("[PASS] 1. 1-of-5 Correct/Incorrect invariant unit tests");
}

// 2. Bulk Stress Verification (100 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 20, seed: 881 },
    { difficulty: "Medium", count: 25, seed: 882 },
    { difficulty: "Hard", count: 25, seed: 883 },
    { difficulty: "Medium", count: 6, subtopicName: "Correct Sentence", seed: 891 },
    { difficulty: "Medium", count: 6, subtopicName: "Incorrect Sentence", seed: 892 },
    { difficulty: "Hard", count: 6, subtopicName: "Modifier Dangling", seed: 893 },
    { difficulty: "Medium", count: 6, subtopicName: "Parallel Comparison", seed: 894 },
    { difficulty: "Hard", count: 6, subtopicName: "Subjunctive Conditional", seed: 895 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateSentenceCorrectionBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateSentenceCorrectionQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(check.valid, true, `Validation failed: ${check.errors.join("; ")}`);
      subTypeCounts[q.subType] = (subTypeCounts[q.subType] || 0) + 1;
      ansDist[q.correctAnswer] += 1;
      totalVerified += 1;
    }
  }

  assert.equal(totalVerified, 100);
  console.log(`[PASS] 2. Bulk verification: ${totalVerified}/100 questions verified across all 5 subtopics`);
  console.log("       Subtopics:", JSON.stringify(subTypeCounts));
  console.log("       Answer distribution A–E:", JSON.stringify(ansDist));
}

// 3. Performance Benchmark (20-question Medium batch)
{
  const t0 = performance.now();
  const res = generateSentenceCorrectionBatch({ difficulty: "Medium", count: 20, seed: 997 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Sentence Correction"), true);
  assert.equal(isEngineSupportedTopic("sentence correction"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Mains",
    topicName: "Sentence Correction",
    difficulty: "Medium",
    count: 15,
  });
  const generated = generatedRes.standaloneQuestions;
  assert.equal(generated.length, 15);
  for (const q of generated) {
    assert.ok(q.questionText && q.questionText.length > 35);
    assert.ok(Array.isArray(q.options) && q.options.length === 5);
    assert.ok(["A", "B", "C", "D", "E"].includes(q.correctAnswer));
    assert.ok(q.explanation && q.explanation.length > 15);
  }
  const formattedKeys = new Set(generated.map((q) => q.correctAnswer));
  assert.ok(formattedKeys.size >= 3, `Expected varied formatted correctAnswer keys, got ${[...formattedKeys]}`);
  console.log(`[PASS] 4. Full questionGenerator.js integration (15/15 HHK-formatted questions, keys: ${[...formattedKeys].sort().join(",")})`);
}

console.log("\nALL ENGLISH SENTENCE CORRECTION ENGINE CHECKS PASSED (4/4).");
