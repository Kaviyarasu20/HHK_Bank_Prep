import { isValueGroundedInSource } from "./caFactExtractor.js";
import { normalizeQuestionText } from "./caDuplicateDetector.js";

export function validateFlashcard({ card, sourceText = "", sourceFreshness = null }) {
  const errors = [];
  const warnings = [];

  const front = String(card?.frontText || "").trim();
  const back = String(card?.backText || "").trim();

  if (front.length < 8) errors.push("Flashcard front/prompt is missing or too short (min 8 chars).");
  if (front.length > 300) warnings.push("Flashcard front exceeds 300 characters; keep prompts concise for active recall.");
  if (back.length < 2) errors.push("Flashcard back/answer is missing.");
  if (back.length > 600) warnings.push("Flashcard back exceeds 600 characters; shorten for quick recall.");

  if (front && back && normalizeQuestionText(front) === normalizeQuestionText(back)) {
    errors.push("Flashcard back/answer simply repeats the front/question.");
  }

  // Reject multi-question prompts on a single card
  const qMarks = (front.match(/\?/g) || []).length;
  if (qMarks > 1) {
    warnings.push("Flashcard front appears to contain multiple questions; keep one main learning objective per card.");
  }

  if (sourceFreshness && (sourceFreshness.state === "outdated" || sourceFreshness.state === "historical")) {
    errors.push(`Source reference is "${sourceFreshness.label}"; outdated references cannot be published as current cards.`);
  }

  if (sourceText && back) {
    const nums = back.match(/\d+(?:[.,]\d+)*%?/g) || [];
    for (const num of nums) {
      if (!isValueGroundedInSource(num, sourceText)) {
        errors.push(`Figure "${num}" on flashcard back was not found in the source material.`);
      }
    }
  }

  const status = errors.length > 0 ? "failed" : warnings.length > 0 ? "warnings" : "passed";
  return { status, errors, warnings };
}
