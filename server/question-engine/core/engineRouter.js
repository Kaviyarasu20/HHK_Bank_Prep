// Place at: server/question-engine/core/engineRouter.js
// ============================================================================
// 1. QUANTITATIVE APTITUDE GENERATORS (ACTIVE)
// ============================================================================
import { generateSimplificationBatch } from "../generators/quant/simplification/index.js";
import { generateApproximationBatch } from "../generators/quant/approximation/index.js";
import { generateQuadraticBatch } from "../generators/quant/quadraticEquations/index.js";
import { generateNumberSeriesBatch } from "../generators/quant/numberSeries/index.js";
import { generateLinearEquationsBatch } from "../generators/quant/linearEquations/index.js";
import { generatePercentageBatch } from "../generators/quant/percentage/index.js";
import { generateRatioBatch } from "../generators/quant/ratioProportion/index.js";
import { generateProfitLossBatch } from "../generators/quant/profitLoss/index.js";
import { generateInterestBatch } from "../generators/quant/interest/index.js";
import { generateTimeWorkBatch } from "../generators/quant/timeWork/index.js";
import { generateNumberSystemBatch } from "../generators/quant/numberSystem/index.js";
import { generateAverageBatch } from "../generators/quant/average/index.js";
import { generatePipesCisternsBatch } from "../generators/quant/pipesCisterns/index.js";
import { generateTsdBatch } from "../generators/quant/timeSpeedDistance/index.js";
import { generateMixtureAlligationBatch } from "../generators/quant/mixtureAlligation/index.js";
import { generatePartnershipBatch } from "../generators/quant/partnership/index.js";
import { generateAgesBatch } from "../generators/quant/problemsOnAges/index.js";
import { generateProbabilityBatch } from "../generators/quant/probability/index.js";
import { generatePncBatch } from "../generators/quant/permutationCombination/index.js";
import { generateDIQuestionsForHHK } from "../generators/quant/dataInterpretation/index.js";

// ============================================================================
// 2. REASONING ABILITY GENERATORS
// Uncomment each import ONLY after creating its folder & index.js
// ============================================================================
import { generateBloodRelationsBatch } from "../generators/reasoning/bloodRelations/index.js";
import { generateSeatingQuestionsForHHK } from "../generators/reasoning/seatingArrangement/index.js";
import { generateFloorQuestionsForHHK } from "../generators/reasoning/floorArrangement/index.js";
import { generatePuzzlesForHHK } from "../generators/reasoning/puzzles/index.js";
// import { generateSeatingArrangementBatch } from "../generators/reasoning/seatingArrangement/index.js";
import { generateSyllogismBatch } from "../generators/reasoning/syllogism/index.js";
import { generateInequalityBatch } from "../generators/reasoning/inequality/index.js";
import { generateCodingDecodingBatch } from "../generators/reasoning/codingDecoding/index.js";
import { generateDirectionDistanceBatch } from "../generators/reasoning/directionDistance/index.js";
import { generateOrderRankingBatch } from "../generators/reasoning/orderRanking/index.js";
import { generateAlphanumericSeriesBatch } from "../generators/reasoning/alphanumericSeries/index.js";
import { generateLetterSeriesBatch } from "../generators/reasoning/letterSeries/index.js";
import { generateInputOutputBatch } from "../generators/reasoning/inputOutput/index.js";
import { generateLogicalReasoningBatch } from "../generators/reasoning/logicalReasoning/index.js";
import { generateStatementConclusionBatch } from "../generators/reasoning/statementConclusion/index.js";
import { generateStatementAssumptionBatch } from "../generators/reasoning/statementAssumption/index.js";
import { generateCauseEffectBatch } from "../generators/reasoning/causeEffect/index.js";
import { generateAnalogyBatch } from "../generators/reasoning/analogy/index.js";
import { generateClassificationBatch } from "../generators/reasoning/classification/index.js";

// ============================================================================
// 3. ENGLISH LANGUAGE GENERATORS (PLANNED)
// ============================================================================
// import { generateReadingComprehensionBatch } from "../generators/english/readingComprehension/index.js";
import { generateClozeTestBatch } from "../generators/english/clozeTest/index.js";
import { generateErrorDetectionBatch } from "../generators/english/errorDetection/index.js";
import { generateSentenceCorrectionBatch } from "../generators/english/sentenceCorrection/index.js";
import { generateFillInTheBlanksBatch } from "../generators/english/fillInTheBlanks/index.js";
import { generateParaJumblesBatch } from "../generators/english/paraJumbles/index.js";
import { generateSentenceRearrangementBatch } from "../generators/english/sentenceRearrangement/index.js";
import { generatePhraseReplacementBatch } from "../generators/english/phraseReplacement/index.js";
import { generateVocabularyBatch } from "../generators/english/vocabulary/index.js";
import { generateSynonymsAntonymsBatch } from "../generators/english/synonymsAntonyms/index.js";
import { generateIdiomsPhrasesBatch } from "../generators/english/idiomsPhrases/index.js";
import { generateWordUsageBatch } from "../generators/english/wordUsage/index.js";
import { generateGrammarBatch } from "../generators/english/grammar/index.js";

// ============================================================================
// 4. BANKING & GENERAL AWARENESS + COMPUTER GENERATORS (PLANNED)
// ============================================================================
// import { generateBankingAwarenessBatch } from "../generators/bankingAwareness/index.js";
// import { generateGeneralAwarenessBatch } from "../generators/generalAwareness/index.js";
// import { generateComputerAwarenessBatch } from "../generators/computer/index.js";

// ============================================================================
// CORE ENGINE UTILITIES
// ============================================================================
import { resolveExamBlueprintKey, EXAM_BLUEPRINTS } from "../config/examBlueprints.js";
import { validateEngineQuestion } from "./validator.js";
import { formatEngineQuestionForHHK } from "./formatter.js";

const resolveExamLevel = (s) =>
  s.includes("mains") ? "MAINS" : s.includes("prelims") ? "PRELIMS" : "AUTO";

const SUBTOPIC_KEYWORD_FILTERS = [
  // Simplification Types 1-9
  ["vbodmas", "simplification", [1]],
  ["percentage to fraction", "simplification", [2]],
  ["mixed fraction", "simplification", [3]],
  ["squares, cubes", "simplification", [4]],
  ["surds", "simplification", [5]],
  ["indices", "simplification", [5]],
  ["decimal place", "simplification", [6]],
  ["algebraic", "simplification", [7]],
  ["ladder", "simplification", [8]],
  ["unit digit", "simplification", [9]],
  ["digital sum", "simplification", [9]],
  // Approximation Types 1-12
  ["basic arithmetic", "approximation", [1]],
  ["decimal multiplication", "approximation", [2]],
  ["decimal division", "approximation", [3]],
  ["percentage approx", "approximation", [4]],
  ["fraction approx", "approximation", [5]],
  ["square root approx", "approximation", [6]],
  ["cube root approx", "approximation", [7]],
  ["mixed arithmetic", "approximation", [8]],
  ["bracket approx", "approximation", [9]],
  ["multiple operations", "approximation", [10]],
  ["power approx", "approximation", [11]],
  ["combined root", "approximation", [12]],
];

const LEVEL_BATCH_GENERATORS = [
  ["linear_", generateLinearEquationsBatch],
  ["percentage_", generatePercentageBatch],
  ["profit_loss_", generateProfitLossBatch],
  ["time_work_", generateTimeWorkBatch],
  ["number_system_", generateNumberSystemBatch],
  ["average_", generateAverageBatch],
  ["ratio_", generateRatioBatch],
];

/**
 * Fingerprinted Generators Registry
 * Uncomment each line as you build and import its generator above.
 */
const FINGERPRINTED_GENERATORS = {
  // --- Quant (Active) ---
  mixture_alligation: { batchFn: generateMixtureAlligationBatch, seedStride: 149 },
  partnership: { batchFn: generatePartnershipBatch, seedStride: 163 },
  problems_on_ages: { batchFn: generateAgesBatch, seedStride: 179 },
  probability: { batchFn: generateProbabilityBatch, seedStride: 197 },
  permutation_combination: { batchFn: generatePncBatch, seedStride: 211 },

  // --- Reasoning (Active + Planned) ---
  blood_relations: { batchFn: generateBloodRelationsBatch, seedStride: 229 },
  floor_arrangement: { batchFn: generateFloorQuestionsForHHK, seedStride: 233 },
  // puzzles: { batchFn: generatePuzzlesBatch, seedStride: 233 },
  // seating_arrangement: { batchFn: generateSeatingArrangementBatch, seedStride: 239 },
  syllogism: { batchFn: generateSyllogismBatch, seedStride: 241 },
  inequality: { batchFn: generateInequalityBatch, seedStride: 251 },
  coding_decoding: { batchFn: generateCodingDecodingBatch, seedStride: 257 },
  direction_distance: { batchFn: generateDirectionDistanceBatch, seedStride: 263 },
  order_ranking: { batchFn: generateOrderRankingBatch, seedStride: 269 },
  alphanumeric_series: { batchFn: generateAlphanumericSeriesBatch, seedStride: 271 },
  letter_series: { batchFn: generateLetterSeriesBatch, seedStride: 277 },
  input_output: { batchFn: generateInputOutputBatch, seedStride: 281 },
  logical_reasoning: { batchFn: generateLogicalReasoningBatch, seedStride: 283 },
  statement_conclusion: { batchFn: generateStatementConclusionBatch, seedStride: 293 },
  statement_assumption: { batchFn: generateStatementAssumptionBatch, seedStride: 307 },
  cause_effect: { batchFn: generateCauseEffectBatch, seedStride: 311 },
  analogy: { batchFn: generateAnalogyBatch, seedStride: 313 },
  classification: { batchFn: generateClassificationBatch, seedStride: 317 },

  // --- English (Planned) ---
  // reading_comprehension: { batchFn: generateReadingComprehensionBatch, seedStride: 331 },
  cloze_test: { batchFn: generateClozeTestBatch, seedStride: 337 },
  error_detection: { batchFn: generateErrorDetectionBatch, seedStride: 347 },
  sentence_correction: { batchFn: generateSentenceCorrectionBatch, seedStride: 349 },
  fill_in_the_blanks: { batchFn: generateFillInTheBlanksBatch, seedStride: 353 },
  para_jumbles: { batchFn: generateParaJumblesBatch, seedStride: 359 },
  sentence_rearrangement: { batchFn: generateSentenceRearrangementBatch, seedStride: 367 },
  phrase_replacement: { batchFn: generatePhraseReplacementBatch, seedStride: 373 },
  vocabulary: { batchFn: generateVocabularyBatch, seedStride: 379 },
  synonyms_antonyms: { batchFn: generateSynonymsAntonymsBatch, seedStride: 383 },
  idioms_phrases: { batchFn: generateIdiomsPhrasesBatch, seedStride: 389 },
  word_usage: { batchFn: generateWordUsageBatch, seedStride: 397 },
  grammar: { batchFn: generateGrammarBatch, seedStride: 401 },

  // --- Banking / General / Computer Awareness (Planned) ---
  // banking_awareness: { batchFn: generateBankingAwarenessBatch, seedStride: 409 },
  // general_awareness: { batchFn: generateGeneralAwarenessBatch, seedStride: 419 },
  // computer_awareness: { batchFn: generateComputerAwarenessBatch, seedStride: 421 },
};

/**
 * Maps topic & subtopic dropdown strings to the right modular Question Engine.
 */
export function resolveSubtopicEngineFilter(topicName = "", subtopicName = "") {
  const t = String(topicName || "").toLowerCase();
  const s = String(subtopicName || "").toLowerCase();

  // ==========================================================================
  // REASONING ABILITY ROUTES
  // ==========================================================================
  if (t.includes("blood relation") || s.includes("blood relation")) {
    return { engine: "blood_relations", allowedTypes: null };
  }
  if (t.includes("seating")) {
    return { engine: "seating_arrangement", allowedTypes: null };
  }
  if (t.includes("floor") || (t.includes("arrangement") && !t.includes("rearrangement"))) {
    return { engine: "floor_arrangement", allowedTypes: null };
  }
  // Uncomment each route below when its generator is added to FINGERPRINTED_GENERATORS:
  if (t.includes("puzzle")) return { engine: "puzzles", allowedTypes: null };
  // if (t.includes("seating")) return { engine: "seating_arrangement", allowedTypes: null };
  if (t.includes("syllogism") || s.includes("syllogism")) return { engine: "syllogism", allowedTypes: null };
  if (t.includes("inequalit") || s.includes("inequalit")) return { engine: "inequality", allowedTypes: null };
  if (t.includes("coding") || t.includes("decoding") || s.includes("coding") || s.includes("decoding")) return { engine: "coding_decoding", allowedTypes: null };
  if ((t.includes("direction") || s.includes("direction")) && !t.includes("speed")) return { engine: "direction_distance", allowedTypes: null };
  if (t.includes("order") || t.includes("ranking") || s.includes("order") || s.includes("ranking")) return { engine: "order_ranking", allowedTypes: null };
  if (t.includes("alphanumeric") || s.includes("alphanumeric")) return { engine: "alphanumeric_series", allowedTypes: null };
  if (t.includes("letter series") || s.includes("letter series")) return { engine: "letter_series", allowedTypes: null };
  if (t.includes("input-output") || t.includes("input output") || s.includes("input-output") || s.includes("input output")) return { engine: "input_output", allowedTypes: null };
  if (t.includes("logical reasoning") || s.includes("logical reasoning")) return { engine: "logical_reasoning", allowedTypes: null };
  if (t.includes("conclusion") || s.includes("conclusion")) return { engine: "statement_conclusion", allowedTypes: null };
  if (t.includes("assumption") || s.includes("assumption")) return { engine: "statement_assumption", allowedTypes: null };
  if (t.includes("cause") || s.includes("cause")) return { engine: "cause_effect", allowedTypes: null };
  if (t.includes("analogy") || s.includes("analogy")) return { engine: "analogy", allowedTypes: null };
  if (t.includes("classification") || t.includes("odd one") || s.includes("classification")) return { engine: "classification", allowedTypes: null };

  // ==========================================================================
  // ENGLISH LANGUAGE ROUTES (Uncomment as each generator is built)
  // ==========================================================================
  // if (t.includes("reading comprehension")) return { engine: "reading_comprehension", allowedTypes: null };
  if (t.includes("cloze") || s.includes("cloze")) return { engine: "cloze_test", allowedTypes: null };
  if (t.includes("error detection") || s.includes("error detection")) return { engine: "error_detection", allowedTypes: null };
  if (t.includes("sentence correction") || s.includes("sentence correction")) return { engine: "sentence_correction", allowedTypes: null };
  if (t.includes("fill in the blank") || t.includes("filler") || s.includes("fill in the blank")) return { engine: "fill_in_the_blanks", allowedTypes: null };
  if (t.includes("para jumble") || t.includes("parajumble") || s.includes("para jumble")) return { engine: "para_jumbles", allowedTypes: null };
  if (t.includes("sentence rearrangement") || t.includes("word swap") || s.includes("sentence rearrangement")) return { engine: "sentence_rearrangement", allowedTypes: null };
  if (t.includes("phrase replacement") || s.includes("phrase replacement")) return { engine: "phrase_replacement", allowedTypes: null };
  if (t.includes("vocabulary") || t.includes("spelling") || s.includes("vocabulary")) return { engine: "vocabulary", allowedTypes: null };
  if (t.includes("synonym") || t.includes("antonym") || s.includes("synonym") || s.includes("antonym")) return { engine: "synonyms_antonyms", allowedTypes: null };
  if (t.includes("idiom") || (t.includes("phrase") && !t.includes("replacement")) || s.includes("idiom")) return { engine: "idioms_phrases", allowedTypes: null };
  if (t.includes("word usage") || s.includes("word usage")) return { engine: "word_usage", allowedTypes: null };
  if (t.includes("grammar") || s.includes("grammar")) return { engine: "grammar", allowedTypes: null };

  // ==========================================================================
  // BANKING AWARENESS / GENERAL AWARENESS / COMPUTER ROUTES (Uncomment when built)
  // ==========================================================================
  // if (
  //   t.includes("banking") || t.includes("rbi") || t.includes("sebi") || t.includes("nabard") ||
  //   t.includes("sidbi") || t.includes("exim") || t.includes("nhb") || t.includes("irdai") ||
  //   t.includes("pfrda") || t.includes("monetary policy") || t.includes("repo") ||
  //   t === "crr" || t === "slr" || t === "msf" || t === "npa" || t === "upi" ||
  //   t === "neft" || t === "rtgs" || t === "imps" || t === "npci" || t === "kyc" || t === "aml" ||
  //   t.includes("basel") || t.includes("cheque") || t.includes("negotiable") ||
  //   t.includes("priority sector") || t.includes("financial inclusion") || t.includes("digital payment")
  // ) {
  //   return { engine: "banking_awareness", allowedTypes: null };
  // }
  // if (
  //   t.includes("current affairs") || t.includes("government scheme") || t.includes("union budget") ||
  //   t.includes("economic survey") || t.includes("news") || t.includes("award") ||
  //   t.includes("sport") || t.includes("appointment") || t.includes("book") ||
  //   t.includes("important day") || t.includes("capital") || t.includes("static gk")
  // ) {
  //   return { engine: "general_awareness", allowedTypes: null };
  // }
  // if (
  //   t.includes("computer") || t.includes("hardware") || t.includes("operating system") ||
  //   t.includes("ms office") || t.includes("internet") || t.includes("cyber") ||
  //   t.includes("dbms") || t.includes("programming") || t.includes("cloud") || t.includes("artificial intelligence")
  // ) {
  //   return { engine: "computer_awareness", allowedTypes: null };
  // }

  // ==========================================================================
  // QUANTITATIVE APTITUDE ROUTES (ACTIVE)
  // ==========================================================================
  // 1. Quadratic Equations
  if (t.includes("quadratic") || s.includes("quadratic")) {
    return { engine: "quadratic", allowedTypes: [1] };
  }

  // 2. Linear Simultaneous Equations (Prelims 1-15 & Mains 1-15)
  if (t.includes("linear") || s.includes("linear")) {
    const level = resolveExamLevel(s);
    return {
      engine: `linear_${level.toLowerCase()}`,
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    };
  }

  // 3. Percentage (Prelims 1-15 & Mains 1-10)
  if (t.includes("percentage") && !t.includes("simplification") && !t.includes("approximation")) {
    return { engine: `percentage_${resolveExamLevel(s).toLowerCase()}`, allowedTypes: null };
  }

  // 4. Number Series (Missing & Wrong Number)
  if (t.includes("number series") || s.includes("number series")) {
    if (s.includes("missing")) return { engine: "number_series_missing", allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8] };
    if (s.includes("wrong")) return { engine: "number_series_wrong", allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8] };
    return { engine: "number_series_mixed", allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8] };
  }

  // 5. Ratio & Proportion
  if (t.includes("ratio") || t.includes("proportion")) {
    return { engine: `ratio_${resolveExamLevel(s).toLowerCase()}`, allowedTypes: null };
  }

  // 6. Profit & Loss
  if (t.includes("profit") || t.includes("loss")) {
    return { engine: `profit_loss_${resolveExamLevel(s).toLowerCase()}`, allowedTypes: null };
  }

  // 7. Simple & Compound Interest
  if (t.includes("simple interest") || t.includes("compound interest") || t.includes("interest")) {
    const mode =
      t.includes("simple") && !t.includes("compound")
        ? "SI"
        : t.includes("compound") && !t.includes("simple")
        ? "CI"
        : "BOTH";
    return {
      engine: `interest_${mode.toLowerCase()}_${resolveExamLevel(s).toLowerCase()}`,
      allowedTypes: null,
    };
  }

  // 8. Time & Work
  if (t.includes("time & work") || t.includes("time and work")) {
    return { engine: `time_work_${resolveExamLevel(s).toLowerCase()}`, allowedTypes: null };
  }

  // 9. Number System
  if (t.includes("number system")) {
    const level = s.includes("level 1")
      ? "L1"
      : s.includes("level 2")
      ? "L2"
      : s.includes("level 3")
      ? "L3"
      : "AUTO";
    return { engine: `number_system_${level.toLowerCase()}`, allowedTypes: null };
  }

  // 10. Average
  if (t.includes("average")) {
    const level = s.includes("level 1")
      ? "L1"
      : s.includes("level 2")
      ? "L2"
      : s.includes("level 3")
      ? "L3"
      : resolveExamLevel(s);
    return { engine: `average_${level.toLowerCase()}`, allowedTypes: null };
  }

  // 11. Pipes & Cisterns
  if (t.includes("pipe") || t.includes("cistern")) {
    return { engine: `pipes_${resolveExamLevel(s).toLowerCase()}`, allowedTypes: null };
  }

  // 12. Boats & Streams / Time, Speed & Distance
  if (t.includes("boat") || t.includes("stream") || s.includes("boat")) {
    return { engine: "boats_streams", allowedTypes: ["E"] };
  }
  if (
    t.includes("time, speed") ||
    t.includes("time speed") ||
    t.includes("speed & distance") ||
    t.includes("speed and distance") ||
    t.includes("trains")
  ) {
    return { engine: "time_speed_distance", allowedTypes: ["A", "B", "C", "D", "E", "F", "G", "H", "I"] };
  }

  // 13. Mixture & Alligation
  if (t.includes("mixture") || t.includes("alligation")) {
    return { engine: "mixture_alligation", allowedTypes: null };
  }

  // 14. Partnership
  if (t.includes("partnership")) {
    return { engine: "partnership", allowedTypes: null };
  }

  // 15. Problems on Ages
  if (t.includes("age")) {
    return { engine: "problems_on_ages", allowedTypes: null };
  }

  // 16. Probability
  if (t.includes("probab")) {
    return { engine: "probability", allowedTypes: null };
  }

  // 18. Data Interpretation & Data Sufficiency DI
  if (
    t.includes("data interpretation") ||
    t === "di" ||
    s.includes("table di") ||
    s.includes("bar graph") ||
    s.includes("pie chart") ||
    s.includes("line graph") ||
    s.includes("caselet") ||
    s.includes("missing di") ||
    s.includes("mixed di")
  ) {
    let diMode = "auto";
    if (s.includes("table") || s.includes("tabular")) diMode = "tabular";
    else if (s.includes("bar")) diMode = "bar_graph";
    else if (s.includes("pie")) diMode = "pie_chart";
    else if (s.includes("line")) diMode = "line_graph";
    else if (s.includes("caselet")) diMode = "caselet";
    else if (s.includes("missing")) diMode = "missing";
    else if (s.includes("mixed")) diMode = "mixed";
    else if (s.includes("sufficien")) diMode = "data_sufficiency";
    return { engine: `data_interpretation_${diMode}`, allowedTypes: null };
  }
  if (t.includes("data sufficiency")) {
    return { engine: "data_interpretation_data_sufficiency", allowedTypes: null };
  }

  // 17. Permutation & Combination
  if (
    t.includes("permutation") ||
    t.includes("combination") ||
    t.includes("p&c") ||
    t.includes("p & c")
  ) {
    return { engine: "permutation_combination", allowedTypes: null };
  }

  // Specific Simplification Type match (Type 1..9)
  const simpTypeMatch = s.match(/simplification\s*type\s*(\d+)/i);
  if (simpTypeMatch) {
    const num = Number(simpTypeMatch[1]);
    if (num >= 1 && num <= 9) {
      return { engine: "simplification", allowedTypes: [num] };
    }
  }

  // Specific Approximation Type match (Type 1..12)
  const approxTypeMatch = s.match(/approximation\s*type\s*(\d+)/i);
  if (approxTypeMatch) {
    const num = Number(approxTypeMatch[1]);
    if (num >= 1 && num <= 12) {
      return { engine: "approximation", allowedTypes: [num] };
    }
  }

  // Keyword-based Simplification & Approximation subtopic routing
  for (const [keyword, engine, allowedTypes] of SUBTOPIC_KEYWORD_FILTERS) {
    if (s.includes(keyword)) {
      return { engine, allowedTypes };
    }
  }

  // Pure Simplification vs Pure Approximation vs Combined
  if (s.startsWith("simplification") || (t === "simplification" && !s.includes("approx"))) {
    return { engine: "simplification", allowedTypes: null };
  }
  if (s.startsWith("approximation") || (t === "approximation" && !s.includes("simplification"))) {
    return { engine: "approximation", allowedTypes: null };
  }

  // Default for "Simplification & Approximation": balanced mix of both engines
  return { engine: "mixed_simp_approx", allowedTypes: null };
}

/**
 * Generates, validates, and formats a batch of questions from the modular Question Engine.
 */
export function generateFromQuestionEngine({
  examCode = "IBPS_PO",
  stageName = "Prelims",
  topicName = "Simplification & Approximation",
  subtopicName = "",
  difficulty = "medium",
  count = 15,
  optionCount = 5,
} = {}) {
  const blueprintKey = resolveExamBlueprintKey(examCode, stageName);
  const engineDiff =
    !difficulty || difficulty.toUpperCase() === "AUTO"
      ? "AUTO"
      : difficulty.toUpperCase();

  const { engine, allowedTypes } = resolveSubtopicEngineFilter(topicName, subtopicName);
  const blueprint = EXAM_BLUEPRINTS[blueprintKey] || EXAM_BLUEPRINTS.IBPS_CLERK_PRELIMS;

  // Per-batch mathematical fingerprint sets to guarantee zero duplicates
  const seenFingerprintsByEngine = new Map();
  const getSeenSet = (key) => {
    if (!seenFingerprintsByEngine.has(key)) {
      seenFingerprintsByEngine.set(key, new Set());
    }
    return seenFingerprintsByEngine.get(key);
  };

  const generateFingerprintedOne = (batchFn, seenKey, seedStride, idx, extraOpts = {}) => {
    const seenSet = getSeenSet(seenKey);
    const { questions } = batchFn({
      exam: blueprintKey,
      difficulty: engineDiff === "AUTO" ? "MEDIUM" : engineDiff,
      count: 1,
      seed: Date.now() + idx * seedStride + Math.floor(Math.random() * 10000),
      excludeFingerprints: Array.from(seenSet),
      ...extraOpts,
    });
    const q = questions[0];
    if (!q) return null;
    if (q.fingerprint) seenSet.add(q.fingerprint);
    return {
      ...q,
      questionId: q.questionId || `${seenKey.toUpperCase()}_${Date.now()}_${idx}`,
      exam: q.exam || blueprintKey,
      solutionSteps: Array.isArray(q.solutionSteps) && q.solutionSteps.length > 0 ? q.solutionSteps : [q.explanation || "Verified by HHK Question Engine."],
      subType: q.templateId || q.sub_type,
      options: q.optionsArray,
      optionsMap: q.options,
      generationMode: "RULE_ENGINE",
    };
  };

  const generateRawOne = (preferEngine, idx = 0) => {
    for (const [prefix, batchFn] of LEVEL_BATCH_GENERATORS) {
      if (preferEngine.startsWith(prefix)) {
        const level = preferEngine.replace(prefix, "").toUpperCase();
        return batchFn({
          exam: blueprintKey,
          level,
          allowedTypes,
          difficulty: engineDiff,
          count: 1,
        })[0];
      }
    }

    if (preferEngine === "number_series_missing" || preferEngine === "number_series_wrong" || preferEngine === "number_series_mixed") {
      const mode =
        preferEngine === "number_series_missing"
          ? "MISSING"
          : preferEngine === "number_series_wrong"
          ? "WRONG"
          : idx % 2 === 0
          ? "MISSING"
          : "WRONG";
      return generateNumberSeriesBatch({
        exam: blueprintKey,
        allowedTypes: allowedTypes || [1, 2, 3, 4, 5, 6, 7, 8],
        difficulty: engineDiff,
        mode,
        count: 1,
      })[0];
    }

    if (preferEngine === "quadratic") {
      return generateQuadraticBatch({
        exam: blueprintKey,
        difficulty: engineDiff === "AUTO" ? "MEDIUM" : engineDiff,
        count: 1,
      })[0];
    }

    if (preferEngine.startsWith("interest_")) {
      const [, mode, level] = preferEngine.split("_");
      return generateInterestBatch({
        exam: blueprintKey,
        interestMode: mode.toUpperCase(),
        level: level.toUpperCase(),
        allowedTypes,
        difficulty: engineDiff,
        count: 1,
      })[0];
    }

    if (preferEngine.startsWith("pipes_")) {
      const level = preferEngine.replace("pipes_", "").toUpperCase();
      return generatePipesCisternsBatch({
        exam: blueprintKey,
        level,
        difficulty: engineDiff,
        count: 1,
        seed: Date.now() + idx * 97,
      })[0];
    }

    if (preferEngine === "boats_streams" || preferEngine === "time_speed_distance") {
      return generateFingerprintedOne(generateTsdBatch, "tsd", 131, idx, {
        topicMode: preferEngine === "boats_streams" ? "BOATS" : "BOTH",
      });
    }

    const fingerprinted = FINGERPRINTED_GENERATORS[preferEngine];
    if (fingerprinted) {
      return generateFingerprintedOne(
        fingerprinted.batchFn,
        preferEngine,
        fingerprinted.seedStride,
        idx,
        (preferEngine === "syllogism" || preferEngine === "inequality" || preferEngine === "coding_decoding" || preferEngine === "direction_distance" || preferEngine === "order_ranking" || preferEngine === "alphanumeric_series" || preferEngine === "letter_series" || preferEngine === "input_output" || preferEngine === "logical_reasoning" || preferEngine === "statement_conclusion" || preferEngine === "statement_assumption" || preferEngine === "cause_effect" || preferEngine === "analogy" || preferEngine === "classification" || preferEngine === "error_detection" || preferEngine === "cloze_test" || preferEngine === "fill_in_the_blanks" || preferEngine === "para_jumbles" || preferEngine === "phrase_replacement" || preferEngine === "sentence_correction" || preferEngine === "sentence_rearrangement" || preferEngine === "synonyms_antonyms" || preferEngine === "idioms_phrases" || preferEngine === "vocabulary" || preferEngine === "word_usage" || preferEngine === "grammar") ? { subtopicName } : {}
      );
    }

    if (preferEngine === "approximation") {
      const types =
        allowedTypes ||
        blueprint.approximation?.allowedTypes || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      return generateApproximationBatch({
        exam: blueprintKey,
        allowedTypes: types,
        difficulty: engineDiff,
        count: 1,
      })[0];
    }

    const types =
      allowedTypes ||
      blueprint.simplification?.allowedTypes || [1, 2, 3, 4, 5, 6, 7, 8, 9];
    return generateSimplificationBatch({
      exam: blueprintKey,
      allowedTypes: types,
      difficulty: engineDiff,
      count: 1,
    })[0];
  };

  if (engine === "seating_arrangement") {
    const seatingRaw = generateSeatingQuestionsForHHK({
      exam: blueprintKey,
      stage: stageName,
      arrangementType: subtopicName || "AUTO",
      difficulty: engineDiff === "AUTO" ? "MIXED" : engineDiff,
      count,
      seed: Date.now() ^ Math.floor(Math.random() * 1e9),
    });
    return seatingRaw.map((rawQ) =>
      formatEngineQuestionForHHK(rawQ, {
        topicName: topicName || "Seating Arrangement",
        subtopicName: subtopicName || rawQ.subtopicName || rawQ.subType,
        optionCount,
      })
    );
  }

  if (engine === "puzzles") {
    const puzzlesRaw = generatePuzzlesForHHK({
      exam: blueprintKey,
      stage: stageName,
      puzzleType: subtopicName || "AUTO",
      difficulty: engineDiff === "AUTO" ? "Medium" : engineDiff,
      count,
      seed: Date.now() ^ Math.floor(Math.random() * 1e9),
    });
    return puzzlesRaw.map((rawQ) =>
      formatEngineQuestionForHHK(rawQ, {
        topicName: topicName || "Puzzles",
        subtopicName: subtopicName || rawQ.subtopicName || rawQ.subType,
        optionCount,
      })
    );
  }

  if (engine === "floor_arrangement") {
    const floorRaw = generateFloorQuestionsForHHK({
      exam: blueprintKey,
      stage: stageName,
      puzzleType: subtopicName || "AUTO",
      difficulty: engineDiff === "AUTO" ? "MIXED" : engineDiff,
      count,
      seed: Date.now() ^ Math.floor(Math.random() * 1e9),
    });
    return floorRaw.map((rawQ) =>
      formatEngineQuestionForHHK(rawQ, {
        topicName: topicName || "Floor Arrangement",
        subtopicName: subtopicName || rawQ.subtopicName || rawQ.subType,
        optionCount,
      })
    );
  }
  

  // Data Interpretation generates coherent multi-question sets from one canonical dataset
  if (engine.startsWith("data_interpretation_")) {
    const diType = engine.replace("data_interpretation_", "");
    const diRawQuestions = generateDIQuestionsForHHK({
      exam: blueprintKey,
      diType,
      difficulty: engineDiff === "AUTO" ? "MEDIUM" : engineDiff,
      count,
      seed: Date.now() ^ Math.floor(Math.random() * 1e9),
    });
    return diRawQuestions.map((rawQ) =>
      formatEngineQuestionForHHK(rawQ, {
        topicName: topicName || "Data Interpretation",
        subtopicName: subtopicName || rawQ.subType,
        optionCount,
      })
    );
  }

  const results = [];
  for (let i = 0; i < count; i++) {
    const activeEngine =
      engine === "mixed_simp_approx"
        ? i % 2 === 0
          ? "simplification"
          : "approximation"
        : engine;

    let rawQ = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateRawOne(activeEngine, i);
      const check = validateEngineQuestion(candidate);
      if (check.valid) {
        rawQ = candidate;
        break;
      }
    }
    if (!rawQ) {
      rawQ = generateRawOne(activeEngine, i);
    }

    results.push(
      formatEngineQuestionForHHK(rawQ, {
        topicName,
        subtopicName,
        optionCount,
      })
    );
  }

  return results;
}