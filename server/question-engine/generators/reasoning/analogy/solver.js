/**
 * Exact Formal Solvers for Banking Exam Analogy
 *
 * Covers:
 * 1. Number Analogy (A : B :: C : ?)
 * 2. Number-Triad Set Analogy (a, b, c) with strict distractor-rejection verifier
 * 3. Letter-Cluster Analogy (modular-26 shifts, opposite, reverse+shift)
 * 4. Alphanumeric Word-to-Value Analogy
 * 5. Semantic & Banking Relational Word Analogy
 */

export function charPos(ch) {
  return String(ch || "").toUpperCase().charCodeAt(0) - 64; // A=1..Z=26
}

export function posChar(n) {
  const norm = ((((n - 1) % 26) + 26) % 26) + 1;
  return String.fromCharCode(64 + norm);
}

export function shiftChar(ch, delta) {
  return posChar(charPos(ch) + delta);
}

export function oppositeChar(ch) {
  return posChar(27 - charPos(ch));
}

export function digitSum(n) {
  return String(Math.abs(n))
    .split("")
    .reduce((acc, d) => acc + Number(d), 0);
}

/**
 * 1. Exact Number Analogy Rule Evaluator.
 */
export function applyNumberAnalogyRule(n, rule) {
  if (rule.type === "SQUARE_PLUS_K") return n * n + rule.k;
  if (rule.type === "CUBE_PLUS_SELF") return n * n * n + n;
  if (rule.type === "CUBE_MINUS_SELF") return n * n * n - n;
  if (rule.type === "PROD_NEXT") return n * (n + 1);
  if (rule.type === "LINEAR") return n * rule.m + rule.c;
  if (rule.type === "DIGIT_SUM_SQ") {
    const ds = digitSum(n);
    return ds * ds;
  }
  throw new Error(`Unknown number analogy rule: ${rule.type}`);
}

/**
 * 2. Exact Number-Triad Set Analogy Verifier.
 */
export function matchesTriadRule(triad, rule) {
  const [a, b, c] = triad;
  if (rule.type === "DOUBLE_PLUS_K") {
    return b === 2 * a + rule.k && c === 2 * b + rule.k;
  }
  if (rule.type === "SUM_TIMES_K") {
    return c === (a + b) * rule.k;
  }
  if (rule.type === "SQUARE_PLUS_SECOND") {
    return c === a * a + b;
  }
  if (rule.type === "DIFF_TIMES_K") {
    return c === Math.abs(b - a) * rule.k;
  }
  throw new Error(`Unknown triad rule: ${rule.type}`);
}

/**
 * 3. Exact Letter-Cluster Analogy Evaluator.
 */
export function applyLetterAnalogyRule(cluster, rule) {
  const chars = [...String(cluster).toUpperCase()];
  if (rule.type === "UNIFORM_SHIFT") {
    return chars.map((c) => shiftChar(c, rule.k)).join("");
  }
  if (rule.type === "ALTERNATING_SHIFT") {
    return chars.map((c, i) => shiftChar(c, i % 2 === 0 ? rule.a : rule.b)).join("");
  }
  if (rule.type === "PROGRESSIVE_SHIFT") {
    return chars.map((c, i) => shiftChar(c, rule.start + i)).join("");
  }
  if (rule.type === "OPPOSITE_SHIFT") {
    return chars.map((c) => shiftChar(oppositeChar(c), rule.k || 0)).join("");
  }
  if (rule.type === "REVERSE_SHIFT") {
    return [...chars].reverse().map((c) => shiftChar(c, rule.k)).join("");
  }
  throw new Error(`Unknown letter analogy rule: ${rule.type}`);
}

/**
 * 4. Exact Alphanumeric Word-Value Analogy Evaluator.
 */
export function applyWordValueAnalogyRule(word, rule) {
  const chars = [...String(word).toUpperCase()];
  const fwd = chars.reduce((acc, c) => acc + charPos(c), 0);
  const rev = chars.reduce((acc, c) => acc + (27 - charPos(c)), 0);
  if (rule.type === "FWD_SUM") return fwd;
  if (rule.type === "REV_SUM") return rev;
  if (rule.type === "FWD_TIMES_2") return fwd * 2;
  if (rule.type === "FWD_PLUS_LEN") return fwd + chars.length;
  throw new Error(`Unknown word-value analogy rule: ${rule.type}`);
}
