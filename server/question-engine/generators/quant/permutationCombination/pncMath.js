// Place at: server/question-engine/generators/quant/permutationCombination/pncMath.js

/**
 * Exact BigInt factorial n! (0! = 1).
 */
export function fact(n) {
  const N = BigInt(n);
  if (N < 0n) throw new Error("Factorial undefined for negative integers.");
  let res = 1n;
  for (let i = 2n; i <= N; i++) res *= i;
  return res;
}

/**
 * Exact BigInt permutation P(n, r) = n! / (n - r)!.
 */
export function nPr(n, r) {
  const N = BigInt(n);
  const R = BigInt(r);
  if (R < 0n || R > N) return 0n;
  let res = 1n;
  for (let i = 0n; i < R; i++) res *= N - i;
  return res;
}

/**
 * Exact BigInt combination C(n, r) = n! / [r!(n - r)!].
 */
export function nCr(n, r) {
  const N = BigInt(n);
  let K = BigInt(r);
  if (K < 0n || K > N) return 0n;
  if (K === 0n || K === N) return 1n;
  if (K > N - K) K = N - K;
  let res = 1n;
  for (let i = 1n; i <= K; i++) {
    res = (res * (N - K + i)) / i;
  }
  return res;
}

/**
 * Exact BigInt derangement !n using recurrence: !0 = 1, !1 = 0, !n = (n-1)(!(n-1) + !(n-2)).
 */
export function derangement(n) {
  const N = Number(n);
  if (N < 0) throw new Error("Derangement undefined for negative n.");
  if (N === 0) return 1n;
  if (N === 1) return 0n;
  let d0 = 1n;
  let d1 = 0n;
  for (let i = 2; i <= N; i++) {
    const next = BigInt(i - 1) * (d1 + d0);
    d0 = d1;
    d1 = next;
  }
  return d1;
}

/**
 * Programmatically computes exact letter frequency map from a word string.
 */
export function getLetterFrequencies(word) {
  const clean = String(word || "").toUpperCase().replace(/[^A-Z]/g, "");
  const freq = {};
  for (const ch of clean) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  return { clean, length: clean.length, freq };
}

/**
 * Multinomial coefficient: n! / (k1! * k2! * ...).
 */
export function multinomial(n, counts) {
  let num = fact(n);
  for (const c of counts) {
    num /= fact(c);
  }
  return num;
}

export const VOWEL_SET = new Set(["A", "E", "I", "O", "U"]);

/**
 * Deterministic seeded PRNG (Mulberry32) for reproducible generation.
 */
export function createRng(seed = Date.now()) {
  let a = Number(seed) >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed: Number(seed) >>> 0,
    random: next,
    randInt(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle(arr) {
      const c = [...arr];
      for (let i = c.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [c[i], c[j]] = [c[j], c[i]];
      }
      return c;
    },
  };
}

/**
 * Formats a non-negative integer count cleanly as a string (no commas so numeric parsing stays exact).
 */
export function formatCount(val) {
  return String(typeof val === "bigint" ? val : BigInt(Math.round(Number(val))));
}

/**
 * MANDATORY FIVE-OPTION (A, B, C, D, E) MCQ Builder for Permutation & Combination.
 * - Accepts BigInt or Number correct value and mistake-based plausible distractors.
 * - Guarantees 5 strictly unique non-negative integer options.
 * - Randomizes correct answer position across A–E.
 */
export function buildFivePncOptions(correctVal, plausible = [], { rng } = {}) {
  const keys = ["A", "B", "C", "D", "E"];
  const correctBig = typeof correctVal === "bigint" ? correctVal : BigInt(Math.round(Number(correctVal)));
  const correctStr = formatCount(correctBig);

  const distractors = [];
  const seen = new Set([correctStr]);

  const tryAdd = (cand) => {
    if (distractors.length >= 4) return;
    if (cand === null || cand === undefined) return;
    let b;
    try {
      b = typeof cand === "bigint" ? cand : BigInt(Math.round(Number(cand)));
    } catch {
      return;
    }
    if (b <= 0n) return;
    // Keep distractors within reasonable order of magnitude of the answer
    if (correctBig >= 10n && b > correctBig * 12n) return;
    const s = formatCount(b);
    if (seen.has(s)) return;
    seen.add(s);
    distractors.push(s);
  };

  // 1. Add mistake-based plausible distractors first
  for (const c of plausible) {
    tryAdd(c);
  }

  // 2. Add scaled proportional / factorial-adjacent offsets if fewer than 4
  const step =
    correctBig >= 10000n
      ? 120n
      : correctBig >= 1000n
      ? 60n
      : correctBig >= 200n
      ? 24n
      : correctBig >= 50n
      ? 6n
      : correctBig >= 15n
      ? 2n
      : 1n;

  const mults = [-3n, -2n, -1n, 1n, 2n, 3n, 4n, 5n];
  for (const m of rng.shuffle(mults)) {
    tryAdd(correctBig + m * step);
  }

  let k = 1n;
  while (distractors.length < 4 && k < 100n) {
    tryAdd(correctBig + k * step);
    k++;
  }

  const ordered = rng.shuffle([correctStr, ...distractors.slice(0, 4)]);
  const idx = ordered.indexOf(correctStr);

  return {
    optionsArray: ordered,
    optionsObj: {
      A: ordered[0],
      B: ordered[1],
      C: ordered[2],
      D: ordered[3],
      E: ordered[4],
    },
    correctOptionIndex: idx,
    correctKey: keys[idx],
    correctValue: Number(correctBig),
    correctValueStr: correctStr,
  };
}