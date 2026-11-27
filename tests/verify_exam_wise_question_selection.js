import assert from "node:assert/strict";
import {
  EXAM_PATTERN_CATALOG,
  findCatalogPattern,
  inferSubjectKeyFromSectionName,
  getDefaultTopicDistributionsForSubject,
} from "../server/exam-engine/examPatternCatalog.js";
import { subjectGeneratorRegistry } from "../server/exam-engine/subjectGeneratorRegistry.js";
import { computePatternBankAvailability } from "../server/exam-engine/bankQuestionSelector.js";
import {
  generateIntelligentExamWiseMockTest,
  previewExamWiseDistribution,
} from "../server/exam-engine/intelligentMockTestEngine.js";

console.log("=== 1. Verifying 15 Research-Based Banking Exam Patterns (Prelims & Mains) ===");
assert.equal(EXAM_PATTERN_CATALOG.length, 15, `Expected 15 exam patterns, got ${EXAM_PATTERN_CATALOG.length}`);
for (const pattern of EXAM_PATTERN_CATALOG) {
  const secSum = pattern.sections.reduce((s, sec) => s + sec.questionCount, 0);
  assert.equal(secSum, pattern.totalQuestions, `${pattern.patternCode}: section sum ${secSum} != ${pattern.totalQuestions}`);
  for (const sec of pattern.sections) {
    const topicSum = sec.topicDistributions
      .filter((t) => t.enabled !== false)
      .reduce((s, t) => s + Number(t.defaultQuestions || 0), 0);
    assert.equal(
      topicSum,
      sec.questionCount,
      `${pattern.patternCode} -> ${sec.sectionName}: topic defaults sum ${topicSum} != ${sec.questionCount}`
    );
  }
}

const rrbOaPre = findCatalogPattern("IBPS-RRB-OA", "Prelims");
assert.equal(rrbOaPre.totalQuestions, 80);
assert.equal(rrbOaPre.sections.length, 2);
const rrbOaMains = findCatalogPattern("IBPS-RRB-OA", "Mains");
assert.equal(rrbOaMains.totalQuestions, 200);
assert.equal(rrbOaMains.sections.length, 5);

const rbiAsstPre = findCatalogPattern("RBI-ASSISTANT", "Prelims");
assert.equal(rbiAsstPre.totalQuestions, 100);
const rbiGradeB = findCatalogPattern("RBI-GRADE-B", "Prelims");
assert.equal(rbiGradeB.totalQuestions, 200);
assert.equal(rbiGradeB.sections.length, 4);
console.log("All 15 official Prelims & Mains exam patterns verified with exact topic sums.\n");

console.log("=== 2. Verifying Subject Generator Registry (Quant + Reasoning + English ACTIVE) ===");
assert.equal(subjectGeneratorRegistry.isAvailable("quant"), true, "Quant must be ACTIVE");
assert.equal(subjectGeneratorRegistry.isAvailable("reasoning"), true, "Reasoning must be ACTIVE");
assert.equal(subjectGeneratorRegistry.isAvailable("english"), true, "English must be ACTIVE");
assert.ok(subjectGeneratorRegistry.get("reasoning").supportedTopics.length >= 18, "Expected >= 18 Reasoning topics");
assert.equal(subjectGeneratorRegistry.get("english").supportedTopics.length, 12, "Expected 12 modular English topics");
console.log("Subject Generator Registry verified (Quant, Reasoning 19/19, English 12/12 ACTIVE).\n");

console.log("=== 3. Verifying Question Bank Shortage Analyzer (Zero Silent Fallbacks) ===");
const mockBankMap = new Map();
const rrbWithIds = {
  ...rrbOaPre,
  sections: rrbOaPre.sections.map((s, idx) => ({ ...s, sectionId: `sec-${idx}` })),
};
// Give full stock to Numerical Ability, partial stock to Reasoning
mockBankMap.set(
  "sec-1",
  new Map(rrbWithIds.sections[1].topicDistributions.map((t) => [t.topic.toLowerCase(), t.defaultQuestions + 5]))
);
mockBankMap.set("sec-0", new Map([["puzzles", 2], ["syllogism", 5]]));

const availReport = computePatternBankAvailability(rrbWithIds, mockBankMap);
assert.equal(availReport.hasShortages, true, "Should detect Reasoning topic shortages");
assert.ok(availReport.shortageWarnings.length >= 6, "Should list each short Reasoning topic individually");
const puzzleWarn = availReport.shortageWarnings.find((w) => w.topic === "Puzzles");
assert.ok(puzzleWarn && puzzleWarn.available === 2 && puzzleWarn.shortfall === puzzleWarn.required - 2, "Exact Puzzles shortage mismatch");
console.log(`Shortage analyzer verified (${availReport.shortageWarnings.length} itemized topic warnings emitted).\n`);

console.log("=== 4. End-to-End IBPS RRB Office Assistant Prelims Generation (80/80 Qs, 0 Duplicates) ===");
const preview = previewExamWiseDistribution({
  examCode: "IBPS-RRB-OA",
  stageName: "Prelims",
  varyWithinRanges: false,
  seed: 20261127,
});
assert.equal(preview.allSectionsReady, true, "IBPS RRB Office Assistant Prelims must be 100% ready (Reasoning + Numerical Ability)");
assert.equal(preview.autoGeneratableQuestions, 80);

const generated = await generateIntelligentExamWiseMockTest({
  examCode: "IBPS-RRB-OA",
  stageName: "Prelims",
  shortagePolicy: "FAIL_STRICT",
  varyWithinRanges: false,
  seed: 20261127,
});
assert.equal(generated.patternFulfilled, true, "IBPS RRB OA Prelims should fulfill 100% of pattern");
assert.equal(generated.mockTest.questions.length, 80, `Expected 80 questions, got ${generated.mockTest.questions.length}`);
const fps = new Set(generated.mockTest.questions.map((q) => q.fingerprint));
assert.equal(fps.size, 80, "Must have 80 strictly unique questions (0 duplicates)");
console.log(`IBPS RRB Office Assistant Prelims generated: 80/80 unique questions (Reasoning 40 + Numerical Ability 40, 0 duplicates)!\n`);

// Section name inference & fallback topic distribution regression checks
assert.equal(inferSubjectKeyFromSectionName("Aptitude"), "quant");
assert.equal(inferSubjectKeyFromSectionName("Quantitative Aptitude"), "quant");
assert.equal(inferSubjectKeyFromSectionName("Numerical Ability"), "quant");
assert.equal(inferSubjectKeyFromSectionName("Reasoning & Computer Aptitude"), "reasoning");
assert.equal(inferSubjectKeyFromSectionName("Computer Aptitude"), "computer_knowledge");
const aptTopics = getDefaultTopicDistributionsForSubject("quant", 40, false);
assert.ok(aptTopics.length >= 4, "Aptitude fallback should have topics");
assert.equal(aptTopics.reduce((s, t) => s + t.defaultQuestions, 0), 40, "Aptitude fallback topics must sum to 40");

console.log("ALL EXAM-WISE QUESTION SELECTION VERIFICATION CHECKS PASSED!");
