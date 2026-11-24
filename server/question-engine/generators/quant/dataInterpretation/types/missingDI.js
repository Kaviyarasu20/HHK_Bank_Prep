// Place at: server/question-engine/generators/quant/dataInterpretation/types/missingDI.js
/**
 * Phase 2 & 3 Module F: MISSING DATA INTERPRETATION Generator
 * Generates missing table / bar / line values that are UNIQUELY determinable
 * from row totals, column totals, or stated ratios, while NEVER leaking the
 * missing values in the displayed presentation.
 */
import {
  buildFiveOptions,
  computeQuestionFingerprint,
  computeSetFingerprint,
  formatNumber,
  roundTo,
  sum,
} from "../diMath.js";
import { EXAM_LEVELS_BY_DIFFICULTY, TABLE_SCENARIOS } from "../diScenarios.js";
import { buildMatrixQuestions } from "../diQuestionBuilder.js";

export function generateMissingDISet({
  difficulty = "Medium",
  setSize = 5,
  examLevel = null,
  presentation = null, // "table" | "bar" | "line"
  setId = "DI_MISS_001",
  rng,
}) {
  const scenario = rng.pick(TABLE_SCENARIOS);
  const mode = presentation || (difficulty === "Hard" ? rng.pick(["table", "bar", "line"]) : "table");
  const selectedCols = scenario.columns.slice(0, 3);
  const [minV, maxV] = scenario.valueRange;
  const step = scenario.step;
  const stepsCount = Math.floor((maxV - minV) / step);

  // Step 1: Generate complete canonical dataset FIRST
  const rows = scenario.rows.map((label) => ({
    label,
    values: selectedCols.map(() => minV + rng.int(0, stepsCount) * step),
  }));

  const rowTotals = rows.map((r) => sum(r.values));
  const colTotals = selectedCols.map((_, cIdx) => sum(rows.map((r) => r.values[cIdx])));
  const grandTotal = sum(rowTotals);

  // Step 2: Select missing cells such that AT MOST ONE cell is missing per row AND per column!
  // This mathematically guarantees a unique solution from row/column totals (rank-complete elimination).
  const missingCount = difficulty === "Easy" ? 1 : difficulty === "Medium" ? 2 : 3;
  const shuffledRows = rng.shuffle([0, 1, 2, 3, 4]);
  const shuffledCols = rng.shuffle([0, 1, 2]);
  const missingCells = [];
  for (let i = 0; i < missingCount; i++) {
    const r = shuffledRows[i];
    const c = shuffledCols[i % selectedCols.length];
    missingCells.push({
      row: r,
      col: c,
      row_label: rows[r].label,
      col_label: selectedCols[c],
      true_value: rows[r].values[c],
      derivation_method: "row_total_subtraction",
    });
  }

  const isMissing = (r, c) => missingCells.some((m) => m.row === r && m.col === c);

  // Displayed rows strictly mask missing cells with null / "--" (never leak!)
  const displayedRows = rows.map((r, rIdx) => ({
    label: r.label,
    values: r.values.map((v, cIdx) => (isMissing(rIdx, cIdx) ? null : v)),
    row_total: rowTotals[rIdx],
  }));

  const dataset = {
    scenario: `${scenario.scenario} (some values are missing and marked as '--'; row totals are given)`,
    unit: scenario.unit,
    columns: [scenario.rowHeader, ...selectedCols],
    rows, // canonical validated source of truth
    displayed_rows: displayedRows, // masked view with row totals for unique solvability
    missing_cells: missingCells,
    totals: {
      row_totals: rowTotals,
      column_totals: colTotals,
      grand_total: grandTotal,
    },
  };

  const chart_spec =
    mode === "table"
      ? {
          chart_type: "missing_table",
          title: `${scenario.title} (Missing Data Table)`,
          headers: [...dataset.columns, "Row Total"],
          unit: scenario.unit,
          rows: displayedRows.map((r) => [
            r.label,
            ...r.values.map((v) => (v === null ? "--" : v)),
            r.row_total,
          ]),
          column_totals_row: ["Column Total", ...colTotals, grandTotal],
        }
      : {
          chart_type: mode === "bar" ? "missing_grouped_bar" : "missing_multi_line",
          title: `${scenario.title} (Missing ${mode === "bar" ? "Bar" : "Line"} Values)`,
          x_axis_label: scenario.rowHeader,
          y_axis_label: scenario.unit,
          unit: scenario.unit,
          categories: rows.map((r) => r.label),
          row_totals_given: rows.map((r, i) => ({ label: r.label, total: rowTotals[i] })),
          series: selectedCols.map((colName, cIdx) => ({
            name: colName,
            data: displayedRows.map((r) => r.values[cIdx]), // null for missing values
          })),
          show_data_labels: true,
          legend: true,
        };

  // Build explicit Missing Value question(s) first, then fill remaining with matrix questions
  const extraQuestions = [];
  const primaryMissing = missingCells[0];
  const otherColsInRow = rows[primaryMissing.row].values
    .map((v, cIdx) => ({ col: selectedCols[cIdx], val: v, cIdx }))
    .filter((item) => item.cIdx !== primaryMissing.col);
  const sumKnown = sum(otherColsInRow.map((x) => x.val));
  const mVal = primaryMissing.true_value;

  const builtMissingQ = buildFiveOptions({
    correctValue: mVal,
    mistakeCandidates: [
      sumKnown,
      mVal + step,
      Math.max(step, mVal - step),
      mVal + step * 2,
      rowTotals[primaryMissing.row],
    ],
    formatType: "number",
    rng,
  });

  extraQuestions.push({
    question_id: `${setId}_Q1`,
    question_type: "Missing Value",
    sub_type: `Find missing value for ${primaryMissing.row_label} (${primaryMissing.col_label})`,
    difficulty: "Medium",
    question: `Using the given row totals, find the missing value (in ${scenario.unit}) for ${primaryMissing.row_label} in ${primaryMissing.col_label}.`,
    options: builtMissingQ.options,
    correct_answer: builtMissingQ.correct_answer,
    correct_answer_value: roundTo(mVal, 2),
    solution: {
      given_data: [
        `Row Total for ${primaryMissing.row_label} = ${rowTotals[primaryMissing.row]} ${scenario.unit}`,
        ...otherColsInRow.map((x) => `${primaryMissing.row_label} (${x.col}) = ${x.val} ${scenario.unit}`),
      ],
      formula: "Missing Value = Row Total − Sum of Known Values in that Row",
      steps: [
        `Sum of known values = ${otherColsInRow.map((x) => x.val).join(" + ")} = ${sumKnown}`,
        `Missing Value = ${rowTotals[primaryMissing.row]} − ${sumKnown} = ${formatNumber(mVal)} ${scenario.unit}`,
      ],
      final_answer: builtMissingQ.correct_answer_formatted,
    },
    shortcut_method: `Subtract the sum of the visible entries (${sumKnown}) directly from the row total (${rowTotals[primaryMissing.row]}).`,
    validation: {
      dataset_reference_check: true,
      calculation_check: true,
      unique_answer_check: true,
      five_options_check: true,
    },
    _meta: {
      fingerprint: computeQuestionFingerprint({
        diType: "Missing DI",
        questionType: "Missing Value",
        datasetFields: [`missing:${primaryMissing.row_label}:${primaryMissing.col_label}`],
        operation: "missing_cell_value",
        calculationStructure: "row_total-sum(known)",
        correctAnswerValue: builtMissingQ.correct_answer_formatted,
      }),
      verification_spec: { op: "cell_value", row: primaryMissing.row, col: primaryMissing.col },
    },
  });

  // If 2+ missing values, add a combined missing values sum question
  if (missingCells.length >= 2) {
    const m0 = missingCells[0];
    const m1 = missingCells[1];
    const sumMissing = m0.true_value + m1.true_value;
    const builtSumQ = buildFiveOptions({
      correctValue: sumMissing,
      mistakeCandidates: [
        Math.abs(m0.true_value - m1.true_value),
        sumMissing + step,
        Math.max(step, sumMissing - step),
        sumMissing + step * 2,
        m0.true_value * 2,
      ],
      formatType: "number",
      rng,
    });
    extraQuestions.push({
      question_id: `${setId}_Q2`,
      question_type: "Missing Value",
      sub_type: "Sum of two missing values",
      difficulty: "Hard",
      question: `What is the sum of the missing values of ${m0.row_label} (${m0.col_label}) and ${m1.row_label} (${m1.col_label})?`,
      options: builtSumQ.options,
      correct_answer: builtSumQ.correct_answer,
      correct_answer_value: roundTo(sumMissing, 2),
      solution: {
        given_data: [
          `${m0.row_label} Row Total = ${rowTotals[m0.row]}`,
          `${m1.row_label} Row Total = ${rowTotals[m1.row]}`,
        ],
        formula: "Required Sum = Missing₁ + Missing₂",
        steps: [
          `Missing value for ${m0.row_label} (${m0.col_label}) = ${rowTotals[m0.row]} − ${rowTotals[m0.row] - m0.true_value} = ${m0.true_value}`,
          `Missing value for ${m1.row_label} (${m1.col_label}) = ${rowTotals[m1.row]} − ${rowTotals[m1.row] - m1.true_value} = ${m1.true_value}`,
          `Sum = ${m0.true_value} + ${m1.true_value} = ${sumMissing}`,
        ],
        final_answer: builtSumQ.correct_answer_formatted,
      },
      shortcut_method: "Solve each missing value independently from its row total, then add them.",
      validation: {
        dataset_reference_check: true,
        calculation_check: true,
        unique_answer_check: true,
        five_options_check: true,
      },
      _meta: {
        fingerprint: computeQuestionFingerprint({
          diType: "Missing DI",
          questionType: "Missing Value",
          datasetFields: [`missing:${m0.row_label}:${m0.col_label}`, `missing:${m1.row_label}:${m1.col_label}`],
          operation: "sum_two_missing",
          calculationStructure: "m0+m1",
          correctAnswerValue: builtSumQ.correct_answer_formatted,
        }),
        verification_spec: { op: "cells_sum", cells: [[m0.row, m0.col], [m1.row, m1.col]] },
      },
    });
  }

  const questions = buildMatrixQuestions({
    dataset,
    diType: "Missing DI",
    setId,
    difficulty,
    setSize,
    entityNoun: scenario.unit === "Units" ? "sales" : scenario.unit.toLowerCase(),
    rng,
    extraQuestions,
  });

  return {
    topic: "Data Interpretation",
    di_type: "Missing DI",
    phase: mode === "table" ? 2 : 3,
    title: `${scenario.title} (Missing ${mode.charAt(0).toUpperCase() + mode.slice(1)} DI)`,
    difficulty,
    exam_level: examLevel || EXAM_LEVELS_BY_DIFFICULTY[difficulty] || EXAM_LEVELS_BY_DIFFICULTY.Medium,
    set_size: questions.length,
    dataset,
    chart_spec,
    questions,
    _set_fingerprint: computeSetFingerprint({
      diType: "Missing DI",
      scenarioId: scenario.id,
      datasetStructure: `${rows.length}x${selectedCols.length}_miss${missingCount}`,
      categoryCount: rows.length,
      numericalPattern: `${mode}_missing_${missingCount}`,
      chartType: chart_spec.chart_type,
      questionTypes: questions.map((q) => q.question_type),
    }),
  };
}
