import assert from "node:assert/strict";
import { verifyGrammarQuestionIntegrity } from "../server/question-engine/generators/english/grammar/solver.js";
import { generateGrammarBatch, GRAMMAR_SUBTOPICS } from "../server/question-engine/generators/english/grammar/index.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
  SUPPORTED_AUTO_TOPICS,
} from "../server/services/questionGenerator.js";

console.log("=== 1. Unit Testing Grammar Rule & Option-Integrity Verifier ===");
const goodCheck = verifyGrammarQuestionIntegrity({
  options: [
    "The quarterly report was approved by the board.",
    "The quarterly report is approved by the board.",
    "The quarterly report were approved by the board.",
    "The quarterly report has been approved by the board.",
    "The quarterly report had been approved by the board.",
  ],
  correctIndex: 0,
  expectedAnswer: "The quarterly report was approved by the board.",
  ruleTag: "SIMPLE_PAST_PASSIVE",
});
assert.equal(goodCheck.valid, true, `Expected valid grammar check, got: ${goodCheck.errors.join("; ")}`);

const badDup = verifyGrammarQuestionIntegrity({
  options: ["A", "A", "C", "D", "E"],
  correctIndex: 0,
  expectedAnswer: "A",
  ruleTag: "TEST_RULE",
});
assert.equal(badDup.valid, false, "Duplicate options should fail");

const badKey = verifyGrammarQuestionIntegrity({
  options: ["A", "B", "C", "D", "E"],
  correctIndex: 1,
  expectedAnswer: "A",
  ruleTag: "TEST_RULE",
});
assert.equal(badKey.valid, false, "Mismatched expectedAnswer should fail");
console.log("Verifier unit tests passed.\n");

console.log("=== 2. Bulk Verification across Easy / Medium / Hard & All 5 Subtopics (100 Qs) ===");
const allSubtopicKeys = Object.keys(GRAMMAR_SUBTOPICS);
const countsBySubtopic = Object.fromEntries(allSubtopicKeys.map((s) => [s, 0]));
const countsByKey = { A: 0, B: 0, C: 0, D: 0, E: 0 };
let totalVerified = 0;

for (const diff of ["Easy", "Medium", "Hard"]) {
  const count = diff === "Medium" ? 40 : 30;
  const { questions, meta } = generateGrammarBatch({
    exam: "IBPS-PO",
    stage: diff === "Hard" ? "Mains" : "Prelims",
    difficulty: diff,
    count,
    seed: diff === "Easy" ? 7101 : diff === "Medium" ? 7202 : 7303,
  });
  assert.equal(questions.length, count, `Expected ${count} ${diff} questions, got ${questions.length}`);
  assert.equal(meta.rejectedCount, 0, `Unexpected rejections in ${diff}: ${meta.rejectedCount}`);

  for (const q of questions) {
    assert.equal(q.optionsArray.length, 5, "Must have 5 options");
    assert.equal(q.answer, q.optionsArray[q.correctOptionIndex], "answer must match optionsArray[correctOptionIndex]");
    assert.ok(q.questionText && q.questionText.length > 20, "Question text too short");
    assert.ok(q.explanation && q.explanation.length > 15, "Explanation too short");
    assert.ok(q.validation?.solverVerified, "Must be solverVerified");
    countsBySubtopic[q.subType] = (countsBySubtopic[q.subType] || 0) + 1;
    const letter = String.fromCharCode(65 + q.correctOptionIndex);
    countsByKey[letter] = (countsByKey[letter] || 0) + 1;
    totalVerified += 1;
  }
}

console.log(`Bulk verified: ${totalVerified}/100 questions (0 errors)`);
console.log("Subtopic distribution:", countsBySubtopic);
console.log("Answer key distribution:", countsByKey);
for (const sub of allSubtopicKeys) {
  assert.ok(countsBySubtopic[sub] > 0, `Subtopic ${sub} was not generated`);
}

console.log("\n=== 3. Performance Benchmark (20-Question Medium Batch) ===");
const t0 = performance.now();
const perfBatch = generateGrammarBatch({
  exam: "SBI-PO",
  difficulty: "Medium",
  count: 20,
  seed: 9901,
});
const elapsedMs = performance.now() - t0;
assert.equal(perfBatch.questions.length, 20, "Perf batch should return 20 questions");
assert.ok(elapsedMs < 250, `Expected < 250 ms, got ${elapsedMs.toFixed(2)} ms`);
console.log(`20-question Medium batch generated in ${elapsedMs.toFixed(2)} ms (limit: 250 ms).\n`);

console.log("=== 4. Full questionGenerator.js Integration & 12/12 Modular English Coverage Audit ===");
assert.equal(isEngineSupportedTopic("Grammar"), true, "Grammar must be engine-supported");
const englishTopics = SUPPORTED_AUTO_TOPICS.english;
assert.equal(englishTopics.length, 12, `Expected 12 modular English topics, got ${englishTopics.length}`);
for (const topic of englishTopics) {
  assert.equal(isEngineSupportedTopic(topic), true, `English topic '${topic}' should be supported`);
}

const { standaloneQuestions: hhkQuestions } = generateTopicQuestions({
  examCode: "IBPS_PO",
  stageName: "Prelims",
  topicName: "Grammar",
  subtopicName: "",
  difficulty: "medium",
  count: 15,
  optionCount: 5,
});
assert.equal(hhkQuestions.length, 15, `Expected 15 HHK-formatted Grammar questions, got ${hhkQuestions.length}`);
const uniqueTexts = new Set();
const uniqueKeys = new Set();
for (const q of hhkQuestions) {
  const qText = q.questionText || q.question_text || q.question;
  assert.ok(qText && qText.length > 20, "Missing questionText");
  const optCount = Array.isArray(q.options) ? q.options.length : Object.keys(q.options || {}).length;
  assert.equal(optCount, 5, "Must have 5 options A-E");
  const ans = q.correctAnswer || q.correct_answer;
  assert.ok(["A", "B", "C", "D", "E"].includes(ans), `Invalid correctAnswer: ${ans}`);
  uniqueTexts.add(qText);
  uniqueKeys.add(ans);
}
assert.equal(uniqueTexts.size, 15, `Expected 15 unique Grammar questions, got ${uniqueTexts.size}`);
assert.ok(uniqueKeys.size >= 4, `Expected >= 4 distinct answer keys in 15-Q batch, got ${uniqueKeys.size}`);

console.log(`HHK Integration passed: ${hhkQuestions.length}/15 unique questions, keys: [${[...uniqueKeys].sort().join(", ")}]`);
console.log(`Modular English Auto-Generate Topics (${englishTopics.length}/12 + Reading Comprehension AI = 13/13):`);
console.log("  " + englishTopics.join(", "));
console.log("\nALL GRAMMAR ENGINE VERIFICATION CHECKS PASSED!");
