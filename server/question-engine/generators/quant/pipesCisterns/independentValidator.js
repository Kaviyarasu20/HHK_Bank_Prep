// server/question-engine/generators/quant/pipesCisterns/independentValidator.js
import crypto from "node:crypto";
import { Rational, ZERO, ONE, formatValueWithUnit } from "./rational.js";

/**
 * Generates a normalized mathematical fingerprint to prevent duplicate questions
 * within a batch or mock test regardless of phrasing variations.
 */
export function computeQuestionFingerprint(mathModel, templateId) {
  const canonical = {
    templateId,
    queryType: mathModel.queryType,
    initialLevel: mathModel.initialLevel.toFractionString(),
    targetLevel: mathModel.targetLevel ? mathModel.targetLevel.toFractionString() : null,
    pipes: (mathModel.pipes || [])
      .map((p) => `${p.type}:${p.rate.toFractionString()}`)
      .sort(),
    stages: (mathModel.stages || []).map((st) => ({
      duration: st.duration ? st.duration.toFractionString() : "UNTIL_TARGET",
      netRate: st.netRate.toFractionString(),
    })),
    cycle: (mathModel.cycle || []).map((c) => ({
      duration: c.duration.toFractionString(),
      netRate: c.netRate.toFractionString(),
    })),
    extra: mathModel.extraKey || "",
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex")
    .slice(0, 20);
}

/**
 * ENGINE B – Independent Exact Rational Tank-Level Simulator & Answer Recalculator.
 * Completely independent from Engine A's template formulas.
 */
export function independentlySolveModel(mathModel) {
  const { queryType, initialLevel = ZERO, targetLevel = ONE } = mathModel;

  // 1. Validate initial level bounds [0, 1]
  if (initialLevel.isNegative() || initialLevel.cmp(ONE) > 0) {
    return { ok: false, reason: "Initial tank level out of [0, 1] bounds." };
  }

  // Case A: Stage-by-stage interval simulation
  if (queryType === "TIME_TO_TARGET_STAGES") {
    let level = initialLevel;
    let totalTime = ZERO;
    const filling = targetLevel.cmp(initialLevel) > 0;
    const emptying = targetLevel.cmp(initialLevel) < 0;

    for (const stage of mathModel.stages) {
      const rate = stage.netRate;

      // Open-ended final stage ("run until targetLevel is reached")
      if (stage.duration === null) {
        if (filling && !rate.isPositive()) {
          return { ok: false, reason: "Net rate must be strictly positive when filling." };
        }
        if (emptying && !rate.isNegative()) {
          return { ok: false, reason: "Net rate must be strictly negative when emptying." };
        }
        const remaining = targetLevel.sub(level);
        if (remaining.isZero()) {
          return { ok: true, value: totalTime };
        }
        const dt = remaining.div(rate);
        if (dt.isNegative()) {
          return { ok: false, reason: "Computed negative time in final stage." };
        }
        totalTime = totalTime.add(dt);
        level = targetLevel;
        return { ok: true, value: totalTime };
      }

      // Fixed-duration stage: check for early overflow or early empty!
      if (!stage.duration.isPositive()) {
        return { ok: false, reason: "Stage duration must be positive." };
      }
      const nextLevel = level.add(rate.mul(stage.duration));

      // Handle overflow stop (Case 7) or early target hit
      if (filling && nextLevel.cmp(targetLevel) >= 0) {
        if (!rate.isPositive()) {
          return { ok: false, reason: "Invalid rate on filling hit." };
        }
        const dt = targetLevel.sub(level).div(rate);
        return { ok: true, value: totalTime.add(dt), earlyStop: true };
      }
      if (emptying && nextLevel.cmp(targetLevel) <= 0) {
        if (!rate.isNegative()) {
          return { ok: false, reason: "Invalid rate on emptying hit." };
        }
        const dt = targetLevel.sub(level).div(rate);
        return { ok: true, value: totalTime.add(dt), earlyStop: true };
      }

      // Clamp check: tank cannot go below 0 or above 1 midway
      if (nextLevel.isNegative() || nextLevel.cmp(ONE) > 0) {
        return { ok: false, reason: "Intermediate tank level exceeded [0, 1] without stopping." };
      }

      level = nextLevel;
      totalTime = totalTime.add(stage.duration);
    }

    return { ok: false, reason: "Stages ended before reaching target level." };
  }

  // Case B: Cyclic / Alternating schedule simulation (stops immediately when level hits target!)
  if (queryType === "TIME_TO_TARGET_CYCLIC") {
    let level = initialLevel;
    let totalTime = ZERO;
    const cycle = mathModel.cycle;
    if (!cycle || !cycle.length) {
      return { ok: false, reason: "Empty cyclic schedule." };
    }

    // Verify net progress over 1 full cycle is strictly positive when filling
    let cycleNetWork = ZERO;
    let cycleDuration = ZERO;
    for (const step of cycle) {
      cycleNetWork = cycleNetWork.add(step.netRate.mul(step.duration));
      cycleDuration = cycleDuration.add(step.duration);
    }
    if (!cycleNetWork.isPositive()) {
      return { ok: false, reason: "Cyclic schedule does not make positive net progress." };
    }

    // Step-by-step exact rational simulation (up to 500 steps)
    let safety = 0;
    while (level.cmp(targetLevel) < 0 && safety < 500) {
      for (const step of cycle) {
        safety++;
        const nextLevel = level.add(step.netRate.mul(step.duration));
        if (nextLevel.cmp(targetLevel) >= 0) {
          const dt = targetLevel.sub(level).div(step.netRate);
          return { ok: true, value: totalTime.add(dt) };
        }
        if (nextLevel.isNegative()) {
          return { ok: false, reason: "Tank level dropped below 0 during cyclic step." };
        }
        level = nextLevel;
        totalTime = totalTime.add(step.duration);
      }
    }
    return { ok: false, reason: "Cyclic simulation exceeded step cap." };
  }

  // Case C: Fraction filled or remaining work after fixed stages
  if (queryType === "FRACTION_FILLED" || queryType === "REMAINING_WORK") {
    let level = initialLevel;
    for (const stage of mathModel.stages) {
      level = level.add(stage.netRate.mul(stage.duration));
      if (level.isNegative() || level.cmp(ONE) > 0) {
        return { ok: false, reason: "Level out of [0, 1] during fraction/remaining simulation." };
      }
    }
    const result = queryType === "FRACTION_FILLED" ? level : ONE.sub(level);
    if (!result.isPositive() || result.cmp(ONE) >= 0) {
      return { ok: false, reason: "Fraction/remaining work must be strictly between 0 and 1." };
    }
    return { ok: true, value: result };
  }

  // Case D: Solve for unknown individual pipe time (given combined net rate and known pipe rates)
  if (queryType === "UNKNOWN_PIPE_TIME") {
    // knownNetRate + unknownSign * (1 / T_unknown) = observedNetRate
    const { knownNetRate, observedNetRate, unknownSign } = mathModel;
    const unknownRate = observedNetRate.sub(knownNetRate).mul(new Rational(unknownSign, 1n));
    if (!unknownRate.isPositive()) {
      return { ok: false, reason: "Solved unknown pipe rate is non-positive." };
    }
    const time = ONE.div(unknownRate);
    return { ok: true, value: time };
  }

  return { ok: false, reason: `Unsupported queryType: ${queryType}` };
}

/**
 * Full Engine B Validation Gate:
 * 1. Independently recalculates exact answer from mathModel.
 * 2. Confirms exact rational equality with Engine A's stored rational answer.
 * 3. Confirms 4 unique options, no NaN/undefined, and exactly 1 matching option.
 * 4. Confirms explanation steps are non-empty and agree with the verified answer.
 */
export function validatePipesCisternsQuestion(questionObj) {
  const { mathModel, exactRationalAnswer, options, correctAnswer, correctOptionIndex, solution, unit, preferMixed = true } = questionObj;

  if (!mathModel || !(exactRationalAnswer instanceof Rational)) {
    return { passed: false, reason: "Missing mathModel or exactRationalAnswer." };
  }

  // 1. Independent mathematical verification
  const solved = independentlySolveModel(mathModel);
  if (!solved.ok) {
    return { passed: false, reason: `Independent solver rejected model: ${solved.reason}` };
  }
  if (!solved.value.equals(exactRationalAnswer)) {
    return {
      passed: false,
      reason: `Answer mismatch! Engine A=${exactRationalAnswer.toFractionString()}, Engine B=${solved.value.toFractionString()}`,
    };
  }

  // 2. Reject excessively large or ugly answers
  if (!solved.value.isPositive() || solved.value.toNumber() > 500 || solved.value.den > 60n) {
    return { passed: false, reason: `Answer ${solved.value.toFractionString()} failed sanity bounds.` };
  }

  // 3. Strictly verify 4 unique MCQ options
  if (!Array.isArray(options) || options.length !== 4) {
    return { passed: false, reason: "Must have exactly 4 MCQ options." };
  }
  const cleanOpts = options.map((o) => String(o ?? "").trim());
  if (cleanOpts.some((o) => !o || o.includes("NaN") || o.includes("undefined") || o.includes("Infinity"))) {
    return { passed: false, reason: "Option contains NaN/undefined/empty string." };
  }
  if (new Set(cleanOpts.map((o) => o.toLowerCase())).size !== 4) {
    return { passed: false, reason: "Duplicate options detected." };
  }

  const expectedFormatted = formatValueWithUnit(solved.value, unit, { preferMixed });
  const matches = cleanOpts.filter((o) => o === expectedFormatted);
  if (matches.length !== 1) {
    return {
      passed: false,
      reason: `Expected exactly 1 option matching '${expectedFormatted}', found ${matches.length}.`,
    };
  }
  if (cleanOpts[correctOptionIndex] !== expectedFormatted || correctAnswer !== expectedFormatted) {
    return { passed: false, reason: "correctOptionIndex or correctAnswer does not match verified option." };
  }

  // 4. Verify explanation contains the exact verified answer value
  if (!Array.isArray(solution) || solution.length < 2) {
    return { passed: false, reason: "Explanation must have at least 2 structured steps." };
  }
  const combinedExpl = solution.join(" ");
  if (
    !combinedExpl.includes(solved.value.toExamString(preferMixed)) &&
    !combinedExpl.includes(solved.value.toFractionString())
  ) {
    return { passed: false, reason: "Explanation text does not reference the verified answer." };
  }

  return { passed: true, reason: null, verifiedValue: solved.value };
}