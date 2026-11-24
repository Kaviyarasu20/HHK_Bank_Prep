// Place at: server/question-engine/generators/reasoning/seatingArrangement/seatingSolver.js

/**
 * Deterministic Constraint-Satisfaction (CSP) Backtracking Solver for Seating Arrangements
 *
 * Guarantees:
 *  - Evaluates all clue constraints strictly against the arrangement's exact geometry & facing rules
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
export function checkConstraint(constraint, posOfPerson, geometry, attributesByPerson = {}) {
  const getPos = (person) =>
    posOfPerson.has(person) ? posOfPerson.get(person) : null;

  switch (constraint.type) {
    case "FIXED_POS": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return p === constraint.seatIndex;
    }

    case "POSITION_TYPE": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return geometry.seats[p].posType === constraint.posType;
    }

    case "NOT_POSITION_TYPE": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return geometry.seats[p].posType !== constraint.posType;
    }

    case "IN_ROW": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return geometry.seats[p].row === constraint.row;
    }

    case "FACING_EQUALS": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return geometry.seats[p].facing === constraint.facing;
    }

    case "RELATIVE_SHIFT": {
      // personA sits `steps` to the `direction` ('LEFT'|'RIGHT') of personB
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pB === null) return true;
      const expectedSeat =
        constraint.direction === "LEFT"
          ? geometry.stepLeft(pB, constraint.steps)
          : geometry.stepRight(pB, constraint.steps);
      if (expectedSeat === null) return false; // out of bounds for B's seat
      if (pA === null) return true;
      return pA === expectedSeat;
    }

    case "IMMEDIATE_NEIGHBOUR": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return geometry.getNeighbours(pB).includes(pA);
    }

    case "NOT_NEIGHBOUR": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return !geometry.getNeighbours(pB).includes(pA);
    }

    case "OPPOSITE": {
      if (!geometry.supportsOpposite) return false;
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pB !== null && geometry.getOpposite(pB) === null) return false;
      if (pA === null || pB === null) return true;
      return geometry.getOpposite(pB) === pA;
    }

    case "DIAGONAL_OPPOSITE": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pB !== null && geometry.getDiagonalOpposite(pB) === null) return false;
      if (pA === null || pB === null) return true;
      return geometry.getDiagonalOpposite(pB) === pA;
    }

    case "BETWEEN_COUNT": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return geometry.getBetweenCount(pA, pB) === constraint.count;
    }

    case "EXTREME_LEFT": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return p === geometry.getExtremeLeftEnd();
    }

    case "EXTREME_RIGHT": {
      const p = getPos(constraint.person);
      if (p === null) return true;
      return p === geometry.getExtremeRightEnd();
    }

    case "SAME_ROW": {
      const pA = getPos(constraint.personA);
      const pB = getPos(constraint.personB);
      if (pA === null || pB === null) return true;
      return geometry.seats[pA].row === geometry.seats[pB].row;
    }

    case "ATTRIBUTE_AT_SEAT_TYPE": {
      const person = Object.keys(attributesByPerson).find(
        (id) => attributesByPerson[id]?.[constraint.attrKey] === constraint.attrValue
      );
      if (!person) return false;
      const p = getPos(person);
      if (p === null) return true;
      return geometry.seats[p].posType === constraint.posType;
    }

    default:
      return true;
  }
}

/**
 * Deterministic CSP Solver.
 * Finds all distinct canonical solutions up to `maxSolutions` (default 2 for fast uniqueness proof).
 */
export function solveSeatingCSP({
  geometry,
  persons,
  constraints = [],
  attributesByPerson = {},
  maxSolutions = 2,
  maxNodes = 60000,
}) {
  const n = geometry.seatCount;
  if (persons.length !== n) {
    return {
      status: "INVALID_COUNT",
      unique: false,
      solutionCount: 0,
      solutions: [],
      nodesExplored: 0,
    };
  }

  // Order persons by constraint degree (most-constrained first for instant backtracking!)
  const degree = new Map(persons.map((p) => [p, 0]));
  for (const c of constraints) {
    for (const key of ["person", "personA", "personB"]) {
      if (c[key] && degree.has(c[key])) {
        degree.set(c[key], degree.get(c[key]) + (c.type === "FIXED_POS" ? 10 : 2));
      }
    }
  }
  const orderedPersons = [...persons].sort((a, b) => degree.get(b) - degree.get(a));

  // Pre-compute unary allowed seats per person for instant domain pruning
  const allowedSeatsByPerson = new Map();
  for (const person of orderedPersons) {
    const allowed = [];
    for (let seat = 0; seat < n; seat++) {
      const probe = new Map([[person, seat]]);
      let ok = true;
      for (const c of constraints) {
        if (
          c.type === "FIXED_POS" ||
          c.type === "POSITION_TYPE" ||
          c.type === "NOT_POSITION_TYPE" ||
          c.type === "IN_ROW" ||
          c.type === "FACING_EQUALS" ||
          c.type === "EXTREME_LEFT" ||
          c.type === "EXTREME_RIGHT"
        ) {
          if (!checkConstraint(c, probe, geometry, attributesByPerson)) {
            ok = false;
            break;
          }
        }
      }
      if (ok) allowed.push(seat);
    }
    allowedSeatsByPerson.set(person, allowed);
    if (allowed.length === 0) {
      return { status: "NO_SOLUTION", unique: false, solutionCount: 0, solutions: [], nodesExplored: 0 };
    }
  }

  // Symmetry breaking for cyclic geometries: anchor first person to first valid symmetry orbit seat
  // (ONLY if no FIXED_POS constraint exists)
  const hasFixedSeat = constraints.some((c) => c.type === "FIXED_POS");
  if (geometry.isCyclic && !hasFixedSeat) {
    const first = orderedPersons[0];
    const dom = allowedSeatsByPerson.get(first);
    // Keep only one representative per symmetry orbit (e.g. seat 0 for circle, seats 0..1 for square/triangle, 0..3 for rectangle)
    const orbitStep =
      geometry.type === "RECTANGULAR"
        ? 4
        : geometry.type === "SQUARE" || geometry.type === "TRIANGULAR"
        ? 2
        : 1;
    // For mixed circular where facings vary, keep all seats in domain (canonicalize handles exact dedup)
    if (geometry.type !== "CIRCULAR_MIXED") {
      const reduced = dom.filter((s) => s < orbitStep);
      if (reduced.length > 0) allowedSeatsByPerson.set(first, reduced);
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
    const domain = allowedSeatsByPerson.get(person);

    for (const seat of domain) {
      if (assignment[seat] !== null) continue;

      assignment[seat] = person;
      posOfPerson.set(person, seat);

      let valid = true;
      for (const c of constraints) {
        if (!checkConstraint(c, posOfPerson, geometry, attributesByPerson)) {
          valid = false;
          break;
        }
      }

      if (valid) {
        backtrack(idx + 1);
      }

      posOfPerson.delete(person);
      assignment[seat] = null;

      if (solutions.length >= maxSolutions || aborted) return;
    }
  }

  backtrack(0);

  return {
    status: aborted
      ? "SEARCH_LIMIT"
      : solutions.length === 0
      ? "NO_SOLUTION"
      : solutions.length === 1
      ? "UNIQUE"
      : "MULTIPLE_SOLUTIONS",
    unique: !aborted && solutions.length === 1,
    solutionCount: solutions.length,
    solutions,
    nodesExplored,
  };
}