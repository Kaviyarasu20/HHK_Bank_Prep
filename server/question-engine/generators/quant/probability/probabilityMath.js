// Place at: server/question-engine/generators/quant/probability/probabilityMath.js

function bigAbs(x) {
  return x < 0n ? -x : x;
}

export function bigGcd(a, b) {
  a = bigAbs(a);
  b = bigAbs(b);
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

/**
 * Exact BigInt combinations C(n, r). Returns 0n if r < 0 or r > n.
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
 * Exact BigInt permutations P(n, r). Returns 0n if r < 0 or r > n.
 */
export function nPr(n, r) {
  const N = BigInt(n);
  const K = BigInt(r);
  if (K < 0n || K > N) return 0n;
  let res = 1n;
  for (let i = 0n; i < K; i++) {
    res *= N - i;
  }
  return res;
}

/**
 * Exact arbitrary-precision Rational number (BigInt numerator / denominator).
 * Guarantees simplified fractions and zero floating-point drift.
 */
export class Rational {
  constructor(num, den = 1n) {
    const n = typeof num === "bigint" ? num : BigInt(Math.round(Number(num)));
    const d = typeof den === "bigint" ? den : BigInt(Math.round(Number(den)));
    if (d === 0n) throw new Error("Rational denominator cannot be zero.");
    const sign = d < 0n ? -1n : 1n;
    const g = bigGcd(n, d);
    this.num = (n * sign) / g;
    this.den = (d * sign) / g;
  }

  static from(v) {
    return v instanceof Rational ? v : new Rational(v, 1n);
  }

  add(o) {
    const r = Rational.from(o);
    return new Rational(this.num * r.den + r.num * this.den, this.den * r.den);
  }

  sub(o) {
    const r = Rational.from(o);
    return new Rational(this.num * r.den - r.num * this.den, this.den * r.den);
  }

  mul(o) {
    const r = Rational.from(o);
    return new Rational(this.num * r.num, this.den * r.den);
  }

  div(o) {
    const r = Rational.from(o);
    if (r.num === 0n) throw new Error("Division by zero in Rational.");
    return new Rational(this.num * r.den, this.den * r.num);
  }

  pow(exp) {
    const e = BigInt(exp);
    if (e < 0n) throw new Error("Negative exponent not supported in Rational.pow.");
    return new Rational(this.num ** e, this.den ** e);
  }

  cmp(o) {
    const r = Rational.from(o);
    const diff = this.num * r.den - r.num * this.den;
    return diff < 0n ? -1 : diff > 0n ? 1 : 0;
  }

  equals(o) {
    return this.cmp(o) === 0;
  }

  isZero() {
    return this.num === 0n;
  }

  isPositive() {
    return this.num > 0n;
  }

  isNegative() {
    return this.num < 0n;
  }

  isValidProbability() {
    return this.num >= 0n && this.num <= this.den;
  }

  toNumber() {
    return Number(this.num) / Number(this.den);
  }

  toFractionString() {
    if (this.num === 0n) return "0";
    if (this.den === 1n) return `${this.num}`;
    return `${this.num}/${this.den}`;
  }
}

export const R = (n, d = 1) => new Rational(BigInt(n), BigInt(d));
export const ZERO = R(0, 1);
export const ONE = R(1, 1);

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
 * MANDATORY FIVE-OPTION (A, B, C, D, E) MCQ Builder for Probability.
 * - Uses realistic mistake-based distractors first (complement, wrong denominator,
 *   forgetting replacement, etc.).
 * - Guarantees every option is a simplified fraction in [0, 1].
 * - Guarantees 5 strictly distinct rational values (no equivalent fractions like 1/2 and 2/4).
 */
export function buildFiveProbOptions(correctRational, plausible = [], { rng } = {}) {
  const keys = ["A", "B", "C", "D", "E"];
  const correctStr = correctRational.toFractionString();
  const distractors = [];
  const seenR = [correctRational];
  const seenS = new Set([correctStr]);

  const tryAdd = (cand) => {
    if (distractors.length >= 4) return;
    if (!(cand instanceof Rational)) return;
    if (!cand.isValidProbability()) return;
    // Avoid trivial 0 or 1 distractors unless correct answer is itself 0 or 1
    if ((cand.isZero() || cand.equals(ONE)) && !correctRational.isZero() && !correctRational.equals(ONE)) {
      return;
    }
    if (cand.den > 2000n) return;
    if (seenR.some((x) => x.equals(cand))) return;
    const s = cand.toFractionString();
    if (seenS.has(s)) return;
    seenR.push(cand);
    seenS.add(s);
    distractors.push(s);
  };

  // 1. Add mistake-based plausible distractors first
  for (const c of plausible) {
    try {
      tryAdd(c);
    } catch {
      // ignore invalid distractor
    }
  }

  // 2. Add complement 1 - P(A) if distinct
  tryAdd(ONE.sub(correctRational));

  // 3. Add nearby fractions with same denominator or nearby denominator
  const baseDen = correctRational.den > 1n ? correctRational.den : 6n;
  const numOffsets = [-2n, -1n, 1n, 2n, 3n, -3n, 4n];
  for (const dNum of rng.shuffle(numOffsets)) {
    const n = correctRational.num + dNum;
    if (n > 0n && n < baseDen) {
      tryAdd(new Rational(n, baseDen));
    }
  }

  // 4. Fallback clean banking probability fractions
  const fallbacks = [
    R(1, 2), R(1, 3), R(2, 3), R(1, 4), R(3, 4),
    R(1, 5), R(2, 5), R(3, 5), R(4, 5), R(1, 6),
    R(5, 6), R(1, 8), R(3, 8), R(5, 8), R(7, 8),
    R(1, 12), R(5, 12), R(7, 12),
  ];
  for (const fb of rng.shuffle(fallbacks)) {
    tryAdd(fb);
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
    correctValue: correctStr,
  };
}