/**
 * Exact Deterministic Step-by-Step Simulators for Banking Machine Input-Output
 *
 * Covers 5 real IBPS / SBI / RBI exam machine families:
 * 1. Dual-End Word + Number Shifting Machine (outer-append & inner-shift)
 * 2. Single-End Interleaved Word–Number Auto-Arrangement Machine
 * 3. Number-Only 3-Step Arithmetic Machine (PO Mains)
 * 4. Word + Number Shift & Transform Machine (PO Mains)
 * 5. Digit-Operation 3-Step Number Machine (SBI PO Mains)
 */

export function isNumericToken(tok) {
  return /^\d+$/.test(String(tok));
}

export function digitSum(n) {
  return String(Math.abs(n))
    .split("")
    .reduce((acc, d) => acc + Number(d), 0);
}

export function reverseNumberDigits(n) {
  return Number(String(n).split("").reverse().join(""));
}

export function shiftFirstLetter(word, delta = 1) {
  const w = String(word);
  const code = w[0].toLowerCase().charCodeAt(0) - 97;
  const next = String.fromCharCode(97 + (((code + delta) % 26) + 26) % 26);
  return next + w.slice(1);
}

/**
 * 1. Dual-End Word + Number Shifting Machine.
 * - Each step picks the next word (wordOrder: "ASC"|"DESC") and places it at the left
 *   (placement: "INNER" => prepend at index 0 pushing previous sorted words inward;
 *    "OUTER" => place at index stepIdx after previously sorted words).
 * - Simultaneously picks the next number (numOrder: "ASC"|"DESC") and places it at the right
 *   ("INNER" => append at end pushing previous sorted numbers inward;
 *    "OUTER" => place at length - 1 - stepIdx).
 */
export function simulateDualEndWordNumber(inputTokens, { wordOrder = "ASC", numOrder = "DESC", placement = "OUTER" } = {}) {
  const words = inputTokens.filter((t) => !isNumericToken(t));
  const nums = inputTokens.filter((t) => isNumericToken(t)).map(Number);

  const sortedWords = [...words].sort((a, b) =>
    wordOrder === "ASC" ? a.localeCompare(b) : b.localeCompare(a),
  );
  const sortedNums = [...nums]
    .sort((a, b) => (numOrder === "ASC" ? a - b : b - a))
    .map(String);

  const totalSteps = Math.min(sortedWords.length, sortedNums.length);
  const steps = [];
  let leftPlaced = [];
  let rightPlaced = [];
  let remaining = [...inputTokens];

  for (let i = 0; i < totalSteps; i++) {
    const w = sortedWords[i];
    const n = sortedNums[i];
    remaining = remaining.filter((t) => t !== w && t !== n);

    if (placement === "INNER") {
      leftPlaced = [w, ...leftPlaced];
      rightPlaced = [...rightPlaced, n];
    } else {
      leftPlaced = [...leftPlaced, w];
      rightPlaced = [n, ...rightPlaced];
    }
    steps.push([...leftPlaced, ...remaining, ...rightPlaced]);
  }

  return { input: [...inputTokens], steps };
}

/**
 * 2. Single-End Interleaved Word–Number Auto-Arrangement Machine.
 * Target final arrangement: [W1, N1, W2, N2, W3, N3, W4, N4]
 * In each step, finds the FIRST index `i` where current[i] !== target[i],
 * removes target[i] from its current position, and inserts it at index `i`.
 * (Exact banking auto-arrangement rule: if an element is already in place, skip it!)
 */
export function simulateInterleavedAutoArrange(inputTokens, { wordOrder = "ASC", numOrder = "DESC" } = {}) {
  const words = inputTokens.filter((t) => !isNumericToken(t));
  const nums = inputTokens.filter((t) => isNumericToken(t)).map(Number);

  const sortedWords = [...words].sort((a, b) =>
    wordOrder === "ASC" ? a.localeCompare(b) : b.localeCompare(a),
  );
  const sortedNums = [...nums]
    .sort((a, b) => (numOrder === "ASC" ? a - b : b - a))
    .map(String);

  const target = [];
  for (let i = 0; i < Math.max(sortedWords.length, sortedNums.length); i++) {
    if (i < sortedWords.length) target.push(sortedWords[i]);
    if (i < sortedNums.length) target.push(sortedNums[i]);
  }

  let cur = [...inputTokens];
  const steps = [];
  for (let i = 0; i < target.length; i++) {
    if (cur[i] === target[i]) continue;
    const pos = cur.indexOf(target[i]);
    cur.splice(pos, 1);
    cur.splice(i, 0, target[i]);
    steps.push([...cur]);
  }

  return { input: [...inputTokens], steps, target };
}

/**
 * 3. Number-Only 3-Step Arithmetic Machine (PO Mains).
 * ruleVariant:
 *   "A": Step 1 = Sort Ascending; Step 2 = Even -> n/2, Odd -> n+5; Step 3 = Digit Sum
 *   "B": Step 1 = Reverse digits of each 2-digit number; Step 2 = Sort Descending; Step 3 = Even -> n+6, Odd -> n-3
 *   "C": Step 1 = Sort Descending; Step 2 = Even -> n-4, Odd -> n+3; Step 3 = Reverse digits
 */
export function simulateNumberArithmeticMachine(inputNums, ruleVariant = "A") {
  const nums = inputNums.map(Number);
  let s1, s2, s3;

  if (ruleVariant === "A") {
    s1 = [...nums].sort((a, b) => a - b);
    s2 = s1.map((n) => (n % 2 === 0 ? n / 2 : n + 5));
    s3 = s2.map((n) => digitSum(n));
  } else if (ruleVariant === "B") {
    s1 = nums.map((n) => reverseNumberDigits(n));
    s2 = [...s1].sort((a, b) => b - a);
    s3 = s2.map((n) => (n % 2 === 0 ? n + 6 : n - 3));
  } else {
    s1 = [...nums].sort((a, b) => b - a);
    s2 = s1.map((n) => (n % 2 === 0 ? n - 4 : n + 3));
    s3 = s2.map((n) => reverseNumberDigits(n));
  }

  return {
    input: nums.map(String),
    steps: [s1.map(String), s2.map(String), s3.map(String)],
  };
}

/**
 * 4. Word + Number Shift & Transform Machine (PO Mains).
 * Each step:
 * - Picks next word in alphabetical order (ASC), reverses it (or shifts first letter +1), and places at left end (OUTER).
 * - Picks next number in ascending order (ASC), transforms it (even + 2, odd - 1), and places at right end (OUTER).
 */
export function simulateWordNumberTransform(inputTokens, { wordOp = "REVERSE", evenDelta = 2, oddDelta = -1 } = {}) {
  const words = inputTokens.filter((t) => !isNumericToken(t));
  const nums = inputTokens.filter((t) => isNumericToken(t)).map(Number);

  const sortedWords = [...words].sort((a, b) => a.localeCompare(b));
  const sortedNums = [...nums].sort((a, b) => a - b);
  const totalSteps = Math.min(sortedWords.length, sortedNums.length);

  const leftPlaced = [];
  const rightPlaced = [];
  let remaining = [...inputTokens];
  const steps = [];

  for (let i = 0; i < totalSteps; i++) {
    const w = sortedWords[i];
    const n = sortedNums[i];
    const nStr = String(n);
    remaining = remaining.filter((t) => t !== w && t !== nStr);

    const wOut = wordOp === "REVERSE" ? [...w].reverse().join("") : shiftFirstLetter(w, 1);
    const nOut = String(n % 2 === 0 ? n + evenDelta : n + oddDelta);

    leftPlaced.push(wOut);
    rightPlaced.unshift(nOut);
    steps.push([...leftPlaced, ...remaining, ...rightPlaced]);
  }

  return { input: [...inputTokens], steps };
}

/**
 * 5. Digit-Operation 3-Step Number Machine (SBI PO Mains).
 * Input: 6 two-digit numbers [n0..n5] (each digit 1..9).
 * Step 1: Product of digits of each number (e.g., 47 -> 28)
 * Step 2: Subtract smaller digit from larger digit of each Step-1 number (single digit stays as is) -> or add digits if variant="SUM"
 * Step 3: Sort Step-2 numbers in ascending order
 */
export function simulateDigitOpMachine(inputNums, step2Op = "DIFF") {
  const nums = inputNums.map(Number);
  const s1 = nums.map((n) => {
    const d1 = Math.floor(n / 10);
    const d2 = n % 10;
    return d1 * d2;
  });
  const s2 = s1.map((n) => {
    if (n < 10) return n;
    const d1 = Math.floor(n / 10);
    const d2 = n % 10;
    return step2Op === "DIFF" ? Math.abs(d1 - d2) : d1 + d2;
  });
  const s3 = [...s2].sort((a, b) => a - b);

  return {
    input: nums.map(String),
    steps: [s1.map(String), s2.map(String), s3.map(String)],
  };
}
