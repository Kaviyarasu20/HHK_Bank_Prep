import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  verifyLexiconEntry,
  verifySynonymAntonymQuestionIntegrity,
} from "../server/question-engine/generators/english/synonymsAntonyms/solver.js";
import { generateSynonymsAntonymsBatch } from "../server/question-engine/generators/english/synonymsAntonyms/index.js";
import { validateSynonymAntonymQuestion } from "../server/question-engine/generators/english/synonymsAntonyms/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK English Language — Synonyms & Antonyms Engine Verification ===\n");

// 1. Formal Lexical Relation & Disjointness Unit Tests
{
  const sample = {
    word: "PRUDENT",
    synonyms: ["judicious", "cautious", "sensible", "discreet"],
    antonyms: ["reckless", "imprudent", "rash", "careless"],
  };
  assert.equal(verifyLexiconEntry(sample), true);
  assert.equal(
    verifySynonymAntonymQuestionIntegrity({
      mode: "CONTEXTUAL_SYNONYM",
      entry: sample,
      options: ["judicious", "reckless", "annual", "coastal", "thermal"],
      correctIndex: 0,
    }).valid,
    true,
  );
  assert.equal(
    verifySynonymAntonymQuestionIntegrity({
      mode: "SYNONYM_CLUSTER_OUTLIER",
      entry: sample,
      options: ["judicious", "cautious", "sensible", "discreet", "reckless"],
      correctIndex: 4,
    }).valid,
    true,
  );
  assert.equal(
    verifySynonymAntonymQuestionIntegrity({
      mode: "PAIR_SYNONYM_ANTONYM_MAINS",
      entry: sample,
      options: ["judicious / reckless", "reckless / judicious", "judicious / cautious", "reckless / rash", "annual / coastal"],
      correctIndex: 0,
    }).valid,
    true,
  );
  console.log("[PASS] 1. Lexical disjointness & 1-of-5 relation unit tests");
}

// 2. Bulk Stress Verification (150 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 30, seed: 921 },
    { difficulty: "Medium", count: 40, seed: 922 },
    { difficulty: "Hard", count: 40, seed: 923 },
    { difficulty: "Medium", count: 8, subtopicName: "Contextual Synonym", seed: 931 },
    { difficulty: "Medium", count: 8, subtopicName: "Contextual Antonym", seed: 932 },
    { difficulty: "Hard", count: 8, subtopicName: "Pair Selection Mains", seed: 933 },
    { difficulty: "Hard", count: 8, subtopicName: "Outlier Non-Synonym", seed: 934 },
    { difficulty: "Easy", count: 8, subtopicName: "Editorial Tone", seed: 935 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateSynonymsAntonymsBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateSynonymAntonymQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(check.valid, true, `Validation failed: ${check.errors.join("; ")}`);
      subTypeCounts[q.subType] = (subTypeCounts[q.subType] || 0) + 1;
      ansDist[q.correctAnswer] += 1;
      totalVerified += 1;
    }
  }

  assert.equal(totalVerified, 150);
  console.log(`[PASS] 2. Bulk verification: ${totalVerified}/150 questions verified across all 5 subtopics`);
  console.log("       Subtopics:", JSON.stringify(subTypeCounts));
  console.log("       Answer distribution A–E:", JSON.stringify(ansDist));
}

// 3. Performance Benchmark (20-question Medium batch)
{
  const t0 = performance.now();
  const res = generateSynonymsAntonymsBatch({ difficulty: "Medium", count: 20, seed: 990 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Synonyms & Antonyms"), true);
  assert.equal(isEngineSupportedTopic("synonyms and antonyms"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Synonyms & Antonyms",
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

console.log("\nALL ENGLISH SYNONYMS & ANTONYMS ENGINE CHECKS PASSED (4/4).");
