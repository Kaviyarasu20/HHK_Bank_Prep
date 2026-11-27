import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  evaluateTripleUsageVerdict,
  TRIPLE_USAGE_OPTIONS,
  verifyIdiomQuestionIntegrity,
} from "../server/question-engine/generators/english/idiomsPhrases/solver.js";
import { generateIdiomsPhrasesBatch } from "../server/question-engine/generators/english/idiomsPhrases/index.js";
import { validateIdiomsPhrasesQuestion } from "../server/question-engine/generators/english/idiomsPhrases/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK English Language — Idioms & Phrases Engine Verification ===\n");

// 1. Formal Verifier Unit Tests
{
  assert.equal(evaluateTripleUsageVerdict(true, false, false), "Only I");
  assert.equal(evaluateTripleUsageVerdict(false, true, true), "Both II and III");
  assert.equal(evaluateTripleUsageVerdict(true, true, true), "All I, II and III");
  assert.equal(
    verifyIdiomQuestionIntegrity({
      mode: "IDIOM_USAGE_TRIPLE_MAINS",
      options: TRIPLE_USAGE_OPTIONS,
      correctIndex: 2,
      tripleMask: [true, true, false],
    }).valid,
    true,
  );
  console.log("[PASS] 1. Idiom & Triple-Sentence Usage verifier unit tests");
}

// 2. Bulk Stress Verification (120 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 25, seed: 941 },
    { difficulty: "Medium", count: 30, seed: 942 },
    { difficulty: "Hard", count: 30, seed: 943 },
    { difficulty: "Easy", count: 7, subtopicName: "Contextual Meaning", seed: 951 },
    { difficulty: "Medium", count: 7, subtopicName: "Idiom Filler", seed: 952 },
    { difficulty: "Medium", count: 7, subtopicName: "Phrasal Verb", seed: 953 },
    { difficulty: "Hard", count: 7, subtopicName: "Triple Usage Mains", seed: 954 },
    { difficulty: "Medium", count: 7, subtopicName: "Literal Substitution", seed: 955 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateIdiomsPhrasesBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateIdiomsPhrasesQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
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
  const res = generateIdiomsPhrasesBatch({ difficulty: "Medium", count: 20, seed: 991 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Idioms & Phrases"), true);
  assert.equal(isEngineSupportedTopic("idioms and phrases"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Idioms & Phrases",
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

console.log("\nALL ENGLISH IDIOMS & PHRASES ENGINE CHECKS PASSED (4/4).");
