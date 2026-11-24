// Place at: server/question-engine/tests/auditDataInterpretation.js
/**
 * Production QA & Independent Mathematical Validation Audit
 * for the HHK Data Interpretation Question Generator (Phases 1–4, All 8 DI Types).
 */
import {
  generateDISet,
  generateDIBatch,
  SUPPORTED_DI_TYPES,
} from "../generators/quant/dataInterpretation/index.js";
import { validateDISet } from "../generators/quant/dataInterpretation/diValidator.js";
import { generateFromQuestionEngine } from "../core/engineRouter.js";
import { generateTopicQuestions, isEngineSupportedTopic } from "../../services/questionGenerator.js";

console.log("=== HHK Data Interpretation Generator — Production QA Audit ===\n");

let totalSetsVerified = 0;
let totalQuestionsVerified = 0;
let totalFailures = 0;
const answerPositionDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

// 1. Exhaustive Coverage Audit across ALL 8 DI Types & All 3 Difficulties
for (const entry of SUPPORTED_DI_TYPES) {
  for (const diff of ["Easy", "Medium", "Hard"]) {
    try {
      const { diSet } = generateDISet({
        diType: entry.key,
        difficulty: diff,
        setSize: 5,
        seed: 20261120 + SUPPORTED_DI_TYPES.indexOf(entry) * 1000 + diff.length * 37,
        includeInternalMeta: true,
      });

      const report = validateDISet(diSet);
      if (!report.valid) {
        console.error(`[FAIL] ${entry.label} (${diff}):`, report.errors);
        totalFailures++;
      } else {
        totalSetsVerified++;
        for (const q of diSet.questions) {
          if (Object.keys(q.options).length !== 5) {
            console.error(`[FAIL] ${q.question_id}: Expected 5 options, got ${Object.keys(q.options).length}`);
            totalFailures++;
          }
          answerPositionDist[q.correct_answer]++;
          totalQuestionsVerified++;
        }
      }
    } catch (err) {
      console.error(`[FAIL] ${entry.label} (${diff}) threw:`, err.message);
      totalFailures++;
    }
  }
}
console.log(
  `1. All 8 DI Types × 3 Difficulties (24 sets): ${totalSetsVerified} sets / ${totalQuestionsVerified} questions verified, ${totalFailures} failures.`
);
console.log("   Correct Answer Position Distribution (A–E):", answerPositionDist);

// 2. Configurable Set Sizes (4, 5, 6) & Sub-Variants Coverage
let variantChecks = 0;
const variantConfigs = [
  { diType: "tabular", setSize: 4, difficulty: "Easy" },
  { diType: "tabular", setSize: 6, difficulty: "Hard" },
  { diType: "bar_graph", variant: "simple_vertical", setSize: 5 },
  { diType: "bar_graph", variant: "simple_horizontal", setSize: 5 },
  { diType: "bar_graph", variant: "comparative", setSize: 5 },
  { diType: "bar_graph", variant: "stacked", setSize: 5 },
  { diType: "pie_chart", mode: "percentage", setSize: 5 },
  { diType: "pie_chart", mode: "degree", setSize: 5 },
  { diType: "pie_chart", mode: "value", setSize: 5 },
  { diType: "pie_chart", mode: "comparative", setSize: 6 },
  { diType: "missing", presentation: "table", setSize: 5 },
  { diType: "missing", presentation: "bar", setSize: 5 },
  { diType: "missing", presentation: "line", setSize: 5 },
  { diType: "mixed", combo: "pie_plus_table", setSize: 5 },
  { diType: "mixed", combo: "bar_plus_table", setSize: 5 },
  { diType: "mixed", combo: "bar_plus_line", setSize: 6 },
];

for (let i = 0; i < variantConfigs.length; i++) {
  const cfg = variantConfigs[i];
  const { diSet } = generateDISet({ ...cfg, seed: 900100 + i * 73, includeInternalMeta: true });
  const rep = validateDISet(diSet);
  if (!rep.valid || diSet.questions.length !== cfg.setSize || diSet.set_size !== cfg.setSize) {
    console.error(`[FAIL] Variant config ${JSON.stringify(cfg)}:`, rep.errors);
    totalFailures++;
  } else {
    variantChecks++;
  }
}
console.log(`2. Sub-Variants & Configurable Set Sizes (4/5/6): ${variantChecks}/${variantConfigs.length} PASS.`);

// 3. Adversarial / Negative Validation Tests (Verify Independent Validator Catches Errors!)
let negativeCaught = 0;
const negativeTotal = 6;

// 3a. Corrupted row total
{
  const { diSet } = generateDISet({ diType: "tabular", seed: 111, includeInternalMeta: true });
  diSet.dataset.totals.row_totals[0] += 99;
  if (!validateDISet(diSet).valid) negativeCaught++;
  else {
    console.error("[FAIL] Validator missed corrupted row total!");
    totalFailures++;
  }
}

// 3b. Pie chart percentages != 100%
{
  const { diSet } = generateDISet({ diType: "pie_chart", seed: 222, includeInternalMeta: true });
  diSet.dataset.sectors[0].percentage += 5;
  if (!validateDISet(diSet).valid) negativeCaught++;
  else {
    console.error("[FAIL] Validator missed pie chart sum != 100%!");
    totalFailures++;
  }
}

// 3c. Duplicate / equivalent options ("25%" vs "25.0%")
{
  const { diSet } = generateDISet({ diType: "tabular", seed: 333, includeInternalMeta: true });
  diSet.questions[0].options.A = "450";
  diSet.questions[0].options.B = "450.00";
  if (!validateDISet(diSet).valid) negativeCaught++;
  else {
    console.error("[FAIL] Validator missed equivalent duplicate options!");
    totalFailures++;
  }
}

// 3d. Leaked missing value in Missing DI displayed table
{
  const { diSet } = generateDISet({ diType: "missing", presentation: "table", seed: 444, includeInternalMeta: true });
  const m = diSet.dataset.missing_cells[0];
  diSet.chart_spec.rows[m.row][m.col + 1] = m.true_value; // leak!
  if (!validateDISet(diSet).valid) negativeCaught++;
  else {
    console.error("[FAIL] Validator missed leaked missing value!");
    totalFailures++;
  }
}

// 3e. Bar graph chart_spec value mismatch vs source dataset
{
  const { diSet } = generateDISet({ diType: "bar_graph", variant: "comparative", seed: 555, includeInternalMeta: true });
  diSet.chart_spec.series[0].data[0] += 50;
  if (!validateDISet(diSet).valid) negativeCaught++;
  else {
    console.error("[FAIL] Validator missed bar chart vs dataset mismatch!");
    totalFailures++;
  }
}

// 3f. Wrong declared answer key
{
  const { diSet } = generateDISet({ diType: "line_graph", seed: 666, includeInternalMeta: true });
  const q0 = diSet.questions[0];
  q0.correct_answer = q0.correct_answer === "A" ? "B" : "A";
  if (!validateDISet(diSet).valid) negativeCaught++;
  else {
    console.error("[FAIL] Validator missed wrong answer key!");
    totalFailures++;
  }
}
console.log(`3. Adversarial Negative Validation Tests: ${negativeCaught}/${negativeTotal} corruptions caught.`);

// 4. Seeded Reproducibility & JSON Validity Check
const rep1 = generateDISet({ diType: "mixed", difficulty: "Hard", seed: 777888 });
const rep2 = generateDISet({ diType: "mixed", difficulty: "Hard", seed: 777888 });
const json1 = JSON.stringify(rep1.diSet);
const json2 = JSON.stringify(rep2.diSet);
const reproducible = json1 === json2 && JSON.parse(json1).set_validation.all_answers_verified === true;
console.log(`4. Seeded Reproducibility & Valid JSON Round-Trip: ${reproducible ? "PASS" : "FAIL"}`);
if (!reproducible) totalFailures++;

// 5. Multi-Set Duplicate Prevention Check
const batch = generateDIBatch({ setCount: 8, difficulty: "Medium", setSize: 5, seed: 50505 });
const uniqueFps = new Set(batch.fingerprints);
const dupPass = batch.sets.length === 8 && uniqueFps.size === 8;
console.log(`5. Multi-Set Duplicate Prevention (8 unique sets): ${dupPass ? "PASS" : "FAIL"}`);
if (!dupPass) totalFailures++;

// 6. HHK Engine Router & Question Generator Service Integration Test
const routerQs = generateFromQuestionEngine({
  examCode: "IBPS_PO",
  stageName: "Prelims",
  topicName: "Data Interpretation",
  subtopicName: "Pie Chart",
  difficulty: "medium",
  count: 5,
  optionCount: 5,
});
const serviceSupported = isEngineSupportedTopic("Data Interpretation") && isEngineSupportedTopic("Data Sufficiency");
const serviceRes = generateTopicQuestions({
  examCode: "SBI_PO",
  stageName: "Mains",
  topicName: "Data Interpretation",
  subtopicName: "Caselet DI",
  difficulty: "hard",
  count: 5,
  optionCount: 5,
});
const integrationPass =
  serviceSupported &&
  routerQs.length === 5 &&
  serviceRes.standaloneQuestions.length === 5 &&
  routerQs.every((q) => q.options.length === 5 && q.correctAnswer && q.diSetMeta?.chart_spec) &&
  serviceRes.standaloneQuestions.every((q) => q.options.length === 5 && q.correctAnswer && q.diSetMeta?.chart_spec);
console.log(`6. HHK Engine Router & QuestionGenerator Integration: ${integrationPass ? "PASS" : "FAIL"}`);
if (!integrationPass) totalFailures++;

console.log(`\n=== AUDIT SUMMARY: ${totalFailures === 0 ? "ALL CHECKS PASSED (0 FAILURES)" : `${totalFailures} FAILURES`} ===`);
if (totalFailures > 0) process.exit(1);
