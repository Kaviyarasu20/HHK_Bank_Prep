// Place at: server/services/questionGenerator.js
import { generateFromQuestionEngine } from "../question-engine/core/engineRouter.js";

/**
 * Strict Registry of Topics backed by Full Multi-Type, Exam-Blueprint Question Engines.
 *
 * HOW TO ACTIVATE A NEW TOPIC:
 * 1. Build and audit its modular generator in `server/question-engine/generators/<subject>/<topic>/`.
 * 2. Wire its route in `server/question-engine/core/engineRouter.js`.
 * 3. Uncomment the topic name below (and its matcher keyword if needed).
 *
 * IMPORTANT: Do NOT uncomment a topic before wiring it in `engineRouter.js`,
 * otherwise `engineRouter.js` will fall back to Simplification questions.
 */
export const SUPPORTED_AUTO_TOPICS = {
  quant: [
    "Simplification & Approximation",
    "Simplification",
    "Approximation",
    "Number System",
    "Quadratic Equations",
    "Linear Simultaneous Equations",
    "Linear Equations",
    "Number Series",
    "Percentage",
    "Ratio & Proportion",
    "Average",
    "Pipes & Cisterns",
    "Time, Speed & Distance",
    "Boats & Streams",
    "Mixture & Alligation",
    "Partnership",
    "Problems on Ages",
    "Probability",
    "Permutation & Combination",
    "Permutation and Combination",
    "Profit & Loss",
    "Simple Interest",
    "Compound Interest",
    "Time & Work",
    "Data Interpretation",
    "Data Sufficiency",
  ],

  reasoning: [
    "Blood Relations",
    "Seating Arrangement",
    // --- Uncomment each Reasoning topic below ONLY after building its generator in server/question-engine/generators/reasoning/ ---
    // "Puzzles",
    // "Seating Arrangement",
    // "Syllogism",
    // "Inequality",
    // "Coding-Decoding",
    // "Direction & Distance",
    // "Order & Ranking",
    // "Alphanumeric Series",
    // "Number Series",
    // "Letter Series",
    // "Input-Output",
    // "Data Sufficiency",
    // "Logical Reasoning",
    // "Statement & Conclusion",
    // "Statement & Assumption",
    // "Cause & Effect",
    // "Analogy",
    // "Classification",
  ],

  english: [
    // --- Uncomment each English topic below ONLY after building its generator in server/question-engine/generators/english/ ---
    // "Reading Comprehension",
    // "Cloze Test",
    // "Error Detection",
    // "Sentence Correction",
    // "Fill in the Blanks",
    // "Para Jumbles",
    // "Sentence Rearrangement",
    // "Phrase Replacement",
    // "Vocabulary",
    // "Synonyms & Antonyms",
    // "Idioms & Phrases",
    // "Word Usage",
    // "Grammar",
  ],

  banking_awareness: [
    // --- Uncomment each Banking & Financial Awareness topic below ONLY after building its generator ---
    // "History of Banking in India",
    // "Types of Banks",
    // "Types of Bank Accounts",
    // "Reserve Bank of India",
    // "SEBI",
    // "NABARD",
    // "SIDBI",
    // "EXIM Bank",
    // "NHB",
    // "IRDAI",
    // "PFRDA",
    // "Monetary Policy",
    // "Repo Rate",
    // "Reverse Repo Rate",
    // "CRR",
    // "SLR",
    // "Bank Rate",
    // "MSF",
    // "NPA",
    // "Basel Norms",
    // "Financial Inclusion",
    // "Digital Banking",
    // "UPI",
    // "NEFT",
    // "RTGS",
    // "IMPS",
    // "NPCI",
    // "Cheques",
    // "Negotiable Instruments",
    // "Loans & Advances",
    // "Priority Sector Lending",
    // "KYC",
    // "AML",
    // "Digital Payments",
  ],

  general_awareness: [
    // --- Uncomment each General Awareness topic below ONLY after building its generator ---
    // "Current Affairs",
    // "Banking Current Affairs",
    // "RBI Updates",
    // "Banking Terms",
    // "Financial Institutions",
    // "Government Schemes",
    // "Union Budget",
    // "Economic Survey",
    // "National News",
    // "International News",
    // "Awards & Honours",
    // "Sports",
    // "Important Appointments",
    // "Books & Authors",
    // "Important Days",
    // "Countries & Capitals",
    // "Static GK",
  ],

  computer: [
    // --- Uncomment each Computer Awareness topic below ONLY after building its generator ---
    // "Computer Fundamentals",
    // "Hardware & Software",
    // "Operating Systems",
    // "MS Office",
    // "Internet",
    // "Computer Networking",
    // "Cyber Security",
    // "Computer Abbreviations",
    // "DBMS Basics",
    // "Programming Basics",
    // "Computer Memory",
    // "Input & Output Devices",
    // "Cloud Computing",
    // "Artificial Intelligence",
    // "Digital Banking Security",
  ],
};

/**
 * Active keyword matchers for topics that have a built, audited engine in `engineRouter.js`.
 */
const ENGINE_TOPIC_MATCHERS = [
  // Quantitative Aptitude (Active)
  "simplification",
  "approximation",
  "number system",
  "quadratic",
  "linear",
  "number series",
  "percentage",
  "ratio",
  "proportion",
  "average",
  "pipes",
  "pipe",
  "cistern",
  "time, speed",
  "time speed",
  "speed & distance",
  "speed and distance",
  "trains",
  "boat",
  "stream",
  "mixture",
  "alligation",
  "partnership",
  "age",
  "probab",
  "permutation",
  "combination",
  "p&c",
  "p & c",
  "profit",
  "loss",
  "interest",
  "time & work",
  "time and work",
  "data interpretation",
  "data sufficiency",

  // Reasoning Ability (Active)
  "blood relation",
  "seating",
];

/**
 * Returns true ONLY if the topic has a real multi-type modular Question Engine.
 * Automatically scans every subject array inside SUPPORTED_AUTO_TOPICS.
 */
export function isEngineSupportedTopic(topicName = "") {
  const normalized = String(topicName || "").trim().toLowerCase();
  if (!normalized) return false;

  const allListed = Object.values(SUPPORTED_AUTO_TOPICS)
    .flat()
    .map((t) => String(t).trim().toLowerCase());

  return (
    allListed.includes(normalized) ||
    ENGINE_TOPIC_MATCHERS.some((kw) => normalized.includes(kw))
  );
}

// Export alias expected by server/routes/admin.js
export const isTopicAutoGeneratable = isEngineSupportedTopic;

/**
 * Strict Dispatcher: Routes ONLY verified modular Question Engine topics.
 * Zero boilerplate templates and zero silent fallbacks.
 */
export function generateTopicQuestions({
  examCode = "IBPS_PO",
  stageName = "Prelims",
  topicName,
  subtopicName = "",
  difficulty = "medium",
  count = 15,
  optionCount = 5,
}) {
  const cleanTopic = String(topicName || "").trim();
  const cleanSub = String(subtopicName || "").trim();

  if (!isEngineSupportedTopic(cleanTopic)) {
    throw Object.assign(
      new Error(
        `No modular Question Engine is built yet for "${cleanTopic}". Build its multi-type generator in server/question-engine/generators/ first, or use Manual / CSV import.`
      ),
      { status: 400 }
    );
  }

  const engineQuestions = generateFromQuestionEngine({
    examCode,
    stageName,
    topicName: cleanTopic,
    subtopicName: cleanSub,
    difficulty,
    count,
    optionCount,
  });

  return {
    mode: "standalone",
    engine: "HHK_QUESTION_ENGINE_V2",
    passageSets: [],
    standaloneQuestions: engineQuestions,
    totalQuestions: engineQuestions.length,
  };
}