// Place at: server/question-engine/generators/quant/numberSystem/level2And3NumberSystem.js
import { randInt, pickRandom, lcm } from "../../../core/mathUtils.js";
import {
  modPow,
  primeFactorize,
  legendrePower,
  buildNSOptions,
  makeNSQ,
} from "./level1NumberSystem.js";

// ==================== LEVEL 2 – STRONG VALIDATION (TYPES 15–24) ====================

// 15. Last Two Digits
export function nsL2_15LastTwoDigits(exam, difficulty) {
  const base = pickRandom([21, 31, 41, 61, 71, 23, 37, 43, 67, 73]);
  const exp = randInt(24, 96);
  const ans = modPow(base, exp, 100);
  return makeNSQ({
    exam, difficulty, level: "L2", subType: "L2_T15_LAST_TWO_DIGITS",
    questionText: `Find the last two digits of ${base}^${exp}.`,
    optResult: buildNSOptions(ans, { step: 2, allowZero: true, maxVal: 99, padTwoDigits: true }),
    solutionSteps: [
      `Compute ${base}^${exp} (mod 100) via modular exponentiation`,
      `Last two digits = ${String(ans).padStart(2, "0")}`,
    ],
  });
}

// 16. Advanced Remainder ((a^n + b^m) mod d)
export function nsL2_16AdvancedRemainder(exam, difficulty) {
  const d = pickRandom([7, 11, 13, 17]);
  const a = randInt(d + 2, d * 3);
  const b = randInt(d + 1, d * 2);
  const n = randInt(31, 89), m = randInt(25, 79);
  const r1 = modPow(a, n, d), r2 = modPow(b, m, d);
  const ans = (r1 + r2) % d;
  return makeNSQ({
    exam, difficulty, level: "L2", subType: "L2_T16_ADVANCED_REMAINDER",
    questionText: `Find the remainder when (${a}^${n} + ${b}^${m}) is divided by ${d}.`,
    optResult: buildNSOptions(ans, { step: 1, allowZero: true, maxVal: d - 1 }),
    solutionSteps: [
      `${a}^${n} ≡ ${r1} (mod ${d}) and ${b}^${m} ≡ ${r2} (mod ${d})`,
      `Combined remainder = (${r1} + ${r2}) mod ${d} = ${ans}`,
    ],
  });
}

// 17. Product of Factors (Product of all factors of N equals N^k — find k)
export function nsL2_17ProductOfFactors(exam, difficulty) {
  const a = pickRandom([1, 3]), b = randInt(1, 3);
  const n = Math.pow(2, a) * Math.pow(3, b);
  const numFactors = (a + 1) * (b + 1); // Always even since a+1 is even
  const k = numFactors / 2;
  return makeNSQ({
    exam, difficulty, level: "L2", subType: "L2_T17_PRODUCT_OF_FACTORS",
    questionText: `If the product of all positive factors of ${n} is expressed as ${n}^k, what is the value of k?`,
    optResult: buildNSOptions(k, { step: 1 }),
    solutionSteps: [
      `Number of factors τ(${n}) = (${a}+1)(${b}+1) = ${numFactors}`,
      `Product of all factors = N^(τ(N)/2) ⇒ k = ${numFactors} / 2 = ${k}`,
    ],
  });
}

// 18. Odd / Even Factors
export function nsL2_18OddEvenFactors(exam, difficulty) {
  const a = randInt(2, 4), b = randInt(1, 3), c = randInt(1, 2);
  const n = Math.pow(2, a) * Math.pow(3, b) * Math.pow(5, c);
  const askEven = Math.random() < 0.5;
  const oddCount = (b + 1) * (c + 1);
  const evenCount = a * oddCount;
  const ans = askEven ? evenCount : oddCount;
  return makeNSQ({
    exam, difficulty, level: "L2", subType: "L2_T18_ODD_EVEN_FACTORS",
    questionText: `How many ${askEven ? "even" : "odd"} positive factors does ${n} have?`,
    optResult: buildNSOptions(ans, { step: 2 }),
    solutionSteps: [
      `${n} = 2^${a} × 3^${b} × 5^${c}`,
      askEven
        ? `Even factors = ${a} × (${b}+1) × (${c}+1) = ${evenCount}`
        : `Odd factors = (${b}+1) × (${c}+1) = ${oddCount}`,
    ],
  });
}

// 19. Factor Count with Conditions (Factors of N that are multiples of k)
export function nsL2_19ConditionalFactors(exam, difficulty) {
  const a = randInt(3, 5), b = randInt(2, 3), c = randInt(1, 2);
  const n = Math.pow(2, a) * Math.pow(3, b) * Math.pow(5, c);
  const k = 12; // 2^2 * 3^1 -> guaranteed divisor of N
  const ans = (a - 2 + 1) * (b - 1 + 1) * (c + 1);
  return makeNSQ({
    exam, difficulty, level: "L2", subType: "L2_T19_CONDITIONAL_FACTORS",
    questionText: `How many positive factors of ${n} are completely divisible by ${k}?`,
    optResult: buildNSOptions(ans, { step: 2 }),
    solutionSteps: [
      `${n} / ${k} = ${n / k} = 2^${a - 2} × 3^${b - 1} × 5^${c}`,
      `Factors divisible by ${k} = τ(${n / k}) = (${a - 1})(${b})(${c + 1}) = ${ans}`,
    ],
  });
}

// 20. Factorial Divisibility (Highest power of composite 12 = 2² × 3 in N!)
export function nsL2_20FactorialDivisibility(exam, difficulty) {
  const n = randInt(40, 120);
  const p2 = legendrePower(n, 2);
  const p3 = legendrePower(n, 3);
  const ans = Math.min(Math.floor(p2 / 2), p3);
  return makeNSQ({
    exam, difficulty, level: "L2", subType: "L2_T20_FACTORIAL_DIVISIBILITY",
    questionText: `Find the highest power of 12 that completely divides ${n}!.`,
    optResult: buildNSOptions(ans, { step: 2 }),
    solutionSteps: [
      `12 = 2² × 3. Power of 2 in ${n}! = ${p2} (so 2² appears ${Math.floor(p2 / 2)} times)`,
      `Power of 3 in ${n}! = ${p3} ⇒ Highest power of 12 = min(${Math.floor(p2 / 2)}, ${p3}) = ${ans}`,
    ],
  });
}

// 21. Perfect Square / Cube Conditions (Smallest multiplier to make N a perfect square)
export function nsL2_21PerfectSquareCond(exam, difficulty) {
  const sqPart = Math.pow(randInt(2, 6), 2);
  const oddPrimes = pickRandom([[2, 3], [2, 5], [3, 5], [2, 7], [3, 7]]);
  const mult = oddPrimes[0] * oddPrimes[1];
  const n = sqPart * mult;
  return makeNSQ({
    exam, difficulty, level: "L2", subType: "L2_T21_PERFECT_SQUARE_COND",
    questionText: `What is the smallest positive integer by which ${n} must be multiplied so that the product becomes a perfect square?`,
    optResult: buildNSOptions(mult, { step: 1 }),
    solutionSteps: [
      `Prime factorisation of ${n} leaves unpaired primes ${oddPrimes[0]} and ${oddPrimes[1]}`,
      `Smallest multiplier = ${oddPrimes[0]} × ${oddPrimes[1]} = ${mult}`,
    ],
  });
}

// 22. Consecutive Numbers (Sum of 5 consecutive odd/even numbers)
export function nsL2_22ConsecutiveNumbers(exam, difficulty) {
  const isOdd = Math.random() < 0.5;
  const mid = randInt(12, 45) * 2 + (isOdd ? 1 : 0);
  const sum = 5 * mid;
  const largest = mid + 4;
  return makeNSQ({
    exam, difficulty, level: "L2", subType: "L2_T22_CONSECUTIVE_NUMBERS",
    questionText: `The sum of 5 consecutive ${isOdd ? "odd" : "even"} numbers is ${sum}. What is the largest of these 5 numbers?`,
    optResult: buildNSOptions(largest, { step: 2 }),
    solutionSteps: [
      `Middle (3rd) number = ${sum} / 5 = ${mid}`,
      `Largest (5th) number = ${mid} + 4 = ${largest}`,
    ],
  });
}

// 23. Co-Prime Numbers (Euler's Totient φ(N))
export function nsL2_23CoPrimeTotient(exam, difficulty) {
  const pairs = [
    [36, 12], [45, 24], [60, 16], [72, 24], [80, 32], [90, 24], [100, 40], [120, 32],
  ];
  const [n, phi] = pickRandom(pairs);
  const factors = [...primeFactorize(n).keys()];
  return makeNSQ({
    exam, difficulty, level: "L2", subType: "L2_T23_COPRIME_TOTIENT",
    questionText: `How many positive integers less than ${n} are co-prime to ${n}?`,
    optResult: buildNSOptions(phi, { step: 2 }),
    solutionSteps: [
      `Distinct prime factors of ${n}: ${factors.join(", ")}`,
      `Using Euler's Totient φ(${n}) = ${n} × ${factors.map((p) => `(1 - 1/${p})`).join(" × ")} = ${phi}`,
    ],
  });
}

// 24. Number Formation (2-digit number reversed)
export function nsL2_24NumberFormation(exam, difficulty) {
  const tens = randInt(5, 9);
  const units = randInt(1, tens - 2);
  const num = 10 * tens + units;
  const rev = 10 * units + tens;
  const diff = num - rev;
  const digitSum = tens + units;
  return makeNSQ({
    exam, difficulty, level: "L2", subType: "L2_T24_NUMBER_FORMATION",
    questionText: `The sum of the digits of a two-digit number is ${digitSum}. When its digits are reversed, the number decreases by ${diff}. What is the original two-digit number?`,
    optResult: buildNSOptions(num, { step: 2 }),
    solutionSteps: [
      `9(a - b) = ${diff} ⇒ a - b = ${tens - units}; also a + b = ${digitSum}`,
      `Solving gives a = ${tens}, b = ${units} ⇒ Number = ${num}`,
    ],
  });
}

// ==================== LEVEL 3 – ADVANCED MAINS (TYPES 25–29) ====================

// 25. Multiple Remainder Conditions (Same remainder r when divided by a, b, c)
export function nsL3_25MultipleRemainders(exam, difficulty) {
  const sets = [
    [12, 15, 20], [10, 15, 25], [12, 18, 24], [15, 20, 30], [14, 21, 28],
  ];
  const [a, b, c] = pickRandom(sets);
  const r = randInt(3, Math.min(a, b, c) - 2);
  const L = lcm(lcm(a, b), c);
  const ans = L + r;
  return makeNSQ({
    exam, difficulty, level: "L3", subType: "L3_T25_MULTIPLE_REMAINDERS",
    questionText: `Find the smallest positive number greater than ${c} that leaves a remainder of ${r} when divided by ${a}, ${b}, and ${c}.`,
    optResult: buildNSOptions(ans, { step: 4 }),
    solutionSteps: [
      `LCM(${a}, ${b}, ${c}) = ${L}`,
      `Required smallest number = ${L} + ${r} = ${ans}`,
    ],
  });
}

// 26. Chinese Remainder-Type Problems (Exact verified solution)
export function nsL3_26ChineseRemainder(exam, difficulty) {
  const coprimePairs = [[5, 7], [7, 9], [5, 8], [7, 11], [8, 9], [9, 11]];
  const [m1, m2] = pickRandom(coprimePairs);
  const target = randInt(Math.max(m1, m2) + 1, m1 * m2 - 1);
  const r1 = target % m1;
  const r2 = target % m2;
  // Verify uniqueness: smallest positive integer in [1, m1*m2] matching both congruences
  let verified = 1;
  while (verified <= m1 * m2 && !(verified % m1 === r1 && verified % m2 === r2)) {
    verified++;
  }
  return makeNSQ({
    exam, difficulty, level: "L3", subType: "L3_T26_CHINESE_REMAINDER",
    questionText: `What is the smallest positive integer N that leaves a remainder of ${r1} when divided by ${m1}, and a remainder of ${r2} when divided by ${m2}?`,
    optResult: buildNSOptions(verified, { step: 2 }),
    solutionSteps: [
      `We need N ≡ ${r1} (mod ${m1}) and N ≡ ${r2} (mod ${m2})`,
      `Checking candidates N = ${m2}k + ${r2} gives smallest N = ${verified} (${verified} = ${Math.floor(verified / m1)}×${m1} + ${r1})`,
    ],
  });
}

// 27. Complex Algebraic Divisibility ((a^n + b^n) mod (a + b) or exact modPow)
export function nsL3_27AlgebraicDivisibility(exam, difficulty) {
  const a = randInt(17, 37);
  const b = randInt(11, 29);
  const d = a + b;
  const n = pickRandom([19, 23, 27, 31, 35]); // odd power => a^n + b^n divisible by (a + b)!
  const extra = randInt(3, 12);
  const ans = (modPow(a, n, d) + modPow(b, n, d) + extra) % d;
  return makeNSQ({
    exam, difficulty, level: "L3", subType: "L3_T27_ALGEBRAIC_DIVISIBILITY",
    questionText: `Find the remainder when (${a}^${n} + ${b}^${n} + ${extra}) is divided by ${d}.`,
    optResult: buildNSOptions(ans, { step: 1, allowZero: true, maxVal: d - 1 }),
    solutionSteps: [
      `Since n = ${n} is odd, (${a}^${n} + ${b}^${n}) is completely divisible by (${a} + ${b}) = ${d}`,
      `Therefore, remainder = ${extra} mod ${d} = ${ans}`,
    ],
  });
}

// 28. Multi-Condition Digit Formation (3-digit number)
export function nsL3_28MultiCondDigits(exam, difficulty) {
  const h = randInt(4, 8);
  const u = randInt(1, h - 2);
  const t = randInt(1, 9);
  const num = 100 * h + 10 * t + u;
  const digitSum = h + t + u;
  const diffHU = h - u;
  return makeNSQ({
    exam, difficulty, level: "L3", subType: "L3_T28_MULTI_COND_DIGITS",
    questionText: `In a 3-digit number, the sum of all three digits is ${digitSum}, the tens digit is ${t}, and the hundreds digit exceeds the units digit by ${diffHU}. What is the 3-digit number?`,
    optResult: buildNSOptions(num, { step: 9 }),
    solutionSteps: [
      `h + u = ${digitSum} - ${t} = ${h + u} and h - u = ${diffHU}`,
      `Solving gives h = ${h}, u = ${u}, t = ${t} ⇒ Number = ${num}`,
    ],
  });
}

// 29. Complex Number Property Puzzles (HCF × LCM = A × B)
export function nsL3_29NumberPropertyPuzzle(exam, difficulty) {
  const h = randInt(6, 18);
  const p = pickRandom([3, 5, 7]), q = pickRandom([4, 8, 9]); // coprime pairs
  const num1 = h * p, num2 = h * q;
  const L = h * p * q;
  const sum = num1 + num2;
  return makeNSQ({
    exam, difficulty, level: "L3", subType: "L3_T29_PROPERTY_PUZZLE",
    questionText: `The HCF and LCM of two positive integers are ${h} and ${L} respectively. If one of the numbers is ${num1}, what is the sum of both numbers?`,
    optResult: buildNSOptions(sum, { step: h }),
    solutionSteps: [
      `Second number = (HCF × LCM) / First number = (${h} × ${L}) / ${num1} = ${num2}`,
      `Sum of both numbers = ${num1} + ${num2} = ${sum}`,
    ],
  });
}

export const LEVEL2_NS_MAP = {
  15: nsL2_15LastTwoDigits,
  16: nsL2_16AdvancedRemainder,
  17: nsL2_17ProductOfFactors,
  18: nsL2_18OddEvenFactors,
  19: nsL2_19ConditionalFactors,
  20: nsL2_20FactorialDivisibility,
  21: nsL2_21PerfectSquareCond,
  22: nsL2_22ConsecutiveNumbers,
  23: nsL2_23CoPrimeTotient,
  24: nsL2_24NumberFormation,
};

export const LEVEL3_NS_MAP = {
  25: nsL3_25MultipleRemainders,
  26: nsL3_26ChineseRemainder,
  27: nsL3_27AlgebraicDivisibility,
  28: nsL3_28MultiCondDigits,
  29: nsL3_29NumberPropertyPuzzle,
};

export const ALL_NS_MAP = {
  ...LEVEL2_NS_MAP,
  ...LEVEL3_NS_MAP,
};