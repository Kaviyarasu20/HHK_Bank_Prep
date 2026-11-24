// generators/quant/numberSeries/types/seriesPatterns.js
import { randInt } from "../../../../core/mathUtils.js";
import { NUMBER_SERIES_PROFILES } from "../../../../config/difficultyProfiles.js";

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];

/**
 * Type 1: Arithmetic Increasing Difference (+d, +2d, +3d, +4d, +5d)
 */
export function buildType1APDiff(difficulty = "MEDIUM") {
  const cfg = NUMBER_SERIES_PROFILES[difficulty];
  const d = randInt(...cfg.diffStepRange);
  let curr = randInt(...cfg.startRange);
  const terms = [curr];
  const diffs = [];
  for (let i = 1; i <= 5; i++) {
    const step = i * d;
    diffs.push(`+${step}`);
    curr += step;
    terms.push(curr);
  }
  return {
    subType: "TYPE_1_AP_DIFFERENCE",
    terms,
    ruleSummary: `Consecutive differences are multiples of ${d}: ${diffs.join(", ")}`,
  };
}

/**
 * Type 2: Double Difference (2nd-order constant difference)
 */
export function buildType2DoubleDiff(difficulty = "MEDIUM") {
  const cfg = NUMBER_SERIES_PROFILES[difficulty];
  const d1 = randInt(...cfg.doubleDiffStart);
  const step2 = randInt(...cfg.doubleDiffStep);
  let curr = randInt(...cfg.startRange);
  const terms = [curr];
  const diffs = [];
  for (let i = 0; i < 5; i++) {
    const diff = d1 + i * step2;
    diffs.push(`+${diff}`);
    curr += diff;
    terms.push(curr);
  }
  return {
    subType: "TYPE_2_DOUBLE_DIFFERENCE",
    terms,
    ruleSummary: `First differences (${diffs.join(", ")}) increase by a constant +${step2} at each step`,
  };
}

/**
 * Type 3: Squares / Cubes Difference (+1², +2², +3²... or +1³, +2³...)
 */
export function buildType3SquaresCubesDiff(difficulty = "MEDIUM") {
  const cfg = NUMBER_SERIES_PROFILES[difficulty];
  let curr = randInt(...cfg.startRange);
  const terms = [curr];
  const useCubes = difficulty === "HARD" && Math.random() < 0.5;
  const startBase = difficulty === "EASY" ? 1 : randInt(1, 3);
  const diffs = [];

  for (let i = 0; i < 5; i++) {
    const n = startBase + i;
    const val = useCubes ? n * n * n : n * n;
    diffs.push(useCubes ? `+${n}³ (+${val})` : `+${n}² (+${val})`);
    curr += val;
    terms.push(curr);
  }

  return {
    subType: "TYPE_3_SQUARES_CUBES_DIFF",
    terms,
    ruleSummary: `Differences are consecutive ${useCubes ? "cubes" : "squares"}: ${diffs.join(", ")}`,
  };
}

/**
 * Type 4: Constant Multiplier + Offset (× m ± k)
 */
export function buildType4MultAddConst(difficulty = "MEDIUM") {
  const cfg = NUMBER_SERIES_PROFILES[difficulty];
  const m = randInt(...cfg.multRange);
  const k = randInt(...cfg.offsetRange);
  const useMinus = difficulty !== "EASY" && Math.random() < 0.4;
  let curr = randInt(useMinus ? k + 3 : 2, useMinus ? k + 12 : 12);
  const terms = [curr];

  for (let i = 0; i < 5; i++) {
    curr = useMinus ? curr * m - k : curr * m + k;
    terms.push(curr);
  }

  const signStr = useMinus ? `- ${k}` : `+ ${k}`;
  return {
    subType: "TYPE_4_MULT_ADD_CONST",
    terms,
    ruleSummary: `Each term follows (previous term × ${m} ${signStr})`,
  };
}

/**
 * Type 5: Progressive Multiplier (×1 + k, ×2 + k, ×3 + k, ×4 + k, ×5 + k)
 */
export function buildType5MultIncreasing(difficulty = "MEDIUM") {
  const cfg = NUMBER_SERIES_PROFILES[difficulty];
  const k = randInt(1, cfg.offsetRange[1]);
  const addSelf = difficulty !== "EASY" && Math.random() < 0.5;
  let curr = randInt(2, 9);
  const terms = [curr];
  const steps = [];

  for (let i = 1; i <= 5; i++) {
    const offset = addSelf ? i : k;
    curr = curr * i + offset;
    steps.push(`×${i} + ${offset}`);
    terms.push(curr);
  }

  return {
    subType: "TYPE_5_MULT_INCREASING",
    terms,
    ruleSummary: `Operations follow progressive pattern: ${steps.join(", ")}`,
  };
}

/**
 * Type 6: Half / Decimal Multiplier (×0.5 + 0.5, ×1 + 1, ×1.5 + 1.5, ×2 + 2, ×2.5 + 2.5)
 * Constructed with exact multiples of 2/4 so all terms stay clean integers!
 */
export function buildType6DecimalHalfMult(difficulty = "MEDIUM") {
  const startMult = difficulty === "EASY" ? 4 : 2;
  let curr = randInt(2, 8) * startMult;
  const terms = [curr];

  if (difficulty === "EASY") {
    // Pure ×0.5, ×1, ×1.5, ×2, ×2.5 (starting with multiple of 4 guarantees integers for 5 steps)
    const mults = [0.5, 1, 1.5, 2, 2.5];
    for (const m of mults) {
      curr = curr * m;
      terms.push(curr);
    }
    return {
      subType: "TYPE_6_DECIMAL_HALF_MULT",
      terms,
      ruleSummary: `Multipliers increase by +0.5 at each step: ×0.5, ×1, ×1.5, ×2, ×2.5`,
    };
  }

  // ×0.5 + 1, ×1 + 2, ×1.5 + 3, ×2 + 4, ×2.5 + 5 (guarantee integer at ×1.5 by picking even after +2)
  // Using ×0.5 + 0.5 is cleaner if start is odd, or ×0.5 + 1 if start is multiple of 4:
  // Let start = 4k: step1 = 2k + 1 (odd) -> step2 (*1 + 1) = 2k + 2 (even!) -> step3 (*1.5 + 1.5)? Wait:
  // Instead: start = 8k + 4 (even).
  // Use exact integer-preserving formula: ×0.5 + 1, ×1 + 1, ×1.5 + 1.5? No, let's test:
  // Start = 4*m + 2 -> *0.5 = 2m+1, +1 = 2m+2 (even!). *1 + 2 = 2m+4 (even!). *1.5 = 3m+6 (int!), +3 = 3m+9.
  // If m is odd (m = 2p+1): 3(2p+1)+9 = 6p+12 (even!). *2 + 4 = 12p+28 (even!). *2.5 = 30p+70 (int!), +5 = 30p+75.
  const p = randInt(1, 5);
  const m = 2 * p + 1;
  curr = 4 * m + 2;
  const seq = [curr];
  const ops = [
    [0.5, 1],
    [1, 2],
    [1.5, 3],
    [2, 4],
    [2.5, 5],
  ];
  for (const [mult, add] of ops) {
    curr = Math.round((curr * mult + add) * 100) / 100;
    seq.push(curr);
  }

  return {
    subType: "TYPE_6_DECIMAL_HALF_MULT",
    terms: seq,
    ruleSummary: `Pattern: ×0.5 + 1, ×1 + 2, ×1.5 + 3, ×2 + 4, ×2.5 + 5`,
  };
}

/**
 * Type 7: Alternating Operations (+a, -b, +2a, -2b, +3a)
 */
export function buildType7Alternating(difficulty = "MEDIUM") {
  const cfg = NUMBER_SERIES_PROFILES[difficulty];
  const a = randInt(cfg.diffStepRange[0] + 4, cfg.diffStepRange[1] + 8);
  const b = randInt(2, a - 2);
  let curr = randInt(cfg.startRange[0] + 15, cfg.startRange[1] + 35);
  const terms = [curr];
  const ops = [`+${a}`, `-${b}`, `+${2 * a}`, `-${2 * b}`, `+${3 * a}`];
  const deltas = [a, -b, 2 * a, -2 * b, 3 * a];

  for (const d of deltas) {
    curr += d;
    terms.push(curr);
  }

  return {
    subType: "TYPE_7_ALTERNATING_SERIES",
    terms,
    ruleSummary: `Alternating addition & subtraction: ${ops.join(", ")}`,
  };
}

/**
 * Type 8: Prime Number Differences (+p1, +p2, +p3, +p4, +p5)
 */
export function buildType8PrimeDiff(difficulty = "MEDIUM") {
  const cfg = NUMBER_SERIES_PROFILES[difficulty];
  const startIdx = difficulty === "EASY" ? 0 : randInt(1, 5);
  let curr = randInt(...cfg.startRange);
  const terms = [curr];
  const diffs = [];

  for (let i = 0; i < 5; i++) {
    const p = PRIMES[startIdx + i];
    diffs.push(`+${p}`);
    curr += p;
    terms.push(curr);
  }

  return {
    subType: "TYPE_8_PRIME_DIFF",
    terms,
    ruleSummary: `Differences are consecutive prime numbers: ${diffs.join(", ")}`,
  };
}

export const SERIES_PATTERN_BUILDERS = {
  1: buildType1APDiff,
  2: buildType2DoubleDiff,
  3: buildType3SquaresCubesDiff,
  4: buildType4MultAddConst,
  5: buildType5MultIncreasing,
  6: buildType6DecimalHalfMult,
  7: buildType7Alternating,
  8: buildType8PrimeDiff,
};
