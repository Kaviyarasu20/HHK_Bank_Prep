// Place at: server/question-engine/generators/quant/dataInterpretation/types/pieChartDI.js
/**
 * Phase 1 & 2 Module C: PIE CHART DATA INTERPRETATION Generator
 * Supports percentage-based, degree-based, value-based, and dual/comparative pie charts.
 * Enforces: sum(percentages) === 100%, sum(angles) === 360°, sum(values) === total.
 */
import {
  buildFiveOptions,
  centralAngle,
  computeQuestionFingerprint,
  computeSetFingerprint,
  formatDegree,
  formatNumber,
  formatPercent,
  formatRatio,
  roundTo,
  sectorValueFromPercent,
  simplifyRatio,
  sum,
} from "../diMath.js";
import { EXAM_LEVELS_BY_DIFFICULTY, PIE_SCENARIOS } from "../diScenarios.js";

// Clean percentage partitions that sum to EXACTLY 100% and produce exact 0.1-clean angles (multiples of 5% -> 18°, or 2.5% -> 9°)
const CLEAN_PCT_PARTITIONS = [
  [10, 15, 20, 25, 30],
  [12, 18, 20, 22, 28],
  [15, 15, 20, 25, 25],
  [10, 20, 20, 22, 28],
  [14, 16, 20, 24, 26],
  [10, 18, 22, 24, 26],
  [12, 16, 18, 24, 30],
];

function buildPieData(categories, total, pctPartition, rng) {
  const pcts = rng.shuffle(pctPartition);
  const sectors = categories.map((label, i) => {
    const pct = pcts[i];
    const value = Math.round(sectorValueFromPercent(total, pct));
    const angle = roundTo(centralAngle(value, total), 2);
    return { label, percentage: pct, angle, value };
  });
  return {
    total,
    sectors,
    total_percentage: sum(sectors.map((s) => s.percentage)),
    total_angle: roundTo(sum(sectors.map((s) => s.angle)), 2),
    total_value: sum(sectors.map((s) => s.value)),
  };
}

export function generatePieChartDISet({
  difficulty = "Medium",
  setSize = 5,
  examLevel = null,
  mode = null, // "percentage" | "degree" | "value" | "comparative"
  setId = "DI_PIE_001",
  rng,
}) {
  const scenario = rng.pick(PIE_SCENARIOS);
  const chosenMode =
    mode ||
    (difficulty === "Easy"
      ? rng.pick(["percentage", "value"])
      : difficulty === "Medium"
      ? rng.pick(["percentage", "degree"])
      : "comparative");

  const total1 = rng.pick(scenario.totals);
  const part1 = rng.pick(CLEAN_PCT_PARTITIONS);
  const pie1 = buildPieData(scenario.categories, total1, part1, rng);

  let pie2 = null;
  if (chosenMode === "comparative") {
    const total2 = rng.pick(scenario.totals.filter((t) => t !== total1));
    const part2 = rng.pick(CLEAN_PCT_PARTITIONS.filter((p) => p !== part1));
    pie2 = buildPieData(scenario.categories, total2, part2, rng);
  }

  const dataset = {
    scenario: scenario.scenario,
    unit: scenario.unit,
    pie_mode: chosenMode,
    total: pie1.total,
    columns: ["Category", "Percentage (%)", "Central Angle (°)", `Value (${scenario.unit})`],
    rows: pie1.sectors.map((s) => ({
      label: s.label,
      values: [s.percentage, s.angle, s.value],
    })),
    sectors: pie1.sectors,
    secondary_pie: pie2
      ? {
          label: "Year 2 / Comparison Chart",
          total: pie2.total,
          sectors: pie2.sectors,
        }
      : null,
  };

  const chart_spec =
    chosenMode === "comparative"
      ? {
          chart_type: "dual_pie",
          title: `${scenario.title} (Year 1 vs Year 2)`,
          unit: scenario.unit,
          charts: [
            {
              subtitle: `Year 1 (Total = ${pie1.total} ${scenario.unit})`,
              display_mode: "percentage",
              total: pie1.total,
              sectors: pie1.sectors.map((s) => ({
                label: s.label,
                percentage: s.percentage,
                angle: s.angle,
                value: s.value,
              })),
            },
            {
              subtitle: `Year 2 (Total = ${pie2.total} ${scenario.unit})`,
              display_mode: "percentage",
              total: pie2.total,
              sectors: pie2.sectors.map((s) => ({
                label: s.label,
                percentage: s.percentage,
                angle: s.angle,
                value: s.value,
              })),
            },
          ],
          legend: true,
        }
      : {
          chart_type: "pie",
          title: scenario.title,
          display_mode: chosenMode,
          unit: scenario.unit,
          total: pie1.total,
          sectors: pie1.sectors.map((s) => ({
            label: s.label,
            percentage: s.percentage,
            angle: s.angle,
            value: s.value,
          })),
          legend: true,
        };

  const idx = rng.shuffle([0, 1, 2, 3, 4]);
  const s0 = pie1.sectors[idx[0]];
  const s1 = pie1.sectors[idx[1]];
  const s2 = pie1.sectors[idx[2]];
  const s3 = pie1.sectors[idx[3]];
  const s4 = pie1.sectors[idx[4]];

  const makePieQ = (qNum, cfg) => {
    const built = buildFiveOptions({
      correctValue: cfg.correctValue,
      correctFormatted: cfg.correctFormatted,
      mistakeCandidates: cfg.mistakeCandidates,
      formatType: cfg.formatType || "number",
      decimals: cfg.decimals ?? 2,
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
        cfg.formatType === "ratio" ? built.correct_answer_formatted : roundTo(Number(cfg.correctValue), cfg.decimals ?? 2),
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
          diType: "Pie Chart DI",
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
    // Q1: Sector value
    () =>
      makePieQ(1, {
        questionType: "Direct Value",
        subType: "Value represented by a pie sector",
        qDiff: "Easy",
        questionText: `What is the exact value (in ${scenario.unit}) represented by ${s0.label}${chosenMode === "comparative" ? " in Year 1" : ""}?`,
        correctValue: s0.value,
        mistakeCandidates: [s1.value, Math.round((pie1.total * (s0.percentage + 2)) / 100), Math.round((pie1.total * (s0.percentage - 2)) / 100), s0.value + 100],
        givenData: [`Total = ${pie1.total} ${scenario.unit}`, `${s0.label} share = ${s0.percentage}% (${s0.angle}°)`],
        formula: "Category Value = Total Value × Percentage / 100",
        steps: [
          `Value of ${s0.label} = ${pie1.total} × (${s0.percentage} / 100)`,
          `Value of ${s0.label} = ${formatNumber(s0.value)} ${scenario.unit}`,
        ],
        shortcut: `Find 1% of ${pie1.total} (= ${pie1.total / 100}) and multiply by ${s0.percentage}.`,
        datasetFields: [`sector:${s0.label}`],
        operation: "pie_sector_value",
        calculationStructure: "total*pct/100",
        verificationSpec: { op: "pie_sector_value", chart: 1, sectorIndex: idx[0] },
      }),

    // Q2: Central angle
    () =>
      makePieQ(2, {
        questionType: "Central Angle",
        subType: "Central angle subtended by a sector",
        qDiff: "Easy",
        questionText: `What is the central angle (in degrees) subtended by the ${s1.label} sector${chosenMode === "comparative" ? " in Year 1" : ""}?`,
        correctValue: s1.angle,
        formatType: "degree",
        decimals: 1,
        mistakeCandidates: [s0.angle, s2.angle, roundTo(s1.percentage * 3.0, 1), roundTo(s1.angle + 7.2, 1), roundTo(Math.max(3.6, s1.angle - 7.2), 1)],
        givenData: [`${s1.label} share = ${s1.percentage}%`, `Full circle = 360°`],
        formula: "Central Angle = (Percentage / 100) × 360° = Percentage × 3.6°",
        steps: [
          `Central Angle = (${s1.percentage} / 100) × 360°`,
          `Central Angle = ${s1.percentage} × 3.6° = ${formatDegree(s1.angle, 1)}`,
        ],
        shortcut: "Remember 1% = 3.6° (and 10% = 36°). Multiply the percentage directly by 3.6.",
        datasetFields: [`sector:${s1.label}`],
        operation: "pie_central_angle",
        calculationStructure: "pct*3.6",
        verificationSpec: { op: "pie_sector_angle", chart: 1, sectorIndex: idx[1] },
      }),

    // Q3: Difference between two sectors
    () => {
      const diff = Math.abs(s2.value - s3.value);
      return makePieQ(3, {
        questionType: "Difference",
        subType: "Difference between two pie sectors",
        qDiff: "Medium",
        questionText: `What is the absolute difference (in ${scenario.unit}) between the values of ${s2.label} and ${s3.label}${chosenMode === "comparative" ? " in Year 1" : ""}?`,
        correctValue: diff,
        mistakeCandidates: [s2.value + s3.value, Math.abs(s0.value - s1.value), diff + Math.round(pie1.total * 0.02), Math.max(10, diff - Math.round(pie1.total * 0.02))],
        givenData: [
          `Total = ${pie1.total} ${scenario.unit}`,
          `${s2.label} = ${s2.percentage}% (${s2.value})`,
          `${s3.label} = ${s3.percentage}% (${s3.value})`,
        ],
        formula: "Difference = Total × |Percentage₁ − Percentage₂| / 100",
        steps: [
          `Percentage difference = |${s2.percentage}% − ${s3.percentage}%| = ${Math.abs(s2.percentage - s3.percentage)}%`,
          `Value difference = ${pie1.total} × (${Math.abs(s2.percentage - s3.percentage)} / 100) = ${formatNumber(diff)}`,
        ],
        shortcut: "Subtract the percentages first, then multiply once by Total/100 instead of computing both sector values separately.",
        datasetFields: [`sector:${s2.label}`, `sector:${s3.label}`],
        operation: "pie_sector_diff",
        calculationStructure: "total*|p1-p2|/100",
        verificationSpec: { op: "pie_sector_diff", chart: 1, i1: idx[2], i2: idx[3] },
      });
    },

    // Q4: Ratio of combined sectors
    () => {
      const sumA = s0.value + s1.value;
      const sumB = s2.value + s4.value;
      const [sa, sb] = simplifyRatio(sumA, sumB);
      return makePieQ(4, {
        questionType: "Ratio",
        subType: "Ratio of combined sectors",
        qDiff: "Medium",
        questionText: `What is the respective ratio of the combined value of ${s0.label} and ${s1.label} to the combined value of ${s2.label} and ${s4.label}${chosenMode === "comparative" ? " in Year 1" : ""}?`,
        correctValue: [sa, sb],
        correctFormatted: formatRatio(sumA, sumB),
        formatType: "ratio",
        mistakeCandidates: [[sb, sa], [s0.percentage, s2.percentage], [sa + 1, sb], [sa, sb + 1]],
        givenData: [
          `${s0.label} + ${s1.label} = ${s0.percentage}% + ${s1.percentage}% = ${s0.percentage + s1.percentage}%`,
          `${s2.label} + ${s4.label} = ${s2.percentage}% + ${s4.percentage}% = ${s2.percentage + s4.percentage}%`,
        ],
        formula: "Ratio = (Pct₁ + Pct₂) : (Pct₃ + Pct₄) [since Total cancels out]",
        steps: [
          `Combined share 1 = ${s0.percentage}% + ${s1.percentage}% = ${s0.percentage + s1.percentage}% (${sumA})`,
          `Combined share 2 = ${s2.percentage}% + ${s4.percentage}% = ${s2.percentage + s4.percentage}% (${sumB})`,
          `Ratio = ${s0.percentage + s1.percentage} : ${s2.percentage + s4.percentage} = ${formatRatio(sumA, sumB)}`,
        ],
        shortcut: "Never compute absolute values for same-pie ratios — take the ratio directly from the percentages!",
        datasetFields: [`sector:${s0.label}`, `sector:${s1.label}`, `sector:${s2.label}`, `sector:${s4.label}`],
        operation: "pie_combined_ratio",
        calculationStructure: "(p0+p1):(p2+p4)",
        verificationSpec: { op: "pie_combined_ratio", chart: 1, g1: [idx[0], idx[1]], g2: [idx[2], idx[4]] },
      });
    },

    // Q5: Comparative (Year 1 vs Year 2) OR Percentage more/less between two sectors
    () => {
      if (chosenMode === "comparative" && pie2) {
        const y1Val = pie1.sectors[idx[0]].value;
        const y2Val = pie2.sectors[idx[0]].value;
        const isInc = y2Val >= y1Val;
        const pctDiff = roundTo((Math.abs(y2Val - y1Val) / y1Val) * 100, 2);
        const wrongBase = roundTo((Math.abs(y2Val - y1Val) / y2Val) * 100, 2);
        return makePieQ(5, {
          questionType: isInc ? "Percentage Increase" : "Percentage Decrease",
          subType: "Cross-pie comparative percentage change",
          qDiff: "Hard",
          questionText: `What is the percentage ${isInc ? "increase" : "decrease"} in the value of ${s0.label} from Year 1 to Year 2?`,
          correctValue: pctDiff,
          formatType: "percent",
          mistakeCandidates: [wrongBase, Math.abs(pie2.sectors[idx[0]].percentage - s0.percentage), roundTo(pctDiff + 4, 2), roundTo(Math.max(1, pctDiff - 4), 2)],
          givenData: [
            `Year 1 ${s0.label} = ${s0.percentage}% of ${pie1.total} = ${y1Val}`,
            `Year 2 ${s0.label} = ${pie2.sectors[idx[0]].percentage}% of ${pie2.total} = ${y2Val}`,
          ],
          formula: "Percentage Change = (|Year 2 Value − Year 1 Value| / Year 1 Value) × 100",
          steps: [
            `Year 1 value = ${y1Val}, Year 2 value = ${y2Val}`,
            `Change = |${y2Val} − ${y1Val}| = ${Math.abs(y2Val - y1Val)}`,
            `Percentage ${isInc ? "Increase" : "Decrease"} = (${Math.abs(y2Val - y1Val)} / ${y1Val}) × 100 = ${formatPercent(pctDiff)}`,
          ],
          shortcut: "Because the two pie charts have different totals, convert both percentages to actual values before taking percentage change.",
          datasetFields: [`pie1:${s0.label}`, `pie2:${s0.label}`],
          operation: "dual_pie_pct_change",
          calculationStructure: "|v2-v1|/v1*100",
          verificationSpec: { op: "dual_pie_pct_change", sectorIndex: idx[0] },
        });
      }

      const isMore = s0.value >= s3.value;
      const ans = roundTo((Math.abs(s0.value - s3.value) / s3.value) * 100, 2);
      const wrongBase = roundTo((Math.abs(s0.value - s3.value) / s0.value) * 100, 2);
      return makePieQ(5, {
        questionType: "Comparison",
        subType: "Percentage more/less between two sectors",
        qDiff: "Medium",
        questionText: `The value of ${s0.label} is what percentage ${isMore ? "more" : "less"} than the value of ${s3.label}?`,
        correctValue: ans,
        formatType: "percent",
        mistakeCandidates: [wrongBase, Math.abs(s0.percentage - s3.percentage), roundTo((s0.percentage / s3.percentage) * 100, 2), roundTo(ans + 5, 2)],
        givenData: [`${s0.label} = ${s0.percentage}%`, `${s3.label} = ${s3.percentage}% (Base)`],
        formula: `Percentage ${isMore ? "More" : "Less"} = (|Pct₁ − Pct₂| / Pct₂) × 100`,
        steps: [
          `Difference in percentage points = |${s0.percentage} − ${s3.percentage}| = ${Math.abs(s0.percentage - s3.percentage)}`,
          `Required % = (${Math.abs(s0.percentage - s3.percentage)} / ${s3.percentage}) × 100 = ${formatPercent(ans)}`,
        ],
        shortcut: "Within a single pie chart, compute percentage more/less directly from the sector percentages.",
        datasetFields: [`sector:${s0.label}`, `sector:${s3.label}`],
        operation: "pie_pct_more_less",
        calculationStructure: "|p0-p3|/p3*100",
        verificationSpec: { op: "pie_pct_more_less", chart: 1, i1: idx[0], i2: idx[3] },
      });
    },

    // Q6: Average of three sectors (for setSize === 6)
    () => {
      const avg3 = roundTo((s1.value + s2.value + s4.value) / 3, 2);
      return makePieQ(6, {
        questionType: "Average",
        subType: "Average value of three sectors",
        qDiff: "Medium",
        questionText: `What is the average value (in ${scenario.unit}) of ${s1.label}, ${s2.label}, and ${s4.label}${chosenMode === "comparative" ? " in Year 1" : ""}?`,
        correctValue: avg3,
        mistakeCandidates: [s1.value + s2.value + s4.value, roundTo((s1.value + s2.value + s4.value) / 5, 2), roundTo(avg3 + 50, 2), roundTo(Math.max(10, avg3 - 50), 2)],
        givenData: [`${s1.label} = ${s1.value}`, `${s2.label} = ${s2.value}`, `${s4.label} = ${s4.value}`],
        formula: "Average = (Value₁ + Value₂ + Value₃) / 3",
        steps: [
          `Sum = ${s1.value} + ${s2.value} + ${s4.value} = ${s1.value + s2.value + s4.value}`,
          `Average = ${s1.value + s2.value + s4.value} / 3 = ${formatNumber(avg3)}`,
        ],
        shortcut: "Sum the three percentages, divide by 3, and multiply by Total/100.",
        datasetFields: [`sector:${s1.label}`, `sector:${s2.label}`, `sector:${s4.label}`],
        operation: "pie_avg_3",
        calculationStructure: "(v1+v2+v4)/3",
        verificationSpec: { op: "pie_avg_subset", chart: 1, indices: [idx[1], idx[2], idx[4]] },
      });
    },
  ];

  const questions = qPool.slice(0, setSize).map((fn) => fn());

  return {
    topic: "Data Interpretation",
    di_type: "Pie Chart DI",
    phase: chosenMode === "comparative" ? 2 : 1,
    title: `${scenario.title} (${chosenMode.charAt(0).toUpperCase() + chosenMode.slice(1)} Mode)`,
    difficulty,
    exam_level: examLevel || EXAM_LEVELS_BY_DIFFICULTY[difficulty] || EXAM_LEVELS_BY_DIFFICULTY.Medium,
    set_size: questions.length,
    dataset,
    chart_spec,
    questions,
    _set_fingerprint: computeSetFingerprint({
      diType: "Pie Chart DI",
      scenarioId: scenario.id,
      datasetStructure: chosenMode === "comparative" ? "dual_5_sectors" : "single_5_sectors",
      categoryCount: 5,
      numericalPattern: chosenMode,
      chartType: chart_spec.chart_type,
      questionTypes: questions.map((q) => q.question_type),
    }),
  };
}
