/**
 * Exact 4-vs-1 Invariant Predicate Solvers for Banking Exam Classification (Odd One Out)
 *
 * Every question guarantees:
 *   EXACTLY 4 options satisfy the group invariant P(x) === true
 *   EXACTLY 1 option violates it P(x) === false (the unique Odd One Out)
 */

export function charPos(ch) {
  return String(ch || "").toUpperCase().charCodeAt(0) - 64; // A=1..Z=26
}

export function posChar(n) {
  const norm = ((((n - 1) % 26) + 26) % 26) + 1;
  return String.fromCharCode(64 + norm);
}

export function isPrime(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

export function isPerfectSquare(n) {
  if (n < 0) return false;
  const r = Math.round(Math.sqrt(n));
  return r * r === n;
}

export function isPerfectCube(n) {
  if (n < 0) return false;
  const r = Math.round(Math.cbrt(n));
  return r * r * r === n;
}

export function digitSum(n) {
  return String(Math.abs(n))
    .split("")
    .reduce((acc, d) => acc + Number(d), 0);
}

/**
 * 1. Exact Number Property Invariant Checker.
 */
export function matchesNumberProperty(n, prop) {
  if (prop.type === "PRIME") return isPrime(n);
  if (prop.type === "PERFECT_SQUARE") return isPerfectSquare(n);
  if (prop.type === "PERFECT_CUBE") return isPerfectCube(n);
  if (prop.type === "DIVISIBLE_BY") return n % prop.divisor === 0;
  if (prop.type === "DIGIT_SUM_EQ") return digitSum(n) === prop.targetSum;
  throw new Error(`Unknown number property: ${prop.type}`);
}

/**
 * 2. Exact Number-Pair Relation Checker.
 */
export function evalPairFormula(a, rule) {
  if (rule.type === "SQUARE_PLUS_K") return a * a + rule.k;
  if (rule.type === "LINEAR") return a * rule.m + rule.c;
  if (rule.type === "PROD_NEXT") return a * (a + 1);
  if (rule.type === "CUBE_MINUS_SELF") return a * a * a - a;
  throw new Error(`Unknown pair rule: ${rule.type}`);
}

export function matchesNumberPair(pair, rule) {
  return evalPairFormula(pair[0], rule) === pair[1];
}

/**
 * 3. Exact Letter-Cluster Internal Gap Signature (mod 26).
 * e.g. "ACEG" -> "2,2,2"
 */
export function clusterGapSignature(cluster) {
  const chars = [...String(cluster).toUpperCase()];
  const gaps = [];
  for (let i = 1; i < chars.length; i++) {
    const diff = (((charPos(chars[i]) - charPos(chars[i - 1])) % 26) + 26) % 26;
    gaps.push(diff);
  }
  return gaps.join(",");
}

/**
 * 4. Exact Alphanumeric Pair Value Checker.
 */
export function evalAlphaPairValue(word, ruleType) {
  const chars = [...String(word).toUpperCase()];
  if (ruleType === "FWD_SUM") {
    return chars.reduce((acc, c) => acc + charPos(c), 0);
  }
  if (ruleType === "REV_SUM") {
    return chars.reduce((acc, c) => acc + (27 - charPos(c)), 0);
  }
  if (ruleType === "FIRST_PLUS_LAST") {
    return charPos(chars[0]) + charPos(chars[chars.length - 1]);
  }
  throw new Error(`Unknown alphanumeric pair rule: ${ruleType}`);
}

/**
 * Generic 4-vs-1 Uniqueness Auditor:
 * Given 5 items and a boolean predicate, returns the unique odd index (0..4)
 * iff exactly 4 items return true and 1 returns false; otherwise returns -1.
 */
export function findUniqueOddIndex(items, predicate) {
  if (!Array.isArray(items) || items.length !== 5) return -1;
  const falseIndices = [];
  for (let i = 0; i < 5; i++) {
    if (!predicate(items[i])) falseIndices.push(i);
  }
  return falseIndices.length === 1 ? falseIndices[0] : -1;
}
