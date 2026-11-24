// generators/quant/quadraticEquations/index.js
import { randInt, pickRandom } from "../../../core/mathUtils.js";

const QUADRATIC_OPTIONS = [
  "x > y",
  "x ≥ y",
  "x < y",
  "x ≤ y",
  "x = y or the relationship cannot be established",
];

function formatQuadEquation(varName, r1, r2) {
  // Construct (v - r1)(v - r2) = v² - (r1 + r2)v + (r1 * r2) = 0 from exact roots first
  const b = -(r1 + r2);
  const c = r1 * r2;
  const bStr =
    b === 0 ? "" : b > 0 ? ` + ${b === 1 ? "" : b}${varName}` : ` - ${Math.abs(b) === 1 ? "" : Math.abs(b)}${varName}`;
  const cStr = c === 0 ? "" : c > 0 ? ` + ${c}` : ` - ${Math.abs(c)}`;
  return `${varName}²${bStr}${cStr} = 0`;
}

export function generateQuadraticQuestion(exam = "IBPS_PO_PRELIMS", difficulty = "MEDIUM") {
  const range = difficulty === "EASY" ? [1, 9] : difficulty === "HARD" ? [6, 22] : [3, 15];
  const relType = randInt(0, 4); // 0: x > y, 1: x >= y, 2: x < y, 3: x <= y, 4: CND / x = y

  let x1, x2, y1, y2, answerIndex;

  if (relType === 0) {
    // x > y strictly: y1 <= y2 < x1 <= x2
    y1 = randInt(range[0], range[0] + 4);
    y2 = y1 + randInt(1, 3);
    x1 = y2 + randInt(1, 3);
    x2 = x1 + randInt(1, 4);
    answerIndex = 0; // x > y
  } else if (relType === 1) {
    // x >= y: y1 < y2 = x1 < x2
    y1 = randInt(range[0], range[0] + 4);
    y2 = y1 + randInt(1, 4);
    x1 = y2;
    x2 = x1 + randInt(1, 4);
    answerIndex = 1; // x >= y
  } else if (relType === 2) {
    // x < y strictly: x1 <= x2 < y1 <= y2
    x1 = randInt(range[0], range[0] + 4);
    x2 = x1 + randInt(1, 3);
    y1 = x2 + randInt(1, 3);
    y2 = y1 + randInt(1, 4);
    answerIndex = 2; // x < y
  } else if (relType === 3) {
    // x <= y: x1 < x2 = y1 < y2
    x1 = randInt(range[0], range[0] + 4);
    x2 = x1 + randInt(1, 4);
    y1 = x2;
    y2 = y1 + randInt(1, 4);
    answerIndex = 3; // x <= y
  } else {
    // Overlapping roots: x1 < y1 < x2 < y2 -> Cannot be established
    x1 = randInt(range[0], range[0] + 3);
    y1 = x1 + randInt(1, 3);
    x2 = y1 + randInt(1, 3);
    y2 = x2 + randInt(1, 3);
    answerIndex = 4;
  }

  const eq1 = formatQuadEquation("x", x1, x2);
  const eq2 = formatQuadEquation("y", y1, y2);
  const answer = QUADRATIC_OPTIONS[answerIndex];

  return {
    questionId: `QUAD_T1_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Quadratic Equations",
    subType: "TYPE_1_QUADRATIC_COMPARISON",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `I. ${eq1}\nII. ${eq2}`,
    options: [...QUADRATIC_OPTIONS],
    correctOptionIndex: answerIndex,
    answer,
    solutionSteps: [
      `From I: (x - ${x1})(x - ${x2}) = 0 ⇒ x = ${x1}, ${x2}`,
      `From II: (y - ${y1})(y - ${y2}) = 0 ⇒ y = ${y1}, ${y2}`,
      `Comparing all root pairs gives: ${answer}`,
    ],
  };
}

export function generateQuadraticBatch({
  exam = "IBPS_PO_PRELIMS",
  difficulty = "MEDIUM",
  count = 10,
}) {
  const diff =
    difficulty === "AUTO"
      ? pickRandom(["EASY", "MEDIUM", "HARD"])
      : difficulty.toUpperCase();
  return Array.from({ length: count }, () => generateQuadraticQuestion(exam, diff));
}
