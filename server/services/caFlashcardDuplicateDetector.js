import crypto from "node:crypto";
import { jaccardSimilarity, normalizeQuestionText } from "./caDuplicateDetector.js";

export function computeFlashcardHash(frontText = "", backText = "") {
  return crypto
    .createHash("sha256")
    .update(`${normalizeQuestionText(frontText)}|${normalizeQuestionText(backText)}`)
    .digest("hex");
}

export function detectDuplicateFlashcard(candidate, existingCards = []) {
  const normFront = normalizeQuestionText(candidate?.frontText || "");
  const normBack = normalizeQuestionText(candidate?.backText || "");
  const contentHash = computeFlashcardHash(candidate?.frontText || "", candidate?.backText || "");
  let best = { status: "unique", similarity: 0, matchedId: null, contentHash };

  for (const ex of existingCards) {
    const exFront = ex.front_text || ex.frontText || "";
    const exBack = ex.back_text || ex.backText || "";
    const exHash = ex.content_hash || ex.contentHash || "";
    if (
      (exHash && exHash === contentHash) ||
      (normalizeQuestionText(exFront) === normFront && normalizeQuestionText(exBack) === normBack)
    ) {
      return { status: "exact_duplicate", similarity: 1, matchedId: ex.id || null, contentHash };
    }
    const sim = jaccardSimilarity(normFront, exFront);
    if (sim >= 0.8 && sim > best.similarity) {
      best = { status: "near_duplicate", similarity: Number(sim.toFixed(3)), matchedId: ex.id || null, contentHash };
    }
  }
  return best;
}
