// core/distractorEngine.js
import { randInt, shuffle, Fraction } from "./mathUtils.js";

export function buildOptions(
  correctValue,
  type = "INTEGER",
  offsets = [-10, -5, -2, -1, 1, 2, 5, 10],
  decimalPlaces = 2
) {
  const distractors = new Set();

  if (type === "INTEGER") {
    const ans = Number(correctValue);
    const fallbackPool = [
      ...offsets,
      1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 16, 18, 20,
    ];
    let safety = 0;
    while (distractors.size < 4 && safety < 200) {
      safety++;
      const offset = fallbackPool[randInt(0, fallbackPool.length - 1)];
      const candidate = ans + offset;
      if (candidate !== ans && (ans <= 0 || candidate > 0)) {
        distractors.add(String(candidate));
      }
    }
    let step = 1;
    while (distractors.size < 4) {
      const candidate = ans + step;
      if (candidate !== ans && (ans <= 0 || candidate > 0)) {
        distractors.add(String(candidate));
      }
      step++;
    }
    const allOptions = shuffle([String(ans), ...distractors]);
    return {
      options: allOptions,
      correctOptionIndex: allOptions.indexOf(String(ans)),
    };
  }

  if (type === "DECIMAL") {
    const ans = Number(correctValue);
    const correctStr = ans.toFixed(decimalPlaces);
    const scale = Math.pow(10, decimalPlaces);
    const intAns = Math.round(ans * scale);
    const decOffsets = [-100, -50, -20, -10, -5, -2, -1, 1, 2, 5, 10, 20, 50, 100];

    let safety = 0;
    while (distractors.size < 4 && safety < 200) {
      safety++;
      const delta = decOffsets[randInt(0, decOffsets.length - 1)];
      const candidateInt = intAns + delta;
      if (candidateInt > 0 && candidateInt !== intAns) {
        distractors.add((candidateInt / scale).toFixed(decimalPlaces));
      }
    }
    let fallbackStep = 1;
    while (distractors.size < 4) {
      const candidateInt = intAns + fallbackStep;
      if (candidateInt > 0 && candidateInt !== intAns) {
        distractors.add((candidateInt / scale).toFixed(decimalPlaces));
      }
      fallbackStep++;
    }
    const allOptions = shuffle([correctStr, ...distractors]);
    return {
      options: allOptions,
      correctOptionIndex: allOptions.indexOf(correctStr),
    };
  }

  if (type === "FRACTION") {
    const correctStr = correctValue.toExamString();
    let safety = 0;
    while (distractors.size < 4 && safety < 200) {
      safety++;
      const numDelta = randInt(-3, 3) || 1;
      const denDelta = randInt(-2, 2);
      const newDen = Math.max(2, correctValue.den + denDelta);
      const newNum = Math.max(1, correctValue.num + numDelta + (safety > 50 ? safety % 5 : 0));
      const candidate = new Fraction(newNum, newDen).toExamString();
      if (candidate !== correctStr) {
        distractors.add(candidate);
      }
    }
    let step = 1;
    while (distractors.size < 4) {
      const candidate = new Fraction(
        Math.max(1, correctValue.num + step),
        Math.max(2, correctValue.den)
      ).toExamString();
      if (candidate !== correctStr) {
        distractors.add(candidate);
      }
      step++;
    }
    const allOptions = shuffle([correctStr, ...distractors]);
    return {
      options: allOptions,
      correctOptionIndex: allOptions.indexOf(correctStr),
    };
  }
}