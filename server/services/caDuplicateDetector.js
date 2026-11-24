import crypto from "node:crypto";

const STOPWORDS = new Set([
  "the", "is", "are", "was", "were", "in", "on", "at", "of", "to", "for", "by", "with",
  "from", "as", "an", "a", "which", "what", "who", "when", "where", "following", "among",
  "recently", "india", "indian", "has", "have", "been", "that", "this", "and", "or",
]);

export function normalizeQuestionText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeQuestionHash(questionText = "", correctOptionText = "") {
  const normQ = normalizeQuestionText(questionText);
  const normA = normalizeQuestionText(correctOptionText);
  return crypto.createHash("sha256").update(`${normQ}|${normA}`).digest("hex");
}

function tokenizeContent(text = "") {
  const words = normalizeQuestionText(text).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

export function jaccardSimilarity(textA, textB) {
  const a = tokenizeContent(textA);
  const b = tokenizeContent(textB);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const tok of a) {
    if (b.has(tok)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Classifies a candidate question against existing questions without deleting anything.
 * Returns: exact_duplicate | near_duplicate | same_fact | unique
 */
export function detectDuplicateQuestion(candidate, existingQuestions = []) {
  const candNorm = normalizeQuestionText(candidate?.questionText || "");
  const candCorrectText = (candidate?.options || []).find(
    (o) => o.key === candidate?.correctAnswer,
  )?.text || "";
  const candHash = computeQuestionHash(candidate?.questionText || "", candCorrectText);
  const candFactRef = normalizeQuestionText(candidate?.sourceReference || "");

  let bestMatch = {
    status: "unique",
    similarity: 0,
    matchedId: null,
    contentHash: candHash,
  };

  for (const existing of existingQuestions) {
    const exNorm = normalizeQuestionText(existing.question_text || existing.questionText || "");
    const exHash = existing.content_hash || existing.contentHash || "";

    if ((exHash && exHash === candHash) || (exNorm && exNorm === candNorm)) {
      return {
        status: "exact_duplicate",
        similarity: 1,
        matchedId: existing.id || null,
        contentHash: candHash,
      };
    }

    const sim = jaccardSimilarity(candNorm, exNorm);
    if (sim >= 0.8 && sim > bestMatch.similarity) {
      bestMatch = {
        status: "near_duplicate",
        similarity: Number(sim.toFixed(3)),
        matchedId: existing.id || null,
        contentHash: candHash,
      };
      continue;
    }

    const exFactRef = normalizeQuestionText(existing.source_reference || existing.sourceReference || "");
    const exCorrectText = (existing.options || []).find(
      (o) => o.key === (existing.correct_answer || existing.correctAnswer),
    )?.text || "";
    const sameAnswer =
      candCorrectText &&
      exCorrectText &&
      normalizeQuestionText(candCorrectText) === normalizeQuestionText(exCorrectText);
    const factSim = candFactRef && exFactRef ? jaccardSimilarity(candFactRef, exFactRef) : 0;

    if ((sim >= 0.55 && sameAnswer) || (sameAnswer && factSim >= 0.7)) {
      if (bestMatch.status === "unique") {
        bestMatch = {
          status: "same_fact",
          similarity: Number(Math.max(sim, factSim).toFixed(3)),
          matchedId: existing.id || null,
          contentHash: candHash,
        };
      }
    }
  }

  return bestMatch;
}
