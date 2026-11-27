/**
 * Modular Banking Exam Direction & Distance Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam subtopics:
 * 1. PATH_SHORTEST_DISTANCE — Multi-turn walk with exact Pythagorean shortest distance & compass direction
 * 2. RELATIVE_POINTS        — Multi-point relative grid (direction, shortest distance, odd-one-out pair)
 * 3. CODED_DIRECTION        — PO Mains / Hard Prelims coded directional operators with optional offset rule
 * 4. SHADOW_DIRECTION       — Sunrise / Sunset shadow direction problems (facing each other or pole)
 * 5. ANGULAR_ROTATION       — Clockwise / Anticlockwise 45°–270° compass rotation problems
 */

import {
  CARDINAL_ORDER,
  COMPASS_8,
  compassDirectionFromTo,
  exactDistanceSquared,
  formatExactDistance,
  solveAngularRotation,
  solveObserverFacingFromShadow,
  solvePath,
  solveRelativePoints,
  turnCardinal,
} from "./solver.js";

export const DIRECTION_SUBTOPICS = {
  PATH_SHORTEST_DISTANCE: "Multi-Turn Path & Shortest Distance",
  RELATIVE_POINTS: "Point-to-Point Relative Grid",
  CODED_DIRECTION: "Coded Direction & Distance",
  SHADOW_DIRECTION: "Shadow & Sunrise/Sunset Direction",
  ANGULAR_ROTATION: "Angular Rotation & Compass Turns",
};

export function createDirectionRng(seedInput) {
  let state = (Number(seedInput) || Date.now()) >>> 0;
  if (state === 0) state = 0x9e3779b9;
  const rng = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.seed = state;
  rng.int = (min, max) => min + Math.floor(rng() * (max - min + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  return rng;
}

const NAMES = [
  "Aarav", "Priya", "Rohan", "Kavya", "Vikram", "Neha", "Arjun", "Meera",
  "Siddharth", "Ananya", "Karthik", "Divya", "Rahul", "Sneha", "Nikhil", "Pooja",
];

const PYTHAGOREAN_PAIRS = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [8, 15, 17],
  [9, 12, 15],
  [7, 24, 25],
  [12, 16, 20],
];

function shuffleOptionsWithAnswer(correctText, distractorTexts, rng) {
  const unique = new Set([correctText]);
  const pool = [];
  for (const d of distractorTexts) {
    if (d && !unique.has(d)) {
      unique.add(d);
      pool.push(d);
    }
    if (pool.length === 4) break;
  }
  if (pool.length < 4) return null;
  const all = rng.shuffle([correctText, ...pool]);
  const correctIndex = all.indexOf(correctText);
  return {
    options: all,
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
  };
}

function buildDistanceDistractors(distSq, rng) {
  const root = Math.round(Math.sqrt(distSq));
  if (root * root === distSq) {
    const candidates = [root - 2, root - 1, root + 1, root + 2, root + 3, root + 4]
      .filter((v) => v > 0 && v !== root)
      .map((v) => `${v} m`);
    return rng.shuffle(candidates);
  }
  const candidates = [distSq - 6, distSq - 2, distSq + 2, distSq + 4, distSq + 8]
    .filter((v) => v > 1 && v !== distSq)
    .map((v) => formatExactDistance(v));
  return rng.shuffle(candidates);
}

/**
 * 1. Multi-Turn Path & Shortest Distance Builder
 */
export function buildPathShortestDistanceQuestion({ difficulty = "Medium", rng }) {
  const person = rng.pick(NAMES);
  const initialDir = rng.pick(CARDINAL_ORDER);
  const [a, b] = rng.pick(PYTHAGOREAN_PAIRS);
  const [leg1, leg2] = rng() < 0.5 ? [a, b] : [b, a];

  // Construct a realistic 4-step (Easy) or 5-step (Medium/Hard) path whose net displacement is (leg1, leg2) along perpendicular axes
  const extra1 = rng.int(3, 8);
  const extra2 = rng.int(2, 7);
  const turnA = rng() < 0.5 ? "RIGHT" : "LEFT";
  const oppTurn = turnA === "RIGHT" ? "LEFT" : "RIGHT";

  // Walk sequence:
  // Step 0: initialDir by (leg1 + extra1)
  // Step 1: turnA by (leg2 + extra2)
  // Step 2: turnA by extra1  -> now facing opposite of initialDir, net along initialDir = leg1
  // Step 3: turnA by extra2  -> now facing opposite of step 1, net along step 1 = leg2
  // Optional Hard Step 4 & 5 detour
  const steps =
    difficulty === "Easy"
      ? [
          { turn: "START", initialDir, distance: leg1 },
          { turn: turnA, distance: leg2 },
        ]
      : difficulty === "Medium"
        ? [
            { turn: "START", initialDir, distance: leg1 + extra1 },
            { turn: turnA, distance: leg2 },
            { turn: turnA, distance: extra1 },
          ]
        : [
            { turn: "START", initialDir, distance: leg1 + extra1 },
            { turn: turnA, distance: leg2 + extra2 },
            { turn: turnA, distance: extra1 },
            { turn: turnA, distance: extra2 },
          ];

  // For Easy, add a 3rd step so it's not trivially 2 steps
  if (difficulty === "Easy") {
    const ext = rng.int(2, 6);
    steps[0].distance = leg1 + ext;
    steps.push({ turn: turnA, distance: ext });
  }

  const solved = solvePath(steps);
  if (solved.distSq === 0) return null;

  const askBoth = difficulty !== "Easy" && rng() < 0.55;
  const askDirOnly = !askBoth && rng() < 0.4;

  const sentences = steps.map((st, idx) => {
    if (idx === 0) {
      return `${person} starts from Point P and walks ${st.distance} m towards the ${st.initialDir}.`;
    }
    const turnWord = st.turn === "RIGHT" ? "right" : "left";
    const connector = idx === steps.length - 1 ? "Finally, he/she turns" : "Then, he/she turns";
    return `${connector} ${turnWord} and walks ${st.distance} m${idx === steps.length - 1 ? " to reach Point Q" : ""}.`;
  });

  let questionLine = "";
  let correctText = "";
  let distractors = [];
  let queryType = "";

  if (askBoth) {
    queryType = "DIST_AND_DIR";
    questionLine = `How far and in which direction is Point Q with respect to the starting Point P?`;
    correctText = `${solved.distanceLabel}, ${solved.directionEndFromStart}`;
    const distD = buildDistanceDistractors(solved.distSq, rng);
    const otherDirs = rng.shuffle(COMPASS_8.filter((d) => d !== solved.directionEndFromStart));
    distractors = [
      `${solved.distanceLabel}, ${otherDirs[0]}`,
      `${distD[0]}, ${solved.directionEndFromStart}`,
      `${distD[1]}, ${otherDirs[1]}`,
      `${solved.distanceLabel}, ${solved.directionStartFromEnd}`,
      `${distD[2]}, ${otherDirs[2]}`,
    ];
  } else if (askDirOnly) {
    queryType = "DIR_ONLY";
    const askStartFromEnd = rng() < 0.5;
    if (askStartFromEnd) {
      questionLine = `In which direction is the starting Point P with respect to the final Point Q?`;
      correctText = solved.directionStartFromEnd;
      queryType = "DIR_START_FROM_END";
    } else {
      questionLine = `In which direction is the final Point Q with respect to the starting Point P?`;
      correctText = solved.directionEndFromStart;
      queryType = "DIR_END_FROM_START";
    }
    distractors = rng.shuffle(COMPASS_8.filter((d) => d !== correctText)).slice(0, 4);
  } else {
    queryType = "DIST_ONLY";
    questionLine = `What is the shortest distance between Point P and Point Q?`;
    correctText = solved.distanceLabel;
    distractors = buildDistanceDistractors(solved.distSq, rng);
  }

  const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
  if (!packed) return null;

  const dx = solved.end.x - solved.start.x;
  const dy = solved.end.y - solved.start.y;
  const explanation =
    `Taking Point P as (0, 0), tracing each turn places Point Q at (${dx}, ${dy}). ` +
    `Net horizontal displacement = ${Math.abs(dx)} m (${dx >= 0 ? "East" : "West"}), vertical displacement = ${Math.abs(dy)} m (${dy >= 0 ? "North" : "South"}). ` +
    `Shortest distance = √(${dx}² + ${dy}²) = ${solved.distanceLabel}, and Q is ${solved.directionEndFromStart} of P (P is ${solved.directionStartFromEnd} of Q).`;

  return {
    topic: "Direction & Distance",
    subType: "PATH_SHORTEST_DISTANCE",
    subtopicName: DIRECTION_SUBTOPICS.PATH_SHORTEST_DISTANCE,
    difficulty,
    questionText: `${sentences.join(" ")}\n\n${questionLine}`,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: "PATH_SHORTEST_DISTANCE",
      steps,
      queryType,
    },
  };
}

/**
 * 2. Point-to-Point Relative Grid Builder
 */
export function buildRelativePointsQuestion({ difficulty = "Medium", rng }) {
  const labels = ["A", "B", "C", "D", "E", "F", "G"];
  const countPts = difficulty === "Easy" ? 5 : difficulty === "Medium" ? 6 : 7;
  const pts = labels.slice(0, countPts);

  // Build a non-overlapping relative grid using clean banking distances
  const [pa, pb] = rng.pick(PYTHAGOREAN_PAIRS.slice(0, 5));
  const relations = [];
  const dirCycle = rng.shuffle(CARDINAL_ORDER);

  // First 2 hops form an exact Pythagorean right triangle between pts[0] and pts[2]
  const d0 = dirCycle[0];
  const d1 = turnCardinal(d0, rng() < 0.5 ? "RIGHT" : "LEFT");
  relations.push({ point: pts[1], ref: pts[0], dir: d0, dist: pa });
  relations.push({ point: pts[2], ref: pts[1], dir: d1, dist: pb });

  for (let i = 3; i < countPts; i++) {
    const ref = pts[i - 1];
    const prevDir = relations[relations.length - 1].dir;
    const nextDir = turnCardinal(prevDir, rng() < 0.5 ? "RIGHT" : "LEFT");
    const dist = rng.int(3, 12);
    relations.push({ point: pts[i], ref, dir: nextDir, dist });
  }

  const coords = solveRelativePoints(pts[0], relations);
  // Ensure no two points share identical coordinates
  const coordKeys = new Set(Object.values(coords).map((c) => `${c.x},${c.y}`));
  if (coordKeys.size !== countPts) return null;

  const clues = relations
    .map((r) => `Point ${r.point} is ${r.dist} m to the ${r.dir} of Point ${r.ref}.`)
    .join(" ");

  const askDist = rng() < 0.5;
  let questionLine = "";
  let correctText = "";
  let distractors = [];
  let queryMeta = {};

  if (askDist) {
    // Ask shortest distance between pts[0] and pts[2] (guaranteed clean Pythagorean integer!)
    const fromP = pts[0];
    const toP = pts[2];
    const dSq = exactDistanceSquared(coords[fromP], coords[toP]);
    questionLine = `What is the shortest distance between Point ${fromP} and Point ${toP}?`;
    correctText = formatExactDistance(dSq);
    distractors = buildDistanceDistractors(dSq, rng);
    queryMeta = { mode: "DISTANCE", from: fromP, to: toP };
  } else {
    // Pick a non-adjacent pair with a clear 8-point compass direction
    const fromP = pts[0];
    const toP = pts[countPts - 1];
    const dir = compassDirectionFromTo(coords[fromP], coords[toP]);
    if (dir === "Same Point") return null;
    questionLine = `In which direction is Point ${toP} with respect to Point ${fromP}?`;
    correctText = dir;
    distractors = rng.shuffle(COMPASS_8.filter((d) => d !== dir)).slice(0, 4);
    queryMeta = { mode: "DIRECTION", from: fromP, to: toP };
  }

  const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
  if (!packed) return null;

  const coordSummary = pts.map((p) => `${p}(${coords[p].x}, ${coords[p].y})`).join(", ");
  const explanation =
    `Assigning ${pts[0]}(0, 0), the coordinates are: ${coordSummary}. ` +
    (queryMeta.mode === "DISTANCE"
      ? `Shortest distance between ${queryMeta.from} and ${queryMeta.to} = √(${pa}² + ${pb}²) = ${correctText}.`
      : `Comparing ${queryMeta.to} relative to ${queryMeta.from} gives ${correctText}.`);

  return {
    topic: "Direction & Distance",
    subType: "RELATIVE_POINTS",
    subtopicName: DIRECTION_SUBTOPICS.RELATIVE_POINTS,
    difficulty,
    questionText: `Directions: Study the following information carefully and answer the question given below.\n${clues}\n\n${questionLine}`,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: "RELATIVE_POINTS",
      anchor: pts[0],
      relations,
      queryMeta,
    },
  };
}

/**
 * 3. Coded Direction & Distance Builder (PO Mains / Hard Prelims)
 */
export function buildCodedDirectionQuestion({ difficulty = "Hard", rng }) {
  const syms = rng.shuffle(["@", "#", "$", "%", "&", "*"]).slice(0, 4);
  const symToDir = {
    [syms[0]]: "North",
    [syms[1]]: "South",
    [syms[2]]: "East",
    [syms[3]]: "West",
  };
  const dirToSym = {
    North: syms[0],
    South: syms[1],
    East: syms[2],
    West: syms[3],
  };

  // Hard mode adds a banking distance offset rule: e.g. actual distance = (n + 2) m
  const offset = difficulty === "Hard" ? rng.pick([2, 3]) : 0;
  const [pa, pb] = rng.pick(PYTHAGOREAN_PAIRS.slice(0, 5));
  const pts = ["P", "Q", "R", "S", "T"];

  const d0 = rng.pick(["North", "South"]);
  const d1 = rng.pick(["East", "West"]);
  const d2 = d0 === "North" ? "South" : "North";
  const d3 = d1 === "East" ? "West" : "East";

  const extraDist = rng.int(3, 8);
  const relations = [
    { point: "Q", ref: "P", dir: d0, dist: pa },
    { point: "R", ref: "Q", dir: d1, dist: pb },
    { point: "S", ref: "R", dir: d2, dist: pa + extraDist },
    { point: "T", ref: "S", dir: d3, dist: pb },
  ];

  // Check coded numbers stay positive
  for (const r of relations) {
    if (r.dist - offset <= 0) return null;
  }

  const coords = solveRelativePoints("P", relations);
  const coordKeys = new Set(Object.values(coords).map((c) => `${c.x},${c.y}`));
  if (coordKeys.size !== pts.length) return null;

  const legend = Object.entries(symToDir)
    .map(([sym, dir]) =>
      offset > 0
        ? `'A ${sym} B (n)' means 'A is (n + ${offset}) m to the ${dir} of B'`
        : `'A ${sym} B (n)' means 'A is n m to the ${dir} of B'`,
    )
    .join("\n");

  const exprParts = relations.map(
    (r) => `${r.point} ${dirToSym[r.dir]} ${r.ref} (${r.dist - offset})`,
  );

  const askDistance = rng() < 0.55;
  let questionLine = "";
  let correctText = "";
  let distractors = [];
  let queryMeta = {};

  if (askDistance) {
    const dSq = exactDistanceSquared(coords.P, coords.R);
    questionLine = `In the expression '${exprParts.join(", ")}', what is the shortest distance between Point P and Point R?`;
    correctText = formatExactDistance(dSq);
    distractors = buildDistanceDistractors(dSq, rng);
    queryMeta = { mode: "DISTANCE", from: "P", to: "R" };
  } else {
    const dir = compassDirectionFromTo(coords.Q, coords.T);
    if (dir === "Same Point") return null;
    questionLine = `In the expression '${exprParts.join(", ")}', in which direction is Point T with respect to Point Q?`;
    correctText = dir;
    distractors = rng.shuffle(COMPASS_8.filter((d) => d !== dir)).slice(0, 4);
    queryMeta = { mode: "DIRECTION", from: "Q", to: "T" };
  }

  const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
  if (!packed) return null;

  const decodedText = relations
    .map((r) => `${r.point} is ${r.dist} m ${r.dir} of ${r.ref}`)
    .join("; ");

  const explanation =
    `Decoding each coded relation${offset > 0 ? ` (adding +${offset} m per rule)` : ""}: ${decodedText}. ` +
    (queryMeta.mode === "DISTANCE"
      ? `Thus P–Q–R forms a right triangle with legs ${pa} m and ${pb} m, giving shortest distance = ${correctText}.`
      : `Plotting coordinates gives Point T in the ${correctText} direction with respect to Point Q.`);

  return {
    topic: "Direction & Distance",
    subType: "CODED_DIRECTION",
    subtopicName: DIRECTION_SUBTOPICS.CODED_DIRECTION,
    difficulty,
    questionText: `Directions: Study the following coded information carefully and answer the question given below.\n${legend}\n\n${questionLine}`,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: "CODED_DIRECTION",
      anchor: "P",
      relations,
      offset,
      queryMeta,
    },
  };
}

/**
 * 4. Shadow & Sunrise/Sunset Direction Builder
 */
export function buildShadowDirectionQuestion({ difficulty = "Easy", rng }) {
  const [p1, p2] = rng.shuffle(NAMES).slice(0, 2);
  const timeOfDay = rng() < 0.5 ? "MORNING" : "EVENING";
  const timePhrase =
    timeOfDay === "MORNING"
      ? "One morning after sunrise"
      : "One evening just before sunset";
  const shadowDir = timeOfDay === "MORNING" ? "West" : "East";

  const sideChoices = difficulty === "Easy" ? ["LEFT", "RIGHT"] : ["LEFT", "RIGHT", "FRONT", "BEHIND"];
  const relativeSide = rng.pick(sideChoices);
  const sideText =
    relativeSide === "LEFT"
      ? "exact left"
      : relativeSide === "RIGHT"
        ? "exact right"
        : relativeSide === "FRONT"
          ? "front"
          : "back";

  // Person whose side is referenced is the observer
  const refIsP2 = rng() < 0.5;
  const observerFacing = solveObserverFacingFromShadow(timeOfDay, relativeSide);
  const otherFacing = turnCardinal(observerFacing, "BACK");

  const askP1 = rng() < 0.5;
  const targetPerson = askP1 ? p1 : p2;
  const correctDir = refIsP2
    ? askP1
      ? otherFacing
      : observerFacing
    : askP1
      ? observerFacing
      : otherFacing;

  const refPerson = refIsP2 ? p2 : p1;
  const shadowOwner = rng() < 0.5 ? p1 : p2;

  const questionText =
    `${timePhrase}, ${p1} and ${p2} were talking to each other face to face at a crossing. ` +
    `If ${shadowOwner}'s shadow fell directly to the ${sideText} of ${refPerson}, which direction was ${targetPerson} facing?`;

  const otherDirs = rng.shuffle(COMPASS_8.filter((d) => d !== correctDir));
  const cardinalDistractors = CARDINAL_ORDER.filter((d) => d !== correctDir);
  const distractors = [...cardinalDistractors, otherDirs.find((d) => !cardinalDistractors.includes(d))];

  const packed = shuffleOptionsWithAnswer(correctDir, distractors, rng);
  if (!packed) return null;

  const explanation =
    `In the ${timeOfDay.toLowerCase()}, the sun is in the ${timeOfDay === "MORNING" ? "East" : "West"}, so all shadows fall towards the ${shadowDir}. ` +
    `Since the shadow fell to the ${sideText} of ${refPerson}, ${refPerson} must be facing ${observerFacing}. ` +
    `Because ${p1} and ${p2} are facing each other, ${targetPerson} was facing ${correctDir}.`;

  return {
    topic: "Direction & Distance",
    subType: "SHADOW_DIRECTION",
    subtopicName: DIRECTION_SUBTOPICS.SHADOW_DIRECTION,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: "SHADOW_DIRECTION",
      timeOfDay,
      relativeSide,
      targetSameAsRef: targetPerson === refPerson,
    },
  };
}

/**
 * 5. Angular Rotation & Compass Turns Builder
 */
export function buildAngularRotationQuestion({ difficulty = "Easy", rng }) {
  const person = rng.pick(NAMES);
  const startDirection = rng.pick(COMPASS_8);
  const turnCount = difficulty === "Easy" ? 2 : difficulty === "Medium" ? 3 : 4;
  const degPool = [45, 90, 135, 180, 225, 270];

  const turns = [];
  for (let i = 0; i < turnCount; i++) {
    const dir = i % 2 === 0 ? "CW" : "ACW";
    const deg = rng.pick(degPool);
    turns.push({ dir, deg });
  }

  const solved = solveAngularRotation(startDirection, turns);
  const turnClauses = turns.map((t, i) => {
    const label = t.dir === "CW" ? "clockwise" : "anticlockwise";
    return i === 0
      ? `turns ${t.deg}° ${label}`
      : i === turns.length - 1
        ? `and finally turns ${t.deg}° ${label}`
        : `then turns ${t.deg}° ${label}`;
  });

  const questionText =
    `${person} is facing ${startDirection}. He/she ${turnClauses.join(", ")}. Which direction is ${person} facing now?`;

  const distractors = rng.shuffle(COMPASS_8.filter((d) => d !== solved.finalDirection)).slice(0, 4);
  const packed = shuffleOptionsWithAnswer(solved.finalDirection, distractors, rng);
  if (!packed) return null;

  const netDeg = turns.reduce((acc, t) => acc + (t.dir === "CW" ? t.deg : -t.deg), 0);
  const netLabel =
    netDeg === 0
      ? "0° (no net change)"
      : netDeg > 0
        ? `${netDeg}° clockwise`
        : `${Math.abs(netDeg)}° anticlockwise`;

  const explanation =
    `Net rotation = ${netLabel}. Rotating ${startDirection} by ${netLabel} leads to ${solved.finalDirection}.`;

  return {
    topic: "Direction & Distance",
    subType: "ANGULAR_ROTATION",
    subtopicName: DIRECTION_SUBTOPICS.ANGULAR_ROTATION,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: "ANGULAR_ROTATION",
      startDirection,
      turns,
    },
  };
}
