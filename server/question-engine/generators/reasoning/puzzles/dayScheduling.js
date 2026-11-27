import { synthesizeUniqueClueSet } from "./cspSolver.js";
import { buildFivePuzzleQuestions, PERSON_POOLS } from "./puzzleQuestionBuilder.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * 2. Day-Based Scheduling Puzzles (Monday to Sunday — 7 Days)
 */
export function generateDaySchedulingSet({ difficulty = "Medium", rng }) {
  const n = 7;
  const entities = rng.shuffle(rng.pick(PERSON_POOLS.slice(3))).slice(0, n);
  const eventNoun = rng.pick(["interview", "seminar", "audit review", "branch visit", "training session"]);
  const candidates = [];
  const countWords = ["zero", "one", "two", "three", "four"];

  for (let i = 0; i < n; i += 1) {
    if (i < n - 1) {
      candidates.push({
        constraint: { type: "IMMEDIATELY_BEFORE", a: i, b: i + 1 },
        text: `${entities[i]} has the ${eventNoun} immediately before ${entities[i + 1]}.`,
        priority: 1,
      });
    }
    for (let gap = 1; gap <= 3; gap += 1) {
      const j = i + gap + 1;
      if (j < n) {
        candidates.push({
          constraint: { type: "GAP", a: i, b: j, k: gap },
          text: `Exactly ${countWords[gap]} person${gap > 1 ? "s have" : " has"} the ${eventNoun} between ${entities[i]} and ${entities[j]}.`,
          priority: 1,
        });
      }
    }
    for (let j = i + 2; j < n; j += 1) {
      candidates.push({
        constraint: { type: "BEFORE", a: i, b: j },
        text: `${entities[i]} is scheduled before ${entities[j]}.`,
        priority: 2,
      });
    }
    // Weekend vs Weekday domain restriction
    if (i >= 5) {
      candidates.push({
        constraint: { type: "ALLOWED_SLOTS", a: i, slots: [5, 6] },
        text: `${entities[i]} has the ${eventNoun} on a weekend (Saturday or Sunday).`,
        priority: 1,
      });
    } else if (i === 0 || i === 1) {
      candidates.push({
        constraint: { type: "NOT_AT", a: i, slot: 6 },
        text: `${entities[i]} does not have the ${eventNoun} on Sunday.`,
        priority: 2,
      });
    }
    candidates.push({
      constraint: { type: "FIXED", a: i, slot: i },
      text: `${entities[i]} has the ${eventNoun} on ${DAYS[i]}.`,
      priority: difficulty === "Easy" ? 2 : 3,
    });
  }

  const solved = synthesizeUniqueClueSet({ n, candidateClues: candidates, rng, maxClues: 10 });
  if (!solved.unique) return null;

  const clueSentences = rng.shuffle(solved.clues).map((c) => c.text).join(" ");
  const passageTitle = `Day-Based Weekly Schedule (Monday–Sunday)`;
  const passageText = `Directions: Study the following information carefully and answer the questions given below.\n\nSeven persons — ${entities.join(", ")} — have a scheduled ${eventNoun} on seven different days of the same week starting from Monday and ending on Sunday, not necessarily in the same order.\n${clueSentences}`;

  const questions = buildFivePuzzleQuestions({
    puzzleType: "PUZZLE_DAY_SCHEDULING",
    subtopicName: "Day-Based Scheduling",
    difficulty,
    passageTitle,
    passageText,
    orderedEntities: entities,
    slotLabels: DAYS,
    entityNoun: "person",
    positionAboveWord: "before",
    positionBelowWord: "after",
    oddGroupMeta: {
      groupLabel: "scheduled on a weekday (Monday to Friday)",
      memberCheck: (idx) => idx < 5,
    },
    rng,
  });

  return {
    puzzleType: "PUZZLE_DAY_SCHEDULING",
    subtopicName: "Day-Based Scheduling",
    difficulty,
    solutionCount: solved.solutionCount,
    passageTitle,
    passageText,
    questions,
  };
}
