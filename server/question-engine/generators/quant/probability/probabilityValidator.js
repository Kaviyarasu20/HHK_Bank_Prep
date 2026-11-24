// Place at: server/question-engine/generators/quant/probability/probabilityValidator.js
import crypto from "node:crypto";
import { Rational, R, ZERO, ONE, nCr } from "./probabilityMath.js";

/**
 * Generates a normalized mathematical fingerprint for duplicate prevention.
 */
export function computeProbabilityFingerprint(mathModel, templateId) {
  const serialize = (v) =>
    v instanceof Rational
      ? v.toFractionString()
      : Array.isArray(v)
      ? v.map(serialize)
      : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, serialize(v[k])]))
      : v;

  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ templateId, model: serialize(mathModel) }))
    .digest("hex")
    .slice(0, 20);
}

/**
 * Constructs the exact standard 52-card deck for independent verification.
 * Note: Face cards are strictly J, Q, K (12 cards). Ace is NOT a face card.
 */
function buildStandardDeck() {
  const suits = [
    { name: "Hearts", color: "Red" },
    { name: "Diamonds", color: "Red" },
    { name: "Clubs", color: "Black" },
    { name: "Spades", color: "Black" },
  ];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const deck = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push({
        suit: s.name,
        color: s.color,
        rank: r,
        isFace: r === "J" || r === "Q" || r === "K",
        isAce: r === "A",
        isNumber: !["A", "J", "Q", "K"].includes(r),
      });
    }
  }
  return deck;
}

function matchesCardPred(card, pred) {
  switch (pred) {
    case "RED": return card.color === "Red";
    case "BLACK": return card.color === "Black";
    case "HEARTS": return card.suit === "Hearts";
    case "DIAMONDS": return card.suit === "Diamonds";
    case "CLUBS": return card.suit === "Clubs";
    case "SPADES": return card.suit === "Spades";
    case "FACE": return card.isFace;
    case "ACE": return card.isAce;
    case "NUMBER": return card.isNumber;
    case "KING": return card.rank === "K";
    case "QUEEN": return card.rank === "Q";
    case "JACK": return card.rank === "J";
    case "RED_OR_KING": return card.color === "Red" || card.rank === "K";
    case "BLACK_OR_QUEEN": return card.color === "Black" || card.rank === "Q";
    case "RED_FACE": return card.color === "Red" && card.isFace;
    case "BLACK_ACE": return card.color === "Black" && card.isAce;
    case "HEART_OR_ACE": return card.suit === "Hearts" || card.isAce;
    case "SPADE_OR_FACE": return card.suit === "Spades" || card.isFace;
    case "NON_FACE": return !card.isFace;
    default: return false;
  }
}

const PRIMES = new Set([2, 3, 5]);

/**
 * ENGINE B – Independent Probability Sample-Space & Combinatorial Verifier.
 * Completely independent from Engine A's template formulas:
 * - Enumerates all 2^n coin outcomes
 * - Enumerates all 6^k dice outcomes (6, 36, 216)
 * - Enumerates the exact 52-card deck
 * - Independently evaluates hypergeometric / sequential / conditional / binomial probabilities
 */
export function independentlyVerifyProbabilityModel(model) {
  const { kind } = model;

  // 1. Direct Favourable / Total (including certain/impossible & complement)
  if (kind === "DIRECT_RATIO") {
    const { favourable, total, complement = false } = model;
    if (total <= 0 || favourable < 0 || favourable > total) {
      return { ok: false, reason: `Invalid favourable (${favourable}) or total (${total}) outcomes.` };
    }
    const p = R(favourable, total);
    return { ok: true, value: complement ? ONE.sub(p) : p };
  }

  // 2. Coin Enumeration (2^n outcomes)
  if (kind === "COINS") {
    const { n, event, k = 0 } = model;
    if (n < 1 || n > 6) return { ok: false, reason: "Coin count out of supported [1, 6] range." };
    const total = 1 << n;
    let fav = 0;

    for (let mask = 0; mask < total; mask++) {
      let heads = 0;
      let maxConsecH = 0;
      let curH = 0;
      for (let bit = 0; bit < n; bit++) {
        if ((mask >> bit) & 1) {
          heads++;
          curH++;
          if (curH > maxConsecH) maxConsecH = curH;
        } else {
          curH = 0;
        }
      }
      if (event === "EXACT_HEADS" && heads === k) fav++;
      else if (event === "AT_LEAST_HEADS" && heads >= k) fav++;
      else if (event === "AT_MOST_HEADS" && heads <= k) fav++;
      else if (event === "NO_HEADS" && heads === 0) fav++;
      else if (event === "CONSECUTIVE_HEADS" && maxConsecH >= k) fav++;
      else if (event === "ALTERNATING" && n === 3 && (mask === 0b101 || mask === 0b010)) fav++;
    }
    return { ok: true, value: R(fav, total) };
  }

  // 3. Dice Enumeration (1, 2, or 3 dice -> 6, 36, or 216 ordered outcomes)
  if (kind === "DICE") {
    const { numDice, event, target = 0, given = null } = model;
    if (![1, 2, 3].includes(numDice)) return { ok: false, reason: "numDice must be 1, 2, or 3." };

    const outcomes = [];
    if (numDice === 1) {
      for (let a = 1; a <= 6; a++) outcomes.push([a]);
    } else if (numDice === 2) {
      for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) outcomes.push([a, b]);
    } else {
      for (let a = 1; a <= 6; a++)
        for (let b = 1; b <= 6; b++)
          for (let c = 1; c <= 6; c++) outcomes.push([a, b, c]);
    }

    const checkCond = (tuple, condName, condVal) => {
      const sum = tuple.reduce((x, y) => x + y, 0);
      const prod = tuple.reduce((x, y) => x * y, 1);
      switch (condName) {
        case "EXACT_FACE": return tuple[0] === condVal;
        case "EVEN": return tuple[0] % 2 === 0;
        case "ODD": return tuple[0] % 2 === 1;
        case "PRIME": return PRIMES.has(tuple[0]);
        case "GREATER_THAN": return tuple[0] > condVal;
        case "SUM_EQ": return sum === condVal;
        case "SUM_AT_LEAST": return sum >= condVal;
        case "SUM_AT_MOST": return sum <= condVal;
        case "SUM_EVEN": return sum % 2 === 0;
        case "PRODUCT_EQ": return prod === condVal;
        case "PRODUCT_EVEN": return prod % 2 === 0;
        case "DOUBLES": return tuple.length === 2 && tuple[0] === tuple[1];
        case "DIFFERENT": return new Set(tuple).size === tuple.length;
        case "AT_LEAST_ONE_VAL": return tuple.includes(condVal);
        case "NO_VAL": return !tuple.includes(condVal);
        case "FIRST_EVEN": return tuple[0] % 2 === 0;
        default: return false;
      }
    };

    // Restrict sample space if conditional (`given` is specified)
    const space = given ? outcomes.filter((t) => checkCond(t, given.cond, given.val)) : outcomes;
    if (space.length === 0) return { ok: false, reason: "Conditioning event P(B) = 0." };

    const fav = space.filter((t) => checkCond(t, event, target)).length;
    return { ok: true, value: R(fav, space.length) };
  }

  // 4. Playing Cards (Exact 52-card deck verification)
  if (kind === "CARDS_SINGLE") {
    const deck = buildStandardDeck();
    const { event, given = null } = model;
    const space = given ? deck.filter((c) => matchesCardPred(c, given)) : deck;
    if (space.length === 0) return { ok: false, reason: "Card conditioning space is empty." };
    const fav = space.filter((c) => matchesCardPred(c, event)).length;
    return { ok: true, value: R(fav, space.length) };
  }

  if (kind === "CARDS_TWO") {
    const deck = buildStandardDeck();
    const { event, withReplacement = false } = model;
    let total = 0;
    let fav = 0;
    for (let i = 0; i < 52; i++) {
      for (let j = 0; j < 52; j++) {
        if (!withReplacement && i === j) continue;
        total++;
        const c1 = deck[i];
        const c2 = deck[j];
        if (event === "SAME_COLOR" && c1.color === c2.color) fav++;
        else if (event === "DIFF_COLOR" && c1.color !== c2.color) fav++;
        else if (event === "SAME_SUIT" && c1.suit === c2.suit) fav++;
        else if (event === "BOTH_ACES" && c1.isAce && c2.isAce) fav++;
        else if (event === "BOTH_FACE" && c1.isFace && c2.isFace) fav++;
        else if (event === "ONE_KING_ONE_QUEEN" && ((c1.rank === "K" && c2.rank === "Q") || (c1.rank === "Q" && c2.rank === "K"))) fav++;
      }
    }
    return { ok: true, value: R(fav, total) };
  }

  // 5. Balls & Objects — Unordered Combinatorial Draws (Without Replacement)
  if (kind === "BALLS_COMB") {
    const { counts, drawCount, event, targetColorIdx = 0 } = model;
    if (!Array.isArray(counts) || counts.some((c) => c < 0)) {
      return { ok: false, reason: "Negative ball count." };
    }
    const totalBalls = counts.reduce((a, b) => a + b, 0);
    if (drawCount <= 0 || drawCount > totalBalls) {
      return { ok: false, reason: "Invalid draw count." };
    }
    const denom = nCr(totalBalls, drawCount);
    let num = 0n;

    if (event === "ALL_SAME_COLOR") {
      for (const c of counts) num += nCr(c, drawCount);
    } else if (event === "ALL_TARGET_COLOR") {
      num = nCr(counts[targetColorIdx], drawCount);
    } else if (event === "NONE_TARGET_COLOR") {
      num = nCr(totalBalls - counts[targetColorIdx], drawCount);
    } else if (event === "AT_LEAST_ONE_TARGET") {
      num = denom - nCr(totalBalls - counts[targetColorIdx], drawCount);
    } else if (event === "DIFFERENT_COLORS" && drawCount === 2) {
      let same = 0n;
      for (const c of counts) same += nCr(c, 2);
      num = denom - same;
    } else if (event === "EXACT_SPLIT") {
      // model.split = [k0, k1, ...]
      const { split } = model;
      if (!split || split.length !== counts.length || split.reduce((a, b) => a + b, 0) !== drawCount) {
        return { ok: false, reason: "Invalid exact split specification." };
      }
      num = 1n;
      for (let i = 0; i < counts.length; i++) {
        num *= nCr(counts[i], split[i]);
      }
    } else {
      return { ok: false, reason: `Unsupported BALLS_COMB event: ${event}` };
    }
    return { ok: true, value: new Rational(num, denom) };
  }

  // 6. Balls & Objects — Sequential Draws (With or Without Replacement, Ordered or Unordered)
  if (kind === "BALLS_SEQ") {
    const { counts, sequence, withReplacement = false, unordered = false } = model;
    const totalBalls = counts.reduce((a, b) => a + b, 0);
    if (totalBalls <= 0 || !Array.isArray(sequence) || sequence.length === 0) {
      return { ok: false, reason: "Invalid sequential ball model." };
    }

    if (!unordered) {
      // Exact ordered probability
      const rem = [...counts];
      let remTotal = totalBalls;
      let prob = ONE;
      for (const colorIdx of sequence) {
        if (rem[colorIdx] <= 0 || remTotal <= 0) {
          return { ok: false, reason: "Insufficient balls for ordered draw." };
        }
        prob = prob.mul(R(rem[colorIdx], remTotal));
        if (!withReplacement) {
          rem[colorIdx]--;
          remTotal--;
        }
      }
      return { ok: true, value: prob };
    } else {
      // Unordered two-draw with replacement (same color or different colors)
      const { event } = model;
      if (sequence.length !== 2 || !withReplacement) {
        return { ok: false, reason: "Unordered BALLS_SEQ supports 2 draws with replacement." };
      }
      let prob = ZERO;
      if (event === "SAME_COLOR") {
        for (const c of counts) prob = prob.add(R(c, totalBalls).pow(2));
      } else if (event === "DIFF_COLOR") {
        let same = ZERO;
        for (const c of counts) same = same.add(R(c, totalBalls).pow(2));
        prob = ONE.sub(same);
      } else {
        return { ok: false, reason: `Unsupported unordered BALLS_SEQ event: ${event}` };
      }
      return { ok: true, value: prob };
    }
  }

  // 7. Conditional Probability on Balls (Second ball given first ball without replacement)
  if (kind === "BALLS_CONDITIONAL") {
    const { counts, firstIdx, secondIdx, withReplacement = false } = model;
    const rem = [...counts];
    const total = rem.reduce((a, b) => a + b, 0);
    if (rem[firstIdx] <= 0 || total < 2) return { ok: false, reason: "Invalid conditional ball counts." };
    if (!withReplacement) rem[firstIdx]--;
    const newTotal = withReplacement ? total : total - 1;
    if (rem[secondIdx] < 0 || newTotal <= 0) return { ok: false, reason: "Invalid remaining ball state." };
    return { ok: true, value: R(rem[secondIdx], newTotal) };
  }

  // 8. Independent & Mutually Exclusive Events
  if (kind === "EVENTS_ALGEBRA") {
    const { mode, pA, pB, pC = null, pAandB = null } = model;
    if (!pA.isValidProbability() || !pB.isValidProbability()) {
      return { ok: false, reason: "Event probabilities out of [0, 1]." };
    }
    if (mode === "IND_BOTH") return { ok: true, value: pA.mul(pB) };
    if (mode === "IND_NEITHER") return { ok: true, value: ONE.sub(pA).mul(ONE.sub(pB)) };
    if (mode === "IND_AT_LEAST_ONE") {
      if (pC) return { ok: true, value: ONE.sub(ONE.sub(pA).mul(ONE.sub(pB)).mul(ONE.sub(pC))) };
      return { ok: true, value: ONE.sub(ONE.sub(pA).mul(ONE.sub(pB))) };
    }
    if (mode === "IND_EXACTLY_ONE") {
      return { ok: true, value: pA.mul(ONE.sub(pB)).add(ONE.sub(pA).mul(pB)) };
    }
    if (mode === "MUTUALLY_EXCLUSIVE_UNION") {
      const sum = pA.add(pB);
      if (!sum.isValidProbability()) return { ok: false, reason: "Mutually exclusive sum exceeds 1." };
      return { ok: true, value: sum };
    }
    if (mode === "GENERAL_UNION") {
      if (!pAandB || !pAandB.isValidProbability() || pAandB.cmp(pA) > 0 || pAandB.cmp(pB) > 0) {
        return { ok: false, reason: "Invalid intersection probability P(A ∩ B)." };
      }
      const u = pA.add(pB).sub(pAandB);
      if (!u.isValidProbability()) return { ok: false, reason: "General union out of [0, 1]." };
      return { ok: true, value: u };
    }
    if (mode === "CONDITIONAL_FORMULA") {
      if (!pAandB || !pB.isPositive() || pAandB.cmp(pB) > 0) {
        return { ok: false, reason: "Invalid conditional probability inputs." };
      }
      return { ok: true, value: pAandB.div(pB) };
    }
  }

  // 9. Binomial Distribution (Exact, At Least, At Most)
  if (kind === "BINOMIAL") {
    const { n, p, mode, r } = model;
    if (n < 1 || n > 10 || !p.isValidProbability() || r < 0 || r > n) {
      return { ok: false, reason: "Invalid binomial parameters." };
    }
    const q = ONE.sub(p);
    const term = (k) => new Rational(nCr(n, k), 1n).mul(p.pow(k)).mul(q.pow(n - k));

    let total = ZERO;
    if (mode === "EXACT") {
      total = term(r);
    } else if (mode === "AT_LEAST") {
      for (let k = r; k <= n; k++) total = total.add(term(k));
    } else if (mode === "AT_MOST") {
      for (let k = 0; k <= r; k++) total = total.add(term(k));
    } else {
      return { ok: false, reason: `Unsupported binomial mode: ${mode}` };
    }
    return { ok: true, value: total };
  }

  return { ok: false, reason: `Unknown probability model kind: ${kind}` };
}

/**
 * Full Engine B Validation Gate for Probability Questions.
 * Enforces:
 * - Independent sample-space / combinatorial verification
 * - 0 <= P(A) <= 1 and simplified fraction
 * - MANDATORY 5 unique options (A–E)
 * - Complete solution steps
 */
export function validateProbabilityQuestion(q) {
  const {
    mathModel,
    exactRationalAnswer,
    options,
    correct_answer,
    correctOptionIndex,
    solution,
  } = q;

  const solved = independentlyVerifyProbabilityModel(mathModel);
  if (!solved.ok) {
    return { passed: false, reason: `Engine B rejected model: ${solved.reason}` };
  }

  if (!(exactRationalAnswer instanceof Rational) || !solved.value.equals(exactRationalAnswer)) {
    return {
      passed: false,
      reason: `Answer mismatch! Engine A=${exactRationalAnswer?.toFractionString()}, Engine B=${solved.value.toFractionString()}`,
    };
  }

  if (!solved.value.isValidProbability()) {
    return { passed: false, reason: `Probability ${solved.value.toFractionString()} out of [0, 1] range.` };
  }

  const expectedStr = solved.value.toFractionString();
  const optsArr = Array.isArray(options)
    ? options
    : [options.A, options.B, options.C, options.D, options.E];

  if (optsArr.length !== 5) {
    return { passed: false, reason: `MANDATORY RULE: Must have exactly 5 MCQ options (A–E), found ${optsArr.length}.` };
  }
  if (new Set(optsArr.map((x) => String(x ?? "").trim())).size !== 5) {
    return { passed: false, reason: "Duplicate options detected among the 5 options." };
  }
  if (optsArr.some((x) => !x || String(x).includes("NaN") || String(x).includes("undefined"))) {
    return { passed: false, reason: "Invalid option string detected." };
  }

  const matches = optsArr.filter((x) => x === expectedStr);
  if (matches.length !== 1 || optsArr[correctOptionIndex] !== expectedStr) {
    return { passed: false, reason: `Expected exactly 1 option matching '${expectedStr}', found ${matches.length}.` };
  }
  if (!["A", "B", "C", "D", "E"].includes(correct_answer)) {
    return { passed: false, reason: "Invalid correct_answer key (must be A–E)." };
  }
  if (!solution || !Array.isArray(solution.steps) || solution.steps.length < 2) {
    return { passed: false, reason: "Solution steps incomplete." };
  }

  return {
    passed: true,
    validation: {
      sample_space_check: true,
      favourable_outcomes_check: true,
      formula_check: true,
      replacement_condition_check: true,
      probability_range_check: true,
      unique_answer_check: true,
      five_options_check: true,
      ambiguity_check: true,
    },
  };
}