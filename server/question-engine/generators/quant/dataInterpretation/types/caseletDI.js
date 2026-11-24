// Place at: server/question-engine/generators/quant/dataInterpretation/types/caseletDI.js
/**
 * Phase 2 & 3 Module E: CASELET DATA INTERPRETATION Generator
 * Generates paragraph-based DI sets from a canonical validated 3x2 dataset
 * whose stated conditions form a uniquely solvable system of equations.
 */
import { computeSetFingerprint, formatRatio, simplifyRatio } from "../diMath.js";
import { CASELET_SCENARIOS, EXAM_LEVELS_BY_DIFFICULTY } from "../diScenarios.js";
import { buildMatrixQuestions } from "../diQuestionBuilder.js";

export function generateCaseletDISet({
  difficulty = "Medium",
  setSize = 5,
  examLevel = null,
  setId = "DI_CASE_001",
  rng,
}) {
  const scenario = rng.pick(CASELET_SCENARIOS);
  const [e0, e1, e2] = scenario.entities;
  const [g0, g1] = scenario.groups;

  // Step 1: Construct exact canonical dataset FIRST so every ratio & percentage is clean!
  // Choose clean totals for e0, e1, e2
  const baseUnit = scenario.unit === "Rs." ? 1000 : 10;
  const mult0 = rng.pick([4, 5, 6, 8]); // e0 total
  const r0a = rng.pick([2, 3]);
  const r0b = rng.pick([3, 5]);
  const e0_g0 = mult0 * r0a * baseUnit;
  const e0_g1 = mult0 * r0b * baseUnit;
  const e0_tot = e0_g0 + e0_g1;

  // e1 total = e0_tot * (1 + pctDiff/100) or clean multiple
  const mult1 = rng.pick([4, 5, 6, 8]);
  const r1a = rng.pick([3, 4]);
  const r1b = rng.pick([2, 5]);
  const e1_g0 = mult1 * r1a * baseUnit;
  const e1_g1 = mult1 * r1b * baseUnit;
  const e1_tot = e1_g0 + e1_g1;

  // e2 has clean percentage split (40/60, 45/55, 60/40, 35/65, 55/45)
  const e2_pct0 = rng.pick([40, 45, 55, 60]);
  const e2_tot = rng.pick([20, 30, 40, 50]) * baseUnit;
  const e2_g0 = Math.round((e2_tot * e2_pct0) / 100);
  const e2_g1 = e2_tot - e2_g0;

  const grandTotal = e0_tot + e1_tot + e2_tot;
  const totalG0 = e0_g0 + e1_g0 + e2_g0;
  const totalG1 = e0_g1 + e1_g1 + e2_g1;

  const ratio0 = formatRatio(e0_g0, e0_g1);
  const ratio1 = formatRatio(e1_g0, e1_g1);
  const [ra, rb] = simplifyRatio(e0_g0, e0_g1);
  const [rc, rd] = simplifyRatio(e1_g0, e1_g1);

  // Build uniquely determinable paragraph statements:
  // Knowing grandTotal, e0_tot, e1_tot => e2_tot = grandTotal - e0_tot - e1_tot (unique!)
  // Knowing ratio(e0_g0 : e0_g1) & e0_tot => e0_g0, e0_g1 unique!
  // Knowing ratio(e1_g0 : e1_g1) & e1_tot => e1_g0, e1_g1 unique!
  // Knowing e2_pct0% of e2_tot => e2_g0, e2_g1 unique!
  let passage;
  if (difficulty === "Hard") {
    const diffE1E0 = e1_tot - e0_tot;
    const diffPhrase =
      diffE1E0 === 0
        ? `equal to that of ${e0}`
        : diffE1E0 > 0
        ? `${diffE1E0} ${scenario.unit} more than that of ${e0}`
        : `${Math.abs(diffE1E0)} ${scenario.unit} less than that of ${e0}`;

    passage =
      `Read the following information carefully and answer the questions given below.\n` +
      `The total count across three categories — ${e0}, ${e1}, and ${e2} — is ${grandTotal} ${scenario.unit}, divided into two groups: ${g0} and ${g1}. ` +
      `The total in ${e0} is ${e0_tot} ${scenario.unit}, where the ratio of ${g0} to ${g1} is ${ratio0}. ` +
      `The total in ${e1} is ${diffPhrase}, and the ratio of ${g0} to ${g1} in ${e1} is ${ratio1}. ` +
      `In ${e2}, ${e2_pct0}% of the total belong to ${g0}, and the remaining belong to ${g1}.`;
  } else {
    passage =
      `Read the following information carefully and answer the questions given below.\n` +
      `Across three categories — ${e0}, ${e1}, and ${e2} — the combined total is ${grandTotal} ${scenario.unit}, split between ${g0} and ${g1}. ` +
      `${e0} has a total of ${e0_tot} ${scenario.unit} with ${g0} and ${g1} in the ratio ${ratio0}. ` +
      `${e1} has a total of ${e1_tot} ${scenario.unit} with ${g0} and ${g1} in the ratio ${ratio1}. ` +
      `In ${e2}, ${e2_pct0}% of the total are ${g0} and the remaining are ${g1}.`;
  }

  const rows = [
    { label: e0, values: [e0_g0, e0_g1] },
    { label: e1, values: [e1_g0, e1_g1] },
    { label: e2, values: [e2_g0, e2_g1] },
  ];

  const dataset = {
    scenario: scenario.title,
    unit: scenario.unit,
    passage,
    columns: ["Category", g0, g1],
    rows,
    totals: {
      row_totals: [e0_tot, e1_tot, e2_tot],
      column_totals: [totalG0, totalG1],
      grand_total: grandTotal,
    },
    equations_summary: {
      unique_solution_verified: true,
      e0_ratio: [ra, rb],
      e1_ratio: [rc, rd],
      e2_g0_percent: e2_pct0,
      grand_total: grandTotal,
    },
  };

  const chart_spec = {
    chart_type: "caselet_passage",
    title: scenario.title,
    passage,
    unit: scenario.unit,
    derived_table_headers: dataset.columns,
    derived_table_rows: rows.map((r) => [r.label, ...r.values]),
  };

  const questions = buildMatrixQuestions({
    dataset,
    diType: "Caselet DI",
    setId,
    difficulty,
    setSize,
    entityNoun: scenario.unit === "Rs." ? "amount" : scenario.unit.toLowerCase(),
    rng,
  });

  return {
    topic: "Data Interpretation",
    di_type: "Caselet DI",
    phase: difficulty === "Hard" ? 3 : 2,
    title: scenario.title,
    difficulty,
    exam_level: examLevel || EXAM_LEVELS_BY_DIFFICULTY[difficulty] || EXAM_LEVELS_BY_DIFFICULTY.Medium,
    set_size: questions.length,
    dataset,
    chart_spec,
    questions,
    _set_fingerprint: computeSetFingerprint({
      diType: "Caselet DI",
      scenarioId: scenario.id,
      datasetStructure: "3x2_caselet",
      categoryCount: 3,
      numericalPattern: `${ratio0}_${ratio1}_${e2_pct0}pct`,
      chartType: "caselet_passage",
      questionTypes: questions.map((q) => q.question_type),
    }),
  };
}
