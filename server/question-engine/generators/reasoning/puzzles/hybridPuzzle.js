import { synthesizeUniqueAttributeClues, synthesizeUniqueClueSet } from "./cspSolver.js";
import { ATTRIBUTE_POOLS, buildFivePuzzleQuestions, PERSON_POOLS } from "./puzzleQuestionBuilder.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const BANK_ROLES = ["CMD", "GM", "DGM", "AGM", "Chief Manager", "Manager", "PO"];

/**
 * 7. Hybrid Multi-Variable Puzzles (PO Mains / RBI Grade B Standard)
 * Combines a primary positional/chronological structure with a secondary variable:
 *  - Mode A: Box Stack (7 Boxes) + Color/Fruit
 *  - Mode B: Weekly Schedule (7 Days) + City
 *  - Mode C: Bank Designation (7 Officers) + Department
 * BOTH the ordering AND the 2nd variable are independently CSP-verified unique (solutionCount === 1).
 */
export function generateHybridPuzzleSet({ difficulty = "Hard", rng }) {
  const n = 7;
  const mode = rng.pick(["BOX_COLOR", "DAY_CITY", "DESIGNATION_DEPT"]);
  const entities = rng.shuffle(rng.pick(PERSON_POOLS.slice(mode === "BOX_COLOR" ? 0 : 3))).slice(0, n);

  const secondaryKey =
    mode === "BOX_COLOR" ? "Color" : mode === "DAY_CITY" ? "City" : "Department";
  const secondaryValues = rng.shuffle(ATTRIBUTE_POOLS[secondaryKey]).slice(0, n);
  const slotLabels =
    mode === "BOX_COLOR"
      ? Array.from({ length: n }, (_, i) => `Stack Pos ${i + 1}`)
      : mode === "DAY_CITY"
        ? DAYS
        : BANK_ROLES;

  // 1. Synthesize unique primary ordering clues
  const orderCandidates = [];
  const countWords = ["zero", "one", "two", "three", "four"];
  for (let i = 0; i < n; i += 1) {
    if (i < n - 1) {
      orderCandidates.push({
        constraint: { type: "IMMEDIATELY_BEFORE", a: i, b: i + 1 },
        text:
          mode === "BOX_COLOR"
            ? `Box ${entities[i]} is kept immediately above Box ${entities[i + 1]}.`
            : mode === "DAY_CITY"
              ? `${entities[i]} travels immediately before ${entities[i + 1]}.`
              : `${entities[i]} is immediately senior to ${entities[i + 1]}.`,
        priority: 1,
      });
    }
    for (let gap = 1; gap <= 3; gap += 1) {
      const j = i + gap + 1;
      if (j < n) {
        orderCandidates.push({
          constraint: { type: "GAP", a: i, b: j, k: gap },
          text:
            mode === "BOX_COLOR"
              ? `Exactly ${countWords[gap]} box${gap > 1 ? "es are" : " is"} between Box ${entities[i]} and Box ${entities[j]}.`
              : mode === "DAY_CITY"
                ? `Exactly ${countWords[gap]} person${gap > 1 ? "s travel" : " travels"} between ${entities[i]} and ${entities[j]}.`
                : `Exactly ${countWords[gap]} officer${gap > 1 ? "s are" : " is"} ranked between ${entities[i]} and ${entities[j]}.`,
          priority: 1,
        });
      }
    }
    for (let j = i + 2; j < n; j += 1) {
      orderCandidates.push({
        constraint: { type: "BEFORE", a: i, b: j },
        text:
          mode === "BOX_COLOR"
            ? `Box ${entities[i]} is kept above Box ${entities[j]}.`
            : mode === "DAY_CITY"
              ? `${entities[i]} travels before ${entities[j]}.`
              : `${entities[i]} is senior to ${entities[j]}.`,
        priority: 2,
      });
    }
    if (i !== 0) {
      orderCandidates.push({
        constraint: { type: "NOT_AT", a: i, slot: 0 },
        text:
          mode === "BOX_COLOR"
            ? `Box ${entities[i]} is not at the top of the stack.`
            : mode === "DAY_CITY"
              ? `${entities[i]} does not travel on Monday.`
              : `${entities[i]} is not the CMD.`,
        priority: 2,
      });
    }
    orderCandidates.push({
      constraint: { type: "FIXED", a: i, slot: i },
      text:
        mode === "BOX_COLOR"
          ? `Box ${entities[i]} is at ${slotLabels[i]} from the top.`
          : mode === "DAY_CITY"
            ? `${entities[i]} travels on ${slotLabels[i]}.`
            : `${entities[i]} is the ${slotLabels[i]}.`,
      priority: 3,
    });
  }

  const orderSolved = synthesizeUniqueClueSet({ n, candidateClues: orderCandidates, rng, maxClues: 9 });
  if (!orderSolved.unique) return null;

  // 2. Synthesize unique secondary variable clues
  const attrSolved = synthesizeUniqueAttributeClues({
    n,
    groundTruthAttr: Array.from({ length: n }, (_, i) => i),
    formatFixed: (e, a) =>
      mode === "BOX_COLOR"
        ? `Box ${entities[e]} is ${secondaryValues[a]} in color.`
        : mode === "DAY_CITY"
          ? `The person travelling on ${slotLabels[e]} visits ${secondaryValues[a]}.`
          : `${entities[e]} leads the ${secondaryValues[a]} department.`,
    formatNotAt: (e, a) =>
      mode === "BOX_COLOR"
        ? `Box ${entities[e]} is not ${secondaryValues[a]} in color.`
        : mode === "DAY_CITY"
          ? `${entities[e]} does not visit ${secondaryValues[a]}.`
          : `${entities[e]} does not lead the ${secondaryValues[a]} department.`,
    rng,
    maxClues: 11,
  });
  if (!attrSolved.unique) return null;

  const displayEntities = mode === "BOX_COLOR" ? entities.map((e) => `Box ${e}`) : entities;
  const secondaryByEntity = Object.fromEntries(displayEntities.map((ent, i) => [ent, secondaryValues[i]]));
  const allClues = rng.shuffle([...orderSolved.clues, ...attrSolved.clues]).map((c) => c.text).join(" ");

  const passageTitle =
    mode === "BOX_COLOR"
      ? `Hybrid Puzzle: Box Stack + Colors (${n} Boxes)`
      : mode === "DAY_CITY"
        ? `Hybrid Puzzle: Weekly Schedule + Cities (${n} Days)`
        : `Hybrid Puzzle: Bank Designations + Departments (${n} Officers)`;

  const intro =
    mode === "BOX_COLOR"
      ? `Seven boxes — ${entities.join(", ")} — of seven different colors (${rng.shuffle(secondaryValues).join(", ")}) are stacked one above another from top (1) to bottom (7).`
      : mode === "DAY_CITY"
        ? `Seven persons — ${entities.join(", ")} — travel to seven different cities (${rng.shuffle(secondaryValues).join(", ")}) on seven days from Monday to Sunday.`
        : `Seven bank officers — ${entities.join(", ")} — hold seven designations in decreasing order of seniority (${BANK_ROLES.join(" > ")}) and head seven departments (${rng.shuffle(secondaryValues).join(", ")}).`;

  const passageText = `Directions: Study the following information carefully and answer the questions given below.\n\n${intro}\n${allClues}`;

  const questions = buildFivePuzzleQuestions({
    puzzleType: "PUZZLE_HYBRID_MULTI_VARIABLE",
    subtopicName: "Hybrid Puzzles",
    difficulty,
    passageTitle,
    passageText,
    orderedEntities: displayEntities,
    slotLabels,
    entityNoun: mode === "BOX_COLOR" ? "box" : mode === "DAY_CITY" ? "person" : "officer",
    positionAboveWord: mode === "BOX_COLOR" ? "above" : mode === "DAY_CITY" ? "before" : "senior to",
    positionBelowWord: mode === "BOX_COLOR" ? "below" : mode === "DAY_CITY" ? "after" : "junior to",
    secondaryLabel: secondaryKey,
    secondaryByEntity,
    rng,
  });

  return {
    puzzleType: "PUZZLE_HYBRID_MULTI_VARIABLE",
    subtopicName: "Hybrid Puzzles",
    difficulty,
    solutionCount: orderSolved.solutionCount * attrSolved.solutionCount,
    passageTitle,
    passageText,
    questions,
  };
}
