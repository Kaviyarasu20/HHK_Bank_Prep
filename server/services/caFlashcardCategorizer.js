import { normalizeExamCodesList } from "./caExamMapper.js";

export const FLASHCARD_TYPES = [
  "direct_fact",
  "banking_terminology",
  "rbi_monetary_policy",
  "institution",
  "government_scheme",
  "report_index",
  "static_gk",
  "current_affairs",
];

export const DECK_TYPES = ["daily", "weekly", "monthly", "topic", "exam", "must_study"];

export function categorizeFlashcard(raw = {}) {
  const cardType = FLASHCARD_TYPES.includes(raw.cardType) ? raw.cardType : "direct_fact";
  const difficulty = ["easy", "moderate", "difficult"].includes(raw.difficulty)
    ? raw.difficulty
    : "moderate";
  const studyPriority = ["must_study", "important", "additional"].includes(raw.studyPriority)
    ? raw.studyPriority
    : "important";

  return {
    cardType,
    difficulty,
    studyPriority,
    category: String(raw.category || "Banking Awareness").trim().slice(0, 100),
    topic: String(raw.topic || raw.category || "Banking Awareness").trim().slice(0, 120),
    subtopic: String(raw.subtopic || "").trim().slice(0, 120),
    examTags: normalizeExamCodesList(raw.examTags || []),
  };
}
