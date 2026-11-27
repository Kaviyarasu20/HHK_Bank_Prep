import {
  OP,
  evaluateInequalityConclusion,
  evaluateTwoInequalityConclusions,
  solveInequalityGraph,
} from "./solver.js";

/**
 * Modular Banking Exam Inequality Question Builder:
 *  1. DIRECT_CHAIN     — Single continuous inequality chain (Easy — Clerk Prelims)
 *  2. MULTI_STATEMENT  — 2-3 comma-separated linked statements (Medium — PO Prelims)
 *  3. EITHER_OR        — 2-sign (>= / <= split) & 3-sign (opposite-sign) Either-Or (Medium)
 *  4. CODED_INEQUALITY — Symbol legend (@, #, $, %, *) decoded & solved (Hard — PO Mains)
 *  5. MISSING_SYMBOL   — Fill-in-the-blank sequence of symbols (Hard — SBI/IBPS PO Mains)
 */

export function createInequalityRng(seedInput) {
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

export const INEQUALITY_SUBTOPICS = {
  DIRECT_CHAIN: "Direct Single-Chain Inequality",
  MULTI_STATEMENT: "Multi-Statement Inequality",
  EITHER_OR: "Either–Or & Neither–Nor Inequality",
  CODED_INEQUALITY: "Coded Inequality",
  MISSING_SYMBOL: "Missing-Symbol (Fill-in-the-Blank) Inequality",
};

export const STANDARD_5_OPTIONS = [
  "Only conclusion I follows",
  "Only conclusion II follows",
  "Either conclusion I or II follows",
  "Neither conclusion I nor II follows",
  "Both conclusions I and II follow",
];

const OUTCOME_IDX = { ONLY_I: 0, ONLY_II: 1, EITHER_OR: 2, NEITHER: 3, BOTH: 4 };
const ALL_OPS = [OP.GT, OP.GTE, OP.EQ, OP.LT, OP.LTE];

const LETTER_SETS = [
  ["A", "B", "C", "D", "E", "F", "G", "H"],
  ["P", "Q", "R", "S", "T", "U", "V", "W"],
  ["J", "K", "L", "M", "N", "O", "X", "Y"],
  ["H", "I", "J", "K", "L", "M", "N", "O"],
];

const PRETTY_OP = {
  [OP.GT]: ">",
  [OP.GTE]: "≥",
  [OP.EQ]: "=",
  [OP.LT]: "<",
  [OP.LTE]: "≤",
};

function fmtOp(op) {
  return PRETTY_OP[op] || op;
}

function formatChain(vars, edges) {
  if (!edges.length) return "";
  let out = vars[edges[0].a];
  for (const e of edges) {
    out += ` ${fmtOp(e.op)} ${vars[e.b]}`;
  }
  return out;
}

function buildChainEdges(n, rng) {
  const edges = [];
  for (let i = 0; i < n - 1; i += 1) {
    edges.push({ a: i, b: i + 1, op: rng.pick(ALL_OPS) });
  }
  return edges;
}

function buildMultiStatementEdges(n, rng) {
  // Split n variables (e.g. 7 or 8) into 3 overlapping segments sharing a bridge variable
  const seg1 = [];
  for (let i = 0; i < 3; i += 1) seg1.push({ a: i, b: i + 1, op: rng.pick(ALL_OPS) });

  const seg2 = [];
  const bridge1 = rng.int(1, 2);
  seg2.push({ a: bridge1, b: 4, op: rng.pick(ALL_OPS) });
  seg2.push({ a: 4, b: 5, op: rng.pick(ALL_OPS) });

  const seg3 = [];
  if (n >= 7) {
    const bridge2 = rng.pick([3, 4, 5]);
    seg3.push({ a: bridge2, b: 6, op: rng.pick(ALL_OPS) });
    if (n >= 8) seg3.push({ a: 6, b: 7, op: rng.pick(ALL_OPS) });
  }

  return {
    segments: [seg1, seg2, ...(seg3.length ? [seg3] : [])],
    allEdges: [...seg1, ...seg2, ...seg3],
  };
}

function describeRelation(reach, a, b, vars) {
  if (reach[a][b] === 1) return `${vars[a]} > ${vars[b]} definitely holds`;
  if (reach[a][b] === 0 && reach[b][a] === 0) return `${vars[a]} = ${vars[b]} definitely holds`;
  if (reach[a][b] === 0) return `${vars[a]} ≥ ${vars[b]} holds (so either ${vars[a]} > ${vars[b]} or ${vars[a]} = ${vars[b]})`;
  if (reach[b][a] === 1) return `${vars[a]} < ${vars[b]} definitely holds`;
  if (reach[b][a] === 0) return `${vars[a]} ≤ ${vars[b]} holds (so either ${vars[a]} < ${vars[b]} or ${vars[a]} = ${vars[b]})`;
  return `opposite signs lie between ${vars[a]} and ${vars[b]} (no definite relation)`;
}

export function buildStandardInequalityQuestion({
  subtopicKey,
  difficulty = "Medium",
  targetOutcome = null,
  rng,
}) {
  const isCoded = subtopicKey === "CODED_INEQUALITY";
  const isMulti = subtopicKey === "MULTI_STATEMENT" || isCoded || (subtopicKey === "EITHER_OR" && difficulty !== "Easy");
  const n = difficulty === "Easy" ? 6 : isMulti ? 7 : 7;

  // Symbol legend for Coded Inequality
  const symbolSet = rng.shuffle(["@", "#", "$", "%", "*"]);
  const opToSym = {
    [OP.GT]: symbolSet[0],
    [OP.GTE]: symbolSet[1],
    [OP.EQ]: symbolSet[2],
    [OP.LT]: symbolSet[3],
    [OP.LTE]: symbolSet[4],
  };
  const opMeaning = {
    [OP.GT]: "is greater than",
    [OP.GTE]: "is neither smaller than nor equal to... wait: is either greater than or equal to",
    [OP.EQ]: "is neither greater than nor smaller than",
    [OP.LT]: "is smaller than",
    [OP.LTE]: "is either smaller than or equal to",
  };
  // Clean banking phrasing for Coded legend
  const legendLines = [
    `P ${opToSym[OP.GT]} Q means 'P is strictly greater than Q' (P > Q)`,
    `P ${opToSym[OP.GTE]} Q means 'P is not smaller than Q' (P ≥ Q)`,
    `P ${opToSym[OP.EQ]} Q means 'P is neither greater than nor smaller than Q' (P = Q)`,
    `P ${opToSym[OP.LT]} Q means 'P is strictly smaller than Q' (P < Q)`,
    `P ${opToSym[OP.LTE]} Q means 'P is not greater than Q' (P ≤ Q)`,
  ];

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const vars = rng.shuffle(rng.pick(LETTER_SETS)).slice(0, n);
    let segments;
    let allEdges;
    if (isMulti) {
      const built = buildMultiStatementEdges(n, rng);
      segments = built.segments;
      allEdges = built.allEdges;
    } else {
      allEdges = buildChainEdges(n, rng);
      segments = [allEdges];
    }

    const solved = solveInequalityGraph(n, allEdges);
    if (!solved.consistent) continue;

    // Craft Either-Or pairs directly when EITHER_OR is targeted
    if (subtopicKey === "EITHER_OR" || targetOutcome === "EITHER_OR") {
      const pairs = [];
      for (let a = 0; a < n; a += 1) {
        for (let b = a + 2; b < n; b += 1) {
          if (solved.reach[a][b] === 0 && solved.reach[b][a] === -1) {
            pairs.push([{ a, b, op: OP.GT }, { a, b, op: OP.EQ }]);
          } else if (solved.reach[b][a] === 0 && solved.reach[a][b] === -1) {
            pairs.push([{ a, b, op: OP.LT }, { a, b, op: OP.EQ }]);
          } else if (solved.reach[a][b] === -1 && solved.reach[b][a] === -1) {
            pairs.push([{ a, b, op: OP.GT }, { a, b, op: OP.LTE }]);
            pairs.push([{ a, b, op: OP.GTE }, { a, b, op: OP.LT }]);
          }
        }
      }
      if (pairs.length) {
        const [c1, c2] = rng.pick(pairs);
        const evalRes = evaluateTwoInequalityConclusions(n, allEdges, c1, c2);
        if (evalRes.consistent && evalRes.outcome === "EITHER_OR") {
          return finalizeInequality({
            subtopicKey,
            difficulty,
            vars,
            segments,
            allEdges,
            conclusions: [c1, c2],
            evalRes,
            isCoded,
            opToSym,
            legendLines,
          });
        }
      }
      if (targetOutcome === "EITHER_OR") continue;
    }

    // Build non-trivial candidate conclusions (distance >= 2)
    const candidates = [];
    for (let a = 0; a < n; a += 1) {
      for (let b = 0; b < n; b += 1) {
        if (Math.abs(a - b) < 2) continue;
        for (const op of [OP.GT, OP.GTE, OP.LT, OP.LTE, OP.EQ]) {
          candidates.push({ a, b, op });
        }
      }
    }
    const shuffled = rng.shuffle(candidates);
    for (let i = 0; i < Math.min(shuffled.length, 14); i += 1) {
      const c1 = shuffled[i];
      for (let j = i + 1; j < Math.min(shuffled.length, 24); j += 1) {
        const c2 = shuffled[j];
        if (c1.a === c2.a && c1.b === c2.b && c1.op === c2.op) continue;
        const evalRes = evaluateTwoInequalityConclusions(n, allEdges, c1, c2);
        if (!evalRes.consistent) continue;
        if (targetOutcome && evalRes.outcome !== targetOutcome) continue;

        return finalizeInequality({
          subtopicKey,
          difficulty,
          vars,
          segments,
          allEdges,
          conclusions: [c1, c2],
          evalRes,
          isCoded,
          opToSym,
          legendLines,
        });
      }
    }
  }
  return null;
}

function finalizeInequality({
  subtopicKey,
  difficulty,
  vars,
  segments,
  allEdges,
  conclusions,
  evalRes,
  isCoded,
  opToSym,
  legendLines,
}) {
  const correctOptionIndex = OUTCOME_IDX[evalRes.outcome];
  const answer = STANDARD_5_OPTIONS[correctOptionIndex];

  const renderSeg = (seg) => {
    let out = vars[seg[0].a];
    for (const e of seg) {
      out += ` ${isCoded ? opToSym[e.op] : fmtOp(e.op)} ${vars[e.b]}`;
    }
    return out;
  };
  const renderConcl = (c) =>
    `${vars[c.a]} ${isCoded ? opToSym[c.op] : fmtOp(c.op)} ${vars[c.b]}`;

  const decodedSegs = segments.map((seg) => formatChain(vars, seg)).join(" ;  ");
  const stmtDisplay = segments.map(renderSeg).join(" ;  ");

  const promptParts = isCoded
    ? [
        "Directions (Coded Inequality): In the following question, symbols are used with the meanings given below:",
        ...legendLines,
        "",
        `Statements: ${stmtDisplay}`,
        "",
        "Conclusions:",
        `I. ${renderConcl(conclusions[0])}`,
        `II. ${renderConcl(conclusions[1])}`,
      ]
    : [
        "Directions: In the following question, relationship between different elements is shown in the statements followed by two conclusions. Decide which of the given conclusions logically follow(s).",
        "",
        `Statements: ${stmtDisplay}`,
        "",
        "Conclusions:",
        `I. ${renderConcl(conclusions[0])}`,
        `II. ${renderConcl(conclusions[1])}`,
      ];

  const [c1, c2] = conclusions;
  const steps = [];
  if (isCoded) {
    steps.push(`Step 1 (Decode Symbols): ${decodedSegs}`);
    steps.push(
      `Decoded Conclusions: I. ${vars[c1.a]} ${fmtOp(c1.op)} ${vars[c1.b]} | II. ${vars[c2.a]} ${fmtOp(c2.op)} ${vars[c2.b]}`,
    );
  } else {
    steps.push(`Step 1 (Given Relations): ${decodedSegs}`);
  }
  steps.push(
    `Step 2 (Conclusion I — ${vars[c1.a]} ${fmtOp(c1.op)} ${vars[c1.b]}): ${describeRelation(evalRes.reach, c1.a, c1.b, vars)} ⇒ ${evalRes.f1 ? "FOLLOWS" : "DOES NOT FOLLOW"}.`,
  );
  steps.push(
    `Step 3 (Conclusion II — ${vars[c2.a]} ${fmtOp(c2.op)} ${vars[c2.b]}): ${describeRelation(evalRes.reach, c2.a, c2.b, vars)} ⇒ ${evalRes.f2 ? "FOLLOWS" : "DOES NOT FOLLOW"}.`,
  );
  if (evalRes.outcome === "EITHER_OR") {
    steps.push(
      `Either–Or Check: Both conclusions are individually false, share the same elements (${vars[c1.a]}, ${vars[c1.b]}), and together exhaust every permitted relation ⇒ Either conclusion I or II follows.`,
    );
  }
  steps.push(`Final Answer: ${answer}`);

  return {
    topic: "Inequality",
    subType: `INEQUALITY_${subtopicKey}`,
    subtopicName: INEQUALITY_SUBTOPICS[subtopicKey],
    difficulty,
    questionText: promptParts.join("\n"),
    options: [...STANDARD_5_OPTIONS],
    answer,
    correctOptionIndex,
    solutionSteps: steps,
    _meta: {
      mode: "STANDARD",
      numVars: vars.length,
      edges: allEdges,
      conclusions,
      expectedOutcome: evalRes.outcome,
    },
  };
}

/**
 * 5. Missing-Symbol (Fill-in-the-Blank) Inequality — SBI / IBPS PO Mains
 * Given a 5-variable chain with 4 blanks and 2 target conclusions, choose the ONLY
 * 4-symbol sequence out of 5 options that makes BOTH target conclusions definitely TRUE.
 */
export function buildMissingSymbolQuestion({ difficulty = "Hard", rng }) {
  const n = 5;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const vars = rng.shuffle(rng.pick(LETTER_SETS)).slice(0, n);
    const correctOps = Array.from({ length: n - 1 }, () => rng.pick(ALL_OPS));
    const correctEdges = correctOps.map((op, i) => ({ a: i, b: i + 1, op }));
    const solved = solveInequalityGraph(n, correctEdges);
    if (!solved.consistent) continue;

    // Pick 2 definite conclusions spanning at least 2 hops
    const trueConcls = [];
    for (let a = 0; a < n; a += 1) {
      for (let b = a + 2; b < n; b += 1) {
        for (const op of [OP.GT, OP.GTE, OP.LT, OP.LTE]) {
          if (evaluateInequalityConclusion(solved.reach, { a, b, op })) {
            trueConcls.push({ a, b, op });
          }
        }
      }
    }
    if (trueConcls.length < 2) continue;
    const picked = rng.shuffle(trueConcls);
    const c1 = picked[0];
    const c2 = picked.find((c) => c.a !== c1.a || c.b !== c1.b);
    if (!c2) continue;

    // Build 4 distractor operator sequences that FAIL at least one of (c1, c2)
    const distractors = [];
    const seen = new Set([correctOps.join(",")]);
    for (let dTry = 0; dTry < 120 && distractors.length < 4; dTry += 1) {
      const dOps = Array.from({ length: n - 1 }, () => rng.pick(ALL_OPS));
      const key = dOps.join(",");
      if (seen.has(key)) continue;
      const dEdges = dOps.map((op, i) => ({ a: i, b: i + 1, op }));
      const dSolved = solveInequalityGraph(n, dEdges);
      if (!dSolved.consistent) continue;
      const holdsBoth =
        evaluateInequalityConclusion(dSolved.reach, c1) &&
        evaluateInequalityConclusion(dSolved.reach, c2);
      if (holdsBoth) continue;
      seen.add(key);
      distractors.push(dOps);
    }
    if (distractors.length < 4) continue;

    const allSeqs = rng.shuffle([
      { ops: correctOps, isCorrect: true },
      ...distractors.map((ops) => ({ ops, isCorrect: false })),
    ]);

    const options = allSeqs.map(({ ops }) => ops.map(fmtOp).join(", "));
    const correctOptionIndex = allSeqs.findIndex((x) => x.isCorrect);
    const answer = options[correctOptionIndex];

    const blankChain = vars.join(" _ ");
    const questionText = [
      "Directions (Missing-Symbol Inequality): Which of the following sequences of symbols should replace the blanks (from left to right) in the expression below so that BOTH given conclusions definitely hold TRUE?",
      "",
      `Expression: ${blankChain}`,
      `Target Conclusions: (I) ${vars[c1.a]} ${fmtOp(c1.op)} ${vars[c1.b]}   and   (II) ${vars[c2.a]} ${fmtOp(c2.op)} ${vars[c2.b]}`,
    ].join("\n");

    const filledExpr = formatChain(vars, correctEdges);
    const solutionSteps = [
      `Step 1: Substituting Option ${String.fromCharCode(65 + correctOptionIndex)} (${answer}) gives: ${filledExpr}.`,
      `Step 2: Checking Conclusion I (${vars[c1.a]} ${fmtOp(c1.op)} ${vars[c1.b]}): ${describeRelation(solved.reach, c1.a, c1.b, vars)} ⇒ TRUE.`,
      `Step 3: Checking Conclusion II (${vars[c2.a]} ${fmtOp(c2.op)} ${vars[c2.b]}): ${describeRelation(solved.reach, c2.a, c2.b, vars)} ⇒ TRUE. None of the other 4 options satisfy both conclusions.`,
      `Final Answer: ${answer}`,
    ];

    return {
      topic: "Inequality",
      subType: "INEQUALITY_MISSING_SYMBOL",
      subtopicName: INEQUALITY_SUBTOPICS.MISSING_SYMBOL,
      difficulty,
      questionText,
      options,
      answer,
      correctOptionIndex,
      solutionSteps,
      _meta: {
        mode: "MISSING_SYMBOL",
        numVars: n,
        conclusions: [c1, c2],
        optionOpSequences: allSeqs.map((x) => x.ops),
      },
    };
  }
  return null;
}
