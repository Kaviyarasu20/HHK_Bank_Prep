// Place at: server/question-engine/generators/quant/dataInterpretation/diMath.js
/**
 * Core Mathematical, Formatting, Distractor, and Fingerprinting Utilities
 * for the HHK Data Interpretation Question Generator.
 */

export function createRng(seed = Date.now()) {
  let s = (Number(seed) || 123456789) >>> 0;
  if (s === 0) s = 0x9e3779b9;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    random: next,
    int(min, max) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    pick(arr) {
      if (!Array.isArray(arr) || arr.length === 0) return undefined;
      return arr[Math.floor(next() * arr.length)];
    },
    sample(arr, k) {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, Math.min(k, copy.length));
    },
    shuffle(arr) {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

export function gcd(a, b) {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

export function simplifyRatio(a, b) {
  const numA = Math.round(Number(a));
  const numB = Math.round(Number(b));
  if (numA === 0 && numB === 0) return [0, 0];
  if (numA === 0) return [0, 1];
  if (numB === 0) return [1, 0];
  const g = gcd(numA, numB);
  return [numA / g, numB / g];
}

export function formatRatio(a, b) {
  const [sa, sb] = simplifyRatio(a, b);
  return `${sa} : ${sb}`;
}

export function roundTo(val, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round((Number(val) + Number.EPSILON) * factor) / factor;
}

export function isCleanNumber(val, tol = 1e-9) {
  return Number.isFinite(val) && Math.abs(val - Math.round(val)) < tol;
}

export function formatNumber(val, decimals = 2) {
  const num = Number(val);
  if (!Number.isFinite(num)) return "0";
  if (isCleanNumber(num)) {
    return String(Math.round(num));
  }
  const rounded = roundTo(num, decimals);
  if (isCleanNumber(rounded)) return String(Math.round(rounded));
  return Number(rounded.toFixed(decimals)).toString();
}

export function formatPercent(val, decimals = 2) {
  return `${formatNumber(val, decimals)}%`;
}

export function formatDegree(val, decimals = 1) {
  return `${formatNumber(val, decimals)}°`;
}

export function sum(arr) {
  return arr.reduce((acc, v) => acc + Number(v || 0), 0);
}

export function average(arr) {
  if (!arr.length) return 0;
  return sum(arr) / arr.length;
}

export function centralAngle(sectorValue, totalValue) {
  if (!totalValue) return 0;
  return (Number(sectorValue) / Number(totalValue)) * 360;
}

export function percentFromAngle(angle) {
  return (Number(angle) / 360) * 100;
}

export function sectorValueFromPercent(totalValue, pct) {
  return (Number(totalValue) * Number(pct)) / 100;
}

export function percentChange(oldVal, newVal) {
  if (!oldVal) return 0;
  return ((Number(newVal) - Number(oldVal)) / Number(oldVal)) * 100;
}

/**
 * Canonical value key for duplicate / equivalent-format option detection.
 * E.g. "25%", "25.0%", "25.00%" -> "pct:25"; "3 : 4" and "6 : 8" -> "ratio:3:4".
 */
export function canonicalOptionKey(rawText) {
  const s = String(rawText ?? "").trim();
  if (!s) return "";

  // Ratio format: "a : b" or "a:b"
  const ratioMatch = s.match(/^(-?\d+)\s*:\s*(-?\d+)$/);
  if (ratioMatch) {
    const [sa, sb] = simplifyRatio(Number(ratioMatch[1]), Number(ratioMatch[2]));
    return `ratio:${sa}:${sb}`;
  }

  // Percentage format
  if (s.endsWith("%")) {
    const num = Number(s.slice(0, -1).replace(/,/g, "").trim());
    if (Number.isFinite(num)) return `pct:${roundTo(num, 4)}`;
  }

  // Degree format
  if (s.endsWith("°")) {
    const num = Number(s.slice(0, -1).replace(/,/g, "").trim());
    if (Number.isFinite(num)) return `deg:${roundTo(num, 4)}`;
  }

  // Currency or unit suffix stripped pure number
  const cleanedNum = s.replace(/^(Rs\.?|₹|\$)\s*/i, "").replace(/,/g, "").trim();
  if (/^-?\d+(\.\d+)?$/.test(cleanedNum)) {
    return `num:${roundTo(Number(cleanedNum), 4)}`;
  }

  return `str:${s.toLowerCase().replace(/\s+/g, " ")}`;
}

/**
 * Builds exactly 5 options (A, B, C, D, E) from a correct formatted value and
 * a prioritized list of mistake-driven distractor candidates.
 * Guarantees:
 * - Exactly 5 unique, non-equivalent options
 * - Randomized correct answer position (A..E)
 * - Consistent formatting via formatterFn
 */
export function buildFiveOptions({
  correctValue,
  correctFormatted,
  mistakeCandidates = [],
  formatType = "number", // "number" | "percent" | "degree" | "ratio" | "text"
  decimals = 2,
  allowNegative = false,
  rng,
}) {
  const formatVal = (val) => {
    if (formatType === "percent") return formatPercent(val, decimals);
    if (formatType === "degree") return formatDegree(val, decimals);
    if (formatType === "ratio") {
      if (Array.isArray(val) && val.length === 2) return formatRatio(val[0], val[1]);
      return String(val);
    }
    if (formatType === "text") return String(val);
    return formatNumber(val, decimals);
  };

  const correctStr = correctFormatted !== undefined ? String(correctFormatted) : formatVal(correctValue);
  const usedKeys = new Set([canonicalOptionKey(correctStr)]);
  const distractors = [];

  const tryAdd = (candidate) => {
    if (candidate === null || candidate === undefined) return false;
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) return false;
      if (!allowNegative && candidate < 0) return false;
      if (formatType === "degree" && (candidate <= 0 || candidate >= 360)) return false;
    }
    const formatted = typeof candidate === "string" ? candidate : formatVal(candidate);
    if (!formatted || formatted.includes("NaN") || formatted.includes("Infinity")) return false;
    const key = canonicalOptionKey(formatted);
    if (!key || usedKeys.has(key)) return false;
    usedKeys.add(key);
    distractors.push(formatted);
    return true;
  };

  // 1. Prioritize realistic mistake-driven distractors
  for (const cand of mistakeCandidates) {
    if (distractors.length >= 4) break;
    tryAdd(cand);
  }

  // 2. Deterministic structured fallbacks if fewer than 4 unique mistake candidates exist
  if (distractors.length < 4) {
    if (formatType === "ratio") {
      const m = correctStr.match(/^(\d+)\s*:\s*(\d+)$/);
      const a = m ? Number(m[1]) : 2;
      const b = m ? Number(m[2]) : 3;
      const fallbacks = [
        [b, a],
        [a + 1, b],
        [a, b + 1],
        [Math.max(1, a - 1), b],
        [a, Math.max(1, b - 1)],
        [a + 2, b + 1],
        [a + 1, b + 2],
        [a + 3, b],
        [a, b + 3],
      ];
      for (const pair of fallbacks) {
        if (distractors.length >= 4) break;
        if (pair[0] > 0 && pair[1] > 0) tryAdd(pair);
      }
    } else if (formatType !== "text") {
      const base = Number(correctValue);
      const absBase = Math.abs(base);
      const step =
        formatType === "percent"
          ? absBase >= 20
            ? 2.5
            : 1.5
          : formatType === "degree"
          ? 7.2
          : absBase >= 1000
          ? 50
          : absBase >= 200
          ? 20
          : absBase >= 50
          ? 10
          : absBase >= 10
          ? 2
          : 1;

      const offsets = [step, -step, step * 2, -step * 2, step * 3, -step * 3, step * 4, step * 5];
      for (const off of offsets) {
        if (distractors.length >= 4) break;
        const val = isCleanNumber(base) && isCleanNumber(off) ? Math.round(base + off) : roundTo(base + off, decimals);
        tryAdd(val);
      }
    }
  }

  const allOpts = rng.shuffle([correctStr, ...distractors.slice(0, 4)]);
  const keys = ["A", "B", "C", "D", "E"];
  const options = {};
  let correctLetter = "A";
  for (let i = 0; i < 5; i++) {
    options[keys[i]] = allOpts[i];
    if (allOpts[i] === correctStr) {
      correctLetter = keys[i];
    }
  }

  return {
    options,
    optionsArray: allOpts,
    correct_answer: correctLetter,
    correct_answer_formatted: correctStr,
  };
}

/**
 * Standard Indian Banking Exam Data Sufficiency Option Conventions (IBPS / SBI PO).
 */
export const DATA_SUFFICIENCY_OPTIONS_2STMT = {
  A: "Statement I alone is sufficient to answer the question, while Statement II alone is not sufficient.",
  B: "Statement II alone is sufficient to answer the question, while Statement I alone is not sufficient.",
  C: "Either Statement I alone or Statement II alone is sufficient to answer the question.",
  D: "Neither Statement I nor Statement II is sufficient to answer the question.",
  E: "Both Statements I and II together are necessary to answer the question.",
};

export const DATA_SUFFICIENCY_OPTIONS_3STMT = {
  A: "Only Statement I and Statement II together are sufficient.",
  B: "Only Statement II and Statement III together are sufficient.",
  C: "Only Statement I and Statement III together are sufficient.",
  D: "All three Statements I, II and III together are necessary.",
  E: "Even all three Statements I, II and III together are not sufficient.",
};

/**
 * Question-level structural fingerprint (Section 12).
 */
export function computeQuestionFingerprint({
  diType,
  questionType,
  datasetFields,
  operation,
  calculationStructure,
  correctAnswerValue,
}) {
  const fieldsStr = Array.isArray(datasetFields) ? datasetFields.join("|") : String(datasetFields || "");
  return [
    String(diType || "").toLowerCase(),
    String(questionType || "").toLowerCase(),
    fieldsStr.toLowerCase(),
    String(operation || "").toLowerCase(),
    String(calculationStructure || "").toLowerCase(),
    String(correctAnswerValue ?? ""),
  ].join("::");
}

/**
 * Set-level structural fingerprint (Section 12).
 * Prevents structurally identical sets even if entity names or raw numbers are swapped.
 */
export function computeSetFingerprint({
  diType,
  scenarioId,
  datasetStructure,
  categoryCount,
  numericalPattern,
  chartType,
  questionTypes,
}) {
  const qCombo = Array.isArray(questionTypes) ? questionTypes.join("+") : String(questionTypes || "");
  return [
    String(diType || "").toLowerCase(),
    String(scenarioId || "").toLowerCase(),
    String(datasetStructure || "").toLowerCase(),
    String(categoryCount ?? ""),
    String(numericalPattern || "").toLowerCase(),
    String(chartType || "").toLowerCase(),
    qCombo.toLowerCase(),
  ].join("::");
}
