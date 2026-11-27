import { synthesizeUniqueAttributeClues } from "./cspSolver.js";
import { ATTRIBUTE_POOLS, buildFivePuzzleQuestions, PERSON_POOLS } from "./puzzleQuestionBuilder.js";

/**
 * 5. Distribution-Based Puzzles (Tabular Multi-Attribute Matching: Person <-> City <-> Department/Subject)
 * Uses CSP bijection solver so every person's City AND Profession/Subject is 100% uniquely determined.
 */
export function generateDistributionPuzzleSet({ difficulty = "Medium", rng }) {
  const n = difficulty === "Easy" ? 6 : 7;
  const entities = rng.shuffle(rng.pick(PERSON_POOLS.slice(3))).slice(0, n);
  const cities = rng.shuffle(ATTRIBUTE_POOLS.City).slice(0, n);
  const secondaryKey = rng.pick(["Department", "Profession", "Subject"]);
  const secondaries = rng.shuffle(ATTRIBUTE_POOLS[secondaryKey]).slice(0, n);

  // Ground truth: entity i -> cities[i] and secondaries[i]
  const groundTruthCity = Array.from({ length: n }, (_, i) => i);
  const groundTruthSec = Array.from({ length: n }, (_, i) => i);

  const citySolved = synthesizeUniqueAttributeClues({
    n,
    groundTruthAttr: groundTruthCity,
    formatFixed: (e, a) => `${entities[e]} belongs to ${cities[a]}.`,
    formatNotAt: (e, a) => `${entities[e]} does not belong to ${cities[a]}.`,
    rng,
    maxClues: 12,
  });
  if (!citySolved.unique) return null;

  const secSolved = synthesizeUniqueAttributeClues({
    n,
    groundTruthAttr: groundTruthSec,
    formatFixed: (e, a) =>
      secondaryKey === "Department"
        ? `The person from ${cities[e]} works in the ${secondaries[a]} department.`
        : secondaryKey === "Profession"
          ? `${entities[e]} is a ${secondaries[a]}.`
          : `The person from ${cities[e]} teaches ${secondaries[a]}.`,
    formatNotAt: (e, a) =>
      secondaryKey === "Department"
        ? `${entities[e]} does not work in the ${secondaries[a]} department.`
        : secondaryKey === "Profession"
          ? `${entities[e]} is not a ${secondaries[a]}.`
          : `${entities[e]} does not teach ${secondaries[a]}.`,
    rng,
    maxClues: 12,
  });
  if (!secSolved.unique) return null;

  const allClues = rng.shuffle([...citySolved.clues, ...secSolved.clues]).map((c) => c.text).join(" ");
  const secondaryByEntity = Object.fromEntries(entities.map((ent, i) => [ent, secondaries[i]]));

  const passageTitle = `Distribution-Based Tabular Puzzle (${n} Persons · City & ${secondaryKey})`;
  const passageText = `Directions: Study the following information carefully and answer the questions given below.\n\n${n} persons — ${entities.join(", ")} — belong to ${n} different cities (${rng.shuffle(cities).join(", ")}) and are associated with ${n} different ${secondaryKey.toLowerCase()}s (${rng.shuffle(secondaries).join(", ")}), not necessarily in the same order.\n${allClues}`;

  const questions = buildFivePuzzleQuestions({
    puzzleType: "PUZZLE_DISTRIBUTION_BASED",
    subtopicName: "Distribution-Based Puzzles",
    difficulty,
    passageTitle,
    passageText,
    orderedEntities: entities,
    slotLabels: cities.map((c) => `City: ${c}`),
    entityNoun: "person",
    positionAboveWord: "listed before",
    positionBelowWord: "listed after",
    secondaryLabel: secondaryKey,
    secondaryByEntity,
    rng,
  });

  return {
    puzzleType: "PUZZLE_DISTRIBUTION_BASED",
    subtopicName: "Distribution-Based Puzzles",
    difficulty,
    solutionCount: citySolved.solutionCount * secSolved.solutionCount,
    passageTitle,
    passageText,
    questions,
  };
}
