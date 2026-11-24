// Place at: server/question-engine/generators/quant/dataInterpretation/types/barGraphDI.js
/**
 * Phase 1 & 2 Module B: BAR GRAPH DATA INTERPRETATION Generator
 * Supports simple vertical, simple horizontal, multiple/comparative, and stacked bar graphs.
 */
import { computeSetFingerprint, sum } from "../diMath.js";
import { BAR_SCENARIOS, EXAM_LEVELS_BY_DIFFICULTY } from "../diScenarios.js";
import { buildMatrixQuestions } from "../diQuestionBuilder.js";

export function generateBarGraphDISet({
  difficulty = "Medium",
  setSize = 5,
  examLevel = null,
  variant = null, // "simple_vertical" | "simple_horizontal" | "comparative" | "stacked"
  setId = "DI_BAR_001",
  rng,
}) {
  const scenario = rng.pick(BAR_SCENARIOS);
  const chosenVariant =
    variant ||
    (difficulty === "Easy"
      ? rng.pick(["simple_vertical", "simple_horizontal"])
      : difficulty === "Medium"
      ? "comparative"
      : "stacked");

  const [minV, maxV] = scenario.valueRange;
  const step = scenario.step;
  const stepsCount = Math.floor((maxV - minV) / step);

  let seriesNames;
  if (chosenVariant === "simple_vertical" || chosenVariant === "simple_horizontal") {
    seriesNames = [scenario.seriesNames[0]];
  } else if (chosenVariant === "comparative") {
    seriesNames = scenario.seriesNames;
  } else {
    seriesNames = scenario.stackedSeries;
  }

  const rows = scenario.categories.map((cat) => {
    const values = seriesNames.map(() => {
      const raw = minV + rng.int(0, stepsCount) * step;
      return chosenVariant === "stacked" ? Math.max(step * 2, Math.round(raw / 2 / step) * step) : raw;
    });
    return { label: cat, values };
  });

  const rowTotals = rows.map((r) => sum(r.values));
  const colTotals = seriesNames.map((_, cIdx) => sum(rows.map((r) => r.values[cIdx])));
  const grandTotal = sum(rowTotals);

  const dataset = {
    scenario: `${scenario.scenario} (${chosenVariant.replace("_", " ")} bar graph)`,
    unit: scenario.unit,
    bar_variant: chosenVariant,
    columns: [scenario.xLabel, ...seriesNames],
    rows,
    totals: {
      row_totals: rowTotals,
      column_totals: colTotals,
      grand_total: grandTotal,
    },
  };

  // Exact numerical series for frontend rendering (no visual estimation required)
  const maxVal = chosenVariant === "stacked" ? Math.max(...rowTotals) : Math.max(...rows.flatMap((r) => r.values));
  const yAxisMax = Math.ceil((maxVal * 1.15) / (step * 2)) * (step * 2);

  const chart_spec = {
    chart_type:
      chosenVariant === "simple_horizontal"
        ? "horizontal_bar"
        : chosenVariant === "stacked"
        ? "stacked_bar"
        : chosenVariant === "comparative"
        ? "grouped_bar"
        : "vertical_bar",
    title: scenario.title,
    x_axis_label: chosenVariant === "simple_horizontal" ? scenario.yLabel : scenario.xLabel,
    y_axis_label: chosenVariant === "simple_horizontal" ? scenario.xLabel : scenario.yLabel,
    unit: scenario.unit,
    categories: scenario.categories,
    axis_scale: { min: 0, max: yAxisMax, step: Math.max(step, Math.round(yAxisMax / 5)) },
    series: seriesNames.map((name, sIdx) => ({
      name,
      data: rows.map((r) => r.values[sIdx]),
    })),
    stacked_totals: chosenVariant === "stacked" ? rowTotals : null,
    show_data_labels: true,
    legend: seriesNames.length > 1,
  };

  const questions = buildMatrixQuestions({
    dataset,
    diType: "Bar Graph DI",
    setId,
    difficulty,
    setSize,
    entityNoun: scenario.unit.toLowerCase().includes("rs") ? "amount" : "value",
    rng,
  });

  return {
    topic: "Data Interpretation",
    di_type: "Bar Graph DI",
    phase: chosenVariant === "comparative" || chosenVariant === "stacked" ? 2 : 1,
    title: `${scenario.title} (${chosenVariant.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())})`,
    difficulty,
    exam_level: examLevel || EXAM_LEVELS_BY_DIFFICULTY[difficulty] || EXAM_LEVELS_BY_DIFFICULTY.Medium,
    set_size: questions.length,
    dataset,
    chart_spec,
    questions,
    _set_fingerprint: computeSetFingerprint({
      diType: "Bar Graph DI",
      scenarioId: scenario.id,
      datasetStructure: `${rows.length}x${seriesNames.length}`,
      categoryCount: rows.length,
      numericalPattern: chosenVariant,
      chartType: chart_spec.chart_type,
      questionTypes: questions.map((q) => q.question_type),
    }),
  };
}
