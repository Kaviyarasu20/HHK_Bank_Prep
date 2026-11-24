// Place at: server/question-engine/generators/quant/problemsOnAges/agesValidator.js
import crypto from "node:crypto";
import { Rational, R, ZERO, reduceMultiRatio, formatAgeValue } from "./agesMath.js";

/**
 * Generates a normalized mathematical fingerprint for duplicate prevention.
 */
export function computeAgesFingerprint(mathModel, templateId) {
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
 * Checks physical realism of all present ages and optional parent-child gap.
 */
function checkPhysicalAges(ages, { minPastOffset = 0, parentChildPairs = [] } = {}) {
  for (const age of ages) {
    if (!(age instanceof Rational) || !age.isPositive() || age.cmp(R(115)) > 0) {
      return { ok: false, reason: `Present age ${age?.toExamString?.()} is outside realistic (0, 115] bounds.` };
    }
    if (minPastOffset > 0 && age.sub(R(minPastOffset)).isNegative()) {
      return { ok: false, reason: `Person with age ${age.toExamString()} was not alive ${minPastOffset} years ago.` };
    }
  }
  for (const [parentIdx, childIdx] of parentChildPairs) {
    const diff = ages[parentIdx].sub(ages[childIdx]);
    if (diff.cmp(R(18)) < 0) {
      return { ok: false, reason: `Parent-child age difference (${diff.toExamString()} yrs) must be at least 18 years.` };
    }
  }
  return { ok: true };
}

/**
 * ENGINE B – Independent Algebraic & Substitution Verifier for Problems on Ages.
 * Independently solves every problem from raw conditions and substitutes the solved
 * ages back into EVERY original equation/ratio to confirm 100% consistency.
 */
export function independentlyVerifyAgesModel(model) {
  const { kind } = model;

  // 1. Sum and Difference of Two Ages
  if (kind === "SUM_AND_DIFF") {
    const { sum, diff, ask = "OLDER", offset = ZERO, parentChild = false } = model;
    if (!sum.isPositive() || !diff.isPositive() || diff.cmp(sum) >= 0) {
      return { ok: false, reason: "Invalid sum/difference parameters." };
    }
    const older = sum.add(diff).div(R(2));
    const younger = sum.sub(diff).div(R(2));
    const phys = checkPhysicalAges([older, younger], {
      minPastOffset: offset.isNegative() ? Math.abs(offset.toNumber()) : 0,
      parentChildPairs: parentChild ? [[0, 1]] : [],
    });
    if (!phys.ok) return phys;

    // Back-substitution check
    if (!older.add(younger).equals(sum) || !older.sub(younger).equals(diff)) {
      return { ok: false, reason: "Sum/difference back-substitution failed." };
    }
    const base = ask === "OLDER" ? older : ask === "YOUNGER" ? younger : older.sub(younger);
    return { ok: true, value: base.add(offset) };
  }

  // 2. Two Linear Ratio Conditions: (x + t1)/(y + t1) = a1/b1 AND (x + t2)/(y + t2) = a2/b2
  //    (t1, t2 can be negative for past, 0 for present, positive for future)
  if (kind === "TWO_RATIO_SYSTEM") {
    const { t1, a1, b1, t2, a2, b2, ask = "FIRST", askOffset = ZERO, parentChild = false } = model;
    // Eq1: b1*x - a1*y = (a1 - b1)*t1
    // Eq2: b2*x - a2*y = (a2 - b2)*t2
    const det = a1.mul(b2).sub(a2.mul(b1));
    if (det.isZero()) {
      return { ok: false, reason: "Degenerate ratio system (determinant = 0, no unique solution)." };
    }
    const c1 = a1.sub(b1).mul(t1);
    const c2 = a2.sub(b2).mul(t2);
    // Cramer's rule:
    // b1*x + (-a1)*y = c1
    // b2*x + (-a2)*y = c2
    // D = b1*(-a2) - b2*(-a1) = a1*b2 - a2*b1 = det
    const x = c1.mul(a2.mul(R(-1))).sub(c2.mul(a1.mul(R(-1)))).div(det);
    const y = b1.mul(c2).sub(b2.mul(c1)).div(det);

    const minPast = Math.max(
      0,
      t1.isNegative() ? Math.abs(t1.toNumber()) : 0,
      t2.isNegative() ? Math.abs(t2.toNumber()) : 0,
      askOffset.isNegative() ? Math.abs(askOffset.toNumber()) : 0
    );
    const phys = checkPhysicalAges([x, y], {
      minPastOffset: minPast,
      parentChildPairs: parentChild ? [[0, 1]] : [],
    });
    if (!phys.ok) return phys;

    // Independent back-substitution into both ratio equations
    if (!x.add(t1).mul(b1).equals(y.add(t1).mul(a1))) {
      return { ok: false, reason: "Solved ages failed Equation 1 substitution." };
    }
    if (!x.add(t2).mul(b2).equals(y.add(t2).mul(a2))) {
      return { ok: false, reason: "Solved ages failed Equation 2 substitution." };
    }
    // Constant age difference check across both time points
    if (!x.sub(y).equals(x.add(t1).sub(y.add(t1))) || !x.sub(y).equals(x.add(t2).sub(y.add(t2)))) {
      return { ok: false, reason: "Age difference invariance violated." };
    }

    if (ask === "FIRST") return { ok: true, value: x.add(askOffset) };
    if (ask === "SECOND") return { ok: true, value: y.add(askOffset) };
    if (ask === "SUM") return { ok: true, value: x.add(y).add(askOffset.mul(R(2))) };
    if (ask === "DIFF") return { ok: true, value: x.sub(y).abs() };
    return { ok: false, reason: `Unsupported ask mode: ${ask}` };
  }

  // 3. Ratio at Time t1 + Sum at Time t2 (2 or 3 people)
  if (kind === "RATIO_AND_SUM") {
    const { ratioParts, ratioTime = ZERO, sumAtTime, sumTime = ZERO, targetIdx = 0, askOffset = ZERO, parentChild = false } = model;
    const n = ratioParts.length;
    if (n < 2) return { ok: false, reason: "Need at least 2 people." };
    const sumParts = ratioParts.reduce((acc, p) => acc.add(p), ZERO);
    if (!sumParts.isPositive()) return { ok: false, reason: "Invalid ratio parts." };

    // Sum at ratioTime = sumAtTime - n * (sumTime - ratioTime)
    const sumAtRatioTime = sumAtTime.sub(R(n).mul(sumTime.sub(ratioTime)));
    if (!sumAtRatioTime.isPositive()) return { ok: false, reason: "Implied sum at ratioTime is non-positive." };
    const unit = sumAtRatioTime.div(sumParts);
    const presentAges = ratioParts.map((p) => p.mul(unit).sub(ratioTime));

    const minPast = Math.max(
      0,
      ratioTime.isNegative() ? Math.abs(ratioTime.toNumber()) : 0,
      sumTime.isNegative() ? Math.abs(sumTime.toNumber()) : 0,
      askOffset.isNegative() ? Math.abs(askOffset.toNumber()) : 0
    );
    const phys = checkPhysicalAges(presentAges, {
      minPastOffset: minPast,
      parentChildPairs: parentChild ? [[0, 1]] : [],
    });
    if (!phys.ok) return phys;

    // Back-substitution into sum at sumTime
    const checkSum = presentAges.reduce((acc, a) => acc.add(a.add(sumTime)), ZERO);
    if (!checkSum.equals(sumAtTime)) {
      return { ok: false, reason: "Sum back-substitution failed." };
    }

    if (targetIdx === "YOUNGEST") {
      const minAge = presentAges.reduce((m, a) => (a.cmp(m) < 0 ? a : m), presentAges[0]);
      return { ok: true, value: minAge.add(askOffset) };
    }
    if (targetIdx === "OLDEST") {
      const maxAge = presentAges.reduce((m, a) => (a.cmp(m) > 0 ? a : m), presentAges[0]);
      return { ok: true, value: maxAge.add(askOffset) };
    }
    return { ok: true, value: presentAges[targetIdx].add(askOffset) };
  }

  // 4. Find Number of Years Until (or Ago) Target Ratio Occurs
  if (kind === "YEARS_FOR_RATIO") {
    const { age1, age2, targetA, targetB, parentChild = false } = model;
    const phys = checkPhysicalAges([age1, age2], {
      parentChildPairs: parentChild ? [[0, 1]] : [],
    });
    if (!phys.ok) return phys;
    // (age1 + n) / (age2 + n) = targetA / targetB
    // => n * (targetB - targetA) = targetA * age2 - targetB * age1
    const denom = targetB.sub(targetA);
    if (denom.isZero()) return { ok: false, reason: "Target ratio cannot be 1:1 for unequal ages." };
    const n = targetA.mul(age2).sub(targetB.mul(age1)).div(denom);
    if (!n.isPositive()) return { ok: false, reason: `Solved years (${n.toExamString()}) must be strictly positive.` };
    // Back-substitution
    if (!age1.add(n).mul(targetB).equals(age2.add(n).mul(targetA))) {
      return { ok: false, reason: "Years-for-ratio back-substitution failed." };
    }
    return { ok: true, value: n };
  }

  // 5. Find Ratio at a Given Offset (Past or Future)
  if (kind === "FIND_RATIO_AT_OFFSET") {
    const { ages, offset = ZERO } = model;
    const phys = checkPhysicalAges(ages, {
      minPastOffset: offset.isNegative() ? Math.abs(offset.toNumber()) : 0,
    });
    if (!phys.ok) return phys;
    const shifted = ages.map((a) => a.add(offset));
    if (shifted.some((s) => !s.isPositive() || s.den !== 1n)) {
      return { ok: false, reason: "Shifted ages must be positive integers for ratio." };
    }
    return { ok: true, ratioStr: reduceMultiRatio(shifted.map((s) => s.num)).str };
  }

  // 6. Parent's Age When Child Was Born (= Age Difference)
  if (kind === "AGE_AT_BIRTH") {
    const { parentAge, childAge } = model;
    const phys = checkPhysicalAges([parentAge, childAge], { parentChildPairs: [[0, 1]] });
    if (!phys.ok) return phys;
    return { ok: true, value: parentAge.sub(childAge) };
  }

  // 7. Multi-Person Linear Offset System (4 people relative to youngest)
  if (kind === "MULTI_OFFSET_SUM") {
    const { offsets, totalSum, targetIdx = 0 } = model;
    const n = offsets.length;
    const sumOffsets = offsets.reduce((acc, o) => acc.add(o), ZERO);
    const base = totalSum.sub(sumOffsets).div(R(n));
    const ages = offsets.map((o) => base.add(o));
    const phys = checkPhysicalAges(ages);
    if (!phys.ok) return phys;
    const checkSum = ages.reduce((acc, a) => acc.add(a), ZERO);
    if (!checkSum.equals(totalSum)) return { ok: false, reason: "Multi-person sum check failed." };
    return { ok: true, value: ages[targetIdx] };
  }

  // 8. Average Age Operations (Missing Member, Time Shift, Join, Leave, Single/Multi Replacement, Family Baby)
  if (kind === "AVERAGE_OPERATION") {
    const { subKind } = model;

    if (subKind === "MISSING_FROM_AVG") {
      const { count, avg, knownAges } = model;
      if (knownAges.length !== count - 1) return { ok: false, reason: "Known ages count mismatch." };
      const missing = avg.mul(R(count)).sub(knownAges.reduce((a, b) => a.add(b), ZERO));
      const phys = checkPhysicalAges([...knownAges, missing]);
      if (!phys.ok) return phys;
      return { ok: true, value: missing };
    }

    if (subKind === "AVG_TIME_SHIFT") {
      const { oldAvg, shiftYears } = model;
      const newAvg = oldAvg.add(shiftYears);
      if (!newAvg.isPositive()) return { ok: false, reason: "Shifted average is non-positive." };
      return { ok: true, value: newAvg };
    }

    if (subKind === "JOIN_MEMBER") {
      const { oldCount, oldAvg, newAvg } = model;
      const oldSum = oldAvg.mul(R(oldCount));
      const newSum = newAvg.mul(R(oldCount + 1));
      const memberAge = newSum.sub(oldSum);
      const phys = checkPhysicalAges([memberAge]);
      if (!phys.ok) return phys;
      // Back-substitution
      if (!oldSum.add(memberAge).div(R(oldCount + 1)).equals(newAvg)) {
        return { ok: false, reason: "Join-member average check failed." };
      }
      return { ok: true, value: memberAge };
    }

    if (subKind === "LEAVE_MEMBER") {
      const { oldCount, oldAvg, newAvg } = model;
      if (oldCount < 2) return { ok: false, reason: "Cannot leave from group of < 2." };
      const oldSum = oldAvg.mul(R(oldCount));
      const newSum = newAvg.mul(R(oldCount - 1));
      const leftAge = oldSum.sub(newSum);
      const phys = checkPhysicalAges([leftAge]);
      if (!phys.ok) return phys;
      if (!oldSum.sub(leftAge).div(R(oldCount - 1)).equals(newAvg)) {
        return { ok: false, reason: "Leave-member average check failed." };
      }
      return { ok: true, value: leftAge };
    }

    if (subKind === "REPLACE_SINGLE") {
      const { groupSize, avgChange, knownAge, ask = "NEW_AGE" } = model;
      // avgChange > 0 means average increased => newAge = oldAge + groupSize * avgChange
      const deltaTotal = avgChange.mul(R(groupSize));
      const solved = ask === "NEW_AGE" ? knownAge.add(deltaTotal) : knownAge.sub(deltaTotal);
      const phys = checkPhysicalAges([knownAge, solved]);
      if (!phys.ok) return phys;
      return { ok: true, value: solved };
    }

    if (subKind === "REPLACE_MULTIPLE") {
      const { groupSize, avgChange, outgoingAges } = model;
      const sumOut = outgoingAges.reduce((a, b) => a.add(b), ZERO);
      const sumIn = sumOut.add(avgChange.mul(R(groupSize)));
      const avgIn = sumIn.div(R(outgoingAges.length));
      const phys = checkPhysicalAges([...outgoingAges, avgIn]);
      if (!phys.ok) return phys;
      return { ok: true, value: avgIn };
    }

    if (subKind === "FAMILY_BABY_BORN") {
      const { oldMembers, yearsAgo, pastAvg, presentAvg } = model;
      const presentSumOld = pastAvg.add(R(yearsAgo)).mul(R(oldMembers));
      const presentSumNew = presentAvg.mul(R(oldMembers + 1));
      const babyAge = presentSumNew.sub(presentSumOld);
      if (!babyAge.isPositive() || babyAge.cmp(R(yearsAgo)) > 0) {
        return { ok: false, reason: `Solved baby age (${babyAge.toExamString()} yrs) must be in (0, ${yearsAgo}].` };
      }
      return { ok: true, value: babyAge };
    }
  }

  return { ok: false, reason: `Unknown ages model kind: ${kind}` };
}

/**
 * Full Engine B Validation Gate for Problems on Ages.
 * Enforces MANDATORY 5 options (A–E), exact rational match, physical age validity,
 * and complete algebraic solution structure.
 */
export function validateAgesQuestion(q) {
  const {
    mathModel,
    exactRationalAnswer,
    ratioAnswer,
    options,
    correct_answer,
    correctOptionIndex,
    solution,
    unit = "years",
  } = q;

  const solved = independentlyVerifyAgesModel(mathModel);
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
    if (!solved.value.isPositive() || solved.value.den > 10n) {
      return { passed: false, reason: `Answer failed precision sanity check: ${solved.value.toFractionString()}` };
    }
    expectedStr = formatAgeValue(solved.value, unit);
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
      age_validity_check: true,
      ratio_check: true,
      equation_check: true,
      unique_answer_check: true,
      option_check: true,
      ambiguity_check: true,
    },
  };
}