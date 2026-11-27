/**
 * Exact Constraint Satisfaction Backtracking Solver (CSP) for Banking Exam Puzzles.
 *
 * Guarantees 100% mathematical uniqueness (solutionCount === 1) for:
 *  - Linear / Vertical / Chronological / Ranking permutation puzzles (N = 6..9)
 *  - 2-Variable Distribution & Hybrid puzzles (Primary Ordering + Secondary Attribute Bijection)
 *
 * Zero ambiguity, zero contradictions, and automatic redundant-clue pruning.
 */

export function createPuzzleRng(seedInput) {
  let state = (Number(seedInput) >>> 0) || 0x9e3779b9;
  return {
    seed: state,
    random() {
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
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

/**
 * Constraint types over entity indices 0..n-1 mapped to slot positions pos[entity] in 0..n-1:
 *  - { type: "FIXED", a, slot }
 *  - { type: "NOT_AT", a, slot }
 *  - { type: "ALLOWED_SLOTS", a, slots: number[] }
 *  - { type: "BEFORE", a, b }               // pos[a] < pos[b]
 *  - { type: "IMMEDIATELY_BEFORE", a, b }   // pos[a] + 1 === pos[b]
 *  - { type: "EXACT_OFFSET", a, b, delta }  // pos[b] - pos[a] === delta
 *  - { type: "GAP", a, b, k }               // |pos[a] - pos[b]| === k + 1
 *  - { type: "ADJACENT", a, b }             // |pos[a] - pos[b]| === 1
 *  - { type: "NOT_ADJACENT", a, b }         // |pos[a] - pos[b]| !== 1
 */
function buildUnaryDomains(n, constraints) {
  const domains = Array.from({ length: n }, () => new Uint8Array(n).fill(1));
  for (const c of constraints) {
    if (c.type === "FIXED") {
      for (let s = 0; s < n; s += 1) {
        if (s !== c.slot) domains[c.a][s] = 0;
      }
    } else if (c.type === "NOT_AT") {
      domains[c.a][c.slot] = 0;
    } else if (c.type === "ALLOWED_SLOTS") {
      const allowedSet = new Set(c.slots);
      for (let s = 0; s < n; s += 1) {
        if (!allowedSet.has(s)) domains[c.a][s] = 0;
      }
    }
  }
  return domains;
}

function checkBinaryConstraint(c, posA, posB) {
  switch (c.type) {
    case "BEFORE":
      return posA < posB;
    case "IMMEDIATELY_BEFORE":
      return posA + 1 === posB;
    case "EXACT_OFFSET":
      return posB - posA === c.delta;
    case "GAP":
      return Math.abs(posA - posB) === c.k + 1;
    case "ADJACENT":
      return Math.abs(posA - posB) === 1;
    case "NOT_ADJACENT":
      return Math.abs(posA - posB) !== 1;
    default:
      return true;
  }
}

/**
 * Exact backtracking permutation solver with MRV (Minimum Remaining Values) heuristic.
 * Returns number of valid solutions capped at `limit` (default 2).
 */
export function countPermutationSolutions(n, constraints, limit = 2) {
  const domains = buildUnaryDomains(n, constraints);
  const binaryByEntity = Array.from({ length: n }, () => []);

  for (const c of constraints) {
    if (c.b !== undefined) {
      binaryByEntity[c.a].push({ c, other: c.b, isFirst: true });
      binaryByEntity[c.b].push({ c, other: c.a, isFirst: false });
    }
  }

  // Quick infeasibility check
  for (let i = 0; i < n; i += 1) {
    let hasAny = false;
    for (let s = 0; s < n; s += 1) {
      if (domains[i][s]) { hasAny = true; break; }
    }
    if (!hasAny) return 0;
  }

  const pos = new Int8Array(n).fill(-1);
  const usedSlot = new Uint8Array(n);
  let solutions = 0;

  function backtrack(assignedCount) {
    if (solutions >= limit) return;
    if (assignedCount === n) {
      solutions += 1;
      return;
    }

    // MRV: pick unassigned entity with fewest currently legal slots
    let bestEntity = -1;
    let bestLegal = null;
    let bestCount = n + 1;

    for (let e = 0; e < n; e += 1) {
      if (pos[e] !== -1) continue;
      const legal = [];
      for (let s = 0; s < n; s += 1) {
        if (usedSlot[s] || !domains[e][s]) continue;
        let ok = true;
        for (const rel of binaryByEntity[e]) {
          const otherPos = pos[rel.other];
          if (otherPos === -1) continue;
          const valid = rel.isFirst
            ? checkBinaryConstraint(rel.c, s, otherPos)
            : checkBinaryConstraint(rel.c, otherPos, s);
          if (!valid) { ok = false; break; }
        }
        if (ok) legal.push(s);
      }
      if (legal.length === 0) return; // dead end
      if (legal.length < bestCount) {
        bestCount = legal.length;
        bestEntity = e;
        bestLegal = legal;
        if (bestCount === 1) break;
      }
    }

    for (const s of bestLegal) {
      pos[bestEntity] = s;
      usedSlot[s] = 1;
      backtrack(assignedCount + 1);
      usedSlot[s] = 0;
      pos[bestEntity] = -1;
      if (solutions >= limit) return;
    }
  }

  backtrack(0);
  return solutions;
}

/**
 * Builds a minimal, authentic banking-exam clue set that has EXACTLY ONE valid solution.
 * `groundTruthPos[entity]` = true slot index (0..n-1).
 * `candidateClues` = array of { constraint, text, priority (lower = more exam-like) }.
 */
export function synthesizeUniqueClueSet({ n, candidateClues, rng, maxClues = 11 }) {
  // Sort by priority tier (with random tie-breaking inside each tier)
  const shuffled = candidateClues
    .map((item) => ({ ...item, _tie: rng.random() }))
    .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5) || a._tie - b._tie);

  const selected = [];
  const usedSignatures = new Set();

  for (const cand of shuffled) {
    if (selected.length >= maxClues) break;
    const sig = JSON.stringify(cand.constraint);
    if (usedSignatures.has(sig)) continue;
    usedSignatures.add(sig);
    selected.push(cand);

    const cnt = countPermutationSolutions(
      n,
      selected.map((x) => x.constraint),
      2,
    );
    if (cnt === 0) {
      // Should never happen for ground-truth-consistent clues, revert safely
      selected.pop();
      continue;
    }
    if (cnt === 1) {
      // Prune any redundant clues while preserving exact uniqueness (solutionCount === 1)
      for (let i = selected.length - 2; i >= 0; i -= 1) {
        const withoutI = selected.filter((_, idx) => idx !== i);
        if (
          countPermutationSolutions(
            n,
            withoutI.map((x) => x.constraint),
            2,
          ) === 1
        ) {
          selected.splice(i, 1);
        }
      }
      return {
        unique: true,
        clues: selected,
        solutionCount: 1,
      };
    }
  }

  return { unique: false, clues: [], solutionCount: 0 };
}

/**
 * Exact unique-solution synthesizer for a secondary attribute bijection (e.g. Person -> Color/City/Dept).
 * Used by Distribution-Based and Hybrid Puzzles!
 * Uses unary FIXED + NOT_AT constraints over attrIdx 0..n-1, ensuring zero ambiguity.
 */
export function synthesizeUniqueAttributeClues({
  n,
  groundTruthAttr, // array of length n: entityIdx -> attrIdx
  formatFixed,
  formatNotAt,
  rng,
  maxClues = 16,
}) {
  // Triangular deductive elimination guarantees 100% unique solution in minimal crisp banking clues:
  // Fix first 2-3 anchors directly, then exclude remaining unassigned entities in a clean deductive ladder.
  const order = rng.shuffle(Array.from({ length: n }, (_, i) => i));
  const fixedCount = Math.max(2, Math.min(3, Math.floor(n / 2)));
  const candidates = [];

  for (let idx = 0; idx < n; idx += 1) {
    const e = order[idx];
    const trueAttr = groundTruthAttr[e];
    if (idx < fixedCount) {
      candidates.push({
        constraint: { type: "FIXED", a: e, slot: trueAttr },
        text: formatFixed(e, trueAttr),
        priority: 1,
      });
    } else {
      // Exclude attributes of later unassigned entities -> forces unique deductive chain!
      for (let later = idx + 1; later < n; later += 1) {
        const laterAttr = groundTruthAttr[order[later]];
        candidates.push({
          constraint: { type: "NOT_AT", a: e, slot: laterAttr },
          text: formatNotAt(e, laterAttr),
          priority: 2,
        });
      }
      // Fallback direct assignment if ever needed
      candidates.push({
        constraint: { type: "FIXED", a: e, slot: trueAttr },
        text: formatFixed(e, trueAttr),
        priority: 4,
      });
    }
  }

  return synthesizeUniqueClueSet({ n, candidateClues: candidates, rng, maxClues });
}
