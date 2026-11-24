// Place at: server/question-engine/generators/quant/timeSpeedDistance/tsdTemplatesPart1.js
import { R, kmhToMs, msToKmh, buildTsdOptions } from "./tsdMath.js";

const NAMES = ["Aarav", "Rohan", "Priya", "Sneha", "Vikram", "Ananya", "Karan", "Meera", "Arjun", "Divya", "Siddharth", "Neha"];
const CITIES = [
  ["Chennai", "Bengaluru"],
  ["Mumbai", "Pune"],
  ["Delhi", "Jaipur"],
  ["Hyderabad", "Vijayawada"],
  ["Kolkata", "Durgapur"],
  ["Ahmedabad", "Surat"],
];

function pickTwoNames(rng) {
  const a = rng.pick(NAMES);
  let b = rng.pick(NAMES);
  while (b === a) b = rng.pick(NAMES);
  return [a, b];
}

function makeQuestion({
  templateId,
  category,
  sub_type,
  difficulty,
  exam_suitability,
  question_text,
  mathModel,
  exactRationalAnswer = null,
  ratioAnswer = null,
  ratioFormat = null,
  plausible = [],
  unit = "",
  solution,
  shortcut_method = "",
  rng,
}) {
  const built = buildTsdOptions(exactRationalAnswer, plausible, { unit, rng, ratioFormat });
  return {
    templateId,
    category,
    sub_type,
    difficulty,
    exam_suitability,
    question_text,
    mathModel,
    exactRationalAnswer,
    ratioAnswer,
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
// CATEGORY A: Basic Speed, Distance & Time (A1 - A6)
// ============================================================================

function genA1_FindSpeed(rng, difficulty) {
  const speed = difficulty === "Hard" ? rng.pick([45, 54, 63, 72, 84]) : rng.pick([36, 40, 48, 50, 60, 75]);
  const timeDen = difficulty === "Easy" ? 1 : rng.pick([1, 2, 4]);
  const timeNum = timeDen === 1 ? rng.randInt(3, 8) : rng.pick([3, 5, 7, 9]);
  const time = R(timeNum, timeDen);
  const distance = R(speed).mul(time);
  const ans = distance.div(time);
  const name = rng.pick(NAMES);

  return makeQuestion({
    templateId: "TSD_A1_FIND_SPEED",
    category: "A. Basic Speed, Distance & Time",
    sub_type: "Find Speed",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS RRB Clerk", "SBI Clerk Prelims"],
    question_text: `${name} drives a car and covers a distance of ${distance.toExamString()} km in ${time.toExamString()} hours. What is the speed of the car?`,
    mathModel: { kind: "BASIC_SDT", solveFor: "SPEED", distance, time },
    exactRationalAnswer: ans,
    plausible: [ans.add(R(5)), ans.sub(R(6)), ans.add(R(10)), distance.mul(R(1, 2))],
    unit: "km/h",
    solution: {
      given_data: `Distance = ${distance.toExamString()} km, Time = ${time.toExamString()} hours`,
      formula: "Speed = Distance / Time",
      steps: [
        `Speed = ${distance.toExamString()} / ${time.toExamString()}`,
        `Speed = ${ans.toExamString()} km/h`,
      ],
      final_answer: `${ans.toExamString()} km/h`,
    },
    shortcut_method: `Divide total distance directly by total hours: ${distance.toExamString()} / ${time.toExamString()} = ${ans.toExamString()} km/h.`,
    rng,
  });
}

function genA2_FindDistance(rng, difficulty) {
  const speed = rng.pick([42, 48, 54, 60, 64, 72, 80, 90]);
  const mins = difficulty === "Easy" ? rng.pick([120, 180, 240, 300]) : rng.pick([75, 105, 135, 150, 210, 225]);
  const time = R(mins, 60);
  const ans = R(speed).mul(time);
  const [c1, c2] = rng.pick(CITIES);
  const hrsPart = Math.floor(mins / 60);
  const minPart = mins % 60;
  const timePhrase = minPart === 0 ? `${hrsPart} hours` : `${hrsPart} hours ${minPart} minutes`;

  return makeQuestion({
    templateId: "TSD_A2_FIND_DISTANCE",
    category: "A. Basic Speed, Distance & Time",
    sub_type: "Find Distance",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS RRB Clerk", "SBI Clerk Prelims"],
    question_text: `A bus travels from ${c1} to ${c2} at a uniform speed of ${speed} km/h for ${timePhrase}. Find the total distance covered by the bus.`,
    mathModel: { kind: "BASIC_SDT", solveFor: "DISTANCE", speed: R(speed), time },
    exactRationalAnswer: ans,
    plausible: [ans.add(R(15)), ans.sub(R(12)), R(speed).mul(R(hrsPart)), ans.add(R(24))],
    unit: "km",
    solution: {
      given_data: `Speed = ${speed} km/h, Time = ${timePhrase} = ${time.toExamString()} hours`,
      formula: "Distance = Speed × Time",
      steps: [
        `Convert time to hours: ${mins} / 60 = ${time.toExamString()} hours`,
        `Distance = ${speed} × ${time.toExamString()} = ${ans.toExamString()} km`,
      ],
      final_answer: `${ans.toExamString()} km`,
    },
    shortcut_method: `Convert minutes to fraction of an hour (${time.toFractionString()} hr) and multiply by ${speed}.`,
    rng,
  });
}

function genA3_FindTime(rng, difficulty) {
  const speed = rng.pick([36, 45, 50, 60, 72, 75, 80, 90]);
  const timeChoices = difficulty === "Easy" ? [R(3), R(4), R(5), R(6)] : [R(5, 2), R(7, 2), R(9, 2), R(13, 4), R(15, 4)];
  const time = rng.pick(timeChoices);
  const distance = R(speed).mul(time);
  const name = rng.pick(NAMES);

  return makeQuestion({
    templateId: "TSD_A3_FIND_TIME",
    category: "A. Basic Speed, Distance & Time",
    sub_type: "Find Time",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS RRB Clerk", "SBI Clerk Prelims"],
    question_text: `${name} travels a distance of ${distance.toExamString()} km at an average speed of ${speed} km/h. How much time does ${name} take to complete the journey?`,
    mathModel: { kind: "BASIC_SDT", solveFor: "TIME", distance, speed: R(speed) },
    exactRationalAnswer: time,
    plausible: [time.add(R(1, 2)), time.sub(R(1, 2)), time.add(R(1)), time.add(R(3, 2))],
    unit: "hours",
    solution: {
      given_data: `Distance = ${distance.toExamString()} km, Speed = ${speed} km/h`,
      formula: "Time = Distance / Speed",
      steps: [
        `Time = ${distance.toExamString()} / ${speed}`,
        `Time = ${time.toExamString()} hours`,
      ],
      final_answer: `${time.toExamString()} hours`,
    },
    shortcut_method: `Cancel common factors between ${distance.toExamString()} and ${speed} to get ${time.toExamString()} hours.`,
    rng,
  });
}

function genA4_UnitConversion(rng, difficulty) {
  const toMs = rng.random() < 0.5;
  if (toMs) {
    const kmh = difficulty === "Easy"
      ? rng.pick([18, 36, 54, 72, 90, 108, 126, 144])
      : rng.pick([27, 45, 63, 81, 99, 117, 135]);
    const speed = R(kmh);
    const ans = kmhToMs(speed);
    return makeQuestion({
      templateId: "TSD_A4_UNIT_CONVERSION_MS",
      category: "A. Basic Speed, Distance & Time",
      sub_type: "Unit Conversion (km/h to m/s)",
      difficulty,
      exam_suitability: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
      question_text: `A train moves at a uniform speed of ${kmh} km/h. Express its speed in metres per second (m/s).`,
      mathModel: { kind: "BASIC_SDT", solveFor: "KMH_TO_MS", speed },
      exactRationalAnswer: ans,
      plausible: [ans.add(R(5)), ans.sub(R(2)), speed.mul(R(18, 5)), ans.add(R(25, 10))],
      unit: "m/s",
      solution: {
        given_data: `Speed = ${kmh} km/h`,
        formula: "Speed in m/s = Speed in km/h × (5 / 18)",
        steps: [
          `Speed = ${kmh} × (5 / 18)`,
          `Speed = ${ans.toExamString()} m/s`,
        ],
        final_answer: `${ans.toExamString()} m/s`,
      },
      shortcut_method: `Since 18 km/h = 5 m/s, multiply (${kmh}/18) by 5 to get ${ans.toExamString()} m/s.`,
      rng,
    });
  } else {
    const ms = difficulty === "Easy"
      ? rng.pick([5, 10, 15, 20, 25, 30, 35, 40])
      : rng.pick([12, 14, 16, 18, 22, 24, 28]);
    const speed = R(ms);
    const ans = msToKmh(speed);
    return makeQuestion({
      templateId: "TSD_A4_UNIT_CONVERSION_KMH",
      category: "A. Basic Speed, Distance & Time",
      sub_type: "Unit Conversion (m/s to km/h)",
      difficulty,
      exam_suitability: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
      question_text: `A cyclist rides at a speed of ${ms} m/s. What is the cyclist's speed in kilometres per hour (km/h)?`,
      mathModel: { kind: "BASIC_SDT", solveFor: "MS_TO_KMH", speed },
      exactRationalAnswer: ans,
      plausible: [ans.add(R(6)), ans.sub(R(6)), speed.mul(R(5, 18)), ans.add(R(10))],
      unit: "km/h",
      solution: {
        given_data: `Speed = ${ms} m/s`,
        formula: "Speed in km/h = Speed in m/s × (18 / 5)",
        steps: [
          `Speed = ${ms} × (18 / 5)`,
          `Speed = ${ans.toExamString()} km/h`,
        ],
        final_answer: `${ans.toExamString()} km/h`,
      },
      shortcut_method: `Since 5 m/s = 18 km/h, multiply ${ms} by 3.6 to get ${ans.toExamString()} km/h.`,
      rng,
    });
  }
}

function genA5_SpeedTimeRatio(rng, difficulty) {
  const [n1, n2] = pickTwoNames(rng);
  const d1 = rng.pick([120, 150, 180, 200, 240]);
  const d2 = difficulty === "Easy" ? d1 : rng.pick([150, 180, 240, 300, 360]);
  const t1 = rng.pick([3, 4, 5, 6]);
  let t2 = rng.pick([4, 5, 6, 8]);
  if (d1 * t2 === d2 * t1) t2 = t1 + 1;

  const s1 = R(d1, t1);
  const s2 = R(d2, t2);
  const ratio = s1.div(s2);
  const correctStr = `${ratio.num} : ${ratio.den}`;
  const invStr = `${ratio.den} : ${ratio.num}`;
  const dRatio = R(d1, d2);
  const tRatio = R(t1, t2);

  return makeQuestion({
    templateId: "TSD_A5_SPEED_RATIO",
    category: "A. Basic Speed, Distance & Time",
    sub_type: "Speed Ratio using Distance & Time",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question_text: `${n1} covers ${d1} km in ${t1} hours while ${n2} covers ${d2} km in ${t2} hours. What is the ratio of the speed of ${n1} to the speed of ${n2}?`,
    mathModel: { kind: "RATIO", a: s1, b: s2 },
    ratioAnswer: correctStr,
    ratioFormat: {
      correct: correctStr,
      p: Number(ratio.num),
      q: Number(ratio.den),
      distractors: [
        invStr,
        `${dRatio.num} : ${dRatio.den}`,
        `${tRatio.num} : ${tRatio.den}`,
        `${Number(ratio.num) + 1} : ${Number(ratio.den)}`,
      ],
    },
    solution: {
      given_data: `${n1}: D₁ = ${d1} km, T₁ = ${t1} hr; ${n2}: D₂ = ${d2} km, T₂ = ${t2} hr`,
      formula: "Speed Ratio = (D₁ / T₁) : (D₂ / T₂)",
      steps: [
        `Speed of ${n1} = ${d1} / ${t1} = ${s1.toExamString()} km/h`,
        `Speed of ${n2} = ${d2} / ${t2} = ${s2.toExamString()} km/h`,
        `Ratio = (${s1.toFractionString()}) : (${s2.toFractionString()}) = ${correctStr}`,
      ],
      final_answer: correctStr,
    },
    shortcut_method: `Cross-multiply (D₁ × T₂) : (D₂ × T₁) = (${d1} × ${t2}) : (${d2} × ${t1}) = ${correctStr}.`,
    rng,
  });
}

function genA6_DistanceRatio(rng, difficulty) {
  const sA = rng.randInt(2, 7);
  let sB = rng.randInt(3, 9);
  if (sA === sB) sB++;
  const tA = rng.randInt(2, 6);
  let tB = rng.randInt(3, 8);
  if (sA * tA === sB * tB) tB++;

  const dA = R(sA * tA);
  const dB = R(sB * tB);
  const ratio = dA.div(dB);
  const correctStr = `${ratio.num} : ${ratio.den}`;
  const crossRatio = R(sA * tB, sB * tA);

  return makeQuestion({
    templateId: "TSD_A6_DISTANCE_RATIO",
    category: "A. Basic Speed, Distance & Time",
    sub_type: "Distance Ratio from Speed & Time Ratios",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
    question_text: `The ratio of speeds of two cars A and B is ${sA} : ${sB}, and the ratio of the times taken by them is ${tA} : ${tB}. Find the ratio of the distances covered by car A and car B.`,
    mathModel: { kind: "RATIO", a: dA, b: dB },
    ratioAnswer: correctStr,
    ratioFormat: {
      correct: correctStr,
      p: Number(ratio.num),
      q: Number(ratio.den),
      distractors: [
        `${ratio.den} : ${ratio.num}`,
        `${crossRatio.num} : ${crossRatio.den}`,
        `${sA + tA} : ${sB + tB}`,
        `${Number(ratio.num) + 1} : ${Number(ratio.den) + 1}`,
      ],
    },
    solution: {
      given_data: `Speed ratio S₁ : S₂ = ${sA} : ${sB}, Time ratio T₁ : T₂ = ${tA} : ${tB}`,
      formula: "Distance Ratio = (S₁ × T₁) : (S₂ × T₂)",
      steps: [
        `D₁ : D₂ = (${sA} × ${tA}) : (${sB} × ${tB}) = ${sA * tA} : ${sB * tB}`,
        `Simplifying the ratio gives ${correctStr}`,
      ],
      final_answer: correctStr,
    },
    shortcut_method: `Multiply corresponding terms directly: (${sA}×${tA}) : (${sB}×${tB}) = ${correctStr}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY B: Average Speed (B1 - B5)
// ============================================================================

function genB1_AvgSpeedEqualDistance(rng, difficulty) {
  const pairs = difficulty === "Easy"
    ? [[20, 30], [30, 60], [40, 60], [60, 40], [30, 45]]
    : [[24, 40], [36, 45], [45, 55], [48, 72], [35, 65], [42, 56]];
  const [a, b] = rng.pick(pairs);
  const d = R(a * b); // clean equal distance
  const s1 = R(a);
  const s2 = R(b);
  const ans = R(2 * a * b, a + b);
  const wrongMean = R(a + b, 2);
  const [c1, c2] = rng.pick(CITIES);

  return makeQuestion({
    templateId: "TSD_B1_AVG_SPEED_ROUND_TRIP",
    category: "B. Average Speed",
    sub_type: "Equal Distances / Round Trip",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI PO Prelims", "IBPS RRB PO"],
    question_text: `A car travels from ${c1} to ${c2} at a speed of ${a} km/h and returns along the same route at a speed of ${b} km/h. What is the average speed of the car for the entire round trip?`,
    mathModel: {
      kind: "AVG_SPEED_STAGES",
      stages: [{ distance: d, speed: s1 }, { distance: d, speed: s2 }],
      solveFor: "AVG_SPEED",
    },
    exactRationalAnswer: ans,
    plausible: [wrongMean, ans.add(R(2)), ans.sub(R(2)), ans.add(R(4))],
    unit: "km/h",
    solution: {
      given_data: `Onward speed (x) = ${a} km/h, Return speed (y) = ${b} km/h (Equal distances)`,
      formula: "Average Speed = (2 × x × y) / (x + y)",
      steps: [
        `Average Speed = (2 × ${a} × ${b}) / (${a} + ${b})`,
        `Average Speed = ${2 * a * b} / ${a + b} = ${ans.toExamString()} km/h`,
      ],
      final_answer: `${ans.toExamString()} km/h`,
    },
    shortcut_method: `For equal distances, use harmonic mean 2xy/(x+y) = ${2 * a * b}/${a + b} = ${ans.toExamString()} km/h (never use (x+y)/2).`,
    rng,
  });
}

function genB2_AvgSpeedEqualTime(rng, difficulty) {
  const s1 = rng.pick([36, 40, 44, 48, 52, 60]);
  const s2 = rng.pick([54, 60, 66, 72, 76, 84]);
  const s3 = difficulty === "Hard" ? rng.pick([45, 57, 63, 75]) : null;
  const t = R(rng.pick([2, 3, 4]));
  const stages = s3
    ? [
        { distance: R(s1).mul(t), speed: R(s1) },
        { distance: R(s2).mul(t), speed: R(s2) },
        { distance: R(s3).mul(t), speed: R(s3) },
      ]
    : [
        { distance: R(s1).mul(t), speed: R(s1) },
        { distance: R(s2).mul(t), speed: R(s2) },
      ];
  const ans = s3 ? R(s1 + s2 + s3, 3) : R(s1 + s2, 2);
  const wrongHarmonic = s3 ? ans.sub(R(3)) : R(2 * s1 * s2, s1 + s2);
  const name = rng.pick(NAMES);

  const qText = s3
    ? `${name} travels for ${t.toExamString()} hours at ${s1} km/h, then for ${t.toExamString()} hours at ${s2} km/h, and finally for ${t.toExamString()} hours at ${s3} km/h. What is ${name}'s average speed for the whole journey?`
    : `${name} drives for ${t.toExamString()} hours at ${s1} km/h and then for another ${t.toExamString()} hours at ${s2} km/h. Find the average speed for the entire journey.`;

  return makeQuestion({
    templateId: "TSD_B2_AVG_SPEED_EQUAL_TIME",
    category: "B. Average Speed",
    sub_type: "Equal Time Intervals",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS RRB Clerk", "SBI Clerk Prelims"],
    question_text: qText,
    mathModel: { kind: "AVG_SPEED_STAGES", stages, solveFor: "AVG_SPEED" },
    exactRationalAnswer: ans,
    plausible: [wrongHarmonic, ans.add(R(3)), ans.sub(R(2)), ans.add(R(5))],
    unit: "km/h",
    solution: {
      given_data: s3
        ? `Equal intervals of ${t.toExamString()} hr each at ${s1}, ${s2}, and ${s3} km/h`
        : `Equal intervals of ${t.toExamString()} hr each at ${s1} km/h and ${s2} km/h`,
      formula: "For equal time intervals, Average Speed = Arithmetic Mean of speeds",
      steps: [
        s3
          ? `Average Speed = (${s1} + ${s2} + ${s3}) / 3 = ${s1 + s2 + s3} / 3`
          : `Average Speed = (${s1} + ${s2}) / 2 = ${s1 + s2} / 2`,
        `Average Speed = ${ans.toExamString()} km/h`,
      ],
      final_answer: `${ans.toExamString()} km/h`,
    },
    shortcut_method: `When time intervals are equal, average speed is simply the arithmetic mean of speeds = ${ans.toExamString()} km/h.`,
    rng,
  });
}

function genB3_AvgSpeedDifferentStages(rng, difficulty) {
  const s1 = rng.pick([30, 40, 45, 50, 60]);
  const t1 = rng.pick([2, 3, 4]);
  const s2 = rng.pick([45, 50, 60, 75, 80]);
  const t2 = rng.pick([2, 3, 4, 5]);
  const d1 = s1 * t1;
  const d2 = s2 * t2;
  const totalD = R(d1 + d2);
  const totalT = R(t1 + t2);
  const ans = totalD.div(totalT);

  return makeQuestion({
    templateId: "TSD_B3_AVG_SPEED_DIFF_STAGES",
    category: "B. Average Speed",
    sub_type: "Different Distances & Speeds",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question_text: `A motorist covers the first ${d1} km of a trip at ${s1} km/h and the remaining ${d2} km at ${s2} km/h. What is the average speed of the motorist for the entire journey?`,
    mathModel: {
      kind: "AVG_SPEED_STAGES",
      stages: [
        { distance: R(d1), speed: R(s1) },
        { distance: R(d2), speed: R(s2) },
      ],
      solveFor: "AVG_SPEED",
    },
    exactRationalAnswer: ans,
    plausible: [R(s1 + s2, 2), ans.add(R(2)), ans.sub(R(3)), R(2 * s1 * s2, s1 + s2)],
    unit: "km/h",
    solution: {
      given_data: `Stage 1: ${d1} km at ${s1} km/h; Stage 2: ${d2} km at ${s2} km/h`,
      formula: "Average Speed = Total Distance / Total Time",
      steps: [
        `Time₁ = ${d1} / ${s1} = ${t1} hours; Time₂ = ${d2} / ${s2} = ${t2} hours`,
        `Total Distance = ${d1} + ${d2} = ${d1 + d2} km; Total Time = ${t1} + ${t2} = ${t1 + t2} hours`,
        `Average Speed = ${d1 + d2} / ${t1 + t2} = ${ans.toExamString()} km/h`,
      ],
      final_answer: `${ans.toExamString()} km/h`,
    },
    shortcut_method: `Sum distances (${d1 + d2} km) and divide by sum of individual times (${t1 + t2} hr).`,
    rng,
  });
}

function genB4_AvgSpeedWithStoppage(rng, difficulty) {
  const s1 = rng.pick([40, 50, 60, 75]);
  const t1 = rng.pick([2, 3]);
  const s2 = rng.pick([50, 60, 70, 80]);
  const t2 = rng.pick([2, 3]);
  const stopMins = rng.pick([30, 60]);
  const stopHrs = R(stopMins, 60);
  const d1 = s1 * t1;
  const d2 = s2 * t2;
  const totalD = R(d1 + d2);
  const totalT = R(t1 + t2).add(stopHrs);
  const ans = totalD.div(totalT);
  const noStopAvg = totalD.div(R(t1 + t2));

  return makeQuestion({
    templateId: "TSD_B4_AVG_SPEED_STOPPAGE",
    category: "B. Average Speed",
    sub_type: "Average Speed with Intermediate Stop",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS RRB PO"],
    question_text: `A traveller drives ${d1} km at ${s1} km/h, takes a rest break of ${stopMins} minutes, and then drives another ${d2} km at ${s2} km/h. What is the overall average speed for the entire journey including the rest break?`,
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
    plausible: [noStopAvg, R(s1 + s2, 2), ans.add(R(4)), ans.sub(R(3))],
    unit: "km/h",
    solution: {
      given_data: `Stage 1: ${d1} km at ${s1} km/h, Stop: ${stopMins} min (${stopHrs.toExamString()} hr), Stage 2: ${d2} km at ${s2} km/h`,
      formula: "Average Speed = Total Distance / (Moving Time + Stoppage Time)",
      steps: [
        `Moving Time = (${d1}/${s1}) + (${d2}/${s2}) = ${t1} + ${t2} = ${t1 + t2} hours`,
        `Total Time including stop = ${t1 + t2} + ${stopHrs.toExamString()} = ${totalT.toExamString()} hours`,
        `Average Speed = ${d1 + d2} / ${totalT.toExamString()} = ${ans.toExamString()} km/h`,
      ],
      final_answer: `${ans.toExamString()} km/h`,
    },
    shortcut_method: `Always add the rest duration (${stopHrs.toExamString()} hr) to the denominator before dividing total distance.`,
    rng,
  });
}

function genB5_MissingSpeedFromAvg(rng, difficulty) {
  const s1 = rng.pick([30, 40, 45, 50]);
  const s2 = rng.pick([60, 75, 80, 90]);
  const t1 = rng.pick([2, 3]);
  const t2 = rng.pick([2, 3, 4]);
  const d1 = s1 * t1;
  const d2 = s2 * t2;
  const avgSpeed = R(d1 + d2, t1 + t2);

  return makeQuestion({
    templateId: "TSD_B5_MISSING_SPEED",
    category: "B. Average Speed",
    sub_type: "Find Missing Speed using Average Speed",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question_text: `A car has to cover a total distance of ${d1 + d2} km at an overall average speed of ${avgSpeed.toExamString()} km/h. If it covers the first ${d1} km at ${s1} km/h, at what speed must it travel the remaining ${d2} km?`,
    mathModel: {
      kind: "AVG_SPEED_STAGES",
      stages: [
        { distance: R(d1), speed: R(s1) },
        { distance: R(d2), speed: R(s2) },
      ],
      solveFor: "MISSING_SPEED",
      targetAvgSpeed: avgSpeed,
      knownD: R(d1),
      knownS: R(s1),
      unknownD: R(d2),
    },
    exactRationalAnswer: R(s2),
    plausible: [R(s2 + 10), R(s2 - 10), avgSpeed.mul(R(2)).sub(R(s1)), R(s2 + 5)],
    unit: "km/h",
    solution: {
      given_data: `Total Distance = ${d1 + d2} km, Target Average Speed = ${avgSpeed.toExamString()} km/h, First ${d1} km at ${s1} km/h`,
      formula: "Required Speed = Remaining Distance / (Total Target Time − Time Taken)",
      steps: [
        `Total target time = ${d1 + d2} / ${avgSpeed.toExamString()} = ${t1 + t2} hours`,
        `Time spent on first ${d1} km = ${d1} / ${s1} = ${t1} hours`,
        `Remaining time = ${t1 + t2} − ${t1} = ${t2} hours`,
        `Required speed = ${d2} / ${t2} = ${s2} km/h`,
      ],
      final_answer: `${s2} km/h`,
    },
    shortcut_method: `Find total allowed time (${t1 + t2} hr), subtract time already spent (${t1} hr), and divide remaining distance ${d2} km by ${t2} hr.`,
    rng,
  });
}

// ============================================================================
// CATEGORY C: Relative Speed (C1 - C5)
// ============================================================================

function genC1_OppositeMeetingTime(rng, difficulty) {
  const v1 = rng.pick([35, 40, 45, 50, 55, 60]);
  const v2 = rng.pick([25, 30, 40, 45, 50, 65]);
  const meetTime = difficulty === "Easy" ? R(rng.pick([3, 4, 5, 6])) : R(rng.pick([5, 7, 9]), 2);
  const gap = R(v1 + v2).mul(meetTime);
  const [c1, c2] = rng.pick(CITIES);

  return makeQuestion({
    templateId: "TSD_C1_OPPOSITE_MEET_TIME",
    category: "C. Relative Speed",
    sub_type: "Opposite Direction Meeting Time",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
    question_text: `Two cars start simultaneously from ${c1} and ${c2}, which are ${gap.toExamString()} km apart, and move towards each other at speeds of ${v1} km/h and ${v2} km/h respectively. After how many hours will they meet?`,
    mathModel: { kind: "RELATIVE_MEETING", direction: "OPPOSITE", v1: R(v1), v2: R(v2), gap, solveFor: "MEETING_TIME" },
    exactRationalAnswer: meetTime,
    plausible: [meetTime.add(R(1)), meetTime.sub(R(1, 2)), meetTime.add(R(1, 2)), gap.div(R(Math.abs(v1 - v2) || 10))],
    unit: "hours",
    solution: {
      given_data: `Distance = ${gap.toExamString()} km, Speed₁ = ${v1} km/h, Speed₂ = ${v2} km/h (Opposite directions)`,
      formula: "Meeting Time = Initial Distance / (Speed₁ + Speed₂)",
      steps: [
        `Relative Speed = ${v1} + ${v2} = ${v1 + v2} km/h`,
        `Meeting Time = ${gap.toExamString()} / ${v1 + v2} = ${meetTime.toExamString()} hours`,
      ],
      final_answer: `${meetTime.toExamString()} hours`,
    },
    shortcut_method: `Opposite directions add speeds: ${gap.toExamString()} / (${v1} + ${v2}) = ${meetTime.toExamString()} hours.`,
    rng,
  });
}

function genC2_OppositeMeetingDistance(rng, difficulty) {
  const v1 = rng.pick([40, 45, 50, 55, 60]);
  const v2 = rng.pick([30, 35, 45, 50, 65]);
  const meetTime = R(rng.pick([3, 4, 5, 6]));
  const gap = R(v1 + v2).mul(meetTime);
  const distFromA = R(v1).mul(meetTime);
  const distFromB = R(v2).mul(meetTime);
  const [c1, c2] = rng.pick(CITIES);

  return makeQuestion({
    templateId: "TSD_C2_OPPOSITE_MEET_DIST",
    category: "C. Relative Speed",
    sub_type: "Find Meeting Distance",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS RRB PO"],
    question_text: `Two trains start at the same time from ${c1} and ${c2}, ${gap.toExamString()} km apart, and travel towards each other at ${v1} km/h and ${v2} km/h respectively. At what distance from ${c1} will the two trains meet?`,
    mathModel: { kind: "RELATIVE_MEETING", direction: "OPPOSITE", v1: R(v1), v2: R(v2), gap, solveFor: "MEETING_DISTANCE_FROM_A" },
    exactRationalAnswer: distFromA,
    plausible: [distFromB, distFromA.add(R(20)), distFromA.sub(R(15)), gap.div(R(2))],
    unit: "km",
    solution: {
      given_data: `Distance = ${gap.toExamString()} km, Speed from ${c1} = ${v1} km/h, Speed from ${c2} = ${v2} km/h`,
      formula: "Meeting Distance from A = Speed_A × [Distance / (Speed_A + Speed_B)]",
      steps: [
        `Relative Speed = ${v1} + ${v2} = ${v1 + v2} km/h`,
        `Time to meet = ${gap.toExamString()} / ${v1 + v2} = ${meetTime.toExamString()} hours`,
        `Distance from ${c1} = ${v1} × ${meetTime.toExamString()} = ${distFromA.toExamString()} km`,
      ],
      final_answer: `${distFromA.toExamString()} km`,
    },
    shortcut_method: `Distance ratio equals speed ratio: ${gap.toExamString()} × ${v1}/(${v1}+${v2}) = ${distFromA.toExamString()} km.`,
    rng,
  });
}

function genC3_SameDirectionCatchUp(rng, difficulty) {
  const v2 = rng.pick([35, 40, 45, 50, 55]);
  const diff = rng.pick([10, 12, 15, 18, 20]);
  const v1 = v2 + diff;
  const meetTime = difficulty === "Easy" ? R(rng.pick([3, 4, 5, 6])) : R(rng.pick([5, 7, 9]), 2);
  const gap = R(diff).mul(meetTime);
  const [n1, n2] = pickTwoNames(rng);

  return makeQuestion({
    templateId: "TSD_C3_SAME_DIR_CATCHUP",
    category: "C. Relative Speed",
    sub_type: "Same Direction Catch-up",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
    question_text: `${n1} is ${gap.toExamString()} km behind ${n2}. Both start moving in the same direction simultaneously, with ${n1} at ${v1} km/h and ${n2} at ${v2} km/h. In how many hours will ${n1} overtake ${n2}?`,
    mathModel: { kind: "RELATIVE_MEETING", direction: "SAME", v1: R(v1), v2: R(v2), gap, solveFor: "MEETING_TIME" },
    exactRationalAnswer: meetTime,
    plausible: [meetTime.add(R(1)), meetTime.sub(R(1)), gap.div(R(v1 + v2)), meetTime.add(R(2))],
    unit: "hours",
    solution: {
      given_data: `Initial gap = ${gap.toExamString()} km, Speed of ${n1} = ${v1} km/h, Speed of ${n2} = ${v2} km/h (Same direction)`,
      formula: "Catch-up Time = Gap / (Speed₁ − Speed₂)",
      steps: [
        `Relative Speed = ${v1} − ${v2} = ${diff} km/h`,
        `Catch-up Time = ${gap.toExamString()} / ${diff} = ${meetTime.toExamString()} hours`,
      ],
      final_answer: `${meetTime.toExamString()} hours`,
    },
    shortcut_method: `Same direction subtracts speeds: ${gap.toExamString()} / (${v1} − ${v2}) = ${meetTime.toExamString()} hours.`,
    rng,
  });
}

function genC4_HeadStartCatchUp(rng, difficulty) {
  const v2 = rng.pick([30, 36, 40, 45, 48]);
  const diff = rng.pick([12, 15, 16, 18, 20]);
  const v1 = v2 + diff;
  const headStart = R(rng.pick([2, 3, 4]));
  const gap = R(v2).mul(headStart);
  const meetTime = gap.div(R(diff));
  const [n1, n2] = pickTwoNames(rng);

  return makeQuestion({
    templateId: "TSD_C4_HEAD_START_CATCHUP",
    category: "C. Relative Speed",
    sub_type: "Delayed Start / Head Start Catch-up",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question_text: `${n2} leaves a town by car at ${v2} km/h. ${headStart.toExamString()} hours later, ${n1} starts from the same town along the same route at ${v1} km/h to catch up with ${n2}. How many hours after ${n1} starts will ${n1} catch up with ${n2}?`,
    mathModel: {
      kind: "RELATIVE_MEETING",
      direction: "SAME",
      v1: R(v1),
      v2: R(v2),
      gap: R(0),
      headStartTime: headStart,
      solveFor: "MEETING_TIME",
    },
    exactRationalAnswer: meetTime,
    plausible: [meetTime.add(headStart), meetTime.add(R(1)), meetTime.sub(R(1)), gap.div(R(v1))],
    unit: "hours",
    solution: {
      given_data: `Slower speed = ${v2} km/h, Faster speed = ${v1} km/h, Head start = ${headStart.toExamString()} hours`,
      formula: "Catch-up Time = (Slower Speed × Head Start) / (Faster Speed − Slower Speed)",
      steps: [
        `Head-start distance covered by ${n2} = ${v2} × ${headStart.toExamString()} = ${gap.toExamString()} km`,
        `Relative Speed = ${v1} − ${v2} = ${diff} km/h`,
        `Catch-up Time = ${gap.toExamString()} / ${diff} = ${meetTime.toExamString()} hours`,
      ],
      final_answer: `${meetTime.toExamString()} hours`,
    },
    shortcut_method: `Lead distance = ${v2} × ${headStart.toExamString()} = ${gap.toExamString()} km; divide by speed difference (${diff} km/h).`,
    rng,
  });
}

function genC5_OppositeDelayedStart(rng, difficulty) {
  const v1 = rng.pick([40, 45, 50, 60]);
  const v2 = rng.pick([30, 40, 50, 55]);
  const delay = R(rng.pick([1, 2]));
  const postMeetTime = R(rng.pick([2, 3, 4]));
  const gap = R(v1).mul(delay).add(R(v1 + v2).mul(postMeetTime));
  const [c1, c2] = rng.pick(CITIES);

  return makeQuestion({
    templateId: "TSD_C5_OPPOSITE_DELAYED_START",
    category: "C. Relative Speed",
    sub_type: "Opposite Direction with Delayed Start",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question_text: `Stations ${c1} and ${c2} are ${gap.toExamString()} km apart. Train A leaves ${c1} for ${c2} at ${v1} km/h. ${delay.toExamString()} hour(s) later, Train B leaves ${c2} for ${c1} at ${v2} km/h. How many hours after Train B departs will the two trains meet?`,
    mathModel: {
      kind: "RELATIVE_MEETING",
      direction: "OPPOSITE",
      v1: R(v1),
      v2: R(v2),
      gap,
      headStartTime: delay,
      solveFor: "MEETING_TIME",
    },
    exactRationalAnswer: postMeetTime,
    plausible: [postMeetTime.add(delay), gap.div(R(v1 + v2)), postMeetTime.add(R(1)), postMeetTime.sub(R(1, 2))],
    unit: "hours",
    solution: {
      given_data: `Total distance = ${gap.toExamString()} km, Train A = ${v1} km/h (starts ${delay.toExamString()} hr early), Train B = ${v2} km/h`,
      formula: "Meeting Time after B starts = (Total Distance − Speed_A × Delay) / (Speed_A + Speed_B)",
      steps: [
        `Distance covered by Train A before Train B starts = ${v1} × ${delay.toExamString()} = ${R(v1).mul(delay).toExamString()} km`,
        `Remaining distance = ${gap.toExamString()} − ${R(v1).mul(delay).toExamString()} = ${gap.sub(R(v1).mul(delay)).toExamString()} km`,
        `Relative Speed = ${v1} + ${v2} = ${v1 + v2} km/h`,
        `Meeting Time after Train B starts = ${gap.sub(R(v1).mul(delay)).toExamString()} / ${v1 + v2} = ${postMeetTime.toExamString()} hours`,
      ],
      final_answer: `${postMeetTime.toExamString()} hours`,
    },
    shortcut_method: `First subtract Train A's head-start distance (${R(v1).mul(delay).toExamString()} km) from ${gap.toExamString()} km, then divide by (${v1}+${v2}).`,
    rng,
  });
}

// ============================================================================
// CATEGORY D: Problems on Trains (D1 - D5)
// ============================================================================

function genD1_TrainCrossingPole(rng, difficulty) {
  const speedKmh = rng.pick([36, 54, 72, 90, 108, 126]);
  const speedMs = kmhToMs(R(speedKmh));
  const timeSec = R(rng.pick([8, 10, 12, 14, 15, 16, 18, 20]));
  const len1 = speedMs.mul(timeSec);

  return makeQuestion({
    templateId: "TSD_D1_TRAIN_POLE",
    category: "D. Problems on Trains",
    sub_type: "Train Crossing a Pole",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS RRB Clerk", "SBI Clerk Prelims"],
    question_text: `A train ${len1.toExamString()} metres long is running at a speed of ${speedKmh} km/h. How many seconds will it take to cross a stationary electric pole?`,
    mathModel: { kind: "TRAIN_CROSSING", len1, len2: R(0), v1Kmh: R(speedKmh), direction: "STATIONARY", solveFor: "TIME_SEC" },
    exactRationalAnswer: timeSec,
    plausible: [timeSec.add(R(2)), timeSec.sub(R(2)), timeSec.add(R(4)), len1.div(R(speedKmh))],
    unit: "seconds",
    solution: {
      given_data: `Train length = ${len1.toExamString()} m, Speed = ${speedKmh} km/h`,
      formula: "Time = Train Length / Speed (in m/s)",
      steps: [
        `Convert speed to m/s: ${speedKmh} × (5/18) = ${speedMs.toExamString()} m/s`,
        `Time = ${len1.toExamString()} / ${speedMs.toExamString()} = ${timeSec.toExamString()} seconds`,
      ],
      final_answer: `${timeSec.toExamString()} seconds`,
    },
    shortcut_method: `Convert ${speedKmh} km/h → ${speedMs.toExamString()} m/s, then divide ${len1.toExamString()} by ${speedMs.toExamString()}.`,
    rng,
  });
}

function genD2_TrainCrossingPlatform(rng, difficulty) {
  const speedKmh = rng.pick([36, 54, 72, 90, 108]);
  const speedMs = kmhToMs(R(speedKmh));
  const timeSec = R(rng.pick([18, 20, 22, 24, 25, 28, 30, 36]));
  const totalLen = speedMs.mul(timeSec);
  const len1 = R(Math.round((totalLen.toNumber() * 0.45) / 10) * 10);
  const len2 = totalLen.sub(len1);

  return makeQuestion({
    templateId: "TSD_D2_TRAIN_PLATFORM_TIME",
    category: "D. Problems on Trains",
    sub_type: "Train Crossing a Platform / Bridge",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question_text: `A train ${len1.toExamString()} m long running at ${speedKmh} km/h crosses a railway platform ${len2.toExamString()} m long. Find the time taken by the train to cross the platform completely.`,
    mathModel: { kind: "TRAIN_CROSSING", len1, len2, v1Kmh: R(speedKmh), direction: "STATIONARY", solveFor: "TIME_SEC" },
    exactRationalAnswer: timeSec,
    plausible: [len1.div(speedMs), len2.div(speedMs), timeSec.add(R(4)), timeSec.sub(R(3))],
    unit: "seconds",
    solution: {
      given_data: `Train length = ${len1.toExamString()} m, Platform length = ${len2.toExamString()} m, Speed = ${speedKmh} km/h`,
      formula: "Time = (Train Length + Platform Length) / Speed (in m/s)",
      steps: [
        `Total distance = ${len1.toExamString()} + ${len2.toExamString()} = ${totalLen.toExamString()} m`,
        `Speed in m/s = ${speedKmh} × (5/18) = ${speedMs.toExamString()} m/s`,
        `Time = ${totalLen.toExamString()} / ${speedMs.toExamString()} = ${timeSec.toExamString()} seconds`,
      ],
      final_answer: `${timeSec.toExamString()} seconds`,
    },
    shortcut_method: `Add both lengths (${totalLen.toExamString()} m) and divide by speed in m/s (${speedMs.toExamString()} m/s).`,
    rng,
  });
}

function genD3_FindPlatformLength(rng, difficulty) {
  const speedKmh = rng.pick([54, 72, 90, 108]);
  const speedMs = kmhToMs(R(speedKmh));
  const timeSec = R(rng.pick([20, 24, 25, 30, 32, 36]));
  const totalLen = speedMs.mul(timeSec);
  const len1 = R(rng.pick([150, 180, 200, 240, 250]));
  const len2 = totalLen.sub(len1);
  if (!len2.isPositive()) return genD2_TrainCrossingPlatform(rng, difficulty);

  return makeQuestion({
    templateId: "TSD_D3_FIND_PLATFORM_LEN",
    category: "D. Problems on Trains",
    sub_type: "Find Length of Platform",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI Clerk Prelims", "SBI PO Prelims"],
    question_text: `A train of length ${len1.toExamString()} m travelling at ${speedKmh} km/h crosses a bridge completely in ${timeSec.toExamString()} seconds. What is the length of the bridge?`,
    mathModel: { kind: "TRAIN_CROSSING", len1, len2, v1Kmh: R(speedKmh), direction: "STATIONARY", solveFor: "PLATFORM_LENGTH" },
    exactRationalAnswer: len2,
    plausible: [totalLen, len2.add(R(40)), len2.sub(R(30)), len2.add(R(50))],
    unit: "m",
    solution: {
      given_data: `Train length = ${len1.toExamString()} m, Speed = ${speedKmh} km/h, Crossing time = ${timeSec.toExamString()} s`,
      formula: "Bridge Length = (Speed in m/s × Time) − Train Length",
      steps: [
        `Speed in m/s = ${speedKmh} × (5/18) = ${speedMs.toExamString()} m/s`,
        `Total distance covered = ${speedMs.toExamString()} × ${timeSec.toExamString()} = ${totalLen.toExamString()} m`,
        `Bridge Length = ${totalLen.toExamString()} − ${len1.toExamString()} = ${len2.toExamString()} m`,
      ],
      final_answer: `${len2.toExamString()} m`,
    },
    shortcut_method: `Total distance = ${speedMs.toExamString()} × ${timeSec.toExamString()} = ${totalLen.toExamString()} m; subtract train length ${len1.toExamString()} m.`,
    rng,
  });
}

function genD4_TrainCrossingWalkingMan(rng, difficulty) {
  const isOpposite = rng.random() < 0.5;
  const manKmh = rng.pick([6, 9, 12]);
  const relKmh = rng.pick([36, 54, 72, 90]);
  const trainKmh = isOpposite ? relKmh - manKmh : relKmh + manKmh;
  const relMs = kmhToMs(R(relKmh));
  const timeSec = R(rng.pick([8, 10, 12, 15, 16, 18]));
  const len1 = relMs.mul(timeSec);
  const dirText = isOpposite ? "in the opposite direction" : "in the same direction";

  return makeQuestion({
    templateId: `TSD_D4_TRAIN_MAN_${isOpposite ? "OPP" : "SAME"}`,
    category: "D. Problems on Trains",
    sub_type: `Train Crossing a Walking Person (${isOpposite ? "Opposite" : "Same"} Direction)`,
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS RRB PO"],
    question_text: `A train ${len1.toExamString()} m long is running at ${trainKmh} km/h. In how many seconds will it cross a man walking at ${manKmh} km/h ${dirText}?`,
    mathModel: {
      kind: "TRAIN_CROSSING",
      len1,
      len2: R(0),
      v1Kmh: R(trainKmh),
      v2Kmh: R(manKmh),
      direction: isOpposite ? "OPPOSITE" : "SAME",
      solveFor: "TIME_SEC",
    },
    exactRationalAnswer: timeSec,
    plausible: [timeSec.add(R(2)), timeSec.sub(R(2)), len1.div(kmhToMs(R(trainKmh))), timeSec.add(R(4))],
    unit: "seconds",
    solution: {
      given_data: `Train length = ${len1.toExamString()} m, Train speed = ${trainKmh} km/h, Man's speed = ${manKmh} km/h (${isOpposite ? "Opposite" : "Same"})`,
      formula: `Relative Speed = Train Speed ${isOpposite ? "+" : "−"} Man's Speed; Time = Length / Relative Speed (m/s)`,
      steps: [
        `Relative Speed = ${trainKmh} ${isOpposite ? "+" : "−"} ${manKmh} = ${relKmh} km/h`,
        `Convert to m/s: ${relKmh} × (5/18) = ${relMs.toExamString()} m/s`,
        `Time = ${len1.toExamString()} / ${relMs.toExamString()} = ${timeSec.toExamString()} seconds`,
      ],
      final_answer: `${timeSec.toExamString()} seconds`,
    },
    shortcut_method: `Combine speeds first (${relKmh} km/h = ${relMs.toExamString()} m/s), then divide ${len1.toExamString()} by ${relMs.toExamString()}.`,
    rng,
  });
}

function genD5_TwoTrainsCrossing(rng, difficulty) {
  const isOpposite = rng.random() < 0.5;
  const v2Kmh = rng.pick([36, 45, 54]);
  const relKmh = isOpposite ? rng.pick([90, 108, 126, 144]) : rng.pick([18, 36, 54]);
  const v1Kmh = isOpposite ? relKmh - v2Kmh : v2Kmh + relKmh;
  const relMs = kmhToMs(R(relKmh));
  const timeSec = R(rng.pick([10, 12, 14, 15, 16, 18, 20]));
  const totalLen = relMs.mul(timeSec);
  const len1 = R(Math.round((totalLen.toNumber() * 0.55) / 10) * 10);
  const len2 = totalLen.sub(len1);

  return makeQuestion({
    templateId: `TSD_D5_TWO_TRAINS_${isOpposite ? "OPP" : "SAME"}`,
    category: "D. Problems on Trains",
    sub_type: `Two Trains Crossing (${isOpposite ? "Opposite" : "Same"} Direction)`,
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains", "SBI PO Mains"],
    question_text: `Two trains of lengths ${len1.toExamString()} m and ${len2.toExamString()} m are running on parallel tracks at speeds of ${v1Kmh} km/h and ${v2Kmh} km/h respectively in ${isOpposite ? "opposite directions" : "the same direction"}. How many seconds will they take to cross each other completely?`,
    mathModel: {
      kind: "TRAIN_CROSSING",
      len1,
      len2,
      v1Kmh: R(v1Kmh),
      v2Kmh: R(v2Kmh),
      direction: isOpposite ? "OPPOSITE" : "SAME",
      solveFor: "TIME_SEC",
    },
    exactRationalAnswer: timeSec,
    plausible: [timeSec.add(R(3)), timeSec.sub(R(2)), timeSec.add(R(5)), len1.div(relMs)],
    unit: "seconds",
    solution: {
      given_data: `L₁ = ${len1.toExamString()} m, L₂ = ${len2.toExamString()} m, S₁ = ${v1Kmh} km/h, S₂ = ${v2Kmh} km/h (${isOpposite ? "Opposite" : "Same"})`,
      formula: "Time = (L₁ + L₂) / Relative Speed (in m/s)",
      steps: [
        `Total distance = ${len1.toExamString()} + ${len2.toExamString()} = ${totalLen.toExamString()} m`,
        `Relative Speed = ${v1Kmh} ${isOpposite ? "+" : "−"} ${v2Kmh} = ${relKmh} km/h = ${relMs.toExamString()} m/s`,
        `Time = ${totalLen.toExamString()} / ${relMs.toExamString()} = ${timeSec.toExamString()} seconds`,
      ],
      final_answer: `${timeSec.toExamString()} seconds`,
    },
    shortcut_method: `Lengths always add (${totalLen.toExamString()} m); speeds ${isOpposite ? "add" : "subtract"} (${relMs.toExamString()} m/s).`,
    rng,
  });
}

// ============================================================================
// CATEGORY E: Boats & Streams (E1 - E5)
// ============================================================================

function genE1_DownUpSpeed(rng, difficulty) {
  const askDown = rng.random() < 0.5;
  const boat = rng.pick([10, 12, 14, 15, 16, 18, 20]);
  const stream = rng.pick([2, 3, 4, 5]);
  const ans = askDown ? R(boat + stream) : R(boat - stream);
  const oppositeAns = askDown ? R(boat - stream) : R(boat + stream);

  return makeQuestion({
    templateId: `TSD_E1_${askDown ? "DOWN" : "UP"}_SPEED`,
    category: "E. Boats & Streams",
    sub_type: askDown ? "Downstream Speed" : "Upstream Speed",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS RRB Clerk", "SBI Clerk Prelims"],
    question_text: `The speed of a boat in still water is ${boat} km/h and the speed of the stream is ${stream} km/h. What is the ${askDown ? "downstream" : "upstream"} speed of the boat?`,
    mathModel: {
      kind: "BOAT_STREAM",
      boatSpeed: R(boat),
      streamSpeed: R(stream),
      solveFor: askDown ? "DOWNSTREAM_SPEED" : "UPSTREAM_SPEED",
    },
    exactRationalAnswer: ans,
    plausible: [oppositeAns, ans.add(R(2)), ans.sub(R(2)), R(boat)],
    unit: "km/h",
    solution: {
      given_data: `Boat speed (B) = ${boat} km/h, Stream speed (S) = ${stream} km/h`,
      formula: askDown ? "Downstream Speed = B + S" : "Upstream Speed = B − S",
      steps: [
        askDown ? `Downstream Speed = ${boat} + ${stream} = ${boat + stream} km/h` : `Upstream Speed = ${boat} − ${stream} = ${boat - stream} km/h`,
      ].concat([`Verified speed = ${ans.toExamString()} km/h`]),
      final_answer: `${ans.toExamString()} km/h`,
    },
    shortcut_method: askDown ? `Add boat and stream speeds: ${boat} + ${stream} = ${boat + stream} km/h.` : `Subtract stream from boat speed: ${boat} − ${stream} = ${boat - stream} km/h.`,
    rng,
  });
}

function genE2_BoatOrStreamSpeed(rng, difficulty) {
  const askBoat = rng.random() < 0.5;
  const boat = rng.pick([11, 13, 14, 15, 16, 18, 20]);
  const stream = rng.pick([2, 3, 4, 5, 6]);
  const down = boat + stream;
  const up = boat - stream;
  const ans = askBoat ? R(boat) : R(stream);

  return makeQuestion({
    templateId: `TSD_E2_FIND_${askBoat ? "BOAT" : "STREAM"}_SPEED`,
    category: "E. Boats & Streams",
    sub_type: askBoat ? "Find Boat Speed in Still Water" : "Find Speed of Stream",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question_text: `A boat travels downstream at ${down} km/h and upstream at ${up} km/h. Find the speed of the ${askBoat ? "boat in still water" : "stream"}.`,
    mathModel: {
      kind: "BOAT_STREAM",
      boatSpeed: R(boat),
      streamSpeed: R(stream),
      solveFor: askBoat ? "BOAT_SPEED" : "STREAM_SPEED",
    },
    exactRationalAnswer: ans,
    plausible: [askBoat ? R(stream) : R(boat), ans.add(R(2)), ans.sub(R(1)), R(down - up)],
    unit: "km/h",
    solution: {
      given_data: `Downstream speed (D) = ${down} km/h, Upstream speed (U) = ${up} km/h`,
      formula: askBoat ? "Boat Speed = (D + U) / 2" : "Stream Speed = (D − U) / 2",
      steps: [
        askBoat ? `Boat Speed = (${down} + ${up}) / 2 = ${down + up} / 2` : `Stream Speed = (${down} − ${up}) / 2 = ${down - up} / 2`,
        `Result = ${ans.toExamString()} km/h`,
      ],
      final_answer: `${ans.toExamString()} km/h`,
    },
    shortcut_method: askBoat ? `Average of D and U: (${down}+${up})/2 = ${boat} km/h.` : `Half the difference of D and U: (${down}−${up})/2 = ${stream} km/h.`,
    rng,
  });
}

function genE3_BoatTime(rng, difficulty) {
  const isUp = rng.random() < 0.5;
  const boat = rng.pick([12, 14, 15, 16, 18, 20]);
  const stream = rng.pick([2, 3, 4, 5]);
  const effSpeed = isUp ? boat - stream : boat + stream;
  const time = difficulty === "Easy" ? R(rng.pick([2, 3, 4, 5])) : R(rng.pick([5, 7, 9]), 2);
  const dist = R(effSpeed).mul(time);

  return makeQuestion({
    templateId: `TSD_E3_${isUp ? "UP" : "DOWN"}_TIME`,
    category: "E. Boats & Streams",
    sub_type: isUp ? "Upstream Travel Time" : "Downstream Travel Time",
    difficulty,
    exam_suitability: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
    question_text: `A motorboat whose speed in still water is ${boat} km/h travels ${dist.toExamString()} km ${isUp ? "upstream" : "downstream"} in a river flowing at ${stream} km/h. How much time does it take?`,
    mathModel: {
      kind: "BOAT_STREAM",
      boatSpeed: R(boat),
      streamSpeed: R(stream),
      distDown: isUp ? R(0) : dist,
      distUp: isUp ? dist : R(0),
      solveFor: isUp ? "UPSTREAM_TIME" : "DOWNSTREAM_TIME",
    },
    exactRationalAnswer: time,
    plausible: [time.add(R(1)), time.sub(R(1, 2)), dist.div(R(boat)), time.add(R(1, 2))],
    unit: "hours",
    solution: {
      given_data: `Boat speed = ${boat} km/h, Stream speed = ${stream} km/h, Distance = ${dist.toExamString()} km`,
      formula: `Time = Distance / (${isUp ? "Boat − Stream" : "Boat + Stream"})`,
      steps: [
        `${isUp ? "Upstream" : "Downstream"} Speed = ${boat} ${isUp ? "−" : "+"} ${stream} = ${effSpeed} km/h`,
        `Time = ${dist.toExamString()} / ${effSpeed} = ${time.toExamString()} hours`,
      ],
      final_answer: `${time.toExamString()} hours`,
    },
    shortcut_method: `Effective speed is ${effSpeed} km/h; divide ${dist.toExamString()} by ${effSpeed}.`,
    rng,
  });
}

function genE4_BoatRoundTrip(rng, difficulty) {
  const configs = [
    [12, 3, 45], // down 15 (3h), up 9 (5h) => 8h
    [15, 3, 72], // down 18 (4h), up 12 (6h) => 10h
    [10, 2, 48], // down 12 (4h), up 8 (6h) => 10h
    [14, 2, 48], // down 16 (3h), up 12 (4h) => 7h
    [16, 4, 60], // down 20 (3h), up 12 (5h) => 8h
    [18, 6, 72], // down 24 (3h), up 12 (6h) => 9h
    [15, 5, 40], // down 20 (2h), up 10 (4h) => 6h
  ];
  const [boat, stream, dist] = rng.pick(configs);
  const down = boat + stream;
  const up = boat - stream;
  const tDown = R(dist, down);
  const tUp = R(dist, up);
  const totalTime = tDown.add(tUp);

  return makeQuestion({
    templateId: "TSD_E4_BOAT_ROUND_TRIP",
    category: "E. Boats & Streams",
    sub_type: "Round-Trip Boat Journey",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains", "SBI PO Mains"],
    question_text: `A boat can row at ${boat} km/h in still water. If the river flows at ${stream} km/h, find the total time taken by the boat to go ${dist} km downstream and return ${dist} km upstream to the starting point.`,
    mathModel: {
      kind: "BOAT_STREAM",
      boatSpeed: R(boat),
      streamSpeed: R(stream),
      distDown: R(dist),
      distUp: R(dist),
      solveFor: "ROUND_TRIP_TIME",
    },
    exactRationalAnswer: totalTime,
    plausible: [R(2 * dist, boat), totalTime.add(R(1)), totalTime.sub(R(1)), totalTime.add(R(2))],
    unit: "hours",
    solution: {
      given_data: `Boat speed = ${boat} km/h, Stream speed = ${stream} km/h, One-way distance = ${dist} km`,
      formula: "Total Time = D / (B + S) + D / (B − S)",
      steps: [
        `Downstream speed = ${boat} + ${stream} = ${down} km/h ⇒ Downstream time = ${dist} / ${down} = ${tDown.toExamString()} hr`,
        `Upstream speed = ${boat} − ${stream} = ${up} km/h ⇒ Upstream time = ${dist} / ${up} = ${tUp.toExamString()} hr`,
        `Total Time = ${tDown.toExamString()} + ${tUp.toExamString()} = ${totalTime.toExamString()} hours`,
      ],
      final_answer: `${totalTime.toExamString()} hours`,
    },
    shortcut_method: `Total Time = (2 × D × B) / (B² − S²) = ${2 * dist * boat} / ${boat * boat - stream * stream} = ${totalTime.toExamString()} hours.`,
    rng,
  });
}

function genE5_FloatingObject(rng, difficulty) {
  const boat = rng.pick([12, 15, 18, 20]);
  const stream = rng.pick([3, 4, 5, 6]);
  const time = R(rng.pick([3, 4, 5, 6]));
  const dist = R(stream).mul(time);

  return makeQuestion({
    templateId: "TSD_E5_FLOATING_OBJECT",
    category: "E. Boats & Streams",
    sub_type: "Floating Object Drift Problem",
    difficulty,
    exam_suitability: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS RRB PO"],
    question_text: `A boat's speed in still water is ${boat} km/h and its downstream speed is ${boat + stream} km/h. How many hours will a wooden log floating freely with the river current take to travel ${dist.toExamString()} km?`,
    mathModel: {
      kind: "BOAT_STREAM",
      boatSpeed: R(boat),
      streamSpeed: R(stream),
      distDown: dist,
      solveFor: "FLOATING_TIME",
    },
    exactRationalAnswer: time,
    plausible: [time.add(R(1)), time.sub(R(1)), dist.div(R(boat)), dist.div(R(boat + stream))],
    unit: "hours",
    solution: {
      given_data: `Boat speed = ${boat} km/h, Downstream speed = ${boat + stream} km/h, Distance = ${dist.toExamString()} km`,
      formula: "Floating Object Speed = Stream Speed = Downstream Speed − Boat Speed",
      steps: [
        `Stream speed = ${boat + stream} − ${boat} = ${stream} km/h`,
        `A freely floating log moves solely at the stream's speed (${stream} km/h)`,
        `Time taken = ${dist.toExamString()} / ${stream} = ${time.toExamString()} hours`,
      ],
      final_answer: `${time.toExamString()} hours`,
    },
    shortcut_method: `A floating object has zero self-speed; divide ${dist.toExamString()} km by stream speed (${stream} km/h).`,
    rng,
  });
}

export const TSD_TEMPLATES_PART_1 = [
  { id: "TSD_A1", category: "A", difficulties: ["Easy", "Medium"], fn: genA1_FindSpeed },
  { id: "TSD_A2", category: "A", difficulties: ["Easy", "Medium"], fn: genA2_FindDistance },
  { id: "TSD_A3", category: "A", difficulties: ["Easy", "Medium"], fn: genA3_FindTime },
  { id: "TSD_A4", category: "A", difficulties: ["Easy", "Medium"], fn: genA4_UnitConversion },
  { id: "TSD_A5", category: "A", difficulties: ["Easy", "Medium", "Hard"], fn: genA5_SpeedTimeRatio },
  { id: "TSD_A6", category: "A", difficulties: ["Easy", "Medium"], fn: genA6_DistanceRatio },

  { id: "TSD_B1", category: "B", difficulties: ["Easy", "Medium", "Hard"], fn: genB1_AvgSpeedEqualDistance },
  { id: "TSD_B2", category: "B", difficulties: ["Easy", "Medium", "Hard"], fn: genB2_AvgSpeedEqualTime },
  { id: "TSD_B3", category: "B", difficulties: ["Easy", "Medium", "Hard"], fn: genB3_AvgSpeedDifferentStages },
  { id: "TSD_B4", category: "B", difficulties: ["Medium", "Hard"], fn: genB4_AvgSpeedWithStoppage },
  { id: "TSD_B5", category: "B", difficulties: ["Medium", "Hard"], fn: genB5_MissingSpeedFromAvg },

  { id: "TSD_C1", category: "C", difficulties: ["Easy", "Medium"], fn: genC1_OppositeMeetingTime },
  { id: "TSD_C2", category: "C", difficulties: ["Easy", "Medium", "Hard"], fn: genC2_OppositeMeetingDistance },
  { id: "TSD_C3", category: "C", difficulties: ["Easy", "Medium"], fn: genC3_SameDirectionCatchUp },
  { id: "TSD_C4", category: "C", difficulties: ["Medium", "Hard"], fn: genC4_HeadStartCatchUp },
  { id: "TSD_C5", category: "C", difficulties: ["Medium", "Hard"], fn: genC5_OppositeDelayedStart },

  { id: "TSD_D1", category: "D", difficulties: ["Easy", "Medium"], fn: genD1_TrainCrossingPole },
  { id: "TSD_D2", category: "D", difficulties: ["Easy", "Medium"], fn: genD2_TrainCrossingPlatform },
  { id: "TSD_D3", category: "D", difficulties: ["Medium", "Hard"], fn: genD3_FindPlatformLength },
  { id: "TSD_D4", category: "D", difficulties: ["Medium", "Hard"], fn: genD4_TrainCrossingWalkingMan },
  { id: "TSD_D5", category: "D", difficulties: ["Medium", "Hard"], fn: genD5_TwoTrainsCrossing },

  { id: "TSD_E1", category: "E", difficulties: ["Easy"], fn: genE1_DownUpSpeed },
  { id: "TSD_E2", category: "E", difficulties: ["Easy", "Medium"], fn: genE2_BoatOrStreamSpeed },
  { id: "TSD_E3", category: "E", difficulties: ["Easy", "Medium"], fn: genE3_BoatTime },
  { id: "TSD_E4", category: "E", difficulties: ["Medium", "Hard"], fn: genE4_BoatRoundTrip },
  { id: "TSD_E5", category: "E", difficulties: ["Medium", "Hard"], fn: genE5_FloatingObject },
];