// Place at: server/question-engine/generators/quant/permutationCombination/pncTemplatesPart1.js
import {
  fact,
  nPr,
  nCr,
  getLetterFrequencies,
  multinomial,
  VOWEL_SET,
  buildFivePncOptions,
} from "./pncMath.js";

export function assemblePncQ({
  templateId,
  question_type,
  sub_type,
  difficulty,
  exam_level,
  question,
  mathModel,
  exactBigIntAnswer,
  plausible = [],
  solution,
  shortcut_method = "",
  rng,
}) {
  const built = buildFivePncOptions(exactBigIntAnswer, plausible, { rng });
  return {
    templateId,
    question_type,
    sub_type,
    difficulty,
    exam_level,
    question,
    mathModel,
    exactBigIntAnswer,
    options: built.optionsObj,
    optionsArray: built.optionsArray,
    correct_answer: built.correctKey,
    correctOptionIndex: built.correctOptionIndex,
    correct_answer_value: built.correctValue,
    solution,
    shortcut_method,
  };
}

// ============================================================================
// CATEGORY A: Basic Permutation (A1–A3)
// ============================================================================

// A1. Arranging n Distinct Objects in a Row (n!)
function genA1_DistinctRow(rng, difficulty) {
  const n = rng.pick([4, 5, 6, 7]);
  const item = rng.pick(["distinct books on a shelf", "candidates in a straight row", "distinct trophies in a display case", "different files in a folder"]);
  const ans = fact(n);

  return assemblePncQ({
    templateId: "PNC_A1_DISTINCT_ROW",
    question_type: "Basic Permutation",
    sub_type: "Arrangement of n distinct objects",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `In how many different ways can ${n} ${item} be arranged?`,
    mathModel: { kind: "PERM_BASIC", n, r: n },
    exactBigIntAnswer: ans,
    plausible: [fact(n - 1), ans / 2n, ans * 2n, BigInt(n * n)],
    solution: {
      given_data: [`Number of distinct objects = ${n}`, "Arranged in a straight line"],
      concept: "Permutation because the order of arrangement matters.",
      formula: "n!",
      steps: [
        `Number of arrangements = ${n}!`,
        `${n}! = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Arranging n distinct objects in a line always equals n! = ${ans}.`,
    rng,
  });
}

// A2. Arranging r Objects Selected from n Distinct Objects (nPr)
function genA2_SelectAndArrange(rng, difficulty) {
  const configs = [
    [6, 3], [7, 3], [8, 3], [6, 4], [7, 4], [9, 3], [10, 3], [5, 3],
  ];
  const [n, r] = rng.pick(configs);
  const ans = nPr(n, r);
  const wrongComb = nCr(n, r);

  return assemblePncQ({
    templateId: "PNC_A2_NPR_ARRANGEMENT",
    question_type: "Basic Permutation",
    sub_type: "Arranging r objects from n distinct objects (nPr)",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims", "IBPS PO Prelims"],
    question: `In how many different ways can ${r} distinct prizes (1st, 2nd${r >= 3 ? ", 3rd" : ""}${r === 4 ? ", and 4th" : ""}) be awarded among ${n} distinct participants if no participant receives more than one prize?`,
    mathModel: { kind: "PERM_BASIC", n, r },
    exactBigIntAnswer: ans,
    plausible: [wrongComb, fact(n), nPr(n, r - 1), BigInt(n) ** BigInt(r)],
    solution: {
      given_data: [`Total participants (n) = ${n}`, `Distinct ranked prizes (r) = ${r}`],
      concept: "Permutation because the prizes are ranked, so order matters.",
      formula: "nPr = n! / (n − r)!",
      steps: [
        `Number of ways = P(${n}, ${r}) = ${n}! / (${n} − ${r})!`,
        `= ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Multiply ${r} descending integers starting from ${n} ⇒ ${ans}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY B: Basic Combination (B1–B2)
// ============================================================================

// B1. Selecting r Objects from n Distinct Objects (nCr)
function genB1_BasicSelection(rng, difficulty) {
  const configs = [
    [8, 3], [9, 3], [10, 3], [10, 4], [11, 3], [12, 3], [9, 4], [8, 4],
  ];
  const [n, r] = rng.pick(configs);
  const ans = nCr(n, r);
  const wrongPerm = nPr(n, r);

  return assemblePncQ({
    templateId: "PNC_B1_NCR_SELECTION",
    question_type: "Basic Combination",
    sub_type: "Selecting r objects from n distinct objects (nCr)",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `In how many ways can a panel of ${r} officers be selected from a group of ${n} distinct officers?`,
    mathModel: { kind: "COMB_BASIC", n, r },
    exactBigIntAnswer: ans,
    plausible: [wrongPerm, nCr(n, r - 1), nCr(n - 1, r), ans * 2n],
    solution: {
      given_data: [`Total officers (n) = ${n}`, `Panel size (r) = ${r}`],
      concept: "Combination because the order of selection into a panel does not matter.",
      formula: "nCr = n! / [r!(n − r)!]",
      steps: [
        `Number of selections = C(${n}, ${r}) = ${n}! / (${r}! × ${n - r}!)`,
        `= ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Compute P(${n}, ${r}) / ${r}! = ${ans}.`,
    rng,
  });
}

// B2. Handshakes / Matches (nC2)
function genB2_Handshakes(rng, difficulty) {
  const n = rng.randInt(8, 16);
  const ans = nCr(n, 2);

  return assemblePncQ({
    templateId: "PNC_B2_HANDSHAKES",
    question_type: "Basic Combination",
    sub_type: "Pairwise selection (nC2)",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `In a banking conference, ${n} branch managers shake hands with every other manager exactly once. How many total handshakes take place?`,
    mathModel: { kind: "COMB_BASIC", n, r: 2 },
    exactBigIntAnswer: ans,
    plausible: [nPr(n, 2), BigInt(n * n), nCr(n - 1, 2), nCr(n + 1, 2)],
    solution: {
      given_data: [`Total managers (n) = ${n}`, "Each handshake involves 2 people (order does not matter)"],
      concept: "Combination because A shaking hands with B is the same as B shaking hands with A.",
      formula: "nC2 = n(n − 1) / 2",
      steps: [
        `Total handshakes = C(${n}, 2) = (${n} × ${n - 1}) / 2`,
        `= ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Always use n(n−1)/2 (not n(n−1)): (${n}×${n - 1})/2 = ${ans}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY C: Word Arrangement (Distinct Letters — C1–C4)
// ============================================================================

const DISTINCT_WORDS = ["BANKING".slice(0, 5), "CREDIT", "LOANED", "PROFIT", "MARKET", "BRANCH", "LEDGER".replace("E", "A"), "AUDIT", "TRUST".replace("T", "C"), "INVEST".replace("T", "P"), "DRAFT", "EQUITY", "DEPOSIT", "FINANCE".slice(0, 5)];
const CLEAN_DISTINCT_WORDS = ["CREDIT", "PROFIT", "MARKET", "BRANCH", "AUDIT", "DRAFT", "EQUITY", "DEPOSIT", "SILVER", "ORANGE", "PLANET", "GARDEN"];

// C1. Distinct Word — All Letters Arranged
function genC1_DistinctWordAll(rng, difficulty) {
  const word = rng.pick(["AUDIT", "DRAFT", "CREDIT", "PROFIT", "MARKET", "BRANCH", "EQUITY"]);
  const n = word.length;
  const ans = fact(n);

  return assemblePncQ({
    templateId: "PNC_C1_DISTINCT_WORD_ALL",
    question_type: "Word Arrangement",
    sub_type: "Arranging all letters of a distinct-letter word",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `In how many different ways can all the letters of the word "${word}" be arranged?`,
    mathModel: { kind: "WORD_ARRANGEMENT", word, mode: "ALL" },
    exactBigIntAnswer: ans,
    plausible: [fact(n - 1), ans / 2n, fact(n + 1) / 2n, ans - BigInt(n)],
    solution: {
      given_data: [`Word = "${word}"`, `Total letters = ${n} (all distinct)`],
      concept: "Permutation of n distinct letters.",
      formula: "n!",
      steps: [
        `All ${n} letters in "${word}" are distinct.`,
        `Total arrangements = ${n}! = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Check for repeated letters (none here) ⇒ ${n}! = ${ans}.`,
    rng,
  });
}

// C2. Word Arrangement — Vowels Always Together (Distinct Letters)
function genC2_WordVowelsTogether(rng, difficulty) {
  const word = rng.pick(["CREDIT", "PROFIT", "MARKET", "EQUITY", "DEPOSIT", "ORANGE", "GARDEN", "PLANET"]);
  const { clean, length } = getLetterFrequencies(word);
  const vCount = [...clean].filter((ch) => VOWEL_SET.has(ch)).length;
  const cCount = length - vCount;
  const ans = fact(cCount + 1) * fact(vCount);
  const wrongNoInternal = fact(cCount + 1);

  return assemblePncQ({
    templateId: "PNC_C2_VOWELS_TOGETHER",
    question_type: "Word Arrangement",
    sub_type: "Word arrangement with vowels always together",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `In how many different ways can the letters of the word "${word}" be arranged so that all the vowels always come together?`,
    mathModel: { kind: "WORD_ARRANGEMENT", word, mode: "VOWELS_TOGETHER" },
    exactBigIntAnswer: ans,
    plausible: [wrongNoInternal, fact(length), fact(cCount) * fact(vCount), fact(length) - ans],
    solution: {
      given_data: [`Word = "${word}" (${length} distinct letters)`, `Vowels = ${vCount}, Consonants = ${cCount}`],
      concept: "Permutation using the block method: treat all vowels as 1 single block and multiply by internal vowel arrangements.",
      formula: "(Consonants + 1)! × (Vowels)!",
      steps: [
        `Treat the ${vCount} vowels as 1 unit ⇒ Total units to arrange = ${cCount} + 1 = ${cCount + 1}`,
        `Ways to arrange ${cCount + 1} units = ${cCount + 1}! = ${fact(cCount + 1)}`,
        `Internal arrangements of ${vCount} vowels = ${vCount}! = ${fact(vCount)}`,
        `Total ways = ${fact(cCount + 1)} × ${fact(vCount)} = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Block method: (${cCount}+1)! × ${vCount}! = ${ans} (never forget internal ${vCount}!).`,
    rng,
  });
}

// C3. Word Arrangement — No Two Vowels Together (Gap Method)
function genC3_NoTwoVowelsTogether(rng, difficulty) {
  const word = rng.pick(["CREDIT", "PROFIT", "MARKET", "PLANET", "GARDEN", "SILVER", "DEPOSIT"]);
  const { clean, length } = getLetterFrequencies(word);
  const vCount = [...clean].filter((ch) => VOWEL_SET.has(ch)).length;
  const cCount = length - vCount;
  const gaps = cCount + 1;
  const ans = fact(cCount) * nPr(gaps, vCount);
  const wrongComplement = fact(length) - fact(cCount + 1) * fact(vCount);

  return assemblePncQ({
    templateId: "PNC_C3_NO_TWO_VOWELS_TOGETHER",
    question_type: "Word Arrangement",
    sub_type: "Word arrangement with no two vowels together (Gap Method)",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `In how many different ways can the letters of the word "${word}" be arranged such that no two vowels are adjacent to each other?`,
    mathModel: { kind: "WORD_ARRANGEMENT", word, mode: "NO_TWO_VOWELS_TOGETHER" },
    exactBigIntAnswer: ans,
    plausible: [fact(cCount) * nCr(gaps, vCount), fact(cCount + 1) * fact(vCount), fact(length), wrongComplement],
    solution: {
      given_data: [`Word = "${word}" (${length} distinct letters)`, `Consonants = ${cCount}, Vowels = ${vCount}`],
      concept: "Gap method permutation: arrange consonants first, then place vowels into the created gaps.",
      formula: "C! × P(C + 1, V)",
      steps: [
        `Arrange ${cCount} consonants in ${cCount}! = ${fact(cCount)} ways, creating ${gaps} gaps`,
        `Place ${vCount} distinct vowels into ${gaps} gaps in P(${gaps}, ${vCount}) = ${nPr(gaps, vCount)} ways`,
        `Total ways = ${fact(cCount)} × ${nPr(gaps, vCount)} = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Gap method: ${cCount}! × P(${gaps}, ${vCount}) = ${ans}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY D: Arrangements with Repeated Letters (D1–D3)
// ============================================================================

// D1. One or Multiple Repeated Letters — Total Arrangements
function genD1_RepeatedLettersAll(rng, difficulty) {
  const words =
    difficulty === "Easy"
      ? ["APPLE", "ASSET", "CHEQUE", "TELLER", "OFFICE", "DOLLAR"]
      : ["BANKING", "ACCOUNT", "RESERVE", "DEBITED", "BALANCE", "SUCCESS", "FINANCE", "MANAGER"];
  const word = rng.pick(words);
  const { clean, length, freq } = getLetterFrequencies(word);
  const counts = Object.values(freq);
  const ans = multinomial(length, counts);
  const wrongNoDiv = fact(length);
  const repeatedDesc = Object.entries(freq)
    .filter(([, c]) => c > 1)
    .map(([ch, c]) => `${ch} (${c} times)`)
    .join(", ");

  return assemblePncQ({
    templateId: "PNC_D1_REPEATED_ALL",
    question_type: "Arrangements with Repeated Letters",
    sub_type: "Arranging letters of a word with repeated letters",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `How many distinct arrangements can be formed using all the letters of the word "${clean}"?`,
    mathModel: { kind: "WORD_ARRANGEMENT", word: clean, mode: "ALL" },
    exactBigIntAnswer: ans,
    plausible: [wrongNoDiv, ans * 2n, ans / 2n > 0n ? ans / 2n : ans + 6n, fact(length - 1)],
    solution: {
      given_data: [`Word = "${clean}" (${length} letters)`, `Repeated letters: ${repeatedDesc}`],
      concept: "Permutation of objects where some letters are identical — divide n! by factorials of repetition counts.",
      formula: "n! / (p! × q! × ...)",
      steps: [
        `Total letters = ${length}; Repetitions: ${repeatedDesc}`,
        `Distinct arrangements = ${length}! / (${counts.filter((c) => c > 1).map((c) => `${c}!`).join(" × ")}) = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Always count repeated letters first (${repeatedDesc}) and divide ${length}! by their factorials.`,
    rng,
  });
}

// D2. Repeated-Letter Word with Vowels Always Together
function genD2_RepeatedVowelsTogether(rng, difficulty) {
  const word = rng.pick(["RESERVE", "ACCOUNT", "BALANCE", "FINANCE", "MANAGER", "BANKING"]);
  const { clean, length, freq } = getLetterFrequencies(word);
  const vowels = [...clean].filter((ch) => VOWEL_SET.has(ch));
  const consonants = [...clean].filter((ch) => !VOWEL_SET.has(ch));
  const vFreq = {};
  const cFreq = {};
  for (const v of vowels) vFreq[v] = (vFreq[v] || 0) + 1;
  for (const c of consonants) cFreq[c] = (cFreq[c] || 0) + 1;

  const outer = multinomial(consonants.length + 1, Object.values(cFreq));
  const inner = multinomial(vowels.length, Object.values(vFreq));
  const ans = outer * inner;

  return assemblePncQ({
    templateId: "PNC_D2_REPEATED_VOWELS_TOGETHER",
    question_type: "Arrangements with Repeated Letters",
    sub_type: "Repeated-letter word with vowels always together",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: `In how many distinct ways can the letters of the word "${clean}" be arranged so that all the vowels always stay together?`,
    mathModel: { kind: "WORD_ARRANGEMENT", word: clean, mode: "VOWELS_TOGETHER" },
    exactBigIntAnswer: ans,
    plausible: [outer, outer * fact(vowels.length), multinomial(length, Object.values(freq)), ans * 2n],
    solution: {
      given_data: [`Word = "${clean}" (${length} letters)`, `Vowels = [${vowels.join(", ")}]`, `Consonants = [${consonants.join(", ")}]`],
      concept: "Block permutation with repeated-letter adjustment inside both the outer blocks and the vowel block.",
      formula: "[Outer blocks! / (consonant rep!)] × [Vowels! / (vowel rep!)]",
      steps: [
        `Treat the ${vowels.length} vowels as 1 block ⇒ ${consonants.length + 1} outer units arranged in ${outer} ways`,
        `Arrange the ${vowels.length} vowels internally (accounting for repeats) in ${inner} ways`,
        `Total distinct arrangements = ${outer} × ${inner} = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Divide by repeated-letter factorials separately for outer blocks (${outer}) and inner vowel block (${inner}).`,
    rng,
  });
}

// ============================================================================
// CATEGORY E: Arrangement of Objects Together (E1–E2)
// ============================================================================

// E1. k Specified People Sitting Together in a Row
function genE1_PeopleTogether(rng, difficulty) {
  const n = rng.pick([6, 7, 8]);
  const k = difficulty === "Easy" ? 2 : rng.pick([2, 3]);
  const ans = fact(n - k + 1) * fact(k);
  const wrongNoInternal = fact(n - k + 1);

  return assemblePncQ({
    templateId: "PNC_E1_PEOPLE_TOGETHER",
    question_type: "Arrangement of Objects Together",
    sub_type: `${k} specified people sitting together in a row`,
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `In how many ways can ${n} distinct people be seated in a straight row such that ${k} particular friends always sit together?`,
    mathModel: { kind: "LINEAR_RESTRICTION", n, mode: "TOGETHER", k },
    exactBigIntAnswer: ans,
    plausible: [wrongNoInternal, fact(n), fact(n - k) * fact(k), fact(n) - ans],
    solution: {
      given_data: [`Total people = ${n}`, `Group to sit together = ${k} friends`],
      concept: "Block method permutation: treat the group as 1 block and multiply by its internal arrangements.",
      formula: "(n − k + 1)! × k!",
      steps: [
        `Treat the ${k} friends as 1 single block ⇒ Total units = ${n} − ${k} + 1 = ${n - k + 1}`,
        `Arrange ${n - k + 1} units in ${n - k + 1}! = ${fact(n - k + 1)} ways`,
        `Arrange the ${k} friends within their block in ${k}! = ${fact(k)} ways`,
        `Total arrangements = ${fact(n - k + 1)} × ${fact(k)} = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `(${n} − ${k} + 1)! × ${k}! = ${fact(n - k + 1)} × ${fact(k)} = ${ans}.`,
    rng,
  });
}

// E2. Two Separate Subject Blocks Arranged Together (e.g. Math books together & Quant books together)
function genE2_TwoBlocksTogether(rng, difficulty) {
  const a = rng.pick([3, 4]);
  const b = rng.pick([2, 3, 4]);
  const n = a + b;
  const ans = 2n * fact(a) * fact(b);

  return assemblePncQ({
    templateId: "PNC_E2_TWO_BLOCKS",
    question_type: "Arrangement of Objects Together",
    sub_type: "Two distinct groups each kept together",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS RRB PO"],
    question: `In how many ways can ${a} distinct Quantitative Aptitude books and ${b} distinct Reasoning books be arranged on a shelf so that all books of the same subject are kept together?`,
    mathModel: { kind: "LINEAR_RESTRICTION", n, mode: "TWO_BLOCKS_TOGETHER", a, b },
    exactBigIntAnswer: ans,
    plausible: [fact(a) * fact(b), fact(n), fact(a + 1) * fact(b), fact(b + 1) * fact(a)],
    solution: {
      given_data: [`Quant books = ${a}`, `Reasoning books = ${b}`, "Same-subject books stay together"],
      concept: "Block permutation: 2 subject blocks can be ordered in 2! ways, multiplied by internal permutations of each block.",
      formula: "2! × a! × b!",
      steps: [
        `Arrange the 2 subject blocks in 2! = 2 ways`,
        `Arrange Quant books in ${a}! = ${fact(a)} ways and Reasoning books in ${b}! = ${fact(b)} ways`,
        `Total arrangements = 2 × ${fact(a)} × ${fact(b)} = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Don't forget the 2! ordering of the two subject blocks: 2 × ${fact(a)} × ${fact(b)} = ${ans}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY F: Arrangement of Objects Not Together (F1–F2)
// ============================================================================

// F1. Two Specified People Never Sit Together (Complement / Gap Method)
function genF1_TwoNotTogether(rng, difficulty) {
  const n = rng.pick([5, 6, 7]);
  const total = fact(n);
  const together = fact(n - 1) * 2n;
  const ans = total - together;

  return assemblePncQ({
    templateId: "PNC_F1_TWO_NOT_TOGETHER",
    question_type: "Arrangement of Objects Not Together",
    sub_type: "Two specified people not sitting together",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `In how many ways can ${n} distinct people be seated in a row such that two particular people never sit next to each other?`,
    mathModel: { kind: "LINEAR_RESTRICTION", n, mode: "TWO_NOT_TOGETHER" },
    exactBigIntAnswer: ans,
    plausible: [together, total, total - fact(n - 1), fact(n - 2) * nCr(n - 1, 2)],
    solution: {
      given_data: [`Total people = ${n}`, "2 specified people must NOT sit adjacent"],
      concept: "Complementary counting: subtract arrangements where the 2 people sit together from total arrangements.",
      formula: "n! − (n − 1)! × 2!",
      steps: [
        `Total unconstrained arrangements = ${n}! = ${total}`,
        `Arrangements with the 2 people together = ${n - 1}! × 2! = ${together}`,
        `Arrangements with them NOT together = ${total} − ${together} = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `n! − 2(n−1)! = (n−2)(n−1)! = ${n - 2} × ${fact(n - 1)} = ${ans}.`,
    rng,
  });
}

// F2. No Two of k People Sit Together (Gap Method)
function genF2_NoTwoOfKTogether(rng, difficulty) {
  const configs = [
    [4, 3], // 4 boys, 3 girls => 4! * P(5, 3) = 24 * 60 = 1440
    [5, 3], // 5 boys, 3 girls => 5! * P(6, 3) = 120 * 120 = 14400
    [4, 2], // 4 boys, 2 girls => 4! * P(5, 2) = 24 * 20 = 480
    [5, 2], // 5 boys, 2 girls => 5! * P(6, 2) = 120 * 30 = 3600
    [3, 3], // 3 boys, 3 girls => 3! * P(4, 3) = 6 * 24 = 144
  ];
  const [boys, girls] = rng.pick(configs);
  const n = boys + girls;
  const gaps = boys + 1;
  const ans = fact(boys) * nPr(gaps, girls);

  return assemblePncQ({
    templateId: "PNC_F2_NO_TWO_OF_K_TOGETHER",
    question_type: "Arrangement of Objects Not Together",
    sub_type: "No two restricted people sitting adjacent (Gap Method)",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: `In how many ways can ${boys} boys and ${girls} girls be seated in a straight row so that no two girls sit next to each other?`,
    mathModel: { kind: "LINEAR_RESTRICTION", n, mode: "NO_TWO_OF_K_TOGETHER", k: girls },
    exactBigIntAnswer: ans,
    plausible: [fact(n) - fact(boys + 1) * fact(girls), fact(boys) * nCr(gaps, girls), fact(boys) * fact(girls), fact(boys + 1) * fact(girls)],
    solution: {
      given_data: [`Boys = ${boys}`, `Girls = ${girls}`, "No two girls may sit adjacent"],
      concept: "Gap method (do NOT use simple complement when 3+ girls exist, as partial adjacencies are missed).",
      formula: "Boys! × P(Boys + 1, Girls)",
      steps: [
        `Seat ${boys} boys in ${boys}! = ${fact(boys)} ways, creating ${gaps} gaps`,
        `Seat ${girls} girls in ${gaps} gaps in P(${gaps}, ${girls}) = ${nPr(gaps, girls)} ways`,
        `Total ways = ${fact(boys)} × ${nPr(gaps, girls)} = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Always use Gap Method for 3+ separated items: ${boys}! × P(${gaps}, ${girls}) = ${ans}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY G: Circular Permutation (G1–G3)
// ============================================================================

// G1. Arranging n Distinct People Around a Circular Table (Rotations Identical)
function genG1_CircularTable(rng, difficulty) {
  const n = rng.pick([5, 6, 7, 8]);
  const ans = fact(n - 1);

  return assemblePncQ({
    templateId: "PNC_G1_CIRCULAR_TABLE",
    question_type: "Circular Permutation",
    sub_type: "People seated around a circular table",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `In how many distinct ways can ${n} people be seated around a circular conference table (where rotations of the same seating order are considered identical, and reflections are distinct)?`,
    mathModel: { kind: "CIRCULAR_PERM", n, mode: "TABLE" },
    exactBigIntAnswer: ans,
    plausible: [fact(n), fact(n - 1) / 2n, fact(n - 2), fact(n - 1) * 2n],
    solution: {
      given_data: [`Number of people (n) = ${n}`, "Circular table: rotations identical, reflections distinct"],
      concept: "Circular permutation fixes 1 person as reference and arranges the remaining (n − 1) people.",
      formula: "(n − 1)!",
      steps: [
        `Fix 1 person at any seat to eliminate rotational duplicates`,
        `Arrange the remaining ${n - 1} people in (${n} − 1)! = ${ans} ways`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Circular table seating = (n − 1)! = ${n - 1}! = ${ans} (not n!).`,
    rng,
  });
}

// G2. Circular Table — Two Specified People Together or Not Together
function genG2_CircularTogetherOrNot(rng, difficulty) {
  const n = rng.pick([6, 7, 8]);
  const isTogether = rng.random() < 0.5;
  const togetherAns = fact(n - 2) * 2n;
  const totalCircular = fact(n - 1);
  const ans = isTogether ? togetherAns : totalCircular - togetherAns;

  return assemblePncQ({
    templateId: isTogether ? "PNC_G2_CIRCULAR_TOGETHER" : "PNC_G2_CIRCULAR_NOT_TOGETHER",
    question_type: "Circular Permutation",
    sub_type: isTogether ? "Two people sitting together in a circle" : "Two people not sitting together in a circle",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: `In how many distinct ways can ${n} delegates be seated around a circular table (rotations considered identical) such that two particular delegates ${isTogether ? "always sit together" : "never sit next to each other"}?`,
    mathModel: { kind: "CIRCULAR_PERM", n, mode: isTogether ? "TABLE_TWO_TOGETHER" : "TABLE_TWO_NOT_TOGETHER" },
    exactBigIntAnswer: ans,
    plausible: [isTogether ? totalCircular - togetherAns : togetherAns, fact(n - 2), totalCircular, fact(n - 1) * 2n],
    solution: {
      given_data: [`Total delegates = ${n}`, "Circular seating (rotations identical)"],
      concept: isTogether
        ? "Treat the 2 delegates as 1 block ⇒ (n − 1) circular units arranged in (n − 2)! × 2! ways."
        : "Subtract circular arrangements where the 2 delegates sit together from (n − 1)!.",
      formula: isTogether ? "(n − 2)! × 2!" : "(n − 1)! − (n − 2)! × 2!",
      steps: isTogether
        ? [
            `Combining 2 delegates into 1 block leaves ${n - 1} units around the circle`,
            `Circular arrangements = (${n - 1} − 1)! × 2! = ${fact(n - 2)} × 2 = ${ans}`,
          ]
        : [
            `Total circular arrangements = (${n} − 1)! = ${totalCircular}`,
            `Arrangements with the 2 delegates together = (${n} − 2)! × 2! = ${togetherAns}`,
            `Not together = ${totalCircular} − ${togetherAns} = ${ans}`,
          ],
      final_answer: String(ans),
    },
    shortcut_method: isTogether ? `(${n}−2)! × 2 = ${ans}.` : `(${n}−1)! − 2(${n}−2)! = ${ans}.`,
    rng,
  });
}

// G3. Necklace / Garland Permutation (Rotations AND Reflections Identical)
function genG3_NecklacePermutation(rng, difficulty) {
  const n = rng.pick([5, 6, 7, 8]);
  const ans = fact(n - 1) / 2n;

  return assemblePncQ({
    templateId: "PNC_G3_NECKLACE",
    question_type: "Circular Permutation",
    sub_type: "Necklace arrangement (rotations and reflections identical)",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: `In how many distinct ways can ${n} beads of different colours be strung together to form a necklace (where both rotations and flipping the necklace over are considered identical)?`,
    mathModel: { kind: "CIRCULAR_PERM", n, mode: "NECKLACE" },
    exactBigIntAnswer: ans,
    plausible: [fact(n - 1), fact(n), fact(n) / 2n, fact(n - 2)],
    solution: {
      given_data: [`Number of distinct beads (n) = ${n}`, "Necklace: clockwise and anticlockwise orders are identical"],
      concept: "Circular permutation with reflection symmetry — divide (n − 1)! by 2.",
      formula: "(n − 1)! / 2",
      steps: [
        `Circular arrangements without flipping = (${n} − 1)! = ${fact(n - 1)}`,
        `Since a necklace can be flipped over, divide by 2: ${fact(n - 1)} / 2 = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `For a necklace or garland (n ≥ 3), always use (n − 1)! / 2 = ${ans}.`,
    rng,
  });
}

export const PNC_TEMPLATES_PART_1 = [
  { id: "PNC_A1", category: "A", difficulties: ["Easy"], fn: genA1_DistinctRow },
  { id: "PNC_A2", category: "A", difficulties: ["Easy"], fn: genA2_SelectAndArrange },

  { id: "PNC_B1", category: "B", difficulties: ["Easy"], fn: genB1_BasicSelection },
  { id: "PNC_B2", category: "B", difficulties: ["Easy"], fn: genB2_Handshakes },

  { id: "PNC_C1", category: "C", difficulties: ["Easy"], fn: genC1_DistinctWordAll },
  { id: "PNC_C2", category: "C", difficulties: ["Medium"], fn: genC2_WordVowelsTogether },
  { id: "PNC_C3", category: "C", difficulties: ["Medium", "Hard"], fn: genC3_NoTwoVowelsTogether },

  { id: "PNC_D1", category: "D", difficulties: ["Easy", "Medium"], fn: genD1_RepeatedLettersAll },
  { id: "PNC_D2", category: "D", difficulties: ["Medium", "Hard"], fn: genD2_RepeatedVowelsTogether },

  { id: "PNC_E1", category: "E", difficulties: ["Easy", "Medium"], fn: genE1_PeopleTogether },
  { id: "PNC_E2", category: "E", difficulties: ["Medium"], fn: genE2_TwoBlocksTogether },

  { id: "PNC_F1", category: "F", difficulties: ["Medium"], fn: genF1_TwoNotTogether },
  { id: "PNC_F2", category: "F", difficulties: ["Medium", "Hard"], fn: genF2_NoTwoOfKTogether },

  { id: "PNC_G1", category: "G", difficulties: ["Medium"], fn: genG1_CircularTable },
  { id: "PNC_G2", category: "G", difficulties: ["Medium", "Hard"], fn: genG2_CircularTogetherOrNot },
  { id: "PNC_G3", category: "G", difficulties: ["Medium", "Hard"], fn: genG3_NecklacePermutation },
];