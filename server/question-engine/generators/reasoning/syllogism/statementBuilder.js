import {
  STMT,
  CONCL,
  isSatisfiable,
  evaluateTwoConclusions,
  evaluateThreeConclusions,
  evaluateConclusion,
  compileConstraints,
} from "./solver.js";
import {
  formatStatementText,
  formatConclusionText,
  buildSyllogismExplanation,
  explainStatementRule,
} from "./explainer.js";

/**
 * Deterministic seeded PRNG (Mulberry32)
 */
export function createSyllogismRng(seedInput) {
  let state = (Number(seedInput) >>> 0) || 0x9e3779b9;
  const rng = {
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
  return rng;
}

/**
 * Clean, disjoint everyday & banking noun groups (zero real-world subset overlap).
 */
export const NOUN_GROUPS = [
  ["Files", "Folders", "Papers", "Clips"],
  ["Coins", "Notes", "Bonds", "Cheques"],
  ["Ledgers", "Vouchers", "Drafts", "Tokens"],
  ["Desks", "Chairs", "Lamps", "Shelves"],
  ["Keys", "Locks", "Rings", "Chains"],
  ["Pens", "Books", "Charts", "Stamps"],
  ["Trains", "Buses", "Ships", "Vans"],
  ["Rivers", "Hills", "Lakes", "Valleys"],
  ["Clouds", "Winds", "Waves", "Rocks"],
  ["Apples", "Mangoes", "Grapes", "Plums"],
  ["Roses", "Lilies", "Tulips", "Lotuses"],
  ["Cups", "Plates", "Bowls", "Spoons"],
  ["Clocks", "Watches", "Bells", "Alarms"],
  ["Drums", "Flutes", "Harps", "Gongs"],
  ["Bricks", "Tiles", "Beams", "Pillars"],
  ["Cards", "Envelopes", "Parcels", "Seals"],
  ["Coats", "Scarves", "Gloves", "Hats"],
  ["Mirrors", "Frames", "Curtains", "Rugs"],
  ["Cables", "Switches", "Routers", "Plugs"],
  ["Screens", "Keyboards", "Printers", "Scanners"],
  ["Lanterns", "Candles", "Torches", "Sparks"],
  ["Diamonds", "Rubies", "Pearls", "Emeralds"],
  ["Anchors", "Sails", "Oars", "Compasses"],
  ["Medals", "Trophies", "Ribbons", "Shields"],
];

export const SYLLOGISM_SUBTOPICS = {
  BASIC_DEFINITE: "Basic Definite Syllogism",
  ONLY_A_FEW: "Only a Few & Only Syllogism",
  POSSIBILITY: "Possibility & Can Never Be",
  EITHER_OR: "Either–Or & Neither–Nor Cases",
  THREE_CONCLUSIONS: "3-Conclusion Mains Sets",
  REVERSE_SYLLOGISM: "Reverse Syllogism",
  MODERN_SYNONYMS: "Modern Quantifier Synonyms",
};

export const TWO_CONCLUSION_OPTIONS = [
  "Only conclusion I follows",
  "Only conclusion II follows",
  "Either conclusion I or II follows",
  "Neither conclusion I nor II follows",
  "Both conclusions I and II follow",
];

const OUTCOME_TO_INDEX = {
  ONLY_I: 0,
  ONLY_II: 1,
  EITHER_OR: 2,
  NEITHER: 3,
  BOTH: 4,
};

function pickTermGroup(rng, numTerms) {
  const group = rng.pick(NOUN_GROUPS);
  return rng.shuffle(group).slice(0, numTerms);
}

function buildRandomChainStatements(rng, numTerms, allowedStmtTypes, mustIncludeTypes = []) {
  const statements = [];
  // Connect terms into a single connected graph so conclusions across non-adjacent terms are meaningful
  const pairs = [];
  for (let i = 0; i < numTerms - 1; i += 1) {
    pairs.push(rng.random() < 0.7 ? [i, i + 1] : [i + 1, i]);
  }
  if (numTerms === 4 && rng.random() < 0.45) {
    pairs.push(rng.pick([[0, 2], [1, 3], [0, 3]]));
  }

  for (let i = 0; i < pairs.length; i += 1) {
    const [a, b] = pairs[i];
    const type = i < mustIncludeTypes.length ? mustIncludeTypes[i] : rng.pick(allowedStmtTypes);
    statements.push({ type, a, b });
  }
  return statements;
}

function buildCandidateConclusions(rng, numTerms, allowedConclTypes) {
  const list = [];
  for (let a = 0; a < numTerms; a += 1) {
    for (let b = 0; b < numTerms; b += 1) {
      if (a === b) continue;
      for (const type of allowedConclTypes) {
        list.push({ type, a, b });
      }
    }
  }
  return rng.shuffle(list);
}

function formatStandardPrompt(statements, conclusions, terms, synonymMode, rng) {
  const stmtLines = statements.map((s, idx) => `${idx + 1}. ${formatStatementText(s, terms, synonymMode, rng)}`);
  const romans = ["I", "II", "III", "IV"];
  const conclLines = conclusions.map((c, idx) => `${romans[idx]}. ${formatConclusionText(c, terms)}`);
  return [
    "Directions: Read the given statements and conclusions carefully. Assuming that the information given in the statements is true, decide which of the given conclusions logically follow(s) from the statements.",
    "",
    "Statements:",
    ...stmtLines,
    "",
    "Conclusions:",
    ...conclLines,
  ].join("\n");
}

/**
 * Generates a 2-conclusion banking syllogism for:
 *  BASIC_DEFINITE | ONLY_A_FEW | POSSIBILITY | EITHER_OR | MODERN_SYNONYMS
 */
export function buildTwoConclusionQuestion({
  subtopicKey,
  difficulty = "Medium",
  targetOutcome = null,
  rng,
}) {
  const numTerms = difficulty === "Easy" ? 3 : rng.random() < 0.55 ? 4 : 3;
  const synonymMode = subtopicKey === "MODERN_SYNONYMS";

  let stmtTypes = [STMT.ALL, STMT.SOME, STMT.NO, STMT.SOME_NOT];
  let mustInclude = [];
  let conclTypes = [CONCL.ALL, CONCL.SOME, CONCL.NO, CONCL.SOME_NOT];

  if (subtopicKey === "BASIC_DEFINITE") {
    stmtTypes = [STMT.ALL, STMT.SOME, STMT.NO];
    conclTypes = [CONCL.ALL, CONCL.SOME, CONCL.NO, CONCL.SOME_NOT];
  } else if (subtopicKey === "ONLY_A_FEW") {
    stmtTypes = [STMT.ONLY_A_FEW, STMT.ALL, STMT.SOME, STMT.NO, STMT.ONLY];
    mustInclude = [STMT.ONLY_A_FEW];
    if (rng.random() < 0.35) mustInclude.push(STMT.ONLY);
    conclTypes = [CONCL.SOME, CONCL.SOME_NOT, CONCL.ALL, CONCL.NO, CONCL.POSS_ALL, CONCL.POSS_SOME];
  } else if (subtopicKey === "POSSIBILITY") {
    stmtTypes = [STMT.ONLY_A_FEW, STMT.ALL, STMT.SOME, STMT.NO];
    conclTypes = [
      CONCL.POSS_ALL,
      CONCL.POSS_NO,
      CONCL.POSS_SOME,
      CONCL.POSS_SOME_NOT,
      CONCL.CAN_NEVER_BE_ALL,
      CONCL.CAN_NEVER_BE_SOME,
      CONCL.SOME,
      CONCL.NO,
    ];
  } else if (subtopicKey === "EITHER_OR") {
    stmtTypes = [STMT.SOME, STMT.ALL, STMT.NO, STMT.ONLY_A_FEW];
    conclTypes = [CONCL.SOME, CONCL.NO, CONCL.ALL, CONCL.SOME_NOT];
  } else if (subtopicKey === "MODERN_SYNONYMS") {
    stmtTypes = [STMT.ALL, STMT.NO, STMT.SOME, STMT.SOME_NOT, STMT.ONLY_A_FEW];
    conclTypes = [CONCL.SOME, CONCL.SOME_NOT, CONCL.NO, CONCL.ALL, CONCL.POSS_ALL];
  }

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const terms = pickTermGroup(rng, numTerms);
    const statements = buildRandomChainStatements(rng, numTerms, stmtTypes, mustInclude);
    if (!isSatisfiable(numTerms, statements)) continue;

    // For EITHER_OR mode when targetOutcome is EITHER_OR (or default), actively craft complementary pairs
    if (subtopicKey === "EITHER_OR" && (!targetOutcome || targetOutcome === "EITHER_OR")) {
      const pairs = rng.shuffle([
        [0, numTerms - 1],
        [numTerms - 1, 0],
        [0, numTerms - 2],
        [1, numTerms - 1],
      ]);
      for (const [a, b] of pairs) {
        if (a === b) continue;
        const compPairs = rng.shuffle([
          [{ type: CONCL.SOME, a, b }, { type: CONCL.NO, a, b }],
          [{ type: CONCL.ALL, a, b }, { type: CONCL.SOME_NOT, a, b }],
          [{ type: CONCL.SOME, a, b }, { type: CONCL.SOME_NOT, a, b }],
        ]);
        for (const [c1, c2] of compPairs) {
          const evalRes = evaluateTwoConclusions(numTerms, statements, c1, c2);
          if (evalRes.satisfiable && evalRes.outcome === "EITHER_OR") {
            return finalizeTwoConclusion({
              subtopicKey,
              difficulty,
              terms,
              statements,
              conclusions: [c1, c2],
              evalRes,
              synonymMode,
              rng,
            });
          }
        }
      }
      continue;
    }

    const candidates = buildCandidateConclusions(rng, numTerms, conclTypes);
    // Avoid trivial conclusions that literally repeat a single statement verbatim
    const nonTrivial = candidates.filter(
      (c) => !statements.some((s) => s.a === c.a && s.b === c.b && s.type === c.type),
    );
    const pool = nonTrivial.length >= 6 ? nonTrivial : candidates;

    for (let i = 0; i < Math.min(pool.length, 16); i += 1) {
      const c1 = pool[i];
      for (let j = i + 1; j < Math.min(pool.length, 24); j += 1) {
        const c2 = pool[j];
        if (c1.type === c2.type && c1.a === c2.a && c1.b === c2.b) continue;
        // For POSSIBILITY subtopic, ensure at least one conclusion is possibility or can-never-be
        if (
          subtopicKey === "POSSIBILITY" &&
          !String(c1.type).startsWith("POSS_") &&
          !String(c2.type).startsWith("POSS_") &&
          !String(c1.type).startsWith("CAN_NEVER") &&
          !String(c2.type).startsWith("CAN_NEVER")
        ) {
          continue;
        }
        const evalRes = evaluateTwoConclusions(numTerms, statements, c1, c2);
        if (!evalRes.satisfiable) continue;
        if (targetOutcome && evalRes.outcome !== targetOutcome) continue;

        return finalizeTwoConclusion({
          subtopicKey,
          difficulty,
          terms,
          statements,
          conclusions: [c1, c2],
          evalRes,
          synonymMode,
          rng,
        });
      }
    }
  }
  return null;
}

function finalizeTwoConclusion({
  subtopicKey,
  difficulty,
  terms,
  statements,
  conclusions,
  evalRes,
  synonymMode,
  rng,
}) {
  const correctOptionIndex = OUTCOME_TO_INDEX[evalRes.outcome];
  const answer = TWO_CONCLUSION_OPTIONS[correctOptionIndex];
  const questionText = formatStandardPrompt(statements, conclusions, terms, synonymMode, rng);
  const solutionSteps = buildSyllogismExplanation({
    statements,
    conclusions,
    results: [evalRes.r1, evalRes.r2],
    terms,
    outcomeLabel: answer,
    isEitherOr: evalRes.outcome === "EITHER_OR",
  });

  return {
    topic: "Syllogism",
    subType: `SYLLOGISM_${subtopicKey}`,
    subtopicName: SYLLOGISM_SUBTOPICS[subtopicKey],
    difficulty,
    questionText,
    options: [...TWO_CONCLUSION_OPTIONS],
    answer,
    correctOptionIndex,
    solutionSteps,
    _meta: {
      mode: "TWO_CONCLUSION",
      numTerms: terms.length,
      terms,
      statements,
      conclusions,
      expectedOutcome: evalRes.outcome,
    },
  };
}

/**
 * Generates a Hard (PO Mains) 3-Conclusion Syllogism with tailored 5-option combinations.
 */
export function buildThreeConclusionQuestion({ difficulty = "Hard", rng }) {
  const numTerms = 4;
  const stmtTypes = [STMT.ONLY_A_FEW, STMT.ALL, STMT.SOME, STMT.NO, STMT.ONLY];
  const conclTypes = [
    CONCL.SOME,
    CONCL.SOME_NOT,
    CONCL.NO,
    CONCL.ALL,
    CONCL.POSS_ALL,
    CONCL.POSS_SOME,
    CONCL.CAN_NEVER_BE_SOME,
  ];

  const LABEL_MAP = {
    "000": "None of the conclusions follows",
    "100": "Only conclusion I follows",
    "010": "Only conclusion II follows",
    "001": "Only conclusion III follows",
    "110": "Only conclusions I and II follow",
    "101": "Only conclusions I and III follow",
    "011": "Only conclusions II and III follow",
    "111": "All conclusions I, II and III follow",
  };

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const terms = pickTermGroup(rng, numTerms);
    const statements = buildRandomChainStatements(rng, numTerms, stmtTypes, [STMT.ONLY_A_FEW]);
    if (!isSatisfiable(numTerms, statements)) continue;

    const candidates = buildCandidateConclusions(rng, numTerms, conclTypes).filter(
      (c) => !statements.some((s) => s.a === c.a && s.b === c.b && s.type === c.type),
    );
    if (candidates.length < 3) continue;

    const conclusions = [candidates[0], candidates[1], candidates[2]];
    const evalRes = evaluateThreeConclusions(numTerms, statements, conclusions);
    if (!evalRes.satisfiable) continue;

    const key = evalRes.followsFlags.map((f) => (f ? "1" : "0")).join("");
    const correctLabel = LABEL_MAP[key];
    const distractors = rng
      .shuffle(Object.entries(LABEL_MAP).filter(([k]) => k !== key).map(([, v]) => v))
      .slice(0, 4);

    const options = rng.shuffle([correctLabel, ...distractors]);
    const correctOptionIndex = options.indexOf(correctLabel);

    const questionText = formatStandardPrompt(statements, conclusions, terms, false, rng);
    const solutionSteps = buildSyllogismExplanation({
      statements,
      conclusions,
      results: evalRes.results,
      terms,
      outcomeLabel: correctLabel,
      isEitherOr: false,
    });

    return {
      topic: "Syllogism",
      subType: "SYLLOGISM_THREE_CONCLUSIONS",
      subtopicName: SYLLOGISM_SUBTOPICS.THREE_CONCLUSIONS,
      difficulty,
      questionText,
      options,
      answer: correctLabel,
      correctOptionIndex,
      solutionSteps,
      _meta: {
        mode: "THREE_CONCLUSION",
        numTerms,
        terms,
        statements,
        conclusions,
        expectedFlags: evalRes.followsFlags,
      },
    };
  }
  return null;
}

/**
 * Generates a Reverse Syllogism (SBI PO / IBPS PO Mains):
 * Given 2 conclusions, exactly ONE of the 5 statement sets logically yields BOTH conclusions.
 */
export function buildReverseSyllogismQuestion({ difficulty = "Hard", rng }) {
  const numTerms = 4;
  const stmtTypes = [STMT.ALL, STMT.SOME, STMT.NO, STMT.ONLY_A_FEW];
  const conclTypes = [CONCL.SOME, CONCL.NO, CONCL.SOME_NOT, CONCL.POSS_ALL, CONCL.ALL];

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const terms = pickTermGroup(rng, numTerms);
    const correctStmts = buildRandomChainStatements(rng, numTerms, stmtTypes, [STMT.ALL]);
    if (!isSatisfiable(numTerms, correctStmts)) continue;

    const compiledCorrect = compileConstraints(numTerms, correctStmts);
    const candidates = buildCandidateConclusions(rng, numTerms, conclTypes).filter(
      (c) =>
        !correctStmts.some((s) => s.a === c.a && s.b === c.b && s.type === c.type) &&
        evaluateConclusion(compiledCorrect, c).follows,
    );
    if (candidates.length < 2) continue;

    const c1 = candidates[0];
    const c2 = candidates.find((c) => c.a !== c1.a || c.b !== c1.b);
    if (!c2) continue;

    // Build 4 distinct satisfiable distractor statement sets that do NOT yield BOTH c1 & c2
    const distractors = [];
    const seenSig = new Set([JSON.stringify(correctStmts)]);
    for (let dTry = 0; dTry < 120 && distractors.length < 4; dTry += 1) {
      const ds = buildRandomChainStatements(rng, numTerms, stmtTypes);
      const sig = JSON.stringify(ds);
      if (seenSig.has(sig)) continue;
      if (!isSatisfiable(numTerms, ds)) continue;
      const compD = compileConstraints(numTerms, ds);
      const holdsBoth =
        evaluateConclusion(compD, c1).follows && evaluateConclusion(compD, c2).follows;
      if (holdsBoth) continue;
      seenSig.add(sig);
      distractors.push(ds);
    }
    if (distractors.length < 4) continue;

    const optionSets = rng.shuffle([
      { stmts: correctStmts, isCorrect: true },
      ...distractors.map((stmts) => ({ stmts, isCorrect: false })),
    ]);

    const options = optionSets.map(({ stmts }) =>
      stmts.map((s) => formatStatementText(s, terms, false, rng)).join(" "),
    );
    const correctOptionIndex = optionSets.findIndex((o) => o.isCorrect);
    const answer = options[correctOptionIndex];

    const questionText = [
      "Directions (Reverse Syllogism): In the question below, two conclusions are given followed by five sets of statements. Choose the set of statements from which BOTH given conclusions logically follow.",
      "",
      "Conclusions:",
      `I. ${formatConclusionText(c1, terms)}`,
      `II. ${formatConclusionText(c2, terms)}`,
    ].join("\n");

    const solutionSteps = [
      `Target Conclusions: (I) ${formatConclusionText(c1, terms)} | (II) ${formatConclusionText(c2, terms)}`,
      "Step 1 (Correct Statement Set Venn Relations): " +
        correctStmts.map((s) => explainStatementRule(s, terms)).join(" | "),
      "Step 2: Under this statement set, BOTH Conclusion I and Conclusion II hold in every valid Venn diagram, whereas each of the other 4 statement sets fails at least one conclusion.",
      `Final Answer: Option ${String.fromCharCode(65 + correctOptionIndex)}`,
    ];

    return {
      topic: "Syllogism",
      subType: "SYLLOGISM_REVERSE",
      subtopicName: SYLLOGISM_SUBTOPICS.REVERSE_SYLLOGISM,
      difficulty,
      questionText,
      options,
      answer,
      correctOptionIndex,
      solutionSteps,
      _meta: {
        mode: "REVERSE",
        numTerms,
        terms,
        conclusions: [c1, c2],
        optionStatementSets: optionSets.map((o) => o.stmts),
      },
    };
  }
  return null;
}
