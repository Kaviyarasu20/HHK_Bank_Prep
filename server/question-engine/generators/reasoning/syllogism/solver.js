/**
 * Exact Finite Venn-Region Bitmask SAT Solver for Banking Exam Syllogisms.
 *
 * Models N terms (typically 3 or 4) over all 2^N atomic Venn regions.
 * Supports exact formal semantics for:
 *  - ALL(a, b)         : (A ∩ B') = ∅, A ≠ ∅
 *  - NO(a, b)          : (A ∩ B)  = ∅
 *  - SOME(a, b)        : (A ∩ B)  ≠ ∅
 *  - SOME_NOT(a, b)    : (A ∩ B') ≠ ∅
 *  - ONLY_A_FEW(a, b)  : (A ∩ B)  ≠ ∅ AND (A ∩ B') ≠ ∅
 *  - ONLY(a, b)        : (B ∩ A') = ∅ AND for every c ∉ {a, b}: (B ∩ C) = ∅
 *
 * Every term is assumed non-empty (standard Aristotelian / IBPS / SBI banking syllogism semantics).
 */

export const STMT = {
  ALL: "ALL",
  NO: "NO",
  SOME: "SOME",
  SOME_NOT: "SOME_NOT",
  ONLY_A_FEW: "ONLY_A_FEW",
  ONLY: "ONLY",
};

export const CONCL = {
  ALL: "ALL",
  NO: "NO",
  SOME: "SOME",
  SOME_NOT: "SOME_NOT",
  POSS_ALL: "POSS_ALL",
  POSS_NO: "POSS_NO",
  POSS_SOME: "POSS_SOME",
  POSS_SOME_NOT: "POSS_SOME_NOT",
  CAN_NEVER_BE_ALL: "CAN_NEVER_BE_ALL",   // Definite NO(a, b)
  CAN_NEVER_BE_SOME: "CAN_NEVER_BE_SOME", // Definite SOME_NOT(a, b)
};

function regionHas(r, termIdx) {
  return ((r >> termIdx) & 1) === 1;
}

/**
 * Compiles statements over N terms into:
 *  - allowedMask: array of booleans of length 2^N (true if region is permitted by all universal rules)
 *  - existentialSets: array of arrays of region indices (each must contain >= 1 occupied region)
 */
export function compileConstraints(numTerms, statements) {
  const numRegions = 1 << numTerms;
  const allowed = new Uint8Array(numRegions).fill(1);
  // Region 0 (outside all terms) is irrelevant to term intersections, keep allowed[0] = 1
  const existentialSets = [];

  // Every term must be non-empty
  for (let t = 0; t < numTerms; t += 1) {
    const set = [];
    for (let r = 0; r < numRegions; r += 1) {
      if (regionHas(r, t)) set.push(r);
    }
    existentialSets.push(set);
  }

  for (const st of statements) {
    const { type, a, b } = st;
    if (type === STMT.ALL) {
      for (let r = 0; r < numRegions; r += 1) {
        if (regionHas(r, a) && !regionHas(r, b)) allowed[r] = 0;
      }
    } else if (type === STMT.NO) {
      for (let r = 0; r < numRegions; r += 1) {
        if (regionHas(r, a) && regionHas(r, b)) allowed[r] = 0;
      }
    } else if (type === STMT.SOME) {
      const set = [];
      for (let r = 0; r < numRegions; r += 1) {
        if (regionHas(r, a) && regionHas(r, b)) set.push(r);
      }
      existentialSets.push(set);
    } else if (type === STMT.SOME_NOT) {
      const set = [];
      for (let r = 0; r < numRegions; r += 1) {
        if (regionHas(r, a) && !regionHas(r, b)) set.push(r);
      }
      existentialSets.push(set);
    } else if (type === STMT.ONLY_A_FEW) {
      // Strict modern banking rule: BOTH Some A are B AND Some A are not B
      const posSet = [];
      const negSet = [];
      for (let r = 0; r < numRegions; r += 1) {
        if (regionHas(r, a) && regionHas(r, b)) posSet.push(r);
        if (regionHas(r, a) && !regionHas(r, b)) negSet.push(r);
      }
      existentialSets.push(posSet, negSet);
    } else if (type === STMT.ONLY) {
      // Strict banking rule: "Only A are B" => All B are A AND B cannot overlap any other term C != A
      for (let r = 0; r < numRegions; r += 1) {
        if (regionHas(r, b)) {
          if (!regionHas(r, a)) {
            allowed[r] = 0;
            continue;
          }
          for (let c = 0; c < numTerms; c += 1) {
            if (c !== a && c !== b && regionHas(r, c)) {
              allowed[r] = 0;
              break;
            }
          }
        }
      }
    }
  }

  return { numTerms, numRegions, allowed, existentialSets };
}

/**
 * Exact satisfiability check:
 * A valid non-empty Venn model exists iff every existential requirement has >= 1 permitted region.
 */
export function isCompiledSatisfiable(compiled, extraForbiddenRegions = null, extraExistential = null) {
  const { allowed, existentialSets } = compiled;
  for (const set of existentialSets) {
    let ok = false;
    for (const r of set) {
      if (allowed[r] && (!extraForbiddenRegions || !extraForbiddenRegions[r])) {
        ok = true;
        break;
      }
    }
    if (!ok) return false;
  }
  if (extraExistential) {
    for (const set of extraExistential) {
      let ok = false;
      for (const r of set) {
        if (allowed[r] && (!extraForbiddenRegions || !extraForbiddenRegions[r])) {
          ok = true;
          break;
        }
      }
      if (!ok) return false;
    }
  }
  return true;
}

export function isSatisfiable(numTerms, statements) {
  return isCompiledSatisfiable(compileConstraints(numTerms, statements));
}

function getRegionsMatching(numRegions, predicate) {
  const arr = [];
  for (let r = 0; r < numRegions; r += 1) {
    if (predicate(r)) arr.push(r);
  }
  return arr;
}

function makeForbiddenMask(numRegions, predicate) {
  const mask = new Uint8Array(numRegions);
  for (let r = 0; r < numRegions; r += 1) {
    if (predicate(r)) mask[r] = 1;
  }
  return mask;
}

/**
 * Evaluates a single conclusion against compiled statement constraints.
 * Returns { follows: boolean, kind: "definite" | "possibility" }.
 */
export function evaluateConclusion(compiled, conclusion) {
  const { numRegions, allowed } = compiled;
  const { type, a, b } = conclusion;

  switch (type) {
    case CONCL.ALL: {
      // Holds in all valid models iff no allowed region has (a=1, b=0)
      for (let r = 0; r < numRegions; r += 1) {
        if (allowed[r] && regionHas(r, a) && !regionHas(r, b)) {
          return { follows: false, kind: "definite" };
        }
      }
      return { follows: true, kind: "definite" };
    }
    case CONCL.NO:
    case CONCL.CAN_NEVER_BE_ALL: {
      // Holds in all valid models iff no allowed region has (a=1, b=1)
      for (let r = 0; r < numRegions; r += 1) {
        if (allowed[r] && regionHas(r, a) && regionHas(r, b)) {
          return { follows: false, kind: "definite" };
        }
      }
      return { follows: true, kind: "definite" };
    }
    case CONCL.SOME: {
      // Holds in all valid models iff forbidding (a=1, b=1) makes statements UNSATISFIABLE
      const forbid = makeForbiddenMask(numRegions, (r) => regionHas(r, a) && regionHas(r, b));
      return { follows: !isCompiledSatisfiable(compiled, forbid), kind: "definite" };
    }
    case CONCL.SOME_NOT:
    case CONCL.CAN_NEVER_BE_SOME: {
      // Holds in all valid models iff forbidding (a=1, b=0) makes statements UNSATISFIABLE
      const forbid = makeForbiddenMask(numRegions, (r) => regionHas(r, a) && !regionHas(r, b));
      return { follows: !isCompiledSatisfiable(compiled, forbid), kind: "definite" };
    }
    case CONCL.POSS_ALL: {
      // Possibility holds iff adding ALL(a, b) remains satisfiable
      // (Note: In banking exams, if ALL(a,b) is ALREADY definitely true, "All A being B is a possibility" is conventionally FALSE!)
      const alreadyDefinite = evaluateConclusion(compiled, { type: CONCL.ALL, a, b }).follows;
      if (alreadyDefinite) return { follows: false, kind: "possibility", alreadyDefinite: true };
      const forbid = makeForbiddenMask(numRegions, (r) => regionHas(r, a) && !regionHas(r, b));
      return { follows: isCompiledSatisfiable(compiled, forbid), kind: "possibility" };
    }
    case CONCL.POSS_NO: {
      const alreadyDefinite = evaluateConclusion(compiled, { type: CONCL.NO, a, b }).follows;
      if (alreadyDefinite) return { follows: false, kind: "possibility", alreadyDefinite: true };
      const forbid = makeForbiddenMask(numRegions, (r) => regionHas(r, a) && regionHas(r, b));
      return { follows: isCompiledSatisfiable(compiled, forbid), kind: "possibility" };
    }
    case CONCL.POSS_SOME: {
      const alreadyDefinite = evaluateConclusion(compiled, { type: CONCL.SOME, a, b }).follows;
      if (alreadyDefinite) return { follows: false, kind: "possibility", alreadyDefinite: true };
      const req = getRegionsMatching(numRegions, (r) => regionHas(r, a) && regionHas(r, b));
      return { follows: isCompiledSatisfiable(compiled, null, [req]), kind: "possibility" };
    }
    case CONCL.POSS_SOME_NOT: {
      const alreadyDefinite = evaluateConclusion(compiled, { type: CONCL.SOME_NOT, a, b }).follows;
      if (alreadyDefinite) return { follows: false, kind: "possibility", alreadyDefinite: true };
      const req = getRegionsMatching(numRegions, (r) => regionHas(r, a) && !regionHas(r, b));
      return { follows: isCompiledSatisfiable(compiled, null, [req]), kind: "possibility" };
    }
    default:
      throw new Error(`Unsupported conclusion type: ${type}`);
  }
}

/**
 * Checks whether two individually-false definite conclusions form a strict IBPS/SBI Either-Or complementary pair:
 *  1. Both are definite conclusions and individually false.
 *  2. Complementary forms:
 *     - SOME(a, b) + NO(a, b) or NO(b, a)
 *     - ALL(a, b)  + SOME_NOT(a, b) (exact same subject a and predicate b)
 *     - SOME(a, b) + SOME_NOT(a, b) (exact same subject a and predicate b)
 *  3. Mathematically exhaustive: no valid model can falsify both simultaneously.
 */
export function isStrictEitherOrPair(compiled, c1, c2) {
  const r1 = evaluateConclusion(compiled, c1);
  const r2 = evaluateConclusion(compiled, c2);
  if (r1.follows || r2.follows) return false;
  if (r1.kind !== "definite" || r2.kind !== "definite") return false;

  const isSomeNo = (x, y) =>
    x.type === CONCL.SOME &&
    y.type === CONCL.NO &&
    ((x.a === y.a && x.b === y.b) || (x.a === y.b && x.b === y.a));

  const isAllSomeNot = (x, y) =>
    x.type === CONCL.ALL &&
    y.type === CONCL.SOME_NOT &&
    x.a === y.a &&
    x.b === y.b;

  const isSomeSomeNot = (x, y) =>
    x.type === CONCL.SOME &&
    y.type === CONCL.SOME_NOT &&
    x.a === y.a &&
    x.b === y.b;

  if (isSomeNo(c1, c2) || isSomeNo(c2, c1)) return true;
  if (isAllSomeNot(c1, c2) || isAllSomeNot(c2, c1)) return true;
  if (isSomeSomeNot(c1, c2) || isSomeSomeNot(c2, c1)) return true;
  return false;
}

/**
 * Evaluates a standard 2-conclusion banking syllogism.
 * Returns outcome in:
 *  "ONLY_I" | "ONLY_II" | "EITHER_OR" | "NEITHER" | "BOTH"
 */
export function evaluateTwoConclusions(numTerms, statements, c1, c2) {
  const compiled = compileConstraints(numTerms, statements);
  if (!isCompiledSatisfiable(compiled)) {
    return { satisfiable: false, outcome: null, r1: null, r2: null };
  }
  const r1 = evaluateConclusion(compiled, c1);
  const r2 = evaluateConclusion(compiled, c2);

  let outcome;
  if (r1.follows && r2.follows) outcome = "BOTH";
  else if (r1.follows && !r2.follows) outcome = "ONLY_I";
  else if (!r1.follows && r2.follows) outcome = "ONLY_II";
  else if (isStrictEitherOrPair(compiled, c1, c2)) outcome = "EITHER_OR";
  else outcome = "NEITHER";

  return { satisfiable: true, outcome, r1, r2 };
}

/**
 * Evaluates 3 conclusions for PO Mains 3-conclusion sets.
 */
export function evaluateThreeConclusions(numTerms, statements, conclusions) {
  const compiled = compileConstraints(numTerms, statements);
  if (!isCompiledSatisfiable(compiled)) {
    return { satisfiable: false, results: [] };
  }
  const results = conclusions.map((c) => evaluateConclusion(compiled, c));
  const followsFlags = results.map((r) => r.follows);
  return { satisfiable: true, results, followsFlags };
}
