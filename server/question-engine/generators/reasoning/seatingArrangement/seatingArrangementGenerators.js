// Place at: server/question-engine/generators/reasoning/seatingArrangement/seatingArrangementGenerators.js

/**
 * 10 Independent Seating Arrangement Puzzle Generators (Categories A–J)
 *
 * Workflow per arrangement:
 *  1. Build the exact geometry model for that category (independent orientation & symmetry).
 *  2. Sample a ground-truth seating assignment (and optional attributes if requested by exam profile).
 *  3. Generate geometry-authentic candidate clue statements & CSP constraints.
 *  4. Select clues incrementally and verify via `solveSeatingCSP` until `solutionCount === 1`
 *     (provably UNIQUE canonical solution!).
 *  5. Prune redundant clues while keeping `solutionCount === 1` so the puzzle stays crisp & realistic.
 */

import {
  ARRANGEMENT_TYPES,
  createLinearSingleRowGeometry,
  createLinearDoubleRowGeometry,
  createCircularCentreGeometry,
  createCircularOutsideGeometry,
  createCircularMixedGeometry,
  createSquareGeometry,
  createRectangularGeometry,
  createTriangularGeometry,
  createHexagonalGeometry,
  createParallelRowsGeometry,
} from "./seatingGeometry.js";
import { solveSeatingCSP } from "./seatingSolver.js";
import { SEATING_PERSON_SETS, ATTRIBUTE_POOLS } from "./seatingExamProfiles.js";

export function createRng(seedInput = Date.now()) {
  const seed = (Number(seedInput) >>> 0) || 0x9e3779b9;
  let state = seed;
  return {
    seed,
    random() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      return min + Math.floor(this.random() * (max - min + 1));
    },
    pick(arr) {
      return arr[Math.floor(this.random() * arr.length)];
    },
    shuffle(arr) {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

function ordinalWord(k) {
  if (k === 1) return "immediate";
  if (k === 2) return "second";
  if (k === 3) return "third";
  if (k === 4) return "fourth";
  return `${k}th`;
}

function formatShiftClue(personA, personB, dir, steps, attrRefB = null) {
  const targetRef = attrRefB ? `${personB} (${attrRefB})` : personB;
  const dirWord = dir === "LEFT" ? "left" : "right";
  if (steps === 1) {
    return `${personA} sits immediately to the ${dirWord} of ${targetRef}.`;
  }
  return `${personA} sits ${ordinalWord(steps)} to the ${dirWord} of ${targetRef}.`;
}

function assignOptionalAttributes(persons, useAttributes, rng) {
  if (!useAttributes) return { attrKey: null, attributesByPerson: {} };
  const attrKey = rng.pick(["profession", "city", "colour"]);
  const values = rng.shuffle(ATTRIBUTE_POOLS[attrKey]).slice(0, persons.length);
  const attributesByPerson = {};
  persons.forEach((p, idx) => {
    attributesByPerson[p] = { [attrKey]: values[idx] };
  });
  return { attrKey, attributesByPerson };
}

function describeAttribute(person, attrKey, attributesByPerson) {
  if (!attrKey || !attributesByPerson?.[person]?.[attrKey]) return null;
  const val = attributesByPerson[person][attrKey];
  if (attrKey === "profession") return `the ${val}`;
  if (attrKey === "city") return `from ${val}`;
  return `who likes ${val}`;
}

/**
 * Builds a minimal, provably unique (solutionCount === 1) clue set from a ground-truth arrangement.
 */
function synthesizeUniqueClues({
  geometry,
  assignment,
  baseConstraints = [],
  baseStatements = [],
  candidatePool = [],
  attributesByPerson = {},
  rng,
}) {
  const persons = [...assignment];
  const chosenConstraints = [...baseConstraints];
  const chosenStatements = [...baseStatements];

  // Shuffle candidates with slight preference for rich relative shifts & opposites
  const ordered = rng.shuffle(candidatePool);

  let solveRes = solveSeatingCSP({
    geometry,
    persons,
    constraints: chosenConstraints,
    attributesByPerson,
    maxSolutions: 2,
  });

  for (const cand of ordered) {
    if (solveRes.unique) break;
    // Skip duplicate statement text
    if (chosenStatements.includes(cand.text)) continue;

    chosenConstraints.push(cand.constraint);
    chosenStatements.push(cand.text);

    solveRes = solveSeatingCSP({
      geometry,
      persons,
      constraints: chosenConstraints,
      attributesByPerson,
      maxSolutions: 2,
    });
  }

  if (!solveRes.unique) {
    // Fallback: add minimal remaining immediate-right links to guarantee exact uniqueness
    for (let i = 0; i < geometry.seatCount; i++) {
      if (solveRes.unique) break;
      const pB = assignment[i];
      const rightIdx = geometry.stepRight(i, 1);
      if (rightIdx === null) continue;
      const pA = assignment[rightIdx];
      const text = formatShiftClue(pA, pB, "RIGHT", 1);
      if (chosenStatements.includes(text)) continue;
      chosenConstraints.push({ type: "RELATIVE_SHIFT", personA: pA, personB: pB, direction: "RIGHT", steps: 1 });
      chosenStatements.push(text);
      solveRes = solveSeatingCSP({
        geometry,
        persons,
        constraints: chosenConstraints,
        attributesByPerson,
        maxSolutions: 2,
      });
    }
  }

  if (!solveRes.unique) {
    return null;
  }

  // Prune redundant non-base clues (from end to start) while strictly preserving solutionCount === 1
  const fixedPrefix = baseConstraints.length;
  for (let i = chosenConstraints.length - 1; i >= fixedPrefix; i--) {
    const testConstraints = chosenConstraints.filter((_, idx) => idx !== i);
    const check = solveSeatingCSP({
      geometry,
      persons,
      constraints: testConstraints,
      attributesByPerson,
      maxSolutions: 2,
    });
    if (check.unique) {
      chosenConstraints.splice(i, 1);
      chosenStatements.splice(i, 1);
    }
  }

  return {
    constraints: chosenConstraints,
    clueStatements: chosenStatements,
    solvedArrangement: solveRes.solutions[0],
  };
}

/**
 * Generates geometry-authentic candidate clues for any arrangement.
 */
function buildCandidateClues(geometry, assignment, attrKey, attributesByPerson, rng) {
  const candidates = [];
  const n = geometry.seatCount;

  // 1. Relative Left/Right shifts (steps 1, 2, 3)
  for (let i = 0; i < n; i++) {
    const pB = assignment[i];
    const attrB = rng.random() < 0.35 ? describeAttribute(pB, attrKey, attributesByPerson) : null;
    for (const dir of ["LEFT", "RIGHT"]) {
      for (const steps of [1, 2, 3]) {
        const targetSeat = dir === "LEFT" ? geometry.stepLeft(i, steps) : geometry.stepRight(i, steps);
        if (targetSeat === null || targetSeat === i) continue;
        const pA = assignment[targetSeat];
        candidates.push({
          constraint: { type: "RELATIVE_SHIFT", personA: pA, personB: pB, direction: dir, steps },
          text: formatShiftClue(pA, pB, dir, steps, attrB),
        });
      }
    }
  }

  // 2. Opposite clues (ONLY when geometry supports true opposite — NEVER for Triangle or Single Row!)
  if (geometry.supportsOpposite) {
    for (let i = 0; i < n; i++) {
      const opp = geometry.getOpposite(i);
      if (opp === null || opp <= i) continue;
      const pA = assignment[i];
      const pB = assignment[opp];
      const verb =
        geometry.type === ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW ||
        geometry.type === ARRANGEMENT_TYPES.PARALLEL_ROWS
          ? geometry.facingMode === "FACING_AWAY"
            ? "sits back-to-back opposite"
            : "faces"
          : "sits opposite";
      candidates.push({
        constraint: { type: "OPPOSITE", personA: pA, personB: pB },
        text: `${pA} ${verb} ${pB}.`,
      });
    }
  }

  // 3. Between-count clues (for linear & cyclic arrangements)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const between = geometry.getBetweenCount(i, j);
      if (between >= 1 && between <= 3) {
        const pA = assignment[i];
        const pB = assignment[j];
        const word = between === 1 ? "Only one person sits" : `${between} persons sit`;
        candidates.push({
          constraint: { type: "BETWEEN_COUNT", personA: pA, personB: pB, count: between },
          text: `${word} between ${pA} and ${pB}.`,
        });
      }
    }
  }

  // 4. Geometry-specific positional type clues
  if (geometry.type === ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW) {
    const leftEndPerson = assignment[geometry.getExtremeLeftEnd()];
    const rightEndPerson = assignment[geometry.getExtremeRightEnd()];
    candidates.push({
      constraint: { type: "EXTREME_LEFT", person: leftEndPerson },
      text: `${leftEndPerson} sits at the extreme left end of the row.`,
    });
    candidates.push({
      constraint: { type: "EXTREME_RIGHT", person: rightEndPerson },
      text: `${rightEndPerson} sits at the extreme right end of the row.`,
    });
  }

  if (
    geometry.type === ARRANGEMENT_TYPES.SQUARE ||
    geometry.type === ARRANGEMENT_TYPES.TRIANGULAR
  ) {
    for (let i = 0; i < n; i++) {
      const p = assignment[i];
      const pt = geometry.seats[i].posType;
      candidates.push({
        constraint: { type: "POSITION_TYPE", person: p, posType: pt },
        text:
          pt === "CORNER"
            ? `${p} sits at one of the corners of the table.`
            : `${p} sits at the middle of one of the sides of the table.`,
      });
    }
  }

  if (geometry.type === ARRANGEMENT_TYPES.RECTANGULAR) {
    for (let i = 0; i < n; i++) {
      const p = assignment[i];
      const pt = geometry.seats[i].posType;
      const desc =
        pt === "CORNER"
          ? `${p} sits at one of the corners of the rectangular table.`
          : pt === "LONG_SIDE"
          ? `${p} sits at the middle of one of the longer sides of the table.`
          : `${p} sits at the middle of one of the shorter sides of the table.`;
      candidates.push({
        constraint: { type: "POSITION_TYPE", person: p, posType: pt },
        text: desc,
      });
    }
  }

  if (
    geometry.type === ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW ||
    geometry.type === ARRANGEMENT_TYPES.PARALLEL_ROWS
  ) {
    // Diagonal opposite clues for corner ends
    for (let i = 0; i < geometry.perRow; i++) {
      const diag = geometry.getDiagonalOpposite(i);
      if (diag !== null) {
        candidates.push({
          constraint: { type: "DIAGONAL_OPPOSITE", personA: assignment[i], personB: assignment[diag] },
          text: `${assignment[i]} sits diagonally opposite ${assignment[diag]}.`,
        });
      }
    }
  }

  return candidates;
}

// ============================================================================
// 10 INDEPENDENT ARRANGEMENT GENERATORS (Categories A–J)
// ============================================================================

export function generateLinearSingleRow({ count = 6, facing = null, useAttributes = false, rng }) {
  const dir = facing || (rng.random() < 0.7 ? "NORTH" : "SOUTH");
  const geometry = createLinearSingleRowGeometry({ count, facing: dir });
  const persons = rng.pick(SEATING_PERSON_SETS).slice(0, count);
  const assignment = rng.shuffle(persons);
  const { attrKey, attributesByPerson } = assignOptionalAttributes(persons, useAttributes, rng);

  // Anchor one extreme end so linear orientation is crisp
  const anchorLeft = rng.random() < 0.5;
  const anchorSeat = anchorLeft ? geometry.getExtremeLeftEnd() : geometry.getExtremeRightEnd();
  const anchorPerson = assignment[anchorSeat];
  const baseConstraints = [
    anchorLeft
      ? { type: "EXTREME_LEFT", person: anchorPerson }
      : { type: "EXTREME_RIGHT", person: anchorPerson },
  ];
  const baseStatements = [
    `${anchorPerson} sits at the extreme ${anchorLeft ? "left" : "right"} end of the row.`,
  ];

  const candidates = buildCandidateClues(geometry, assignment, attrKey, attributesByPerson, rng);
  const synth = synthesizeUniqueClues({
    geometry,
    assignment,
    baseConstraints,
    baseStatements,
    candidatePool: candidates,
    attributesByPerson,
    rng,
  });
  if (!synth) return null;

  const instructions = `${count} persons — ${persons.join(", ")} — are sitting in a straight line facing ${dir === "NORTH" ? "North" : "South"} (not necessarily in the same order).${attrKey ? ` Each person has a distinct ${attrKey}.` : ""}`;
  return { geometry, persons, instructions, attrKey, attributesByPerson, ...synth };
}

export function generateLinearDoubleRow({ perRow = 4, facingMode = "FACING_EACH_OTHER", useAttributes = false, rng }) {
  const geometry = createLinearDoubleRowGeometry({ perRow, facingMode });
  const total = perRow * 2;
  const persons = rng.pick(SEATING_PERSON_SETS).slice(0, total);
  const row1Persons = persons.slice(0, perRow);
  const row2Persons = persons.slice(perRow, total);
  const assignment = [...rng.shuffle(row1Persons), ...rng.shuffle(row2Persons)];
  const { attrKey, attributesByPerson } = assignOptionalAttributes(persons, useAttributes, rng);

  // Explicit row membership constraints (standard banking Double Row format!)
  const baseConstraints = [
    ...row1Persons.map((p) => ({ type: "IN_ROW", person: p, row: 1 })),
    ...row2Persons.map((p) => ({ type: "IN_ROW", person: p, row: 2 })),
  ];
  const row1Dir = facingMode === "FACING_AWAY" ? "North" : "South";
  const row2Dir = facingMode === "FACING_AWAY" ? "South" : "North";

  const candidates = buildCandidateClues(geometry, assignment, attrKey, attributesByPerson, rng);
  const synth = synthesizeUniqueClues({
    geometry,
    assignment,
    baseConstraints,
    baseStatements: [],
    candidatePool: candidates,
    attributesByPerson,
    rng,
  });
  if (!synth) return null;

  const instructions = `${total} persons are sitting in two parallel rows containing ${perRow} persons each. In Row 1, ${row1Persons.join(", ")} are seated and all of them are facing ${row1Dir}. In Row 2, ${row2Persons.join(", ")} are seated and all of them are facing ${row2Dir}. Thus, each member in Row 1 ${facingMode === "FACING_AWAY" ? "sits back-to-back opposite" : "faces"} another member of Row 2.`;
  return { geometry, persons, instructions, attrKey, attributesByPerson, ...synth };
}

export function generateCircularCentre({ count = 6, useAttributes = false, rng }) {
  const geometry = createCircularCentreGeometry({ count });
  const persons = rng.pick(SEATING_PERSON_SETS).slice(0, count);
  const assignment = rng.shuffle(persons);
  const { attrKey, attributesByPerson } = assignOptionalAttributes(persons, useAttributes, rng);

  const candidates = buildCandidateClues(geometry, assignment, attrKey, attributesByPerson, rng);
  const synth = synthesizeUniqueClues({
    geometry,
    assignment,
    baseConstraints: [],
    baseStatements: [],
    candidatePool: candidates,
    attributesByPerson,
    rng,
  });
  if (!synth) return null;

  const instructions = `${count} persons — ${persons.join(", ")} — are sitting around a circular table facing the centre (not necessarily in the same order).${attrKey ? ` Each person has a distinct ${attrKey}.` : ""}`;
  return { geometry, persons, instructions, attrKey, attributesByPerson, ...synth };
}

export function generateCircularOutside({ count = 6, useAttributes = false, rng }) {
  const geometry = createCircularOutsideGeometry({ count });
  const persons = rng.pick(SEATING_PERSON_SETS).slice(0, count);
  const assignment = rng.shuffle(persons);
  const { attrKey, attributesByPerson } = assignOptionalAttributes(persons, useAttributes, rng);

  const candidates = buildCandidateClues(geometry, assignment, attrKey, attributesByPerson, rng);
  const synth = synthesizeUniqueClues({
    geometry,
    assignment,
    baseConstraints: [],
    baseStatements: [],
    candidatePool: candidates,
    attributesByPerson,
    rng,
  });
  if (!synth) return null;

  const instructions = `${count} persons — ${persons.join(", ")} — are sitting around a circular table facing outside (away from the centre), not necessarily in the same order.${attrKey ? ` Each person has a distinct ${attrKey}.` : ""}`;
  return { geometry, persons, instructions, attrKey, attributesByPerson, ...synth };
}

export function generateCircularMixed({ count = 6, useAttributes = false, rng }) {
  // Alternating or balanced IN/OUT facing pattern — explicitly declared for every person!
  const facings = Array.from({ length: count }, (_, i) => (i % 2 === 0 ? "IN" : "OUT"));
  const geometry = createCircularMixedGeometry({ count, facings });
  const persons = rng.pick(SEATING_PERSON_SETS).slice(0, count);
  const assignment = rng.shuffle(persons);
  const { attrKey, attributesByPerson } = assignOptionalAttributes(persons, useAttributes, rng);

  // Explicitly define every person's facing direction (never assume facing!)
  const inPersons = assignment.filter((_, idx) => facings[idx] === "IN");
  const outPersons = assignment.filter((_, idx) => facings[idx] === "OUT");
  const baseConstraints = assignment.map((p, idx) => ({
    type: "FACING_EQUALS",
    person: p,
    facing: facings[idx],
  }));
  const baseStatements = [
    `${inPersons.join(", ")} face the centre, while ${outPersons.join(", ")} face outside (away from the centre).`,
  ];

  const candidates = buildCandidateClues(geometry, assignment, attrKey, attributesByPerson, rng);
  const synth = synthesizeUniqueClues({
    geometry,
    assignment,
    baseConstraints,
    baseStatements,
    candidatePool: candidates,
    attributesByPerson,
    rng,
  });
  if (!synth) return null;

  const instructions = `${count} persons — ${persons.join(", ")} — are sitting around a circular table such that adjacent seats face opposite directions (alternating centre and outside).`;
  return { geometry, persons, instructions, attrKey, attributesByPerson, ...synth };
}

export function generateSquare({ cornerFacing = "IN", sideFacing = "OUT", useAttributes = false, rng }) {
  const geometry = createSquareGeometry({ cornerFacing, sideFacing });
  const persons = rng.pick(SEATING_PERSON_SETS).slice(0, 8);
  const assignment = rng.shuffle(persons);
  const { attrKey, attributesByPerson } = assignOptionalAttributes(persons, useAttributes, rng);

  // Anchor one corner person to break symmetry cleanly
  const cornerPerson = assignment[0];
  const baseConstraints = [{ type: "POSITION_TYPE", person: cornerPerson, posType: "CORNER" }];
  const baseStatements = [`${cornerPerson} sits at one of the corners of the square table.`];

  const candidates = buildCandidateClues(geometry, assignment, attrKey, attributesByPerson, rng);
  const synth = synthesizeUniqueClues({
    geometry,
    assignment,
    baseConstraints,
    baseStatements,
    candidatePool: candidates,
    attributesByPerson,
    rng,
  });
  if (!synth) return null;

  const cDir = cornerFacing === "IN" ? "towards the centre" : "outside";
  const sDir = sideFacing === "IN" ? "towards the centre" : "outside";
  const instructions = `Eight persons — ${persons.join(", ")} — are sitting around a square table such that four sit at the four corners facing ${cDir} and four sit at the middle of each side facing ${sDir}.`;
  return { geometry, persons, instructions, attrKey, attributesByPerson, ...synth };
}

export function generateRectangular({ cornerFacing = "IN", sideFacing = "IN", useAttributes = false, rng }) {
  const geometry = createRectangularGeometry({ cornerFacing, sideFacing });
  const persons = rng.pick(SEATING_PERSON_SETS).slice(0, 8);
  const assignment = rng.shuffle(persons);
  const { attrKey, attributesByPerson } = assignOptionalAttributes(persons, useAttributes, rng);

  // Anchor one long-side person so long vs short sides are explicitly distinguished
  const longSidePerson = assignment[1];
  const baseConstraints = [{ type: "POSITION_TYPE", person: longSidePerson, posType: "LONG_SIDE" }];
  const baseStatements = [`${longSidePerson} sits at the middle of one of the longer sides of the rectangular table.`];

  const candidates = buildCandidateClues(geometry, assignment, attrKey, attributesByPerson, rng);
  const synth = synthesizeUniqueClues({
    geometry,
    assignment,
    baseConstraints,
    baseStatements,
    candidatePool: candidates,
    attributesByPerson,
    rng,
  });
  if (!synth) return null;

  const instructions = `Eight persons — ${persons.join(", ")} — are sitting around a rectangular table (four at the corners, two at the middle of the longer sides, and two at the middle of the shorter sides), all facing ${cornerFacing === "IN" ? "the centre" : "outside"}.`;
  return { geometry, persons, instructions, attrKey, attributesByPerson, ...synth };
}

export function generateTriangular({ cornerFacing = "IN", sideFacing = "OUT", useAttributes = false, rng }) {
  const geometry = createTriangularGeometry({ cornerFacing, sideFacing });
  const persons = rng.pick(SEATING_PERSON_SETS).slice(0, 6);
  const assignment = rng.shuffle(persons);
  const { attrKey, attributesByPerson } = assignOptionalAttributes(persons, useAttributes, rng);

  const cornerPerson = assignment[0];
  const baseConstraints = [{ type: "POSITION_TYPE", person: cornerPerson, posType: "CORNER" }];
  const baseStatements = [`${cornerPerson} sits at one of the three corners of the triangular table.`];

  const candidates = buildCandidateClues(geometry, assignment, attrKey, attributesByPerson, rng);
  const synth = synthesizeUniqueClues({
    geometry,
    assignment,
    baseConstraints,
    baseStatements,
    candidatePool: candidates,
    attributesByPerson,
    rng,
  });
  if (!synth) return null;

  const cDir = cornerFacing === "IN" ? "the centre" : "outside";
  const sDir = sideFacing === "IN" ? "the centre" : "outside";
  const instructions = `Six persons — ${persons.join(", ")} — are sitting around a triangular table such that three sit at the three corners facing ${cDir} and three sit at the middle of the three sides facing ${sDir}.`;
  return { geometry, persons, instructions, attrKey, attributesByPerson, ...synth };
}

export function generateHexagonal({ facing = "IN", useAttributes = false, rng }) {
  const geometry = createHexagonalGeometry({ facing });
  const persons = rng.pick(SEATING_PERSON_SETS).slice(0, 6);
  const assignment = rng.shuffle(persons);
  const { attrKey, attributesByPerson } = assignOptionalAttributes(persons, useAttributes, rng);

  const candidates = buildCandidateClues(geometry, assignment, attrKey, attributesByPerson, rng);
  const synth = synthesizeUniqueClues({
    geometry,
    assignment,
    baseConstraints: [],
    baseStatements: [],
    candidatePool: candidates,
    attributesByPerson,
    rng,
  });
  if (!synth) return null;

  const instructions = `Six persons — ${persons.join(", ")} — are sitting at the six corners of a hexagonal table facing ${facing === "IN" ? "the centre" : "outside"} (not necessarily in the same order).`;
  return { geometry, persons, instructions, attrKey, attributesByPerson, ...synth };
}

export function generateParallelRows({ perRow = 5, facingMode = "FACING_EACH_OTHER", useAttributes = false, rng }) {
  const geometry = createParallelRowsGeometry({ perRow, facingMode });
  const total = perRow * 2;
  const persons = rng.pick(SEATING_PERSON_SETS).slice(0, total);
  const row1Persons = persons.slice(0, perRow);
  const row2Persons = persons.slice(perRow, total);
  const assignment = [...rng.shuffle(row1Persons), ...rng.shuffle(row2Persons)];
  const { attrKey, attributesByPerson } = assignOptionalAttributes(persons, useAttributes, rng);

  const baseConstraints = [
    ...row1Persons.map((p) => ({ type: "IN_ROW", person: p, row: 1 })),
    ...row2Persons.map((p) => ({ type: "IN_ROW", person: p, row: 2 })),
  ];
  const row1Dir = facingMode === "FACING_AWAY" ? "North" : "South";
  const row2Dir = facingMode === "FACING_AWAY" ? "South" : "North";

  const candidates = buildCandidateClues(geometry, assignment, attrKey, attributesByPerson, rng);
  const synth = synthesizeUniqueClues({
    geometry,
    assignment,
    baseConstraints,
    baseStatements: [],
    candidatePool: candidates,
    attributesByPerson,
    rng,
  });
  if (!synth) return null;

  const instructions = `${total} persons are seated in two parallel rows of ${perRow} persons each. Row 1 (${row1Persons.join(", ")}) faces ${row1Dir}, and Row 2 (${row2Persons.join(", ")}) faces ${row2Dir}, such that each person in Row 1 is exactly opposite a person in Row 2.`;
  return { geometry, persons, instructions, attrKey, attributesByPerson, ...synth };
}

export const ARRANGEMENT_GENERATOR_MAP = {
  [ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW]: generateLinearSingleRow,
  [ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW]: generateLinearDoubleRow,
  [ARRANGEMENT_TYPES.CIRCULAR_CENTRE]: generateCircularCentre,
  [ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE]: generateCircularOutside,
  [ARRANGEMENT_TYPES.CIRCULAR_MIXED]: generateCircularMixed,
  [ARRANGEMENT_TYPES.SQUARE]: generateSquare,
  [ARRANGEMENT_TYPES.RECTANGULAR]: generateRectangular,
  [ARRANGEMENT_TYPES.TRIANGULAR]: generateTriangular,
  [ARRANGEMENT_TYPES.HEXAGONAL]: generateHexagonal,
  [ARRANGEMENT_TYPES.PARALLEL_ROWS]: generateParallelRows,
};