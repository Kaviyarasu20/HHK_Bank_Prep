/**
 * Exact Mathematical Solvers for Banking Exam Order & Ranking
 *
 * Covers:
 * 1. Single-row total & rank conversion (with optional shift)
 * 2. Interchanging positions (overlapping & non-overlapping)
 * 3. Maximum & minimum persons with M between + exact midpoint
 * 4. Multi-person strict linear ranking + numeric anchor verification
 * 5. Ratio-based class ranking (boys/girls ahead & behind)
 */

/**
 * 1. Single-Row Rank & Shift Solver
 */
export function solveTotalFromRanks(leftRank, rightRank) {
  return leftRank + rightRank - 1;
}

export function solveOppositeRank(total, rankFromOneEnd) {
  return total - rankFromOneEnd + 1;
}

/**
 * 2. Interchanging Positions Solver
 * A starts at leftA (from left), B starts at rightB (from right).
 * After interchanging, A is at newLeftA (from left) — which was B's original position from left!
 */
export function solveInterchange(leftA, rightB, newLeftA) {
  if (leftA === newLeftA) {
    throw new Error("A and B cannot occupy the same initial position");
  }
  const total = newLeftA + rightB - 1;
  const newRightB = total - leftA + 1;
  const between = Math.abs(newLeftA - leftA) - 1;
  if (total < Math.max(leftA, rightB, newLeftA) || newRightB < 1 || between < 0) {
    throw new Error("Invalid interchange geometry");
  }
  return { total, newRightB, between };
}

/**
 * 3. Max / Min Overlap & Midpoint Solver
 */
export function solveMaxMinOverlap(leftA, rightB, between) {
  const maxTotal = leftA + rightB + between;
  const canOverlap = between <= Math.min(leftA, rightB) - 2;
  const minTotal = canOverlap ? leftA + rightB - between - 2 : null;
  return { maxTotal, minTotal, canOverlap };
}

export function solveMidpointInRow(total, leftA, rightB) {
  const leftB = total - rightB + 1;
  if ((leftA + leftB) % 2 !== 0) return null;
  const midFromLeft = (leftA + leftB) / 2;
  const midFromRight = total - midFromLeft + 1;
  const between = Math.abs(leftB - leftA) - 1;
  if (between < 1 || between % 2 === 0) return null;
  return { leftB, midFromLeft, midFromRight, between };
}

/**
 * 4. Exact Linear Ranking Constraint Solver (for 5-7 items)
 * Verifies that a set of constraints yields a UNIQUE total ordering.
 * constraints:
 *   - { type: "GT", a, b }          : rank(a) < rank(b) (index 0 = tallest/highest)
 *   - { type: "FIXED_POS", a, pos } : index of a === pos (0-indexed)
 *   - { type: "NOT_POS", a, pos }   : index of a !== pos
 *   - { type: "ADJ_GT", a, b }      : index(b) === index(a) + 1
 */
export function countValidRankings(items, constraints, limit = 2) {
  const n = items.length;
  const pos = new Map();
  const used = new Array(n).fill(false);
  const solutions = [];

  // Pre-index constraints by item
  const fixedMap = new Map();
  const notPosMap = new Map();
  for (const c of constraints) {
    if (c.type === "FIXED_POS") fixedMap.set(c.a, c.pos);
    if (c.type === "NOT_POS") {
      if (!notPosMap.has(c.a)) notPosMap.set(c.a, new Set());
      notPosMap.get(c.a).add(c.pos);
    }
  }

  function partialConsistent() {
    for (const c of constraints) {
      if (c.type === "GT") {
        if (pos.has(c.a) && pos.has(c.b) && !(pos.get(c.a) < pos.get(c.b))) return false;
      } else if (c.type === "ADJ_GT") {
        if (pos.has(c.a) && pos.has(c.b) && pos.get(c.b) !== pos.get(c.a) + 1) return false;
      }
    }
    return true;
  }

  function backtrack(idx) {
    if (solutions.length >= limit) return;
    if (idx === n) {
      const order = new Array(n);
      for (const [item, p] of pos.entries()) order[p] = item;
      solutions.push(order);
      return;
    }
    const item = items[idx];
    const forced = fixedMap.has(item) ? [fixedMap.get(item)] : null;
    const forbidden = notPosMap.get(item);

    const slots = forced || Array.from({ length: n }, (_, i) => i);
    for (const s of slots) {
      if (used[s]) continue;
      if (forbidden && forbidden.has(s)) continue;
      used[s] = true;
      pos.set(item, s);
      if (partialConsistent()) {
        backtrack(idx + 1);
      }
      pos.delete(item);
      used[s] = false;
      if (solutions.length >= limit) return;
    }
  }

  backtrack(0);
  return solutions;
}

/**
 * 5. Exact Ratio Class Ranking Solver
 * totalStudents split by girlsRatio : boysRatio
 * targetRankFromTop (1-indexed), targetGender: "BOY" | "GIRL", girlsAhead: count of girls ranked above target
 */
export function solveRatioClassRanking({
  totalStudents,
  girlsRatio,
  boysRatio,
  targetRankFromTop,
  targetGender,
  girlsAhead,
}) {
  const ratioSum = girlsRatio + boysRatio;
  if (totalStudents % ratioSum !== 0) throw new Error("Total not divisible by ratio sum");
  const totalGirls = (totalStudents / ratioSum) * girlsRatio;
  const totalBoys = (totalStudents / ratioSum) * boysRatio;
  const totalAhead = targetRankFromTop - 1;
  const boysAhead = totalAhead - girlsAhead;
  const boysAfter = totalBoys - boysAhead - (targetGender === "BOY" ? 1 : 0);
  const girlsAfter = totalGirls - girlsAhead - (targetGender === "GIRL" ? 1 : 0);

  if (
    boysAhead < 0 ||
    girlsAhead < 0 ||
    boysAfter < 0 ||
    girlsAfter < 0 ||
    boysAhead + girlsAhead !== totalAhead
  ) {
    throw new Error("Inconsistent ratio class ranking parameters");
  }

  return {
    totalGirls,
    totalBoys,
    boysAhead,
    girlsAhead,
    boysAfter,
    girlsAfter,
  };
}
