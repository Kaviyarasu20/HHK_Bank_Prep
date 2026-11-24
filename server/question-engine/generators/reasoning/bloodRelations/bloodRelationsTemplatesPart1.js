// Place at: server/question-engine/generators/reasoning/bloodRelations/bloodRelationsTemplatesPart1.js

import { buildAndSolveFamilyGraph } from "./bloodRelationsSolver.js";
import { buildFiveOptions } from "./bloodRelationsValidator.js";
import { MALE_NAMES, FEMALE_NAMES, LETTER_SETS } from "./bloodRelationsExamProfiles.js";

function pickDistinctNames(rng, maleCount, femaleCount) {
  return {
    males: rng.shuffle(MALE_NAMES).slice(0, maleCount),
    females: rng.shuffle(FEMALE_NAMES).slice(0, femaleCount),
  };
}

function finalizeQuestion({
  templateId,
  category,
  subType,
  difficulty,
  examLevel,
  question,
  logicModel,
  givenData,
  steps,
  shortcut,
  rng,
  customDistractors = null,
}) {
  const { graph, validation } = buildAndSolveFamilyGraph(logicModel);
  if (!validation.consistent) {
    throw new Error(`Template ${templateId} produced inconsistent graph: ${validation.errors.join("; ")}`);
  }

  let answer;
  if (logicModel.query.type === "relation") {
    answer = graph.resolveRelation(logicModel.query.source, logicModel.query.target).relation;
  } else {
    const counts = graph.getFamilyCounts();
    const m = logicModel.query.metric;
    answer =
      m === "males"
        ? counts.unknownGender > 0
          ? "Cannot be determined"
          : String(counts.males)
        : m === "females"
        ? counts.unknownGender > 0
          ? "Cannot be determined"
          : String(counts.females)
        : m === "couples"
        ? String(counts.couples)
        : m === "generations"
        ? String(counts.generations)
        : String(counts.totalMembers);
  }

  logicModel.expectedAnswer = answer;
  const optPack = buildFiveOptions(answer, rng, customDistractors);

  return {
    templateId,
    category,
    question_type: "Blood Relations",
    sub_type: subType,
    difficulty,
    exam_level: examLevel,
    question,
    ...optPack,
    solution: {
      given_data: givenData,
      formula: "Family Tree Graph Deduction (Gender + Generation Tracking)",
      steps,
      final_answer: answer,
    },
    shortcut_method: shortcut,
    logicModel,
    mathModel: logicModel, // compatibility with shared batchUtils fingerprinter
  };
}

// ============================================================================
// CATEGORY A: DIRECT BLOOD RELATIONSHIPS (Paternal/Maternal Uncle, Aunt, Grandparent, Nephew/Niece)
// ============================================================================
function tplA1_DirectPaternalMaternal(rng, difficulty) {
  const letters = rng.pick(LETTER_SETS);
  const [p1, p2, p3, p4] = letters;
  const variant = rng.int(0, 5);

  const scenarios = [
    // 0: Maternal Uncle
    {
      members: [
        { id: p1, gender: "M" },
        { id: p2, gender: "F" },
        { id: p3, gender: "M" },
      ],
      parentChild: [[p2, p3]],
      siblings: [[p1, p2]],
      spouses: [],
      query: { type: "relation", source: p1, target: p3 },
      question: `${p1} is the brother of ${p2}. ${p2} is the mother of ${p3}. How is ${p1} related to ${p3}?`,
      given: [`${p1} (+) is brother of ${p2}`, `${p2} (-) is mother of ${p3}`],
      steps: [
        `${p2} is the mother of ${p3} (1 generation above ${p3}).`,
        `${p1} is the brother of ${p2} (same generation as ${p2}, male).`,
        `Mother's brother is Maternal Uncle.`,
      ],
      shortcut: "Mother's brother = Maternal Uncle.",
    },
    // 1: Paternal Aunt
    {
      members: [
        { id: p1, gender: "F" },
        { id: p2, gender: "M" },
        { id: p3, gender: "F" },
      ],
      parentChild: [[p2, p3]],
      siblings: [[p1, p2]],
      spouses: [],
      query: { type: "relation", source: p1, target: p3 },
      question: `${p1} is the sister of ${p2}. ${p2} is the father of ${p3}. How is ${p1} related to ${p3}?`,
      given: [`${p1} (-) is sister of ${p2}`, `${p2} (+) is father of ${p3}`],
      steps: [
        `${p2} is the father of ${p3}.`,
        `${p1} is the sister of ${p2}.`,
        `Father's sister is Paternal Aunt.`,
      ],
      shortcut: "Father's sister = Paternal Aunt.",
    },
    // 2: Paternal Grandfather
    {
      members: [
        { id: p1, gender: "M" },
        { id: p2, gender: "M" },
        { id: p3, gender: "M" },
      ],
      parentChild: [[p1, p2], [p2, p3]],
      siblings: [],
      spouses: [],
      query: { type: "relation", source: p1, target: p3 },
      question: `${p1} is the father of ${p2}, and ${p2} is the father of ${p3}. How is ${p1} related to ${p3}?`,
      given: [`${p1} (+) -> father of ${p2} (+) -> father of ${p3}`],
      steps: [
        `${p2} is the father of ${p3}.`,
        `${p1} is the father of ${p2} (2 generations above ${p3}).`,
        `Father's father is Paternal Grandfather.`,
      ],
      shortcut: "Father's father = Paternal Grandfather (+2 generation, male).",
    },
    // 3: Maternal Grandmother
    {
      members: [
        { id: p1, gender: "F" },
        { id: p2, gender: "F" },
        { id: p3, gender: "F" },
      ],
      parentChild: [[p1, p2], [p2, p3]],
      siblings: [],
      spouses: [],
      query: { type: "relation", source: p1, target: p3 },
      question: `${p1} is the mother of ${p2}. ${p2} is the mother of ${p3}. How is ${p1} related to ${p3}?`,
      given: [`${p1} (-) -> mother of ${p2} (-) -> mother of ${p3}`],
      steps: [
        `${p2} is the mother of ${p3}.`,
        `${p1} is the mother of ${p2}.`,
        `Mother's mother is Maternal Grandmother.`,
      ],
      shortcut: "Mother's mother = Maternal Grandmother.",
    },
    // 4: Cousin
    {
      members: [
        { id: p1, gender: "M" },
        { id: p2, gender: "M" },
        { id: p3, gender: "F" },
        { id: p4, gender: "M" },
      ],
      parentChild: [[p1, p3], [p2, p4]],
      siblings: [[p1, p2]],
      spouses: [],
      query: { type: "relation", source: p3, target: p4 },
      question: `${p1} and ${p2} are brothers. ${p3} is the daughter of ${p1} and ${p4} is the son of ${p2}. How is ${p3} related to ${p4}?`,
      given: [`${p1} (+) & ${p2} (+) are brothers`, `${p3} (-) is daughter of ${p1}`, `${p4} (+) is son of ${p2}`],
      steps: [
        `${p1} and ${p2} are siblings.`,
        `${p3} is ${p1}'s child and ${p4} is ${p2}'s child.`,
        `Children of siblings are Cousins.`,
      ],
      shortcut: "Father's brother's child = Cousin (gender-neutral).",
    },
    // 5: Niece
    {
      members: [
        { id: p1, gender: "M" },
        { id: p2, gender: "F" },
        { id: p3, gender: "F" },
      ],
      parentChild: [[p2, p3]],
      siblings: [[p1, p2]],
      spouses: [],
      query: { type: "relation", source: p3, target: p1 },
      question: `${p1} is the brother of ${p2}. ${p3} is the daughter of ${p2}. How is ${p3} related to ${p1}?`,
      given: [`${p1} (+) is brother of ${p2} (-)`, `${p3} (-) is daughter of ${p2}`],
      steps: [
        `${p2} is the sister of ${p1}.`,
        `${p3} is the daughter of ${p2} (female, 1 generation below ${p1}).`,
        `Sister's daughter is Niece.`,
      ],
      shortcut: "Sibling's daughter = Niece.",
    },
  ];

  const sc = scenarios[variant];
  return finalizeQuestion({
    templateId: "BR_A1_DIRECT_REL",
    category: "A",
    subType: "Direct Blood Relationships",
    difficulty,
    examLevel: "Prelims",
    question: sc.question,
    logicModel: {
      category: "A",
      variantTag: `direct_${variant}`,
      members: sc.members,
      parentChild: sc.parentChild,
      spouses: sc.spouses,
      siblings: sc.siblings,
      query: sc.query,
    },
    givenData: sc.given,
    steps: sc.steps,
    shortcut: sc.shortcut,
    rng,
  });
}

// ============================================================================
// CATEGORY B: POINTING TO A PERSON / PHOTOGRAPH
// ============================================================================
function tplB1_PointingPhotograph(rng, difficulty) {
  const { males, females } = pickDistinctNames(rng, 2, 2);
  const variant = rng.int(0, 3);

  const scenarios = [
    // 0: Man points to photograph of a boy -> "He is the son of the only son of my father" => Son
    {
      speaker: males[0],
      subject: males[1],
      members: [
        { id: "Father", gender: "M" },
        { id: males[0], gender: "M" },
        { id: males[1], gender: "M" },
      ],
      parentChild: [["Father", males[0]], [males[0], males[1]]],
      spouses: [],
      siblings: [],
      query: { type: "relation", source: males[1], target: males[0] },
      question: `Pointing to a photograph of ${males[1]}, ${males[0]} (a man) says, "He is the son of the only son of my father." How is ${males[1]} related to ${males[0]}?`,
      given: [`Speaker = ${males[0]} (Male)`, `"Only son of my father" = ${males[0]} himself`],
      steps: [
        `Since ${males[0]} is male, "the only son of my father" refers to ${males[0]} himself.`,
        `${males[1]} is the son of ${males[0]}.`,
      ],
      shortcut: "Work backwards from 'my': my father's only son (male speaker) = Self → Self's son = Son.",
    },
    // 1: Woman points to a man -> "His mother is the only daughter of my mother" => Nephew (if speaker is that only daughter -> Son!)
    {
      speaker: females[0],
      subject: males[0],
      members: [
        { id: "Grandmother", gender: "F" },
        { id: females[0], gender: "F" },
        { id: males[0], gender: "M" },
      ],
      parentChild: [["Grandmother", females[0]], [females[0], males[0]]],
      spouses: [],
      siblings: [],
      query: { type: "relation", source: females[0], target: males[0] },
      question: `Pointing to a man named ${males[0]}, ${females[0]} (a woman) said, "His mother is the only daughter of my mother." How is ${females[0]} related to ${males[0]}?`,
      given: [`Speaker = ${females[0]} (Female)`, `"Only daughter of my mother" = ${females[0]} herself`],
      steps: [
        `"The only daughter of my mother" for female speaker ${females[0]} is ${females[0]} herself.`,
        `Thus, ${males[0]}'s mother is ${females[0]}.`,
        `Therefore, ${females[0]} is the Mother of ${males[0]}.`,
      ],
      shortcut: "Only daughter of a woman's mother = Herself.",
    },
    // 2: Man points to a woman -> "She is the daughter of my father's sister" => Cousin
    {
      speaker: males[0],
      subject: females[0],
      members: [
        { id: "Father", gender: "M" },
        { id: "Aunt", gender: "F" },
        { id: males[0], gender: "M" },
        { id: females[0], gender: "F" },
      ],
      parentChild: [["Father", males[0]], ["Aunt", females[0]]],
      siblings: [["Father", "Aunt"]],
      spouses: [],
      query: { type: "relation", source: females[0], target: males[0] },
      question: `Pointing to ${females[0]} in a family gathering, ${males[0]} says, "She is the daughter of my father's sister." How is ${females[0]} related to ${males[0]}?`,
      given: [`Aunt is sister of ${males[0]}'s father`, `${females[0]} is daughter of Aunt`],
      steps: [
        `${males[0]}'s father's sister is ${males[0]}'s paternal aunt.`,
        `${females[0]} is the daughter of that paternal aunt.`,
        `Therefore, ${females[0]} is ${males[0]}'s Cousin.`,
      ],
      shortcut: "Father's sister's daughter = Cousin.",
    },
    // 3: Woman points to a man -> "He is the brother of my husband's son" => Son
    {
      speaker: females[0],
      subject: males[0],
      members: [
        { id: females[0], gender: "F" },
        { id: males[1], gender: "M" },
        { id: "Son1", gender: "M" },
        { id: males[0], gender: "M" },
      ],
      parentChild: [[males[1], "Son1"]],
      spouses: [[females[0], males[1]]],
      siblings: [["Son1", males[0]]],
      query: { type: "relation", source: males[0], target: females[0] },
      question: `Pointing to a photograph of ${males[0]}, ${females[0]} (a married woman) says, "He is the brother of my husband's son." How is ${males[0]} related to ${females[0]}?`,
      given: [`${females[0]} is married to ${males[1]}`, `${males[0]} is brother of ${males[1]}'s son`],
      steps: [
        `${females[0]}'s husband's son is also ${females[0]}'s son.`,
        `${males[0]} is the brother of ${females[0]}'s son.`,
        `Therefore, ${males[0]} is ${females[0]}'s Son.`,
      ],
      shortcut: "Husband's son's brother = Own Son.",
    },
  ];

  const sc = scenarios[variant];
  return finalizeQuestion({
    templateId: "BR_B1_POINTING_PHOTO",
    category: "B",
    subType: "Pointing to a Person",
    difficulty,
    examLevel: "Prelims",
    question: sc.question,
    logicModel: {
      category: "B",
      variantTag: `pointing_${variant}`,
      members: sc.members,
      parentChild: sc.parentChild,
      spouses: sc.spouses,
      siblings: sc.siblings,
      query: sc.query,
    },
    givenData: sc.given,
    steps: sc.steps,
    shortcut: sc.shortcut,
    rng,
  });
}

// ============================================================================
// CATEGORY C: INTRODUCTION-BASED RELATIONSHIPS
// ============================================================================
function tplC1_Introduction(rng, difficulty) {
  const { males, females } = pickDistinctNames(rng, 2, 2);
  const variant = rng.int(0, 2);

  const scenarios = [
    // 0: Introduces as son of father's brother -> Cousin
    {
      members: [
        { id: "Dad", gender: "M" },
        { id: "Uncle", gender: "M" },
        { id: males[0], gender: "M" },
        { id: males[1], gender: "M" },
      ],
      parentChild: [["Dad", males[0]], ["Uncle", males[1]]],
      siblings: [["Dad", "Uncle"]],
      spouses: [],
      query: { type: "relation", source: males[1], target: males[0] },
      question: `Introducing ${males[1]}, ${males[0]} says, "He is the son of my father's brother." How is ${males[1]} related to ${males[0]}?`,
      given: [`${males[0]}'s father and Uncle are brothers`, `${males[1]} is Uncle's son`],
      steps: [
        `Father's brother is Paternal Uncle.`,
        `Son of Paternal Uncle is Cousin.`,
      ],
      shortcut: "Uncle's child = Cousin.",
    },
    // 1: Introduces as wife of mother's brother -> Maternal Aunt
    {
      members: [
        { id: "Mom", gender: "F" },
        { id: "MUncle", gender: "M" },
        { id: females[0], gender: "F" },
        { id: females[1], gender: "F" },
      ],
      parentChild: [["Mom", females[0]]],
      siblings: [["Mom", "MUncle"]],
      spouses: [["MUncle", females[1]]],
      query: { type: "relation", source: females[1], target: females[0] },
      question: `Introducing ${females[1]}, ${females[0]} says, "She is the wife of my mother's brother." How is ${females[1]} related to ${females[0]}?`,
      given: [`MUncle is brother of ${females[0]}'s mother`, `${females[1]} is wife of MUncle`],
      steps: [
        `Mother's brother is Maternal Uncle.`,
        `Wife of Maternal Uncle is Maternal Aunt.`,
      ],
      shortcut: "Mother's brother's wife = Maternal Aunt.",
    },
    // 2: Introduces as father of sister's husband -> Father-in-law? No: sister's husband's father is unrelated, let's do: "husband of my daughter" -> Son-in-law!
    {
      members: [
        { id: males[0], gender: "M" },
        { id: females[0], gender: "F" },
        { id: males[1], gender: "M" },
      ],
      parentChild: [[males[0], females[0]]],
      siblings: [],
      spouses: [[females[0], males[1]]],
      query: { type: "relation", source: males[1], target: males[0] },
      question: `Introducing ${males[1]} to guests, ${males[0]} says, "He is the husband of my only daughter ${females[0]}." How is ${males[1]} related to ${males[0]}?`,
      given: [`${females[0]} is daughter of ${males[0]}`, `${males[1]} is husband of ${females[0]}`],
      steps: [
        `${females[0]} is ${males[0]}'s daughter.`,
        `${males[1]} is married to ${females[0]} (male).`,
        `Daughter's husband is Son-in-law.`,
      ],
      shortcut: "Daughter's husband = Son-in-law.",
    },
  ];

  const sc = scenarios[variant];
  return finalizeQuestion({
    templateId: "BR_C1_INTRODUCTION",
    category: "C",
    subType: "Introduction-Based Relationships",
    difficulty,
    examLevel: "Prelims",
    question: sc.question,
    logicModel: {
      category: "C",
      variantTag: `intro_${variant}`,
      members: sc.members,
      parentChild: sc.parentChild,
      spouses: sc.spouses,
      siblings: sc.siblings,
      query: sc.query,
    },
    givenData: sc.given,
    steps: sc.steps,
    shortcut: sc.shortcut,
    rng,
  });
}

// ============================================================================
// CATEGORY D: 3-GENERATION & 4-GENERATION FAMILY TREES
// ============================================================================
function tplD1_FamilyTree(rng, difficulty) {
  const letters = rng.pick(LETTER_SETS);
  const [A, B, C, D, E, F, G] = letters;
  const isFourGen = difficulty === "Hard" && rng.random() < 0.5;

  if (isFourGen) {
    // 4-Generation tree: A(M)=B(F) -> C(M)=D(F) -> E(F) -> G(M)
    const logicModel = {
      category: "D",
      variantTag: "tree_4gen_ggf",
      members: [
        { id: A, gender: "M" },
        { id: B, gender: "F" },
        { id: C, gender: "M" },
        { id: D, gender: "F" },
        { id: E, gender: "F" },
        { id: G, gender: "M" },
      ],
      parentChild: [
        [A, C],
        [C, E],
        [E, G],
      ],
      spouses: [
        [A, B],
        [C, D],
      ],
      siblings: [],
      query: { type: "relation", source: A, target: G },
    };
    const question = `In a four-generation family of six members: ${A} is married to ${B}. ${C} is the son of ${A} and is married to ${D}. ${E} is the daughter of ${D}. ${G} is the son of ${E}. How is ${A} related to ${G}?`;
    return finalizeQuestion({
      templateId: "BR_D1_FAMILY_TREE_4GEN",
      category: "D",
      subType: "Family Tree / Generation-Based",
      difficulty,
      examLevel: "Mains",
      question,
      logicModel,
      givenData: [`Gen 1: ${A}(+)=${B}(-)`, `Gen 2: ${C}(+)=${D}(-)`, `Gen 3: ${E}(-)`, `Gen 4: ${G}(+)`],
      steps: [
        `${A} is the father of ${C} (Gen 1 -> Gen 2).`,
        `${C} and ${D} are parents of ${E} (Gen 2 -> Gen 3).`,
        `${E} is the mother of ${G} (Gen 3 -> Gen 4).`,
        `Since ${A} is male and 3 generations above ${G}, ${A} is the Great-Grandfather of ${G}.`,
      ],
      shortcut: "3 generations above + Male = Great-Grandfather.",
      rng,
    });
  }

  // 3-Generation family with 2 married couples and siblings
  const askVariant = rng.int(0, 2);
  const queries = [
    { source: D, target: A, desc: `How is ${D} related to ${A}?` }, // Daughter-in-law
    { source: E, target: A, desc: `How is ${E} related to ${A}?` }, // Grandson
    { source: F, target: C, desc: `How is ${F} related to ${C}?` }, // Sister
  ];
  const chosenQ = queries[askVariant];

  const logicModel = {
    category: "D",
    variantTag: `tree_3gen_${askVariant}`,
    members: [
      { id: A, gender: "M" },
      { id: B, gender: "F" },
      { id: C, gender: "M" },
      { id: D, gender: "F" },
      { id: E, gender: "M" },
      { id: F, gender: "F" },
    ],
    parentChild: [
      [A, C],
      [A, F],
      [C, E],
    ],
    spouses: [
      [A, B],
      [C, D],
    ],
    siblings: [[C, F]],
    query: { type: "relation", source: chosenQ.source, target: chosenQ.target },
  };

  const question = `In a three-generation family of six members (${A}, ${B}, ${C}, ${D}, ${E}, and ${F}) with two married couples: ${A} is the father of ${C} and ${F}. ${B} is the wife of ${A}. ${C} is married to ${D}, and ${E} is the son of ${D}. ${F} is unmarried and is the sister of ${C}. ${chosenQ.desc}`;

  return finalizeQuestion({
    templateId: "BR_D1_FAMILY_TREE_3GEN",
    category: "D",
    subType: "Family Tree / Generation-Based",
    difficulty,
    examLevel: "Prelims",
    question,
    logicModel,
    givenData: [`${A}(+) = ${B}(-)`, `Children of ${A}: ${C}(+) and ${F}(-)`, `${C}(+) = ${D}(-) -> child ${E}(+)`],
    steps: [
      `Generation 1: ${A} (Male) is married to ${B} (Female).`,
      `Generation 2: ${C} (Male) and ${F} (Female) are children of ${A} and ${B}. ${C} is married to ${D} (Female).`,
      `Generation 3: ${E} (Male) is the son of ${C} and ${D}.`,
      `From the family tree, ${chosenQ.desc}`,
    ],
    shortcut: "Draw generation rows (Gen 1, Gen 2, Gen 3) with = for couples and — for siblings.",
    rng,
  });
}

// ============================================================================
// CATEGORY E: CODED BLOOD RELATIONSHIPS (Unambiguous Symbol Definitions)
// ============================================================================
function tplE1_CodedExpression(rng, difficulty) {
  const letters = rng.pick(LETTER_SETS);
  const [P, Q, R, S] = letters;
  const symbolSets = [
    { father: "+", mother: "@", brother: "×", sister: "-" },
    { father: "#", mother: "$", brother: "%", sister: "&" },
    { father: "÷", mother: "+", brother: "*", sister: "-" },
  ];
  const sym = rng.pick(symbolSets);
  const variant = rng.int(0, 2);

  let expr, logicModel, questionAsk, steps;
  if (variant === 0) {
    // P + Q - R @ S -> P is father of Q, Q is sister of R, R is mother of S => P is Maternal Grandfather of S
    expr = `${P} ${sym.father} ${Q} ${sym.sister} ${R} ${sym.mother} ${S}`;
    logicModel = {
      category: "E",
      variantTag: "coded_mat_gf",
      members: [
        { id: P, gender: "M" },
        { id: Q, gender: "F" },
        { id: R, gender: "F" },
        { id: S, gender: "U" },
      ],
      parentChild: [[P, Q], [R, S]],
      siblings: [[Q, R]],
      spouses: [],
      query: { type: "relation", source: P, target: S },
    };
    questionAsk = `How is ${P} related to ${S}?`;
    steps = [
      `${P} ${sym.father} ${Q} → ${P} (+) is the father of ${Q}.`,
      `${Q} ${sym.sister} ${R} → ${Q} (-) is the sister of ${R}, so ${P} is also the father of ${R}.`,
      `${R} ${sym.mother} ${S} → ${R} (-) is the mother of ${S}.`,
      `Therefore, ${P} is the father of ${S}'s mother = Maternal Grandfather.`,
    ];
  } else if (variant === 1) {
    // P × Q + R - S -> P is brother of Q, Q is father of R, R is sister of S => P is Paternal Uncle of S
    expr = `${P} ${sym.brother} ${Q} ${sym.father} ${R} ${sym.sister} ${S}`;
    logicModel = {
      category: "E",
      variantTag: "coded_pat_uncle",
      members: [
        { id: P, gender: "M" },
        { id: Q, gender: "M" },
        { id: R, gender: "F" },
        { id: S, gender: "U" },
      ],
      parentChild: [[Q, R]],
      siblings: [[P, Q], [R, S]],
      spouses: [],
      query: { type: "relation", source: P, target: S },
    };
    questionAsk = `How is ${P} related to ${S}?`;
    steps = [
      `${P} ${sym.brother} ${Q} → ${P} (+) is the brother of ${Q}.`,
      `${Q} ${sym.father} ${R} → ${Q} (+) is the father of ${R}.`,
      `${R} ${sym.sister} ${S} → ${R} (-) is the sister of ${S}, so ${Q} is also the father of ${S}.`,
      `Therefore, ${P} is ${S}'s father's brother = Paternal Uncle.`,
    ];
  } else {
    // P - Q @ R × S -> P is sister of Q, Q is mother of R, R is brother of S => P is Maternal Aunt of S
    expr = `${P} ${sym.sister} ${Q} ${sym.mother} ${R} ${sym.brother} ${S}`;
    logicModel = {
      category: "E",
      variantTag: "coded_mat_aunt",
      members: [
        { id: P, gender: "F" },
        { id: Q, gender: "F" },
        { id: R, gender: "M" },
        { id: S, gender: "U" },
      ],
      parentChild: [[Q, R]],
      siblings: [[P, Q], [R, S]],
      spouses: [],
      query: { type: "relation", source: P, target: S },
    };
    questionAsk = `How is ${P} related to ${S}?`;
    steps = [
      `${P} ${sym.sister} ${Q} → ${P} (-) is the sister of ${Q}.`,
      `${Q} ${sym.mother} ${R} → ${Q} (-) is the mother of ${R}.`,
      `${R} ${sym.brother} ${S} → ${R} (+) is the brother of ${S}, so ${Q} is also the mother of ${S}.`,
      `Therefore, ${P} is ${S}'s mother's sister = Maternal Aunt.`,
    ];
  }

  const question = `Read the following coded definitions carefully:\n'X ${sym.father} Y' means 'X is the father of Y'.\n'X ${sym.mother} Y' means 'X is the mother of Y'.\n'X ${sym.brother} Y' means 'X is the brother of Y'.\n'X ${sym.sister} Y' means 'X is the sister of Y'.\n\nIn the expression "${expr}", ${questionAsk}`;

  return finalizeQuestion({
    templateId: "BR_E1_CODED_EXPR",
    category: "E",
    subType: "Coded Blood Relationships",
    difficulty,
    examLevel: difficulty === "Hard" ? "Mains" : "Prelims",
    question,
    logicModel,
    givenData: [`Expression: ${expr}`],
    steps,
    shortcut: "Decode left-to-right into a quick generation chain (+1 for parent, 0 for sibling) while tagging M/F.",
    rng,
  });
}

export const BLOOD_RELATIONS_TEMPLATES_PART_1 = [
  { id: "BR_A1_DIRECT_REL", category: "A", difficulties: ["Easy", "Medium"], fn: tplA1_DirectPaternalMaternal },
  { id: "BR_B1_POINTING_PHOTO", category: "B", difficulties: ["Easy", "Medium"], fn: tplB1_PointingPhotograph },
  { id: "BR_C1_INTRODUCTION", category: "C", difficulties: ["Easy", "Medium"], fn: tplC1_Introduction },
  { id: "BR_D1_FAMILY_TREE", category: "D", difficulties: ["Medium", "Hard"], fn: tplD1_FamilyTree },
  { id: "BR_E1_CODED_EXPR", category: "E", difficulties: ["Medium", "Hard"], fn: tplE1_CodedExpression },
];

export { finalizeQuestion };