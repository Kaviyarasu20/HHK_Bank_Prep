/**
 * Exact Formal Solvers for Banking Exam Letter Series
 *
 * Covers:
 * 1. Single-letter constant, progressive, prime-gap, and dual-alternating series
 * 2. Multi-letter cluster progression (missing term & wrong term)
 * 3. Continuous repeating / cyclic block pattern fill-in-the-blanks
 * 4. Alphabetical letter-pair count (forward & backward)
 * 5. Reversed-half English alphabet positional lookup
 */

export function charToNum(ch) {
  return String(ch || "").toUpperCase().charCodeAt(0) - 64; // A=1..Z=26
}

export function numToChar(n) {
  const norm = ((((n - 1) % 26) + 26) % 26) + 1;
  return String.fromCharCode(64 + norm);
}

export function shiftChar(ch, delta) {
  return numToChar(charToNum(ch) + delta);
}

/**
 * 1. Generate exact single-letter series from rule.
 */
export function generateSingleLetterSequence(rule, length) {
  const out = [];
  if (rule.type === "CONSTANT_DIFF") {
    for (let i = 0; i < length; i++) {
      out.push(numToChar(rule.start + i * rule.diff));
    }
  } else if (rule.type === "PROGRESSIVE_DIFF") {
    let cur = rule.start;
    let d = rule.d0;
    out.push(numToChar(cur));
    for (let i = 1; i < length; i++) {
      cur += d;
      out.push(numToChar(cur));
      d += rule.step;
    }
  } else if (rule.type === "PRIME_DIFF") {
    const primes = [2, 3, 5, 7, 11, 13];
    let cur = rule.start;
    out.push(numToChar(cur));
    for (let i = 1; i < length; i++) {
      cur += primes[i - 1];
      out.push(numToChar(cur));
    }
  } else if (rule.type === "DUAL_ALTERNATING") {
    for (let i = 0; i < length; i++) {
      const k = Math.floor(i / 2);
      if (i % 2 === 0) out.push(numToChar(rule.startA + k * rule.diffA));
      else out.push(numToChar(rule.startB + k * rule.diffB));
    }
  }
  return out;
}

/**
 * 2. Generate exact 3-letter cluster series from column-wise shifts.
 */
export function generateClusterSequence(starts, diffs, length) {
  const out = [];
  for (let i = 0; i < length; i++) {
    const term = starts.map((s, col) => numToChar(s + i * diffs[col])).join("");
    out.push(term);
  }
  return out;
}

/**
 * 3. Solve continuous repeating/cyclic block fill-in-the-blanks.
 */
export function extractFillChars(fullString, blankIndices) {
  return blankIndices.map((idx) => fullString[idx]).join("");
}

export function applyFillToTemplate(template, fillChars) {
  let ptr = 0;
  return [...template]
    .map((ch) => (ch === "_" ? fillChars[ptr++] : ch))
    .join("");
}

/**
 * 4. Exact Alphabetical Pair Counter (both forward & backward directions).
 */
export function findAlphabeticalPairs(word) {
  const w = String(word || "").toUpperCase();
  const pairs = [];
  for (let i = 0; i < w.length; i++) {
    for (let j = i + 1; j < w.length; j++) {
      const pi = charToNum(w[i]);
      const pj = charToNum(w[j]);
      if (Math.abs(pj - pi) === j - i) {
        const direction = pj > pi ? "Forward" : "Backward";
        pairs.push({
          i,
          j,
          pair: `${w[i]}-${w[j]}`,
          direction,
        });
      }
    }
  }
  return pairs;
}

/**
 * 5. Exact Reversed-Half English Alphabet Builder & Lookup.
 * reverseMode: "FIRST_HALF" (M..A, N..Z) | "SECOND_HALF" (A..M, Z..N) | "BOTH_HALVES" (M..A, Z..N)
 */
export function buildHalfReversedAlphabet(reverseMode) {
  const first = Array.from({ length: 13 }, (_, i) => String.fromCharCode(65 + i)); // A..M
  const second = Array.from({ length: 13 }, (_, i) => String.fromCharCode(78 + i)); // N..Z
  if (reverseMode === "FIRST_HALF") return [...first.reverse(), ...second];
  if (reverseMode === "SECOND_HALF") return [...first, ...second.reverse()];
  if (reverseMode === "BOTH_HALVES") return [...first.reverse(), ...second.reverse()];
  return [...first, ...second];
}
