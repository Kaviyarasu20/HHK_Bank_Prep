// Place at: server/question-engine/generators/quant/partnership/partnershipValidator.js
import crypto from "node:crypto";
import {
  Rational,
  R,
  ZERO,
  HUNDRED,
  reduceMultiRatio,
  formatPartnerValue,
} from "./partnershipMath.js";

/**
 * Generates a normalized mathematical fingerprint for duplicate prevention.
 */
export function computePartnershipFingerprint(mathModel, templateId) {
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
 * Helper: Computes exact capital-months for each partner from raw segment arrays
 * and validates that every capital and duration is strictly positive and within period.
 */
function computeEffectiveCapitals(partners, businessMonths) {
  if (!Array.isArray(partners) || partners.length < 2) {
    return { ok: false, reason: "Partnership requires at least 2 partners." };
  }
  if (!businessMonths.isPositive()) {
    return { ok: false, reason: "Business duration must be positive." };
  }

  const effectives = [];
  for (const p of partners) {
    if (!Array.isArray(p.segments) || p.segments.length === 0) {
      return { ok: false, reason: `Partner ${p.name} has no investment segments.` };
    }
    let totalMonths = ZERO;
    let eff = ZERO;
    for (const seg of p.segments) {
      if (!seg.capital.isPositive() || !seg.months.isPositive()) {
        return { ok: false, reason: `Partner ${p.name} has non-positive capital or duration.` };
      }
      totalMonths = totalMonths.add(seg.months);
      eff = eff.add(seg.capital.mul(seg.months));
    }
    if (totalMonths.cmp(businessMonths) > 0) {
      return { ok: false, reason: `Partner ${p.name} duration (${totalMonths.toExamString()}m) exceeds business period (${businessMonths.toExamString()}m).` };
    }
    effectives.push(eff);
  }
  return { ok: true, effectives };
}

/**
 * ENGINE B – Independent Partnership Mathematical Verifier.
 * Independently recalculates capital-months, profit-sharing ratios, distributable profit,
 * salary/commission deductions, missing capitals, and missing durations.
 */
export function independentlyVerifyPartnershipModel(model) {
  const { kind, partners, businessMonths = R(12) } = model;

  // 1. Profit-Sharing Ratio (2 or 3 partners, static or multi-segment changing capital)
  if (kind === "PROFIT_RATIO") {
    const effRes = computeEffectiveCapitals(partners, businessMonths);
    if (!effRes.ok) return effRes;
    // Ensure integer scaling for ratio reduction
    if (effRes.effectives.some((e) => e.den !== 1n)) {
      return { ok: false, reason: "Non-integer capital-months in ratio calculation." };
    }
    const reduced = reduceMultiRatio(effRes.effectives.map((e) => e.num));
    return { ok: true, ratioStr: reduced.str };
  }

  // 2. Investment Ratio from Profit Ratio and Time Durations
  if (kind === "INVESTMENT_RATIO_FROM_PROFIT") {
    const { profitParts, durations } = model;
    if (profitParts.length !== durations.length || profitParts.length < 2) {
      return { ok: false, reason: "Mismatched profit parts and durations." };
    }
    const capRatios = [];
    for (let i = 0; i < profitParts.length; i++) {
      if (!profitParts[i].isPositive() || !durations[i].isPositive()) {
        return { ok: false, reason: "Profit parts and durations must be positive." };
      }
      capRatios.push(profitParts[i].div(durations[i]));
    }
    // Scale by common denominator to get integer ratio
    const commonDen = capRatios.reduce((acc, r) => acc * r.den, 1n);
    const ints = capRatios.map((r) => (r.num * commonDen) / r.den);
    return { ok: true, ratioStr: reduceMultiRatio(ints).str };
  }

  // 3. Profit Distribution (with optional working-partner salary & commission)
  if (kind === "PROFIT_DISTRIBUTION") {
    const {
      totalProfit,
      salaryTotal = ZERO,
      commissionPct = ZERO,
      workingPartnerIdx = -1,
      targetIdx = 0,
      ask = "TARGET_TOTAL_INCOME", // "TARGET_PROFIT_SHARE" | "TARGET_TOTAL_INCOME" | "DISTRIBUTABLE_PROFIT" | "DIFF_SHARES"
      otherIdx = 1,
    } = model;

    if (!totalProfit.isPositive()) return { ok: false, reason: "Total profit must be positive." };
    if (salaryTotal.isNegative() || commissionPct.isNegative() || commissionPct.cmp(HUNDRED) >= 0) {
      return { ok: false, reason: "Invalid salary or commission percentage." };
    }

    const effRes = computeEffectiveCapitals(partners, businessMonths);
    if (!effRes.ok) return effRes;

    const commissionAmt = totalProfit.mul(commissionPct).div(HUNDRED);
    const distributable = totalProfit.sub(salaryTotal).sub(commissionAmt);
    if (!distributable.isPositive()) {
      return { ok: false, reason: "Distributable profit after salary/commission must be strictly positive." };
    }

    if (ask === "DISTRIBUTABLE_PROFIT") {
      return { ok: true, value: distributable };
    }

    const sumEff = effRes.effectives.reduce((acc, e) => acc.add(e), ZERO);
    const shares = effRes.effectives.map((e) => distributable.mul(e).div(sumEff));

    // Conservation check: sum of distributed shares MUST equal distributable profit
    const sumShares = shares.reduce((acc, s) => acc.add(s), ZERO);
    if (!sumShares.equals(distributable)) {
      return { ok: false, reason: "Sum of distributed shares does not equal distributable profit." };
    }

    if (ask === "DIFF_SHARES") {
      return { ok: true, value: shares[targetIdx].sub(shares[otherIdx]).abs() };
    }

    const baseShare = shares[targetIdx];
    if (ask === "TARGET_PROFIT_SHARE") {
      return { ok: true, value: baseShare };
    }

    // TARGET_TOTAL_INCOME: add salary + commission if targetIdx is working partner
    const remuneration = targetIdx === workingPartnerIdx ? salaryTotal.add(commissionAmt) : ZERO;
    return { ok: true, value: baseShare.add(remuneration) };
  }

  // 4. Find Total Profit from One Partner's Known Share (with optional commission/salary)
  if (kind === "FIND_TOTAL_PROFIT") {
    const {
      knownShare,
      knownIdx = 0,
      commissionPct = ZERO,
      salaryTotal = ZERO,
      workingPartnerIdx = -1,
    } = model;

    if (!knownShare.isPositive()) return { ok: false, reason: "Known share must be positive." };
    const effRes = computeEffectiveCapitals(partners, businessMonths);
    if (!effRes.ok) return effRes;

    const sumEff = effRes.effectives.reduce((acc, e) => acc.add(e), ZERO);
    const fracKnown = effRes.effectives[knownIdx].div(sumEff);

    // Case: knownIdx is NOT working partner => knownShare = fracKnown * (P*(1 - c/100) - salary)
    // Case: knownIdx IS working partner => knownShare = P*(c/100) + salary + fracKnown*(P*(1 - c/100) - salary)
    const commFrac = commissionPct.div(HUNDRED);
    let totalProfit;
    if (knownIdx === workingPartnerIdx) {
      // knownShare = P * [commFrac + fracKnown*(1 - commFrac)] + salary * (1 - fracKnown)
      const coeffP = commFrac.add(fracKnown.mul(R(1).sub(commFrac)));
      const constTerm = salaryTotal.mul(R(1).sub(fracKnown));
      totalProfit = knownShare.sub(constTerm).div(coeffP);
    } else {
      // knownShare = fracKnown * [P*(1 - commFrac) - salary]
      const distProfit = knownShare.div(fracKnown);
      totalProfit = distProfit.add(salaryTotal).div(R(1).sub(commFrac));
    }

    if (!totalProfit.isPositive()) return { ok: false, reason: "Solved total profit is non-positive." };
    return { ok: true, value: totalProfit };
  }

  // 5. Find Missing Investment (or Added Capital) of One Partner
  if (kind === "MISSING_INVESTMENT") {
    const { knownPartnerEff, unknownMonths, ratioUnknownToKnown, priorEff = ZERO } = model;
    if (!knownPartnerEff.isPositive() || !unknownMonths.isPositive() || !ratioUnknownToKnown.isPositive()) {
      return { ok: false, reason: "Invalid parameters for missing investment." };
    }
    const targetEff = knownPartnerEff.mul(ratioUnknownToKnown);
    const remEff = targetEff.sub(priorEff);
    if (!remEff.isPositive()) return { ok: false, reason: "Solved missing capital is non-positive." };
    return { ok: true, value: remEff.div(unknownMonths) };
  }

  // 6. Find Missing Duration / Joining Time / Leaving Time
  if (kind === "MISSING_DURATION") {
    const {
      knownPartnerEff,
      unknownCapital,
      ratioUnknownToKnown,
      ask = "DURATION", // "DURATION" | "JOINED_AFTER" | "LEFT_AFTER"
    } = model;

    if (!knownPartnerEff.isPositive() || !unknownCapital.isPositive() || !ratioUnknownToKnown.isPositive()) {
      return { ok: false, reason: "Invalid parameters for missing duration." };
    }
    const duration = knownPartnerEff.mul(ratioUnknownToKnown).div(unknownCapital);
    if (!duration.isPositive() || duration.cmp(businessMonths) > 0) {
      return { ok: false, reason: `Solved duration (${duration.toExamString()}m) out of valid (0, ${businessMonths.toExamString()}] range.` };
    }
    if (ask === "JOINED_AFTER") {
      const joinedAfter = businessMonths.sub(duration);
      if (!joinedAfter.isPositive()) return { ok: false, reason: "Joining delay must be positive." };
      return { ok: true, value: joinedAfter };
    }
    // Both DURATION and LEFT_AFTER equal the active duration in the business
    return { ok: true, value: duration };
  }

  return { ok: false, reason: `Unknown partnership model kind: ${kind}` };
}

/**
 * Full Engine B Validation Gate for Partnership Questions.
 * Enforces MANDATORY 5 options (A, B, C, D, E), exact rational match, and solution integrity.
 */
export function validatePartnershipQuestion(q) {
  const {
    mathModel,
    exactRationalAnswer,
    ratioAnswer,
    options,
    correct_answer,
    correctOptionIndex,
    solution,
    isCurrency = false,
    unit = "",
  } = q;

  const solved = independentlyVerifyPartnershipModel(mathModel);
  if (!solved.ok) {
    return { passed: false, reason: `Engine B rejected model: ${solved.reason}` };
  }

  let expectedStr;
  if (solved.ratioStr) {
    if (solved.ratioStr !== ratioAnswer) {
      return { passed: false, reason: `Ratio mismatch! Engine A=${ratioAnswer}, Engine B=${solved.ratioStr}` };
    }
    expectedStr = solved.ratioStr;
  } else {
    if (!(exactRationalAnswer instanceof Rational) || !solved.value.equals(exactRationalAnswer)) {
      return {
        passed: false,
        reason: `Answer mismatch! Engine A=${exactRationalAnswer?.toFractionString()}, Engine B=${solved.value.toFractionString()}`,
      };
    }
    if (!solved.value.isPositive() || solved.value.den > 60n) {
      return { passed: false, reason: `Answer failed precision sanity check: ${solved.value.toFractionString()}` };
    }
    expectedStr = formatPartnerValue(solved.value, { isCurrency, unit });
  }

  // Strictly enforce FIVE unique MCQ options (A, B, C, D, E)
  const optsArr = Array.isArray(options)
    ? options
    : [options.A, options.B, options.C, options.D, options.E];

  if (optsArr.length !== 5) {
    return { passed: false, reason: `MANDATORY RULE: Must have exactly 5 MCQ options (A–E), found ${optsArr.length}.` };
  }
  if (new Set(optsArr.map((x) => String(x ?? "").trim().toLowerCase())).size !== 5) {
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
      mathematical_check: true,
      ratio_check: true,
      time_check: true,
      unique_answer_check: true,
      option_check: true,
      ambiguity_check: true,
    },
  };
}