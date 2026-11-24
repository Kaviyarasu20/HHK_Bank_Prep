// Place at: server/question-engine/generators/quant/probability/probabilityTemplatesPart1.js
import {
  Rational,
  R,
  ZERO,
  ONE,
  nCr,
  buildFiveProbOptions,
} from "./probabilityMath.js";

export function assembleProbQ({
  templateId,
  question_type,
  sub_type,
  difficulty,
  exam_level,
  question,
  mathModel,
  exactRationalAnswer,
  plausible = [],
  solution,
  shortcut_method = "",
  rng,
}) {
  const built = buildFiveProbOptions(exactRationalAnswer, plausible, { rng });
  return {
    templateId,
    question_type,
    sub_type,
    difficulty,
    exam_level,
    question,
    mathModel,
    exactRationalAnswer,
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
// CATEGORY A: Basic Probability (A1–A3)
// ============================================================================

// A1. Simple Event from Favourable & Total Outcomes (Lottery / Numbered Slips)
function genA1_SimpleEvent(rng, difficulty) {
  const total = rng.pick([20, 24, 25, 30, 36, 40, 50]);
  const div = rng.pick([3, 4, 5, 6]);
  const fav = Math.floor(total / div);
  const ans = R(fav, total);

  return assembleProbQ({
    templateId: "PROB_A1_SIMPLE_EVENT",
    question_type: "Basic Probability",
    sub_type: "Finding probability from favourable and total outcomes",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `Tickets numbered from 1 to ${total} are mixed up thoroughly and one ticket is drawn at random. What is the probability that the ticket drawn bears a number which is a multiple of ${div}?`,
    mathModel: { kind: "DIRECT_RATIO", favourable: fav, total },
    exactRationalAnswer: ans,
    plausible: [R(fav + 1, total), R(fav - 1, total), R(1, div), ONE.sub(ans)],
    solution: {
      given_data: [`Total tickets = ${total}`, `Multiples of ${div} from 1 to ${total} = ${fav}`],
      formula: "P(A) = Favourable outcomes / Total equally likely outcomes",
      steps: [
        `Total possible outcomes = ${total}`,
        `Favourable outcomes (multiples of ${div}) = floor(${total}/${div}) = ${fav}`,
        `P(multiple of ${div}) = ${fav}/${total} = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Count multiples directly via floor(${total}/${div}) = ${fav}, then simplify ${fav}/${total}.`,
    rng,
  });
}

// A2. Event Not Occurring (Simple Complement)
function genA2_EventNotOccurring(rng, difficulty) {
  const total = rng.pick([15, 18, 20, 25, 30, 40]);
  const defective = rng.randInt(2, Math.floor(total / 3));
  const good = total - defective;
  const ans = R(good, total);

  return assembleProbQ({
    templateId: "PROB_A2_NOT_OCCURRING",
    question_type: "Basic Probability",
    sub_type: "Probability of an event not occurring",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `A box contains ${total} bulbs, of which ${defective} are defective and the rest are non-defective. If one bulb is selected at random, what is the probability that it is NOT defective?`,
    mathModel: { kind: "DIRECT_RATIO", favourable: defective, total, complement: true },
    exactRationalAnswer: ans,
    plausible: [R(defective, total), R(good - 1, total), R(good, total - 1), R(defective, good)],
    solution: {
      given_data: [`Total bulbs = ${total}`, `Defective bulbs = ${defective}`],
      formula: "P(A') = 1 − P(A)",
      steps: [
        `P(defective) = ${defective}/${total}`,
        `P(not defective) = 1 − ${defective}/${total} = ${good}/${total} = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Non-defective bulbs = ${total} − ${defective} = ${good} ⇒ Probability = ${ans.toFractionString()}.`,
    rng,
  });
}

// A3. Certain or Impossible Event Conceptual Check
function genA3_CertainImpossible(rng, difficulty) {
  const isImpossible = rng.random() < 0.5;
  const n = rng.randInt(5, 12);
  const ans = isImpossible ? ZERO : ONE;
  const qText = isImpossible
    ? `A fair six-sided die numbered 1 to 6 is rolled once. What is the probability of getting a number greater than ${n > 6 ? n : 6}?`
    : `A bag contains ${n} red balls and no other balls. One ball is drawn at random. What is the probability of drawing a red ball?`;

  return assembleProbQ({
    templateId: isImpossible ? "PROB_A3_IMPOSSIBLE" : "PROB_A3_CERTAIN",
    question_type: "Basic Probability",
    sub_type: isImpossible ? "Probability of an impossible event" : "Probability of a certain event",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims"],
    question: qText,
    mathModel: { kind: "DIRECT_RATIO", favourable: isImpossible ? 0 : n, total: isImpossible ? 6 : n },
    exactRationalAnswer: ans,
    plausible: [isImpossible ? ONE : ZERO, R(1, 6), R(1, 2), R(1, n)],
    solution: {
      given_data: [isImpossible ? "Die faces = {1, 2, 3, 4, 5, 6}" : `Total balls = ${n}, Red balls = ${n}`],
      formula: "P(A) = Favourable outcomes / Total outcomes",
      steps: [
        isImpossible
          ? "No face on a standard die is greater than 6, so favourable outcomes = 0"
          : `Every ball in the bag is red, so favourable outcomes = ${n} out of ${n}`,
        `Probability = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: isImpossible ? "An impossible event always has probability 0." : "A certain event always has probability 1.",
    rng,
  });
}

// ============================================================================
// CATEGORY B: Coin-Based Probability (B1–B3)
// ============================================================================

// B1. Tossing 2 or 3 Coins — Exact / At Least / At Most Heads
function genB1_CoinsExactOrBound(rng, difficulty) {
  const n = difficulty === "Easy" ? 2 : rng.pick([3, 4]);
  const mode = rng.pick(["EXACT_HEADS", "AT_LEAST_HEADS", "AT_MOST_HEADS"]);
  const k = n === 2 ? 1 : rng.pick([1, 2]);
  const total = 1 << n;
  let fav = 0n;
  if (mode === "EXACT_HEADS") fav = nCr(n, k);
  else if (mode === "AT_LEAST_HEADS") {
    for (let i = k; i <= n; i++) fav += nCr(n, i);
  } else {
    for (let i = 0; i <= k; i++) fav += nCr(n, i);
  }
  const ans = new Rational(fav, BigInt(total));
  const phrase =
    mode === "EXACT_HEADS"
      ? `exactly ${k} head${k > 1 ? "s" : ""}`
      : mode === "AT_LEAST_HEADS"
      ? `at least ${k} head${k > 1 ? "s" : ""}`
      : `at most ${k} head${k > 1 ? "s" : ""}`;

  return assembleProbQ({
    templateId: `PROB_B1_COINS_${mode}`,
    question_type: "Coin-Based Probability",
    sub_type: `Tossing ${n} coins — ${phrase}`,
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `${n} fair coins are tossed simultaneously. What is the probability of getting ${phrase}?`,
    mathModel: { kind: "COINS", n, event: mode, k },
    exactRationalAnswer: ans,
    plausible: [ONE.sub(ans), new Rational(nCr(n, k), BigInt(total)), R(k, total), R(fav + 1n, total)],
    solution: {
      given_data: [`Number of fair coins = ${n}`, `Total equally likely outcomes = 2^${n} = ${total}`],
      formula: "P(A) = Favourable outcomes / 2ⁿ",
      steps: [
        `Total outcomes = 2^${n} = ${total}`,
        `Number of outcomes with ${phrase} = ${fav}`,
        `Probability = ${fav}/${total} = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Total outcomes = 2^${n} = ${total}; sum C(${n}, r) for matching head counts.`,
    rng,
  });
}

// B2. Consecutive Heads in 3 or 4 Coin Tosses
function genB2_ConsecutiveHeads(rng, difficulty) {
  const n = rng.pick([3, 4]);
  const k = 2; // at least 2 consecutive heads
  const total = 1 << n;
  // For n=3, k=2: HHH, HHT, THH => 3/8. For n=4, k=2: 8/16 = 1/2 (all except TTTT, HTTT, THTT, TTHT, TTTH, HTHT, THTH, HTTH = 8)
  const fav = n === 3 ? 3 : 8;
  const ans = R(fav, total);

  return assembleProbQ({
    templateId: "PROB_B2_CONSECUTIVE_HEADS",
    question_type: "Coin-Based Probability",
    sub_type: "Getting consecutive heads",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: `A fair coin is tossed ${n} times in succession. What is the probability of getting at least two consecutive heads?`,
    mathModel: { kind: "COINS", n, event: "CONSECUTIVE_HEADS", k },
    exactRationalAnswer: ans,
    plausible: [ONE.sub(ans), R(fav - 1, total), R(fav + 1, total), R(nCr(n, 2), BigInt(total))],
    solution: {
      given_data: [`Number of tosses = ${n}`, `Total outcomes = 2^${n} = ${total}`],
      formula: "P(at least 2 consecutive heads) = Favourable sequences / 2ⁿ",
      steps: [
        `Total equally likely sequences = 2^${n} = ${total}`,
        n === 3
          ? `Favourable sequences: HHH, HHT, THH ⇒ 3 outcomes`
          : `Sequences with NO 2 consecutive heads = 8 (TTTT, 4 single-H, HTHT, THTH, HTTH) ⇒ Favourable = 16 − 8 = 8`,
        `Probability = ${fav}/${total} = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Count complement sequences with no adjacent H's (Fibonacci count F(${n + 2}) = ${total - fav}), then subtract from ${total}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY C: Dice-Based Probability (C1–C5)
// ============================================================================

// C1. Single Die (Even / Odd / Prime / Greater Than)
function genC1_SingleDie(rng, difficulty) {
  const cases = [
    { event: "PRIME", text: "a prime number", fav: 3, desc: "{2, 3, 5}" },
    { event: "EVEN", text: "an even number", fav: 3, desc: "{2, 4, 6}" },
    { event: "GREATER_THAN", target: 4, text: "a number greater than 4", fav: 2, desc: "{5, 6}" },
    { event: "GREATER_THAN", target: 2, text: "a number greater than 2", fav: 4, desc: "{3, 4, 5, 6}" },
    { event: "EXACT_FACE", target: 5, text: "the number 5", fav: 1, desc: "{5}" },
  ];
  const c = rng.pick(cases);
  const ans = R(c.fav, 6);

  return assembleProbQ({
    templateId: `PROB_C1_SINGLE_DIE_${c.event}`,
    question_type: "Dice-Based Probability",
    sub_type: `Rolling one die — ${c.text}`,
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `A fair six-sided die is rolled once. What is the probability of getting ${c.text}?`,
    mathModel: { kind: "DICE", numDice: 1, event: c.event, target: c.target || 0 },
    exactRationalAnswer: ans,
    plausible: [R(6 - c.fav, 6), R(c.fav + 1, 6), R(Math.max(1, c.fav - 1), 6), R(1, 6)],
    solution: {
      given_data: ["Sample space S = {1, 2, 3, 4, 5, 6} (6 outcomes)", `Favourable outcomes = ${c.desc} (${c.fav})`],
      formula: "P(A) = Favourable outcomes / 6",
      steps: [
        `Total outcomes = 6`,
        `Favourable outcomes = ${c.fav}`,
        `Probability = ${c.fav}/6 = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Count matching faces in {1..6} (${c.fav}) and divide by 6.`,
    rng,
  });
}

// C2. Two Dice — Sum Equals Target / At Least Target
function genC2_TwoDiceSum(rng, difficulty) {
  const isAtLeast = rng.random() < 0.45;
  if (!isAtLeast) {
    const sumTarget = rng.pick([5, 6, 7, 8, 9, 10]);
    const fav = 6 - Math.abs(7 - sumTarget);
    const ans = R(fav, 36);
    return assembleProbQ({
      templateId: "PROB_C2_TWO_DICE_SUM_EQ",
      question_type: "Dice-Based Probability",
      sub_type: "Rolling two dice — exact sum",
      difficulty,
      exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
      question: `Two fair six-sided dice are rolled simultaneously. What is the probability that the sum of the numbers appearing on the two dice is ${sumTarget}?`,
      mathModel: { kind: "DICE", numDice: 2, event: "SUM_EQ", target: sumTarget },
      exactRationalAnswer: ans,
      plausible: [R(fav + 1, 36), R(Math.max(1, fav - 1), 36), R(fav, 12), ONE.sub(ans)],
      solution: {
        given_data: ["Two dice ⇒ Total ordered outcomes = 6 × 6 = 36", `Target sum = ${sumTarget}`],
        formula: "P(Sum = S) = Favourable ordered pairs / 36",
        steps: [
          `Total ordered pairs = 36`,
          `Number of pairs summing to ${sumTarget} = ${fav}`,
          `Probability = ${fav}/36 = ${ans.toFractionString()}`,
        ],
        final_answer: ans.toFractionString(),
      },
      shortcut_method: `Pairs for sum S = 6 − |7 − S| = ${fav} ⇒ ${fav}/36 = ${ans.toFractionString()}.`,
      rng,
    });
  } else {
    const minSum = rng.pick([8, 9, 10, 11]);
    const favMap = { 8: 15, 9: 10, 10: 6, 11: 3 };
    const fav = favMap[minSum];
    const ans = R(fav, 36);
    return assembleProbQ({
      templateId: "PROB_C2_TWO_DICE_SUM_AT_LEAST",
      question_type: "Dice-Based Probability",
      sub_type: "Rolling two dice — sum at least threshold",
      difficulty,
      exam_level: ["IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
      question: `Two fair dice are thrown together. Find the probability of getting a total sum of at least ${minSum}.`,
      mathModel: { kind: "DICE", numDice: 2, event: "SUM_AT_LEAST", target: minSum },
      exactRationalAnswer: ans,
      plausible: [ONE.sub(ans), R(fav - 1, 36), R(fav + 2, 36), R(fav, 18)],
      solution: {
        given_data: ["Total ordered outcomes = 36", `Condition: Sum ≥ ${minSum}`],
        formula: "P(Sum ≥ k) = Favourable ordered pairs / 36",
        steps: [
          `Total outcomes = 36`,
          `Count all pairs with sum ≥ ${minSum}: ${fav} pairs`,
          `Probability = ${fav}/36 = ${ans.toFractionString()}`,
        ],
        final_answer: ans.toFractionString(),
      },
      shortcut_method: `Sum pair counts from ${minSum} up to 12: ${fav}/36 = ${ans.toFractionString()}.`,
      rng,
    });
  }
}

// C3. Two Dice — Product / Doubles / Different Numbers
function genC3_TwoDiceSpecial(rng, difficulty) {
  const mode = rng.pick(["DOUBLES", "DIFFERENT", "PRODUCT_EVEN", "AT_LEAST_ONE_VAL"]);
  if (mode === "DOUBLES") {
    const ans = R(6, 36);
    return assembleProbQ({
      templateId: "PROB_C3_DICE_DOUBLES",
      question_type: "Dice-Based Probability",
      sub_type: "Getting the same number on two dice",
      difficulty,
      exam_level: ["IBPS Clerk Prelims", "SBI Clerk Prelims"],
      question: `Two fair dice are rolled together. What is the probability of getting the same number (a doublet) on both dice?`,
      mathModel: { kind: "DICE", numDice: 2, event: "DOUBLES" },
      exactRationalAnswer: ans,
      plausible: [R(5, 6), R(1, 12), R(1, 36), R(1, 3)],
      solution: {
        given_data: ["Total outcomes = 36", "Doublets = {(1,1), (2,2), (3,3), (4,4), (5,5), (6,6)}"],
        formula: "P(doublet) = 6 / 36",
        steps: ["Total ordered pairs = 36", "Favourable doublets = 6", "P(doublet) = 6/36 = 1/6"],
        final_answer: "1/6",
      },
      shortcut_method: "Whatever appears on die 1, die 2 has a 1/6 chance to match it.",
      rng,
    });
  }
  if (mode === "PRODUCT_EVEN") {
    const ans = R(27, 36);
    return assembleProbQ({
      templateId: "PROB_C3_DICE_PRODUCT_EVEN",
      question_type: "Dice-Based Probability",
      sub_type: "Getting an even product on two dice",
      difficulty,
      exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS RRB PO"],
      question: `Two fair dice are rolled simultaneously. What is the probability that the product of the two numbers obtained is an even number?`,
      mathModel: { kind: "DICE", numDice: 2, event: "PRODUCT_EVEN" },
      exactRationalAnswer: ans,
      plausible: [R(1, 2), R(1, 4), R(2, 3), R(5, 6)],
      solution: {
        given_data: ["Total outcomes = 36", "Product is odd only when both dice show odd numbers (3 × 3 = 9)"],
        formula: "P(even product) = 1 − P(both odd)",
        steps: [
          `P(both odd) = (3/6) × (3/6) = 9/36 = 1/4`,
          `P(even product) = 1 − 1/4 = 3/4`,
        ],
        final_answer: "3/4",
      },
      shortcut_method: "Complement rule: 1 − (1/2 × 1/2) = 3/4.",
      rng,
    });
  }
  const face = rng.pick([4, 5, 6]);
  const ans = R(11, 36);
  return assembleProbQ({
    templateId: "PROB_C3_DICE_AT_LEAST_ONE_FACE",
    question_type: "Dice-Based Probability",
    sub_type: "Getting at least one specified number on two dice",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Prelims"],
    question: `Two fair dice are thrown simultaneously. What is the probability of getting the number ${face} on at least one of the two dice?`,
    mathModel: { kind: "DICE", numDice: 2, event: "AT_LEAST_ONE_VAL", target: face },
    exactRationalAnswer: ans,
    plausible: [R(12, 36), R(25, 36), R(10, 36), R(1, 6)],
    solution: {
      given_data: ["Total outcomes = 36", `Outcomes with NO ${face} = 5 × 5 = 25`],
      formula: `P(at least one ${face}) = 1 − P(no ${face})`,
      steps: [
        `P(no ${face} on either die) = (5/6) × (5/6) = 25/36`,
        `P(at least one ${face}) = 1 − 25/36 = 11/36`,
      ],
      final_answer: "11/36",
    },
    shortcut_method: "Do not add 6/36 + 6/36 = 12/36 without subtracting the overlap (6,6); exact answer is 11/36.",
    rng,
  });
}

// C4. Three Dice — Sum Condition (Hard)
function genC4_ThreeDiceSum(rng, difficulty) {
  const configs = [
    { sum: 16, fav: 6 },  // (6,6,4)x3, (6,5,5)x3 -> 6/216 = 1/36
    { sum: 15, fav: 10 }, // 10/216 = 5/108
    { sum: 14, fav: 15 }, // 15/216 = 5/72
    { sum: 5, fav: 6 },   // 6/216 = 1/36
    { sum: 6, fav: 10 },  // 10/216 = 5/108
  ];
  const c = rng.pick(configs);
  const ans = R(c.fav, 216);

  return assembleProbQ({
    templateId: "PROB_C4_THREE_DICE_SUM",
    question_type: "Dice-Based Probability",
    sub_type: "Rolling three dice — specified sum",
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains"],
    question: `Three fair six-sided dice are rolled simultaneously. What is the probability that the sum of the numbers appearing on all three dice is exactly ${c.sum}?`,
    mathModel: { kind: "DICE", numDice: 3, event: "SUM_EQ", target: c.sum },
    exactRationalAnswer: ans,
    plausible: [R(c.fav + 1, 216), R(c.fav - 1, 216), R(c.fav, 36), R(c.fav + 2, 216)],
    solution: {
      given_data: ["Three fair dice ⇒ Total ordered outcomes = 6³ = 216", `Target sum = ${c.sum}`],
      formula: "P(Sum = S) = Favourable ordered triples / 216",
      steps: [
        `Total ordered outcomes = 6 × 6 × 6 = 216`,
        `Counting all ordered triples (a, b, c) summing to ${c.sum} gives ${c.fav} outcomes`,
        `Probability = ${c.fav}/216 = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Total outcomes = 216; count distinct unordered partitions of ${c.sum} and multiply by their permutation counts (${c.fav}/216 = ${ans.toFractionString()}).`,
    rng,
  });
}

// ============================================================================
// CATEGORY D: Playing Card Probability (D1–D4)
// ============================================================================

// D1. Single Card from Standard 52-Card Deck (Face, Ace, Suit, Numbered)
function genD1_SingleCard(rng, difficulty) {
  const cases = [
    { event: "FACE", text: "a face card (Jack, Queen, or King)", fav: 12 },
    { event: "ACE", text: "an Ace", fav: 4 },
    { event: "NUMBER", text: "a numbered card (2 through 10)", fav: 36 },
    { event: "HEARTS", text: "a card of Hearts", fav: 13 },
    { event: "RED_FACE", text: "a red face card", fav: 6 },
    { event: "BLACK_ACE", text: "a black Ace", fav: 2 },
  ];
  const c = rng.pick(cases);
  const ans = R(c.fav, 52);
  // Common distractor: treating Ace as a face card (16/52 = 4/13)
  const wrongAceFace = c.event === "FACE" ? R(16, 52) : R(c.fav + 2, 52);

  return assembleProbQ({
    templateId: `PROB_D1_CARD_${c.event}`,
    question_type: "Playing Card Probability",
    sub_type: `Selecting ${c.text}`,
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `One card is drawn at random from a well-shuffled standard deck of 52 playing cards. What is the probability of drawing ${c.text}?`,
    mathModel: { kind: "CARDS_SINGLE", event: c.event },
    exactRationalAnswer: ans,
    plausible: [wrongAceFace, ONE.sub(ans), R(c.fav, 26), R(Math.max(1, c.fav - 1), 52)],
    solution: {
      given_data: ["Standard deck = 52 cards (4 suits × 13 ranks)", `Favourable cards = ${c.fav}`],
      formula: "P(A) = Favourable cards / 52",
      steps: [
        `Total cards in a standard deck = 52`,
        `Number of cards matching "${c.text}" = ${c.fav}`,
        `Probability = ${c.fav}/52 = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Standard deck has 12 face cards (J, Q, K — Ace is NOT a face card), 4 Aces, and 36 numbered cards.`,
    rng,
  });
}

// D2. Single Card Satisfying Two Conditions (Inclusion-Exclusion: Red OR King, etc.)
function genD2_CardTwoConditions(rng, difficulty) {
  const cases = [
    { event: "RED_OR_KING", text: "either a red card or a King", a: 26, b: 4, inter: 2, fav: 28 },
    { event: "BLACK_OR_QUEEN", text: "either a black card or a Queen", a: 26, b: 4, inter: 2, fav: 28 },
    { event: "HEART_OR_ACE", text: "either a Heart or an Ace", a: 13, b: 4, inter: 1, fav: 16 },
    { event: "SPADE_OR_FACE", text: "either a Spade or a face card", a: 13, b: 12, inter: 3, fav: 22 },
  ];
  const c = rng.pick(cases);
  const ans = R(c.fav, 52);
  // Classic mistake: forgetting to subtract overlap (a + b)/52
  const wrongNoOverlap = R(c.a + c.b, 52);

  return assembleProbQ({
    templateId: `PROB_D2_CARD_UNION_${c.event}`,
    question_type: "Playing Card Probability",
    sub_type: "Selecting a card satisfying two conditions (Union)",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `A card is drawn at random from a standard deck of 52 playing cards. What is the probability that the card drawn is ${c.text}?`,
    mathModel: { kind: "CARDS_SINGLE", event: c.event },
    exactRationalAnswer: ans,
    plausible: [wrongNoOverlap, R(c.inter, 52), ONE.sub(ans), R(c.fav - 2, 52)],
    solution: {
      given_data: [`Total cards = 52`, `n(A) = ${c.a}, n(B) = ${c.b}, Overlap n(A ∩ B) = ${c.inter}`],
      formula: "P(A ∪ B) = P(A) + P(B) − P(A ∩ B)",
      steps: [
        `Favourable cards = ${c.a} + ${c.b} − ${c.inter} = ${c.fav}`,
        `Probability = ${c.fav}/52 = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Always subtract the overlap (${c.inter} cards) before dividing by 52: (${c.a}+${c.b}−${c.inter})/52 = ${ans.toFractionString()}.`,
    rng,
  });
}

// D3. Two Cards Drawn Without Replacement (Same Colour / Different Colour / Same Suit / Both Aces)
function genD3_TwoCardsWithoutReplacement(rng, difficulty) {
  const cases = [
    { event: "SAME_COLOR", text: "both cards are of the same colour", num: 2n * nCr(26, 2), den: nCr(52, 2), wrongRepl: R(1, 2) },
    { event: "DIFF_COLOR", text: "one card is red and the other is black", num: 26n * 26n, den: nCr(52, 2), wrongRepl: R(1, 2) },
    { event: "SAME_SUIT", text: "both cards belong to the same suit", num: 4n * nCr(13, 2), den: nCr(52, 2), wrongRepl: R(1, 4) },
    { event: "BOTH_ACES", text: "both cards are Aces", num: nCr(4, 2), den: nCr(52, 2), wrongRepl: R(1, 169) },
    { event: "BOTH_FACE", text: "both cards are face cards", num: nCr(12, 2), den: nCr(52, 2), wrongRepl: R(9, 169) },
  ];
  const c = rng.pick(cases);
  const ans = new Rational(c.num, c.den);

  return assembleProbQ({
    templateId: `PROB_D3_TWO_CARDS_${c.event}`,
    question_type: "Playing Card Probability",
    sub_type: `Selecting two cards without replacement — ${c.event.toLowerCase()}`,
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `Two cards are drawn together (without replacement) at random from a standard deck of 52 playing cards. What is the probability that ${c.text}?`,
    mathModel: { kind: "CARDS_TWO", event: c.event, withReplacement: false },
    exactRationalAnswer: ans,
    plausible: [c.wrongRepl, ONE.sub(ans), R(c.num + 13n, c.den), R(c.num, 52n * 52n)],
    solution: {
      given_data: ["Standard deck = 52 cards", "2 cards drawn without replacement ⇒ Total ways = C(52, 2) = 1326"],
      formula: "P(A) = Favourable combinations / C(52, 2)",
      steps: [
        `Total ways to choose 2 cards = C(52, 2) = 1326`,
        `Favourable combinations = ${c.num}`,
        `Probability = ${c.num}/1326 = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Without replacement, denominator for 2nd card drops to 51 (never 52). Simplified answer = ${ans.toFractionString()}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY E: Balls and Objects (E1–E4)
// ============================================================================

// E1. Selecting One Ball (Easy)
function genE1_OneBall(rng, difficulty) {
  const red = rng.randInt(3, 8);
  const blue = rng.randInt(3, 8);
  const green = rng.randInt(2, 6);
  const total = red + blue + green;
  const targetIdx = rng.pick([0, 1, 2]);
  const colors = ["red", "blue", "green"];
  const counts = [red, blue, green];
  const ans = R(counts[targetIdx], total);

  return assembleProbQ({
    templateId: "PROB_E1_ONE_BALL",
    question_type: "Balls and Objects",
    sub_type: `Selecting one ${colors[targetIdx]} ball`,
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `A bag contains ${red} red balls, ${blue} blue balls, and ${green} green balls. One ball is drawn at random from the bag. What is the probability that the ball drawn is ${colors[targetIdx]}?`,
    mathModel: { kind: "BALLS_COMB", counts, drawCount: 1, event: "ALL_TARGET_COLOR", targetColorIdx: targetIdx },
    exactRationalAnswer: ans,
    plausible: [ONE.sub(ans), R(counts[(targetIdx + 1) % 3], total), R(counts[targetIdx], total - counts[targetIdx]), R(counts[targetIdx] + 1, total)],
    solution: {
      given_data: [`Red = ${red}, Blue = ${blue}, Green = ${green}`, `Total balls = ${total}`],
      formula: "P(A) = Favourable balls / Total balls",
      steps: [
        `Total balls = ${red} + ${blue} + ${green} = ${total}`,
        `Favourable ${colors[targetIdx]} balls = ${counts[targetIdx]}`,
        `Probability = ${counts[targetIdx]}/${total} = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Divide ${colors[targetIdx]} count (${counts[targetIdx]}) by total (${total}) = ${ans.toFractionString()}.`,
    rng,
  });
}

// E2. Selecting Two Balls Without Replacement (Same Colour / Different Colours)
function genE2_TwoBallsSameOrDiff(rng, difficulty) {
  const r = rng.randInt(4, 7);
  const b = rng.randInt(3, 6);
  const g = rng.randInt(2, 5);
  const counts = [r, b, g];
  const total = r + b + g;
  const askSame = rng.random() < 0.5;
  const denom = nCr(total, 2);
  const sameNum = nCr(r, 2) + nCr(b, 2) + nCr(g, 2);
  const num = askSame ? sameNum : denom - sameNum;
  const ans = new Rational(num, denom);
  // Distractor: mistakenly using with-replacement formula
  const wrongRepl = R(r * r + b * b + g * g, total * total);

  return assembleProbQ({
    templateId: askSame ? "PROB_E2_TWO_BALLS_SAME" : "PROB_E2_TWO_BALLS_DIFF",
    question_type: "Balls and Objects",
    sub_type: askSame ? "Two balls of the same colour (without replacement)" : "Two balls of different colours (without replacement)",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI PO Prelims", "IBPS RRB PO"],
    question: `A bag contains ${r} red, ${b} blue, and ${g} green balls. Two balls are drawn simultaneously at random without replacement. What is the probability that both balls are of ${askSame ? "the same colour" : "different colours"}?`,
    mathModel: { kind: "BALLS_COMB", counts, drawCount: 2, event: askSame ? "ALL_SAME_COLOR" : "DIFFERENT_COLORS" },
    exactRationalAnswer: ans,
    plausible: [ONE.sub(ans), askSame ? wrongRepl : ONE.sub(wrongRepl), new Rational(num + 2n, denom), new Rational(num > 2n ? num - 2n : num + 1n, denom)],
    solution: {
      given_data: [`Red = ${r}, Blue = ${b}, Green = ${g}`, `Total = ${total} balls`, `2 balls drawn without replacement`],
      formula: askSame ? "P(same) = [C(r,2) + C(b,2) + C(g,2)] / C(N,2)" : "P(different) = 1 − P(same colour)",
      steps: [
        `Total ways = C(${total}, 2) = ${denom}`,
        `Same-colour ways = C(${r},2) + C(${b},2) + C(${g},2) = ${nCr(r, 2)} + ${nCr(b, 2)} + ${nCr(g, 2)} = ${sameNum}`,
        askSame
          ? `P(same colour) = ${sameNum}/${denom} = ${ans.toFractionString()}`
          : `P(different colours) = (${denom} − ${sameNum})/${denom} = ${num}/${denom} = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Total pairs = ${denom}; same-colour pairs = ${sameNum} ⇒ ${ans.toFractionString()}.`,
    rng,
  });
}

// E3. Selecting Two or Three Balls with Specified Combination (e.g. 1 Red & 1 Blue, or 2 Red & 1 Blue)
function genE3_SpecifiedCombination(rng, difficulty) {
  const r = rng.randInt(4, 7);
  const b = rng.randInt(4, 7);
  const g = rng.randInt(2, 5);
  const counts = [r, b, g];
  const total = r + b + g;
  const isThree = difficulty === "Hard";
  const split = isThree ? [2, 1, 0] : [1, 1, 0];
  const drawCount = isThree ? 3 : 2;
  const num = nCr(r, split[0]) * nCr(b, split[1]);
  const denom = nCr(total, drawCount);
  const ans = new Rational(num, denom);

  return assembleProbQ({
    templateId: "PROB_E3_SPECIFIED_COMBO",
    question_type: "Balls and Objects",
    sub_type: isThree ? "Selecting 2 red and 1 blue ball" : "Selecting 1 red and 1 blue ball",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `An urn contains ${r} red, ${b} blue, and ${g} green balls. If ${drawCount} balls are drawn simultaneously at random, what is the probability of getting ${isThree ? "2 red balls and 1 blue ball" : "1 red ball and 1 blue ball"}?`,
    mathModel: { kind: "BALLS_COMB", counts, drawCount, event: "EXACT_SPLIT", split },
    exactRationalAnswer: ans,
    plausible: [ONE.sub(ans), new Rational(num, BigInt(total ** drawCount)), new Rational(num + 2n, denom), R(r * b, total * (total - 1))],
    solution: {
      given_data: [`Red = ${r}, Blue = ${b}, Green = ${g} (Total = ${total})`, `Draw ${drawCount} balls without replacement`],
      formula: `P = [C(${r}, ${split[0]}) × C(${b}, ${split[1]})] / C(${total}, ${drawCount})`,
      steps: [
        `Total ways = C(${total}, ${drawCount}) = ${denom}`,
        `Favourable ways = C(${r}, ${split[0]}) × C(${b}, ${split[1]}) = ${nCr(r, split[0])} × ${nCr(b, split[1])} = ${num}`,
        `Probability = ${num}/${denom} = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Use unordered combinations C(${r},${split[0]})×C(${b},${split[1]}) / C(${total},${drawCount}) = ${ans.toFractionString()}.`,
    rng,
  });
}

// E4. At Least One / No Ball of a Specified Colour (Without Replacement)
function genE4_AtLeastOrNoneBall(rng, difficulty) {
  const r = rng.randInt(3, 6);
  const b = rng.randInt(4, 7);
  const g = rng.randInt(2, 5);
  const counts = [r, b, g];
  const total = r + b + g;
  const drawCount = difficulty === "Hard" ? 3 : 2;
  const askAtLeast = rng.random() < 0.6;
  const denom = nCr(total, drawCount);
  const noneRed = nCr(b + g, drawCount);
  const num = askAtLeast ? denom - noneRed : noneRed;
  const ans = new Rational(num, denom);

  return assembleProbQ({
    templateId: askAtLeast ? "PROB_E4_AT_LEAST_ONE_BALL" : "PROB_E4_NONE_BALL",
    question_type: "Balls and Objects",
    sub_type: askAtLeast ? "At least one red ball (without replacement)" : "No red ball (without replacement)",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains", "IBPS RRB PO"],
    question: `A bag contains ${r} red, ${b} blue, and ${g} green balls. ${drawCount} balls are drawn at random without replacement. What is the probability that ${askAtLeast ? "at least one of the drawn balls is red" : "none of the drawn balls is red"}?`,
    mathModel: {
      kind: "BALLS_COMB",
      counts,
      drawCount,
      event: askAtLeast ? "AT_LEAST_ONE_TARGET" : "NONE_TARGET_COLOR",
      targetColorIdx: 0,
    },
    exactRationalAnswer: ans,
    plausible: [ONE.sub(ans), new Rational(nCr(r, drawCount), denom), new Rational(num + 2n, denom), R(b + g, total).pow(drawCount)],
    solution: {
      given_data: [`Red = ${r}, Non-red = ${b + g}, Total = ${total}`, `Draw count = ${drawCount}`],
      formula: askAtLeast ? "P(at least 1 red) = 1 − C(non-red, k) / C(total, k)" : "P(no red) = C(non-red, k) / C(total, k)",
      steps: [
        `Total ways = C(${total}, ${drawCount}) = ${denom}`,
        `Ways with NO red ball = C(${b + g}, ${drawCount}) = ${noneRed}`,
        askAtLeast
          ? `P(at least 1 red) = 1 − ${noneRed}/${denom} = ${num}/${denom} = ${ans.toFractionString()}`
          : `P(no red) = ${noneRed}/${denom} = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: askAtLeast ? `Always use complement: 1 − C(${b + g},${drawCount})/C(${total},${drawCount}) = ${ans.toFractionString()}.` : `Select all ${drawCount} from the ${b + g} non-red balls.`,
    rng,
  });
}

export const PROB_TEMPLATES_PART_1 = [
  { id: "PROB_A1", category: "A", difficulties: ["Easy"], fn: genA1_SimpleEvent },
  { id: "PROB_A2", category: "A", difficulties: ["Easy"], fn: genA2_EventNotOccurring },
  { id: "PROB_A3", category: "A", difficulties: ["Easy"], fn: genA3_CertainImpossible },

  { id: "PROB_B1", category: "B", difficulties: ["Easy", "Medium"], fn: genB1_CoinsExactOrBound },
  { id: "PROB_B2", category: "B", difficulties: ["Medium", "Hard"], fn: genB2_ConsecutiveHeads },

  { id: "PROB_C1", category: "C", difficulties: ["Easy"], fn: genC1_SingleDie },
  { id: "PROB_C2", category: "C", difficulties: ["Medium"], fn: genC2_TwoDiceSum },
  { id: "PROB_C3", category: "C", difficulties: ["Medium"], fn: genC3_TwoDiceSpecial },
  { id: "PROB_C4", category: "C", difficulties: ["Hard"], fn: genC4_ThreeDiceSum },

  { id: "PROB_D1", category: "D", difficulties: ["Easy"], fn: genD1_SingleCard },
  { id: "PROB_D2", category: "D", difficulties: ["Medium"], fn: genD2_CardTwoConditions },
  { id: "PROB_D3", category: "D", difficulties: ["Medium", "Hard"], fn: genD3_TwoCardsWithoutReplacement },

  { id: "PROB_E1", category: "E", difficulties: ["Easy"], fn: genE1_OneBall },
  { id: "PROB_E2", category: "E", difficulties: ["Medium"], fn: genE2_TwoBallsSameOrDiff },
  { id: "PROB_E3", category: "E", difficulties: ["Medium", "Hard"], fn: genE3_SpecifiedCombination },
  { id: "PROB_E4", category: "E", difficulties: ["Medium", "Hard"], fn: genE4_AtLeastOrNoneBall },
];