// Place at: server/question-engine/generators/quant/dataInterpretation/types/tabularDI.js
/**
 * Phase 1 Module A: TABULAR DATA INTERPRETATION Generator
 * Supports single-variable, multi-variable, comparative, year-wise, month-wise,
 * department-wise, city-wise, product-wise, and production/consumption tables.
 */
import { computeSetFingerprint, sum } from "../diMath.js";
import { EXAM_LEVELS_BY_DIFFICULTY, TABLE_SCENARIOS } from "../diScenarios.js";
import { buildMatrixQuestions } from "../diQuestionBuilder.js";

export function generateTabularDISet({
  difficulty = "Medium",
  setSize = 5,
  examLevel = null,
  setId = "DI_TAB_001",
  rng,
}) {
  const scenario = rng.pick(TABLE_SCENARIOS);
  const colCount = difficulty === "Easy" ? 3 : 4;
  const selectedCols = scenario.columns.slice(0, colCount);

  const [minV, maxV] = scenario.valueRange;
  const step = scenario.step;
  const stepsCount = Math.floor((maxV - minV) / step);

  // Generate clean, distinct-feeling banking values with zero ambiguity
  const rows = scenario.rows.map((label) => {
    const values = selectedCols.map(() => minV + rng.int(0, stepsCount) * step);
    return { label, values };
  });

  // Compute canonical totals
  const rowTotals = rows.map((r) => sum(r.values));
  const colTotals = selectedCols.map((_, cIdx) =>
    sum(rows.map((r) => r.values[cIdx]))
  );
  const grandTotal = sum(rowTotals);

  const dataset = {
    scenario: scenario.scenario,
    unit: scenario.unit,
    columns: [scenario.rowHeader, ...selectedCols],
    rows,
    totals: {
      row_totals: rowTotals,
      column_totals: colTotals,
      grand_total: grandTotal,
    },
  };

  const chart_spec = {
    chart_type: "table",
    title: scenario.title,
    headers: dataset.columns,
    unit: scenario.unit,
    rows: rows.map((r) => [r.label, ...r.values]),
    show_totals: difficulty === "Easy",
    totals_row: ["Total", ...colTotals],
  };

  const questions = buildMatrixQuestions({
    dataset,
    diType: "Tabular DI",
    setId,
    difficulty,
    setSize,
    entityNoun: scenario.unit === "Units" ? "sales" : scenario.unit.toLowerCase(),
    rng,
  });

  return {
    topic: "Data Interpretation",
    di_type: "Tabular DI",
    phase: 1,
    title: scenario.title,
    difficulty,
    exam_level: examLevel || EXAM_LEVELS_BY_DIFFICULTY[difficulty] || EXAM_LEVELS_BY_DIFFICULTY.Medium,
    set_size: questions.length,
    dataset,
    chart_spec,
    questions,
    _set_fingerprint: computeSetFingerprint({
      diType: "Tabular DI",
      scenarioId: scenario.id,
      datasetStructure: `${rows.length}x${selectedCols.length}`,
      categoryCount: rows.length,
      numericalPattern: `step_${step}`,
      chartType: "table",
      questionTypes: questions.map((q) => q.question_type),
    }),
  };
}
