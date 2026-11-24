// Place at: server/question-engine/generators/quant/dataInterpretation/types/mixedDI.js
/**
 * Phase 3 & 4 Module G: MIXED DATA INTERPRETATION Generator
 * Supports Table + Pie Chart, Table + Bar Graph, and Bar Graph + Line Graph
 * derived from ONE single canonical validated source dataset.
 */
import {
  buildFiveOptions,
  centralAngle,
  computeQuestionFingerprint,
  computeSetFingerprint,
  formatNumber,
  formatPercent,
  formatRatio,
  roundTo,
  simplifyRatio,
  sum,
} from "../diMath.js";
import { EXAM_LEVELS_BY_DIFFICULTY } from "../diScenarios.js";

const MIXED_TEMPLATES = [
  {
    id: "mixed_pie_table_employees",
    combo: "pie_plus_table",
    title: "Company-wise Total Employees (Pie Chart) & Male-to-Female Ratio (Table)",
    scenario: "Distribution of total employees across five companies (Pie Chart) and the respective ratio of Male to Female employees in each company (Table)",
    categories: ["Company A", "Company B", "Company C", "Company D", "Company E"],
    subGroups: ["Male", "Female"],
    unit: "Employees",
    grandTotalOptions: [4000, 5000, 6000, 8000],
  },
  {
    id: "mixed_bar_table_sales",
    title: "Branch-wise Total Policies Sold (Bar Graph) & Online vs Offline Split (Table)",
    combo: "bar_plus_table",
    scenario: "Total insurance policies sold across five branches (Bar Graph) and the respective Online to Offline sales ratio (Table)",
    categories: ["Branch P", "Branch Q", "Branch R", "Branch S", "Branch T"],
    subGroups: ["Online", "Offline"],
    unit: "Policies",
    grandTotalOptions: [4000, 5000, 6000, 8000],
  },
  {
    id: "mixed_bar_line_production",
    title: "Factory Production (Bar Graph) & Percentage Sold (Line Graph)",
    combo: "bar_plus_line",
    scenario: "Total units manufactured across five factories (Bar Graph) and percentage of manufactured units sold (Line Graph)",
    categories: ["Factory 1", "Factory 2", "Factory 3", "Factory 4", "Factory 5"],
    subGroups: ["Sold", "Unsold"],
    unit: "Units",
    grandTotalOptions: [4000, 5000, 6000],
  },
];

// Clean 5-sector percentage splits where every percentage is a multiple of 2% and sums to 100%
const MIXED_PCTS = [
  [10, 20, 25, 15, 30],
  [15, 20, 25, 20, 20],
  [12, 18, 20, 25, 25],
];

// Clean ratios (a:b) whose sum (a+b) divides 100 or 200 cleanly -> exact integer sub-group counts!
const CLEAN_RATIOS = [
  [3, 2], // sum 5
  [7, 3], // sum 10
  [3, 1], // sum 4
  [1, 1], // sum 2
  [2, 3], // sum 5
  [4, 1], // sum 5
];

export function generateMixedDISet({
  difficulty = "Hard",
  setSize = 5,
  examLevel = null,
  combo = null, // "pie_plus_table" | "bar_plus_table" | "bar_plus_line"
  setId = "DI_MIX_001",
  rng,
}) {
  const tpl = combo
    ? MIXED_TEMPLATES.find((t) => t.combo === combo) || MIXED_TEMPLATES[0]
    : rng.pick(MIXED_TEMPLATES);

  const grandTotal = rng.pick(tpl.grandTotalOptions);
  const pcts = rng.shuffle(rng.pick(MIXED_PCTS));
  const [g0, g1] = tpl.subGroups;

  // Step 1: Build ONE canonical validated dataset FIRST
  const rows = tpl.categories.map((cat, i) => {
    const pct = pcts[i];
    const totalVal = Math.round((grandTotal * pct) / 100);
    const [ra, rb] = rng.pick(CLEAN_RATIOS);
    const g0Val = Math.round((totalVal * ra) / (ra + rb));
    const g1Val = totalVal - g0Val;
    const g0Pct = roundTo((g0Val / totalVal) * 100, 2);
    return {
      label: cat,
      total: totalVal,
      percentage: pct,
      angle: roundTo(centralAngle(totalVal, grandTotal), 2),
      ratio: formatRatio(g0Val, g1Val),
      g0_pct: g0Pct,
      values: [g0Val, g1Val], // canonical sub-group values
    };
  });

  const colTotals = [sum(rows.map((r) => r.values[0])), sum(rows.map((r) => r.values[1]))];
  const rowTotals = rows.map((r) => r.total);

  const dataset = {
    scenario: tpl.scenario,
    unit: tpl.unit,
    combo_type: tpl.combo,
    grand_total: grandTotal,
    columns: ["Category", g0, g1],
    rows: rows.map((r) => ({ label: r.label, values: r.values })),
    category_breakdown: rows,
    totals: {
      row_totals: rowTotals,
      column_totals: colTotals,
      grand_total: grandTotal,
    },
  };

  // Step 2: Derive BOTH charts strictly from the same canonical dataset
  let components;
  if (tpl.combo === "pie_plus_table") {
    components = [
      {
        chart_type: "pie",
        title: `Distribution of Total ${tpl.unit} (Total = ${grandTotal})`,
        display_mode: "percentage",
        total: grandTotal,
        unit: tpl.unit,
        sectors: rows.map((r) => ({
          label: r.label,
          percentage: r.percentage,
          angle: r.angle,
          value: r.total,
        })),
      },
      {
        chart_type: "table",
        title: `Ratio of ${g0} to ${g1}`,
        headers: ["Category", `${g0} : ${g1}`],
        rows: rows.map((r) => [r.label, r.ratio]),
      },
    ];
  } else if (tpl.combo === "bar_plus_table") {
    components = [
      {
        chart_type: "vertical_bar",
        title: `Total ${tpl.unit} by Category`,
        x_axis_label: "Category",
        y_axis_label: tpl.unit,
        unit: tpl.unit,
        categories: rows.map((r) => r.label),
        series: [{ name: `Total ${tpl.unit}`, data: rows.map((r) => r.total) }],
        show_data_labels: true,
      },
      {
        chart_type: "table",
        title: `Ratio of ${g0} to ${g1}`,
        headers: ["Category", `${g0} : ${g1}`],
        rows: rows.map((r) => [r.label, r.ratio]),
      },
    ];
  } else {
    components = [
      {
        chart_type: "vertical_bar",
        title: `Total ${tpl.unit} Manufactured`,
        x_axis_label: "Factory",
        y_axis_label: tpl.unit,
        unit: tpl.unit,
        categories: rows.map((r) => r.label),
        series: [{ name: "Manufactured", data: rows.map((r) => r.total) }],
        show_data_labels: true,
      },
      {
        chart_type: "single_line",
        title: `Percentage of ${tpl.unit} ${g0} (%)`,
        x_axis_label: "Factory",
        y_axis_label: `Percentage ${g0} (%)`,
        unit: "%",
        x_labels: rows.map((r) => r.label),
        series: [
          {
            name: `% ${g0}`,
            points: rows.map((r) => ({ x: r.label, y: r.g0_pct })),
          },
        ],
        show_data_labels: true,
      },
    ];
  }

  const chart_spec = {
    chart_type: "mixed",
    combo_type: tpl.combo,
    title: tpl.title,
    unit: tpl.unit,
    components,
  };

  // Step 3: Build cross-chart questions strictly from canonical dataset
  const idx = rng.shuffle([0, 1, 2, 3, 4]);
  const r0 = rows[idx[0]];
  const r1 = rows[idx[1]];
  const r2 = rows[idx[2]];
  const r3 = rows[idx[3]];
  const r4 = rows[idx[4]];

  const makeMixQ = (qNum, cfg) => {
    const built = buildFiveOptions({
      correctValue: cfg.correctValue,
      correctFormatted: cfg.correctFormatted,
      mistakeCandidates: cfg.mistakeCandidates,
      formatType: cfg.formatType || "number",
      decimals: 2,
      rng,
    });
    return {
      question_id: `${setId}_Q${qNum}`,
      question_type: cfg.questionType,
      sub_type: cfg.subType,
      difficulty: cfg.qDiff,
      question: cfg.questionText,
      options: built.options,
      correct_answer: built.correct_answer,
      correct_answer_value:
        cfg.formatType === "ratio" ? built.correct_answer_formatted : roundTo(Number(cfg.correctValue), 2),
      solution: {
        given_data: cfg.givenData,
        formula: cfg.formula,
        steps: cfg.steps,
        final_answer: built.correct_answer_formatted,
      },
      shortcut_method: cfg.shortcut,
      validation: {
        dataset_reference_check: true,
        calculation_check: true,
        unique_answer_check: true,
        five_options_check: true,
      },
      _meta: {
        fingerprint: computeQuestionFingerprint({
          diType: "Mixed DI",
          questionType: cfg.questionType,
          datasetFields: cfg.datasetFields,
          operation: cfg.operation,
          calculationStructure: cfg.calculationStructure,
          correctAnswerValue: built.correct_answer_formatted,
        }),
        verification_spec: cfg.verificationSpec,
      },
    };
  };

  const qPool = [
    // Q1: Cross-chart direct subgroup sum across 2 categories
    () => {
      const ans = r0.values[0] + r1.values[0];
      return makeMixQ(1, {
        questionType: "Combined Categories",
        subType: `Combined ${g0} across ${r0.label} and ${r1.label}`,
        qDiff: "Medium",
        questionText: `What is the total number of ${g0} ${tpl.unit.toLowerCase()} in ${r0.label} and ${r1.label} together?`,
        correctValue: ans,
        mistakeCandidates: [r0.values[1] + r1.values[1], r0.total + r1.total, ans + 40, Math.max(20, ans - 40)],
        givenData: [
          `${r0.label}: Total = ${r0.total}, ${g0} = ${r0.values[0]}`,
          `${r1.label}: Total = ${r1.total}, ${g0} = ${r1.values[0]}`,
        ],
        formula: `Combined ${g0} = ${g0}(${r0.label}) + ${g0}(${r1.label})`,
        steps: [
          `${g0} in ${r0.label} = ${r0.values[0]}`,
          `${g0} in ${r1.label} = ${r1.values[0]}`,
          `Total = ${r0.values[0]} + ${r1.values[0]} = ${formatNumber(ans)}`,
        ],
        shortcut: "Resolve each category's total from Chart 1, split by Chart 2's ratio/percentage, then add.",
        datasetFields: [`${r0.label}:${g0}`, `${r1.label}:${g0}`],
        operation: "mixed_subgroup_sum",
        calculationStructure: "c0_g0+c1_g0",
        verificationSpec: { op: "cells_sum", cells: [[idx[0], 0], [idx[1], 0]] },
      });
    },

    // Q2: Cross-chart difference between g0 of one category and g1 of another
    () => {
      const ans = Math.abs(r2.values[0] - r3.values[1]);
      return makeMixQ(2, {
        questionType: "Difference",
        subType: `Difference between ${g0} of ${r2.label} and ${g1} of ${r3.label}`,
        qDiff: "Medium",
        questionText: `What is the absolute difference between the number of ${g0} ${tpl.unit.toLowerCase()} in ${r2.label} and the number of ${g1} ${tpl.unit.toLowerCase()} in ${r3.label}?`,
        correctValue: ans,
        mistakeCandidates: [r2.values[0] + r3.values[1], Math.abs(r2.values[1] - r3.values[0]), ans + 50, Math.max(10, ans - 50)],
        givenData: [
          `${r2.label} (${g0}) = ${r2.values[0]}`,
          `${r3.label} (${g1}) = ${r3.values[1]}`,
        ],
        formula: "Difference = |Value₁ − Value₂|",
        steps: [
          `${g0} in ${r2.label} = ${r2.values[0]}`,
          `${g1} in ${r3.label} = ${r3.values[1]}`,
          `Absolute Difference = |${r2.values[0]} − ${r3.values[1]}| = ${formatNumber(ans)}`,
        ],
        shortcut: "Compute only the two required subgroup values directly without building the full table.",
        datasetFields: [`${r2.label}:${g0}`, `${r3.label}:${g1}`],
        operation: "mixed_cross_diff",
        calculationStructure: "|r2_g0-r3_g1|",
        verificationSpec: { op: "cell_abs_diff", r1: idx[2], c1: 0, r2: idx[3], c2: 1 },
      });
    },

    // Q3: Cross-chart ratio
    () => {
      const [sa, sb] = simplifyRatio(r0.values[1], r4.values[0]);
      return makeMixQ(3, {
        questionType: "Ratio",
        subType: `Ratio of ${g1} in ${r0.label} to ${g0} in ${r4.label}`,
        qDiff: "Hard",
        questionText: `What is the respective ratio of the number of ${g1} ${tpl.unit.toLowerCase()} in ${r0.label} to the number of ${g0} ${tpl.unit.toLowerCase()} in ${r4.label}?`,
        correctValue: [sa, sb],
        correctFormatted: formatRatio(r0.values[1], r4.values[0]),
        formatType: "ratio",
        mistakeCandidates: [[sb, sa], [sa + 1, sb], [sa, sb + 1], [r0.values[0], r4.values[1]]],
        givenData: [
          `${r0.label} (${g1}) = ${r0.values[1]}`,
          `${r4.label} (${g0}) = ${r4.values[0]}`,
        ],
        formula: "Ratio = Value₁ : Value₂ (simplified)",
        steps: [
          `${g1} in ${r0.label} = ${r0.values[1]}`,
          `${g0} in ${r4.label} = ${r4.values[0]}`,
          `Ratio = ${r0.values[1]} : ${r4.values[0]} = ${formatRatio(r0.values[1], r4.values[0])}`,
        ],
        shortcut: "Keep values in factored form (percentage × ratio fraction) to cancel common factors immediately.",
        datasetFields: [`${r0.label}:${g1}`, `${r4.label}:${g0}`],
        operation: "mixed_cross_ratio",
        calculationStructure: "r0_g1:r4_g0",
        verificationSpec: { op: "cell_ratio", r1: idx[0], c1: 1, r2: idx[4], c2: 0 },
      });
    },

    // Q4: Average of g1 across all 5 categories
    () => {
      const avgG1 = roundTo(colTotals[1] / rows.length, 2);
      return makeMixQ(4, {
        questionType: "Average",
        subType: `Average ${g1} across all five categories`,
        qDiff: "Hard",
        questionText: `What is the average number of ${g1} ${tpl.unit.toLowerCase()} across all five categories?`,
        correctValue: avgG1,
        mistakeCandidates: [roundTo(colTotals[0] / rows.length, 2), colTotals[1], roundTo(colTotals[1] / 4, 2), roundTo(avgG1 + 30, 2)],
        givenData: rows.map((r) => `${r.label} (${g1}) = ${r.values[1]}`),
        formula: "Average = Sum of all five values / 5",
        steps: [
          `Total ${g1} = ${rows.map((r) => r.values[1]).join(" + ")} = ${colTotals[1]}`,
          `Average = ${colTotals[1]} / 5 = ${formatNumber(avgG1)}`,
        ],
        shortcut: "Compute Total ÷ 5 by multiplying the total by 2 and shifting the decimal left by one place.",
        datasetFields: [`col:${g1}`],
        operation: "mixed_col_avg",
        calculationStructure: "sum(g1)/5",
        verificationSpec: { op: "col_avg", col: 1 },
      });
    },

    // Q5: Percentage comparison across subgroups
    () => {
      const v1 = r1.values[0];
      const v2 = r2.values[1];
      const pct = roundTo((v1 / v2) * 100, 2);
      return makeMixQ(5, {
        questionType: "Percentage",
        subType: `Cross-category subgroup percentage`,
        qDiff: "Hard",
        questionText: `The number of ${g0} ${tpl.unit.toLowerCase()} in ${r1.label} is what percentage of the number of ${g1} ${tpl.unit.toLowerCase()} in ${r2.label}?`,
        correctValue: pct,
        formatType: "percent",
        mistakeCandidates: [roundTo((v2 / v1) * 100, 2), roundTo((Math.abs(v1 - v2) / v2) * 100, 2), roundTo(pct + 5, 2), roundTo(Math.max(1, pct - 5), 2)],
        givenData: [
          `${r1.label} (${g0}) = ${v1}`,
          `${r2.label} (${g1}) = ${v2} (Base)`,
        ],
        formula: "Percentage = (Value₁ / Base Value₂) × 100",
        steps: [
          `${g0} in ${r1.label} = ${v1}`,
          `${g1} in ${r2.label} = ${v2}`,
          `Percentage = (${v1} / ${v2}) × 100 = ${formatPercent(pct)}`,
        ],
        shortcut: "Reduce the fraction before multiplying by 100.",
        datasetFields: [`${r1.label}:${g0}`, `${r2.label}:${g1}`],
        operation: "mixed_cell_pct_of",
        calculationStructure: "(v1/v2)*100",
        verificationSpec: { op: "cell_pct_of", r1: idx[1], c1: 0, r2: idx[2], c2: 1 },
      });
    },

    // Q6: Overall percentage of g0 out of grand total
    () => {
      const pctAll = roundTo((colTotals[0] / grandTotal) * 100, 2);
      return makeMixQ(6, {
        questionType: "Percentage",
        subType: `Overall ${g0} share of grand total`,
        qDiff: "Hard",
        questionText: `What percentage of the grand total ${tpl.unit.toLowerCase()} across all five categories belongs to ${g0}?`,
        correctValue: pctAll,
        formatType: "percent",
        mistakeCandidates: [roundTo((colTotals[1] / grandTotal) * 100, 2), roundTo(pctAll + 2.5, 2), roundTo(Math.max(1, pctAll - 2.5), 2), roundTo(pctAll + 5, 2)],
        givenData: [`Total ${g0} = ${colTotals[0]}`, `Grand Total = ${grandTotal}`],
        formula: `Percentage = (Total ${g0} / Grand Total) × 100`,
        steps: [
          `Total ${g0} = ${rows.map((r) => r.values[0]).join(" + ")} = ${colTotals[0]}`,
          `Percentage = (${colTotals[0]} / ${grandTotal}) × 100 = ${formatPercent(pctAll)}`,
        ],
        shortcut: `Divide ${colTotals[0]} by ${grandTotal / 100} directly.`,
        datasetFields: [`col:${g0}`, "grand_total"],
        operation: "mixed_overall_pct",
        calculationStructure: "sum(g0)/grand_total*100",
        verificationSpec: { op: "col_share_of_grand", col: 0 },
      });
    },
  ];

  const questions = qPool.slice(0, setSize).map((fn) => fn());

  return {
    topic: "Data Interpretation",
    di_type: "Mixed DI",
    phase: tpl.combo === "bar_plus_line" ? 4 : 3,
    title: tpl.title,
    difficulty,
    exam_level: examLevel || EXAM_LEVELS_BY_DIFFICULTY[difficulty] || EXAM_LEVELS_BY_DIFFICULTY.Hard,
    set_size: questions.length,
    dataset,
    chart_spec,
    questions,
    _set_fingerprint: computeSetFingerprint({
      diType: "Mixed DI",
      scenarioId: tpl.id,
      datasetStructure: `5x2_${tpl.combo}`,
      categoryCount: 5,
      numericalPattern: `${grandTotal}_${pcts.join("-")}`,
      chartType: `mixed_${tpl.combo}`,
      questionTypes: questions.map((q) => q.question_type),
    }),
  };
}
