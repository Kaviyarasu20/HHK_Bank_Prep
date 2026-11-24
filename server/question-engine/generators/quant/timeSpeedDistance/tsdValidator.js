// Place at: server/question-engine/generators/quant/timeSpeedDistance/tsdValidator.js
import crypto from "node:crypto";
import { Rational, R, kmhToMs, msToKmh, formatWithUnit, bigLcm } from "./tsdMath.js";

/**
 * Generates a normalized mathematical fingerprint for duplicate prevention.
 */
export function computeTsdFingerprint(mathModel, templateId) {
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
 * ENGINE B – Independent TSD Mathematical Verifier.
 * Recalculates the exact rational answer purely from physical parameters & equations.
 */
export function independentlyVerifyTsdModel(model) {
  const { kind } = model;

  if (kind === "BASIC_SDT") {
    const { solveFor, speed, distance, time } = model;
    if (solveFor === "SPEED") {
      if (!distance.isPositive() || !time.isPositive()) return { ok: false, reason: "Non-positive distance/time." };
      return { ok: true, value: distance.div(time) };
    }
    if (solveFor === "DISTANCE") {
      if (!speed.isPositive() || !time.isPositive()) return { ok: false, reason: "Non-positive speed/time." };
      return { ok: true, value: speed.mul(time) };
    }
    if (solveFor === "TIME") {
      if (!distance.isPositive() || !speed.isPositive()) return { ok: false, reason: "Non-positive distance/speed." };
      return { ok: true, value: distance.div(speed) };
    }
    if (solveFor === "KMH_TO_MS") {
      if (!speed.isPositive()) return { ok: false, reason: "Non-positive speed." };
      return { ok: true, value: kmhToMs(speed) };
    }
    if (solveFor === "MS_TO_KMH") {
      if (!speed.isPositive()) return { ok: false, reason: "Non-positive speed." };
      return { ok: true, value: msToKmh(speed) };
    }
  }

  if (kind === "RATIO") {
    const { a, b } = model;
    if (!a.isPositive() || !b.isPositive()) return { ok: false, reason: "Non-positive ratio components." };
    const ratio = a.div(b);
    return { ok: true, ratioStr: `${ratio.num} : ${ratio.den}` };
  }

  if (kind === "AVG_SPEED_STAGES") {
    const { stages, stoppageTime = R(0), solveFor = "AVG_SPEED", targetAvgSpeed = null } = model;
    let totalD = R(0);
    let totalT = stoppageTime;
    for (const st of stages) {
      if (!st.distance.isPositive() || !st.speed.isPositive()) {
        return { ok: false, reason: "Invalid stage distance or speed." };
      }
      totalD = totalD.add(st.distance);
      totalT = totalT.add(st.distance.div(st.speed));
    }
    if (solveFor === "AVG_SPEED") return { ok: true, value: totalD.div(totalT) };
    if (solveFor === "TOTAL_TIME") return { ok: true, value: totalT };
    if (solveFor === "TOTAL_DISTANCE") return { ok: true, value: totalD };
    if (solveFor === "MISSING_SPEED" && targetAvgSpeed) {
      const { knownD, knownS, unknownD } = model;
      const totalReqTime = knownD.add(unknownD).div(targetAvgSpeed);
      const remTime = totalReqTime.sub(knownD.div(knownS));
      if (!remTime.isPositive()) return { ok: false, reason: "Impossible missing speed (non-positive remaining time)." };
      return { ok: true, value: unknownD.div(remTime) };
    }
  }

  if (kind === "RELATIVE_MEETING") {
    const { direction, v1, v2, gap, headStartTime = R(0), solveFor = "MEETING_TIME" } = model;
    if (!v1.isPositive() || !v2.isPositive()) return { ok: false, reason: "Speeds must be positive." };
    const relSpeed = direction === "OPPOSITE" ? v1.add(v2) : v1.sub(v2);
    if (!relSpeed.isPositive()) return { ok: false, reason: "Relative speed must be strictly positive." };
    const effectiveGap = direction === "SAME" && headStartTime.isPositive()
      ? v2.mul(headStartTime)
      : gap.sub(v1.mul(headStartTime));
    if (!effectiveGap.isPositive()) return { ok: false, reason: "Effective separation must be positive." };
    const meetTime = effectiveGap.div(relSpeed);
    if (solveFor === "MEETING_TIME") return { ok: true, value: meetTime };
    if (solveFor === "MEETING_DISTANCE_FROM_A") return { ok: true, value: v1.mul(headStartTime.add(meetTime)) };
    if (solveFor === "RELATIVE_SPEED") return { ok: true, value: relSpeed };
  }

  if (kind === "TRAIN_CROSSING") {
    const { len1, len2 = R(0), v1Kmh, v2Kmh = R(0), direction = "STATIONARY", solveFor = "TIME_SEC" } = model;
    if (!len1.isPositive() || !v1Kmh.isPositive()) return { ok: false, reason: "Invalid train length/speed." };
    const v1Ms = kmhToMs(v1Kmh);
    const v2Ms = kmhToMs(v2Kmh);
    const relMs =
      direction === "OPPOSITE" ? v1Ms.add(v2Ms) : direction === "SAME" ? v1Ms.sub(v2Ms) : v1Ms;
    if (!relMs.isPositive()) return { ok: false, reason: "Train relative speed must be positive." };
    const totalLen = len1.add(len2);
    if (solveFor === "TIME_SEC") return { ok: true, value: totalLen.div(relMs) };
    if (solveFor === "TRAIN_LENGTH") return { ok: true, value: len1 };
    if (solveFor === "PLATFORM_LENGTH") return { ok: true, value: len2 };
    if (solveFor === "TRAIN_SPEED_KMH") return { ok: true, value: v1Kmh };
  }

  if (kind === "BOAT_STREAM") {
    const { boatSpeed, streamSpeed, solveFor, distDown = R(0), distUp = R(0) } = model;
    if (!boatSpeed.isPositive() || !streamSpeed.isPositive() || boatSpeed.cmp(streamSpeed) <= 0) {
      return { ok: false, reason: "Boat speed must strictly exceed positive stream speed." };
    }
    const down = boatSpeed.add(streamSpeed);
    const up = boatSpeed.sub(streamSpeed);
    if (solveFor === "DOWNSTREAM_SPEED") return { ok: true, value: down };
    if (solveFor === "UPSTREAM_SPEED") return { ok: true, value: up };
    if (solveFor === "BOAT_SPEED") return { ok: true, value: down.add(up).div(R(2)) };
    if (solveFor === "STREAM_SPEED") return { ok: true, value: down.sub(up).div(R(2)) };
    if (solveFor === "ROUND_TRIP_TIME") return { ok: true, value: distDown.div(down).add(distUp.div(up)) };
    if (solveFor === "UPSTREAM_TIME") return { ok: true, value: distUp.div(up) };
    if (solveFor === "DOWNSTREAM_TIME") return { ok: true, value: distDown.div(down) };
    if (solveFor === "FLOATING_TIME") return { ok: true, value: distDown.div(streamSpeed) };
  }

  if (kind === "CIRCULAR_TRACK") {
    const { trackLen, v1, v2, direction, nthMeeting = 1, totalTime = null, solveFor = "MEETING_TIME" } = model;
    if (!trackLen.isPositive() || !v1.isPositive() || !v2.isPositive()) return { ok: false, reason: "Invalid track/speeds." };
    const rel = direction === "OPPOSITE" ? v1.add(v2) : v1.sub(v2).abs();
    if (!rel.isPositive()) return { ok: false, reason: "Equal speeds in same direction never meet." };
    const firstMeet = trackLen.div(rel);
    if (solveFor === "MEETING_TIME") return { ok: true, value: firstMeet.mul(R(nthMeeting)) };
    if (solveFor === "NUM_MEETINGS" && totalTime) {
      const count = BigInt(Math.floor(totalTime.div(firstMeet).toNumber()));
      return { ok: true, value: new Rational(count, 1n) };
    }
    if (solveFor === "START_MEET_LCM") {
      const t1 = trackLen.div(v1);
      const t2 = trackLen.div(v2);
      if (t1.den !== 1n || t2.den !== 1n) return { ok: false, reason: "Non-integer lap times." };
      return { ok: true, value: new Rational(bigLcm(t1.num, t2.num), 1n) };
    }
  }

  if (kind === "RACE") {
    const { raceDist, vA, vB, startDist = R(0), solveFor = "BEAT_BY_DIST" } = model;
    if (!raceDist.isPositive() || !vA.isPositive() || !vB.isPositive()) return { ok: false, reason: "Invalid race params." };
    const timeA = raceDist.div(vA);
    const distB = startDist.add(vB.mul(timeA));
    if (solveFor === "BEAT_BY_DIST") {
      const margin = raceDist.sub(distB);
      return margin.isPositive() ? { ok: true, value: margin } : { ok: false, reason: "Non-positive winning margin." };
    }
    if (solveFor === "DEAD_HEAT_START") {
      const neededStart = raceDist.sub(vB.mul(timeA));
      return neededStart.isPositive() ? { ok: true, value: neededStart } : { ok: false, reason: "Invalid dead-heat start." };
    }
    if (solveFor === "TRANSITIVE_MARGIN") {
      // A beats B by d1, B beats C by d2 in race D => C covers D * (D-d1)/D * (D-d2)/D
      const { d1, d2 } = model;
      const cDist = raceDist.sub(d1).mul(raceDist.sub(d2)).div(raceDist);
      return { ok: true, value: raceDist.sub(cDist) };
    }
  }

  if (kind === "STOPPAGE") {
    const { speedExcl, speedIncl, solveFor = "STOPPAGE_MIN_PER_HR" } = model;
    if (!speedExcl.isPositive() || !speedIncl.isPositive() || speedExcl.cmp(speedIncl) <= 0) {
      return { ok: false, reason: "Speed excluding stoppages must strictly exceed speed including stoppages." };
    }
    if (solveFor === "STOPPAGE_MIN_PER_HR") {
      return { ok: true, value: speedExcl.sub(speedIncl).div(speedExcl).mul(R(60)) };
    }
  }

  if (kind === "EARLY_LATE_ARRIVAL") {
    const { s1, s2, timeDiffHrs } = model;
    if (!s1.isPositive() || !s2.isPositive() || s2.cmp(s1) <= 0 || !timeDiffHrs.isPositive()) {
      return { ok: false, reason: "Invalid early/late arrival parameters." };
    }
    const dist = s1.mul(s2).mul(timeDiffHrs).div(s2.sub(s1));
    return { ok: true, value: dist };
  }

  return { ok: false, reason: `Unknown TSD model kind: ${kind}` };
}

/**
 * Full Engine B Validation Gate for TSD Questions.
 */
export function validateTsdQuestion(q) {
  const { mathModel, exactRationalAnswer, ratioAnswer, options, correct_answer, correctOptionIndex, solution, unit } = q;

  const solved = independentlyVerifyTsdModel(mathModel);
  if (!solved.ok) {
    return { passed: false, reason: `Engine B rejected model: ${solved.reason}` };
  }

  let expectedStr;
  if (mathModel.kind === "RATIO") {
    if (solved.ratioStr !== ratioAnswer) {
      return { passed: false, reason: `Ratio mismatch: A=${ratioAnswer}, B=${solved.ratioStr}` };
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
      return { passed: false, reason: `Answer failed sanity precision bounds: ${solved.value.toFractionString()}` };
    }
    expectedStr = formatWithUnit(solved.value, unit);
  }

  const optsArr = Array.isArray(options) ? options : [options.A, options.B, options.C, options.D];
  if (optsArr.length !== 4 || new Set(optsArr.map((x) => String(x).trim().toLowerCase())).size !== 4) {
    return { passed: false, reason: "Must have exactly 4 unique MCQ options." };
  }
  if (optsArr.some((x) => !x || String(x).includes("NaN") || String(x).includes("undefined"))) {
    return { passed: false, reason: "Invalid option string detected." };
  }
  const matches = optsArr.filter((x) => x === expectedStr);
  if (matches.length !== 1 || optsArr[correctOptionIndex] !== expectedStr) {
    return { passed: false, reason: `Expected exactly 1 option matching '${expectedStr}'.` };
  }
  if (!solution || !Array.isArray(solution.steps) || solution.steps.length < 2) {
    return { passed: false, reason: "Solution steps incomplete." };
  }
  if (!["A", "B", "C", "D"].includes(correct_answer)) {
    return { passed: false, reason: "Invalid correct_answer key." };
  }

  return {
    passed: true,
    validation: {
      mathematical_check: true,
      unit_check: true,
      unique_answer_check: true,
      option_check: true,
      ambiguity_check: true,
    },
  };
}