// Place at: server/question-engine/generators/quant/permutationCombination/pncTemplatesPart2.js
import {
  fact,
  nPr,
  nCr,
  derangement,
  multinomial,
  getLetterFrequencies,
  VOWEL_SET,
} from "./pncMath.js";
import { assemblePncQ } from "./pncTemplatesPart1.js";

// ============================================================================
// CATEGORY H: Digit Formation (H1–H4 — Verified by Engine B Brute Force!)
// ============================================================================

// H1. Forming 3- or 4-Digit Numbers Without Repetition (With or Without Zero)
function genH1_DigitBasicNoRep(rng, difficulty) {
  const hasZero = difficulty !== "Easy";
  const digits = hasZero
    ? rng.pick([[0, 1, 2, 3, 4, 5], [0, 2, 3, 5, 7, 8], [0, 1, 3, 4, 6, 7]])
    : rng.pick([[1, 2, 3, 4, 5], [2, 3, 4, 5, 6, 7], [1, 3, 5, 7, 8, 9]]);
  const len = rng.pick([3, 4]);
  const n = digits.length;
  const ans = hasZero ? BigInt(n - 1) * nPr(n - 1, len - 1) : nPr(n, len);
  const wrongLeadingZero = nPr(n, len);
  const wrongWithRep = hasZero ? BigInt(n - 1) * BigInt(n) ** BigInt(len - 1) : BigInt(n) ** BigInt(len);

  return assemblePncQ({
    templateId: hasZero ? "PNC_H1_DIGITS_WITH_ZERO" : "PNC_H1_DIGITS_NO_ZERO",
    question_type: "Digit Formation",
    sub_type: hasZero ? "Numbers without repetition (zero included)" : "Numbers without repetition (non-zero digits)",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `How many ${len}-digit numbers can be formed using the digits {${digits.join(", ")}} if repetition of digits is NOT allowed?`,
    mathModel: { kind: "DIGIT_FORMATION", digits, length: len, allowRepetition: false, condition: "ANY" },
    exactBigIntAnswer: ans,
    plausible: [wrongLeadingZero, wrongWithRep, nCr(n, len), ans + BigInt(n)],
    solution: {
      given_data: [`Digits = {${digits.join(", ")}} (${n} digits)`, `Length = ${len} digits`, "No repetition allowed"],
      concept: "Permutation with positional restriction: zero cannot occupy the first (most significant) digit.",
      formula: hasZero ? "(n − 1) × P(n − 1, k − 1)" : "P(n, k)",
      steps: hasZero
        ? [
            `First digit cannot be 0 ⇒ ${n - 1} choices for the first place`,
            `Remaining ${len - 1} places can be filled from remaining ${n - 1} digits in P(${n - 1}, ${len - 1}) = ${nPr(n - 1, len - 1)} ways`,
            `Total numbers = ${n - 1} × ${nPr(n - 1, len - 1)} = ${ans}`,
          ]
        : [
            `All ${n} available digits are non-zero, so any digit can occupy the first position`,
            `Number of ${len}-digit numbers without repetition = P(${n}, ${len}) = ${n}! / (${n} − ${len})! = ${ans}`,
          ],
      final_answer: String(ans),
    },
    shortcut_method: hasZero
      ? `Fill the first digit first (${n - 1} non-zero choices), then arrange the rest: ${n - 1} × ${nPr(n - 1, len - 1)} = ${ans}.`
      : `Direct P(${n}, ${len}) = ${ans}.`,
    rng,
  });
}

// H2. Forming Even or Odd 3-Digit Numbers Without Repetition (Includes Zero Case!)
function genH2_DigitEvenOdd(rng, difficulty) {
  const configs = [
    // [digits, condition, expectedAns]
    [[1, 2, 3, 4, 5, 6], "EVEN", 60n],   // last: 3 choices (2,4,6), rest: 5*4=20 => 60
    [[1, 2, 3, 4, 5, 6], "ODD", 60n],    // last: 3 choices (1,3,5), rest: 5*4=20 => 60
    [[0, 1, 2, 3, 4, 5], "EVEN", 52n],   // ends 0: 5*4=20; ends 2,4: 2*(4*4)=32 => 52
    [[0, 1, 2, 3, 4, 5], "ODD", 48n],    // last: 3 choices (1,3,5), first: 4 non-zero, mid: 4 => 3*4*4=48
    [[0, 2, 3, 5, 6, 7], "EVEN", 52n],   // ends 0: 5*4=20; ends 2,6: 2*(4*4)=32 => 52
    [[0, 1, 3, 4, 5, 8], "ODD", 48n],    // last: 3 choices (1,3,5), first: 4, mid: 4 => 48
  ];
  const [digits, cond, ans] = rng.pick(configs);
  const hasZero = digits.includes(0);

  return assemblePncQ({
    templateId: `PNC_H2_DIGITS_${cond}`,
    question_type: "Digit Formation",
    sub_type: `Forming 3-digit ${cond.toLowerCase()} numbers without repetition`,
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `How many 3-digit ${cond.toLowerCase()} numbers can be formed using the digits {${digits.join(", ")}} without repeating any digit?`,
    mathModel: { kind: "DIGIT_FORMATION", digits, length: 3, allowRepetition: false, condition: cond },
    exactBigIntAnswer: ans,
    plausible: [60n, 48n, 52n, 100n, 120n].filter((x) => x !== ans),
    solution: {
      given_data: [`Digits = {${digits.join(", ")}}`, `Condition: 3-digit ${cond.toLowerCase()} number`, "No repetition"],
      concept: "Position-based permutation: satisfy the units-digit parity constraint first, handling 0 separately if present.",
      formula: hasZero && cond === "EVEN" ? "Case 1 (ends in 0) + Case 2 (ends in non-zero even)" : "Units choices × Hundreds choices × Tens choices",
      steps:
        hasZero && cond === "EVEN"
          ? [
              `Case 1 (units digit = 0): remaining 2 places filled in 5 × 4 = 20 ways`,
              `Case 2 (units digit ∈ {non-zero evens}, 2 choices): hundreds has 4 non-zero choices, tens has 4 ⇒ 2 × 4 × 4 = 32 ways`,
              `Total 3-digit even numbers = 20 + 32 = ${ans}`,
            ]
          : [
              `Units digit has 3 valid ${cond.toLowerCase()} choices`,
              `Hundreds digit has ${hasZero ? 4 : 5} non-zero choices and tens digit has 4 remaining choices`,
              `Total = ${ans}`,
            ],
      final_answer: String(ans),
    },
    shortcut_method: hasZero && cond === "EVEN"
      ? `Always split into "ends with 0" (20) and "ends with non-zero even" (32) ⇒ 52.`
      : `Fix the units digit first, then fill hundreds (excluding 0) and tens.`,
    rng,
  });
}

// H3. Forming Numbers Divisible by 5 (With or Without Repetition)
function genH3_DigitDivBy5(rng, difficulty) {
  const allowRep = rng.random() < 0.5;
  const digits = [0, 1, 2, 3, 5, 7];
  // Length 3:
  // If allowRep: first (5 non-zero) * mid (6) * last (2: 0 or 5) = 60
  // If noRep: ends 0 => 5*4=20; ends 5 => 4*4=16 => 36
  const ans = allowRep ? 60n : 36n;

  return assemblePncQ({
    templateId: allowRep ? "PNC_H3_DIV5_REP" : "PNC_H3_DIV5_NOREP",
    question_type: "Digit Formation",
    sub_type: `3-digit numbers divisible by 5 (${allowRep ? "repetition allowed" : "no repetition"})`,
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Prelims"],
    question: `How many 3-digit numbers divisible by 5 can be formed using the digits {${digits.join(", ")}} if repetition of digits is ${allowRep ? "ALLOWED" : "NOT allowed"}?`,
    mathModel: { kind: "DIGIT_FORMATION", digits, length: 3, allowRepetition: allowRep, condition: "DIV_BY_5" },
    exactBigIntAnswer: ans,
    plausible: [allowRep ? 36n : 60n, 40n, 72n, 48n],
    solution: {
      given_data: [`Digits = {${digits.join(", ")}}`, "Divisible by 5 ⇒ units digit must be 0 or 5", allowRep ? "Repetition allowed" : "No repetition"],
      concept: "Divisibility by 5 restricts the last digit to {0, 5}, while the first digit cannot be 0.",
      formula: allowRep ? "5 × 6 × 2" : "Case (ends in 0) + Case (ends in 5)",
      steps: allowRep
        ? [
            `Hundreds digit (non-zero): 5 choices; Tens digit: 6 choices; Units digit (0 or 5): 2 choices`,
            `Total = 5 × 6 × 2 = ${ans}`,
          ]
        : [
            `Case 1 (ends in 0): 5 × 4 = 20 numbers`,
            `Case 2 (ends in 5): 4 (non-zero) × 4 = 16 numbers`,
            `Total = 20 + 16 = ${ans}`,
          ],
      final_answer: String(ans),
    },
    shortcut_method: allowRep ? `5 × 6 × 2 = 60.` : `Split ends-in-0 (20) + ends-in-5 (16) = 36.`,
    rng,
  });
}

// H4. Numbers Greater Than a Specified Threshold (e.g., > 400 or > 5000)
function genH4_DigitGreaterThan(rng, difficulty) {
  const digits = [1, 2, 3, 5, 6, 7];
  const threshold = rng.pick([300, 500]);
  // For 3-digit no-rep > 300: first digit in {3,5,6,7} (4 choices) * 5 * 4 = 80
  // For 3-digit no-rep > 500: first digit in {5,6,7} (3 choices) * 5 * 4 = 60
  const firstChoices = threshold === 300 ? 4n : 3n;
  const ans = firstChoices * 5n * 4n;

  return assemblePncQ({
    templateId: "PNC_H4_DIGITS_GREATER_THAN",
    question_type: "Digit Formation",
    sub_type: "Numbers greater than a specified threshold",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: `How many 3-digit numbers greater than ${threshold} can be formed using the digits {${digits.join(", ")}} without repetition of digits?`,
    mathModel: { kind: "DIGIT_FORMATION", digits, length: 3, allowRepetition: false, condition: "GREATER_THAN", threshold },
    exactBigIntAnswer: ans,
    plausible: [ans + 20n, ans - 20n, firstChoices * 6n * 6n, nPr(6, 3)],
    solution: {
      given_data: [`Digits = {${digits.join(", ")}}`, `Number > ${threshold}`, "3-digit number, no repetition"],
      concept: "Fix the hundreds digit to satisfy the threshold first, then permute remaining digits.",
      formula: "(Valid first digits) × P(5, 2)",
      steps: [
        `For a 3-digit number to exceed ${threshold}, the hundreds digit must be ≥ ${threshold / 100} ⇒ ${firstChoices} choices`,
        `Remaining 2 positions can be filled in 5 × 4 = 20 ways`,
        `Total = ${firstChoices} × 20 = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `${firstChoices} valid starting digits × 5 × 4 = ${ans}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY I: Committee and Team Formation (I1–I2)
// ============================================================================

// I1. Fixed Category Counts (Men & Women)
function genI1_CommitteeFixedCounts(rng, difficulty) {
  const men = rng.randInt(5, 8);
  const women = rng.randInt(4, 7);
  const pickM = rng.pick([2, 3]);
  const pickW = rng.pick([2, 3]);
  const ans = nCr(men, pickM) * nCr(women, pickW);

  return assemblePncQ({
    templateId: "PNC_I1_COMMITTEE_FIXED",
    question_type: "Committee and Team Formation",
    sub_type: "Selecting men and women with fixed counts",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `A committee of ${pickM + pickW} members is to be formed from ${men} men and ${women} women. In how many ways can the committee be formed if it must consist of exactly ${pickM} men and ${pickW} women?`,
    mathModel: { kind: "COMMITTEE_SELECTION", groupA: men, groupB: women, selectTotal: pickM + pickW, mode: "EXACT", reqA: pickM },
    exactBigIntAnswer: ans,
    plausible: [nCr(men, pickM) + nCr(women, pickW), nPr(men, pickM) * nPr(women, pickW), nCr(men + women, pickM + pickW), ans + 15n],
    solution: {
      given_data: [`Men = ${men} (choose ${pickM})`, `Women = ${women} (choose ${pickW})`],
      concept: "Combination because order of committee members does not matter; multiply independent category choices.",
      formula: "C(M, r₁) × C(W, r₂)",
      steps: [
        `Ways to select ${pickM} men = C(${men}, ${pickM}) = ${nCr(men, pickM)}`,
        `Ways to select ${pickW} women = C(${women}, ${pickW}) = ${nCr(women, pickW)}`,
        `Total committees = ${nCr(men, pickM)} × ${nCr(women, pickW)} = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Multiply C(${men},${pickM}) × C(${women},${pickW}) = ${ans} (do not add them).`,
    rng,
  });
}

// I2. Committee from 3 Categories
function genI2_ThreeCategoryTeam(rng, difficulty) {
  const groups = [rng.randInt(4, 6), rng.randInt(4, 6), rng.randInt(3, 5)];
  const picks = [2, 2, 1];
  const ans = nCr(groups[0], picks[0]) * nCr(groups[1], picks[1]) * nCr(groups[2], picks[2]);

  return assemblePncQ({
    templateId: "PNC_I2_THREE_CATEGORY_TEAM",
    question_type: "Committee and Team Formation",
    sub_type: "Selecting candidates from three categories",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains"],
    question: `An audit team of 5 members is to be chosen from ${groups[0]} Chartered Accountants, ${groups[1]} Credit Officers, and ${groups[2]} Legal Advisors. In how many ways can the team be formed if it must include 2 Chartered Accountants, 2 Credit Officers, and 1 Legal Advisor?`,
    mathModel: { kind: "COMMITTEE_SELECTION", mode: "THREE_CATEGORIES", groups, picks },
    exactBigIntAnswer: ans,
    plausible: [nCr(groups[0], 2) + nCr(groups[1], 2) + nCr(groups[2], 1), nCr(groups[0] + groups[1] + groups[2], 5), ans * 2n, ans / 2n],
    solution: {
      given_data: [`CAs = ${groups[0]} (pick 2)`, `Credit Officers = ${groups[1]} (pick 2)`, `Legal Advisors = ${groups[2]} (pick 1)`],
      concept: "Independent combinations across three disjoint categories.",
      formula: "C(n₁, 2) × C(n₂, 2) × C(n₃, 1)",
      steps: [
        `C(${groups[0]}, 2) = ${nCr(groups[0], 2)}, C(${groups[1]}, 2) = ${nCr(groups[1], 2)}, C(${groups[2]}, 1) = ${nCr(groups[2], 1)}`,
        `Total teams = ${nCr(groups[0], 2)} × ${nCr(groups[1], 2)} × ${nCr(groups[2], 1)} = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Multiply the three combinations directly = ${ans}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY J: Selection with Conditions (Mandatory / Excluded — J1–J2)
// ============================================================================

// J1. Mandatory Inclusion of Particular Member(s)
function genJ1_MandatorySelection(rng, difficulty) {
  const total = rng.randInt(9, 13);
  const selectTotal = rng.pick([4, 5]);
  const mandatoryCount = rng.pick([1, 2]);
  const ans = nCr(total - mandatoryCount, selectTotal - mandatoryCount);

  return assemblePncQ({
    templateId: "PNC_J1_MANDATORY_MEMBER",
    question_type: "Selection with Conditions",
    sub_type: "Mandatory inclusion of specified member(s)",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
    question: `From a pool of ${total} applicants, a shortlist of ${selectTotal} candidates is to be selected. In how many ways can this be done if ${mandatoryCount} particular applicant${mandatoryCount > 1 ? "s" : ""} must ALWAYS be included?`,
    mathModel: { kind: "COMMITTEE_SELECTION", groupA: total, groupB: 0, selectTotal, mode: "MANDATORY", mandatoryCount },
    exactBigIntAnswer: ans,
    plausible: [nCr(total, selectTotal), nCr(total - mandatoryCount, selectTotal), nCr(total, selectTotal - mandatoryCount), ans * 2n],
    solution: {
      given_data: [`Total pool = ${total}`, `Team size = ${selectTotal}`, `Mandatory members = ${mandatoryCount}`],
      concept: "Fix the mandatory member(s) first, then choose the remaining spots from the remaining pool.",
      formula: "C(n − m, r − m)",
      steps: [
        `Since ${mandatoryCount} member(s) are already fixed, we need ${selectTotal - mandatoryCount} more from ${total - mandatoryCount} remaining applicants`,
        `Number of ways = C(${total - mandatoryCount}, ${selectTotal - mandatoryCount}) = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Subtract ${mandatoryCount} from both n and r: C(${total - mandatoryCount}, ${selectTotal - mandatoryCount}) = ${ans}.`,
    rng,
  });
}

// J2. Mandatory Exclusion of Particular Member(s)
function genJ2_ExcludedSelection(rng, difficulty) {
  const total = rng.randInt(9, 13);
  const selectTotal = rng.pick([4, 5]);
  const excludedCount = rng.pick([1, 2]);
  const ans = nCr(total - excludedCount, selectTotal);

  return assemblePncQ({
    templateId: "PNC_J2_EXCLUDED_MEMBER",
    question_type: "Selection with Conditions",
    sub_type: "Exclusion of specified member(s)",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
    question: `In how many ways can a team of ${selectTotal} players be chosen from ${total} players if ${excludedCount} particular player${excludedCount > 1 ? "s" : ""} must NEVER be selected?`,
    mathModel: { kind: "COMMITTEE_SELECTION", groupA: total, groupB: 0, selectTotal, mode: "EXCLUDED", excludedCount },
    exactBigIntAnswer: ans,
    plausible: [nCr(total, selectTotal), nCr(total - excludedCount, selectTotal - excludedCount), nCr(total, selectTotal - excludedCount), ans + 10n],
    solution: {
      given_data: [`Total players = ${total}`, `Team size = ${selectTotal}`, `Excluded players = ${excludedCount}`],
      concept: "Remove excluded players from the available pool, keeping team size r unchanged.",
      formula: "C(n − e, r)",
      steps: [
        `Available players after excluding ${excludedCount} = ${total - excludedCount}`,
        `Ways to select ${selectTotal} players = C(${total - excludedCount}, ${selectTotal}) = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Subtract ${excludedCount} from n only (not r): C(${total - excludedCount}, ${selectTotal}) = ${ans}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY K: Group Formation and Distribution (K1–K3)
// ============================================================================

// K1. Dividing Distinct People into Unlabelled Equal-Sized Groups
function genK1_UnlabelledEqualGroups(rng, difficulty) {
  const configs = [
    [6, [2, 2, 2]], // 6! / ((2!)^3 * 3!) = 15
    [6, [3, 3]],    // 6! / ((3!)^2 * 2!) = 10
    [8, [4, 4]],    // 8! / ((4!)^2 * 2!) = 35
    [9, [3, 3, 3]], // 9! / ((3!)^3 * 3!) = 280
    [8, [2, 2, 2, 2]], // 8! / ((2!)^4 * 4!) = 105
  ];
  const [n, sizes] = rng.pick(configs);
  const k = sizes.length;
  const sz = sizes[0];
  const labelledWays = multinomial(n, sizes);
  const ans = labelledWays / fact(k);

  return assemblePncQ({
    templateId: "PNC_K1_UNLABELLED_EQUAL_GROUPS",
    question_type: "Group Formation and Distribution",
    sub_type: "Dividing distinct people into unlabelled equal-sized groups",
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains", "SBI PO Prelims"],
    question: `In how many ways can ${n} distinct students be divided into ${k} unlabelled (indistinguishable) study groups of ${sz} students each?`,
    mathModel: { kind: "GROUP_DIST", mode: "UNLABELLED_GROUPS", n, sizes },
    exactBigIntAnswer: ans,
    plausible: [labelledWays, nCr(n, sz), ans * 2n, fact(n) / fact(sz)],
    solution: {
      given_data: [`Total distinct students = ${n}`, `${k} unlabelled groups of size ${sz} each`],
      concept: "Because the groups are unlabelled and equal in size, swapping groups does not create a new division — divide by k!.",
      formula: "n! / [(s!)^k × k!]",
      steps: [
        `Labelled divisions = ${n}! / (${sz}!)^${k} = ${labelledWays}`,
        `Since the ${k} groups are unlabelled, divide by ${k}! = ${fact(k)}`,
        `Unlabelled divisions = ${labelledWays} / ${fact(k)} = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `For k unlabelled equal groups of size s, ALWAYS divide by k!: ${labelledWays} / ${fact(k)} = ${ans}.`,
    rng,
  });
}

// K2. Dividing Distinct People into Labelled Groups of Unequal Sizes
function genK2_LabelledGroups(rng, difficulty) {
  const configs = [
    [7, [3, 2, 2]], // 7! / (3!2!2!) = 210
    [8, [3, 3, 2]], // 8! / (3!3!2!) = 560
    [9, [4, 3, 2]], // 9! / (4!3!2!) = 1260
    [7, [4, 2, 1]], // 7! / (4!2!1!) = 105
  ];
  const [n, sizes] = rng.pick(configs);
  const ans = multinomial(n, sizes);

  return assemblePncQ({
    templateId: "PNC_K2_LABELLED_GROUPS",
    question_type: "Group Formation and Distribution",
    sub_type: "Assigning distinct people to labelled teams",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: `In how many ways can ${n} distinct officers be assigned to three distinct departments — Audit (${sizes[0]} officers), Treasury (${sizes[1]} officers), and Compliance (${sizes[2]} officers)?`,
    mathModel: { kind: "GROUP_DIST", mode: "LABELLED_GROUPS", n, sizes },
    exactBigIntAnswer: ans,
    plausible: [ans / 2n, ans * 2n, nCr(n, sizes[0]) + nCr(n - sizes[0], sizes[1]), fact(n) / fact(sizes[0])],
    solution: {
      given_data: [`Total officers = ${n}`, `Distinct departments: ${sizes.join(", ")}`],
      concept: "Because the departments are labelled (distinct), swapping officers between departments produces different assignments.",
      formula: "n! / (a! × b! × c!)",
      steps: [
        `Number of assignments = ${n}! / (${sizes.map((s) => `${s}!`).join(" × ")})`,
        `= ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Labelled teams do NOT divide by equal-size group factorials: ${n}! / (${sizes.join("!×")}!) = ${ans}.`,
    rng,
  });
}

// K3. Distributing Identical Objects Among Distinct Recipients (Stars and Bars)
function genK3_IdenticalStarsBars(rng, difficulty) {
  const atLeastOne = rng.random() < 0.5;
  const n = rng.randInt(8, 12);
  const r = rng.pick([3, 4]);
  const ans = atLeastOne ? nCr(n - 1, r - 1) : nCr(n + r - 1, r - 1);
  const other = atLeastOne ? nCr(n + r - 1, r - 1) : nCr(n - 1, r - 1);

  return assemblePncQ({
    templateId: atLeastOne ? "PNC_K3_STARS_BARS_POS" : "PNC_K3_STARS_BARS_NONNEG",
    question_type: "Group Formation and Distribution",
    sub_type: atLeastOne ? "Identical objects to distinct recipients (each gets ≥ 1)" : "Identical objects to distinct recipients (0 allowed)",
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains"],
    question: `In how many ways can ${n} identical gift vouchers be distributed among ${r} distinct employees if ${atLeastOne ? "each employee must receive at least 1 voucher" : "any employee may receive zero or more vouchers"}?`,
    mathModel: { kind: "GROUP_DIST", mode: "IDENTICAL_STARS_BARS", n, r, atLeastOne },
    exactBigIntAnswer: ans,
    plausible: [other, nCr(n, r), BigInt(r) ** BigInt(n - 4), nCr(n + r, r)],
    solution: {
      given_data: [`Identical objects (n) = ${n}`, `Distinct recipients (r) = ${r}`, atLeastOne ? "Minimum 1 each" : "Zero allowed"],
      concept: "Stars-and-Bars combination formula for distributing identical objects among distinct recipients.",
      formula: atLeastOne ? "C(n − 1, r − 1)" : "C(n + r − 1, r − 1)",
      steps: [
        atLeastOne
          ? `Required ways = C(${n} − 1, ${r} − 1) = C(${n - 1}, ${r - 1}) = ${ans}`
          : `Required ways = C(${n} + ${r} − 1, ${r} − 1) = C(${n + r - 1}, ${r - 1}) = ${ans}`,
      ].concat([`Verified count = ${ans}`]),
      final_answer: String(ans),
    },
    shortcut_method: atLeastOne ? `Stars & Bars (≥ 1 each): C(${n - 1}, ${r - 1}) = ${ans}.` : `Stars & Bars (≥ 0 each): C(${n + r - 1}, ${r - 1}) = ${ans}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY L: At Least / At Most / Exactly (L1–L2)
// ============================================================================

// L1. Committee with At Least 1 or At Least 2 from a Category
function genL1_AtLeastSelection(rng, difficulty) {
  const women = rng.randInt(4, 6);
  const men = rng.randInt(5, 7);
  const selectTotal = 4;
  const reqW = rng.pick([1, 2]);
  let ans = 0n;
  const cases = [];
  for (let w = reqW; w <= Math.min(women, selectTotal); w++) {
    const m = selectTotal - w;
    if (m >= 0 && m <= men) {
      const ways = nCr(women, w) * nCr(men, m);
      ans += ways;
      cases.push(`(${w}W, ${m}M): C(${women},${w})×C(${men},${m}) = ${ways}`);
    }
  }
  const wrongDoubleCount = nCr(women, reqW) * nCr(women + men - reqW, selectTotal - reqW);

  return assemblePncQ({
    templateId: "PNC_L1_AT_LEAST_COMMITTEE",
    question_type: "At Least / At Most / Exactly",
    sub_type: `Committee with at least ${reqW} woman/women`,
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `A committee of ${selectTotal} members is to be formed from ${women} women and ${men} men. In how many ways can the committee be formed so that it includes AT LEAST ${reqW} wom${reqW > 1 ? "en" : "an"}?`,
    mathModel: { kind: "COMMITTEE_SELECTION", groupA: women, groupB: men, selectTotal, mode: "AT_LEAST_A", reqA: reqW },
    exactBigIntAnswer: ans,
    plausible: [wrongDoubleCount, nCr(women + men, selectTotal), nCr(women, reqW) * nCr(men, selectTotal - reqW), ans - nCr(women, reqW)],
    solution: {
      given_data: [`Women = ${women}, Men = ${men}`, `Committee size = ${selectTotal}`, `Condition: at least ${reqW} women`],
      concept: "Sum disjoint valid combination cases (never use C(W,1)×C(N−1,r−1) which double-counts committees!).",
      formula: reqW === 1 ? "Total C(N, r) − No-women C(M, r)" : "Sum of C(W, w) × C(M, r − w) for w ≥ 2",
      steps: [
        `Valid disjoint cases: ${cases.join("; ")}`,
        `Total valid committees = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: reqW === 1
      ? `Complement rule: C(${women + men}, ${selectTotal}) − C(${men}, ${selectTotal}) = ${nCr(women + men, selectTotal)} − ${nCr(men, selectTotal)} = ${ans}.`
      : `Add disjoint cases w = 2, 3, 4 cleanly to avoid double counting ⇒ ${ans}.`,
    rng,
  });
}

// L2. Committee with At Most 1 or At Most 2 from a Category
function genL2_AtMostSelection(rng, difficulty) {
  const women = rng.randInt(4, 6);
  const men = rng.randInt(5, 7);
  const selectTotal = 4;
  const maxW = rng.pick([1, 2]);
  let ans = 0n;
  const cases = [];
  for (let w = 0; w <= Math.min(maxW, women); w++) {
    const m = selectTotal - w;
    if (m >= 0 && m <= men) {
      const ways = nCr(women, w) * nCr(men, m);
      ans += ways;
      cases.push(`(${w}W, ${m}M): ${ways}`);
    }
  }

  return assemblePncQ({
    templateId: "PNC_L2_AT_MOST_COMMITTEE",
    question_type: "At Least / At Most / Exactly",
    sub_type: `Committee with at most ${maxW} woman/women`,
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: `From ${women} women and ${men} men, a committee of ${selectTotal} persons is to be selected. In how many ways can this be done if AT MOST ${maxW} wom${maxW > 1 ? "en" : "an"} can be included?`,
    mathModel: { kind: "COMMITTEE_SELECTION", groupA: women, groupB: men, selectTotal, mode: "AT_MOST_A", reqA: maxW },
    exactBigIntAnswer: ans,
    plausible: [nCr(women + men, selectTotal) - ans, nCr(women, maxW) * nCr(men, selectTotal - maxW), nCr(women + men, selectTotal), ans + 12n],
    solution: {
      given_data: [`Women = ${women}, Men = ${men}`, `Committee size = ${selectTotal}`, `Condition: at most ${maxW} women (including 0)`],
      concept: "Sum all valid disjoint cases from 0 up to the maximum allowed count.",
      formula: `Sum of C(${women}, w) × C(${men}, ${selectTotal} − w) for w = 0..${maxW}`,
      steps: [
        `Disjoint cases: ${cases.join("; ")}`,
        `Total ways = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Do not forget the 0-women case (C(${men}, ${selectTotal}) = ${nCr(men, selectTotal)}) when counting "at most ${maxW}".`,
    rng,
  });
}

// ============================================================================
// CATEGORY M: Restricted Position Arrangements (M1–M2)
// ============================================================================

// M1. Fixed First and Last Letters of a Word
function genM1_FixedFirstAndLast(rng, difficulty) {
  const word = rng.pick(["CREDIT", "PROFIT", "MARKET", "BRANCH", "DEPOSIT", "PLANET"]);
  const startCh = word[0];
  const endCh = word[word.length - 1];
  const ans = fact(word.length - 2);

  return assemblePncQ({
    templateId: "PNC_M1_FIXED_START_END",
    question_type: "Restricted Position Arrangements",
    sub_type: "Fixed first and last positions",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
    question: `How many different arrangements of all the letters of the word "${word}" begin with "${startCh}" and end with "${endCh}"?`,
    mathModel: { kind: "WORD_ARRANGEMENT", word, mode: "FIXED_START_AND_END", fixedStart: startCh, fixedEnd: endCh },
    exactBigIntAnswer: ans,
    plausible: [fact(word.length - 1), fact(word.length), ans * 2n, fact(word.length - 3)],
    solution: {
      given_data: [`Word = "${word}" (${word.length} distinct letters)`, `First = ${startCh}, Last = ${endCh}`],
      concept: "Fix the 2 boundary letters in their positions; permute only the remaining (n − 2) middle letters.",
      formula: "(n − 2)!",
      steps: [
        `Fixing "${startCh}" at position 1 and "${endCh}" at position ${word.length} leaves ${word.length - 2} distinct letters`,
        `Middle arrangements = (${word.length} − 2)! = ${word.length - 2}! = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Lock both ends and compute (${word.length} − 2)! = ${ans}.`,
    rng,
  });
}

// M2. Vowels Occupying Only Even Positions
function genM2_VowelsEvenPositions(rng, difficulty) {
  const word = rng.pick(["CREDIT", "PROFIT", "MARKET", "PLANET", "GARDEN", "SILVER"]);
  const { clean, length } = getLetterFrequencies(word);
  const vCount = [...clean].filter((ch) => VOWEL_SET.has(ch)).length;
  const cCount = length - vCount;
  const evenSlots = Math.floor(length / 2);
  const ans = nPr(evenSlots, vCount) * fact(cCount);

  return assemblePncQ({
    templateId: "PNC_M2_VOWELS_EVEN_POS",
    question_type: "Restricted Position Arrangements",
    sub_type: "Vowels restricted to even positions",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: `In how many different ways can the letters of the word "${clean}" be arranged such that the vowels occupy ONLY the even-numbered positions (2nd, 4th, 6th)?`,
    mathModel: { kind: "WORD_ARRANGEMENT", word: clean, mode: "VOWELS_EVEN_POSITIONS" },
    exactBigIntAnswer: ans,
    plausible: [nCr(evenSlots, vCount) * fact(cCount), fact(vCount) * fact(cCount), fact(length), fact(cCount + 1) * fact(vCount)],
    solution: {
      given_data: [`Word = "${clean}" (${length} distinct letters)`, `Vowels = ${vCount}, Consonants = ${cCount}`, `Even positions available = ${evenSlots}`],
      concept: "Position-restricted permutation: place vowels into even slots first, then permute consonants in the remaining slots.",
      formula: "P(even slots, V) × (n − V)!",
      steps: [
        `Place ${vCount} vowels in ${evenSlots} even positions in P(${evenSlots}, ${vCount}) = ${nPr(evenSlots, vCount)} ways`,
        `Arrange the remaining ${cCount} consonants in the remaining ${cCount} positions in ${cCount}! = ${fact(cCount)} ways`,
        `Total ways = ${nPr(evenSlots, vCount)} × ${fact(cCount)} = ${ans}`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `P(${evenSlots}, ${vCount}) × ${cCount}! = ${ans}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY N: Derangements (Controlled Hard Mains — N1)
// ============================================================================

// N1. Classic Letters-and-Envelopes Derangement (!n for n in {4, 5, 6})
function genN1_Derangement(rng, difficulty) {
  const n = rng.pick([4, 5, 6]);
  const ans = derangement(n);

  return assemblePncQ({
    templateId: "PNC_N1_DERANGEMENT",
    question_type: "Derangements",
    sub_type: "No object occupies its original position (!n)",
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains"],
    question: `There are ${n} addressed letters and ${n} corresponding addressed envelopes. In how many ways can all ${n} letters be placed into the envelopes (one letter per envelope) such that NO letter goes into its own correctly addressed envelope?`,
    mathModel: { kind: "DERANGEMENT", n },
    exactBigIntAnswer: ans,
    plausible: [fact(n), fact(n) - 1n, fact(n - 1), ans + BigInt(n)],
    solution: {
      given_data: [`Number of letters and envelopes (n) = ${n}`, "No letter may match its own envelope"],
      concept: "Derangement (!n): permutation with zero fixed points.",
      formula: "!n = n! × [1 − 1/1! + 1/2! − 1/3! + ... + (−1)ⁿ/n!]",
      steps: [
        `Apply the derangement formula for n = ${n}`,
        `!${n} = ${ans} (independently verified against all ${fact(n)} permutations)`,
      ],
      final_answer: String(ans),
    },
    shortcut_method: `Memorize banking derangement values: !3 = 2, !4 = 9, !5 = 44, !6 = 265.`,
    rng,
  });
}

export const PNC_TEMPLATES_PART_2 = [
  { id: "PNC_H1", category: "H", difficulties: ["Easy", "Medium"], fn: genH1_DigitBasicNoRep },
  { id: "PNC_H2", category: "H", difficulties: ["Medium", "Hard"], fn: genH2_DigitEvenOdd },
  { id: "PNC_H3", category: "H", difficulties: ["Medium"], fn: genH3_DigitDivBy5 },
  { id: "PNC_H4", category: "H", difficulties: ["Medium", "Hard"], fn: genH4_DigitGreaterThan },

  { id: "PNC_I1", category: "I", difficulties: ["Easy", "Medium"], fn: genI1_CommitteeFixedCounts },
  { id: "PNC_I2", category: "I", difficulties: ["Medium"], fn: genI2_ThreeCategoryTeam },

  { id: "PNC_J1", category: "J", difficulties: ["Easy", "Medium"], fn: genJ1_MandatorySelection },
  { id: "PNC_J2", category: "J", difficulties: ["Easy", "Medium"], fn: genJ2_ExcludedSelection },

  { id: "PNC_K1", category: "K", difficulties: ["Hard"], fn: genK1_UnlabelledEqualGroups },
  { id: "PNC_K2", category: "K", difficulties: ["Medium", "Hard"], fn: genK2_LabelledGroups },
  { id: "PNC_K3", category: "K", difficulties: ["Hard"], fn: genK3_IdenticalStarsBars },

  { id: "PNC_L1", category: "L", difficulties: ["Medium", "Hard"], fn: genL1_AtLeastSelection },
  { id: "PNC_L2", category: "L", difficulties: ["Medium", "Hard"], fn: genL2_AtMostSelection },

  { id: "PNC_M1", category: "M", difficulties: ["Easy", "Medium"], fn: genM1_FixedFirstAndLast },
  { id: "PNC_M2", category: "M", difficulties: ["Medium", "Hard"], fn: genM2_VowelsEvenPositions },

  { id: "PNC_N1", category: "N", difficulties: ["Hard"], fn: genN1_Derangement },
];