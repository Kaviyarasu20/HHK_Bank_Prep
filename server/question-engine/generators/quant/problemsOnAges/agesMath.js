// Place at: server/question-engine/generators/quant/problemsOnAges/agesMath.js

function bigAbs(x) {
  return x < 0n ? -x : x;
}

export function bigGcd(a, b) {
  a = bigAbs(a);
  b = bigAbs(b);
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

export function bigGcdMany(values) {
  return values.reduce((acc, v) => bigGcd(acc, v), 0n) || 1n;
}

/**
 * Exact BigInt Rational arithmetic for zero floating-point drift in age equations.
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

  isPositive() {
    return this.num > 0n;
  }

  isNegative() {
    return this.num < 0n;
  }

  isZero() {
    return this.num === 0n;
  }

  toNumber() {
    return Number(this.num) / Number(this.den);
  }

  toFractionString() {
    return this.den === 1n ? `${this.num}` : `${this.num}/${this.den}`;
  }

  toExamString() {
    if (this.den === 1n) return `${this.num}`;
    if (100n % this.den === 0n) {
      const scaled = (this.num * 100n) / this.den;
      return String(Number(scaled) / 100);
    }
    const whole = this.num / this.den;
    const rem = bigAbs(this.num % this.den);
    if (whole === 0n) return `${this.num}/${this.den}`;
    return `${whole} ${rem}/${this.den}`;
  }
}

export const R = (n, d = 1) => new Rational(BigInt(n), BigInt(d));
export const ZERO = R(0);

/**
 * Reduces an array of positive integer values into a canonical ratio string ("p : q" or "p : q : r").
 */
export function reduceMultiRatio(values) {
  const bigs = values.map((v) => (typeof v === "bigint" ? v : BigInt(Math.round(Number(v)))));
  const g = bigGcdMany(bigs);
  const parts = bigs.map((v) => v / g);
  return {
    parts: parts.map(Number),
    str: parts.map(String).join(" : "),
  };
}

/**
 * Formats an age/year value with consistent units.
 */
export function formatAgeValue(rationalVal, unit = "years") {
  const valStr = rationalVal.toExamString();
  if (!unit) return valStr;
  if (unit === "years" && valStr === "1") return "1 year";
  return `${valStr} ${unit}`;
}

/**
 * Deterministic seeded PRNG (Mulberry32).
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
 * MANDATORY FIVE-OPTION (A, B, C, D, E) MCQ Builder for Problems on Ages.
 * Uses realistic mistake-based distractors first, then clean integer/rational offsets.
 */
export function buildFiveAgeOptions(
  correctRational,
  plausible = [],
  { unit = "years", rng, ratioFormat = null, maxVal = 120 } = {}
) {
  const keys = ["A", "B", "C", "D", "E"];

  if (ratioFormat) {
    const correctStr = ratioFormat.correct;
    const distractors = [];
    const seen = new Set([correctStr]);

    for (const d of ratioFormat.distractors) {
      if (distractors.length < 4 && d && !seen.has(d)) {
        seen.add(d);
        distractors.push(d);
      }
    }

    const baseParts = ratioFormat.parts;
    let step = 1;
    while (distractors.length < 4 && step < 40) {
      const mod = [...baseParts];
      mod[step % mod.length] = Math.max(1, mod[step % mod.length] + (step % 2 === 0 ? 1 : 2));
      const cand = reduceMultiRatio(mod).str;
      if (!seen.has(cand)) {
        seen.add(cand);
        distractors.push(cand);
      }
      step++;
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

  const correctStr = formatAgeValue(correctRational, unit);
  const distractors = [];
  const seenR = [correctRational];
  const seenS = new Set([correctStr]);

  const tryAdd = (cand) => {
    if (distractors.length >= 4) return;
    if (!(cand instanceof Rational) || !cand.isPositive() || cand.den > 10n) return;
    if (maxVal !== null && cand.cmp(R(maxVal)) > 0) return;
    if (seenR.some((x) => x.equals(cand))) return;
    const s = formatAgeValue(cand, unit);
    if (seenS.has(s)) return;
    seenR.push(cand);
    seenS.add(s);
    distractors.push(s);
  };

  for (const c of plausible) {
    try {
      tryAdd(c);
    } catch {
      // ignore invalid distractor
    }
  }

  const baseNum = correctRational.toNumber();
  const stepUnit = baseNum >= 60 ? 3n : baseNum >= 25 ? 2n : 1n;
  const offsets = [
    new Rational(stepUnit, 1n),
    new Rational(-stepUnit, 1n),
    new Rational(stepUnit * 2n, 1n),
    new Rational(-stepUnit * 2n, 1n),
    new Rational(stepUnit * 3n, 1n),
    new Rational(-stepUnit * 3n, 1n),
    new Rational(stepUnit * 4n, 1n),
  ];

  for (const off of rng.shuffle(offsets)) {
    tryAdd(correctRational.add(off));
  }

  let k = 1n;
  while (distractors.length < 4 && k < 50n) {
    tryAdd(correctRational.add(new Rational(k, 1n)));
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
    correctValue: correctStr,
  };
}