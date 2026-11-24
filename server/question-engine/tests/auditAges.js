// Place at: server/question-engine/tests/auditAges.js
import {
  generateAgesBatch,
  ALL_AGES_TEMPLATES,
} from "../generators/quant/problemsOnAges/index.js";
import { R, ZERO } from "../generators/quant/problemsOnAges/agesMath.js";
import {
  independentlyVerifyAgesModel,
  validateAgesQuestion,
} from "../generators/quant/problemsOnAges/agesValidator.js";

console.log("=== HHK Problems on Ages Production QA Audit (5-Option Standard) ===\n");

let totalVerified = 0;
let totalFailures = 0;
const answerPositionDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

// 1. Exhaustive Template Coverage Audit across all 28 templates (Categories A–H)
for (const tpl of ALL_AGES_TEMPLATES) {
  const diff = tpl.difficulties[0];
  const { questions, rejectedLogs } = generateAgesBatch({
    count: 4,
    difficulty: diff,
    templateId: tpl.id,
    seed: 20261120 + ALL_AGES_TEMPLATES.indexOf(tpl) * 113,
  });

  if (questions.length < 2 || rejectedLogs.length > 0) {
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
  `1. Template Coverage (${ALL_AGES_TEMPLATES.length} templates across Categories A–H): ${totalVerified} verified 5-option questions, ${totalFailures} failures.`
);
console.log("   Correct Answer Position Distribution (A–E):", answerPositionDist);

// 2. Seeded Reproducibility Check
const run1 = generateAgesBatch({ count: 15, difficulty: "Medium", seed: 333777 });
const run2 = generateAgesBatch({ count: 15, difficulty: "Medium", seed: 333777 });
const reproducible =
  run1.questions.length === 15 &&
  run1.questions.every(
    (q, i) => q.question === run2.questions[i].question && q.correct_answer_value === run2.questions[i].correct_answer_value
  );
console.log(`2. Seeded Reproducibility (15 Qs): ${reproducible ? "PASS" : "FAIL"}`);
if (!reproducible) totalFailures++;

// 3. Multi-Set Duplicate Prevention Check
const set1 = generateAgesBatch({ count: 15, difficulty: "Medium", seed: 7070 });
const set2 = generateAgesBatch({
  count: 15,
  difficulty: "Medium",
  seed: 7070,
  excludeFingerprints: set1.questions.map((q) => q.fingerprint),
});
const set1Fps = new Set(set1.questions.map((q) => q.fingerprint));
const noOverlap = set2.questions.length === 15 && set2.questions.every((q) => !set1Fps.has(q.fingerprint));
console.log(`3. Multi-Set Duplicate Prevention: ${noOverlap ? "PASS" : "FAIL"}`);
if (!noOverlap) totalFailures++;

// 4. Engine B Adversarial Boundary, Physical Age & 5-Option Enforcement Tests
const adversarialCases = [
  {
    name: "Person not alive at past time (negative past age)",
    ok: independentlyVerifyAgesModel({
      kind: "SUM_AND_DIFF",
      sum: R(20),
      diff: R(10), // ages 15 and 5
      ask: "YOUNGER",
      offset: R(-8), // 5 - 8 = -3 (impossible!)
    }).ok,
  },
  {
    name: "Unrealistic parent-child age difference (< 18 years)",
    ok: independentlyVerifyAgesModel({
      kind: "AGE_AT_BIRTH",
      parentAge: R(25),
      childAge: R(15), // gap = 10 years (impossible!)
    }).ok,
  },
  {
    name: "Degenerate ratio system (same ratio at two different times)",
    ok: independentlyVerifyAgesModel({
      kind: "TWO_RATIO_SYSTEM",
      t1: ZERO,
      a1: R(2),
      b1: R(3),
      t2: R(6),
      a2: R(2),
      b2: R(3),
    }).ok,
  },
  {
    name: "Only 4 options provided instead of mandatory 5 options (A–E)",
    ok: validateAgesQuestion({
      mathModel: { kind: "SUM_AND_DIFF", sum: R(50), diff: R(10), ask: "OLDER" },
      exactRationalAnswer: R(30),
      options: { A: "30 years", B: "20 years", C: "25 years", D: "35 years" },
      correct_answer: "A",
      correctOptionIndex: 0,
      unit: "years",
      solution: { steps: ["Step 1", "Step 2"] },
    }).passed,
  },
  {
    name: "Tampered answer rejected by Engine B",
    ok: validateAgesQuestion({
      mathModel: { kind: "SUM_AND_DIFF", sum: R(50), diff: R(10), ask: "OLDER" },
      exactRationalAnswer: R(32), // Tampered! True older age is 30
      options: { A: "30 years", B: "32 years", C: "20 years", D: "25 years", E: "35 years" },
      correct_answer: "B",
      correctOptionIndex: 1,
      unit: "years",
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
console.log(`4. Engine B Adversarial & 5-Option Enforcement (${adversarialCases.length} checks): ${boundaryErrors === 0 ? "PASS" : "FAIL"}`);

console.log("\n=== Sample Verified 5-Option Problems on Ages Question ===");
console.log(JSON.stringify(run1.questions[0], null, 2));

console.log(`\n=== FINAL AUDIT STATUS: ${totalFailures === 0 ? "ALL CHECKS PASSED (0 ERRORS)" : `${totalFailures} FAILURES`} ===`);
process.exit(totalFailures === 0 ? 0 : 1);