// Place at: server/question-engine/generators/quant/timeSpeedDistance/tsdTemplatesPart2.js
import { Rational, R, bigLcm, buildTsdOptions } from "./tsdMath.js";

const RUNNERS = ["Arjun", "Bhavna", "Chirag", "Deepak", "Esha", "Farhan", "Gauri", "Harsh", "Ishaan", "Jaya"];

function pickRunners(rng, count = 2) {
  return rng.shuffle(RUNNERS).slice(0, count);
}

function makeQuestion({
  templateId,
  category,
  sub_type,
  difficulty,
  exam_suitability,
  question_text,
  mathModel,
  exactRationalAnswer,
  plausible = [],
  unit = "",
  solution,
  shortcut_method = "",
  rng,
}) {
  const built = buildTsdOptions(exactRationalAnswer, plausible, { unit, rng });
  return {
    templateId,
    category,
    sub_type,
    difficulty,
    exam_suitability,
    question_text,
    mathModel,
    exactRationalAnswer,
    ratioAnswer: null,
    unit,
    options: built.optionsObj,
    optionsArray: built.optionsArray,
    correct_answer: built.correctKey,
    correctOptionIndex: built.correctOptionIndex,
    answer: built.correctValue,
    solution,
    shortcut_method,
  };
}

// ============================================================================
// CATEGORY F: Circular Track (F1 - F3)
// ============================================================================

function genF1_CircularMeetingTime(rng, difficulty) {
  const isOpposite = rng.random() < 0.5;
  const v1 = rng.pick([8, 10, 12, 15, 18]);
  const v2 = isOpposite ? rng.pick([4, 6, 8, 10]) : rng.pick([4, 5, 6, 9]);
  const fast = Math.max(v1, v2) === Math.min(v1, v2) ? v1 + 3 : Math.max(v1, v2);
  const slow = Math.min(v1, v2);
  const rel = isOpposite ? fast + slow : fast - slow;
  const firstSec = rng.pick([20, 25, 30, 40, 50, 60]);
  const trackLen = R(rel * firstSec);
  const nth = difficulty === "Hard" ? rng.pick([2, 3, 4]) : 1;
  const ans = R(firstSec * nth);
  const [r1, r2] = pickRunners(rng, 2);

  const nthWord = nth === 1 ? "first time" : nth === 2 ? "second time" : nth === 3 ? "third time" : "fourth time";

  return makeQuestion({
    templateId: `TSD_F1_CIRCULAR_MEET_${isOpposite ? "OPP" : "SAME"}`,
    category: "F. Circular Track",
    sub_type: `${isOpposite ? "Opposite" : "Same"} Direction Meeting Time`,
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question_text: `${r1} and ${r2} start running simultaneously from the same point on a circular track of length ${trackLen.toExamString()} m at speeds of ${fast} m/s and ${slow} m/s respectively in ${isOpposite ? "opposite directions" : "the same direction"}. After how many seconds will they meet for the ${nthWord}?`,
    mathModel: {
      kind: "CIRCULAR_TRACK",
      trackLen,
      v1: R(fast),
      v2: R(slow),
      direction: isOpposite ? "OPPOSITE" : "SAME",
      nthMeeting: nth,
      solveFor: "MEETING_TIME",
    },
    exactRationalAnswer: ans,
    plausible: [ans.add(R(10)), ans.sub(R(10)), trackLen.div(R(isOpposite ? fast - slow : fast + slow)), ans.add(R(20))],
    unit: "seconds",
    solution: {
      given_data: `Track length = ${trackLen.toExamString()} m, Speeds = ${fast} m/s & ${slow} m/s (${isOpposite ? "Opposite" : "Same"}), Meeting #${nth}`,
      formula: `Time for nth meeting = n × Track Length / Relative Speed`,
      steps: [
        `Relative Speed = ${fast} ${isOpposite ? "+" : "−"} ${slow} = ${rel} m/s`,
        `Time for 1st meeting = ${trackLen.toExamString()} / ${rel} = ${firstSec} seconds`,
        nth > 1
          ? `Time for ${nthWord} = ${nth} × ${firstSec} = ${ans.toExamString()} seconds`
          : `Meeting time = ${ans.toExamString()} seconds`,
      ],
      final_answer: `${ans.toExamString()} seconds`,
    },
    shortcut_method: `Divide track length ${trackLen.toExamString()} m by relative speed ${rel} m/s${nth > 1 ? ` and multiply by ${nth}` : ""}.`,
    rng,
  });
}

function genF2_CircularNumMeetings(rng, difficulty) {
  const isOpposite = rng.random() < 0.6;
  const fast = rng.pick([10, 12, 15, 16]);
  const slow = rng.pick([4, 6, 8]);
  const rel = isOpposite ? fast + slow : fast - slow;
  const firstSec = rng.pick([20, 25, 30, 40]);
  const trackLen = R(rel * firstSec);
  const meetings = rng.randInt(4, 12);
  const extraSec = rng.pick([0, 5, 10]);
  const totalTime = R(meetings * firstSec + extraSec);
  const [r1, r2] = pickRunners(rng, 2);

  return makeQuestion({
    templateId: "TSD_F2_CIRCULAR_NUM_MEETINGS",
    category: "F. Circular Track",
    sub_type: "Number of Meetings in Given Time",
    difficulty,
    exam_suitability: ["IBPS PO Mains", "SBI PO Mains", "SBI PO Prelims"],
    question_text: `${r1} and ${r2} start together from the same point on a circular track of length ${trackLen.toExamString()} m in ${isOpposite ? "opposite directions" : "the same direction"} at ${fast} m/s and ${slow} m/s respectively. How many times will they meet (excluding the start) in ${totalTime.toExamString()} seconds?`,
    mathModel: {
      kind: "CIRCULAR_TRACK",
      trackLen,
      v1: R(fast),
      v2: R(slow),
      direction: isOpposite ? "OPPOSITE" : "SAME",
      totalTime,
      solveFor: "NUM_MEETINGS",
    },
    exactRationalAnswer: R(meetings),
    plausible: [R(meetings + 1), R(meetings - 1), R(meetings + 2), R(Math.max(1, meetings - 2))],
    unit: "times",
    solution: {
      given_data: `Track = ${trackLen.toExamString()} m, Speeds = ${fast} & ${slow} m/s, Total Time = ${totalTime.toExamString()} s`,
      formula: "Number of meetings = floor(Total Time / Time for 1st meeting)",
      steps: [
        `Relative Speed = ${fast} ${isOpposite ? "+" : "−"} ${slow} = ${rel} m/s`,
        `Time for 1st meeting = ${trackLen.toExamString()} / ${rel} = ${firstSec} seconds`,
        `Meetings in ${totalTime.toExamString()} s = floor(${totalTime.toExamString()} / ${firstSec}) = ${meetings} times`,
      ],
      final_answer: `${meetings} times`,
    },
    shortcut_method: `Find interval between consecutive meetings (${firstSec} s) and take the integer quotient of ${totalTime.toExamString()} / ${firstSec}.`,
    rng,
  });
}

function genF3_CircularStartMeetLCM(rng, difficulty) {
  const configs = [
    [600, 10, 15], // laps 60s, 40s => LCM 120s
    [600, 12, 15], // laps 50s, 40s => LCM 200s
    [400, 8, 10],  // laps 50s, 40s => LCM 200s
    [1200, 15, 20], // laps 80s, 60s => LCM 240s
    [900, 10, 15], // laps 90s, 60s => LCM 180s
    [800, 16, 20], // laps 50s, 40s => LCM 200s
    [1000, 20, 25], // laps 50s, 40s => LCM 200s
  ];
  const [L, v1, v2] = rng.pick(configs);
  const t1 = BigInt(L / v1);
  const t2 = BigInt(L / v2);
  const ans = new Rational(bigLcm(t1, t2), 1n);
  const [r1, r2] = pickRunners(rng, 2);

  return makeQuestion({
    templateId: "TSD_F3_CIRCULAR_START_LCM",
    category: "F. Circular Track",
    sub_type: "Meeting at Starting Point (LCM)",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question_text: `${r1} and ${r2} start running simultaneously from the starting point of a ${L} m circular track in the same direction at speeds of ${v1} m/s and ${v2} m/s respectively. After how many seconds will they meet together at the starting point for the first time?`,
    mathModel: {
      kind: "CIRCULAR_TRACK",
      trackLen: R(L),
      v1: R(v1),
      v2: R(v2),
      direction: "SAME",
      solveFor: "START_MEET_LCM",
    },
    exactRationalAnswer: ans,
    plausible: [ans.add(R(20)), ans.sub(R(40)), R(Number(t1 + t2)), ans.mul(R(2))],
    unit: "seconds",
    solution: {
      given_data: `Track length = ${L} m, Speeds = ${v1} m/s and ${v2} m/s`,
      formula: "First meeting at starting point = LCM(Lap Time₁, Lap Time₂)",
      steps: [
        `Lap time of ${r1} = ${L} / ${v1} = ${t1} seconds`,
        `Lap time of ${r2} = ${L} / ${v2} = ${t2} seconds`,
        `LCM(${t1}, ${t2}) = ${ans.toExamString()} seconds`,
      ],
      final_answer: `${ans.toExamString()} seconds`,
    },
    shortcut_method: `Always compute individual lap times (${t1}s, ${t2}s) and take their LCM = ${ans.toExamString()} s.`,
    rng,
  });
}

// ============================================================================
// CATEGORY G: Races (G1 - G3)
// ============================================================================

function genG1_RaceWinningMargin(rng, difficulty) {
  const raceDist = rng.pick([400, 500, 800, 1000]);
  const vA = rng.pick([10, 12, 16, 20]);
  const vB = vA - rng.pick([2, 3, 4]);
  const timeA = R(raceDist, vA);
  const startDist = difficulty === "Hard" ? R(rng.pick([20, 40, 50])) : R(0);
  const distB = startDist.add(R(vB).mul(timeA));
  const margin = R(raceDist).sub(distB);
  if (!margin.isPositive() || margin.den > 4n) return genG2_RaceDeadHeat(rng, difficulty);
  const [r1, r2] = pickRunners(rng, 2);

  const qText = startDist.isPositive()
    ? `In a ${raceDist} m race, ${r1} runs at ${vA} m/s and ${r2} runs at ${vB} m/s. If ${r1} gives ${r2} a head start of ${startDist.toExamString()} m, by what distance does ${r1} beat ${r2}?`
    : `In a ${raceDist} m race, ${r1} runs at ${vA} m/s and ${r2} runs at ${vB} m/s. By what distance does ${r1} beat ${r2}?`;

  return makeQuestion({
    templateId: "TSD_G1_RACE_MARGIN",
    category: "G. Races",
    sub_type: "Beats by Distance / Winning Margin",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS RRB PO"],
    question_text: qText,
    mathModel: { kind: "RACE", raceDist: R(raceDist), vA: R(vA), vB: R(vB), startDist, solveFor: "BEAT_BY_DIST" },
    exactRationalAnswer: margin,
    plausible: [margin.add(R(20)), margin.sub(R(15)), R(raceDist).sub(R(vB).mul(timeA)), margin.add(R(10))],
    unit: "m",
    solution: {
      given_data: `Race = ${raceDist} m, Speed of ${r1} = ${vA} m/s, Speed of ${r2} = ${vB} m/s${startDist.isPositive() ? `, Head start = ${startDist.toExamString()} m` : ""}`,
      formula: "Margin = Race Distance − (Head Start + Speed_B × Time_A)",
      steps: [
        `Time taken by ${r1} = ${raceDist} / ${vA} = ${timeA.toExamString()} seconds`,
        `Distance covered by ${r2} in ${timeA.toExamString()} s = ${vB} × ${timeA.toExamString()} = ${R(vB).mul(timeA).toExamString()} m`,
        `Total position of ${r2} = ${distB.toExamString()} m ⇒ Winning margin = ${raceDist} − ${distB.toExamString()} = ${margin.toExamString()} m`,
      ],
      final_answer: `${margin.toExamString()} m`,
    },
    shortcut_method: `When ${r1} finishes in ${timeA.toExamString()} s, ${r2} is at ${distB.toExamString()} m; subtract from ${raceDist} m.`,
    rng,
  });
}

function genG2_RaceDeadHeat(rng, difficulty) {
  const configs = [
    [1000, 10, 8],  // start 200m
    [1000, 20, 17], // start 150m
    [800, 16, 13],  // start 150m
    [600, 12, 10],  // start 100m
    [500, 10, 9],   // start 50m
    [400, 8, 7],    // start 50m
  ];
  const [raceDist, vA, vB] = rng.pick(configs);
  const timeA = R(raceDist, vA);
  const neededStart = R(raceDist).sub(R(vB).mul(timeA));
  const [r1, r2] = pickRunners(rng, 2);

  return makeQuestion({
    templateId: "TSD_G2_RACE_DEAD_HEAT",
    category: "G. Races",
    sub_type: "Head Start for Dead Heat",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question_text: `In a ${raceDist} m race, the speeds of ${r1} and ${r2} are ${vA} m/s and ${vB} m/s respectively. How much head start (in metres) should ${r1} give ${r2} so that both finish the race in a dead heat (at the exact same time)?`,
    mathModel: { kind: "RACE", raceDist: R(raceDist), vA: R(vA), vB: R(vB), startDist: R(0), solveFor: "DEAD_HEAT_START" },
    exactRationalAnswer: neededStart,
    plausible: [neededStart.add(R(25)), neededStart.sub(R(20)), neededStart.add(R(50)), R(raceDist - neededStart.toNumber())],
    unit: "m",
    solution: {
      given_data: `Race = ${raceDist} m, Speed of ${r1} = ${vA} m/s, Speed of ${r2} = ${vB} m/s`,
      formula: "Dead-Heat Head Start = Race Distance × (1 − Speed_B / Speed_A)",
      steps: [
        `Time taken by ${r1} = ${raceDist} / ${vA} = ${timeA.toExamString()} seconds`,
        `Distance ${r2} runs in ${timeA.toExamString()} s = ${vB} × ${timeA.toExamString()} = ${R(vB).mul(timeA).toExamString()} m`,
        `Head start required = ${raceDist} − ${R(vB).mul(timeA).toExamString()} = ${neededStart.toExamString()} m`,
      ],
      final_answer: `${neededStart.toExamString()} m`,
    },
    shortcut_method: `Head start = ${raceDist} × (${vA} − ${vB}) / ${vA} = ${neededStart.toExamString()} m.`,
    rng,
  });
}

function genG3_RaceTransitive(rng, difficulty) {
  const configs = [
    [1000, 100, 100], // C covers 810 => margin 190
    [1000, 200, 100], // C covers 720 => margin 280
    [1000, 100, 200], // C covers 720 => margin 280
    [1000, 50, 100],  // C covers 855 => margin 145
    [500, 50, 50],    // C covers 405 => margin 95
    [800, 80, 100],   // C covers 630 => margin 170
  ];
  const [raceDist, d1, d2] = rng.pick(configs);
  const cDist = R((raceDist - d1) * (raceDist - d2), raceDist);
  const margin = R(raceDist).sub(cDist);
  const [r1, r2, r3] = pickRunners(rng, 3);

  return makeQuestion({
    templateId: "TSD_G3_RACE_TRANSITIVE",
    category: "G. Races",
    sub_type: "Three-Person Transitive Race",
    difficulty,
    exam_suitability: ["IBPS PO Mains", "SBI PO Mains", "SBI PO Prelims"],
    question_text: `In a ${raceDist} m race, ${r1} beats ${r2} by ${d1} m, and in the same ${raceDist} m race ${r2} beats ${r3} by ${d2} m. By what distance does ${r1} beat ${r3} in a ${raceDist} m race?`,
    mathModel: {
      kind: "RACE",
      raceDist: R(raceDist),
      vA: R(10),
      vB: R(9),
      d1: R(d1),
      d2: R(d2),
      solveFor: "TRANSITIVE_MARGIN",
    },
    exactRationalAnswer: margin,
    plausible: [R(d1 + d2), margin.add(R(10)), margin.sub(R(10)), R(d1 + d2 - 5)],
    unit: "m",
    solution: {
      given_data: `Race = ${raceDist} m, ${r1} beats ${r2} by ${d1} m, ${r2} beats ${r3} by ${d2} m`,
      formula: "Distance covered by C = D × ((D − d₁)/D) × ((D − d₂)/D)",
      steps: [
        `When ${r1} runs ${raceDist} m, ${r2} runs ${raceDist - d1} m`,
        `When ${r2} runs ${raceDist} m, ${r3} runs ${raceDist - d2} m`,
        `So when ${r1} runs ${raceDist} m, ${r3} runs (${raceDist - d1} × ${raceDist - d2}) / ${raceDist} = ${cDist.toExamString()} m`,
        `Therefore, ${r1} beats ${r3} by ${raceDist} − ${cDist.toExamString()} = ${margin.toExamString()} m`,
      ],
      final_answer: `${margin.toExamString()} m`,
    },
    shortcut_method: `Margin = d₁ + d₂ − (d₁ × d₂)/D = ${d1} + ${d2} − ${(d1 * d2) / raceDist} = ${margin.toExamString()} m (not simply d₁ + d₂).`,
    rng,
  });
}

// ============================================================================
// CATEGORY H: Stoppage & Journey / Early-Late Arrival (H1 - H3)
// ============================================================================

function genH1_StoppageMinPerHr(rng, difficulty) {
  const pairs = [
    [60, 45], // 15 min
    [60, 48], // 12 min
    [60, 50], // 10 min
    [54, 45], // 10 min
    [72, 60], // 10 min
    [80, 60], // 15 min
    [75, 60], // 12 min
    [90, 72], // 12 min
    [45, 36], // 12 min
  ];
  const [excl, incl] = rng.pick(pairs);
  const ans = R((excl - incl) * 60, excl);

  return makeQuestion({
    templateId: "TSD_H1_STOPPAGE_MIN_PER_HR",
    category: "H. Stoppage & Journey",
    sub_type: "Stoppage Time per Hour",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question_text: `Excluding stoppages, the speed of a bus is ${excl} km/h, and including stoppages, its speed is ${incl} km/h. For how many minutes does the bus stop per hour?`,
    mathModel: { kind: "STOPPAGE", speedExcl: R(excl), speedIncl: R(incl), solveFor: "STOPPAGE_MIN_PER_HR" },
    exactRationalAnswer: ans,
    plausible: [R((excl - incl) * 60, incl), ans.add(R(3)), ans.sub(R(2)), R(excl - incl)],
    unit: "minutes",
    solution: {
      given_data: `Speed excluding stoppages = ${excl} km/h, Speed including stoppages = ${incl} km/h`,
      formula: "Stoppage per hour (in minutes) = [(Speed_excl − Speed_incl) / Speed_excl] × 60",
      steps: [
        `Distance lost per hour due to stoppages = ${excl} − ${incl} = ${excl - incl} km`,
        `Time to cover ${excl - incl} km at ${excl} km/h = (${excl - incl} / ${excl}) × 60 = ${ans.toExamString()} minutes`,
      ],
      final_answer: `${ans.toExamString()} minutes`,
    },
    shortcut_method: `Always divide the speed difference (${excl - incl}) by the HIGHER speed (${excl}), then multiply by 60.`,
    rng,
  });
}

function genH2_EarlyLateArrival(rng, difficulty) {
  const configs = [
    [30, 40, 10, 5],  // diff 15 min = 1/4 hr => 30*40/(10)*1/4 = 30 km
    [40, 50, 12, 6],  // diff 18 min = 3/10 hr => 200*3/10 = 60 km
    [20, 30, 10, 10], // diff 20 min = 1/3 hr => 60*1/3 = 20 km
    [45, 60, 15, 5],  // diff 20 min = 1/3 hr => 180*1/3 = 60 km
    [24, 30, 8, 7],   // diff 15 min = 1/4 hr => 120*1/4 = 30 km
    [36, 48, 10, 10], // diff 20 min = 1/3 hr => 144*1/3 = 48 km
  ];
  const [s1, s2, lateMin, earlyMin] = rng.pick(configs);
  const diffMin = lateMin + earlyMin;
  const timeDiffHrs = R(diffMin, 60);
  const dist = R(s1 * s2).mul(timeDiffHrs).div(R(s2 - s1));
  const [name] = pickRunners(rng, 1);

  return makeQuestion({
    templateId: "TSD_H2_EARLY_LATE_ARRIVAL",
    category: "H. Stoppage & Journey",
    sub_type: "Early & Late Arrival Distance",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Prelims", "IBPS RRB PO"],
    question_text: `${name} travels from home to office at ${s1} km/h and reaches ${lateMin} minutes late. If ${name} travels at ${s2} km/h, ${name} reaches ${earlyMin} minutes early. Find the distance between ${name}'s home and office.`,
    mathModel: { kind: "EARLY_LATE_ARRIVAL", s1: R(s1), s2: R(s2), timeDiffHrs },
    exactRationalAnswer: dist,
    plausible: [dist.add(R(10)), dist.sub(R(6)), R(s1 * s2 * Math.abs(lateMin - earlyMin), (s2 - s1) * 60), dist.add(R(15))],
    unit: "km",
    solution: {
      given_data: `Speed₁ = ${s1} km/h (${lateMin} min late), Speed₂ = ${s2} km/h (${earlyMin} min early)`,
      formula: "Distance = [S₁ × S₂ / (S₂ − S₁)] × ΔT (in hours)",
      steps: [
        `Total time difference ΔT = ${lateMin} + ${earlyMin} = ${diffMin} minutes = ${timeDiffHrs.toFractionString()} hours`,
        `Distance = [(${s1} × ${s2}) / (${s2} − ${s1})] × (${timeDiffHrs.toFractionString()})`,
        `Distance = ${dist.toExamString()} km`,
      ],
      final_answer: `${dist.toExamString()} km`,
    },
    shortcut_method: `Late + Early adds the minutes (${diffMin} min = ${timeDiffHrs.toFractionString()} hr); apply (S₁×S₂)/(S₂−S₁) × ΔT.`,
    rng,
  });
}

function genH3_SpeedIncreaseTimeSaved(rng, difficulty) {
  const configs = [
    [40, 50, 1], // 40*50/10 * 1 = 200 km
    [45, 60, 1], // 180 km
    [50, 60, 1], // 300 km
    [30, 45, 2], // 180 km
    [48, 60, 1], // 240 km
    [60, 75, 1], // 300 km
  ];
  const [s1, s2, savedHrs] = rng.pick(configs);
  const timeDiffHrs = R(savedHrs);
  const dist = R(s1 * s2 * savedHrs, s2 - s1);

  return makeQuestion({
    templateId: "TSD_H3_SPEED_CHANGE_TIME_SAVED",
    category: "H. Stoppage & Journey",
    sub_type: "Speed Increased / Reduced — Find Distance",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question_text: `A train normally travels between two cities at ${s1} km/h. If its speed is increased to ${s2} km/h, it completes the same journey ${savedHrs} hour(s) earlier. What is the distance between the two cities?`,
    mathModel: { kind: "EARLY_LATE_ARRIVAL", s1: R(s1), s2: R(s2), timeDiffHrs },
    exactRationalAnswer: dist,
    plausible: [dist.add(R(30)), dist.sub(R(20)), dist.add(R(40)), dist.div(R(2))],
    unit: "km",
    solution: {
      given_data: `Original Speed = ${s1} km/h, New Speed = ${s2} km/h, Time Saved = ${savedHrs} hr`,
      formula: "Distance = [S₁ × S₂ / (S₂ − S₁)] × Time Saved",
      steps: [
        `Distance = [(${s1} × ${s2}) / (${s2} − ${s1})] × ${savedHrs}`,
        `Distance = (${s1 * s2} / ${s2 - s1}) × ${savedHrs} = ${dist.toExamString()} km`,
      ],
      final_answer: `${dist.toExamString()} km`,
    },
    shortcut_method: `Product of speeds divided by difference of speeds, multiplied by time saved: (${s1}×${s2})/${s2 - s1} × ${savedHrs} = ${dist.toExamString()} km.`,
    rng,
  });
}

// ============================================================================
// CATEGORY I: Multi-Stage Journey (I1 - I4)
// ============================================================================

function genI1_MultiStageTotalTime(rng, difficulty) {
  const s1 = rng.pick([40, 50, 60]);
  const t1 = rng.pick([2, 3]);
  const s2 = rng.pick([60, 75, 80]);
  const t2 = rng.pick([2, 3, 4]);
  const s3 = rng.pick([15, 20, 25]);
  const t3 = rng.pick([1, 2]);
  const d1 = s1 * t1;
  const d2 = s2 * t2;
  const d3 = s3 * t3;
  const totalT = R(t1 + t2 + t3);
  const [name] = pickRunners(rng, 1);

  return makeQuestion({
    templateId: "TSD_I1_MULTISTAGE_TOTAL_TIME",
    category: "I. Multi-Stage Journey",
    sub_type: "Three-Stage Mixed Transport Total Time",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
    question_text: `${name} travels ${d1} km by bus at ${s1} km/h, then ${d2} km by train at ${s2} km/h, and finally ${d3} km by auto-rickshaw at ${s3} km/h. What is the total time taken by ${name} to complete the journey?`,
    mathModel: {
      kind: "AVG_SPEED_STAGES",
      stages: [
        { distance: R(d1), speed: R(s1) },
        { distance: R(d2), speed: R(s2) },
        { distance: R(d3), speed: R(s3) },
      ],
      solveFor: "TOTAL_TIME",
    },
    exactRationalAnswer: totalT,
    plausible: [totalT.add(R(1)), totalT.sub(R(1)), totalT.add(R(2)), totalT.add(R(1, 2))],
    unit: "hours",
    solution: {
      given_data: `Bus: ${d1} km @ ${s1} km/h; Train: ${d2} km @ ${s2} km/h; Auto: ${d3} km @ ${s3} km/h`,
      formula: "Total Time = D₁/S₁ + D₂/S₂ + D₃/S₃",
      steps: [
        `Bus time = ${d1}/${s1} = ${t1} hr; Train time = ${d2}/${s2} = ${t2} hr; Auto time = ${d3}/${s3} = ${t3} hr`,
        `Total Time = ${t1} + ${t2} + ${t3} = ${totalT.toExamString()} hours`,
      ],
      final_answer: `${totalT.toExamString()} hours`,
    },
    shortcut_method: `Compute each leg's duration separately (${t1} + ${t2} + ${t3}) and add them up.`,
    rng,
  });
}

function genI2_MultiStageAvgWithStop(rng, difficulty) {
  const s1 = rng.pick([45, 50, 60]);
  const t1 = rng.pick([2, 3]);
  const s2 = rng.pick([60, 75, 90]);
  const t2 = rng.pick([2, 3]);
  const stopMin = rng.pick([30, 60]);
  const stopHrs = R(stopMin, 60);
  const d1 = s1 * t1;
  const d2 = s2 * t2;
  const totalT = R(t1 + t2).add(stopHrs);
  const ans = R(d1 + d2).div(totalT);

  return makeQuestion({
    templateId: "TSD_I2_MULTISTAGE_AVG_STOP",
    category: "I. Multi-Stage Journey",
    sub_type: "Multi-Stage Journey with Stoppage",
    difficulty,
    exam_suitability: ["IBPS PO Mains", "SBI PO Prelims", "SBI PO Mains"],
    question_text: `A delivery van travels ${d1} km on a highway at ${s1} km/h, stops at a depot for ${stopMin} minutes for unloading, and then travels ${d2} km to the next city at ${s2} km/h. What is the van's overall average speed for the entire trip?`,
    mathModel: {
      kind: "AVG_SPEED_STAGES",
      stages: [
        { distance: R(d1), speed: R(s1) },
        { distance: R(d2), speed: R(s2) },
      ],
      stoppageTime: stopHrs,
      solveFor: "AVG_SPEED",
    },
    exactRationalAnswer: ans,
    plausible: [R(d1 + d2, t1 + t2), R(s1 + s2, 2), ans.add(R(3)), ans.sub(R(2))],
    unit: "km/h",
    solution: {
      given_data: `Leg 1: ${d1} km @ ${s1} km/h, Depot stop: ${stopMin} min (${stopHrs.toExamString()} hr), Leg 2: ${d2} km @ ${s2} km/h`,
      formula: "Overall Average Speed = Total Distance / (Moving Time + Stoppage Time)",
      steps: [
        `Total Distance = ${d1} + ${d2} = ${d1 + d2} km`,
        `Total Time = (${d1}/${s1}) + (${d2}/${s2}) + ${stopHrs.toExamString()} = ${t1} + ${t2} + ${stopHrs.toExamString()} = ${totalT.toExamString()} hours`,
        `Average Speed = ${d1 + d2} / ${totalT.toExamString()} = ${ans.toExamString()} km/h`,
      ],
      final_answer: `${ans.toExamString()} km/h`,
    },
    shortcut_method: `Divide total distance (${d1 + d2} km) by total elapsed time including stop (${totalT.toExamString()} hr).`,
    rng,
  });
}

function genI3_MultiStageMissingSpeed(rng, difficulty) {
  const s1 = rng.pick([40, 45, 50]);
  const t1 = rng.pick([2, 3]);
  const s2 = rng.pick([60, 75, 80, 90]);
  const t2 = rng.pick([2, 3]);
  const d1 = s1 * t1;
  const d2 = s2 * t2;
  const targetAvg = R(d1 + d2, t1 + t2);

  return makeQuestion({
    templateId: "TSD_I3_MULTISTAGE_MISSING_SPEED",
    category: "I. Multi-Stage Journey",
    sub_type: "Find Missing Stage Speed",
    difficulty,
    exam_suitability: ["IBPS PO Mains", "SBI PO Mains", "IBPS RRB PO"],
    question_text: `A logistics truck must complete a ${d1 + d2} km route in two stages with an overall average speed of ${targetAvg.toExamString()} km/h. In the first stage, it covers ${d1} km at ${s1} km/h. What speed must it maintain in the second stage?`,
    mathModel: {
      kind: "AVG_SPEED_STAGES",
      stages: [
        { distance: R(d1), speed: R(s1) },
        { distance: R(d2), speed: R(s2) },
      ],
      solveFor: "MISSING_SPEED",
      targetAvgSpeed: targetAvg,
      knownD: R(d1),
      knownS: R(s1),
      unknownD: R(d2),
    },
    exactRationalAnswer: R(s2),
    plausible: [R(s2 + 10), R(s2 - 8), R(s2 + 5), targetAvg.mul(R(2)).sub(R(s1))],
    unit: "km/h",
    solution: {
      given_data: `Total distance = ${d1 + d2} km, Target avg = ${targetAvg.toExamString()} km/h, Stage 1 = ${d1} km @ ${s1} km/h`,
      formula: "Stage 2 Speed = Remaining Distance / (Total Target Time − Stage 1 Time)",
      steps: [
        `Total target time = ${d1 + d2} / ${targetAvg.toExamString()} = ${t1 + t2} hours`,
        `Stage 1 time = ${d1} / ${s1} = ${t1} hours ⇒ Stage 2 time = ${t2} hours`,
        `Required Stage 2 speed = ${d2} / ${t2} = ${s2} km/h`,
      ],
      final_answer: `${s2} km/h`,
    },
    shortcut_method: `Total time = ${t1 + t2} hr; subtract ${t1} hr already used → ${d2} km / ${t2} hr = ${s2} km/h.`,
    rng,
  });
}

function genI4_MultiStageTotalDistance(rng, difficulty) {
  const s1 = rng.pick([40, 48, 55, 60]);
  const t1 = R(rng.pick([2, 3, 4]));
  const s2 = rng.pick([60, 72, 80, 90]);
  const t2 = R(rng.pick([3, 5]), 2);
  const d1 = R(s1).mul(t1);
  const d2 = R(s2).mul(t2);
  const totalD = d1.add(d2);
  const [name] = pickRunners(rng, 1);

  return makeQuestion({
    templateId: "TSD_I4_MULTISTAGE_TOTAL_DIST",
    category: "I. Multi-Stage Journey",
    sub_type: "Multi-Stage Total Distance",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS RRB Clerk", "SBI Clerk Prelims"],
    question_text: `${name} travels for ${t1.toExamString()} hours by car at ${s1} km/h and then for ${t2.toExamString()} hours by express train at ${s2} km/h. What is the total distance covered by ${name}?`,
    mathModel: {
      kind: "AVG_SPEED_STAGES",
      stages: [
        { distance: d1, speed: R(s1) },
        { distance: d2, speed: R(s2) },
      ],
      solveFor: "TOTAL_DISTANCE",
    },
    exactRationalAnswer: totalD,
    plausible: [totalD.add(R(20)), totalD.sub(R(15)), totalD.add(R(30)), R(s1 + s2).mul(t1.add(t2)).div(R(2))],
    unit: "km",
    solution: {
      given_data: `Car: ${s1} km/h for ${t1.toExamString()} hr; Train: ${s2} km/h for ${t2.toExamString()} hr`,
      formula: "Total Distance = (S₁ × T₁) + (S₂ × T₂)",
      steps: [
        `Car distance = ${s1} × ${t1.toExamString()} = ${d1.toExamString()} km`,
        `Train distance = ${s2} × ${t2.toExamString()} = ${d2.toExamString()} km`,
        `Total Distance = ${d1.toExamString()} + ${d2.toExamString()} = ${totalD.toExamString()} km`,
      ],
      final_answer: `${totalD.toExamString()} km`,
    },
    shortcut_method: `Sum (speed × time) for each stage: ${d1.toExamString()} + ${d2.toExamString()} = ${totalD.toExamString()} km.`,
    rng,
  });
}

export const TSD_TEMPLATES_PART_2 = [
  { id: "TSD_F1", category: "F", difficulties: ["Medium", "Hard"], fn: genF1_CircularMeetingTime },
  { id: "TSD_F2", category: "F", difficulties: ["Hard"], fn: genF2_CircularNumMeetings },
  { id: "TSD_F3", category: "F", difficulties: ["Medium", "Hard"], fn: genF3_CircularStartMeetLCM },

  { id: "TSD_G1", category: "G", difficulties: ["Easy", "Medium", "Hard"], fn: genG1_RaceWinningMargin },
  { id: "TSD_G2", category: "G", difficulties: ["Medium", "Hard"], fn: genG2_RaceDeadHeat },
  { id: "TSD_G3", category: "G", difficulties: ["Hard"], fn: genG3_RaceTransitive },

  { id: "TSD_H1", category: "H", difficulties: ["Easy", "Medium"], fn: genH1_StoppageMinPerHr },
  { id: "TSD_H2", category: "H", difficulties: ["Easy", "Medium", "Hard"], fn: genH2_EarlyLateArrival },
  { id: "TSD_H3", category: "H", difficulties: ["Medium", "Hard"], fn: genH3_SpeedIncreaseTimeSaved },

  { id: "TSD_I1", category: "I", difficulties: ["Easy", "Medium"], fn: genI1_MultiStageTotalTime },
  { id: "TSD_I2", category: "I", difficulties: ["Medium", "Hard"], fn: genI2_MultiStageAvgWithStop },
  { id: "TSD_I3", category: "I", difficulties: ["Hard"], fn: genI3_MultiStageMissingSpeed },
  { id: "TSD_I4", category: "I", difficulties: ["Easy", "Medium"], fn: genI4_MultiStageTotalDistance },
];