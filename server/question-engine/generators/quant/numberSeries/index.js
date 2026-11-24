// generators/quant/numberSeries/index.js
import { randInt, pickRandom } from "../../../core/mathUtils.js";
import { buildOptions } from "../../../core/distractorEngine.js";
import { NUMBER_SERIES_PROFILES } from "../../../config/difficultyProfiles.js";
import { EXAM_BLUEPRINTS } from "../../../config/examBlueprints.js";
import { SERIES_PATTERN_BUILDERS } from "./types/seriesPatterns.js";

function resolveDifficulty(exam, requestedDifficulty) {
  if (requestedDifficulty && requestedDifficulty !== "AUTO") {
    return requestedDifficulty;
  }
  const dist = EXAM_BLUEPRINTS[exam]?.numberSeries?.difficultyDistribution || {
    EASY: 0.25,
    MEDIUM: 0.55,
    HARD: 0.2,
  };
  const roll = Math.random();
  if (roll < dist.EASY) return "EASY";
  if (roll < dist.EASY + dist.MEDIUM) return "MEDIUM";
  return "HARD";
}

export function generateNumberSeriesQuestion(
  exam = "IBPS_PO_PRELIMS",
  difficulty = "MEDIUM",
  mode = "MISSING",
  typeId = null
) {
  const resolvedType =
    typeId && SERIES_PATTERN_BUILDERS[typeId]
      ? typeId
      : pickRandom([1, 2, 3, 4, 5, 6, 7, 8]);

  const { subType, terms, ruleSummary } =
    SERIES_PATTERN_BUILDERS[resolvedType](difficulty);
  const offsets = NUMBER_SERIES_PROFILES[difficulty].distractorOffsets;

  if (mode === "WRONG") {
    // Perturb index 2, 3, 4, or 5 so at least 2 initial terms anchor the pattern unambiguously
    const wrongIdx = randInt(2, 5);
    const trueVal = terms[wrongIdx];
    const deltaPool = [-6, -5, -4, -3, -2, 2, 3, 4, 5, 6];
    let wrongVal = trueVal + pickRandom(deltaPool);
    if (wrongVal <= 0 || wrongVal === trueVal) {
      wrongVal = trueVal + 4;
    }

    const displayTerms = [...terms];
    displayTerms[wrongIdx] = wrongVal;

    const { options, correctOptionIndex } = buildOptions(
      wrongVal,
      "INTEGER",
      offsets
    );

    return {
      questionId: `NS_WRONG_T${resolvedType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Number Series",
      subType: `WRONG_${subType}`,
      seriesMode: "WRONG",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `In the following number series, one number is wrong. Find out the wrong number.\n${displayTerms.join(", ")}`,
      options,
      correctOptionIndex,
      answer: String(wrongVal),
      solutionSteps: [
        ruleSummary,
        `Correct series: ${terms.join(", ")}`,
        `At position ${wrongIdx + 1}, ${wrongVal} is wrong and should be ${trueVal}`,
      ],
    };
  }

  // MISSING mode: hide the 6th term (or 5th term on HARD occasionally)
  const missingIdx = difficulty === "HARD" && Math.random() < 0.3 ? 4 : 5;
  const answer = terms[missingIdx];
  const displayTerms = terms.map((t, i) => (i === missingIdx ? "?" : t));
  const { options, correctOptionIndex } = buildOptions(
    answer,
    "INTEGER",
    offsets
  );

  return {
    questionId: `NS_MISS_T${resolvedType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Number Series",
    subType: `MISSING_${subType}`,
    seriesMode: "MISSING",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `What will come in place of the question mark (?) in the following number series?\n${displayTerms.join(", ")}`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      ruleSummary,
      `Complete series: ${terms.join(", ")}`,
      `Missing term (?) = ${answer}`,
    ],
  };
}

export function generateNumberSeriesBatch({
  exam = "IBPS_PO_PRELIMS",
  allowedTypes = [1, 2, 3, 4, 5, 6, 7, 8],
  difficulty = "AUTO",
  mode = "MIXED", // "MISSING" | "WRONG" | "MIXED"
  count = 10,
} = {}) {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const resolvedDiff = resolveDifficulty(exam, difficulty);
    const resolvedType = pickRandom(allowedTypes);
    const resolvedMode =
      mode === "MIXED" ? (i % 2 === 0 ? "MISSING" : "WRONG") : mode;
    questions.push(
      generateNumberSeriesQuestion(
        exam,
        resolvedDiff,
        resolvedMode,
        resolvedType
      )
    );
  }
  return questions;
}
