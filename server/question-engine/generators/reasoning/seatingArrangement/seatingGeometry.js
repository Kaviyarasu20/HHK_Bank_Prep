// Place at: server/question-engine/generators/reasoning/seatingArrangement/seatingGeometry.js

/**
 * 10 Independent Geometric & Directional Models for Banking Seating Arrangements
 *
 * Strictly separates directional semantics for every geometry:
 *  - LINEAR_SINGLE_ROW: ordered 0..N-1; North -> Left is -1, Right is +1; South -> Left is +1, Right is -1.
 *  - LINEAR_DOUBLE_ROW: Row 1 (South, 0..K-1) facing Row 2 (North, K..2K-1); opposite(i) = i + K.
 *  - CIRCULAR_CENTRE: cyclic 0..N-1 clockwise; facing IN -> Left = Clockwise (+1), Right = Anticlockwise (-1).
 *  - CIRCULAR_OUTSIDE: cyclic 0..N-1 clockwise; facing OUT -> Left = Anticlockwise (-1), Right = Clockwise (+1).
 *  - CIRCULAR_MIXED: cyclic 0..N-1 with per-seat facing ('IN'|'OUT'); left/right computed per individual seat!
 *  - SQUARE: 8 seats (corners 0,2,4,6; sides 1,3,5,7); 4-fold rotational symmetry.
 *  - RECTANGULAR: 8 seats (corners 0,2,4,6; long sides 1,5; short sides 3,7); 2-fold rotational symmetry.
 *  - TRIANGULAR: 6 seats (corners 0,2,4; sides 1,3,5); NO circular opposite! 3-fold rotational symmetry.
 *  - HEXAGONAL: 6 corners (0..5); opposite(i) = (i+3)%6; 6-fold rotational symmetry.
 *  - PARALLEL_ROWS: independent 2-row geometry with configurable facing (facing each other or away) & diagonal opposites.
 */

export const ARRANGEMENT_TYPES = {
  LINEAR_SINGLE_ROW: "LINEAR_SINGLE_ROW",
  LINEAR_DOUBLE_ROW: "LINEAR_DOUBLE_ROW",
  CIRCULAR_CENTRE: "CIRCULAR_CENTRE",
  CIRCULAR_OUTSIDE: "CIRCULAR_OUTSIDE",
  CIRCULAR_MIXED: "CIRCULAR_MIXED",
  SQUARE: "SQUARE",
  RECTANGULAR: "RECTANGULAR",
  TRIANGULAR: "TRIANGULAR",
  HEXAGONAL: "HEXAGONAL",
  PARALLEL_ROWS: "PARALLEL_ROWS",
};

/**
 * Canonicalizes a seating assignment array under a list of symmetry index permutations
 * so equivalent rotations are treated as ONE unique arrangement.
 */
function canonicalizeBySymmetries(assignment, symmetries, facings = null) {
  let best = null;
  for (const perm of symmetries) {
    const key = perm
      .map((idx) => `${assignment[idx] ?? "_"}:${facings ? facings[idx] : ""}`)
      .join("|");
    if (best === null || key < best) best = key;
  }
  return best;
}

function buildCyclicRotations(n, step = 1) {
  const perms = [];
  for (let shift = 0; shift < n; shift += step) {
    const perm = [];
    for (let i = 0; i < n; i++) perm.push((i + shift) % n);
    perms.push(perm);
  }
  return perms;
}

/**
 * 1. LINEAR SEATING — SINGLE ROW
 */
export function createLinearSingleRowGeometry({ count = 6, facing = "NORTH" } = {}) {
  const dir = String(facing).toUpperCase() === "SOUTH" ? "SOUTH" : "NORTH";
  const seats = Array.from({ length: count }, (_, i) => ({
    index: i,
    label: `Position ${i + 1}`,
    row: 1,
    posType: i === 0 || i === count - 1 ? "EXTREME_END" : "MIDDLE",
    facing: dir,
  }));

  // Facing NORTH: Left = index - k, Right = index + k
  // Facing SOUTH: Left = index + k, Right = index - k
  const stepLeft = (idx, k = 1) => {
    const next = dir === "NORTH" ? idx - k : idx + k;
    return next >= 0 && next < count ? next : null;
  };
  const stepRight = (idx, k = 1) => {
    const next = dir === "NORTH" ? idx + k : idx - k;
    return next >= 0 && next < count ? next : null;
  };

  return {
    type: ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW,
    label: `Linear Seating – Single Row (Facing ${dir === "NORTH" ? "North" : "South"})`,
    seatCount: count,
    isCyclic: false,
    supportsOpposite: false,
    seats,
    stepLeft,
    stepRight,
    getOpposite: () => null,
    getDiagonalOpposite: () => null,
    getNeighbours: (idx) => [idx - 1, idx + 1].filter((x) => x >= 0 && x < count),
    getBetweenCount: (a, b) => Math.abs(a - b) - 1,
    getExtremeLeftEnd: () => (dir === "NORTH" ? 0 : count - 1),
    getExtremeRightEnd: () => (dir === "NORTH" ? count - 1 : 0),
    canonicalize: (assignment) => assignment.map((x) => x ?? "_").join("|"),
  };
}

/**
 * 2. LINEAR SEATING — DOUBLE ROW (Facing each other: Row 1 South, Row 2 North)
 */
export function createLinearDoubleRowGeometry({ perRow = 4, facingMode = "FACING_EACH_OTHER" } = {}) {
  const count = perRow * 2;
  const row1Facing = facingMode === "FACING_AWAY" ? "NORTH" : "SOUTH";
  const row2Facing = facingMode === "FACING_AWAY" ? "SOUTH" : "NORTH";

  const seats = [];
  for (let c = 0; c < perRow; c++) {
    seats.push({
      index: c,
      label: `Row 1 - Seat ${c + 1}`,
      row: 1,
      col: c,
      posType: c === 0 || c === perRow - 1 ? "EXTREME_END" : "MIDDLE",
      facing: row1Facing,
    });
  }
  for (let c = 0; c < perRow; c++) {
    seats.push({
      index: perRow + c,
      label: `Row 2 - Seat ${c + 1}`,
      row: 2,
      col: c,
      posType: c === 0 || c === perRow - 1 ? "EXTREME_END" : "MIDDLE",
      facing: row2Facing,
    });
  }

  const stepLeft = (idx, k = 1) => {
    const s = seats[idx];
    const nextCol = s.facing === "NORTH" ? s.col - k : s.col + k;
    if (nextCol < 0 || nextCol >= perRow) return null;
    return (s.row === 1 ? 0 : perRow) + nextCol;
  };
  const stepRight = (idx, k = 1) => {
    const s = seats[idx];
    const nextCol = s.facing === "NORTH" ? s.col + k : s.col - k;
    if (nextCol < 0 || nextCol >= perRow) return null;
    return (s.row === 1 ? 0 : perRow) + nextCol;
  };
  const getOpposite = (idx) => (idx < perRow ? idx + perRow : idx - perRow);
  const getDiagonalOpposite = (idx) => {
    const s = seats[idx];
    if (s.col === 0) return (s.row === 1 ? perRow : 0) + (perRow - 1);
    if (s.col === perRow - 1) return s.row === 1 ? perRow : 0;
    return null;
  };

  return {
    type: ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW,
    label: "Linear Seating – Double Row",
    seatCount: count,
    perRow,
    facingMode,
    isCyclic: false,
    supportsOpposite: true,
    seats,
    stepLeft,
    stepRight,
    getOpposite,
    getDiagonalOpposite,
    getNeighbours: (idx) => {
      const s = seats[idx];
      const base = s.row === 1 ? 0 : perRow;
      return [s.col - 1, s.col + 1]
        .filter((c) => c >= 0 && c < perRow)
        .map((c) => base + c);
    },
    getBetweenCount: (a, b) => {
      if (seats[a].row !== seats[b].row) return -1;
      return Math.abs(seats[a].col - seats[b].col) - 1;
    },
    canonicalize: (assignment) => assignment.map((x) => x ?? "_").join("|"),
  };
}

/**
 * Shared cyclic ring directional helper (used with strict per-seat orientation rules).
 * Convention (Indian banking standard, clockwise index 0..N-1):
 *  - Facing IN (Centre): Left = Clockwise (+1), Right = Anticlockwise (-1)
 *  - Facing OUT (Outside): Left = Anticlockwise (-1), Right = Clockwise (+1)
 */
function buildCyclicGeometry({
  type,
  label,
  seatCount,
  seats,
  supportsOpposite,
  oppositeFn,
  symmetryStep,
}) {
  const mod = (x) => ((x % seatCount) + seatCount) % seatCount;

  const stepLeft = (idx, k = 1) => {
    const facing = seats[idx].facing;
    return facing === "IN" ? mod(idx + k) : mod(idx - k);
  };
  const stepRight = (idx, k = 1) => {
    const facing = seats[idx].facing;
    return facing === "IN" ? mod(idx - k) : mod(idx + k);
  };

  const symmetries = buildCyclicRotations(seatCount, symmetryStep);
  const facingsArr = seats.map((s) => s.facing);

  return {
    type,
    label,
    seatCount,
    isCyclic: true,
    supportsOpposite,
    seats,
    stepLeft,
    stepRight,
    getOpposite: oppositeFn,
    getDiagonalOpposite: () => null,
    getNeighbours: (idx) => [mod(idx - 1), mod(idx + 1)],
    getBetweenCount: (a, b) => {
      const cw = mod(b - a) - 1;
      const ccw = mod(a - b) - 1;
      return Math.min(cw, ccw);
    },
    canonicalize: (assignment) => canonicalizeBySymmetries(assignment, symmetries, facingsArr),
  };
}

/**
 * 3. CIRCULAR SEATING — FACING CENTRE (Left = Clockwise, Right = Anticlockwise)
 */
export function createCircularCentreGeometry({ count = 6 } = {}) {
  const seats = Array.from({ length: count }, (_, i) => ({
    index: i,
    label: `Seat ${i + 1}`,
    row: 1,
    posType: "CIRCLE",
    facing: "IN",
  }));
  return buildCyclicGeometry({
    type: ARRANGEMENT_TYPES.CIRCULAR_CENTRE,
    label: "Circular Seating – Facing Centre",
    seatCount: count,
    seats,
    supportsOpposite: count % 2 === 0,
    oppositeFn: (idx) => (count % 2 === 0 ? (idx + count / 2) % count : null),
    symmetryStep: 1,
  });
}

/**
 * 4. CIRCULAR SEATING — FACING OUTSIDE (Left = Anticlockwise, Right = Clockwise)
 */
export function createCircularOutsideGeometry({ count = 6 } = {}) {
  const seats = Array.from({ length: count }, (_, i) => ({
    index: i,
    label: `Seat ${i + 1}`,
    row: 1,
    posType: "CIRCLE",
    facing: "OUT",
  }));
  return buildCyclicGeometry({
    type: ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE,
    label: "Circular Seating – Facing Outside",
    seatCount: count,
    seats,
    supportsOpposite: count % 2 === 0,
    oppositeFn: (idx) => (count % 2 === 0 ? (idx + count / 2) % count : null),
    symmetryStep: 1,
  });
}

/**
 * 5. CIRCULAR SEATING — MIXED FACING (Per-seat explicit 'IN' or 'OUT')
 */
export function createCircularMixedGeometry({ count = 6, facings = null } = {}) {
  const seatFacings =
    Array.isArray(facings) && facings.length === count
      ? facings.map((f) => (String(f).toUpperCase() === "OUT" ? "OUT" : "IN"))
      : Array.from({ length: count }, (_, i) => (i % 2 === 0 ? "IN" : "OUT"));

  const seats = seatFacings.map((f, i) => ({
    index: i,
    label: `Seat ${i + 1}`,
    row: 1,
    posType: "CIRCLE",
    facing: f,
  }));

  return buildCyclicGeometry({
    type: ARRANGEMENT_TYPES.CIRCULAR_MIXED,
    label: "Circular Seating – Mixed Facing",
    seatCount: count,
    seats,
    supportsOpposite: count % 2 === 0,
    oppositeFn: (idx) => (count % 2 === 0 ? (idx + count / 2) % count : null),
    symmetryStep: 1,
  });
}

/**
 * 6. SQUARE SEATING ARRANGEMENT (8 seats: 4 corners [0,2,4,6] + 4 side-middles [1,3,5,7])
 */
export function createSquareGeometry({ cornerFacing = "IN", sideFacing = "OUT" } = {}) {
  const seats = Array.from({ length: 8 }, (_, i) => {
    const isCorner = i % 2 === 0;
    return {
      index: i,
      label: isCorner ? `Corner ${i / 2 + 1}` : `Side ${(i + 1) / 2}`,
      row: 1,
      posType: isCorner ? "CORNER" : "SIDE",
      facing: isCorner ? cornerFacing : sideFacing,
    };
  });
  return buildCyclicGeometry({
    type: ARRANGEMENT_TYPES.SQUARE,
    label: "Square Seating Arrangement",
    seatCount: 8,
    seats,
    supportsOpposite: true,
    oppositeFn: (idx) => (idx + 4) % 8,
    symmetryStep: 2, // 4-fold symmetry preserves corners vs sides
  });
}

/**
 * 7. RECTANGULAR SEATING ARRANGEMENT (8 seats: 4 corners + 2 long-side + 2 short-side)
 */
export function createRectangularGeometry({ cornerFacing = "IN", sideFacing = "IN" } = {}) {
  // 0: Corner, 1: Long Side, 2: Corner, 3: Short Side, 4: Corner, 5: Long Side, 6: Corner, 7: Short Side
  const posTypes = [
    "CORNER", "LONG_SIDE", "CORNER", "SHORT_SIDE",
    "CORNER", "LONG_SIDE", "CORNER", "SHORT_SIDE",
  ];
  const seats = posTypes.map((pt, i) => ({
    index: i,
    label: `${pt.replace("_", " ")} ${i + 1}`,
    row: 1,
    posType: pt,
    facing: pt === "CORNER" ? cornerFacing : sideFacing,
  }));
  return buildCyclicGeometry({
    type: ARRANGEMENT_TYPES.RECTANGULAR,
    label: "Rectangular Seating Arrangement",
    seatCount: 8,
    seats,
    supportsOpposite: true,
    oppositeFn: (idx) => (idx + 4) % 8,
    symmetryStep: 4, // 2-fold symmetry preserves corners, long sides, and short sides
  });
}

/**
 * 8. TRIANGULAR SEATING ARRANGEMENT (6 seats: 3 corners [0,2,4] + 3 sides [1,3,5])
 * IMPORTANT: No circular opposite! Explicitly sets supportsOpposite: false.
 */
export function createTriangularGeometry({ cornerFacing = "IN", sideFacing = "OUT" } = {}) {
  const seats = Array.from({ length: 6 }, (_, i) => {
    const isCorner = i % 2 === 0;
    return {
      index: i,
      label: isCorner ? `Corner ${i / 2 + 1}` : `Side ${(i + 1) / 2}`,
      row: 1,
      posType: isCorner ? "CORNER" : "SIDE",
      facing: isCorner ? cornerFacing : sideFacing,
    };
  });
  return buildCyclicGeometry({
    type: ARRANGEMENT_TYPES.TRIANGULAR,
    label: "Triangular Seating Arrangement",
    seatCount: 6,
    seats,
    supportsOpposite: false,
    oppositeFn: () => null, // Triangular geometry does NOT have circular opposites
    symmetryStep: 2, // 3-fold rotational symmetry
  });
}

/**
 * 9. HEXAGONAL SEATING ARRANGEMENT (6 corners [0..5], opposite = (i + 3) % 6)
 */
export function createHexagonalGeometry({ facing = "IN", facings = null } = {}) {
  const seatFacings =
    Array.isArray(facings) && facings.length === 6
      ? facings
      : Array.from({ length: 6 }, () => (String(facing).toUpperCase() === "OUT" ? "OUT" : "IN"));

  const seats = seatFacings.map((f, i) => ({
    index: i,
    label: `Corner ${i + 1}`,
    row: 1,
    posType: "CORNER",
    facing: f,
  }));
  return buildCyclicGeometry({
    type: ARRANGEMENT_TYPES.HEXAGONAL,
    label: "Hexagonal Seating Arrangement",
    seatCount: 6,
    seats,
    supportsOpposite: true,
    oppositeFn: (idx) => (idx + 3) % 6,
    symmetryStep: 1, // 6-fold rotational symmetry
  });
}

/**
 * 10. PARALLEL ROW SEATING ARRANGEMENT (Independent model supporting facing each other / away + diagonal opposites)
 */
export function createParallelRowsGeometry({ perRow = 5, facingMode = "FACING_EACH_OTHER" } = {}) {
  const geom = createLinearDoubleRowGeometry({ perRow, facingMode });
  return {
    ...geom,
    type: ARRANGEMENT_TYPES.PARALLEL_ROWS,
    label: `Parallel Row Seating Arrangement (${perRow} per row)`,
  };
}