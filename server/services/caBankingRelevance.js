import { SUPPORTED_EXAMS } from "./caAiPromptBuilder.js";

export function classifyBankingRelevance(score) {
  const n = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  if (n >= 80) return "highly_relevant";
  if (n >= 60) return "relevant";
  if (n >= 40) return "moderately_relevant";
  return "low_relevance";
}

export function recommendStudyPriority(score, explicitPriority = null) {
  if (["must_study", "important", "additional"].includes(explicitPriority)) {
    return explicitPriority;
  }
  const n = Number(score) || 0;
  if (n >= 80) return "must_study";
  if (n >= 55) return "important";
  return "additional";
}

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(the\s+)?system\s+prompt/i,
  /reveal\s+(your\s+)?(api\s+key|secret|system\s+prompt|environment\s+variables)/i,
  /you\s+are\s+now\s+(in\s+)?developer\s+mode/i,
  /<\/?UNTRUSTED_ARTICLE_DATA>/i,
];

export function detectPromptInjectionSignals(text = "") {
  const hits = [];
  for (const re of PROMPT_INJECTION_PATTERNS) {
    if (re.test(text)) hits.push(re.source);
  }
  return hits;
}

export function normalizeExamTags(rawTags = []) {
  if (!Array.isArray(rawTags)) return [];
  const allowed = new Map(SUPPORTED_EXAMS.map((e) => [e.toLowerCase(), e]));
  const seen = new Set();
  const out = [];

  for (const entry of rawTags) {
    const codeRaw = typeof entry === "string" ? entry : entry?.examCode || entry?.exam_code || "";
    const canonical = allowed.get(String(codeRaw).trim().toLowerCase());
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    const conf =
      entry?.confidenceScore != null && !Number.isNaN(Number(entry.confidenceScore))
        ? Math.max(0, Math.min(1, Number(entry.confidenceScore)))
        : null;
    out.push({
      examCode: canonical,
      relevanceReason: String(entry?.relevanceReason || entry?.relevance_reason || "").trim().slice(0, 400),
      confidenceScore: conf,
    });
  }
  return out;
}

export function normalizeTopics(rawTopics = []) {
  if (!Array.isArray(rawTopics)) return [];
  const seen = new Set();
  const out = [];
  for (const t of rawTopics) {
    const name = String(typeof t === "string" ? t : t?.topicName || t?.topic_name || "").trim().slice(0, 120);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({
      topicName: name,
      topicCategory: String(t?.topicCategory || t?.topic_category || "").trim().slice(0, 100),
      relevanceScore:
        t?.relevanceScore != null && !Number.isNaN(Number(t.relevanceScore))
          ? Math.max(0, Math.min(100, Math.round(Number(t.relevanceScore))))
          : null,
    });
  }
  return out.slice(0, 12);
}

export function evaluateBankingRelevanceResult(parsedAi) {
  const rawScore = Number(parsedAi?.bankingRelevanceScore);
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;
  const level = classifyBankingRelevance(score);
  const priority = recommendStudyPriority(score, parsedAi?.studyPriority);
  const reason = String(parsedAi?.relevanceReason || "").trim().slice(0, 1200);
  const confidence =
    parsedAi?.confidenceScore != null && Number.isFinite(Number(parsedAi.confidenceScore))
      ? Math.max(0, Math.min(1, Number(parsedAi.confidenceScore)))
      : null;

  return {
    bankingRelevanceScore: score,
    bankingRelevanceLevel: level,
    relevanceReason: reason,
    studyPriority: priority,
    confidenceScore: confidence,
    topics: normalizeTopics(parsedAi?.topics),
    examTags: normalizeExamTags(parsedAi?.examTags),
  };
}
