/**
 * Cognitive-complexity difficulty classifier for Current Affairs & Banking MCQs.
 * Assigns easy | moderate | difficult with a concise internal reason.
 */

export function classifyQuestionDifficulty({ questionText = "", questionType = "direct_factual", requestedDifficulty = null }) {
  const text = String(questionText || "");
  const lower = text.toLowerCase();

  // Multi-statement, chronology, assertion-reason, or complex reasoning cues
  const statementMatches = (text.match(/\b(statement\s*[1-4]|i\.|ii\.|iii\.|assertion\s*\(a\)|reason\s*\(r\))/gi) || []).length;

  if (
    questionType === "chronology" ||
    questionType === "assertion_reason" ||
    (questionType === "statement_based" && statementMatches >= 3) ||
    /\b(chronological|consider the following statements|assertion.*reason|both a and r)\b/i.test(lower)
  ) {
    return {
      difficulty: "difficult",
      reason: "Multi-statement, chronological, or causal reasoning required.",
    };
  }

  if (
    questionType === "statement_based" ||
    questionType === "match_following" ||
    questionType === "correct_incorrect" ||
    /\b(match the following|which of the following.*incorrect|not correct|except)\b/i.test(lower)
  ) {
    return {
      difficulty: "moderate",
      reason: "Requires comparing multiple facts, pairs, or identifying an exception.",
    };
  }

  if (
    questionType === "fill_blank" ||
    questionType === "institution_abbreviation" ||
    /\b(stands for|full form|headquarter|established in)\b/i.test(lower)
  ) {
    return {
      difficulty: "easy",
      reason: "Direct factual recall of terminology, institution, or single datum.",
    };
  }

  if (["easy", "moderate", "difficult"].includes(requestedDifficulty)) {
    return {
      difficulty: requestedDifficulty,
      reason: `Aligned with requested ${requestedDifficulty} profile.`,
    };
  }

  return {
    difficulty: questionType === "numerical_data" ? "moderate" : "easy",
    reason:
      questionType === "numerical_data"
        ? "Requires precise numerical/rate recall with context."
        : "Direct single-fact recall.",
  };
}
