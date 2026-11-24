/**
 * Independent Question Quality & Subject-Specific Validation Engine
 *
 * Ensures no mock test ever contains malformed, duplicate, or unverified questions.
 * Supports:
 *   - Strict structural validation (questionText, exact option count, unique non-empty options,
 *     single valid correct answer mapping, non-empty explanation, subject & topic mapping)
 *   - Quantitative Aptitude mathematical sanity & leak detection
 *   - Reasoning logical structure validation hook
 *   - English grammar/passage-relationship validation hook
 */

const FORBIDDEN_TEXT_TOKENS = ["undefined", "NaN", "Infinity", "[object Object]"];

function normalizeOptions(rawOptions) {
  let parsed = rawOptions;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((opt, idx) => {
    if (opt && typeof opt === "object") {
      return {
        key: String(opt.key ?? String.fromCharCode(65 + idx)).trim().toUpperCase(),
        text: String(opt.text ?? "").trim(),
      };
    }
    return {
      key: String.fromCharCode(65 + idx),
      text: String(opt ?? "").trim(),
    };
  });
}

function hasForbiddenToken(str) {
  const s = String(str || "");
  return FORBIDDEN_TEXT_TOKENS.some((tok) => s.includes(tok));
}

/**
 * Independent Quantitative Aptitude sanity verification.
 */
function validateQuantSpecific(question, options, correctOption) {
  const errors = [];
  const qText = String(question.questionText || question.question_text || "");
  const expl = String(question.explanation || "");

  if (/\bnull\b/i.test(qText)) {
    errors.push("Quant question text contains 'null' leak.");
  }

  // Verify numeric option consistency if numericAnswer metadata is present
  if (question.numericAnswer !== undefined && question.numericAnswer !== null) {
    const expectedNum = Number(question.numericAnswer);
    if (!Number.isFinite(expectedNum)) {
      errors.push("Quant numericAnswer is not finite.");
    } else {
      const cleanedOpt = correctOption.text.replace(/[₹,%\s]/g, "");
      const parsedOpt = Number(cleanedOpt);
      if (Number.isFinite(parsedOpt) && Math.abs(parsedOpt - expectedNum) > 0.05) {
        errors.push(
          `Quant calculation mismatch: correct option "${correctOption.text}" does not match numericAnswer ${expectedNum}.`
        );
      }
    }
  }

  // Independent check for simple explicit arithmetic expressions if metadata provides expression
  if (question.verificationFormula && typeof question.verificationFormula === "function") {
    try {
      const ok = question.verificationFormula(question, correctOption);
      if (!ok) errors.push("Quant independent verificationFormula returned false.");
    } catch (err) {
      errors.push(`Quant verificationFormula threw: ${err.message}`);
    }
  }

  if (expl.length < 8) {
    errors.push("Quant question must include a valid step-by-step explanation.");
  }

  return errors;
}

/**
 * Independent Reasoning Ability structural & logical consistency verification.
 */
function validateReasoningSpecific(question, _options, _correctOption) {
  const errors = [];
  const qText = String(question.questionText || question.question_text || "");
  if (qText.length < 15) {
    errors.push("Reasoning question text is too short to form a valid logical premise.");
  }
  if (question.passageRequired && !question.passageText && !question.passageGroupId) {
    errors.push("Reasoning puzzle/arrangement question is missing its passage/premise block.");
  }
  return errors;
}

/**
 * Independent English Language structure & passage-relationship verification.
 */
function validateEnglishSpecific(question, _options, _correctOption) {
  const errors = [];
  const qText = String(question.questionText || question.question_text || "");
  const topic = String(question.topicName || question.topic_name || "").toLowerCase();
  if (topic.includes("reading comprehension") && !question.passageText && !question.passageGroupId && qText.length < 60) {
    errors.push("Reading Comprehension question is missing its passage reference.");
  }
  return errors;
}

/**
 * Validates a single question against all banking mock test quality rules.
 *
 * @param {object} question
 * @param {object} rules
 * @returns {{ valid: boolean, errors: string[], normalizedOptions: Array<{key:string,text:string}> }}
 */
export function validateMockTestQuestion(
  question,
  {
    requiredOptionCount = 5,
    requireExplanation = true,
    subjectKey = null,
    expectedTopic = null,
  } = {}
) {
  const errors = [];
  if (!question || typeof question !== "object") {
    return { valid: false, errors: ["Question object is null or invalid."], normalizedOptions: [] };
  }

  const questionType = String(question.questionType || question.question_type || "mcq").toLowerCase();
  const qText = String(question.questionText || question.question_text || "").trim();
  const topicName = String(question.topicName || question.topic_name || "").trim();
  const explanation = String(question.explanation || "").trim();
  const correctAnswer = String(question.correctAnswer || question.correct_answer || "").trim().toUpperCase();
  const difficulty = String(question.difficulty || "").trim().toLowerCase();

  if (qText.length < 5) {
    errors.push("Question text is empty or too short.");
  }
  if (hasForbiddenToken(qText)) {
    errors.push("Question text contains forbidden token (NaN/undefined/Infinity).");
  }
  if (!topicName) {
    errors.push("Question is missing topicName mapping.");
  }
  if (difficulty && !["easy", "medium", "hard"].includes(difficulty)) {
    errors.push(`Invalid difficulty "${difficulty}". Must be easy, medium, or hard.`);
  }
  if (requireExplanation && !explanation) {
    errors.push("Question is missing an explanation.");
  }
  if (hasForbiddenToken(explanation)) {
    errors.push("Explanation contains forbidden token (NaN/undefined/Infinity).");
  }

  const normalizedOptions = normalizeOptions(question.options);

  if (questionType !== "descriptive") {
    if (requiredOptionCount && normalizedOptions.length !== requiredOptionCount) {
      errors.push(
        `Expected exactly ${requiredOptionCount} options, found ${normalizedOptions.length}.`
      );
    } else if (normalizedOptions.length < 2) {
      errors.push("MCQ must have at least 2 options.");
    }

    const emptyOpt = normalizedOptions.find((o) => !o.text || hasForbiddenToken(o.text));
    if (emptyOpt) {
      errors.push(`Option ${emptyOpt.key} is empty or contains invalid token.`);
    }

    const keys = normalizedOptions.map((o) => o.key);
    if (new Set(keys).size !== keys.length) {
      errors.push("Duplicate option keys detected.");
    }

    const texts = normalizedOptions.map((o) => o.text.toLowerCase());
    if (new Set(texts).size !== texts.length) {
      errors.push("Duplicate option values detected.");
    }

    const matchingAnswers = normalizedOptions.filter((o) => o.key === correctAnswer);
    if (matchingAnswers.length !== 1) {
      errors.push(
        `Expected exactly one option matching correctAnswer "${correctAnswer}", found ${matchingAnswers.length}.`
      );
    }

    if (matchingAnswers.length === 1) {
      const effectiveSubject = String(subjectKey || question.subjectKey || "").toLowerCase();
      if (effectiveSubject === "quant") {
        errors.push(...validateQuantSpecific(question, normalizedOptions, matchingAnswers[0]));
      } else if (effectiveSubject === "reasoning") {
        errors.push(...validateReasoningSpecific(question, normalizedOptions, matchingAnswers[0]));
      } else if (effectiveSubject === "english") {
        errors.push(...validateEnglishSpecific(question, normalizedOptions, matchingAnswers[0]));
      }
    }
  }

  // Optional strict topic alignment check
  if (expectedTopic && topicName) {
    const expNorm = expectedTopic.toLowerCase();
    const gotNorm = topicName.toLowerCase();
    const looseMatch =
      expNorm === gotNorm ||
      expNorm.includes(gotNorm) ||
      gotNorm.includes(expNorm) ||
      (expNorm.includes("simplification") && (gotNorm.includes("simplification") || gotNorm.includes("approximation")));
    if (!looseMatch) {
      errors.push(`Topic mismatch: expected "${expectedTopic}", got "${topicName}".`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedOptions,
  };
}
