// core/approxUtils.js
import { randInt, pickRandom, shuffle } from "./mathUtils.js";

/**
 * Perturbs a clean integer N so it rounds back to N with minimal cumulative drift.
 * Example: perturbInt(50, 2) -> "49.96" or "50.03"
 */
export function perturbInt(n, decimals = 2) {
  const goUp = Math.random() < 0.5;
  if (decimals === 1) {
    return goUp ? `${n}.1` : `${n - 1}.9`;
  }
  const smallCents = randInt(1, 9);
  const highCents = randInt(91, 99);
  return goUp ? `${n}.0${smallCents}` : `${n - 1}.${highCents}`;
}

/**
 * Perturbs a perfect square or cube inside √ / ³√ so it isn't an exact integer
 * Example: perturbRadicand(2500) -> 2498 or 2503
 */
export function perturbRadicand(exactPower) {
  const delta = pickRandom([-4, -3, -2, -1, 1, 2, 3, 4]);
  return Math.max(2, exactPower + delta);
}

/**
 * Generates 5 unique positive integer options spaced safely apart so
 * rounding drift never makes a distractor closer than the intended answer.
 */
export function buildApproxOptions(correctInt, difficulty = "MEDIUM") {
  const ans = Number(correctInt);
  const stepMap = {
    EASY: [-30, -20, -10, 10, 20, 30, 40],
    MEDIUM: [-24, -16, -8, 8, 16, 24, 32],
    HARD: [-15, -10, -5, 5, 10, 15, 20],
  };
  const offsets = stepMap[difficulty] || stepMap.MEDIUM;
  const distractors = new Set();

  let safety = 0;
  while (distractors.size < 4 && safety < 200) {
    safety++;
    const cand = ans + pickRandom(offsets);
    if (cand > 0 && cand !== ans) {
      distractors.add(String(cand));
    }
  }

  let fallbackStep = 6;
  while (distractors.size < 4) {
    distractors.add(String(ans + fallbackStep));
    fallbackStep += 6;
  }

  const allOptions = shuffle([String(ans), ...distractors]);
  return {
    options: allOptions,
    correctOptionIndex: allOptions.indexOf(String(ans)),
  };
}