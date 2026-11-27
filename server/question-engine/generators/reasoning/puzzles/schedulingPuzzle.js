import { synthesizeUniqueClueSet } from "./cspSolver.js";
import { buildFivePuzzleQuestions, PERSON_POOLS } from "./puzzleQuestionBuilder.js";

const BANK_DESIGNATIONS = [
  "CMD (Chairman & MD)",
  "GM (General Manager)",
  "DGM (Deputy GM)",
  "AGM (Assistant GM)",
  "Chief Manager",
  "Manager",
  "PO (Probationary Officer)",
  "Clerk",
];

const BIRTH_YEARS = [1972, 1978, 1983, 1987, 1991, 1995, 1999, 2002];
const BASE_YEAR = 2026;

/**
 * 6. Scheduling-Based Puzzles:
 *  - Mode A: Banking Designation Hierarchy (CMD -> Clerk, senior-to-junior)
 *  - Mode B: Year / Age-Based Scheduling (Birth years relative to base year 2026)
 */
export function generateSchedulingPuzzleSet({ difficulty = "Medium", rng }) {
  const isDesignation = rng.random() < 0.55;
  const n = difficulty === "Easy" ? 7 : 8;
  const entities = rng.shuffle(rng.pick(PERSON_POOLS.slice(0, 3))).slice(0, n);
  const candidates = [];
  const countWords = ["zero", "one", "two", "three", "four", "five"];

  if (isDesignation) {
    const designations = BANK_DESIGNATIONS.slice(0, n);
    for (let i = 0; i < n; i += 1) {
      if (i < n - 1) {
        candidates.push({
          constraint: { type: "IMMEDIATELY_BEFORE", a: i, b: i + 1 },
          text: `${entities[i]} is immediately senior to ${entities[i + 1]}.`,
          priority: 1,
        });
      }
      for (let gap = 1; gap <= 3; gap += 1) {
        const j = i + gap + 1;
        if (j < n) {
          candidates.push({
            constraint: { type: "GAP", a: i, b: j, k: gap },
            text: `Exactly ${countWords[gap]} designation${gap > 1 ? "s are" : " is"} between ${entities[i]} and ${entities[j]}.`,
            priority: 1,
          });
        }
      }
      for (let j = i + 2; j < n; j += 1) {
        candidates.push({
          constraint: { type: "BEFORE", a: i, b: j },
          text: `${entities[i]} is senior to ${entities[j]}.`,
          priority: 2,
        });
      }
      if (i !== 0) {
        candidates.push({
          constraint: { type: "NOT_AT", a: i, slot: 0 },
          text: `${entities[i]} is not the ${designations[0]}.`,
          priority: 2,
        });
      }
      candidates.push({
        constraint: { type: "FIXED", a: i, slot: i },
        text:
          i === n - 2
            ? `${entities[i]} is senior to only one person.`
            : `${entities[i]} holds the designation of ${designations[i]}.`,
        priority: difficulty === "Easy" ? 2 : 3,
      });
    }

    const solved = synthesizeUniqueClueSet({ n, candidateClues: candidates, rng, maxClues: 11 });
    if (!solved.unique) return null;

    const clueSentences = rng.shuffle(solved.clues).map((c) => c.text).join(" ");
    const passageTitle = `Designation Hierarchy Scheduling (${n} Bank Officers)`;
    const passageText = `Directions: Study the following information carefully and answer the questions given below.\n\n${n} bank employees — ${entities.join(", ")} — hold ${n} different designations in decreasing order of seniority: ${designations.join(" > ")}, not necessarily in the same order.\n${clueSentences}`;

    const questions = buildFivePuzzleQuestions({
      puzzleType: "PUZZLE_SCHEDULING_DESIGNATION",
      subtopicName: "Scheduling-Based Puzzles",
      difficulty,
      passageTitle,
      passageText,
      orderedEntities: entities,
      slotLabels: designations,
      entityNoun: "officer",
      positionAboveWord: "senior to",
      positionBelowWord: "junior to",
      oddGroupMeta: {
        groupLabel: "holds one of the top 4 senior-most designations",
        memberCheck: (idx) => idx < 4,
      },
      rng,
    });

    return {
      puzzleType: "PUZZLE_SCHEDULING_DESIGNATION",
      subtopicName: "Scheduling-Based Puzzles",
      difficulty,
      solutionCount: solved.solutionCount,
      passageTitle,
      passageText,
      questions,
    };
  }

  // Mode B: Birth-Year / Age Scheduling
  const years = BIRTH_YEARS.slice(0, n);
  const ages = years.map((y) => BASE_YEAR - y);
  const slotLabels = years.map((y, idx) => `${y} (Age ${ages[idx]})`);
  const evenAgeSlots = ages.map((a, idx) => (a % 2 === 0 ? idx : -1)).filter((x) => x >= 0);

  for (let i = 0; i < n; i += 1) {
    if (i < n - 1) {
      candidates.push({
        constraint: { type: "IMMEDIATELY_BEFORE", a: i, b: i + 1 },
        text: `${entities[i]} was born immediately before ${entities[i + 1]}.`,
        priority: 1,
      });
    }
    for (let gap = 1; gap <= 3; gap += 1) {
      const j = i + gap + 1;
      if (j < n) {
        candidates.push({
          constraint: { type: "GAP", a: i, b: j, k: gap },
          text: `Exactly ${countWords[gap]} person${gap > 1 ? "s were" : " was"} born between ${entities[i]} and ${entities[j]}.`,
          priority: 1,
        });
      }
    }
    if (evenAgeSlots.includes(i) && evenAgeSlots.length >= 2 && evenAgeSlots.length < n) {
      candidates.push({
        constraint: { type: "ALLOWED_SLOTS", a: i, slots: evenAgeSlots },
        text: `${entities[i]}'s age in ${BASE_YEAR} is an even number.`,
        priority: 2,
      });
    }
    for (let j = i + 2; j < n; j += 1) {
      candidates.push({
        constraint: { type: "BEFORE", a: i, b: j },
        text: `${entities[i]} is older than ${entities[j]}.`,
        priority: 2,
      });
    }
    candidates.push({
      constraint: { type: "FIXED", a: i, slot: i },
      text: `${entities[i]} is ${ages[i]} years old in ${BASE_YEAR}.`,
      priority: difficulty === "Easy" ? 2 : 3,
    });
  }

  const solved = synthesizeUniqueClueSet({ n, candidateClues: candidates, rng, maxClues: 11 });
  if (!solved.unique) return null;

  const clueSentences = rng.shuffle(solved.clues).map((c) => c.text).join(" ");
  const passageTitle = `Year & Age-Based Scheduling (${n} Persons)`;
  const passageText = `Directions: Study the following information carefully and answer the questions given below.\n\n${n} persons — ${entities.join(", ")} — were born in ${n} different years (${years.join(", ")}), not necessarily in the same order. Their ages are calculated with respect to the base year ${BASE_YEAR}.\n${clueSentences}`;

  const questions = buildFivePuzzleQuestions({
    puzzleType: "PUZZLE_SCHEDULING_YEAR",
    subtopicName: "Scheduling-Based Puzzles",
    difficulty,
    passageTitle,
    passageText,
    orderedEntities: entities,
    slotLabels,
    entityNoun: "person",
    positionAboveWord: "older than",
    positionBelowWord: "younger than",
    rng,
  });

  return {
    puzzleType: "PUZZLE_SCHEDULING_YEAR",
    subtopicName: "Scheduling-Based Puzzles",
    difficulty,
    solutionCount: solved.solutionCount,
    passageTitle,
    passageText,
    questions,
  };
}
