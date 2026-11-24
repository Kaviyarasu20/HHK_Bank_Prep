import { executeAiCompletion } from "./caAiProvider.js";
import { getExamProfile, normalizeExamCodesList } from "./caExamMapper.js";
import { buildMcqGenerationPrompt, SUPPORTED_QUESTION_TYPES } from "./caQuestionTemplates.js";
import { classifyQuestionDifficulty } from "./caQuestionDifficulty.js";
import { detectDuplicateQuestion } from "./caDuplicateDetector.js";
import { validateGeneratedQuestion } from "./caQuestionValidator.js";
import { scoreQuestionQuality } from "./caQuestionQuality.js";

const MAX_QUESTIONS_PER_SOURCE = 10;

function parseMcqJson(rawText) {
  const cleaned = String(rawText || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!cleaned) throw new Error("AI provider returned an empty MCQ response.");
  const parsed = JSON.parse(cleaned);
  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error("AI response must contain a 'questions' array.");
  }
  return parsed.questions;
}

/**
 * Generates, validates, deduplicates, and quality-scores exam-wise MCQs from
 * approved Phase 5 AI-structured articles OR approved Phase 4 Banking Reference records.
 * Always produces draft questions for admin review — NEVER auto-publishes.
 */
export async function generateExamMcqs({
  sourceTitle,
  sourceText,
  sourceReferenceLabel = "",
  sourceFreshness = null,
  examCode = "IBPS PO",
  examCodes = [],
  topic = "Banking Awareness",
  subtopic = "",
  questionType = "direct_factual",
  difficulty = "moderate",
  count = 3,
  existingQuestions = [],
  env = process.env,
  fetchFn = fetch,
  providerFn = null,
}) {
  const safeCount = Math.max(1, Math.min(MAX_QUESTIONS_PER_SOURCE, Number(count) || 3));
  const profile = getExamProfile(examCode);
  const resolvedExams = normalizeExamCodesList(examCodes.length ? examCodes : [profile.examCode]);
  const safeType = SUPPORTED_QUESTION_TYPES.includes(questionType)
    ? questionType
    : "direct_factual";

  if (!sourceText || String(sourceText).trim().length < 30) {
    throw Object.assign(
      new Error("Source content is too short to generate grounded MCQs."),
      { status: 400 },
    );
  }

  const { promptVersion, systemPrompt, userPrompt } = buildMcqGenerationPrompt({
    sourceText,
    sourceTitle,
    sourceReferenceLabel,
    examProfile: profile,
    questionType: safeType,
    difficulty,
    count: safeCount,
    topic,
  });

  const completion = await executeAiCompletion({
    systemPrompt,
    userPrompt,
    env,
    fetchFn,
    providerFn,
  });

  const rawQuestions = parseMcqJson(completion.rawText).slice(0, safeCount);
  const seenPool = [...existingQuestions];
  const processed = [];

  for (const raw of rawQuestions) {
    const options = Array.isArray(raw.options)
      ? raw.options.map((o, idx) => ({
          key: String(o?.key || String.fromCharCode(65 + idx)).trim().toUpperCase(),
          text: String(o?.text || "").trim(),
        }))
      : [];

    const qType = SUPPORTED_QUESTION_TYPES.includes(raw.questionType)
      ? raw.questionType
      : safeType;

    const diffMeta = classifyQuestionDifficulty({
      questionText: raw.questionText,
      questionType: qType,
      requestedDifficulty: raw.difficulty || difficulty,
    });

    const candidate = {
      questionText: String(raw.questionText || "").trim(),
      questionType: qType,
      difficulty: diffMeta.difficulty,
      difficultyReason: diffMeta.reason,
      options,
      correctAnswer: String(raw.correctAnswer || "").trim().toUpperCase(),
      explanation: String(raw.explanation || "").trim(),
      sourceReference: String(raw.sourceReference || sourceReferenceLabel || "").trim().slice(0, 400),
      topic: String(raw.topic || topic || "Banking Awareness").trim().slice(0, 120),
      subtopic: String(subtopic || "").trim().slice(0, 120),
      examCodes: resolvedExams,
    };

    const validation = validateGeneratedQuestion({
      question: candidate,
      sourceText: `${sourceTitle}\n${sourceText}`,
      sourceFreshness,
      expectedOptionCount: profile.optionCount,
    });

    candidate.explanation = validation.explanation;

    const duplicate = detectDuplicateQuestion(candidate, seenPool);
    const quality = scoreQuestionQuality({
      question: candidate,
      validation,
      duplicateResult: duplicate,
    });

    seenPool.push({
      question_text: candidate.questionText,
      content_hash: duplicate.contentHash,
      options: candidate.options,
      correct_answer: candidate.correctAnswer,
      source_reference: candidate.sourceReference,
    });

    processed.push({
      ...candidate,
      contentHash: duplicate.contentHash,
      validation,
      duplicate,
      quality,
      reviewStatus: "draft",
    });
  }

  return {
    provider: completion.provider || "mock",
    model: completion.model || "",
    promptVersion,
    usage: completion.usage || {},
    examProfile: profile,
    questions: processed,
  };
}
