// server/question-engine/generators/quant/pipesCisterns/rational.js

function bigAbs(x) {
  return x < 0n ? -x : x;
}

export function bigGcd(a, b) {
  a = bigAbs(a);
  b = bigAbs(b);
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a === 0n ? 1n : a;
}

export function bigLcm(a, b) {
  if (a === 0n || b === 0n) return 0n;
  return bigAbs(a * b) / bigGcd(a, b);
}

/**
 * Exact arbitrary-precision Rational number (BigInt numerator / denominator).
 * Eliminates all IEEE-754 floating-point drift.
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

  static from(val) {
    if (val instanceof Rational) return val;
    if (typeof val === "string" && val.includes("/")) {
      const [n, d] = val.split("/").map((x) => BigInt(x.trim()));
      return new Rational(n, d);
    }
    return new Rational(val, 1n);
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

  neg() {
    return new Rational(-this.num, this.den);
  }

  abs() {
    return new Rational(bigAbs(this.num), this.den);
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

  isInteger() {
    return this.den === 1n;
  }

  toNumber() {
    return Number(this.num) / Number(this.den);
  }

  /**
   * Exam-friendly string: "12", "3/4", or "4 2/3" (or clean decimal if terminating with den in {2,4,5,8,10,20,25}).
   */
  toExamString(preferMixed = true) {
    if (this.den === 1n) return `${this.num}`;
    if (!preferMixed) return `${this.num}/${this.den}`;
    const whole = this.num / this.den; // BigInt truncates toward 0
    const rem = bigAbs(this.num % this.den);
    if (whole === 0n) return `${this.num}/${this.den}`;
    return `${whole} ${rem}/${this.den}`;
  }

  toFractionString() {
    return this.den === 1n ? `${this.num}` : `${this.num}/${this.den}`;
  }

  toDecimalString(places = 2) {
    return this.toNumber().toFixed(places);
  }
}

export const ZERO = new Rational(0n, 1n);
export const ONE = new Rational(1n, 1n);

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
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

/**
 * Formats a Rational value with consistent unit for MCQ options.
 */
export function formatValueWithUnit(rationalVal, unit = "hours", { preferMixed = true } = {}) {
  const valStr = rationalVal.toExamString(preferMixed);
  if (!unit) return valStr;
  if (unit === "hours" && valStr === "1") return "1 hour";
  return `${valStr} ${unit}`;
}

/**
 * Builds exactly 4 unique MCQ options (A, B, C, D) using plausible mathematical mistake
 * distractors first, then clean rational offsets if needed.
 * Guarantees NO distractor equals the correct Rational value.
 */
export function buildPlausibleOptions(
  correctRational,
  plausibleCandidates = [],
  { unit = "hours", preferMixed = true, rng, maxFraction = false } = {}
) {
  const correctStr = formatValueWithUnit(correctRational, unit, { preferMixed });
  const distractors = [];
  const seenRationals = [correctRational];
  const seenStrings = new Set([correctStr]);

  const tryAdd = (cand) => {
    if (distractors.length >= 3) return;
    if (!(cand instanceof Rational)) return;
    if (!cand.isPositive()) return;
    if (maxFraction && cand.cmp(ONE) >= 0) return;
    if (seenRationals.some((r) => r.equals(cand))) return;
    // Reject overly ugly denominators in distractors
    if (cand.den > 60n) return;
    const str = formatValueWithUnit(cand, unit, { preferMixed });
    if (seenStrings.has(str)) return;
    seenRationals.push(cand);
    seenStrings.add(str);
    distractors.push(str);
  };

  for (const cand of plausibleCandidates) {
    try {
      tryAdd(cand);
    } catch {
      // ignore invalid candidate
    }
  }

  // Fallback offsets in exact rational space
  const offsets = maxFraction
    ? [
        new Rational(1n, 12n), new Rational(-1n, 12n),
        new Rational(1n, 6n), new Rational(-1n, 6n),
        new Rational(1n, 8n), new Rational(-1n, 8n),
        new Rational(1n, 10n), new Rational(1n, 5n),
      ]
    : [
        new Rational(1n, 1n), new Rational(-1n, 1n),
        new Rational(2n, 1n), new Rational(-2n, 1n),
        new Rational(3n, 1n), new Rational(-3n, 1n),
        new Rational(1n, 2n), new Rational(-1n, 2n),
        new Rational(4n, 1n), new Rational(5n, 1n),
      ];

  for (const off of rng.shuffle(offsets)) {
    tryAdd(correctRational.add(off));
  }

  let step = 1n;
  while (distractors.length < 3 && step < 50n) {
    const delta = maxFraction ? new Rational(step, 24n) : new Rational(step, 1n);
    tryAdd(correctRational.add(delta));
    step += 1n;
  }

  const allOptions = rng.shuffle([correctStr, ...distractors.slice(0, 3)]);
  const correctOptionIndex = allOptions.indexOf(correctStr);

  return {
    options: allOptions,
    correctOptionIndex,
    correctAnswer: allOptions[correctOptionIndex],
    correctValue: correctRational.toExamString(preferMixed),
  };
}