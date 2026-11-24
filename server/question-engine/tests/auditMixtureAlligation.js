// Place at: server/question-engine/tests/auditMixtureAlligation.js
import {
  generateMixtureAlligationBatch,
  ALL_MIXTURE_TEMPLATES,
} from "../generators/quant/mixtureAlligation/index.js";
import { R, ZERO } from "../generators/quant/mixtureAlligation/mixtureMath.js";
import {
  independentlyVerifyMixtureModel,
  validateMixtureQuestion,
} from "../generators/quant/mixtureAlligation/mixtureValidator.js";

console.log("=== HHK Mixture & Alligation Production QA Audit ===\n");

let totalVerified = 0;
let totalFailures = 0;

// 1. Verify all 18 Categories / Templates individually
for (const tpl of ALL_MIXTURE_TEMPLATES) {
  const diff = tpl.difficulties[0];
  const { questions, rejectedLogs } = generateMixtureAlligationBatch({
    count: 4,
    difficulty: diff,
    templateId: tpl.id,
    seed: 20261120 + tpl.category * 131,
  });

  if (questions.length < 2 || rejectedLogs.length > 0) {
    console.error(`[FAIL] ${tpl.id} (Cat ${tpl.category}): generated=${questions.length}, rejected=${rejectedLogs.length}`);
    if (rejectedLogs.length > 0) console.error("   Rejection:", rejectedLogs[0]);
    totalFailures++;
  } else {
    totalVerified += questions.length;
  }
}
console.log(`1. Template Coverage (${ALL_MIXTURE_TEMPLATES.length}/18 categories): ${totalVerified} verified questions, ${totalFailures} failures.`);

// 2. Seeded Reproducibility Check
const run1 = generateMixtureAlligationBatch({ count: 15, difficulty: "Medium", seed: 555123 });
const run2 = generateMixtureAlligationBatch({ count: 15, difficulty: "Medium", seed: 555123 });
const reproducible =
  run1.questions.length === 15 &&
  run1.questions.every(
    (q, i) => q.question === run2.questions[i].question && q.correct_answer_value === run2.questions[i].correct_answer_value
  );
console.log(`2. Seeded Reproducibility (15 Qs): ${reproducible ? "PASS" : "FAIL"}`);
if (!reproducible) totalFailures++;

// 3. Multi-Set Duplicate Prevention Check
const set1 = generateMixtureAlligationBatch({ count: 15, difficulty: "Medium", seed: 9001 });
const set2 = generateMixtureAlligationBatch({
  count: 15,
  difficulty: "Medium",
  seed: 9001,
  excludeFingerprints: set1.questions.map((q) => q.fingerprint),
});
const set1Fps = new Set(set1.questions.map((q) => q.fingerprint));
const noOverlap = set2.questions.length === 15 && set2.questions.every((q) => !set1Fps.has(q.fingerprint));
console.log(`3. Multi-Set Duplicate Prevention: ${noOverlap ? "PASS" : "FAIL"}`);
if (!noOverlap) totalFailures++;

// 4. Engine B Adversarial Boundary & Tamper Rejection Tests
const adversarialCases = [
  {
    name: "Impossible alligation mean outside [cheaper, dearer]",
    ok: independentlyVerifyMixtureModel({
      kind: "ALLIGATION_RATIO",
      cheaper: R(40),
      dearer: R(60),
      mean: R(65),
    }).ok,
  },
  {
    name: "Concentration exceeding 100%",
    ok: independentlyVerifyMixtureModel({
      kind: "CONCENTRATION_MIX",
      solutions: [{ vol: R(20), pct: R(110) }],
    }).ok,
  },
  {
    name: "Replacement volume >= total tank volume",
    ok: independentlyVerifyMixtureModel({
      kind: "SEQUENTIAL_OPERATIONS",
      initMilk: R(40),
      initWater: ZERO,
      operations: [{ removeQty: R(40), addMilk: ZERO, addWater: R(40) }],
    }).ok,
  },
  {
    name: "Dilution targetPct >= initPct",
    ok: independentlyVerifyMixtureModel({
      kind: "DILUTION",
      initVol: R(50),
      initPct: R(20),
      targetPct: R(30),
    }).ok,
  },
  {
    name: "Tampered answer rejected by Engine B",
    ok: validateMixtureQuestion({
      mathModel: {
        kind: "WEIGHTED_MEAN",
        items: [{ qty: R(20), price: R(40) }, { qty: R(30), price: R(50) }],
      },
      exactRationalAnswer: R(48), // Tampered! True mean is 46
      options: { A: "Rs. 45/kg", B: "Rs. 46/kg", C: "Rs. 48/kg", D: "Rs. 50/kg" },
      correct_answer: "C",
      correctOptionIndex: 2,
      prefix: "Rs. ",
      unit: "/kg",
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
console.log(`4. Engine B Adversarial & Tamper Rejection (${adversarialCases.length} checks): ${boundaryErrors === 0 ? "PASS" : "FAIL"}`);

console.log("\n=== Sample Verified Question ===");
console.log(JSON.stringify(run1.questions[0], null, 2));

console.log(`\n=== FINAL AUDIT STATUS: ${totalFailures === 0 ? "ALL CHECKS PASSED (0 ERRORS)" : `${totalFailures} FAILURES`} ===`);
process.exit(totalFailures === 0 ? 0 : 1);