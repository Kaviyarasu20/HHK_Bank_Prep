import { synthesizeUniqueClueSet } from "./cspSolver.js";
import { buildFivePuzzleQuestions, PERSON_POOLS } from "./puzzleQuestionBuilder.js";

const COMPARISON_DIMENSIONS = [
  { key: "height", higher: "taller", lower: "shorter", highest: "tallest", lowest: "shortest", unit: "cm", base: 184, step: 4 },
  { key: "weight", higher: "heavier", lower: "lighter", highest: "heaviest", lowest: "lightest", unit: "kg", base: 82, step: 5 },
  { key: "marks", higher: "scored more marks than", lower: "scored fewer marks than", highest: "highest scorer", lowest: "lowest scorer", unit: "marks", base: 94, step: 6 },
  { key: "salary", higher: "earns more than", lower: "earns less than", highest: "highest earner", lowest: "lowest earner", unit: "k", base: 95, step: 8 },
];

/**
 * 4. Comparison-Based Ranking Puzzles (6-8 Persons strictly ordered highest -> lowest)
 */
export function generateComparisonPuzzleSet({ difficulty = "Medium", rng }) {
  const n = difficulty === "Easy" ? 6 : difficulty === "Hard" ? 8 : 7;
  const dim = rng.pick(COMPARISON_DIMENSIONS);
  const entities = rng.shuffle(rng.pick(PERSON_POOLS.slice(0, 3))).slice(0, n);
  const slotLabels = Array.from({ length: n }, (_, i) =>
    i === 0
      ? `Rank 1 (${dim.highest})`
      : i === n - 1
        ? `Rank ${n} (${dim.lowest})`
        : `Rank ${i + 1} from top`,
  );

  const candidates = [];
  const countWords = ["zero", "one", "two", "three", "four", "five"];

  for (let i = 0; i < n; i += 1) {
    if (i < n - 1) {
      candidates.push({
        constraint: { type: "IMMEDIATELY_BEFORE", a: i, b: i + 1 },
        text: `${entities[i]} is immediately ${dim.higher} ${dim.key === "height" || dim.key === "weight" ? "than " : ""}${entities[i + 1]}.`,
        priority: 1,
      });
    }
    for (let j = i + 1; j < n; j += 1) {
      candidates.push({
        constraint: { type: "BEFORE", a: i, b: j },
        text: `${entities[i]} is ${dim.higher} ${dim.key === "height" || dim.key === "weight" ? "than " : ""}${entities[j]}.`,
        priority: 2,
      });
    }
    for (let gap = 1; gap <= 2; gap += 1) {
      const j = i + gap + 1;
      if (j < n) {
        candidates.push({
          constraint: { type: "GAP", a: i, b: j, k: gap },
          text: `Exactly ${countWords[gap]} person${gap > 1 ? "s rank" : " ranks"} between ${entities[i]} and ${entities[j]}.`,
          priority: 1,
        });
      }
    }
    if (i === 0) {
      candidates.push({
        constraint: { type: "FIXED", a: i, slot: 0 },
        text: `${entities[i]} is the ${dim.highest} among all.`,
        priority: 3,
      });
    } else if (i === n - 1) {
      candidates.push({
        constraint: { type: "FIXED", a: i, slot: n - 1 },
        text: `${entities[i]} is the ${dim.lowest} among all.`,
        priority: 3,
      });
    } else {
      const belowCount = n - 1 - i;
      candidates.push({
        constraint: { type: "FIXED", a: i, slot: i },
        text: `${entities[i]} is ${dim.higher} ${dim.key === "height" || dim.key === "weight" ? "than " : ""}only ${countWords[belowCount] || belowCount} person${belowCount > 1 ? "s" : ""}.`,
        priority: difficulty === "Easy" ? 2 : 3,
      });
    }
    if (i !== 0) {
      candidates.push({
        constraint: { type: "NOT_AT", a: i, slot: 0 },
        text: `${entities[i]} is not the ${dim.highest}.`,
        priority: 2,
      });
    }
  }

  const solved = synthesizeUniqueClueSet({ n, candidateClues: candidates, rng, maxClues: 10 });
  if (!solved.unique) return null;

  const clueSentences = rng.shuffle(solved.clues).map((c) => c.text).join(" ");
  const anchorNote =
    difficulty !== "Easy"
      ? ` The ${dim.key} of the 2nd ${dim.highest} person (${entities[1]}) is ${dim.base - dim.step} ${dim.unit}.`
      : "";
  const passageTitle = `Comparison-Based Ranking (${n} Persons — ${dim.key.toUpperCase()})`;
  const passageText = `Directions: Study the following information carefully and answer the questions given below.\n\n${n} persons — ${entities.join(", ")} — have different ${dim.key}s. No two persons have the same ${dim.key}.\n${clueSentences}${anchorNote}`;

  const questions = buildFivePuzzleQuestions({
    puzzleType: "PUZZLE_COMPARISON_BASED",
    subtopicName: "Comparison-Based Puzzles",
    difficulty,
    passageTitle,
    passageText,
    orderedEntities: entities,
    slotLabels,
    entityNoun: "person",
    positionAboveWord: "higher than",
    positionBelowWord: "lower than",
    rng,
  });

  return {
    puzzleType: "PUZZLE_COMPARISON_BASED",
    subtopicName: "Comparison-Based Puzzles",
    difficulty,
    solutionCount: solved.solutionCount,
    passageTitle,
    passageText,
    questions,
  };
}
