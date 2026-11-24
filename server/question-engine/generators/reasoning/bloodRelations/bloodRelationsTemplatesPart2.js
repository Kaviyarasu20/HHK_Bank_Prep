// Place at: server/question-engine/generators/reasoning/bloodRelations/bloodRelationsTemplatesPart2.js

import { LETTER_SETS } from "./bloodRelationsExamProfiles.js";
import { finalizeQuestion } from "./bloodRelationsTemplatesPart1.js";

// ============================================================================
// CATEGORY F: MULTIPLE STATEMENT-BASED RELATIONSHIP CHAINS
// ============================================================================
function tplF1_MultiStatementChain(rng, difficulty) {
  const letters = rng.pick(LETTER_SETS);
  const [A, B, C, D, E] = letters;
  const variant = rng.int(0, 2);

  if (variant === 0) {
    // A is brother of B; B is mother of C; C is father of D -> A is Great-Uncle? Wait: keep standard banking relation!
    // A is father of B; B is sister of C; C is married to D; E is son of D -> A is Maternal/Paternal Grandfather of E
    const logicModel = {
      category: "F",
      variantTag: "chain_pat_gf",
      members: [
        { id: A, gender: "M" },
        { id: B, gender: "F" },
        { id: C, gender: "M" },
        { id: D, gender: "F" },
        { id: E, gender: "M" },
      ],
      parentChild: [[A, B], [C, E]],
      siblings: [[B, C]],
      spouses: [[C, D]],
      query: { type: "relation", source: A, target: E },
    };
    const question = `${A} is the father of ${B}. ${B} is the sister of ${C}. ${C} is the husband of ${D}. ${E} is the son of ${D}. How is ${A} related to ${E}?`;
    return finalizeQuestion({
      templateId: "BR_F1_MULTI_CHAIN",
      category: "F",
      subType: "Multiple Statement-Based",
      difficulty,
      examLevel: "Prelims",
      question,
      logicModel,
      givenData: [`${A}(+) -> ${B}(-) — ${C}(+) = ${D}(-) -> ${E}(+)`],
      steps: [
        `${B} is the sister of ${C}, and ${A} is the father of ${B}, so ${A} is also the father of ${C}.`,
        `${C} (male) is married to ${D} (female), and ${E} is ${D}'s son → ${C} is ${E}'s father.`,
        `Since ${A} is the father of ${E}'s father (${C}), ${A} is the Paternal Grandfather of ${E}.`,
      ],
      shortcut: "Link siblings under the same parent first, then step down through the married couple.",
      rng,
    });
  }

  if (variant === 1) {
    // Brother-in-law via spouse's brother
    const logicModel = {
      category: "F",
      variantTag: "chain_bil",
      members: [
        { id: A, gender: "M" },
        { id: B, gender: "F" },
        { id: C, gender: "M" },
        { id: D, gender: "M" },
      ],
      parentChild: [[D, B], [D, C]],
      siblings: [[B, C]],
      spouses: [[A, B]],
      query: { type: "relation", source: C, target: A },
    };
    const question = `${A} is married to ${B}. ${D} is the father of ${B}. ${C} is the only son of ${D}. How is ${C} related to ${A}?`;
    return finalizeQuestion({
      templateId: "BR_F1_MULTI_CHAIN",
      category: "F",
      subType: "Multiple Statement-Based",
      difficulty,
      examLevel: "Prelims",
      question,
      logicModel,
      givenData: [`${A}(+) = ${B}(-)`, `${D}(+) -> ${B}(-), ${C}(+)`],
      steps: [
        `${D} is the father of ${B}, and ${C} is ${D}'s only son → ${C} is the brother of ${B}.`,
        `${A} is married to ${B}. Since ${C} is ${A}'s wife's brother, ${C} is the Brother-in-law of ${A}.`,
      ],
      shortcut: "Wife's brother = Brother-in-law.",
      rng,
    });
  }

  // Variant 2: Mother-in-law
  const logicModel = {
    category: "F",
    variantTag: "chain_mil",
    members: [
      { id: A, gender: "F" },
      { id: B, gender: "M" },
      { id: C, gender: "F" },
      { id: D, gender: "M" },
    ],
    parentChild: [[A, B], [B, D]],
    siblings: [],
    spouses: [[B, C]],
    query: { type: "relation", source: A, target: C },
  };
  const question = `${A} is the mother of ${B}. ${D} is the son of ${B}. ${C} is the mother of ${D}. How is ${A} related to ${C}?`;
  return finalizeQuestion({
    templateId: "BR_F1_MULTI_CHAIN",
    category: "F",
    subType: "Multiple Statement-Based",
    difficulty,
    examLevel: "Prelims",
    question,
    logicModel,
    givenData: [`${A}(-) -> ${B}(+)`, `${B}(+) = ${C}(-) -> ${D}(+)`],
    steps: [
      `${D} is the son of ${B} and ${C} is the mother of ${D} → ${B} (male) and ${C} (female) are a married couple.`,
      `${A} is the mother of ${B} (${C}'s husband).`,
      `Husband's mother = Mother-in-law.`,
    ],
    shortcut: "Two parents of the same child form a married couple; husband's mother = Mother-in-law.",
    rng,
  });
}

// ============================================================================
// CATEGORY G: CONDITIONAL BLOOD RELATIONSHIPS
// ============================================================================
function tplG1_ConditionalRelation(rng, difficulty) {
  const letters = rng.pick(LETTER_SETS);
  const [A, B, C, D, E] = letters;
  const variant = rng.int(0, 1);

  if (variant === 0) {
    // Conditional gender fixes Nephew vs Niece
    const isFemale = rng.random() < 0.5;
    const condGender = isFemale ? "F" : "M";
    const condWord = isFemale ? "female" : "male";
    const logicModel = {
      category: "G",
      variantTag: `cond_nephew_niece_${condGender}`,
      members: [
        { id: A, gender: "M" },
        { id: B, gender: "F" },
        { id: C, gender: condGender },
        { id: D, gender: "M" },
      ],
      parentChild: [[B, C]],
      siblings: [[A, B]],
      spouses: [[B, D]],
      query: { type: "relation", source: C, target: A },
    };
    const question = `${A} is the brother of ${B}. ${B} is married to ${D}. ${C} is the only child of ${D}. If ${C} is ${condWord}, how is ${C} related to ${A}?`;
    return finalizeQuestion({
      templateId: "BR_G1_CONDITIONAL",
      category: "G",
      subType: "Conditional Blood Relationships",
      difficulty,
      examLevel: difficulty === "Hard" ? "Mains" : "Prelims",
      question,
      logicModel,
      givenData: [`${A}(+) — ${B}(-) = ${D}(+)`, `${C}(${condGender}) is child of ${D}`],
      steps: [
        `${B} and ${D} are married, so ${C} is the child of ${B} (${A}'s sister).`,
        `Without the condition, ${C}'s gender would be unknown.`,
        `Given that ${C} is ${condWord}, ${C} is ${A}'s ${isFemale ? "Niece" : "Nephew"}.`,
      ],
      shortcut: "Apply the conditional gender tag directly onto the target node before reading the relation.",
      rng,
    });
  }

  // Variant 1: Conditional marriage links Son-in-law / Daughter-in-law
  const logicModel = {
    category: "G",
    variantTag: "cond_marriage_dil",
    members: [
      { id: A, gender: "M" },
      { id: B, gender: "F" },
      { id: C, gender: "M" },
      { id: D, gender: "F" },
      { id: E, gender: "M" },
    ],
    parentChild: [[A, C], [E, D]],
    siblings: [],
    spouses: [[A, B], [C, D]],
    query: { type: "relation", source: D, target: B },
  };
  const question = `${A} is married to ${B}. ${C} is the son of ${A}. ${D} is the daughter of ${E}. If ${D} is married to ${C}, how is ${D} related to ${B}?`;
  return finalizeQuestion({
    templateId: "BR_G1_CONDITIONAL",
    category: "G",
    subType: "Conditional Blood Relationships",
    difficulty,
    examLevel: "Mains",
    question,
    logicModel,
    givenData: [`${A}(+) = ${B}(-) -> ${C}(+)`, `Condition: ${D}(-) = ${C}(+)`],
    steps: [
      `${C} is the son of ${A} and ${B}.`,
      `Under the condition that ${D} (female) is married to ${C}, ${D} becomes the wife of ${B}'s son.`,
      `Therefore, ${D} is the Daughter-in-law of ${B}.`,
    ],
    shortcut: "Son's wife = Daughter-in-law.",
    rng,
  });
}

// ============================================================================
// CATEGORY H: GENUINE CANNOT BE DETERMINED (Insufficient Gender / Missing Link)
// ============================================================================
function tplH1_CannotBeDetermined(rng, difficulty) {
  const letters = rng.pick(LETTER_SETS);
  const [A, B, C, D] = letters;
  const variant = rng.int(0, 1);

  if (variant === 0) {
    // Unknown gender of child C -> "How is C related to A?" => Cannot be determined (could be Son or Daughter!)
    const logicModel = {
      category: "H",
      variantTag: "cbd_unknown_child_gender",
      members: [
        { id: A, gender: "M" },
        { id: B, gender: "F" },
        { id: C, gender: "U" },
        { id: D, gender: "M" },
      ],
      parentChild: [[A, C], [A, D]],
      siblings: [[C, D]],
      spouses: [[A, B]],
      query: { type: "relation", source: C, target: A },
    };
    const question = `${A} is the husband of ${B}. ${D} is the brother of ${C}. ${A} is the father of ${D}. How is ${C} related to ${A}?`;
    return finalizeQuestion({
      templateId: "BR_H1_CBD",
      category: "H",
      subType: "Cannot Be Determined",
      difficulty,
      examLevel: difficulty === "Hard" ? "Mains" : "Prelims",
      question,
      logicModel,
      givenData: [`${A}(+) = ${B}(-)`, `${D}(+) is brother of ${C}(?)`, `${A} is father of ${D}`],
      steps: [
        `${D} is the brother of ${C} (so ${D} is male, and ${C} is ${A}'s child).`,
        `However, no statement specifies whether ${C} is male or female.`,
        `Thus, ${C} could be either the Son or the Daughter of ${A}.`,
        `Therefore, the exact relationship Cannot be determined.`,
      ],
      shortcut: "Never assume gender! If the asked person's gender is missing for Son/Daughter or Brother/Sister → Cannot be determined.",
      rng,
      customDistractors: ["Son", "Daughter", "Brother", "Nephew"],
    });
  }

  // Variant 1: Unknown gender of sibling -> "How is B related to C?" (could be Maternal Uncle or Maternal Aunt!)
  const logicModel = {
    category: "H",
    variantTag: "cbd_unknown_sibling_gender",
    members: [
      { id: A, gender: "F" },
      { id: B, gender: "U" },
      { id: C, gender: "M" },
    ],
    parentChild: [[A, C]],
    siblings: [[A, B]],
    spouses: [],
    query: { type: "relation", source: B, target: C },
  };
  const question = `${A} is the sister of ${B}. ${A} is the mother of ${C}, and ${C} is a boy. How is ${B} related to ${C}?`;
  return finalizeQuestion({
    templateId: "BR_H1_CBD",
    category: "H",
    subType: "Cannot Be Determined",
    difficulty,
    examLevel: "Prelims",
    question,
    logicModel,
    givenData: [`${A}(-) is sister of ${B}(?)`, `${A}(-) is mother of ${C}(+)`],
    steps: [
      `${A} is the sister of ${B}, which only establishes that ${A} is female — NOT ${B}'s gender.`,
      `Since ${B} could be ${A}'s brother (Maternal Uncle) or ${A}'s sister (Maternal Aunt), the relationship Cannot be determined.`,
    ],
    shortcut: "'A is the sister of B' tells you A's gender, NEVER B's gender.",
    rng,
    customDistractors: ["Maternal Uncle", "Maternal Aunt", "Paternal Uncle", "Cousin"],
  });
}

// ============================================================================
// CATEGORY I: FAMILY COUNTING (Males, Females, Couples, Generations)
// ============================================================================
function tplI1_FamilyCounting(rng, difficulty) {
  const letters = rng.pick(LETTER_SETS);
  const [A, B, C, D, E, F, G] = letters;
  const metric = rng.pick(["males", "females", "couples"]);

  const logicModel = {
    category: "I",
    variantTag: `count_${metric}`,
    members: [
      { id: A, gender: "M" },
      { id: B, gender: "F" },
      { id: C, gender: "M" },
      { id: D, gender: "F" },
      { id: E, gender: "M" },
      { id: F, gender: "F" },
      { id: G, gender: "M" },
    ],
    parentChild: [
      [A, C],
      [A, F],
      [C, E],
      [C, G],
    ],
    spouses: [
      [A, B],
      [C, D],
    ],
    siblings: [
      [C, F],
      [E, G],
    ],
    query: { type: "count", metric },
  };

  const metricPrompts = {
    males: "How many male members are there in the family?",
    females: "How many female members are there in the family?",
    couples: "How many married couples are there in the family?",
  };

  const question = `In a family of seven members (${A}, ${B}, ${C}, ${D}, ${E}, ${F}, and ${G}): ${A} is the father of ${C} and ${F}. ${B} is the wife of ${A}. ${C} is married to ${D}. ${E} and ${G} are the two sons of ${D}. ${F} is the unmarried sister of ${C}. ${metricPrompts[metric]}`;

  return finalizeQuestion({
    templateId: "BR_I1_COUNTING",
    category: "I",
    subType: "Family Counting",
    difficulty,
    examLevel: "Prelims",
    question,
    logicModel,
    givenData: [`7 members: ${A}(+), ${B}(-), ${C}(+), ${D}(-), ${E}(+), ${F}(-), ${G}(+)`],
    steps: [
      `Married couples (2): (${A}, ${B}) and (${C}, ${D}).`,
      `Males (4): ${A}, ${C}, ${E}, ${G}.`,
      `Females (3): ${B}, ${D}, ${F}.`,
      `Every unique member is counted exactly once.`,
    ],
    shortcut: "Tag (+) and (-) next to each unique letter as you read, then tally once at the end.",
    rng,
    customDistractors: ["1", "2", "3", "4", "5", "6"],
  });
}

// ============================================================================
// CATEGORY J: ADVANCED MULTI-CONDITION FAMILY PUZZLES (PO / Mains)
// ============================================================================
function tplJ1_AdvancedPuzzle(rng, difficulty) {
  const letters = rng.pick(LETTER_SETS);
  const [A, B, C, D, E, F, G, H] = letters;
  const askVariant = rng.int(0, 1);

  // 8-member, 3-generation, 2-couple puzzle with maternal + paternal links
  const logicModel = {
    category: "J",
    variantTag: `adv_puzzle_${askVariant}`,
    members: [
      { id: A, gender: "M" },
      { id: B, gender: "F" },
      { id: C, gender: "M" },
      { id: D, gender: "F" },
      { id: E, gender: "M" },
      { id: F, gender: "F" },
      { id: G, gender: "F" },
      { id: H, gender: "M" },
    ],
    parentChild: [
      [A, C],
      [A, F],
      [C, G],
      [F, H],
    ],
    spouses: [
      [A, B],
      [C, D],
      [F, E],
    ],
    siblings: [[C, F]],
    query:
      askVariant === 0
        ? { type: "relation", source: E, target: A } // Son-in-law
        : { type: "relation", source: G, target: H }, // Cousin
  };

  const askText =
    askVariant === 0
      ? `How is ${E} related to ${A}?`
      : `How is ${G} related to ${H}?`;

  const question = `Study the following family information carefully:\nThere are eight members (${A}, ${B}, ${C}, ${D}, ${E}, ${F}, ${G}, and ${H}) spanning three generations with three married couples and no single parents.\n1. ${A} is the paternal grandfather of ${G} and is married to ${B}.\n2. ${C} is the brother of ${F}, and ${C} is married to ${D}.\n3. ${G} is the daughter of ${D}.\n4. ${F} is married to ${E}, and ${H} is the only son of ${E}.\n${askText}`;

  return finalizeQuestion({
    templateId: "BR_J1_ADV_PUZZLE",
    category: "J",
    subType: "Advanced Family Relationship Puzzles",
    difficulty,
    examLevel: "Mains",
    question,
    logicModel,
    givenData: [
      `Gen 1: ${A}(+) = ${B}(-)`,
      `Gen 2: ${C}(+) = ${D}(-) and ${F}(-) = ${E}(+) (where ${C} and ${F} are siblings)`,
      `Gen 3: ${G}(-) is child of ${C}/${D}; ${H}(+) is child of ${F}/${E}`,
    ],
    steps: [
      `${A} is paternal grandfather of ${G}, and ${G} is daughter of ${D} (wife of ${C}) → ${C} is son of ${A} and ${B}.`,
      `${F} is sister of ${C}, so ${F} is daughter of ${A} and ${B}.`,
      `${F} is married to ${E} (male), making ${E} the Son-in-law of ${A}.`,
      `${G} (child of ${C}) and ${H} (child of ${F}) are children of siblings → Cousins.`,
    ],
    shortcut: "Anchor the 3-generation spine first (Grandparent → Siblings C & F → Grandchildren G & H).",
    rng,
  });
}

export const BLOOD_RELATIONS_TEMPLATES_PART_2 = [
  { id: "BR_F1_MULTI_CHAIN", category: "F", difficulties: ["Easy", "Medium"], fn: tplF1_MultiStatementChain },
  { id: "BR_G1_CONDITIONAL", category: "G", difficulties: ["Medium", "Hard"], fn: tplG1_ConditionalRelation },
  { id: "BR_H1_CBD", category: "H", difficulties: ["Medium", "Hard"], fn: tplH1_CannotBeDetermined },
  { id: "BR_I1_COUNTING", category: "I", difficulties: ["Easy", "Medium"], fn: tplI1_FamilyCounting },
  { id: "BR_J1_ADV_PUZZLE", category: "J", difficulties: ["Hard"], fn: tplJ1_AdvancedPuzzle },
];