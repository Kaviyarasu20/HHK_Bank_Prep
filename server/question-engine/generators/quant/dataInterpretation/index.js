// Place at: server/question-engine/generators/quant/dataInterpretation/index.js
import { normalizeDifficulty } from "../../../core/batchUtils.js";
/**
 * HHK Data Interpretation Question Generator — Master Orchestrator
 * Implements all 8 DI types across Phases 1–4 with:
 * - Dataset-First canonical generation workflow (Section 4)
 * - Independent mathematical validation engine (Section 8)
 * - Structural set-level & question-level duplicate prevention (Section 12)
 * - Automatic rejection & regeneration on validation failure (Section 13)
 * - Exact Section 10 JSON Output Format + HHK Engine Router adapter
 */
import { createRng } from "./diMath.js";
import { validateDISet } from "./diValidator.js";
import { generateTabularDISet } from "./types/tabularDI.js";
import { generateBarGraphDISet } from "./types/barGraphDI.js";
import { generatePieChartDISet } from "./types/pieChartDI.js";
import { generateLineGraphDISet } from "./types/lineGraphDI.js";
import { generateCaseletDISet } from "./types/caseletDI.js";
import { generateMissingDISet } from "./types/missingDI.js";
import { generateMixedDISet } from "./types/mixedDI.js";
import { generateDataSufficiencyDISet } from "./types/dataSufficiencyDI.js";

export const SUPPORTED_DI_TYPES = [
  { key: "tabular", label: "Tabular DI", phase: 1, generator: generateTabularDISet },
  { key: "bar_graph", label: "Bar Graph DI", phase: 1, generator: generateBarGraphDISet },
  { key: "pie_chart", label: "Pie Chart DI", phase: 1, generator: generatePieChartDISet },
  { key: "line_graph", label: "Line Graph DI", phase: 1, generator: generateLineGraphDISet },
  { key: "caselet", label: "Caselet DI", phase: 2, generator: generateCaseletDISet },
  { key: "missing", label: "Missing DI", phase: 2, generator: generateMissingDISet },
  { key: "mixed", label: "Mixed DI", phase: 3, generator: generateMixedDISet },
  { key: "data_sufficiency", label: "Data Sufficiency DI", phase: 4, generator: generateDataSufficiencyDISet },
];

function resolveDITypeEntry(diType = "tabular", rng = null) {
  const s = String(diType || "").trim().toLowerCase();
  if (!s || s === "auto" || s === "mixed_all") {
    return rng ? rng.pick(SUPPORTED_DI_TYPES.slice(0, 7)) : SUPPORTED_DI_TYPES[0];
  }
  if (s.includes("sufficien") || s === "ds") return SUPPORTED_DI_TYPES[7];
  if (s.includes("mixed")) return SUPPORTED_DI_TYPES[6];
  if (s.includes("missing")) return SUPPORTED_DI_TYPES[5];
  if (s.includes("caselet") || s.includes("paragraph")) return SUPPORTED_DI_TYPES[4];
  if (s.includes("line")) return SUPPORTED_DI_TYPES[3];
  if (s.includes("pie")) return SUPPORTED_DI_TYPES[2];
  if (s.includes("bar")) return SUPPORTED_DI_TYPES[1];
  return SUPPORTED_DI_TYPES[0];
}

function stripInternalMeta(diSet) {
  const cleanQuestions = diSet.questions.map(({ _meta, ...rest }) => rest);
  const { _set_fingerprint, ...restSet } = diSet;
  return {
    ...restSet,
    questions: cleanQuestions,
  };
}

/**
 * Generates ONE complete, independently validated DI set in the exact Section 10 JSON format.
 * Automatically rejects and regenerates if any validation check fails (Section 13).
 */
export function generateDISet({
  diType = "tabular",
  difficulty = "Medium",
  setSize = 5, // 4, 5, or 6 (default 5)
  examLevel = null,
  variant = null,
  mode = null,
  combo = null,
  presentation = null,
  seed = null,
  setId = null,
  excludeSetFingerprints = [],
  includeInternalMeta = false,
  maxAttempts = 12,
} = {}) {
  const clampedSize = [4, 5, 6].includes(Number(setSize)) ? Number(setSize) : 5;
  const normDiff = normalizeDifficulty(difficulty);
  const baseSeed = seed !== null && seed !== undefined ? Number(seed) : Date.now() ^ Math.floor(Math.random() * 1e9);
  const seenSets = new Set(excludeSetFingerprints);
  const rejectedLogs = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = createRng(baseSeed + attempt * 7919);
    const entry = resolveDITypeEntry(diType, rng);
    const resolvedSetId = setId || `DI_${entry.key.toUpperCase()}_${String(Math.abs(baseSeed) % 10000).padStart(4, "0")}`;

    // Steps 1–8: Dataset-first generation -> chart_spec -> questions -> options
    const candidate = entry.generator({
      difficulty: normDiff,
      setSize: clampedSize,
      examLevel,
      variant,
      mode,
      combo,
      presentation,
      setId: resolvedSetId,
      rng,
    });

    // Step 9: Independent Mathematical Validation
    const report = validateDISet(candidate);

    // Step 10: Duplicate Set Prevention
    const isDuplicateSet = candidate._set_fingerprint && seenSets.has(candidate._set_fingerprint);

    if (report.valid && !isDuplicateSet) {
      candidate.set_validation = report.set_validation;
      if (includeInternalMeta) {
        return { diSet: candidate, fingerprint: candidate._set_fingerprint, rejectedLogs };
      }
      return { diSet: stripInternalMeta(candidate), fingerprint: candidate._set_fingerprint, rejectedLogs };
    }

    rejectedLogs.push({
      attempt: attempt + 1,
      diType: entry.label,
      reasons: isDuplicateSet ? ["Duplicate set-level fingerprint"] : report.errors,
    });
  }

  throw new Error(
    `Failed to generate a valid DI set for type="${diType}" after ${maxAttempts} attempts. Last error: ${JSON.stringify(
      rejectedLogs[rejectedLogs.length - 1]
    )}`
  );
}

/**
 * Generates multiple unique, validated DI sets across one or more DI types.
 */
export function generateDIBatch({
  setCount = 3,
  diTypes = ["tabular", "bar_graph", "pie_chart", "line_graph", "caselet", "missing", "mixed", "data_sufficiency"],
  difficulty = "Medium",
  setSize = 5,
  examLevel = null,
  seed = null,
  excludeSetFingerprints = [],
} = {}) {
  const baseSeed = seed !== null && seed !== undefined ? Number(seed) : Date.now() ^ Math.floor(Math.random() * 1e9);
  const seen = new Set(excludeSetFingerprints);
  const sets = [];
  const allRejected = [];

  for (let i = 0; i < setCount; i++) {
    const activeType = Array.isArray(diTypes) && diTypes.length > 0 ? diTypes[i % diTypes.length] : "tabular";
    const { diSet, fingerprint, rejectedLogs } = generateDISet({
      diType: activeType,
      difficulty,
      setSize,
      examLevel,
      seed: baseSeed + i * 104729,
      setId: `DI${String(i + 1).padStart(3, "0")}`,
      excludeSetFingerprints: Array.from(seen),
    });
    if (fingerprint) seen.add(fingerprint);
    sets.push(diSet);
    allRejected.push(...rejectedLogs);
  }

  return {
    sets,
    fingerprints: Array.from(seen),
    rejectedLogs: allRejected,
  };
}

/**
 * Renders a concise plain-text / Markdown data context block for HHK question text
 * so every question in the HHK DB / Admin Preview / CBT UI carries its exact source data
 * alongside the structured `chart_spec` JSON for dynamic chart rendering.
 */
export function renderDatasetContextText(diSet) {
  const ds = diSet.dataset;
  if (diSet.di_type === "Caselet DI" && ds.passage) {
    return `[${diSet.title}]\n${ds.passage}`;
  }
  if (diSet.di_type === "Pie Chart DI") {
    const lines = ds.sectors.map((s) => `${s.label}: ${s.percentage}% (${s.angle}°)`);
    let block = `[${diSet.title} | Total = ${ds.total} ${ds.unit}]\n${lines.join(" | ")}`;
    if (ds.secondary_pie) {
      const lines2 = ds.secondary_pie.sectors.map((s) => `${s.label}: ${s.percentage}%`);
      block += `\n[Year 2 | Total = ${ds.secondary_pie.total} ${ds.unit}]\n${lines2.join(" | ")}`;
    }
    return block;
  }
  if (diSet.di_type === "Missing DI" && diSet.chart_spec?.chart_type === "missing_table") {
    const header = diSet.chart_spec.headers.join(" | ");
    const body = diSet.chart_spec.rows.map((r) => r.join(" | ")).join("\n");
    return `[${diSet.title} | Unit: ${ds.unit}]\n${header}\n${body}`;
  }
  if (diSet.di_type === "Mixed DI") {
    const header = `Category | Total (${ds.unit}) | ${ds.columns[1]}:${ds.columns[2]}`;
    const body = ds.category_breakdown.map((r) => `${r.label} | ${r.total} (${r.percentage}%) | ${r.ratio}`).join("\n");
    return `[${diSet.title} | Grand Total = ${ds.grand_total} ${ds.unit}]\n${header}\n${body}`;
  }
  const header = ds.columns.join(" | ");
  const body = ds.rows.map((r) => [r.label, ...r.values].join(" | ")).join("\n");
  return `[${diSet.title} | Unit: ${ds.unit}]\n${header}\n${body}`;
}

/**
 * Adapter for HHK `engineRouter.js`: flattens generated validated DI sets into
 * HHK Question Engine raw question objects while preserving `diSet` & `chartSpec`.
 */
export function generateDIQuestionsForHHK({
  exam = "IBPS_PO_PRELIMS",
  diType = "auto",
  difficulty = "Medium",
  count = 5,
  seed = null,
} = {}) {
  const neededSets = Math.max(1, Math.ceil(count / 5));
  const diTypes =
    diType && diType !== "auto"
      ? [diType]
      : ["tabular", "bar_graph", "pie_chart", "line_graph", "caselet", "missing", "mixed"];

  const { sets } = generateDIBatch({
    setCount: neededSets,
    diTypes,
    difficulty,
    setSize: Math.min(6, Math.max(4, count >= 5 ? 5 : 4)),
    seed,
  });

  const flat = [];
  for (const diSet of sets) {
    const contextBlock = renderDatasetContextText(diSet);
    for (const q of diSet.questions) {
      if (flat.length >= count) break;
      const optArray = ["A", "B", "C", "D", "E"].map((k) => q.options[k]);
      const correctIdx = ["A", "B", "C", "D", "E"].indexOf(q.correct_answer);
      const answerText = q.options[q.correct_answer];
      flat.push({
        questionId: q.question_id,
        exam,
        topic: "Data Interpretation",
        subType: diSet.di_type,
        difficulty: q.difficulty.toUpperCase(),
        questionText: `${contextBlock}\n\nQ: ${q.question}`,
        options: optArray,
        optionsMap: q.options,
        correctOptionIndex: correctIdx,
        answer: answerText,
        solutionSteps: [
          `Given: ${q.solution.given_data.join("; ")}`,
          `Formula: ${q.solution.formula}`,
          ...q.solution.steps,
          `Shortcut: ${q.shortcut_method}`,
        ],
        generationMode: "RULE_ENGINE",
        diSetMeta: {
          di_type: diSet.di_type,
          title: diSet.title,
          dataset: diSet.dataset,
          chart_spec: diSet.chart_spec,
          set_validation: diSet.set_validation,
        },
      });
    }
  }
  return flat;
}
