import { synthesizeUniqueClueSet } from "./cspSolver.js";
import { buildFivePuzzleQuestions, PERSON_POOLS } from "./puzzleQuestionBuilder.js";

/**
 * 1. Box-Based Puzzles (Vertical Stack of 7-9 Boxes, Top-to-Bottom)
 * Slot 0 = Topmost box, Slot n-1 = Bottommost box.
 */
export function generateBoxPuzzleSet({ difficulty = "Medium", rng }) {
  const n = difficulty === "Easy" ? 7 : difficulty === "Hard" ? 9 : 8;
  const entities = rng.shuffle(rng.pick(PERSON_POOLS.slice(0, 3))).slice(0, n);
  const slotLabels = Array.from({ length: n }, (_, i) =>
    i === 0
      ? `Position 1 (Topmost)`
      : i === n - 1
        ? `Position ${n} (Bottommost)`
        : `Position ${i + 1} from top`,
  );

  // Build authentic vertical-stack clue pool from ground truth (entity i is at slot i)
  const candidates = [];
  const countWords = ["zero", "one", "two", "three", "four", "five"];

  for (let i = 0; i < n; i += 1) {
    // Immediate above/below (priority 1)
    if (i < n - 1) {
      candidates.push({
        constraint: { type: "IMMEDIATELY_BEFORE", a: i, b: i + 1 },
        text: `Box ${entities[i]} is kept immediately above Box ${entities[i + 1]}.`,
        priority: 1,
      });
    }
    // Exact gap clues (priority 1-2)
    for (let gap = 1; gap <= 3; gap += 1) {
      const j = i + gap + 1;
      if (j < n) {
        candidates.push({
          constraint: { type: "GAP", a: i, b: j, k: gap },
          text: `Exactly ${countWords[gap]} box${gap > 1 ? "es are" : " is"} kept between Box ${entities[i]} and Box ${entities[j]}.`,
          priority: 1,
        });
        candidates.push({
          constraint: { type: "EXACT_OFFSET", a: i, b: j, delta: gap + 1 },
          text: `Box ${entities[i]} is kept ${gap + 1} positions above Box ${entities[j]}.`,
          priority: 2,
        });
      }
    }
    // Relative above/below (priority 2)
    for (let j = i + 2; j < n; j += 1) {
      candidates.push({
        constraint: { type: "BEFORE", a: i, b: j },
        text: `Box ${entities[i]} is kept somewhere above Box ${entities[j]}.`,
        priority: 2,
      });
    }
    // Not at top / bottom (priority 2)
    if (i !== 0) {
      candidates.push({
        constraint: { type: "NOT_AT", a: i, slot: 0 },
        text: `Box ${entities[i]} is not kept at the topmost position.`,
        priority: 2,
      });
    }
    if (i !== n - 1) {
      candidates.push({
        constraint: { type: "NOT_AT", a: i, slot: n - 1 },
        text: `Box ${entities[i]} is not kept at the bottommost position.`,
        priority: 2,
      });
    }
    // Anchor clues (priority 3 for Easy, 4 for Medium/Hard so indirect clues dominate)
    candidates.push({
      constraint: { type: "FIXED", a: i, slot: i },
      text:
        i === 0
          ? `Box ${entities[i]} is kept at the topmost position.`
          : i === n - 1
            ? `Box ${entities[i]} is kept at the bottommost position.`
            : `Only ${i} box${i > 1 ? "es are" : " is"} kept above Box ${entities[i]}.`,
      priority: difficulty === "Easy" ? 2 : 3,
    });
  }

  const solved = synthesizeUniqueClueSet({ n, candidateClues: candidates, rng, maxClues: 11 });
  if (!solved.unique) return null;

  const clueSentences = rng.shuffle(solved.clues).map((c) => c.text).join(" ");
  const passageTitle = `Box-Based Vertical Stack (${n} Boxes)`;
  const passageText = `Directions: Study the following information carefully and answer the questions given below.\n\n${n} boxes — ${entities.join(", ")} — are stacked one above another in a single vertical pile (numbered 1 from the top to ${n} at the bottom), not necessarily in the same order.\n${clueSentences}`;

  const questions = buildFivePuzzleQuestions({
    puzzleType: "PUZZLE_BOX_BASED",
    subtopicName: "Box-Based Puzzles",
    difficulty,
    passageTitle,
    passageText,
    orderedEntities: entities.map((e) => `Box ${e}`),
    slotLabels,
    entityNoun: "box",
    positionAboveWord: "above",
    positionBelowWord: "below",
    oddGroupMeta: {
      groupLabel: "kept at an odd-numbered position from the top",
      memberCheck: (idx) => (idx + 1) % 2 === 1,
    },
    rng,
  });

  return {
    puzzleType: "PUZZLE_BOX_BASED",
    subtopicName: "Box-Based Puzzles",
    difficulty,
    solutionCount: solved.solutionCount,
    passageTitle,
    passageText,
    questions,
  };
}
