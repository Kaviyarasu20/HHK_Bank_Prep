/**
 * Exact Formal Solvers for Banking Exam Alphanumeric Series
 *
 * Covers:
 * 1. Symbol-Number-Letter sequence classification, preceded/followed counts, and element-drop queries
 * 2. Exact 1-indexed positional navigation (left-of-left, right-of-left, left-of-right, midway)
 * 3. 3-digit number set transformations (digit swap, digit sort, digit arithmetic)
 * 4. 3-letter word set transformations (vowel/consonant shift, dictionary order, alphabetical gap)
 * 5. PO Mains multi-step alphanumeric string transformations
 */

const VOWELS = new Set(["A", "E", "I", "O", "U"]);
const DIGITS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

export function classifyToken(tok) {
  const s = String(tok || "");
  if (DIGITS.has(s)) return "NUMBER";
  if (/^[A-Z]$/.test(s)) return VOWELS.has(s) ? "VOWEL" : "CONSONANT";
  return "SYMBOL";
}

export function matchesCategory(tok, category) {
  const cls = classifyToken(tok);
  if (category === "ANY") return true;
  if (category === "LETTER") return cls === "VOWEL" || cls === "CONSONANT";
  if (category === "EVEN_NUMBER") return cls === "NUMBER" && Number(tok) % 2 === 0;
  if (category === "ODD_NUMBER") return cls === "NUMBER" && Number(tok) % 2 === 1;
  return cls === category;
}

export function shiftChar(ch, delta) {
  const code = ch.charCodeAt(0) - 65;
  return String.fromCharCode(65 + (((code + delta) % 26) + 26) % 26);
}

/**
 * 1. Count elements matching (prevCat, targetCat, nextCat) in `seq`.
 */
export function countPrecededFollowed(seq, prevCat, targetCat, nextCat) {
  const matches = [];
  for (let i = 1; i < seq.length - 1; i++) {
    if (
      matchesCategory(seq[i - 1], prevCat) &&
      matchesCategory(seq[i], targetCat) &&
      matchesCategory(seq[i + 1], nextCat)
    ) {
      matches.push({ index: i, token: seq[i], triple: `${seq[i - 1]} ${seq[i]} ${seq[i + 1]}` });
    }
  }
  return matches;
}

/**
 * Drop all tokens matching `dropCat` and return element at 1-indexed `pos` from `fromEnd` ("LEFT"|"RIGHT").
 */
export function solveDropAndFind(seq, dropCat, pos, fromEnd) {
  const filtered = seq.filter((tok) => !matchesCategory(tok, dropCat));
  if (pos < 1 || pos > filtered.length) return null;
  const idx = fromEnd === "LEFT" ? pos - 1 : filtered.length - pos;
  return { filtered, element: filtered[idx], zeroIndex: idx };
}

/**
 * 2. Positional Navigation Solver
 * mode: "LEFT_OF_LEFT" | "RIGHT_OF_LEFT" | "LEFT_OF_RIGHT" | "RIGHT_OF_RIGHT" | "MIDWAY"
 */
export function solvePositionalNav(seq, mode, a, b) {
  const n = seq.length;
  let oneIdx = -1;
  if (mode === "LEFT_OF_LEFT") {
    // a-th to the left of b-th from left end => b - a
    oneIdx = b - a;
  } else if (mode === "RIGHT_OF_LEFT") {
    // a-th to the right of b-th from left end => b + a
    oneIdx = b + a;
  } else if (mode === "LEFT_OF_RIGHT") {
    // a-th to the left of b-th from right end => (a + b)-th from right => n - (a + b) + 1
    oneIdx = n - (a + b) + 1;
  } else if (mode === "RIGHT_OF_RIGHT") {
    // a-th to the right of b-th from right end => (b - a)-th from right => n - (b - a) + 1
    oneIdx = n - (b - a) + 1;
  } else if (mode === "MIDWAY") {
    // midway between a-th from left and b-th from right
    const posBFromLeft = n - b + 1;
    if ((a + posBFromLeft) % 2 !== 0) return null;
    oneIdx = (a + posBFromLeft) / 2;
  }
  if (oneIdx < 1 || oneIdx > n) return null;
  return { oneIdx, element: seq[oneIdx - 1] };
}

/**
 * 3. 3-Digit Number Set Transformations
 */
export function transformThreeDigitNumber(num, op) {
  const digits = String(num).split("").map(Number);
  if (op === "SWAP_FIRST_THIRD") {
    return Number(`${digits[2]}${digits[1]}${digits[0]}`);
  }
  if (op === "SORT_DIGITS_ASC") {
    return Number([...digits].sort((x, y) => x - y).join(""));
  }
  if (op === "SORT_DIGITS_DESC") {
    return Number([...digits].sort((x, y) => y - x).join(""));
  }
  if (op === "EVEN_PLUS_1_ODD_MINUS_1") {
    return Number(digits.map((d) => (d % 2 === 0 ? d + 1 : d - 1)).join(""));
  }
  throw new Error(`Unknown 3-digit op: ${op}`);
}

/**
 * 4. 3-Letter Word Set Transformations
 */
export function transformWordVowelConsonant(word, vowelDelta, consonantDelta) {
  return [...word]
    .map((ch) => shiftChar(ch, VOWELS.has(ch) ? vowelDelta : consonantDelta))
    .join("");
}

export function alphabeticalGapBetween(ch1, ch2) {
  const p1 = ch1.charCodeAt(0) - 64;
  const p2 = ch2.charCodeAt(0) - 64;
  return Math.max(0, Math.abs(p1 - p2) - 1);
}

/**
 * 5. PO Mains Multi-Step Alphanumeric Transformation Solver
 * steps: ordered list of deterministic banking operations on token array `seq`.
 */
export function applyMainsSteps(seq, steps) {
  let arr = [...seq];
  const trace = [];

  for (const step of steps) {
    if (step === "SWAP_SYMBOL_FOLLOWED_BY_NUMBER") {
      // Every number immediately preceded by a symbol is interchanged with that symbol (left to right, non-overlapping)
      let i = 1;
      while (i < arr.length) {
        if (classifyToken(arr[i]) === "NUMBER" && classifyToken(arr[i - 1]) === "SYMBOL") {
          [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
          i += 2;
        } else {
          i += 1;
        }
      }
    } else if (step === "DROP_VOWELS_BEFORE_CONSONANT") {
      const next = [];
      for (let i = 0; i < arr.length; i++) {
        if (
          classifyToken(arr[i]) === "VOWEL" &&
          i + 1 < arr.length &&
          classifyToken(arr[i + 1]) === "CONSONANT"
        ) {
          continue;
        }
        next.push(arr[i]);
      }
      arr = next;
    } else if (step === "MOVE_EVEN_NUMBERS_TO_RIGHT_ASC") {
      const evens = arr.filter((t) => matchesCategory(t, "EVEN_NUMBER")).sort((a, b) => Number(a) - Number(b));
      const rest = arr.filter((t) => !matchesCategory(t, "EVEN_NUMBER"));
      arr = [...rest, ...evens];
    } else if (step === "DROP_SYMBOLS_BEFORE_LETTER") {
      const next = [];
      for (let i = 0; i < arr.length; i++) {
        if (
          classifyToken(arr[i]) === "SYMBOL" &&
          i + 1 < arr.length &&
          matchesCategory(arr[i + 1], "LETTER")
        ) {
          continue;
        }
        next.push(arr[i]);
      }
      arr = next;
    }
    trace.push([...arr]);
  }

  return { finalSeq: arr, trace };
}
