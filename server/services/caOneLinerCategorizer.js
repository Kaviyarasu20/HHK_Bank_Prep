import { normalizeExamCodesList } from "./caExamMapper.js";
import { recommendStudyPriority } from "./caBankingRelevance.js";

export const ONE_LINER_CATEGORIES = [
  "RBI and Monetary Policy",
  "Banking and Financial Institutions",
  "Banking Appointments",
  "Government Schemes",
  "Economy and Finance",
  "Digital Payments",
  "National Affairs",
  "International Affairs",
  "Reports and Indices",
  "Important Days",
  "Awards and Honours",
  "Sports",
  "Science and Technology",
  "Defence",
  "Insurance and Pension",
  "Agriculture and Rural Development",
  "Financial Inclusion",
  "Banking Static GK",
];

export function categorizeOneLiner(raw = {}) {
  const text = `${raw.factText || ""} ${raw.context || ""} ${raw.categoryName || ""}`.toLowerCase();
  const explicit = ONE_LINER_CATEGORIES.find(
    (c) => c.toLowerCase() === String(raw.categoryName || "").trim().toLowerCase(),
  );
  let categoryName = explicit || "National Affairs";
  if (!explicit) {
    if (/\b(rbi|repo rate|crr|slr|sdf|msf|mpc|monetary policy)\b/.test(text)) categoryName = "RBI and Monetary Policy";
    else if (/\b(upi|npci|neft|rtgs|imps|nach|digital payment)\b/.test(text)) categoryName = "Digital Payments";
    else if (/\b(appointed|md & ceo|chairman|governor|resign)\b/.test(text)) categoryName = "Banking Appointments";
    else if (/\b(yojana|scheme|mission|abhiyan|ministry)\b/.test(text)) categoryName = "Government Schemes";
    else if (/\b(nabard|rural|agricultur|kisan|crop)\b/.test(text)) categoryName = "Agriculture and Rural Development";
    else if (/\b(irdai|pfrda|insurance|pension|nps|apy)\b/.test(text)) categoryName = "Insurance and Pension";
    else if (/\b(jan dhan|pmjdy|financial inclusion|mudra)\b/.test(text)) categoryName = "Financial Inclusion";
    else if (/\b(index|ranking|report|survey|outlook)\b/.test(text)) categoryName = "Reports and Indices";
    else if (/\b(gdp|inflation|cpi|wpi|fiscal|gst|economy)\b/.test(text)) categoryName = "Economy and Finance";
    else if (/\b(bank|sebi|sidbi|exim|nhb|dicgc)\b/.test(text)) categoryName = "Banking and Financial Institutions";
    else if (/\b(award|honour|prize|padma)\b/.test(text)) categoryName = "Awards and Honours";
    else if (/\b(day|theme)\b/.test(text)) categoryName = "Important Days";
    else if (/\b(sport|cricket|chess|olympic|medal)\b/.test(text)) categoryName = "Sports";
  }

  const score = Number.isFinite(Number(raw.bankingRelevanceScore))
    ? Math.max(0, Math.min(100, Math.round(Number(raw.bankingRelevanceScore))))
    : 65;

  return {
    categoryName,
    topic: String(raw.topic || categoryName).trim().slice(0, 120),
    subtopic: String(raw.subtopic || "").trim().slice(0, 120),
    studyPriority: recommendStudyPriority(score, raw.studyPriority),
    bankingRelevanceScore: score,
    examTags: normalizeExamCodesList(raw.examTags || []),
  };
}
