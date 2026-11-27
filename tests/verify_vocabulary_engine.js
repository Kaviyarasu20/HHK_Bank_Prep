import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  verifyMisspeltSlotIntegrity,
  verifyVocabOptionsIntegrity,
} from "../server/question-engine/generators/english/vocabulary/solver.js";
import { generateVocabularyBatch } from "../server/question-engine/generators/english/vocabulary/index.js";
import { validateVocabularyQuestion } from "../server/question-engine/generators/english/vocabulary/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK English Language — Vocabulary Engine Verification ===\n");

// 1. Formal Verifier Unit Tests
{
  assert.equal(
    verifyMisspeltSlotIntegrity({
      shownWords: ["committee", "maintainance", "accommodate", "transactions"],
      correctWords: ["committee", "maintenance", "accommodate", "transactions"],
      errorSlot: 1,
      options: ["committee", "maintainance", "accommodate", "transactions", "All are correct"],
      correctIndex: 1,
    }).valid,
    true,
  );
  assert.equal(
    verifyMisspeltSlotIntegrity({
      shownWords: ["committee", "maintenance", "accommodate", "transactions"],
      correctWords: ["committee", "maintenance", "accommodate", "transactions"],
      errorSlot: 4,
      options: ["committee", "maintenance", "accommodate", "transactions", "All are correct"],
      correctIndex: 4,
    }).valid,
    true,
  );
  assert.equal(
    verifyVocabOptionsIntegrity({
      options: ["Insolvency", "Moratorium", "Collateral", "Liquidity", "Arbitrage"],
      correctIndex: 0,
      expectedAnswer: "Insolvency",
    }).valid,
    true,
  );
  console.log("[PASS] 1. Misspelt-slot & option-integrity unit tests");
}

// 2. Bulk Stress Verification (100 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 20, seed: 961 },
    { difficulty: "Medium", count: 25, seed: 962 },
    { difficulty: "Hard", count: 25, seed: 963 },
    { difficulty: "Easy", count: 6, subtopicName: "Misspelt Inappropriate", seed: 971 },
    { difficulty: "Easy", count: 6, subtopicName: "One Word Substitution", seed: 972 },
    { difficulty: "Medium", count: 6, subtopicName: "Confusable Homophones", seed: 973 },
    { difficulty: "Hard", count: 6, subtopicName: "Collocation", seed: 974 },
    { difficulty: "Hard", count: 6, subtopicName: "Contextual Definition", seed: 975 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateVocabularyBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateVocabularyQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
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
  const res = generateVocabularyBatch({ difficulty: "Medium", count: 20, seed: 992 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Vocabulary"), true);
  assert.equal(isEngineSupportedTopic("vocabulary"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Vocabulary",
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

console.log("\nALL ENGLISH VOCABULARY ENGINE CHECKS PASSED (4/4).");
