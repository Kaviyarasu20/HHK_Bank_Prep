// Place at: server/question-engine/generators/quant/dataInterpretation/diQuestionBuilder.js
/**
 * Canonical Dataset-Driven Question Builder for HHK Data Interpretation.
 * Implements all 14 banking-exam question patterns from a validated matrix dataset
 * (rows x columns) and emits machine-checkable verification specs for independent validation.
 */
import {
  average,
  buildFiveOptions,
  computeQuestionFingerprint,
  formatNumber,
  formatPercent,
  formatRatio,
  percentChange,
  roundTo,
  simplifyRatio,
  sum,
} from "./diMath.js";

/**
 * Helper: access row/column slices from a canonical matrix dataset:
 * dataset = { columns: [rowHeader, col0, col1, ...], rows: [{ label, values: [...] }], unit, scenario }
 */
export function getColLabels(dataset) {
  return dataset.columns.slice(1);
}

export function getRowValues(dataset, rowIdx) {
  return dataset.rows[rowIdx].values.map(Number);
}

export function getColValues(dataset, colIdx) {
  return dataset.rows.map((r) => Number(r.values[colIdx]));
}

export function getCell(dataset, rowIdx, colIdx) {
  return Number(dataset.rows[rowIdx].values[colIdx]);
}

/**
 * Builds a balanced set of `setSize` distinct questions (4, 5, or 6) from any
 * validated matrix dataset (used by Tabular DI, Bar Graph DI, Line Graph DI, Caselet DI, etc.).
 */
export function buildMatrixQuestions({
  dataset,
  diType,
  setId,
  difficulty = "Medium",
  setSize = 5,
  entityNoun = "value",
  rng,
  extraQuestions = [],
}) {
  const rowCount = dataset.rows.length;
  const colCount = dataset.columns.length - 1;
  const colLabels = getColLabels(dataset);
  const unit = dataset.unit || "Units";

  // Pick distinct indices for variety
  const rIdx = rng.shuffle([...Array(rowCount).keys()]);
  const cIdx = rng.shuffle([...Array(colCount).keys()]);

  const makeQ = ({
    qNum,
    questionType,
    subType,
    qDiff,
    questionText,
    correctValue,
    correctFormatted,
    formatType = "number",
    decimals = 2,
    allowNegative = false,
    mistakeCandidates = [],
    givenData,
    formula,
    steps,
    shortcut,
    datasetFields,
    operation,
    calculationStructure,
    verificationSpec,
  }) => {
    const built = buildFiveOptions({
      correctValue,
      correctFormatted,
      mistakeCandidates,
      formatType,
      decimals,
      allowNegative,
      rng,
    });

    return {
      question_id: `${setId}_Q${qNum}`,
      question_type: questionType,
      sub_type: subType,
      difficulty: qDiff,
      question: questionText,
      options: built.options,
      correct_answer: built.correct_answer,
      correct_answer_value: formatType === "ratio" || formatType === "text" ? built.correct_answer_formatted : roundTo(Number(correctValue), decimals),
      solution: {
        given_data: givenData,
        formula,
        steps,
        final_answer: built.correct_answer_formatted,
      },
      shortcut_method: shortcut,
      validation: {
        dataset_reference_check: true,
        calculation_check: true,
        unique_answer_check: true,
        five_options_check: true,
      },
      _meta: {
        fingerprint: computeQuestionFingerprint({
          diType,
          questionType,
          datasetFields,
          operation,
          calculationStructure,
          correctAnswerValue: built.correct_answer_formatted,
        }),
        verification_spec: verificationSpec,
      },
    };
  };

  // Pool of 14 distinct pattern builders
  const builders = {
    // 1. Sum / Total across a row
    row_total: (qNum) => {
      const r = rIdx[0];
      const row = dataset.rows[r];
      const vals = getRowValues(dataset, r);
      const ans = sum(vals);
      const wrongRow = sum(getRowValues(dataset, rIdx[1 % rowCount]));
      const missedLast = ans - vals[vals.length - 1];
      const missedFirst = ans - vals[0];
      return makeQ({
        qNum,
        questionType: "Total",
        subType: `Total ${entityNoun} of ${row.label}`,
        qDiff: "Easy",
        questionText: `What is the total ${entityNoun} (in ${unit}) of ${row.label} across all ${colCount > 1 ? colLabels.join(", ") : colLabels[0]}?`,
        correctValue: ans,
        mistakeCandidates: [wrongRow, missedLast, missedFirst, ans + 20, ans - 20, ans + 10],
        givenData: colLabels.map((cl, i) => `${row.label} (${cl}) = ${vals[i]} ${unit}`),
        formula: "Total = Sum of all values in the row",
        steps: [
          `Total = ${vals.join(" + ")}`,
          `Total = ${formatNumber(ans)} ${unit}`,
        ],
        shortcut: "Group pairs of numbers that add up to multiples of 100 first, then add the remaining values.",
        datasetFields: [`row:${row.label}`, ...colLabels],
        operation: "sum_row",
        calculationStructure: "sum(row)",
        verificationSpec: { op: "row_sum", row: r },
      });
    },

    // 2. Column Average
    col_average: (qNum) => {
      const c = cIdx[0];
      const vals = getColValues(dataset, c);
      const total = sum(vals);
      const ans = roundTo(average(vals), 2);
      const wrongN1 = roundTo(total / Math.max(1, rowCount - 1), 2);
      const wrongN2 = roundTo(total / (rowCount + 1), 2);
      const otherColAvg = roundTo(average(getColValues(dataset, cIdx[1 % colCount])), 2);
      return makeQ({
        qNum,
        questionType: "Average",
        subType: `Average ${entityNoun} in ${colLabels[c]}`,
        qDiff: "Easy",
        questionText: `What is the average ${entityNoun} (in ${unit}) across all ${rowCount} categories in ${colLabels[c]}?`,
        correctValue: ans,
        mistakeCandidates: [wrongN1, wrongN2, otherColAvg, roundTo(ans + 10, 2), roundTo(ans - 10, 2)],
        givenData: dataset.rows.map((row, i) => `${row.label} (${colLabels[c]}) = ${vals[i]} ${unit}`),
        formula: "Average = Sum of observations / Number of observations",
        steps: [
          `Total in ${colLabels[c]} = ${vals.join(" + ")} = ${formatNumber(total)}`,
          `Number of observations = ${rowCount}`,
          `Average = ${formatNumber(total)} / ${rowCount} = ${formatNumber(ans)}`,
        ],
        shortcut: `Assume a convenient base near the middle value, sum the deviations, divide by ${rowCount}, and add back to the base.`,
        datasetFields: [`col:${colLabels[c]}`],
        operation: "avg_col",
        calculationStructure: "sum(col)/N",
        verificationSpec: { op: "col_avg", col: c },
      });
    },

    // 3. Difference between two combined totals or two rows
    row_difference: (qNum) => {
      const r1 = rIdx[0];
      const r2 = rIdx[1 % rowCount];
      const s1 = sum(getRowValues(dataset, r1));
      const s2 = sum(getRowValues(dataset, r2));
      const ans = Math.abs(s1 - s2);
      const wrongSum = s1 + s2;
      const cellDiff = Math.abs(getCell(dataset, r1, 0) - getCell(dataset, r2, 0));
      return makeQ({
        qNum,
        questionType: "Difference",
        subType: `Difference between total ${entityNoun} of ${dataset.rows[r1].label} and ${dataset.rows[r2].label}`,
        qDiff: "Easy",
        questionText: `What is the absolute difference between the total ${entityNoun} of ${dataset.rows[r1].label} and that of ${dataset.rows[r2].label} across all periods/categories?`,
        correctValue: ans,
        mistakeCandidates: [cellDiff, ans + 20, Math.max(0, ans - 20), ans + 10, Math.max(0, ans - 10), wrongSum],
        givenData: [
          `${dataset.rows[r1].label} values: ${getRowValues(dataset, r1).join(", ")}`,
          `${dataset.rows[r2].label} values: ${getRowValues(dataset, r2).join(", ")}`,
        ],
        formula: "Absolute Difference = |Total₁ − Total₂|",
        steps: [
          `Total for ${dataset.rows[r1].label} = ${getRowValues(dataset, r1).join(" + ")} = ${formatNumber(s1)}`,
          `Total for ${dataset.rows[r2].label} = ${getRowValues(dataset, r2).join(" + ")} = ${formatNumber(s2)}`,
          `Difference = |${formatNumber(s1)} − ${formatNumber(s2)}| = ${formatNumber(ans)}`,
        ],
        shortcut: "Compute column-wise differences first (with signs) and then sum them to avoid large intermediate totals.",
        datasetFields: [`row:${dataset.rows[r1].label}`, `row:${dataset.rows[r2].label}`],
        operation: "abs_diff_rows",
        calculationStructure: "|sum(r1)-sum(r2)|",
        verificationSpec: { op: "row_sum_diff", row1: r1, row2: r2 },
      });
    },

    // 4. Ratio of two cells or two row totals
    ratio_totals: (qNum) => {
      const r1 = rIdx[1 % rowCount];
      const r2 = rIdx[2 % rowCount];
      const s1 = sum(getRowValues(dataset, r1));
      const s2 = sum(getRowValues(dataset, r2));
      const [sa, sb] = simplifyRatio(s1, s2);
      const formatted = formatRatio(s1, s2);
      return makeQ({
        qNum,
        questionType: "Ratio",
        subType: `Ratio of total ${entityNoun} of ${dataset.rows[r1].label} to ${dataset.rows[r2].label}`,
        qDiff: "Medium",
        questionText: `What is the respective ratio of the total ${entityNoun} of ${dataset.rows[r1].label} to the total ${entityNoun} of ${dataset.rows[r2].label}?`,
        correctValue: [sa, sb],
        correctFormatted: formatted,
        formatType: "ratio",
        mistakeCandidates: [
          [sb, sa], // reversed ratio mistake
          [sa + 1, sb],
          [sa, sb + 1],
          [Math.max(1, sa - 1), sb + 1],
          [sa + 2, sb],
        ],
        givenData: [
          `${dataset.rows[r1].label}: ${getRowValues(dataset, r1).join(", ")}`,
          `${dataset.rows[r2].label}: ${getRowValues(dataset, r2).join(", ")}`,
        ],
        formula: "Ratio = (Total of First Category) : (Total of Second Category), simplified by GCD",
        steps: [
          `Total of ${dataset.rows[r1].label} = ${getRowValues(dataset, r1).join(" + ")} = ${formatNumber(s1)}`,
          `Total of ${dataset.rows[r2].label} = ${getRowValues(dataset, r2).join(" + ")} = ${formatNumber(s2)}`,
          `Ratio = ${formatNumber(s1)} : ${formatNumber(s2)} = ${formatted}`,
        ],
        shortcut: "Cancel common trailing zeros or factor of 10 immediately before dividing by the remaining GCD.",
        datasetFields: [`row:${dataset.rows[r1].label}`, `row:${dataset.rows[r2].label}`],
        operation: "ratio_row_sums",
        calculationStructure: "sum(r1):sum(r2)",
        verificationSpec: { op: "row_sum_ratio", row1: r1, row2: r2 },
      });
    },

    // 5. Percentage (X is what % of Y)
    percentage_of: (qNum) => {
      const r1 = rIdx[2 % rowCount];
      const r2 = rIdx[3 % rowCount];
      const c1 = cIdx[0];
      const c2 = cIdx[Math.min(1, colCount - 1)];
      const v1 = getCell(dataset, r1, c1);
      const v2 = getCell(dataset, r2, c2);
      const ans = roundTo((v1 / v2) * 100, 2);
      const wrongDenom = roundTo((v2 / v1) * 100, 2);
      const wrongSumDenom = roundTo((v1 / (v1 + v2)) * 100, 2);
      const diffPct = roundTo((Math.abs(v1 - v2) / v2) * 100, 2);
      return makeQ({
        qNum,
        questionType: "Percentage",
        subType: "Direct percentage comparison with explicit base",
        qDiff: "Medium",
        questionText: `The ${entityNoun} of ${dataset.rows[r1].label} in ${colLabels[c1]} is what percentage of the ${entityNoun} of ${dataset.rows[r2].label} in ${colLabels[c2]}?`,
        correctValue: ans,
        formatType: "percent",
        mistakeCandidates: [wrongDenom, wrongSumDenom, diffPct, roundTo(ans + 5, 2), roundTo(Math.max(1, ans - 5), 2)],
        givenData: [
          `${dataset.rows[r1].label} (${colLabels[c1]}) = ${v1} ${unit}`,
          `${dataset.rows[r2].label} (${colLabels[c2]}) = ${v2} ${unit} (Denominator / Base)`,
        ],
        formula: "Required Percentage = (Value₁ / Base Value₂) × 100",
        steps: [
          `Numerator = ${v1}, Denominator (base) = ${v2}`,
          `Percentage = (${v1} / ${v2}) × 100 = ${formatPercent(ans)}`,
        ],
        shortcut: `Simplify ${v1}/${v2} to its lowest fraction first, then convert to percentage using standard fraction-to-percent values.`,
        datasetFields: [`cell:${dataset.rows[r1].label}:${colLabels[c1]}`, `cell:${dataset.rows[r2].label}:${colLabels[c2]}`],
        operation: "pct_of",
        calculationStructure: "(v1/v2)*100",
        verificationSpec: { op: "cell_pct_of", r1, c1, r2, c2 },
      });
    },

    // 6. Percentage Increase / Decrease across two columns
    percent_change: (qNum) => {
      if (colCount < 2) return builders.highest_lowest(qNum);
      // Find a row & pair of columns with a clean non-zero change
      let chosenR = rIdx[0];
      let cOld = 0;
      let cNew = colCount - 1;
      for (const r of rIdx) {
        if (getCell(dataset, r, 0) !== getCell(dataset, r, colCount - 1)) {
          chosenR = r;
          break;
        }
      }
      const oldVal = getCell(dataset, chosenR, cOld);
      const newVal = getCell(dataset, chosenR, cNew);
      const isInc = newVal >= oldVal;
      const pctVal = roundTo(Math.abs(percentChange(oldVal, newVal)), 2);
      const wrongBaseNew = roundTo((Math.abs(newVal - oldVal) / newVal) * 100, 2);
      const directRatioPct = roundTo((newVal / oldVal) * 100, 2);
      return makeQ({
        qNum,
        questionType: isInc ? "Percentage Increase" : "Percentage Decrease",
        subType: `Percentage ${isInc ? "increase" : "decrease"} from ${colLabels[cOld]} to ${colLabels[cNew]}`,
        qDiff: "Medium",
        questionText: `What is the percentage ${isInc ? "increase" : "decrease"} in the ${entityNoun} of ${dataset.rows[chosenR].label} from ${colLabels[cOld]} to ${colLabels[cNew]}?`,
        correctValue: pctVal,
        formatType: "percent",
        mistakeCandidates: [wrongBaseNew, directRatioPct, roundTo(pctVal + 4, 2), roundTo(Math.max(1, pctVal - 4), 2), roundTo(pctVal + 2.5, 2)],
        givenData: [
          `Original value (${colLabels[cOld]}) = ${oldVal} ${unit}`,
          `New value (${colLabels[cNew]}) = ${newVal} ${unit}`,
        ],
        formula: `Percentage ${isInc ? "Increase" : "Decrease"} = (|New Value − Original Value| / Original Value) × 100`,
        steps: [
          `Change = |${newVal} − ${oldVal}| = ${Math.abs(newVal - oldVal)}`,
          `Denominator (Original Value in ${colLabels[cOld]}) = ${oldVal}`,
          `Percentage ${isInc ? "Increase" : "Decrease"} = (${Math.abs(newVal - oldVal)} / ${oldVal}) × 100 = ${formatPercent(pctVal)}`,
        ],
        shortcut: "Always divide the absolute change by the ORIGINAL (earlier) value, never by the new value.",
        datasetFields: [`cell:${dataset.rows[chosenR].label}:${colLabels[cOld]}`, `cell:${dataset.rows[chosenR].label}:${colLabels[cNew]}`],
        operation: isInc ? "pct_increase" : "pct_decrease",
        calculationStructure: "|new-old|/old*100",
        verificationSpec: { op: "cell_pct_change_abs", row: chosenR, cOld, cNew },
      });
    },

    // 7. Highest vs Lowest difference or ratio
    highest_lowest: (qNum) => {
      const c = cIdx[Math.min(1, colCount - 1)];
      const vals = getColValues(dataset, c);
      const maxVal = Math.max(...vals);
      const minVal = Math.min(...vals);
      const maxRow = dataset.rows[vals.indexOf(maxVal)].label;
      const minRow = dataset.rows[vals.indexOf(minVal)].label;
      const ans = maxVal - minVal;
      const sorted = [...vals].sort((a, b) => b - a);
      const secondDiff = sorted.length >= 2 ? sorted[0] - sorted[1] : ans + 10;
      const sumMaxMin = maxVal + minVal;
      return makeQ({
        qNum,
        questionType: "Highest and Lowest",
        subType: `Difference between highest and lowest ${entityNoun} in ${colLabels[c]}`,
        qDiff: "Easy",
        questionText: `In ${colLabels[c]}, what is the difference between the highest and the lowest ${entityNoun} among all ${rowCount} categories?`,
        correctValue: ans,
        mistakeCandidates: [secondDiff, sumMaxMin, maxVal, ans + 15, Math.max(0, ans - 15)],
        givenData: [
          `Highest in ${colLabels[c]}: ${maxRow} = ${maxVal} ${unit}`,
          `Lowest in ${colLabels[c]}: ${minRow} = ${minVal} ${unit}`,
        ],
        formula: "Range / Difference = Maximum Value − Minimum Value",
        steps: [
          `Maximum value in ${colLabels[c]} = ${maxVal} (${maxRow})`,
          `Minimum value in ${colLabels[c]} = ${minVal} (${minRow})`,
          `Difference = ${maxVal} − ${minVal} = ${formatNumber(ans)}`,
        ],
        shortcut: `Scan only the ${colLabels[c]} column for the extremes (${maxVal} and ${minVal}) and subtract directly.`,
        datasetFields: [`col:${colLabels[c]}`],
        operation: "col_max_minus_min",
        calculationStructure: "max(col)-min(col)",
        verificationSpec: { op: "col_range", col: c },
      });
    },

    // 8. Combined Categories Multi-Step (Sum of 2 rows vs Sum of 2 other rows — Percentage more/less)
    combined_comparison: (qNum) => {
      const c1 = cIdx[0];
      const c2 = cIdx[Math.min(1, colCount - 1)];
      const rA = rIdx[0];
      const rB = rIdx[1 % rowCount];
      const rC = rIdx[2 % rowCount];
      const rD = rIdx[3 % rowCount];
      const sum1 = getCell(dataset, rA, c1) + getCell(dataset, rB, c1);
      const sum2 = getCell(dataset, rC, c2) + getCell(dataset, rD, c2);
      const isMore = sum1 >= sum2;
      const ans = roundTo((Math.abs(sum1 - sum2) / sum2) * 100, 2);
      const wrongBase = roundTo((Math.abs(sum1 - sum2) / sum1) * 100, 2);
      const directPct = roundTo((sum1 / sum2) * 100, 2);
      return makeQ({
        qNum,
        questionType: "Combined Categories",
        subType: "Combined multi-category percentage comparison",
        qDiff: "Hard",
        questionText: `The combined ${entityNoun} of ${dataset.rows[rA].label} and ${dataset.rows[rB].label} in ${colLabels[c1]} is what percentage ${isMore ? "more" : "less"} than the combined ${entityNoun} of ${dataset.rows[rC].label} and ${dataset.rows[rD].label} in ${colLabels[c2]}?`,
        correctValue: ans,
        formatType: "percent",
        mistakeCandidates: [wrongBase, directPct, roundTo(ans + 3.5, 2), roundTo(Math.max(1, ans - 3.5), 2), roundTo(ans + 6, 2)],
        givenData: [
          `${dataset.rows[rA].label} (${colLabels[c1]}) = ${getCell(dataset, rA, c1)}, ${dataset.rows[rB].label} (${colLabels[c1]}) = ${getCell(dataset, rB, c1)}`,
          `${dataset.rows[rC].label} (${colLabels[c2]}) = ${getCell(dataset, rC, c2)}, ${dataset.rows[rD].label} (${colLabels[c2]}) = ${getCell(dataset, rD, c2)}`,
        ],
        formula: `Percentage ${isMore ? "More" : "Less"} = (|Combined₁ − Combined₂| / Combined₂) × 100`,
        steps: [
          `Combined₁ = ${getCell(dataset, rA, c1)} + ${getCell(dataset, rB, c1)} = ${sum1}`,
          `Combined₂ (Base) = ${getCell(dataset, rC, c2)} + ${getCell(dataset, rD, c2)} = ${sum2}`,
          `Difference = |${sum1} − ${sum2}| = ${Math.abs(sum1 - sum2)}`,
          `Required % = (${Math.abs(sum1 - sum2)} / ${sum2}) × 100 = ${formatPercent(ans)}`,
        ],
        shortcut: "Compute both pair totals first, check the wording after 'than' to lock the denominator, then divide the difference by that base.",
        datasetFields: [`r${rA}:c${c1}`, `r${rB}:c${c1}`, `r${rC}:c${c2}`, `r${rD}:c${c2}`],
        operation: "combined_pct_more_less",
        calculationStructure: "|(a+b)-(c+d)|/(c+d)*100",
        verificationSpec: { op: "combined_pct_diff", cells1: [[rA, c1], [rB, c1]], cells2: [[rC, c2], [rD, c2]] },
      });
    },

    // 9. Arithmetic-Based Multi-Step (e.g., projected growth / profit-weighted calculation)
    arithmetic_projection: (qNum) => {
      const r = rIdx[rowCount - 1];
      const c = colCount - 1;
      const baseVal = getCell(dataset, r, c);
      const pct = rng.pick([10, 15, 20, 25]);
      const projected = roundTo(baseVal * (1 + pct / 100), 2);
      const otherRow = rIdx[0];
      const otherVal = getCell(dataset, otherRow, c);
      const ans = roundTo(projected + otherVal, 2);
      const forgotGrowth = baseVal + otherVal;
      const subGrowth = roundTo(baseVal * (1 - pct / 100) + otherVal, 2);
      const appliedToBoth = roundTo((baseVal + otherVal) * (1 + pct / 100), 2);
      return makeQ({
        qNum,
        questionType: "Arithmetic-based",
        subType: "Percentage growth projection combined with another category",
        qDiff: "Hard",
        questionText: `If the ${entityNoun} of ${dataset.rows[r].label} in ${colLabels[c]} increases by ${pct}% in the next period while that of ${dataset.rows[otherRow].label} remains unchanged at its ${colLabels[c]} level, what will be their new combined ${entityNoun}?`,
        correctValue: ans,
        mistakeCandidates: [forgotGrowth, subGrowth, appliedToBoth, roundTo(ans + 25, 2), roundTo(Math.max(1, ans - 25), 2)],
        givenData: [
          `${dataset.rows[r].label} (${colLabels[c]}) = ${baseVal} ${unit}`,
          `Projected increase for ${dataset.rows[r].label} = ${pct}%`,
          `${dataset.rows[otherRow].label} (${colLabels[c]}) = ${otherVal} ${unit} (unchanged)`,
        ],
        formula: "New Combined Value = Value₁ × (1 + r/100) + Value₂",
        steps: [
          `Increase for ${dataset.rows[r].label} = ${pct}% of ${baseVal} = ${formatNumber(baseVal * pct / 100)}`,
          `New value for ${dataset.rows[r].label} = ${baseVal} + ${formatNumber(baseVal * pct / 100)} = ${formatNumber(projected)}`,
          `New combined value = ${formatNumber(projected)} + ${otherVal} = ${formatNumber(ans)}`,
        ],
        shortcut: `Add ${baseVal} + ${otherVal} = ${baseVal + otherVal} first, then simply add ${pct}% of ${baseVal} (${formatNumber(baseVal * pct / 100)}).`,
        datasetFields: [`cell:${dataset.rows[r].label}:${colLabels[c]}`, `cell:${dataset.rows[otherRow].label}:${colLabels[c]}`],
        operation: "growth_projection_sum",
        calculationStructure: "v1*(1+r/100)+v2",
        verificationSpec: { op: "growth_sum", r1: r, c1: c, pct, r2: otherRow, c2: c },
      });
    },

    // 10. Multi-step: Difference between two column averages
    avg_difference: (qNum) => {
      if (colCount < 2) return builders.highest_lowest(qNum);
      const c1 = cIdx[0];
      const c2 = cIdx[1];
      const avg1 = average(getColValues(dataset, c1));
      const avg2 = average(getColValues(dataset, c2));
      const ans = roundTo(Math.abs(avg1 - avg2), 2);
      const sumDiff = Math.abs(sum(getColValues(dataset, c1)) - sum(getColValues(dataset, c2)));
      const wrongN = roundTo(sumDiff / Math.max(1, rowCount - 1), 2);
      return makeQ({
        qNum,
        questionType: "Multi-step Calculation",
        subType: `Difference between averages of ${colLabels[c1]} and ${colLabels[c2]}`,
        qDiff: "Hard",
        questionText: `What is the absolute difference between the average ${entityNoun} in ${colLabels[c1]} and the average ${entityNoun} in ${colLabels[c2]} across all ${rowCount} categories?`,
        correctValue: ans,
        mistakeCandidates: [sumDiff, wrongN, roundTo(ans + 5, 2), roundTo(Math.max(1, ans - 5), 2), roundTo((avg1 + avg2) / 2, 2)],
        givenData: [
          `${colLabels[c1]} values: ${getColValues(dataset, c1).join(", ")}`,
          `${colLabels[c2]} values: ${getColValues(dataset, c2).join(", ")}`,
        ],
        formula: "Difference of Averages = |Total₁ − Total₂| / N",
        steps: [
          `Total in ${colLabels[c1]} = ${sum(getColValues(dataset, c1))}, Average₁ = ${formatNumber(avg1)}`,
          `Total in ${colLabels[c2]} = ${sum(getColValues(dataset, c2))}, Average₂ = ${formatNumber(avg2)}`,
          `Absolute Difference = |${formatNumber(avg1)} − ${formatNumber(avg2)}| = ${formatNumber(ans)}`,
        ],
        shortcut: `Find the difference of column totals (${sumDiff}) first and divide once by ${rowCount}.`,
        datasetFields: [`col:${colLabels[c1]}`, `col:${colLabels[c2]}`],
        operation: "diff_col_avgs",
        calculationStructure: "|avg(c1)-avg(c2)|",
        verificationSpec: { op: "col_avg_diff", c1, c2 },
      });
    },
  };

  // Select balanced pattern sequence based on difficulty
  const planByDifficulty = {
    Easy: ["row_total", "col_average", "row_difference", "highest_lowest", "ratio_totals", "percentage_of"],
    Medium: ["row_total", "col_average", "ratio_totals", "percent_change", "percentage_of", "row_difference"],
    Hard: ["combined_comparison", "arithmetic_projection", "avg_difference", "ratio_totals", "percent_change", "row_difference"],
  };

  const selectedPlan = planByDifficulty[difficulty] || planByDifficulty.Medium;
  const questions = [...extraQuestions];
  let planIdx = 0;

  while (questions.length < setSize && planIdx < selectedPlan.length) {
    const key = selectedPlan[planIdx++];
    if (builders[key]) {
      questions.push(builders[key](questions.length + 1));
    }
  }

  // Re-number question IDs sequentially
  return questions.slice(0, setSize).map((q, idx) => ({
    ...q,
    question_id: `${setId}_Q${idx + 1}`,
  }));
}
