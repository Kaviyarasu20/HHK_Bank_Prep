// Place at: server/question-engine/generators/quant/numberSystem/level1NumberSystem.js
import { randInt, pickRandom, shuffle, lcm } from "../../../core/mathUtils.js";

/**
 * Exact modular exponentiation (base^exp % mod) using BigInt to prevent overflow.
 */
export function modPow(base, exp, mod) {
  let result = 1n;
  let b = BigInt(base) % BigInt(mod);
  let e = BigInt(exp);
  const m = BigInt(mod);
  while (e > 0n) {
    if (e % 2n === 1n) result = (result * b) % m;
    e = e / 2n;
    b = (b * b) % m;
  }
  return Number(result);
}

/**
 * Exact prime factorization: returns Map<prime, exponent>.
 */
export function primeFactorize(n) {
  const factors = new Map();
  let rem = n;
  for (let p = 2; p * p <= rem; p++) {
    while (rem % p === 0) {
      factors.set(p, (factors.get(p) || 0) + 1);
      rem = Math.floor(rem / p);
    }
  }
  if (rem > 1) factors.set(rem, (factors.get(rem) || 0) + 1);
  return factors;
}

/**
 * Legendre's formula: highest power of prime p dividing n!.
 */
export function legendrePower(n, p) {
  let count = 0;
  let div = p;
  while (div <= n) {
    count += Math.floor(n / div);
    div *= p;
  }
  return count;
}

/**
 * Builds 5 unique non-negative integer options (or custom formatted strings).
 */
export function buildNSOptions(correctVal, { step = 1, allowZero = false, maxVal = null, padTwoDigits = false } = {}) {
  const fmt = (v) => (padTwoDigits ? String(v).padStart(2, "0") : String(v));
  const correctStr = fmt(correctVal);
  const distractors = new Set();
  const mults = [-4, -3, -2, -1, 1, 2, 3, 4, 5, 6];

  let guard = 0;
  while (distractors.size < 4 && guard < 200) {
    guard++;
    const cand = Number(correctVal) + pickRandom(mults) * step;
    const minAllowed = allowZero ? 0 : 1;
    if (cand >= minAllowed && (maxVal === null || cand <= maxVal)) {
      const s = fmt(cand);
      if (s !== correctStr) distractors.add(s);
    }
  }
  let extra = 1;
  while (distractors.size < 4) {
    const cand = Number(correctVal) + extra * step;
    const s = fmt(maxVal !== null && cand > maxVal ? Math.max(0, Number(correctVal) - extra * step) : cand);
    if (s !== correctStr) distractors.add(s);
    extra++;
  }
  const options = shuffle([correctStr, ...distractors]);
  return { options, correctOptionIndex: options.indexOf(correctStr), answer: correctStr };
}

export function makeNSQ({ exam, difficulty, level, subType, questionText, optResult, solutionSteps }) {
  return {
    questionId: `NS_${level}_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Number System",
    subType,
    level,
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText,
    options: optResult.options,
    correctOptionIndex: optResult.correctOptionIndex,
    answer: optResult.answer,
    solutionSteps,
  };
}

// ==================== LEVEL 1 – CORE PRELIMS (TYPES 1–14) ====================

// 1. Divisibility Rules (Which of the following 5-digit numbers is divisible by 9 or 11?)
export function nsL1_1Divisibility(exam, difficulty) {
  const divisor = pickRandom([9, 11, 8]);
  const mult = randInt(1200, 6500);
  const correctNum = divisor * mult;
  const distractors = new Set();
  while (distractors.size < 4) {
    const cand = correctNum + pickRandom([-5, -3, -2, -1, 1, 2, 3, 5]);
    if (cand > 0 && cand % divisor !== 0) distractors.add(String(cand));
  }
  const options = shuffle([String(correctNum), ...distractors]);
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T1_DIVISIBILITY_RULES",
    questionText: `Which of the following numbers is completely divisible by ${divisor}?`,
    optResult: { options, correctOptionIndex: options.indexOf(String(correctNum)), answer: String(correctNum) },
    solutionSteps: [
      divisor === 9
        ? `A number is divisible by 9 if the sum of its digits is divisible by 9`
        : divisor === 11
        ? `A number is divisible by 11 if the alternating sum of its digits is divisible by 11`
        : `A number is divisible by 8 if its last 3 digits form a number divisible by 8`,
      `${correctNum} ÷ ${divisor} = ${mult} (exact remainder 0)`,
    ],
  });
}

// 2. Missing Digit for Divisibility (Find * so 5-digit number is divisible by 9)
export function nsL1_2MissingDigit(exam, difficulty) {
  const d1 = randInt(2, 8), d2 = randInt(1, 8), d4 = randInt(1, 8), d5 = randInt(1, 8);
  const sumKnown = d1 + d2 + d4 + d5;
  const rem = sumKnown % 9;
  const missing = rem === 0 ? 9 : 9 - rem;
  const masked = `${d1}${d2}*${d4}${d5}`;
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T2_MISSING_DIGIT",
    questionText: `If the 5-digit number ${masked} is completely divisible by 9, what is the non-zero digit in place of '*'?`,
    optResult: buildNSOptions(missing, { step: 1, maxVal: 9 }),
    solutionSteps: [
      `Sum of known digits = ${d1} + ${d2} + ${d4} + ${d5} = ${sumKnown}`,
      `For divisibility by 9: (${sumKnown} + *) must be a multiple of 9 ⇒ * = ${missing}`,
    ],
  });
}

// 3. Basic Remainder (Dividend = Divisor × Quotient + Remainder)
export function nsL1_3BasicRemainder(exam, difficulty) {
  const divisor = randInt(13, 29);
  const quotient = randInt(12, 35);
  const rem = randInt(2, divisor - 2);
  const dividend = divisor * quotient + rem;
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T3_BASIC_REMAINDER",
    questionText: `When a number is divided by ${divisor}, it gives a quotient of ${quotient} and a remainder of ${rem}. What is the number?`,
    optResult: buildNSOptions(dividend, { step: 3 }),
    solutionSteps: [`Dividend = (${divisor} × ${quotient}) + ${rem} = ${dividend}`],
  });
}

// 4. Remainder of Arithmetic Operations
export function nsL1_4ArithmeticRemainder(exam, difficulty) {
  const d = pickRandom([7, 9, 11, 13]);
  const a = randInt(120, 450), b = randInt(120, 450), c = randInt(30, 150);
  const ans = ((a % d) * (b % d) + (c % d)) % d;
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T4_ARITHMETIC_REMAINDER",
    questionText: `What is the remainder when (${a} × ${b} + ${c}) is divided by ${d}?`,
    optResult: buildNSOptions(ans, { step: 1, allowZero: true, maxVal: d - 1 }),
    solutionSteps: [
      `${a} ≡ ${a % d}, ${b} ≡ ${b % d}, ${c} ≡ ${c % d} (mod ${d})`,
      `(${a % d} × ${b % d} + ${c % d}) mod ${d} = ${ans}`,
    ],
  });
}

// 5. Remainder of Powers
export function nsL1_5PowerRemainder(exam, difficulty) {
  const d = pickRandom([7, 9, 11, 13]);
  const base = pickRandom([d - 1, d + 1, d + 2, d - 2]);
  const exp = randInt(25, 95);
  const ans = modPow(base, exp, d);
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T5_POWER_REMAINDER",
    questionText: `Find the remainder when ${base}^${exp} is divided by ${d}.`,
    optResult: buildNSOptions(ans, { step: 1, allowZero: true, maxVal: d - 1 }),
    solutionSteps: [
      `Reduce base modulo ${d}: ${base} ≡ ${base % d} (mod ${d})`,
      `Using modular exponentiation: ${base}^${exp} ≡ ${ans} (mod ${d})`,
    ],
  });
}

// 6. Unit Digit of Product of Powers
export function nsL1_6UnitDigit(exam, difficulty) {
  const b1 = randInt(12, 89), e1 = randInt(21, 75);
  const b2 = randInt(12, 89), e2 = randInt(21, 75);
  const u1 = modPow(b1, e1, 10);
  const u2 = modPow(b2, e2, 10);
  const ans = (u1 * u2) % 10;
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T6_UNIT_DIGIT",
    questionText: `What is the unit digit of (${b1}^${e1} × ${b2}^${e2})?`,
    optResult: buildNSOptions(ans, { step: 1, allowZero: true, maxVal: 9 }),
    solutionSteps: [
      `Unit digit of ${b1}^${e1} = ${u1}; Unit digit of ${b2}^${e2} = ${u2}`,
      `Product unit digit = (${u1} × ${u2}) mod 10 = ${ans}`,
    ],
  });
}

// 7. Cyclicity (Unit digit of a single high power)
export function nsL1_7Cyclicity(exam, difficulty) {
  const base = pickRandom([23, 37, 42, 58, 63, 77, 82, 97]);
  const exp = randInt(103, 499);
  const ans = modPow(base, exp, 10);
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T7_CYCLICITY",
    questionText: `Using unit-digit cyclicity, find the unit digit of ${base}^${exp}.`,
    optResult: buildNSOptions(ans, { step: 1, allowZero: true, maxVal: 9 }),
    solutionSteps: [
      `Last digit of base is ${base % 10} (cyclicity = 4); ${exp} mod 4 = ${exp % 4 || 4}`,
      `Unit digit = (${base % 10}^${exp % 4 || 4}) mod 10 = ${ans}`,
    ],
  });
}

// 8. Prime Factorisation (Total prime factors counted with multiplicity)
export function nsL1_8PrimeFactorisation(exam, difficulty) {
  const a = randInt(2, 5), b = randInt(1, 3), c = randInt(1, 2);
  const n = Math.pow(2, a) * Math.pow(3, b) * Math.pow(5, c);
  const totalPrimeFactors = a + b + c;
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T8_PRIME_FACTORISATION",
    questionText: `Find the total number of prime factors (counting multiplicity) in the prime factorisation of ${n}.`,
    optResult: buildNSOptions(totalPrimeFactors, { step: 1 }),
    solutionSteps: [
      `${n} = 2^${a} × 3^${b} × 5^${c}`,
      `Total prime factors = ${a} + ${b} + ${c} = ${totalPrimeFactors}`,
    ],
  });
}

// 9. Number of Factors
export function nsL1_9NumberOfFactors(exam, difficulty) {
  const a = randInt(2, 4), b = randInt(1, 3), c = randInt(1, 2);
  const n = Math.pow(2, a) * Math.pow(3, b) * Math.pow(5, c);
  const count = (a + 1) * (b + 1) * (c + 1);
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T9_NUMBER_OF_FACTORS",
    questionText: `How many positive factors (divisors) does the number ${n} have?`,
    optResult: buildNSOptions(count, { step: 2 }),
    solutionSteps: [
      `${n} = 2^${a} × 3^${b} × 5^${c}`,
      `Number of factors = (${a}+1)(${b}+1)(${c}+1) = ${count}`,
    ],
  });
}

// 10. Sum of Factors
export function nsL1_10SumOfFactors(exam, difficulty) {
  const a = randInt(1, 3), b = randInt(1, 2), c = randInt(0, 1);
  const n = Math.pow(2, a) * Math.pow(3, b) * Math.pow(5, c);
  const sumA = Math.pow(2, a + 1) - 1;
  const sumB = (Math.pow(3, b + 1) - 1) / 2;
  const sumC = c === 1 ? 6 : 1;
  const totalSum = sumA * sumB * sumC;
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T10_SUM_OF_FACTORS",
    questionText: `Find the sum of all positive factors of ${n}.`,
    optResult: buildNSOptions(totalSum, { step: 6 }),
    solutionSteps: [
      `${n} = 2^${a} × 3^${b}${c ? " × 5^1" : ""}`,
      `Sum of factors = ${sumA} × ${sumB}${c ? " × 6" : ""} = ${totalSum}`,
    ],
  });
}

// 11. HCF
export function nsL1_11HCF(exam, difficulty) {
  const h = randInt(6, 24);
  const m1 = 2, m2 = 3, m3 = 5;
  const n1 = h * m1, n2 = h * m2, n3 = h * m3;
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T11_HCF",
    questionText: `Find the Highest Common Factor (HCF) of ${n1}, ${n2}, and ${n3}.`,
    optResult: buildNSOptions(h, { step: 2 }),
    solutionSteps: [`HCF(${n1}, ${n2}, ${n3}) = ${h} (since 2, 3, and 5 are pairwise co-prime)`],
  });
}

// 12. LCM
export function nsL1_12LCM(exam, difficulty) {
  const a = pickRandom([12, 15, 18, 24]);
  const b = pickRandom([20, 30, 36, 40]);
  const c = pickRandom([16, 25, 45, 48]);
  const ans = lcm(lcm(a, b), c);
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T12_LCM",
    questionText: `Find the Least Common Multiple (LCM) of ${a}, ${b}, and ${c}.`,
    optResult: buildNSOptions(ans, { step: 12 }),
    solutionSteps: [`LCM(${a}, ${b}) = ${lcm(a, b)}`, `LCM(${lcm(a, b)}, ${c}) = ${ans}`],
  });
}

// 13. Trailing Zeros in N!
export function nsL1_13TrailingZeros(exam, difficulty) {
  const n = randInt(45, 250);
  const zeros = legendrePower(n, 5);
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T13_TRAILING_ZEROS",
    questionText: `How many trailing zeros are there at the end of ${n}! (factorial)?`,
    optResult: buildNSOptions(zeros, { step: 1 }),
    solutionSteps: [
      `Count factors of 5 using Legendre's formula: ⌊${n}/5⌋ + ⌊${n}/25⌋ + ⌊${n}/125⌋`,
      `Total trailing zeros = ${zeros}`,
    ],
  });
}

// 14. Highest Power of Prime in N!
export function nsL1_14HighestPowerFactorial(exam, difficulty) {
  const p = pickRandom([2, 3, 5, 7]);
  const n = randInt(40, 150);
  const ans = legendrePower(n, p);
  return makeNSQ({
    exam, difficulty, level: "L1", subType: "L1_T14_HIGHEST_POWER_FACTORIAL",
    questionText: `Find the highest power of ${p} that completely divides ${n}!.`,
    optResult: buildNSOptions(ans, { step: 2 }),
    solutionSteps: [
      `Using Legendre's formula for prime ${p} in ${n}!`,
      `Highest power of ${p} = ${ans}`,
    ],
  });
}

export const LEVEL1_NS_MAP = {
  1: nsL1_1Divisibility,
  2: nsL1_2MissingDigit,
  3: nsL1_3BasicRemainder,
  4: nsL1_4ArithmeticRemainder,
  5: nsL1_5PowerRemainder,
  6: nsL1_6UnitDigit,
  7: nsL1_7Cyclicity,
  8: nsL1_8PrimeFactorisation,
  9: nsL1_9NumberOfFactors,
  10: nsL1_10SumOfFactors,
  11: nsL1_11HCF,
  12: nsL1_12LCM,
  13: nsL1_13TrailingZeros,
  14: nsL1_14HighestPowerFactorial,
};