// core/formatter.js

export const SUBTYPE_LABELS = {
  // Simplification Types 1-9
  TYPE_1_VBODMAS: "Simplification Type 1: VBODMAS & Brackets",
  TYPE_2_PERCENT_FRACTION: "Simplification Type 2: Percentage to Fraction",
  TYPE_3_MIXED_FRACTIONS: "Simplification Type 3: Mixed Fractions",
  TYPE_4_SQUARES_CUBES_ROOTS: "Simplification Type 4: Squares, Cubes & Roots",
  TYPE_5_SURDS_INDICES: "Simplification Type 5: Surds & Indices",
  TYPE_6_DECIMALS: "Simplification Type 6: Decimal Place-Value",
  TYPE_7_ALGEBRAIC_IDENTITIES: "Simplification Type 7: Algebraic Identities",
  TYPE_8_LADDER_FRACTIONS: "Simplification Type 8: Ladder Fractions",
  TYPE_9_UNIT_DIGIT_SUM: "Simplification Type 9: Unit Digit & Digital Sum",

  // Approximation Types 1-12
  TYPE_1_BASIC_ARITHMETIC: "Approximation Type 1: Basic Arithmetic",
  TYPE_2_DECIMAL_MULTIPLICATION: "Approximation Type 2: Decimal Multiplication",
  TYPE_3_DECIMAL_DIVISION: "Approximation Type 3: Decimal Division",
  TYPE_4_PERCENTAGE_APPROX: "Approximation Type 4: Percentage Approximation",
  TYPE_5_FRACTION_APPROX: "Approximation Type 5: Fraction Approximation",
  TYPE_6_SQUARE_ROOT_APPROX: "Approximation Type 6: Square Root Approximation",
  TYPE_7_CUBE_ROOT_APPROX: "Approximation Type 7: Cube Root Approximation",
  TYPE_8_MIXED_ARITHMETIC: "Approximation Type 8: Mixed Arithmetic",
  TYPE_9_BRACKET_APPROX: "Approximation Type 9: Bracket Approximation",
  TYPE_10_MULTIPLE_OPERATIONS: "Approximation Type 10: Multiple Operations",
  TYPE_11_POWER_APPROX: "Approximation Type 11: Power Approximation",
  TYPE_12_COMBINED_ROOT_ARITH: "Approximation Type 12: Combined Root & Arithmetic",

  // Quadratic Equations
  TYPE_1_QUADRATIC_COMPARISON: "Quadratic Equations: Root Comparison",

  // Number Series (Missing & Wrong)
  MISSING_TYPE_1_AP_DIFFERENCE: "Missing Number Series",
  MISSING_TYPE_2_DOUBLE_DIFFERENCE: "Missing Number Series",
  MISSING_TYPE_3_SQUARES_CUBES_DIFF: "Missing Number Series",
  MISSING_TYPE_4_MULT_ADD_CONST: "Missing Number Series",
  MISSING_TYPE_5_MULT_INCREASING: "Missing Number Series",
  MISSING_TYPE_6_DECIMAL_HALF_MULT: "Missing Number Series",
  MISSING_TYPE_7_ALTERNATING_SERIES: "Missing Number Series",
  MISSING_TYPE_8_PRIME_FIBONACCI_DIFF: "Missing Number Series",
  MISSING_TYPE_8_PRIME_DIFF: "Missing Number Series",
  WRONG_TYPE_1_AP_DIFFERENCE: "Wrong Number Series",
  WRONG_TYPE_2_DOUBLE_DIFFERENCE: "Wrong Number Series",
  WRONG_TYPE_3_SQUARES_CUBES_DIFF: "Wrong Number Series",
  WRONG_TYPE_4_MULT_ADD_CONST: "Wrong Number Series",
  WRONG_TYPE_5_MULT_INCREASING: "Wrong Number Series",
  WRONG_TYPE_6_DECIMAL_HALF_MULT: "Wrong Number Series",
  WRONG_TYPE_7_ALTERNATING_SERIES: "Wrong Number Series",
  WRONG_TYPE_8_PRIME_DIFF: "Wrong Number Series",
};

/**
 * Converts a Question Engine output object into the exact HHK Project question record
 * used by PostgreSQL (`questions` table), Admin preview, Mock Tests, Topic Practice, and Daily Challenge.
 */
export function formatEngineQuestionForHHK(
  rawQuestion,
  {
    topicName = "Simplification & Approximation",
    subtopicName = "",
    optionCount = 5,
  } = {}
) {
  const isApprox =
    String(rawQuestion.topic || "").toLowerCase().includes("approx") ||
    String(rawQuestion.subType || "").includes("APPROX") ||
    String(rawQuestion.questionText || "").includes("≈");

  const isQuadratic =
    String(rawQuestion.topic || "").toLowerCase().includes("quadratic") ||
    String(rawQuestion.subType || "").includes("QUADRATIC");

  let promptPrefix =
    "What value will come in place of the question mark (?) in the following question?";
  if (isApprox) {
    promptPrefix =
      "What approximate value will come in place of the question mark (?) in the following question? (You are not expected to calculate the exact value)";
  } else if (isQuadratic) {
    promptPrefix =
      "In the following question, two equations I and II are given. You have to solve both the equations and give the answer:";
  }

const isMathExprTopic =
    isApprox ||
    String(rawQuestion.topic || "").toLowerCase().includes("simplification") ||
    String(rawQuestion.subType || "").startsWith("TYPE_");

  const alreadyHasPrompt =
    rawQuestion.questionText.startsWith("Directions:") ||
    rawQuestion.questionText.startsWith("In ") ||
    rawQuestion.questionText.startsWith("What ") ||
    rawQuestion.questionText.startsWith("Pointing ") ||
    rawQuestion.questionText.startsWith("Introducing ") ||
    rawQuestion.questionText.startsWith("Read ") ||
    rawQuestion.questionText.startsWith("Study ");

  const formattedQuestionText =
    !isMathExprTopic || isQuadratic || alreadyHasPrompt
      ? isQuadratic && !alreadyHasPrompt
        ? `${promptPrefix}\n${rawQuestion.questionText}`
        : rawQuestion.questionText
      : `${promptPrefix}\n${rawQuestion.questionText}`;
  const rawOpts = rawQuestion.options.map((o) => String(o));
  const correctText = String(rawQuestion.answer);

  let selectedOpts = rawOpts;
  if (optionCount === 4 && rawOpts.length > 4) {
    const distractors = rawOpts.filter((o) => o !== correctText).slice(0, 3);
    const insertPos = Math.min(rawQuestion.correctOptionIndex, 3);
    selectedOpts = [...distractors];
    selectedOpts.splice(insertPos, 0, correctText);
  }

  const keys = ["A", "B", "C", "D", "E", "F"].slice(0, selectedOpts.length);
  let correctAnswer = "A";
  const options = selectedOpts.map((text, idx) => {
    const key = keys[idx];
    if (text === correctText) {
      correctAnswer = key;
    }
    return { key, text };
  });

  const isUmbrellaSubtopic =
    !subtopicName ||
    !subtopicName.trim() ||
    subtopicName.includes("(All 9 Types)") ||
    subtopicName.includes("(All 12 Types)");

  const resolvedSubtopic = isUmbrellaSubtopic
    ? SUBTYPE_LABELS[rawQuestion.subType] || subtopicName.trim() || rawQuestion.topic || ""
    : subtopicName.trim();

  const normalizedDiff = String(rawQuestion.difficulty || "MEDIUM").toLowerCase();
  const difficulty = ["easy", "medium", "hard"].includes(normalizedDiff)
    ? normalizedDiff
    : "medium";

  const explanation = Array.isArray(rawQuestion.solutionSteps)
    ? rawQuestion.solutionSteps.join(" → ")
    : String(rawQuestion.explanation || "");

  return {
    questionId: rawQuestion.questionId,
    exam: rawQuestion.exam,
    topicName: topicName || rawQuestion.topic || "Simplification & Approximation",
    subtopicName: resolvedSubtopic,
    subType: rawQuestion.subType,
    difficulty,
    questionType: "mcq",
    questionText: formattedQuestionText,
    options,
    correctAnswer,
    explanation,
    generationMode: rawQuestion.generationMode || "RULE_ENGINE",
    ...(rawQuestion.diSetMeta ? { diSetMeta: rawQuestion.diSetMeta } : {}),
  };
}
