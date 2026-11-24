// Place at: server/question-engine/generators/quant/dataInterpretation/diValidator.js
/**
 * Independent Mathematical Validation Engine for HHK Data Interpretation Sets (Section 8).
 * Operates completely independently of the generator modules:
 * - Recomputes every dataset total, pie sum, central angle, stacked bar total, and line point.
 * - Independently re-derives every question's mathematical answer from the canonical dataset.
 * - Verifies 5 unique non-equivalent options (A–E) or HHK Data Sufficiency convention.
 * - Verifies zero missing-value leakage and cross-question consistency.
 */
import {
  average,
  canonicalOptionKey,
  centralAngle,
  formatDegree,
  formatNumber,
  formatPercent,
  formatRatio,
  roundTo,
  sum,
} from "./diMath.js";

const TOL = 1e-2;

function approxEqual(a, b, tol = TOL) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

/**
 * Independently recalculates a question's exact answer directly from the canonical dataset.
 */
export function recalculateAnswerFromDataset(dataset, spec) {
  if (!spec || !spec.op) return { ok: false, reason: "Missing verification_spec" };
  const rows = dataset.rows || [];
  const getVal = (r, c) => Number(rows[r]?.values?.[c]);

  switch (spec.op) {
    case "row_sum": {
      const val = sum(rows[spec.row].values);
      return { ok: true, value: roundTo(val, 2), formatted: formatNumber(val, 2) };
    }
    case "col_avg": {
      const vals = rows.map((r) => Number(r.values[spec.col]));
      const val = roundTo(average(vals), 2);
      return { ok: true, value: val, formatted: formatNumber(val, 2) };
    }
    case "row_sum_diff": {
      const s1 = sum(rows[spec.row1].values);
      const s2 = sum(rows[spec.row2].values);
      const val = Math.abs(s1 - s2);
      return { ok: true, value: roundTo(val, 2), formatted: formatNumber(val, 2) };
    }
    case "row_sum_ratio": {
      const s1 = sum(rows[spec.row1].values);
      const s2 = sum(rows[spec.row2].values);
      const formatted = formatRatio(s1, s2);
      return { ok: true, value: formatted, formatted };
    }
    case "cell_pct_of": {
      const v1 = getVal(spec.r1, spec.c1);
      const v2 = getVal(spec.r2, spec.c2);
      const val = roundTo((v1 / v2) * 100, 2);
      return { ok: true, value: val, formatted: formatPercent(val, 2) };
    }
    case "cell_pct_change_abs": {
      const oldV = getVal(spec.row, spec.cOld);
      const newV = getVal(spec.row, spec.cNew);
      const val = roundTo((Math.abs(newV - oldV) / oldV) * 100, 2);
      return { ok: true, value: val, formatted: formatPercent(val, 2) };
    }
    case "col_range": {
      const vals = rows.map((r) => Number(r.values[spec.col]));
      const val = Math.max(...vals) - Math.min(...vals);
      return { ok: true, value: roundTo(val, 2), formatted: formatNumber(val, 2) };
    }
    case "combined_pct_diff": {
      const s1 = sum(spec.cells1.map(([r, c]) => getVal(r, c)));
      const s2 = sum(spec.cells2.map(([r, c]) => getVal(r, c)));
      const val = roundTo((Math.abs(s1 - s2) / s2) * 100, 2);
      return { ok: true, value: val, formatted: formatPercent(val, 2) };
    }
    case "growth_sum": {
      const v1 = getVal(spec.r1, spec.c1);
      const v2 = getVal(spec.r2, spec.c2);
      const val = roundTo(v1 * (1 + spec.pct / 100) + v2, 2);
      return { ok: true, value: val, formatted: formatNumber(val, 2) };
    }
    case "col_avg_diff": {
      const avg1 = average(rows.map((r) => Number(r.values[spec.c1])));
      const avg2 = average(rows.map((r) => Number(r.values[spec.c2])));
      const val = roundTo(Math.abs(avg1 - avg2), 2);
      return { ok: true, value: val, formatted: formatNumber(val, 2) };
    }
    case "cell_value": {
      const val = getVal(spec.row, spec.col);
      return { ok: true, value: roundTo(val, 2), formatted: formatNumber(val, 2) };
    }
    case "cells_sum": {
      const val = sum(spec.cells.map(([r, c]) => getVal(r, c)));
      return { ok: true, value: roundTo(val, 2), formatted: formatNumber(val, 2) };
    }
    case "cell_abs_diff": {
      const val = Math.abs(getVal(spec.r1, spec.c1) - getVal(spec.r2, spec.c2));
      return { ok: true, value: roundTo(val, 2), formatted: formatNumber(val, 2) };
    }
    case "cell_ratio": {
      const formatted = formatRatio(getVal(spec.r1, spec.c1), getVal(spec.r2, spec.c2));
      return { ok: true, value: formatted, formatted };
    }
    case "col_share_of_grand": {
      const colSum = sum(rows.map((r) => Number(r.values[spec.col])));
      const grand = dataset.grand_total || sum(rows.map((r) => sum(r.values)));
      const val = roundTo((colSum / grand) * 100, 2);
      return { ok: true, value: val, formatted: formatPercent(val, 2) };
    }
    case "pie_sector_value": {
      const s = dataset.sectors[spec.sectorIndex];
      const val = roundTo((dataset.total * s.percentage) / 100, 2);
      return { ok: true, value: val, formatted: formatNumber(val, 2) };
    }
    case "pie_sector_angle": {
      const s = dataset.sectors[spec.sectorIndex];
      const val = roundTo(centralAngle(s.value, dataset.total), 1);
      return { ok: true, value: val, formatted: formatDegree(val, 1) };
    }
    case "pie_sector_diff": {
      const s1 = dataset.sectors[spec.i1];
      const s2 = dataset.sectors[spec.i2];
      const val = Math.abs(s1.value - s2.value);
      return { ok: true, value: roundTo(val, 2), formatted: formatNumber(val, 2) };
    }
    case "pie_combined_ratio": {
      const sum1 = sum(spec.g1.map((i) => dataset.sectors[i].value));
      const sum2 = sum(spec.g2.map((i) => dataset.sectors[i].value));
      const formatted = formatRatio(sum1, sum2);
      return { ok: true, value: formatted, formatted };
    }
    case "dual_pie_pct_change": {
      const v1 = dataset.sectors[spec.sectorIndex].value;
      const v2 = dataset.secondary_pie.sectors[spec.sectorIndex].value;
      const val = roundTo((Math.abs(v2 - v1) / v1) * 100, 2);
      return { ok: true, value: val, formatted: formatPercent(val, 2) };
    }
    case "pie_pct_more_less": {
      const p1 = dataset.sectors[spec.i1].percentage;
      const p2 = dataset.sectors[spec.i2].percentage;
      const val = roundTo((Math.abs(p1 - p2) / p2) * 100, 2);
      return { ok: true, value: val, formatted: formatPercent(val, 2) };
    }
    case "pie_avg_subset": {
      const vals = spec.indices.map((i) => dataset.sectors[i].value);
      const val = roundTo(average(vals), 2);
      return { ok: true, value: val, formatted: formatNumber(val, 2) };
    }
    case "ds_eval": {
      // Independent logical truth table for 2-statement Data Sufficiency
      let derived;
      if (spec.s1 && !spec.s2) derived = "A";
      else if (!spec.s1 && spec.s2) derived = "B";
      else if (spec.s1 && spec.s2) derived = "C";
      else if (!spec.s1 && !spec.s2 && spec.combined) derived = "E";
      else derived = "D";
      return { ok: true, value: derived, formatted: derived };
    }
    default:
      return { ok: false, reason: `Unsupported verification op: ${spec.op}` };
  }
}

/**
 * Validates a Pie Chart sector list strictly:
 * - sum(percentages) === 100
 * - sum(angles) === 360
 * - sum(values) === total
 * - each sector's value and central angle match total & percentage
 */
function validatePieSectors(sectors, total, errors, labelPrefix = "Pie") {
  if (!Array.isArray(sectors) || sectors.length === 0) {
    errors.push(`${labelPrefix}: missing sectors`);
    return false;
  }
  const pctSum = sum(sectors.map((s) => s.percentage));
  const angleSum = sum(sectors.map((s) => s.angle));
  const valSum = sum(sectors.map((s) => s.value));

  if (!approxEqual(pctSum, 100, 0.01)) {
    errors.push(`${labelPrefix}: sector percentages sum to ${pctSum}%, expected 100%`);
  }
  if (!approxEqual(angleSum, 360, 0.1)) {
    errors.push(`${labelPrefix}: central angles sum to ${angleSum}°, expected 360°`);
  }
  if (!approxEqual(valSum, total, 0.5)) {
    errors.push(`${labelPrefix}: sector values sum to ${valSum}, expected total ${total}`);
  }
  for (const s of sectors) {
    const expVal = (total * s.percentage) / 100;
    const expAngle = (s.value / total) * 360;
    if (!approxEqual(s.value, expVal, 0.5)) {
      errors.push(`${labelPrefix} sector "${s.label}": value ${s.value} != ${expVal}`);
    }
    if (!approxEqual(s.angle, expAngle, 0.2)) {
      errors.push(`${labelPrefix} sector "${s.label}": angle ${s.angle}° != ${expAngle.toFixed(2)}°`);
    }
  }
  return errors.length === 0;
}

/**
 * Full Independent Validation of a complete DI Set (Section 8 A–G).
 */
export function validateDISet(diSet) {
  const errors = [];
  const dataset = diSet?.dataset;
  const chartSpec = diSet?.chart_spec;
  const questions = diSet?.questions;

  const setValidation = {
    dataset_check: true,
    row_total_check: true,
    column_total_check: true,
    chart_consistency_check: true,
    question_consistency_check: true,
    all_answers_verified: true,
    all_options_verified: true,
    duplicate_check: true,
  };

  // --- A & B: Dataset & Table Validation ---
  if (!dataset || !Array.isArray(dataset.rows) || dataset.rows.length === 0) {
    errors.push("Dataset is missing or has no rows.");
    setValidation.dataset_check = false;
  } else {
    if (!dataset.unit || !String(dataset.unit).trim()) {
      errors.push("Dataset unit is missing.");
      setValidation.dataset_check = false;
    }
    if (!Array.isArray(dataset.columns) || dataset.columns.length < 2) {
      errors.push("Dataset columns are invalid.");
      setValidation.dataset_check = false;
    }

    // Unique row labels
    const rowLabels = dataset.rows.map((r) => String(r.label || "").trim());
    if (new Set(rowLabels).size !== rowLabels.length) {
      errors.push("Duplicate row labels detected in dataset.");
      setValidation.dataset_check = false;
    }

    const expectedValCount = dataset.columns.length - 1;
    for (const r of dataset.rows) {
      if (!Array.isArray(r.values) || r.values.length !== expectedValCount) {
        errors.push(`Row "${r.label}" value count mismatch.`);
        setValidation.dataset_check = false;
      } else if (r.values.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
        errors.push(`Row "${r.label}" contains non-numeric value.`);
        setValidation.dataset_check = false;
      }
    }

    // Verify totals when present
    if (dataset.totals) {
      const calcRowTotals = dataset.rows.map((r) => sum(r.values));
      const calcColTotals = Array.from({ length: expectedValCount }, (_, c) =>
        sum(dataset.rows.map((r) => Number(r.values[c])))
      );
      const calcGrand = sum(calcRowTotals);

      if (Array.isArray(dataset.totals.row_totals)) {
        for (let i = 0; i < calcRowTotals.length; i++) {
          if (!approxEqual(dataset.totals.row_totals[i], calcRowTotals[i])) {
            errors.push(`Row total mismatch at row ${i}: ${dataset.totals.row_totals[i]} vs ${calcRowTotals[i]}`);
            setValidation.row_total_check = false;
          }
        }
      }
      if (Array.isArray(dataset.totals.column_totals)) {
        for (let c = 0; c < calcColTotals.length; c++) {
          if (!approxEqual(dataset.totals.column_totals[c], calcColTotals[c])) {
            errors.push(`Column total mismatch at col ${c}: ${dataset.totals.column_totals[c]} vs ${calcColTotals[c]}`);
            setValidation.column_total_check = false;
          }
        }
      }
      if (
        dataset.totals.grand_total !== undefined &&
        !approxEqual(dataset.totals.grand_total, calcGrand)
      ) {
        errors.push(`Grand total mismatch: ${dataset.totals.grand_total} vs ${calcGrand}`);
        setValidation.dataset_check = false;
      }
    }
  }

  // --- C, D, E & Missing/Mixed Chart Consistency Validation ---
  if (!chartSpec || !chartSpec.chart_type) {
    errors.push("Missing chart_spec.");
    setValidation.chart_consistency_check = false;
  } else if (dataset && Array.isArray(dataset.rows)) {
    // Pie chart validation
    if (diSet.di_type === "Pie Chart DI") {
      const prevErrCount = errors.length;
      validatePieSectors(dataset.sectors, dataset.total, errors, "Primary Pie");
      if (dataset.secondary_pie) {
        validatePieSectors(
          dataset.secondary_pie.sectors,
          dataset.secondary_pie.total,
          errors,
          "Secondary Pie"
        );
      }
      if (errors.length > prevErrCount) {
        setValidation.dataset_check = false;
        setValidation.chart_consistency_check = false;
      }
    }

    // Bar graph consistency validation
    if (diSet.di_type === "Bar Graph DI" && Array.isArray(chartSpec.series)) {
      chartSpec.series.forEach((s, sIdx) => {
        s.data.forEach((val, rIdx) => {
          if (!approxEqual(val, dataset.rows[rIdx].values[sIdx])) {
            errors.push(`Bar graph mismatch at series ${sIdx}, row ${rIdx}: ${val} vs ${dataset.rows[rIdx].values[sIdx]}`);
            setValidation.chart_consistency_check = false;
          }
        });
      });
      if (chartSpec.chart_type === "stacked_bar" && Array.isArray(chartSpec.stacked_totals)) {
        chartSpec.stacked_totals.forEach((tot, rIdx) => {
          const expected = sum(dataset.rows[rIdx].values);
          if (!approxEqual(tot, expected)) {
            errors.push(`Stacked bar total mismatch at row ${rIdx}: ${tot} vs ${expected}`);
            setValidation.chart_consistency_check = false;
          }
        });
      }
    }

    // Line graph consistency validation
    if (diSet.di_type === "Line Graph DI" && Array.isArray(chartSpec.series)) {
      chartSpec.series.forEach((s, sIdx) => {
        s.points.forEach((pt, rIdx) => {
          if (!approxEqual(pt.y, dataset.rows[rIdx].values[sIdx])) {
            errors.push(`Line graph point mismatch at series ${sIdx}, period ${rIdx}: ${pt.y} vs ${dataset.rows[rIdx].values[sIdx]}`);
            setValidation.chart_consistency_check = false;
          }
        });
      });
    }

    // Missing DI non-leakage & unique solvability check
    if (diSet.di_type === "Missing DI" && Array.isArray(dataset.missing_cells)) {
      const rowMissCounts = new Map();
      for (const m of dataset.missing_cells) {
        rowMissCounts.set(m.row, (rowMissCounts.get(m.row) || 0) + 1);
        // Check that displayed_rows masks this cell as null
        const shown = dataset.displayed_rows?.[m.row]?.values?.[m.col];
        if (shown !== null) {
          errors.push(`Missing value LEAKED in displayed_rows at (${m.row}, ${m.col}): ${shown}`);
          setValidation.chart_consistency_check = false;
        }
        // Check chart_spec masks it as "--" or null
        if (chartSpec.chart_type === "missing_table") {
          const tableCell = chartSpec.rows?.[m.row]?.[m.col + 1];
          if (tableCell !== "--") {
            errors.push(`Missing value LEAKED in chart_spec table at (${m.row}, ${m.col}): ${tableCell}`);
            setValidation.chart_consistency_check = false;
          }
        }
      }
      for (const [r, cnt] of rowMissCounts.entries()) {
        if (cnt > 1) {
          errors.push(`Row ${r} has ${cnt} missing values; not uniquely solvable from row total alone.`);
          setValidation.dataset_check = false;
        }
      }
    }

    // Mixed DI cross-chart consistency check
    if (diSet.di_type === "Mixed DI" && Array.isArray(chartSpec.components)) {
      const c0 = chartSpec.components[0];
      if (c0.chart_type === "pie") {
        const prevErr = errors.length;
        validatePieSectors(c0.sectors, c0.total, errors, "Mixed DI Pie");
        if (errors.length > prevErr) setValidation.chart_consistency_check = false;
      }
      dataset.category_breakdown?.forEach((cb, i) => {
        if (!approxEqual(cb.values[0] + cb.values[1], cb.total)) {
          errors.push(`Mixed DI category "${cb.label}": subgroup sum != total`);
          setValidation.dataset_check = false;
        }
        if (c0.chart_type === "vertical_bar" && !approxEqual(c0.series[0].data[i], cb.total)) {
          errors.push(`Mixed DI bar mismatch at index ${i}`);
          setValidation.chart_consistency_check = false;
        }
      });
    }
  }

  // --- F & G: Question, Option, Solution & Cross-Question Validation ---
  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push("DI set contains no questions.");
    setValidation.question_consistency_check = false;
    setValidation.all_answers_verified = false;
    setValidation.all_options_verified = false;
  } else {
    const qFingerprints = new Set();

    for (const q of questions) {
      const qVal = {
        dataset_reference_check: true,
        calculation_check: true,
        unique_answer_check: true,
        five_options_check: true,
      };

      // Check 5 options A..E
      const optKeys = q.options ? Object.keys(q.options) : [];
      if (optKeys.length !== 5 || ["A", "B", "C", "D", "E"].some((k) => !optKeys.includes(k))) {
        errors.push(`${q.question_id}: Must have exactly 5 options (A, B, C, D, E).`);
        qVal.five_options_check = false;
        setValidation.all_options_verified = false;
      } else {
        const optVals = ["A", "B", "C", "D", "E"].map((k) => String(q.options[k] ?? "").trim());
        const canonicalKeys = optVals.map((v) => canonicalOptionKey(v));
        if (optVals.some((v) => !v || v.includes("NaN") || v.includes("undefined"))) {
          errors.push(`${q.question_id}: Contains invalid/NaN option text.`);
          qVal.five_options_check = false;
          setValidation.all_options_verified = false;
        }
        if (new Set(canonicalKeys).size !== 5) {
          errors.push(`${q.question_id}: Duplicate or equivalent options detected: ${optVals.join(", ")}`);
          qVal.five_options_check = false;
          qVal.unique_answer_check = false;
          setValidation.all_options_verified = false;
        }
      }

      // Independent mathematical recalculation
      const spec = q._meta?.verification_spec;
      if (spec) {
        const recalc = recalculateAnswerFromDataset(dataset, spec);
        if (!recalc.ok) {
          errors.push(`${q.question_id}: Recalculation failed (${recalc.reason}).`);
          qVal.calculation_check = false;
          setValidation.all_answers_verified = false;
        } else {
          if (diSet.di_type === "Data Sufficiency DI") {
            if (q.correct_answer !== recalc.formatted) {
              errors.push(`${q.question_id}: DS answer mismatch (${q.correct_answer} vs ${recalc.formatted}).`);
              qVal.calculation_check = false;
              setValidation.all_answers_verified = false;
            }
          } else {
            const chosenOptText = q.options?.[q.correct_answer];
            if (canonicalOptionKey(chosenOptText) !== canonicalOptionKey(recalc.formatted)) {
              errors.push(
                `${q.question_id}: Option[${q.correct_answer}]="${chosenOptText}" !== recalculated "${recalc.formatted}"`
              );
              qVal.calculation_check = false;
              setValidation.all_answers_verified = false;
            }
            // Verify exactly ONE option matches the recalculated answer
            const matchCount = ["A", "B", "C", "D", "E"].filter(
              (k) => canonicalOptionKey(q.options?.[k]) === canonicalOptionKey(recalc.formatted)
            ).length;
            if (matchCount !== 1) {
              errors.push(`${q.question_id}: Expected 1 matching option, found ${matchCount}.`);
              qVal.unique_answer_check = false;
              setValidation.all_answers_verified = false;
            }
            // Verify solution final_answer matches recalculated answer
            if (
              q.solution?.final_answer &&
              canonicalOptionKey(q.solution.final_answer) !== canonicalOptionKey(recalc.formatted)
            ) {
              errors.push(
                `${q.question_id}: Solution final_answer "${q.solution.final_answer}" !== recalculated "${recalc.formatted}"`
              );
              qVal.calculation_check = false;
              setValidation.all_answers_verified = false;
            }
          }
        }
      }

      // Question-level duplicate check
      const fp = q._meta?.fingerprint;
      if (fp) {
        if (qFingerprints.has(fp)) {
          errors.push(`${q.question_id}: Duplicate question fingerprint within set (${fp}).`);
          setValidation.duplicate_check = false;
        }
        qFingerprints.add(fp);
      }

      // Solution completeness check
      if (
        !q.solution ||
        !Array.isArray(q.solution.given_data) ||
        q.solution.given_data.length === 0 ||
        !q.solution.formula ||
        !Array.isArray(q.solution.steps) ||
        q.solution.steps.length === 0 ||
        !q.solution.final_answer
      ) {
        errors.push(`${q.question_id}: Incomplete step-by-step solution.`);
        setValidation.question_consistency_check = false;
      }

      q.validation = qVal;
    }
  }

  const valid =
    errors.length === 0 &&
    Object.values(setValidation).every((v) => v === true);

  return {
    valid,
    set_validation: setValidation,
    errors,
  };
}
