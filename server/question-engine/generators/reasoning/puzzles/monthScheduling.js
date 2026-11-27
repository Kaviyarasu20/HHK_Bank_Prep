import { synthesizeUniqueClueSet } from "./cspSolver.js";
import { buildFivePuzzleQuestions, PERSON_POOLS } from "./puzzleQuestionBuilder.js";

const MONTHS_INFO = [
  { name: "January", days: 31 },
  { name: "March", days: 31 },
  { name: "April", days: 30 },
  { name: "May", days: 31 },
  { name: "June", days: 30 },
  { name: "July", days: 31 },
  { name: "September", days: 30 },
  { name: "October", days: 31 },
  { name: "November", days: 30 },
  { name: "December", days: 31 },
];

/**
 * 3. Month-Based Scheduling Puzzles
 * - Easy: 7 single-date months with 31-day vs 30-day clues
 * - Medium / Hard: Month + 2 Dates (4 months x 2 dates = 8 slots, classic IBPS/SBI PO pattern!)
 */
export function generateMonthSchedulingSet({ difficulty = "Medium", rng }) {
  const useTwoDates = difficulty !== "Easy";
  let slotLabels;
  let slotsWith31Days;

  if (useTwoDates) {
    const selectedMonths = MONTHS_INFO.slice(0, 4); // Jan (31), Mar (31), Apr (30), May (31)
    const d1 = rng.pick([7, 9, 11]);
    const d2 = rng.pick([16, 18, 22]);
    slotLabels = [];
    slotsWith31Days = [];
    selectedMonths.forEach((m) => {
      [d1, d2].forEach((d) => {
        const idx = slotLabels.length;
        slotLabels.push(`${d} ${m.name}`);
        if (m.days === 31) slotsWith31Days.push(idx);
      });
    });
  } else {
    const selectedMonths = MONTHS_INFO.slice(0, 7);
    slotLabels = selectedMonths.map((m) => m.name);
    slotsWith31Days = selectedMonths
      .map((m, idx) => (m.days === 31 ? idx : -1))
      .filter((idx) => idx >= 0);
  }

  const n = slotLabels.length;
  const slotsWith30Days = Array.from({ length: n }, (_, i) => i).filter((i) => !slotsWith31Days.includes(i));
  const entities = rng.shuffle(rng.pick(PERSON_POOLS.slice(3))).slice(0, n);
  const candidates = [];
  const countWords = ["zero", "one", "two", "three", "four"];

  for (let i = 0; i < n; i += 1) {
    if (i < n - 1) {
      candidates.push({
        constraint: { type: "IMMEDIATELY_BEFORE", a: i, b: i + 1 },
        text: `${entities[i]}'s exam is scheduled immediately before ${entities[i + 1]}.`,
        priority: 1,
      });
    }
    for (let gap = 1; gap <= 3; gap += 1) {
      const j = i + gap + 1;
      if (j < n) {
        candidates.push({
          constraint: { type: "GAP", a: i, b: j, k: gap },
          text: `Exactly ${countWords[gap]} person${gap > 1 ? "s are" : " is"} scheduled between ${entities[i]} and ${entities[j]}.`,
          priority: 1,
        });
      }
    }
    if (slotsWith30Days.includes(i)) {
      candidates.push({
        constraint: { type: "ALLOWED_SLOTS", a: i, slots: slotsWith30Days },
        text: `${entities[i]} is scheduled in a month having 30 days.`,
        priority: 1,
      });
    } else if (slotsWith31Days.includes(i)) {
      candidates.push({
        constraint: { type: "ALLOWED_SLOTS", a: i, slots: slotsWith31Days },
        text: `${entities[i]} is scheduled in a month having 31 days.`,
        priority: 2,
      });
    }
    for (let j = i + 2; j < n; j += 1) {
      candidates.push({
        constraint: { type: "BEFORE", a: i, b: j },
        text: `${entities[i]} is scheduled before ${entities[j]}.`,
        priority: 2,
      });
    }
    candidates.push({
      constraint: { type: "FIXED", a: i, slot: i },
      text: `${entities[i]} is scheduled on ${slotLabels[i]}.`,
      priority: difficulty === "Easy" ? 2 : 3,
    });
  }

  const solved = synthesizeUniqueClueSet({ n, candidateClues: candidates, rng, maxClues: 11 });
  if (!solved.unique) return null;

  const clueSentences = rng.shuffle(solved.clues).map((c) => c.text).join(" ");
  const passageTitle = useTwoDates
    ? `Month & Date Scheduling Puzzle (${n} Slots)`
    : `Month-Based Scheduling Puzzle (${n} Months)`;
  const intro = useTwoDates
    ? `Eight persons — ${entities.join(", ")} — have bank exams on two different dates in four months (${slotLabels.join(", ")}), not necessarily in the same order.`
    : `Seven persons — ${entities.join(", ")} — have exams in seven different months (${slotLabels.join(", ")}), not necessarily in the same order.`;
  const passageText = `Directions: Study the following information carefully and answer the questions given below.\n\n${intro}\n${clueSentences}`;

  const questions = buildFivePuzzleQuestions({
    puzzleType: "PUZZLE_MONTH_SCHEDULING",
    subtopicName: "Month-Based Scheduling",
    difficulty,
    passageTitle,
    passageText,
    orderedEntities: entities,
    slotLabels,
    entityNoun: "person",
    positionAboveWord: "before",
    positionBelowWord: "after",
    oddGroupMeta:
      slotsWith31Days.length >= 4 && slotsWith30Days.length >= 1
        ? {
            groupLabel: "scheduled in a month having 31 days",
            memberCheck: (idx) => slotsWith31Days.includes(idx),
          }
        : null,
    rng,
  });

  return {
    puzzleType: "PUZZLE_MONTH_SCHEDULING",
    subtopicName: "Month-Based Scheduling",
    difficulty,
    solutionCount: solved.solutionCount,
    passageTitle,
    passageText,
    questions,
  };
}
