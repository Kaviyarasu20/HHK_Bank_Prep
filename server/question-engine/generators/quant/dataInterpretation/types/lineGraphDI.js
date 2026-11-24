// Place at: server/question-engine/generators/quant/dataInterpretation/types/lineGraphDI.js
/**
 * Phase 1 Module D: LINE GRAPH DATA INTERPRETATION Generator
 * Supports single-line and multi-line chronological trend graphs with exact plotted points.
 */
import { computeSetFingerprint, sum } from "../diMath.js";
import { EXAM_LEVELS_BY_DIFFICULTY, LINE_SCENARIOS } from "../diScenarios.js";
import { buildMatrixQuestions } from "../diQuestionBuilder.js";

export function generateLineGraphDISet({
  difficulty = "Medium",
  setSize = 5,
  examLevel = null,
  singleSeries = null,
  setId = "DI_LINE_001",
  rng,
}) {
  const scenario = rng.pick(LINE_SCENARIOS);
  const isSingle = singleSeries !== null ? singleSeries : difficulty === "Easy";
  const seriesNames = isSingle ? [scenario.seriesNames[0]] : scenario.seriesNames;
  const periods = difficulty === "Easy" ? scenario.xLabels.slice(0, 5) : scenario.xLabels;

  const [minV, maxV] = scenario.valueRange;
  const step = scenario.step;
  const stepsCount = Math.floor((maxV - minV) / step);

  // Build rows = periods (chronological order) x columns = series
  const rows = periods.map((period) => {
    const values = seriesNames.map(() => minV + rng.int(0, stepsCount) * step);
    return { label: period, values };
  });

  const rowTotals = rows.map((r) => sum(r.values));
  const colTotals = seriesNames.map((_, cIdx) => sum(rows.map((r) => r.values[cIdx])));
  const grandTotal = sum(rowTotals);

  const dataset = {
    scenario: scenario.scenario,
    unit: scenario.unit,
    line_variant: isSingle ? "single_line" : "multi_line",
    time_axis: periods,
    columns: [scenario.xLabel, ...seriesNames],
    rows,
    totals: {
      row_totals: rowTotals,
      column_totals: colTotals,
      grand_total: grandTotal,
    },
  };

  const maxVal = Math.max(...rows.flatMap((r) => r.values));
  const yAxisMax = Math.ceil((maxVal * 1.15) / (step * 2)) * (step * 2);

  const chart_spec = {
    chart_type: isSingle ? "single_line" : "multi_line",
    title: scenario.title,
    x_axis_label: scenario.xLabel,
    y_axis_label: scenario.yLabel,
    unit: scenario.unit,
    x_labels: periods,
    axis_scale: { min: 0, max: yAxisMax, step: Math.max(step, Math.round(yAxisMax / 5)) },
    series: seriesNames.map((name, sIdx) => ({
      name,
      points: periods.map((p, pIdx) => ({ x: p, y: rows[pIdx].values[sIdx] })),
    })),
    show_data_labels: true,
    legend: seriesNames.length > 1,
  };

  const questions = buildMatrixQuestions({
    dataset,
    diType: "Line Graph DI",
    setId,
    difficulty,
    setSize,
    entityNoun: scenario.unit.toLowerCase().includes("rs") ? "amount" : "value",
    rng,
  });

  return {
    topic: "Data Interpretation",
    di_type: "Line Graph DI",
    phase: 1,
    title: scenario.title,
    difficulty,
    exam_level: examLevel || EXAM_LEVELS_BY_DIFFICULTY[difficulty] || EXAM_LEVELS_BY_DIFFICULTY.Medium,
    set_size: questions.length,
    dataset,
    chart_spec,
    questions,
    _set_fingerprint: computeSetFingerprint({
      diType: "Line Graph DI",
      scenarioId: scenario.id,
      datasetStructure: `${periods.length}x${seriesNames.length}`,
      categoryCount: periods.length,
      numericalPattern: isSingle ? "single_series" : "dual_series",
      chartType: chart_spec.chart_type,
      questionTypes: questions.map((q) => q.question_type),
    }),
  };
}
