/**
 * Configurable Examination-Wise MCQ Generation Profiles & Canonical Mapping.
 * Profiles represent editorial generation focus (not official exam blueprints).
 */

export const EXAM_PROFILES = {
  "IBPS PO": {
    examCode: "IBPS PO",
    group: "IBPS",
    optionCount: 5,
    difficultyDistribution: { easy: 0.25, moderate: 0.5, difficult: 0.25 },
    preferredTypes: ["direct_factual", "statement_based", "numerical_data", "correct_incorrect"],
    focus: "Banking, financial awareness, economy, important national and international affairs",
    freshnessDays: 180,
  },
  "IBPS Clerk": {
    examCode: "IBPS Clerk",
    group: "IBPS",
    optionCount: 5,
    difficultyDistribution: { easy: 0.55, moderate: 0.35, difficult: 0.1 },
    preferredTypes: ["direct_factual", "fill_blank", "institution_abbreviation", "numerical_data"],
    focus: "Direct factual banking and general awareness questions",
    freshnessDays: 180,
  },
  "IBPS RRB PO": {
    examCode: "IBPS RRB PO",
    group: "IBPS",
    optionCount: 5,
    difficultyDistribution: { easy: 0.3, moderate: 0.5, difficult: 0.2 },
    preferredTypes: ["direct_factual", "statement_based", "match_following", "numerical_data"],
    focus: "Rural banking, agriculture, financial inclusion, banking and economy",
    freshnessDays: 180,
  },
  "IBPS RRB Office Assistant": {
    examCode: "IBPS RRB Office Assistant",
    group: "IBPS",
    optionCount: 5,
    difficultyDistribution: { easy: 0.6, moderate: 0.3, difficult: 0.1 },
    preferredTypes: ["direct_factual", "fill_blank", "institution_abbreviation"],
    focus: "Direct factual banking, rural development and government schemes",
    freshnessDays: 180,
  },
  "SBI PO": {
    examCode: "SBI PO",
    group: "SBI",
    optionCount: 5,
    difficultyDistribution: { easy: 0.2, moderate: 0.45, difficult: 0.35 },
    preferredTypes: ["statement_based", "numerical_data", "correct_incorrect", "assertion_reason", "chronology"],
    focus: "Banking, financial awareness, economy and important current developments",
    freshnessDays: 180,
  },
  "SBI Clerk": {
    examCode: "SBI Clerk",
    group: "SBI",
    optionCount: 5,
    difficultyDistribution: { easy: 0.5, moderate: 0.4, difficult: 0.1 },
    preferredTypes: ["direct_factual", "fill_blank", "numerical_data", "institution_abbreviation"],
    focus: "Direct factual banking and general awareness",
    freshnessDays: 180,
  },
  "RBI Grade B": {
    examCode: "RBI Grade B",
    group: "Regulatory",
    optionCount: 5,
    difficultyDistribution: { easy: 0.1, moderate: 0.4, difficult: 0.5 },
    preferredTypes: ["statement_based", "assertion_reason", "numerical_data", "chronology", "match_following"],
    focus: "Monetary policy, financial regulation, economy and institutional knowledge",
    freshnessDays: 120,
  },
  "NABARD Grade A": {
    examCode: "NABARD Grade A",
    group: "Regulatory",
    optionCount: 5,
    difficultyDistribution: { easy: 0.2, moderate: 0.45, difficult: 0.35 },
    preferredTypes: ["statement_based", "match_following", "numerical_data", "direct_factual"],
    focus: "Agriculture, rural development, rural finance and related institutions",
    freshnessDays: 180,
  },
};

export const SUPPORTED_EXAM_CODES = Object.keys(EXAM_PROFILES);

export function getExamProfile(examCode) {
  const key = SUPPORTED_EXAM_CODES.find(
    (k) => k.toLowerCase() === String(examCode || "").trim().toLowerCase(),
  );
  return key ? EXAM_PROFILES[key] : EXAM_PROFILES["IBPS PO"];
}

export function mapDifficultyToCanonical(difficulty) {
  const d = String(difficulty || "moderate").toLowerCase();
  if (d === "easy") return "easy";
  if (d === "difficult" || d === "hard") return "hard";
  return "medium";
}

export function normalizeExamCodesList(codes = []) {
  const out = [];
  const seen = new Set();
  for (const c of Array.isArray(codes) ? codes : [codes]) {
    const match = SUPPORTED_EXAM_CODES.find(
      (k) => k.toLowerCase() === String(c || "").trim().toLowerCase(),
    );
    if (match && !seen.has(match)) {
      seen.add(match);
      out.push(match);
    }
  }
  return out;
}
