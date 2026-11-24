// Place at: server/question-engine/generators/quant/probability/probabilityTemplatesPart2.js
import {
  Rational,
  R,
  ZERO,
  ONE,
  nCr,
} from "./probabilityMath.js";
import { assembleProbQ } from "./probabilityTemplatesPart1.js";

// ============================================================================
// CATEGORY F: Complementary Probability (F1–F2)
// ============================================================================

// F1. At Least One Problem Solved by Independent Candidates (Complement Rule)
function genF1_AtLeastOneComplement(rng, difficulty) {
  const probs = [R(1, 2), R(1, 3), R(2, 3), R(1, 4), R(3, 4), R(1, 5), R(2, 5), R(3, 5)];
  const pA = rng.pick(probs);
  const pB = rng.pick(probs);
  const isThree = difficulty === "Hard";
  const pC = isThree ? rng.pick([R(1, 2), R(1, 3), R(1, 4), R(2, 5)]) : null;

  const pNone = isThree
    ? ONE.sub(pA).mul(ONE.sub(pB)).mul(ONE.sub(pC))
    : ONE.sub(pA).mul(ONE.sub(pB));
  const ans = ONE.sub(pNone);
  const wrongProd = isThree ? pA.mul(pB).mul(pC) : pA.mul(pB);

  const qText = isThree
    ? `Three candidates A, B, and C attempt a banking puzzle independently. Their probabilities of solving it are ${pA.toFractionString()}, ${pB.toFractionString()}, and ${pC.toFractionString()} respectively. What is the probability that the puzzle is solved by at least one of them?`
    : `Two students A and B try to solve a problem independently with probabilities ${pA.toFractionString()} and ${pB.toFractionString()} respectively. What is the probability that at least one of them solves the problem?`;

  return assembleProbQ({
    templateId: "PROB_F1_AT_LEAST_ONE_COMPLEMENT",
    question_type: "Complementary Probability",
    sub_type: "At least one occurrence using complement rule",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains", "IBPS RRB PO"],
    question: qText,
    mathModel: { kind: "EVENTS_ALGEBRA", mode: "IND_AT_LEAST_ONE", pA, pB, pC },
    exactRationalAnswer: ans,
    plausible: [pNone, wrongProd, pA.add(pB), ONE.sub(wrongProd)],
    solution: {
      given_data: isThree
        ? [`P(A) = ${pA.toFractionString()}, P(B) = ${pB.toFractionString()}, P(C) = ${pC.toFractionString()}`, "Independent attempts"]
        : [`P(A) = ${pA.toFractionString()}, P(B) = ${pB.toFractionString()}`, "Independent attempts"],
      formula: "P(at least one) = 1 − P(none succeeds)",
      steps: [
        isThree
          ? `P(none) = (1 − ${pA.toFractionString()}) × (1 − ${pB.toFractionString()}) × (1 − ${pC.toFractionString()}) = ${pNone.toFractionString()}`
          : `P(none) = (1 − ${pA.toFractionString()}) × (1 − ${pB.toFractionString()}) = ${pNone.toFractionString()}`,
        `P(at least one) = 1 − ${pNone.toFractionString()} = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Multiply the failure probabilities (${pNone.toFractionString()}) and subtract from 1.`,
    rng,
  });
}

// F2. Probability of NOT Getting a Specified Outcome (Cards / Non-Face)
function genF2_NotGettingCard(rng, difficulty) {
  const ans = R(40, 52);
  return assembleProbQ({
    templateId: "PROB_F2_NOT_FACE_CARD",
    question_type: "Complementary Probability",
    sub_type: "Not drawing a face card",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `One card is drawn at random from a standard deck of 52 playing cards. What is the probability that it is NOT a face card?`,
    mathModel: { kind: "CARDS_SINGLE", event: "NON_FACE" },
    exactRationalAnswer: ans,
    plausible: [R(12, 52), R(36, 52), R(48, 52), R(3, 4)],
    solution: {
      given_data: ["Total cards = 52", "Face cards (J, Q, K) = 12 (Ace is not a face card)"],
      formula: "P(not face) = 1 − P(face)",
      steps: [
        "P(face card) = 12/52 = 3/13",
        "P(not a face card) = 1 − 3/13 = 10/13",
      ],
      final_answer: "10/13",
    },
    shortcut_method: "52 − 12 = 40 non-face cards ⇒ 40/52 = 10/13.",
    rng,
  });
}

// ============================================================================
// CATEGORY G: Conditional Probability (G1–G4)
// ============================================================================

// G1. Conditional Probability on Cards (P(King | Red), P(Face | Hearts), etc.)
function genG1_ConditionalCards(rng, difficulty) {
  const cases = [
    { event: "KING", given: "RED", text: "it is a King, given that it is a red card", fav: 2, space: 26 },
    { event: "FACE", given: "HEARTS", text: "it is a face card, given that it is a Heart", fav: 3, space: 13 },
    { event: "RED", given: "FACE", text: "it is a red card, given that it is a face card", fav: 6, space: 12 },
    { event: "KING", given: "FACE", text: "it is a King, given that it is a face card", fav: 4, space: 12 },
    { event: "ACE", given: "BLACK", text: "it is an Ace, given that it is a black card", fav: 2, space: 26 },
  ];
  const c = rng.pick(cases);
  const ans = R(c.fav, c.space);

  return assembleProbQ({
    templateId: `PROB_G1_COND_CARDS_${c.event}_${c.given}`,
    question_type: "Conditional Probability",
    sub_type: "Conditional probability with playing cards",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `A single card is drawn at random from a standard deck of 52 cards. What is the probability that ${c.text}?`,
    mathModel: { kind: "CARDS_SINGLE", event: c.event, given: c.given },
    exactRationalAnswer: ans,
    plausible: [R(c.fav, 52), ONE.sub(ans), R(c.fav + 1, c.space), R(c.space, 52)],
    solution: {
      given_data: [`Restricted sample space = ${c.space} cards`, `Favourable cards in restricted space = ${c.fav}`],
      formula: "P(A | B) = n(A ∩ B) / n(B)",
      steps: [
        `Conditioning restricts the sample space to ${c.space} equally likely cards`,
        `Among those ${c.space} cards, ${c.fav} satisfy the target condition`,
        `P(A | B) = ${c.fav}/${c.space} = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Restrict the denominator directly to the given condition (${c.space}), not 52 ⇒ ${c.fav}/${c.space} = ${ans.toFractionString()}.`,
    rng,
  });
}

// G2. Conditional Probability on Dice (Two Dice: Sum given First Die is Even, or Doubles given Sum is Even)
function genG2_ConditionalDice(rng, difficulty) {
  const cases = [
    {
      event: "SUM_EQ",
      target: 8,
      given: { cond: "FIRST_EVEN", val: 0 },
      text: "the sum of the two dice is 8, given that the first die shows an even number",
      fav: 3, // (2,6), (4,4), (6,2)
      space: 18,
    },
    {
      event: "DOUBLES",
      target: 0,
      given: { cond: "SUM_EVEN", val: 0 },
      text: "both dice show the same number (a doublet), given that the sum of the two dice is even",
      fav: 6, // all 6 doublets have even sum!
      space: 18,
    },
    {
      event: "SUM_AT_LEAST",
      target: 10,
      given: { cond: "FIRST_EVEN", val: 0 },
      text: "the sum is at least 10, given that the first die shows an even number",
      fav: 4, // (4,6), (6,4), (6,5), (6,6)
      space: 18,
    },
  ];
  const c = rng.pick(cases);
  const ans = R(c.fav, c.space);

  return assembleProbQ({
    templateId: `PROB_G2_COND_DICE_${c.event}`,
    question_type: "Conditional Probability",
    sub_type: "Conditional probability with two dice",
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains", "SBI PO Prelims"],
    question: `Two fair dice are rolled simultaneously. What is the probability that ${c.text}?`,
    mathModel: { kind: "DICE", numDice: 2, event: c.event, target: c.target, given: c.given },
    exactRationalAnswer: ans,
    plausible: [R(c.fav, 36), ONE.sub(ans), R(c.fav + 1, c.space), R(c.fav, 12)],
    solution: {
      given_data: [`Restricted outcomes matching condition = ${c.space}`, `Favourable outcomes in restricted space = ${c.fav}`],
      formula: "P(A | B) = n(A ∩ B) / n(B)",
      steps: [
        `Out of 36 ordered pairs, exactly ${c.space} satisfy the given condition`,
        `Of these ${c.space} pairs, ${c.fav} satisfy the target event`,
        `P(A | B) = ${c.fav}/${c.space} = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Divide the overlap count (${c.fav}) by the restricted space (${c.space}), not 36.`,
    rng,
  });
}

// G3. Conditional Probability on Balls (Second Draw Given First Draw Without Replacement)
function genG3_ConditionalBalls(rng, difficulty) {
  const r = rng.randInt(4, 8);
  const b = rng.randInt(4, 8);
  const g = rng.randInt(2, 5);
  const counts = [r, b, g];
  const total = r + b + g;
  const sameColor = rng.random() < 0.5;
  const ans = sameColor ? R(r - 1, total - 1) : R(b, total - 1);

  return assembleProbQ({
    templateId: "PROB_G3_COND_BALLS",
    question_type: "Conditional Probability",
    sub_type: "Selecting second ball given first ball without replacement",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
    question: `A bag contains ${r} red, ${b} blue, and ${g} green balls. Two balls are drawn one after another without replacement. Given that the first ball drawn is red, what is the probability that the second ball drawn is ${sameColor ? "also red" : "blue"}?`,
    mathModel: {
      kind: "BALLS_CONDITIONAL",
      counts,
      firstIdx: 0,
      secondIdx: sameColor ? 0 : 1,
      withReplacement: false,
    },
    exactRationalAnswer: ans,
    plausible: [sameColor ? R(r, total) : R(b, total), sameColor ? R(r - 1, total) : R(b - 1, total - 1), ONE.sub(ans), R(r, total - 1)],
    solution: {
      given_data: [`Initial: ${r} red, ${b} blue, ${g} green (Total = ${total})`, "First ball drawn = red (not replaced)"],
      formula: "P(Second | First = Red) = Remaining target balls / (Total − 1)",
      steps: [
        `After removing 1 red ball, remaining balls = ${total - 1} (${r - 1} red, ${b} blue, ${g} green)`,
        `P(2nd is ${sameColor ? "red" : "blue"} | 1st is red) = ${sameColor ? r - 1 : b}/${total - 1} = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Update the bag state after the 1st draw: denominator becomes ${total - 1}.`,
    rng,
  });
}

// G4. Direct Conditional Formula P(A|B) = P(A ∩ B) / P(B)
function genG4_ConditionalFormula(rng, difficulty) {
  const configs = [
    [R(1, 2), R(2, 5), R(1, 5)], // P(A|B) = (1/5)/(2/5) = 1/2
    [R(3, 5), R(1, 2), R(3, 10)], // 3/5
    [R(2, 3), R(1, 2), R(1, 3)], // 2/3
    [R(3, 4), R(2, 3), R(1, 2)], // 3/4
    [R(4, 5), R(1, 2), R(3, 10)], // 3/5
    [R(3, 5), R(3, 4), R(3, 10)], // 2/5
  ];
  const [pA, pB, pInter] = rng.pick(configs);
  const ans = pInter.div(pB);

  return assembleProbQ({
    templateId: "PROB_G4_COND_FORMULA",
    question_type: "Conditional Probability",
    sub_type: "Applying P(A|B) = P(A ∩ B) / P(B)",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: `For two events A and B in a random experiment, P(A) = ${pA.toFractionString()}, P(B) = ${pB.toFractionString()}, and P(A ∩ B) = ${pInter.toFractionString()}. Find the conditional probability P(A | B).`,
    mathModel: { kind: "EVENTS_ALGEBRA", mode: "CONDITIONAL_FORMULA", pA, pB, pAandB: pInter },
    exactRationalAnswer: ans,
    plausible: [pInter.div(pA), pA.mul(pB), pA.add(pB).sub(pInter), ONE.sub(ans)],
    solution: {
      given_data: [`P(A) = ${pA.toFractionString()}, P(B) = ${pB.toFractionString()}, P(A ∩ B) = ${pInter.toFractionString()}`],
      formula: "P(A | B) = P(A ∩ B) / P(B)",
      steps: [
        `P(A | B) = (${pInter.toFractionString()}) ÷ (${pB.toFractionString()})`,
        `P(A | B) = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Divide P(A ∩ B) by P(B) — not by P(A).`,
    rng,
  });
}

// ============================================================================
// CATEGORY H: With and Without Replacement (H1–H3)
// ============================================================================

// H1. Two Successive Selections WITH Replacement (Same / Different Colour)
function genH1_WithReplacementTwo(rng, difficulty) {
  const r = rng.randInt(3, 7);
  const b = rng.randInt(3, 7);
  const counts = [r, b];
  const total = r + b;
  const askSame = rng.random() < 0.5;
  const pSame = R(r * r + b * b, total * total);
  const ans = askSame ? pSame : ONE.sub(pSame);
  // Distractor: without-replacement answer
  const wrongNoRepl = new Rational(nCr(r, 2) + nCr(b, 2), nCr(total, 2));

  return assembleProbQ({
    templateId: "PROB_H1_WITH_REPLACEMENT_TWO",
    question_type: "With and Without Replacement",
    sub_type: askSame ? "Two draws with replacement — same colour" : "Two draws with replacement — different colours",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
    question: `A bag contains ${r} red balls and ${b} blue balls. Two balls are drawn one after another WITH replacement. What is the probability that both balls drawn are of ${askSame ? "the same colour" : "different colours"}?`,
    mathModel: {
      kind: "BALLS_SEQ",
      counts,
      sequence: [0, 0],
      withReplacement: true,
      unordered: true,
      event: askSame ? "SAME_COLOR" : "DIFF_COLOR",
    },
    exactRationalAnswer: ans,
    plausible: [ONE.sub(ans), askSame ? wrongNoRepl : ONE.sub(wrongNoRepl), R(r * b, total * total), R(r, total)],
    solution: {
      given_data: [`Red = ${r}, Blue = ${b} (Total = ${total})`, "Drawn WITH replacement (counts restored after 1st draw)"],
      formula: askSame ? "P(same) = (r/N)² + (b/N)²" : "P(different) = 2 × (r/N) × (b/N)",
      steps: [
        `P(both red) = (${r}/${total})² = ${r * r}/${total * total}; P(both blue) = (${b}/${total})² = ${b * b}/${total * total}`,
        askSame
          ? `P(same colour) = (${r * r} + ${b * b}) / ${total * total} = ${ans.toFractionString()}`
          : `P(different colours) = 1 − ${pSame.toFractionString()} = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `With replacement, denominator stays ${total} on every draw.`,
    rng,
  });
}

// H2. Ordered Sequence Without Replacement (First Red, Second Blue — or 3 draws in Hard)
function genH2_OrderedSequenceWithoutRepl(rng, difficulty) {
  const r = rng.randInt(4, 7);
  const b = rng.randInt(4, 7);
  const g = rng.randInt(3, 5);
  const counts = [r, b, g];
  const total = r + b + g;
  const isThree = difficulty === "Hard";
  const seq = isThree ? [0, 1, 2] : [0, 1];
  const ans = isThree
    ? R(r, total).mul(R(b, total - 1)).mul(R(g, total - 2))
    : R(r, total).mul(R(b, total - 1));
  const wrongWithRepl = isThree
    ? R(r * b * g, total * total * total)
    : R(r * b, total * total);
  const wrongUnordered = ans.mul(R(isThree ? 6 : 2));

  return assembleProbQ({
    templateId: "PROB_H2_ORDERED_WITHOUT_REPL",
    question_type: "With and Without Replacement",
    sub_type: isThree ? "Three successive ordered draws without replacement" : "Two successive ordered draws without replacement",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: isThree
      ? `A box contains ${r} red, ${b} blue, and ${g} green balls. Three balls are drawn one by one WITHOUT replacement. What is the probability that the first is red, the second is blue, and the third is green (in that exact order)?`
      : `A box contains ${r} red, ${b} blue, and ${g} green balls. Two balls are drawn one by one WITHOUT replacement. What is the probability that the first ball is red and the second ball is blue?`,
    mathModel: { kind: "BALLS_SEQ", counts, sequence: seq, withReplacement: false, unordered: false },
    exactRationalAnswer: ans,
    plausible: [wrongWithRepl, wrongUnordered, ONE.sub(ans), R(r, total)],
    solution: {
      given_data: [`Red = ${r}, Blue = ${b}, Green = ${g} (Total = ${total})`, "Exact ordered sequence WITHOUT replacement"],
      formula: "P(A₁ then A₂...) = P(A₁) × P(A₂ | A₁) × ...",
      steps: [
        isThree
          ? `P(R, then B, then G) = (${r}/${total}) × (${b}/${total - 1}) × (${g}/${total - 2})`
          : `P(R, then B) = (${r}/${total}) × (${b}/${total - 1})`,
        `Simplified Probability = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Exact order specified ⇒ do NOT multiply by permutation factor; simply multiply conditional fractions.`,
    rng,
  });
}

// ============================================================================
// CATEGORY I: Independent and Mutually Exclusive Events (I1–I3)
// ============================================================================

// I1. Two Independent Events — Both Occur / Neither Occurs / Exactly One Occurs
function genI1_IndependentEvents(rng, difficulty) {
  const pool = [R(1, 2), R(1, 3), R(2, 3), R(1, 4), R(3, 4), R(1, 5), R(2, 5), R(3, 5)];
  const pA = rng.pick(pool);
  const pB = rng.pick(pool);
  const mode = rng.pick(["IND_BOTH", "IND_NEITHER", "IND_EXACTLY_ONE"]);
  let ans;
  let phrase;
  if (mode === "IND_BOTH") {
    ans = pA.mul(pB);
    phrase = "both events A and B occur";
  } else if (mode === "IND_NEITHER") {
    ans = ONE.sub(pA).mul(ONE.sub(pB));
    phrase = "neither event A nor event B occurs";
  } else {
    ans = pA.mul(ONE.sub(pB)).add(ONE.sub(pA).mul(pB));
    phrase = "exactly one of the two events occurs";
  }

  return assembleProbQ({
    templateId: `PROB_I1_${mode}`,
    question_type: "Independent and Mutually Exclusive Events",
    sub_type: `Independent events — ${phrase}`,
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `A and B are two independent events with P(A) = ${pA.toFractionString()} and P(B) = ${pB.toFractionString()}. What is the probability that ${phrase}?`,
    mathModel: { kind: "EVENTS_ALGEBRA", mode, pA, pB },
    exactRationalAnswer: ans,
    plausible: [ONE.sub(ans), pA.mul(pB), ONE.sub(pA).mul(ONE.sub(pB)), pA.add(pB).sub(pA.mul(pB))],
    solution: {
      given_data: [`P(A) = ${pA.toFractionString()}, P(B) = ${pB.toFractionString()}`, "A and B are independent"],
      formula:
        mode === "IND_BOTH"
          ? "P(A ∩ B) = P(A) × P(B)"
          : mode === "IND_NEITHER"
          ? "P(A' ∩ B') = (1 − P(A)) × (1 − P(B))"
          : "P(exactly one) = P(A)(1 − P(B)) + (1 − P(A))P(B)",
      steps: [
        `Using independence of A and B with P(A') = ${ONE.sub(pA).toFractionString()} and P(B') = ${ONE.sub(pB).toFractionString()}`,
        `Calculated probability = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `For independent events, multiply probabilities directly along each branch.`,
    rng,
  });
}

// I2. Mutually Exclusive vs General Union Rule
function genI2_UnionRules(rng, difficulty) {
  const isMutEx = rng.random() < 0.5;
  if (isMutEx) {
    const pairs = [
      [R(1, 4), R(1, 3)], [R(1, 5), R(2, 5)], [R(1, 6), R(1, 3)],
      [R(2, 7), R(3, 7)], [R(1, 4), R(2, 5)], [R(1, 3), R(2, 5)],
    ];
    const [pA, pB] = rng.pick(pairs);
    const ans = pA.add(pB);
    return assembleProbQ({
      templateId: "PROB_I2_MUTUALLY_EXCLUSIVE",
      question_type: "Independent and Mutually Exclusive Events",
      sub_type: "Mutually exclusive events — P(A ∪ B)",
      difficulty,
      exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
      question: `If A and B are two mutually exclusive events such that P(A) = ${pA.toFractionString()} and P(B) = ${pB.toFractionString()}, find P(A ∪ B).`,
      mathModel: { kind: "EVENTS_ALGEBRA", mode: "MUTUALLY_EXCLUSIVE_UNION", pA, pB },
      exactRationalAnswer: ans,
      plausible: [pA.mul(pB), pA.add(pB).sub(pA.mul(pB)), ONE.sub(ans), pB.sub(pA)],
      solution: {
        given_data: [`P(A) = ${pA.toFractionString()}, P(B) = ${pB.toFractionString()}`, "Mutually exclusive ⇒ P(A ∩ B) = 0"],
        formula: "P(A ∪ B) = P(A) + P(B)",
        steps: [
          `Since A and B are mutually exclusive, P(A ∩ B) = 0`,
          `P(A ∪ B) = ${pA.toFractionString()} + ${pB.toFractionString()} = ${ans.toFractionString()}`,
        ],
        final_answer: ans.toFractionString(),
      },
      shortcut_method: `Mutually exclusive events cannot overlap, so simply add P(A) + P(B) = ${ans.toFractionString()}.`,
      rng,
    });
  } else {
    const configs = [
      [R(1, 2), R(1, 3), R(1, 6)], // 2/3
      [R(3, 5), R(2, 5), R(1, 5)], // 4/5
      [R(1, 2), R(2, 5), R(1, 10)], // 4/5
      [R(2, 3), R(1, 2), R(1, 3)], // 5/6
      [R(3, 4), R(1, 2), R(3, 8)], // 7/8
    ];
    const [pA, pB, pInter] = rng.pick(configs);
    const ans = pA.add(pB).sub(pInter);
    return assembleProbQ({
      templateId: "PROB_I2_GENERAL_UNION",
      question_type: "Independent and Mutually Exclusive Events",
      sub_type: "General addition rule — P(A ∪ B)",
      difficulty,
      exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
      question: `For two events A and B, P(A) = ${pA.toFractionString()}, P(B) = ${pB.toFractionString()}, and P(A ∩ B) = ${pInter.toFractionString()}. What is the value of P(A ∪ B)?`,
      mathModel: { kind: "EVENTS_ALGEBRA", mode: "GENERAL_UNION", pA, pB, pAandB: pInter },
      exactRationalAnswer: ans,
      plausible: [pA.add(pB), ONE.sub(ans), pA.add(pB).add(pInter), pA.mul(pB)],
      solution: {
        given_data: [`P(A) = ${pA.toFractionString()}, P(B) = ${pB.toFractionString()}, P(A ∩ B) = ${pInter.toFractionString()}`],
        formula: "P(A ∪ B) = P(A) + P(B) − P(A ∩ B)",
        steps: [
          `P(A ∪ B) = ${pA.toFractionString()} + ${pB.toFractionString()} − ${pInter.toFractionString()}`,
          `P(A ∪ B) = ${ans.toFractionString()}`,
        ],
        final_answer: ans.toFractionString(),
      },
      shortcut_method: `Add P(A) and P(B) and subtract the overlap P(A ∩ B).`,
      rng,
    });
  }
}

// ============================================================================
// CATEGORY J: Exactly, At Least and At Most — Binomial Probability (J1–J3)
// ============================================================================

// J1. Binomial — Exactly r Successes in n Independent Trials
function genJ1_BinomialExact(rng, difficulty) {
  const configs = [
    { n: 3, r: 2, p: R(1, 2), scenario: "getting a Head in 3 tosses of a fair coin" },
    { n: 4, r: 2, p: R(1, 2), scenario: "getting a Head in 4 tosses of a fair coin" },
    { n: 3, r: 2, p: R(1, 3), scenario: "hitting a target in 3 independent shots (hit probability 1/3 each)" },
    { n: 3, r: 1, p: R(1, 4), scenario: "selecting a winning coupon in 3 independent draws with replacement (win probability 1/4 each)" },
    { n: 4, r: 3, p: R(2, 3), scenario: "clearing a quality check in 4 independent tests (pass probability 2/3 each)" },
    { n: 3, r: 2, p: R(2, 5), scenario: "scoring a goal in 3 independent penalty kicks (success probability 2/5 each)" },
  ];
  const c = rng.pick(configs);
  const q = ONE.sub(c.p);
  const comb = new Rational(nCr(c.n, c.r), 1n);
  const ans = comb.mul(c.p.pow(c.r)).mul(q.pow(c.n - c.r));
  // Common distractor: forgetting the C(n, r) factor
  const wrongNoComb = c.p.pow(c.r).mul(q.pow(c.n - c.r));

  return assembleProbQ({
    templateId: "PROB_J1_BINOMIAL_EXACT",
    question_type: "Exactly, At Least and At Most",
    sub_type: `Binomial probability — exactly ${c.r} successes`,
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains", "SBI PO Mains"],
    question: `Find the probability of exactly ${c.r} success${c.r > 1 ? "es" : ""} when ${c.scenario}.`,
    mathModel: { kind: "BINOMIAL", n: c.n, p: c.p, mode: "EXACT", r: c.r },
    exactRationalAnswer: ans,
    plausible: [wrongNoComb, ONE.sub(ans), c.p.pow(c.r), q.pow(c.n)],
    solution: {
      given_data: [`n = ${c.n} independent trials`, `p = ${c.p.toFractionString()}, q = 1 − p = ${q.toFractionString()}`, `r = ${c.r}`],
      formula: "P(X = r) = C(n, r) × p^r × (1 − p)^(n − r)",
      steps: [
        `C(${c.n}, ${c.r}) = ${nCr(c.n, c.r)}`,
        `P(X = ${c.r}) = ${nCr(c.n, c.r)} × (${c.p.toFractionString()})^${c.r} × (${q.toFractionString()})^${c.n - c.r}`,
        `Simplified Probability = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: `Never omit C(${c.n}, ${c.r}) = ${nCr(c.n, c.r)} when order of successes is not fixed.`,
    rng,
  });
}

// J2. Binomial — At Least r Successes (Hard)
function genJ2_BinomialAtLeast(rng, difficulty) {
  const configs = [
    { n: 3, r: 2, p: R(1, 3) }, // C(3,2)(1/3)^2(2/3) + (1/3)^3 = 7/27
    { n: 3, r: 2, p: R(2, 3) }, // 12/27 + 8/27 = 20/27
    { n: 3, r: 1, p: R(1, 4) }, // 1 - (3/4)^3 = 37/64
    { n: 4, r: 3, p: R(1, 2) }, // (4+1)/16 = 5/16
    { n: 3, r: 2, p: R(3, 5) }, // (3*9*2 + 27)/125 = 81/125
  ];
  const c = rng.pick(configs);
  const q = ONE.sub(c.p);
  let ans = ZERO;
  for (let k = c.r; k <= c.n; k++) {
    ans = ans.add(new Rational(nCr(c.n, k), 1n).mul(c.p.pow(k)).mul(q.pow(c.n - k)));
  }
  const exactOnly = new Rational(nCr(c.n, c.r), 1n).mul(c.p.pow(c.r)).mul(q.pow(c.n - c.r));

  return assembleProbQ({
    templateId: "PROB_J2_BINOMIAL_AT_LEAST",
    question_type: "Exactly, At Least and At Most",
    sub_type: `Binomial probability — at least ${c.r} successes`,
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains", "SBI PO Prelims"],
    question: `An automated scanner detects a defective cheque with a constant probability of ${c.p.toFractionString()} on each independent trial. If ${c.n} independent trials are conducted, what is the probability of getting at least ${c.r} detection${c.r > 1 ? "s" : ""}?`,
    mathModel: { kind: "BINOMIAL", n: c.n, p: c.p, mode: "AT_LEAST", r: c.r },
    exactRationalAnswer: ans,
    plausible: [exactOnly, ONE.sub(ans), c.p.pow(c.r), q.pow(c.n)],
    solution: {
      given_data: [`n = ${c.n}, p = ${c.p.toFractionString()}, q = ${q.toFractionString()}`, `Required: P(X ≥ ${c.r})`],
      formula: `P(X ≥ ${c.r}) = Sum of C(${c.n}, k) × p^k × q^(${c.n}−k) for k = ${c.r}..${c.n}`,
      steps: [
        `Sum the binomial probabilities from k = ${c.r} to ${c.n}`,
        `Exact combined probability = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: c.r === 1 ? `Use complement: 1 − q^${c.n} = 1 − (${q.toFractionString()})^${c.n} = ${ans.toFractionString()}.` : `Add P(X = ${c.r}) + ... + P(X = ${c.n}) = ${ans.toFractionString()}.`,
    rng,
  });
}

// J3. Binomial — At Most r Successes (Hard)
function genJ3_BinomialAtMost(rng, difficulty) {
  const configs = [
    { n: 3, r: 1, p: R(1, 3) }, // (2/3)^3 + 3(1/3)(2/3)^2 = 20/27
    { n: 3, r: 1, p: R(1, 2) }, // 4/8 = 1/2
    { n: 4, r: 1, p: R(1, 2) }, // 5/16
    { n: 3, r: 1, p: R(1, 4) }, // (27+27)/64 = 27/32
    { n: 3, r: 2, p: R(2, 3) }, // 1 - (2/3)^3 = 19/27
  ];
  const c = rng.pick(configs);
  const q = ONE.sub(c.p);
  let ans = ZERO;
  for (let k = 0; k <= c.r; k++) {
    ans = ans.add(new Rational(nCr(c.n, k), 1n).mul(c.p.pow(k)).mul(q.pow(c.n - k)));
  }
  const exactOnly = new Rational(nCr(c.n, c.r), 1n).mul(c.p.pow(c.r)).mul(q.pow(c.n - c.r));

  return assembleProbQ({
    templateId: "PROB_J3_BINOMIAL_AT_MOST",
    question_type: "Exactly, At Least and At Most",
    sub_type: `Binomial probability — at most ${c.r} successes`,
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains"],
    question: `A machine produces a defective component with probability ${c.p.toFractionString()} independently for each item. In a batch of ${c.n} items, what is the probability of finding at most ${c.r} defective item${c.r > 1 ? "s" : ""}?`,
    mathModel: { kind: "BINOMIAL", n: c.n, p: c.p, mode: "AT_MOST", r: c.r },
    exactRationalAnswer: ans,
    plausible: [exactOnly, ONE.sub(ans), q.pow(c.n), c.p.pow(c.r)],
    solution: {
      given_data: [`n = ${c.n}, p = ${c.p.toFractionString()}, q = ${q.toFractionString()}`, `Required: P(X ≤ ${c.r})`],
      formula: `P(X ≤ ${c.r}) = Sum of P(X = k) for k = 0..${c.r}`,
      steps: [
        `Compute binomial terms for k = 0 up to ${c.r} and sum them`,
        `Exact probability P(X ≤ ${c.r}) = ${ans.toFractionString()}`,
      ],
      final_answer: ans.toFractionString(),
    },
    shortcut_method: c.r === c.n - 1 ? `Use complement: 1 − P(X = ${c.n}) = ${ans.toFractionString()}.` : `Sum P(X=0) + P(X=1) = ${ans.toFractionString()}.`,
    rng,
  });
}

export const PROB_TEMPLATES_PART_2 = [
  { id: "PROB_F1", category: "F", difficulties: ["Medium", "Hard"], fn: genF1_AtLeastOneComplement },
  { id: "PROB_F2", category: "F", difficulties: ["Easy"], fn: genF2_NotGettingCard },

  { id: "PROB_G1", category: "G", difficulties: ["Medium"], fn: genG1_ConditionalCards },
  { id: "PROB_G2", category: "G", difficulties: ["Hard"], fn: genG2_ConditionalDice },
  { id: "PROB_G3", category: "G", difficulties: ["Medium"], fn: genG3_ConditionalBalls },
  { id: "PROB_G4", category: "G", difficulties: ["Medium", "Hard"], fn: genG4_ConditionalFormula },

  { id: "PROB_H1", category: "H", difficulties: ["Medium"], fn: genH1_WithReplacementTwo },
  { id: "PROB_H2", category: "H", difficulties: ["Medium", "Hard"], fn: genH2_OrderedSequenceWithoutRepl },

  { id: "PROB_I1", category: "I", difficulties: ["Medium"], fn: genI1_IndependentEvents },
  { id: "PROB_I2", category: "I", difficulties: ["Easy", "Medium"], fn: genI2_UnionRules },

  { id: "PROB_J1", category: "J", difficulties: ["Medium", "Hard"], fn: genJ1_BinomialExact },
  { id: "PROB_J2", category: "J", difficulties: ["Hard"], fn: genJ2_BinomialAtLeast },
  { id: "PROB_J3", category: "J", difficulties: ["Hard"], fn: genJ3_BinomialAtMost },
];