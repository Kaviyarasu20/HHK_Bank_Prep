// Place at: server/question-engine/tests/auditProbability.js
import {
  generateProbabilityBatch,
  ALL_PROBABILITY_TEMPLATES,
} from "../generators/quant/probability/index.js";
import { R } from "../generators/quant/probability/probabilityMath.js";
import {
  independentlyVerifyProbabilityModel,
  validateProbabilityQuestion,
} from "../generators/quant/probability/probabilityValidator.js";

console.log("=== HHK Probability Production QA Audit (5-Option Standard) ===\n");

let totalVerified = 0;
let totalFailures = 0;
const answerPositionDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

// 1. Exhaustive Template Coverage Audit across all 29 templates (Categories A–J)
for (const tpl of ALL_PROBABILITY_TEMPLATES) {
  const diff = tpl.difficulties[0];
  const { questions, rejectedLogs } = generateProbabilityBatch({
    count: 3,
    difficulty: diff,
    templateId: tpl.id,
    seed: 20261120 + ALL_PROBABILITY_TEMPLATES.indexOf(tpl) * 127,
  });

  if (questions.length < 1 || rejectedLogs.length > 0) {
    console.error(`[FAIL] ${tpl.id} (Cat ${tpl.category}): generated=${questions.length}, rejected=${rejectedLogs.length}`);
    if (rejectedLogs.length > 0) console.error("   Rejection:", rejectedLogs[0]);
    totalFailures++;
  } else {
    for (const q of questions) {
      if (q.optionsArray.length !== 5 || Object.keys(q.options).length !== 5) {
        console.error(`[FAIL] ${tpl.id} did not produce exactly 5 options!`);
        totalFailures++;
      }
      answerPositionDist[q.correct_answer]++;
      totalVerified++;
    }
  }
}
console.log(
  `1. Template Coverage (${ALL_PROBABILITY_TEMPLATES.length} templates across Categories A–J): ${totalVerified} verified 5-option questions, ${totalFailures} failures.`
);
console.log("   Correct Answer Position Distribution (A–E):", answerPositionDist);

// 2. Seeded Reproducibility Check
const run1 = generateProbabilityBatch({ count: 15, difficulty: "Medium", seed: 222999 });
const run2 = generateProbabilityBatch({ count: 15, difficulty: "Medium", seed: 222999 });
const reproducible =
  run1.questions.length === 15 &&
  run1.questions.every(
    (q, i) => q.question === run2.questions[i].question && q.correct_answer_value === run2.questions[i].correct_answer_value
  );
console.log(`2. Seeded Reproducibility (15 Qs): ${reproducible ? "PASS" : "FAIL"}`);
if (!reproducible) totalFailures++;

// 3. Multi-Set Duplicate Prevention Check
const set1 = generateProbabilityBatch({ count: 15, difficulty: "Medium", seed: 6060 });
const set2 = generateProbabilityBatch({
  count: 15,
  difficulty: "Medium",
  seed: 6060,
  excludeFingerprints: set1.questions.map((q) => q.fingerprint),
});
const set1Fps = new Set(set1.questions.map((q) => q.fingerprint));
const noOverlap = set2.questions.length === 15 && set2.questions.every((q) => !set1Fps.has(q.fingerprint));
console.log(`3. Multi-Set Duplicate Prevention: ${noOverlap ? "PASS" : "FAIL"}`);
if (!noOverlap) totalFailures++;

// 4. Engine B Deck Composition, Probability Bounds & 5-Option Enforcement Tests
const faceCardCheck = independentlyVerifyProbabilityModel({ kind: "CARDS_SINGLE", event: "FACE" });
const deckFaceOk = faceCardCheck.ok && faceCardCheck.value.toFractionString() === "3/13";
console.log(`4. Standard 52-Card Deck Check (Face Cards = 12/52 = 3/13, Ace excluded): ${deckFaceOk ? "PASS" : "FAIL"}`);
if (!deckFaceOk) totalFailures++;

const adversarialCases = [
  {
    name: "Favourable outcomes exceed total outcomes (P > 1)",
    ok: independentlyVerifyProbabilityModel({ kind: "DIRECT_RATIO", favourable: 12, total: 10 }).ok,
  },
  {
    name: "Mutually exclusive probabilities summing > 1",
    ok: independentlyVerifyProbabilityModel({
      kind: "EVENTS_ALGEBRA",
      mode: "MUTUALLY_EXCLUSIVE_UNION",
      pA: R(2, 3),
      pB: R(1, 2),
    }).ok,
  },
  {
    name: "Conditional probability with P(B) = 0",
    ok: independentlyVerifyProbabilityModel({
      kind: "EVENTS_ALGEBRA",
      mode: "CONDITIONAL_FORMULA",
      pA: R(1, 2),
      pB: R(0, 1),
      pAandB: R(0, 1),
    }).ok,
  },
  {
    name: "Only 4 options provided instead of mandatory 5 options (A–E)",
    ok: validateProbabilityQuestion({
      mathModel: { kind: "DIRECT_RATIO", favourable: 4, total: 10 },
      exactRationalAnswer: R(2, 5),
      options: { A: "1/5", B: "2/5", C: "3/5", D: "4/5" },
      correct_answer: "B",
      correctOptionIndex: 1,
      solution: { steps: ["Step 1", "Step 2"] },
    }).passed,
  },
  {
    name: "Tampered answer rejected by Engine B",
    ok: validateProbabilityQuestion({
      mathModel: { kind: "DICE", numDice: 2, event: "SUM_EQ", target: 7 },
      exactRationalAnswer: R(1, 4), // Tampered! True probability is 6/36 = 1/6
      options: { A: "1/6", B: "1/4", C: "1/3", D: "5/36", E: "7/36" },
      correct_answer: "B",
      correctOptionIndex: 1,
      solution: { steps: ["Step 1", "Step 2"] },
    }).passed,
  },
];

let boundaryErrors = 0;
for (const tc of adversarialCases) {
  if (tc.ok !== false) {
    console.error(`[FAIL] Engine B failed to reject: ${tc.name}`);
    boundaryErrors++;
    totalFailures++;
  }
}
console.log(`5. Engine B Adversarial & 5-Option Enforcement (${adversarialCases.length} checks): ${boundaryErrors === 0 ? "PASS" : "FAIL"}`);

console.log("\n=== Sample Verified 5-Option Probability Question ===");
console.log(JSON.stringify(run1.questions[0], null, 2));

console.log(`\n=== FINAL AUDIT STATUS: ${totalFailures === 0 ? "ALL CHECKS PASSED (0 ERRORS)" : `${totalFailures} FAILURES`} ===`);
process.exit(totalFailures === 0 ? 0 : 1);