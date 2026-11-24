// Place at: server/question-engine/generators/reasoning/floorArrangement/floorSolver.js

/**
 * HHK Floor Arrangement - Deterministic CSP Backtracking Solver
 *
 * Guarantees:
 *  - Evaluates all clue constraints strictly against the floor/building/flat geometry
 *  - Enumerates valid arrangements with early exit once 2 distinct canonical solutions are found
 *  - Distinguishes:
 *      * 0 solutions -> CONTRADICTORY / IMPOSSIBLE
 *      * 1 unique canonical solution -> VALID & UNAMBIGUOUS
 *      * >=2 distinct canonical solutions -> AMBIGUOUS (rejected!)
 */

/**
 * Checks whether a partial or complete assignment satisfies a single constraint.
 * Returns true if satisfied OR not yet falsifiable (some referenced persons unassigned);
 * returns false immediately if violated (enables fast pruning during backtracking).
 */
export function checkFloorConstraint(constraint, posOfPerson, geometry, attributesByPerson = {}) {
  const getPos = (person) => (posOfPerson.has(person) ? posOfPerson.get(person) : null);
  const pos = geometry.positions;

  switch (constraint.type) {
    case "FIXED_POSITION": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return p === constraint.positionIndex;
    }

    case "FIXED_FLOOR": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return pos[p].floor === constraint.floor;
    }

    case "FIXED_BUILDING": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return pos[p].building === constraint.building;
    }

    case "FIXED_FLAT": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return pos[p].flat === constraint.flat;
    }

    case "RELATIVE_SHIFT": {
      // personA is `steps` positions above/below personB within same building
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pB === null) return true;
      const expected =
        constraint.direction === "ABOVE" ? geometry.stepAbove(pB) : geometry.stepBelow(pB);
      // For multi-step, walk
      let seat = pB;
      for (let i = 0; i < constraint.steps; i++) {
        seat =
          constraint.direction === "ABOVE" ? geometry.stepAbove(seat) : geometry.stepBelow(seat);
        if (seat === null) break;
      }
      if (seat === null) return false;
      if (pA === null) return true;
      return pA === seat;
    }

    case "IMMEDIATE_ABOVE": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return geometry.stepAbove(pB) === pA;
    }

    case "IMMEDIATE_BELOW": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return geometry.stepBelow(pB) === pA;
    }

    case "NOT_ADJACENT": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return !geometry.getNeighbours(pB).includes(pA);
    }

    case "BETWEEN_COUNT": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return geometry.getBetweenCount(pA, pB) === constraint.count;
    }

    case "TOPMOST": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      if (constraint.building) {
        return p === geometry.getTopIndex(constraint.building);
      }
      return p === geometry.getTopIndex();
    }

    case "BOTTOMMOST": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      if (constraint.building) {
        return p === geometry.getBottomIndex(constraint.building);
      }
      return p === geometry.getBottomIndex();
    }

    case "NOT_TOPMOST": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      if (constraint.building) {
        return p !== geometry.getTopIndex(constraint.building);
      }
      return p !== geometry.getTopIndex();
    }

    case "NOT_BOTTOMMOST": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      if (constraint.building) {
        return p !== geometry.getBottomIndex(constraint.building);
      }
      return p !== geometry.getBottomIndex();
    }

    case "ODD_FLOOR": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return geometry.isOdd(p);
    }

    case "EVEN_FLOOR": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return geometry.isEven(p);
    }

    case "SAME_BUILDING": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return pos[pA].building === pos[pB].building;
    }

    case "DIFFERENT_BUILDING": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return pos[pA].building !== pos[pB].building;
    }

    case "SAME_FLOOR_DIFFERENT_BUILDING": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return (
        pos[pA].floor === pos[pB].floor && pos[pA].building !== pos[pB].building
      );
    }

    case "SAME_FLOOR_SAME_BUILDING": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return pos[pA].floor === pos[pB].floor && pos[pA].building === pos[pB].building;
    }

    case "HIGHER_FLOOR_THAN": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return pos[pA].floor > pos[pB].floor;
    }

    case "LOWER_FLOOR_THAN": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return pos[pA].floor < pos[pB].floor;
    }

    case "FLOOR_GREATER_THAN": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return pos[p].floor > constraint.value;
    }

    case "FLOOR_LESS_THAN": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return pos[p].floor < constraint.value;
    }

    case "ATTRIBUTE_EQUALS": {
      const person = Object.keys(attributesByPerson).find(
        (id) => attributesByPerson[id]?.[constraint.attrKey] === constraint.attrValue
      );
      if (!person) return false;
      const p = getPos(person);
      if (p === null) return true;
      if (constraint.positionIndex !== undefined) return p === constraint.positionIndex;
      if (constraint.floor !== undefined) return pos[p].floor === constraint.floor;
      return true;
    }

    case "ATTRIBUTE_ABOVE": {
      const personA = Object.keys(attributesByPerson).find(
        (id) => attributesByPerson[id]?.[constraint.attrKeyA] === constraint.attrValueA
      );
      const personB = Object.keys(attributesByPerson).find(
        (id) => attributesByPerson[id]?.[constraint.attrKeyB] === constraint.attrValueB
      );
      if (!personA || !personB) return true;
      const pA = getPos(personA);
      const pB = getPos(personB);
      if (pA === null || pB === null) return true;
      return pos[pA].floor > pos[pB].floor;
    }

    default:
      return true;
  }
}

/**
 * Deterministic CSP Solver for floor arrangements.
 * Finds all distinct canonical solutions up to maxSolutions (default 2 for uniqueness proof).
 */
export function solveFloorCSP({
  geometry,
  persons,
  constraints = [],
  attributesByPerson = {},
  maxSolutions = 2,
  maxNodes = 5000000,
}) {
  const n = geometry.posCount;
  if (persons.length !== n) {
    return {
      status: "INVALID_COUNT",
      unique: false,
      solutionCount: 0,
      solutions: [],
      nodesExplored: 0,
    };
  }

  // Order persons by constraint degree (most-constrained first)
  const degree = new Map(persons.map((p) => [p, 0]));
  for (const c of constraints) {
    for (const key of ["person", "personA", "personB"]) {
      if (c[key] && degree.has(c[key])) {
        degree.set(c[key], degree.get(c[key]) + (c.type === "FIXED_POSITION" ? 10 : 2));
      }
    }
  }
  const orderedPersons = [...persons].sort((a, b) => degree.get(b) - degree.get(a));

  // Pre-compute unary allowed positions per person
  const allowedPositionsByPerson = new Map();
  for (const person of orderedPersons) {
    const allowed = [];
    for (let seat = 0; seat < n; seat++) {
      const probe = new Map([[person, seat]]);
      let ok = true;
      for (const c of constraints) {
        if (
          c.type === "FIXED_POSITION" ||
          c.type === "FIXED_FLOOR" ||
          c.type === "FIXED_BUILDING" ||
          c.type === "FIXED_FLAT" ||
          c.type === "TOPMOST" ||
          c.type === "BOTTOMMOST" ||
          c.type === "NOT_TOPMOST" ||
          c.type === "NOT_BOTTOMMOST" ||
          c.type === "ODD_FLOOR" ||
          c.type === "EVEN_FLOOR" ||
          c.type === "FLOOR_GREATER_THAN" ||
          c.type === "FLOOR_LESS_THAN"
        ) {
          if (!checkFloorConstraint(c, probe, geometry, attributesByPerson)) {
            ok = false;
            break;
          }
        }
      }
      if (ok) allowed.push(seat);
    }
    allowedPositionsByPerson.set(person, allowed);
    if (allowed.length === 0) {
      return { status: "NO_SOLUTION", unique: false, solutionCount: 0, solutions: [], nodesExplored: 0 };
    }
  }

  const assignment = Array(n).fill(null);
  const posOfPerson = new Map();
  const seenCanonical = new Set();
  const solutions = [];
  let nodesExplored = 0;
  let aborted = false;

  function backtrack(idx) {
    if (solutions.length >= maxSolutions || aborted) return;
    nodesExplored++;
    if (nodesExplored > maxNodes) {
      aborted = true;
      return;
    }

    if (idx === orderedPersons.length) {
      const canon = geometry.canonicalize(assignment);
      if (!seenCanonical.has(canon)) {
        seenCanonical.add(canon);
        solutions.push([...assignment]);
      }
      return;
    }

    const person = orderedPersons[idx];
    const domain = allowedPositionsByPerson.get(person);

    for (const seat of domain) {
      if (assignment[seat] !== null) continue;

      assignment[seat] = person;
      posOfPerson.set(person, seat);

      let valid = true;
      for (const c of constraints) {
        if (!checkFloorConstraint(c, posOfPerson, geometry, attributesByPerson)) {
          valid = false;
          break;
        }
      }

      if (valid) backtrack(idx + 1);

      posOfPerson.delete(person);
      assignment[seat] = null;

      if (solutions.length >= maxSolutions || aborted) return;
    }
  }

  backtrack(0);

  return {
    status: aborted ? "SEARCH_LIMIT" : solutions.length === 0 ? "NO_SOLUTION" : solutions.length === 1 ? "UNIQUE" : "MULTIPLE_SOLUTIONS",
    unique: !aborted && solutions.length === 1,
    solutionCount: solutions.length,
    solutions,
    nodesExplored,
  };
}
