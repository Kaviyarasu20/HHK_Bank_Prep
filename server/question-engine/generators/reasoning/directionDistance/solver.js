/**
 * Exact 2D Cartesian Vector, Compass & Solar Geometry Solver for Banking Direction & Distance
 *
 * Coordinate convention:
 *   +x = East, -x = West
 *   +y = North, -y = South
 *   Compass angle (degrees clockwise from North):
 *     0 = North, 45 = North-East, 90 = East, 135 = South-East,
 *     180 = South, 225 = South-West, 270 = West, 315 = North-West
 */

export const COMPASS_8 = [
  "North",
  "North-East",
  "East",
  "South-East",
  "South",
  "South-West",
  "West",
  "North-West",
];

export const CARDINAL_VECTORS = {
  North: { dx: 0, dy: 1 },
  East: { dx: 1, dy: 0 },
  South: { dx: 0, dy: -1 },
  West: { dx: -1, dy: 0 },
};

export const CARDINAL_ORDER = ["North", "East", "South", "West"];

export function turnCardinal(facing, turn) {
  const idx = CARDINAL_ORDER.indexOf(facing);
  if (idx === -1) throw new Error(`Invalid cardinal direction: ${facing}`);
  if (turn === "RIGHT") return CARDINAL_ORDER[(idx + 1) % 4];
  if (turn === "LEFT") return CARDINAL_ORDER[(idx + 3) % 4];
  if (turn === "BACK") return CARDINAL_ORDER[(idx + 2) % 4];
  return facing;
}

/**
 * Exact 8-point compass direction of target point `to` with respect to reference point `from`.
 */
export function compassDirectionFromTo(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return "Same Point";
  if (dx === 0) return dy > 0 ? "North" : "South";
  if (dy === 0) return dx > 0 ? "East" : "West";
  if (dx > 0 && dy > 0) return "North-East";
  if (dx > 0 && dy < 0) return "South-East";
  if (dx < 0 && dy > 0) return "North-West";
  return "South-West";
}

/**
 * Exact Euclidean distance formatted cleanly:
 * - Integer string if dx^2 + dy^2 is a perfect square (e.g., "13 m")
 * - Radical string otherwise (e.g., "√85 m")
 */
export function exactDistanceSquared(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

export function formatExactDistance(distSq) {
  const root = Math.round(Math.sqrt(distSq));
  if (root * root === distSq) return `${root} m`;
  return `√${distSq} m`;
}

/**
 * 1. Exact Multi-Turn Path Solver.
 * steps: [{ turn: "START" | "LEFT" | "RIGHT", initialDir?: "North"|"East"|"South"|"West", distance: number }]
 */
export function solvePath(steps) {
  let x = 0;
  let y = 0;
  let facing = steps[0].initialDir;
  const points = [{ x: 0, y: 0, facing }];

  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    if (i > 0) {
      facing = turnCardinal(facing, st.turn);
    }
    const vec = CARDINAL_VECTORS[facing];
    x += vec.dx * st.distance;
    y += vec.dy * st.distance;
    points.push({ x, y, facing });
  }

  const start = points[0];
  const end = points[points.length - 1];
  const distSq = exactDistanceSquared(start, end);
  return {
    points,
    start,
    end,
    finalFacing: facing,
    distSq,
    distanceLabel: formatExactDistance(distSq),
    directionEndFromStart: compassDirectionFromTo(start, end),
    directionStartFromEnd: compassDirectionFromTo(end, start),
  };
}

/**
 * 2. Exact Point-to-Point Relative Grid Solver.
 * relations: [{ point: "B", ref: "A", dir: "North"|"South"|"East"|"West", dist: number }]
 * Anchor: first ref starts at (0, 0).
 */
export function solveRelativePoints(anchor, relations) {
  const coords = { [anchor]: { x: 0, y: 0 } };
  for (const rel of relations) {
    const base = coords[rel.ref];
    if (!base) throw new Error(`Missing reference point ${rel.ref}`);
    const v = CARDINAL_VECTORS[rel.dir];
    coords[rel.point] = {
      x: base.x + v.dx * rel.dist,
      y: base.y + v.dy * rel.dist,
    };
  }
  return coords;
}

/**
 * 3. Exact Solar Shadow Solver.
 * timeOfDay: "MORNING" (sun East -> shadow West) | "EVENING" (sun West -> shadow East)
 * observerFacing: "North" | "South" | "East" | "West"
 * Returns where a shadow falls relative to `observerFacing`: "LEFT" | "RIGHT" | "FRONT" | "BEHIND"
 */
export function shadowRelativeToObserver(timeOfDay, observerFacing) {
  const shadowDir = timeOfDay === "MORNING" ? "West" : "East";
  if (shadowDir === observerFacing) return "FRONT";
  if (shadowDir === turnCardinal(observerFacing, "BACK")) return "BEHIND";
  if (shadowDir === turnCardinal(observerFacing, "LEFT")) return "LEFT";
  if (shadowDir === turnCardinal(observerFacing, "RIGHT")) return "RIGHT";
  throw new Error("Unreachable shadow relation");
}

/**
 * Inverse solar solver: given timeOfDay and where the shadow falls relative to observer ("LEFT"|"RIGHT"|"FRONT"|"BEHIND"),
 * returns the exact unique facing direction of that observer.
 */
export function solveObserverFacingFromShadow(timeOfDay, relativeSide) {
  const matches = CARDINAL_ORDER.filter(
    (dir) => shadowRelativeToObserver(timeOfDay, dir) === relativeSide,
  );
  if (matches.length !== 1) {
    throw new Error(`Expected unique facing direction, got ${matches.length}`);
  }
  return matches[0];
}

/**
 * 4. Exact Angular Rotation Solver (multiples of 45 degrees).
 * turns: [{ dir: "CW" | "ACW", deg: number }]
 */
export function solveAngularRotation(startDirection, turns) {
  const startIdx = COMPASS_8.indexOf(startDirection);
  if (startIdx === -1) throw new Error(`Invalid start direction: ${startDirection}`);
  let angle = startIdx * 45;
  for (const t of turns) {
    angle += t.dir === "CW" ? t.deg : -t.deg;
  }
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized % 45 !== 0) {
    throw new Error(`Angle ${normalized} is not a multiple of 45 degrees`);
  }
  return {
    finalAngle: normalized,
    finalDirection: COMPASS_8[normalized / 45],
  };
}
