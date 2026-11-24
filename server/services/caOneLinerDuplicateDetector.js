import crypto from "node:crypto";
import { jaccardSimilarity, normalizeQuestionText } from "./caDuplicateDetector.js";

export function computeOneLinerHash(factText = "") {
  return crypto.createHash("sha256").update(normalizeQuestionText(factText)).digest("hex");
}

export function detectDuplicateOneLiner(candidateFactText, existingOneLiners = []) {
  const norm = normalizeQuestionText(candidateFactText);
  const contentHash = computeOneLinerHash(candidateFactText);
  let best = { status: "unique", similarity: 0, matchedId: null, contentHash };

  for (const ex of existingOneLiners) {
    const exText = ex.fact_text || ex.factText || "";
    const exHash = ex.content_hash || ex.contentHash || "";
    if ((exHash && exHash === contentHash) || (exText && normalizeQuestionText(exText) === norm)) {
      return { status: "exact_duplicate", similarity: 1, matchedId: ex.id || null, contentHash };
    }
    const sim = jaccardSimilarity(norm, exText);
    if (sim >= 0.78 && sim > best.similarity) {
      best = { status: "near_duplicate", similarity: Number(sim.toFixed(3)), matchedId: ex.id || null, contentHash };
    }
  }
  return best;
}
