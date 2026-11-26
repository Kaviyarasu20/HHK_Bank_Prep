import crypto from "node:crypto";
import { executeAiCompletion, getAiConfig } from "./caAiProvider.js";

/**
 * HHK Reading Comprehension AI Generation & Quality Validation Engine
 * - Reuses existing backend-only AI provider (caAiProvider.js) with multi-model failover.
 * - Supports all 15 Reading Comprehension categories, 10 question types, and 9 banking exams.
 * - Enforces strict schema validation, duplicate detection, and automatic regeneration of failed questions.
 * - Never fabricates or simulates AI output when credentials are disabled/missing.
 */

export const RC_EXAMINATIONS = [
  "IBPS PO",
  "IBPS Clerk",
  "IBPS RRB PO",
  "IBPS RRB Clerk",
  "SBI PO",
  "SBI Clerk",
  "RBI Assistant",
  "RBI Grade B",
  "Other Competitive Banking Examinations",
];

export const RC_SUBJECT_CATEGORIES = [
  "Reading Comprehension – Banking",
  "Reading Comprehension – Economy",
  "Reading Comprehension – Business",
  "Reading Comprehension – Finance",
  "Reading Comprehension – Social Issues",
  "Reading Comprehension – Technology",
  "Reading Comprehension – Environment",
  "Reading Comprehension – Education",
  "Reading Comprehension – General Topics",
  "Reading Comprehension – Editorial",
];

export const RC_QUESTION_FOCUSED_CATEGORIES = [
  "Reading Comprehension – Inference Based",
  "Reading Comprehension – Fact Based",
  "Reading Comprehension – Tone Based",
  "Reading Comprehension – Title Selection",
  "Reading Comprehension – Vocabulary Based",
];

export const RC_ALL_CATEGORIES = [
  ...RC_SUBJECT_CATEGORIES,
  ...RC_QUESTION_FOCUSED_CATEGORIES,
];

export const RC_QUESTION_TYPES = [
  "Main Idea / Central Theme",
  "Supporting Details",
  "Inference-Based Questions",
  "Author's Tone",
  "Synonyms and Antonyms",
  "True / False / Cannot Be Determined",
  "Suitable Title Selection",
  "Conclusion-Based Questions",
  "Meaning of Phrases in Context",
  "Passage-Based Vocabulary",
];

export const RC_DIFFICULTIES = ["easy", "moderate", "hard", "expert"];

export const RC_LENGTH_SPECS = {
  short: { label: "Short", minWords: 180, targetMin: 220, targetMax: 320, maxWords: 420, paragraphs: "2-3", recommendedTimeSec: 420 },
  medium: { label: "Medium", minWords: 300, targetMin: 380, targetMax: 520, maxWords: 680, paragraphs: "3-4", recommendedTimeSec: 600 },
  long: { label: "Long", minWords: 480, targetMin: 560, targetMax: 740, maxWords: 950, paragraphs: "4-6", recommendedTimeSec: 840 },
};

export function getRcAiStatus(env = process.env) {
  const cfg = getAiConfig(env);
  return {
    enabled: cfg.enabled,
    provider: cfg.provider,
    model: cfg.model,
    hasApiKey: cfg.hasApiKey,
    ready: Boolean(cfg.enabled && cfg.hasApiKey && ["gemini", "openai"].includes(cfg.provider) && cfg.model),
  };
}

export function normalizeTextForHash(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeRcHash(text) {
  return crypto.createHash("sha256").update(normalizeTextForHash(text)).digest("hex");
}

export function countWords(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function computeTokenSimilarity(a, b) {
  const setA = new Set(normalizeTextForHash(a).split(" ").filter((w) => w.length > 2));
  const setB = new Set(normalizeTextForHash(b).split(" ").filter((w) => w.length > 2));
  if (!setA.size || !setB.size) return 0;
  let overlap = 0;
  for (const w of setA) {
    if (setB.has(w)) overlap += 1;
  }
  return overlap / (setA.size + setB.size - overlap);
}

export function safeParseJson(rawText) {
  const trimmed = String(rawText || "").trim();
  if (!trimmed) throw new Error("AI returned an empty response.");
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const startObj = candidate.indexOf("{");
    const endObj = candidate.lastIndexOf("}");
    if (startObj >= 0 && endObj > startObj) {
      return JSON.parse(candidate.slice(startObj, endObj + 1));
    }
    throw new Error("AI response was not valid JSON.");
  }
}

/**
 * Invokes the existing caAiProvider with automatic multi-model failover
 * when CA_AI_MODEL contains a comma-separated fallback list (e.g. Gemini Free Tier).
 */
async function callRcAi({ systemPrompt, userPrompt, env = process.env, fetchFn = fetch, providerFn = null }) {
  if (typeof providerFn === "function") {
    return executeAiCompletion({ systemPrompt, userPrompt, env, fetchFn, providerFn });
  }
  const cfg = getAiConfig(env);
  const models = String(cfg.model || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  if (models.length <= 1) {
    return executeAiCompletion({ systemPrompt, userPrompt, env, fetchFn });
  }

  let lastErr = null;
  // Fast failover across models (no redundant inner retries per overloaded model), then 1 short backoff pass
  for (let pass = 0; pass < 2; pass += 1) {
    if (pass > 0) await new Promise((r) => setTimeout(r, 1500));
    for (const modelName of models) {
      try {
        const modelEnv = { ...env, CA_AI_MODEL: modelName, CA_AI_MAX_RETRIES: "0" };
        return await executeAiCompletion({ systemPrompt, userPrompt, env: modelEnv, fetchFn });
      } catch (err) {
        lastErr = err;
        const status = err?.status;
        const retryNextModel =
          status === 404 ||
          status === 429 ||
          (status >= 500 && status < 600) ||
          /timed out/i.test(String(err?.message || ""));
        if (!retryNextModel) throw err;
      }
    }
  }
  throw lastErr || new Error("All configured AI models failed.");
}

// ============================================================================
// Automated Quality Control & Validation (Section 8)
// ============================================================================

export function validateRcPassage(passage, expectedLength = "medium") {
  const issues = [];
  const title = String(passage?.title || "").trim();
  const text = String(passage?.passage_text || passage?.passageText || "").trim();
  const words = countWords(text);
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const spec = RC_LENGTH_SPECS[expectedLength] || RC_LENGTH_SPECS.medium;

  if (title.length < 6) issues.push("Passage title is too short.");
  if (words < Math.floor(spec.minWords * 0.75)) {
    issues.push(`Passage is too short (${words} words; expected at least ~${spec.minWords} words for ${spec.label}).`);
  }
  if (paragraphs.length < 2) {
    issues.push("Passage must contain at least 2 structured paragraphs.");
  }
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10);
  if (sentences.length < 5) {
    issues.push("Passage has too few complete sentences for exam-grade questioning.");
  }

  // Check for excessive sentence repetition
  const seenSentences = new Set();
  let duplicateSentences = 0;
  for (const s of sentences) {
    const norm = normalizeTextForHash(s);
    if (seenSentences.has(norm)) duplicateSentences += 1;
    seenSentences.add(norm);
  }
  if (duplicateSentences > 0) {
    issues.push(`Passage contains ${duplicateSentences} repeated sentence(s).`);
  }

  return {
    valid: issues.length === 0,
    wordCount: words,
    paragraphCount: paragraphs.length,
    sentenceCount: sentences.length,
    issues,
  };
}

export function normalizeRcOptions(rawOptions, optionCount = 5) {
  const allowedKeys = optionCount === 4 ? ["A", "B", "C", "D"] : ["A", "B", "C", "D", "E"];
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions.slice(0, optionCount).map((opt, idx) => {
    if (typeof opt === "string") {
      return { key: allowedKeys[idx], text: opt.replace(/^[A-E][\)\.\:\-]\s*/i, "").trim() };
    }
    return {
      key: allowedKeys[idx],
      text: String(opt?.text ?? opt?.label ?? "").replace(/^[A-E][\)\.\:\-]\s*/i, "").trim(),
    };
  });
}

export function validateRcQuestion(q, passageText, existingQuestions = [], optionCount = 5, requireExplanation = true) {
  const issues = [];
  const allowedKeys = optionCount === 4 ? ["A", "B", "C", "D"] : ["A", "B", "C", "D", "E"];
  const qText = String(q?.question_text ?? q?.questionText ?? "").trim();
  const qType = String(q?.question_type ?? q?.questionType ?? "").trim();
  const options = normalizeRcOptions(q?.options, optionCount);
  const answer = String(q?.correct_answer ?? q?.correctAnswer ?? "").trim().toUpperCase().replace(/[^A-E]/g, "");
  const explanation = String(q?.explanation ?? "").trim();
  const passageRef = String(q?.passage_reference ?? q?.passageReference ?? "").trim();

  if (qText.length < 15) issues.push("Question statement is too short.");
  if (!RC_QUESTION_TYPES.includes(qType)) {
    issues.push(`Unsupported question type "${qType}".`);
  }
  if (options.length !== optionCount) {
    issues.push(`Expected exactly ${optionCount} options, received ${options.length}.`);
  }
  const normalizedOptTexts = new Set();
  for (const opt of options) {
    if (!opt.text || opt.text.length < 1) {
      issues.push(`Option ${opt.key} is empty.`);
    } else {
      const norm = normalizeTextForHash(opt.text);
      if (normalizedOptTexts.has(norm)) {
        issues.push(`Duplicate option detected at Option ${opt.key}.`);
      }
      normalizedOptTexts.add(norm);
    }
  }
  if (!allowedKeys.includes(answer)) {
    issues.push(`Correct answer "${answer}" is not within valid keys (${allowedKeys.join(", ")}).`);
  }
  if (requireExplanation && explanation.length < 20) {
    issues.push("Detailed explanation is missing or too brief.");
  }
  if (passageRef.length < 8) {
    issues.push("Passage reference / supporting evidence is missing.");
  }

  // Check duplicate against existing questions
  const qHash = computeRcHash(qText);
  for (const existing of existingQuestions) {
    const existingText = String(existing?.question_text ?? existing?.questionText ?? "");
    if (!existingText) continue;
    if (computeRcHash(existingText) === qHash || computeTokenSimilarity(qText, existingText) >= 0.72) {
      issues.push("Duplicate or overly similar question detected within the passage.");
      break;
    }
  }

  // Basic sanity check: passage text must exist
  if (!String(passageText || "").trim()) {
    issues.push("Passage text is missing for consistency verification.");
  }

  return {
    valid: issues.length === 0,
    issues,
    normalized: {
      question_type: RC_QUESTION_TYPES.includes(qType) ? qType : "Supporting Details",
      question_text: qText,
      options,
      correct_answer: allowedKeys.includes(answer) ? answer : "A",
      explanation,
      passage_reference: passageRef,
      difficulty: RC_DIFFICULTIES.includes(String(q?.difficulty || "").toLowerCase())
        ? String(q.difficulty).toLowerCase()
        : "moderate",
      content_hash: qHash,
    },
  };
}

export function validateRcVocabularyItem(item) {
  const issues = [];
  const word = String(item?.word || "").trim();
  const meaningEnglish = String(item?.meaning_english ?? item?.meaningEnglish ?? "").trim();
  const meaningTamil = String(item?.meaning_tamil ?? item?.meaningTamil ?? "").trim();
  const synonym = String(item?.synonym || "").trim();
  const antonym = String(item?.antonym || "").trim();
  const pronunciation = String(item?.pronunciation || "").trim();
  const exampleSentence = String(item?.example_sentence ?? item?.exampleSentence ?? "").trim();
  const passageContext = String(item?.passage_context ?? item?.passageContext ?? "").trim();

  if (word.length < 2) issues.push("Vocabulary word is missing.");
  if (meaningEnglish.length < 4) issues.push(`English meaning missing for "${word}".`);
  if (meaningTamil.length < 1) issues.push(`Tamil meaning missing for "${word}".`);
  if (synonym.length < 2) issues.push(`Synonym missing for "${word}".`);
  if (antonym.length < 2) issues.push(`Antonym missing for "${word}".`);

  return {
    valid: issues.length === 0,
    issues,
    normalized: {
      word,
      meaning_english: meaningEnglish,
      meaning_tamil: meaningTamil,
      synonym,
      antonym,
      pronunciation,
      example_sentence: exampleSentence,
      passage_context: passageContext,
    },
  };
}

// ============================================================================
// AI Passage + Vocabulary Generation Engine (Sections 5 & 7)
// ============================================================================

export async function generateRcPassageWithAi(config, opts = {}) {
  const examination = RC_EXAMINATIONS.includes(config.examination) ? config.examination : "IBPS PO";
  const category = RC_ALL_CATEGORIES.includes(config.category) ? config.category : RC_ALL_CATEGORIES[0];
  const difficulty = RC_DIFFICULTIES.includes(config.difficulty) ? config.difficulty : "moderate";
  const passageLength = RC_LENGTH_SPECS[config.passageLength] ? config.passageLength : "medium";
  const includeVocabulary = config.includeVocabulary !== false;
  const spec = RC_LENGTH_SPECS[passageLength];

  const systemPrompt = [
    "You are a senior English Language question paper setter for Indian competitive banking examinations (IBPS PO, SBI PO, RBI Grade B, IBPS RRB, Clerk).",
    "Generate 100% ORIGINAL, publication-grade Reading Comprehension passages in formal newspaper/editorial English.",
    "NEVER reproduce copyrighted newspaper articles. Write fresh, coherent, analytical paragraphs with rich facts, nuanced authorial tone, clear cause-effect relationships, and exam-relevant vocabulary so all 10 banking RC question types can be framed unambiguously.",
    "Return STRICT JSON ONLY with no markdown prose outside JSON.",
  ].join(" ");

  const userPrompt = JSON.stringify({
    task: "Generate one original banking-exam Reading Comprehension passage" + (includeVocabulary ? " and 6-8 exam-useful vocabulary items extracted verbatim from the passage" : ""),
    parameters: {
      examination,
      category,
      difficulty,
      length: `${spec.label} (${spec.targetMin}-${spec.targetMax} words, ${spec.paragraphs} well-structured paragraphs separated by \\n\\n)`,
      includeVocabulary,
      avoidTopicsOrTitles: Array.isArray(config.avoidTitles) ? config.avoidTitles.slice(0, 8) : [],
    },
    outputSchema: {
      title: "Concise, editorial-style headline (6-14 words)",
      passageText: "Full multi-paragraph passage separated by \\n\\n",
      authorTone: "e.g., Analytical and Cautiously Optimistic",
      vocabulary: includeVocabulary
        ? [
            {
              word: "exact word from the passage",
              meaningEnglish: "Simple, clear English definition",
              meaningTamil: "Accurate Tamil meaning in Tamil script (e.g., நிதி நிலைத்தன்மை)",
              synonym: "1-2 contextual synonyms",
              antonym: "1-2 contextual antonyms",
              pronunciation: "Phonetic guide (e.g., /prəˈdɛn.ʃəl/)",
              exampleSentence: "Fresh banking/formal example sentence using the word",
              passageContext: "Exact sentence or clause from the passage containing this word",
            },
          ]
        : [],
    },
  });

  const aiOut = await callRcAi({ systemPrompt, userPrompt, ...opts });
  const parsed = safeParseJson(aiOut.rawText);

  const passageObj = {
    title: String(parsed?.title || `${category} — ${examination}`).trim(),
    passage_text: String(parsed?.passageText || parsed?.passage_text || "").trim(),
    examination,
    category,
    difficulty,
    passage_length: passageLength,
  };

  const validation = validateRcPassage(passageObj, passageLength);
  const rawVocab = includeVocabulary && Array.isArray(parsed?.vocabulary) ? parsed.vocabulary : [];
  const vocabulary = [];
  const vocabIssues = [];
  const seenWords = new Set();
  for (const item of rawVocab) {
    const vCheck = validateRcVocabularyItem(item);
    const key = vCheck.normalized.word.toLowerCase();
    if (!key || seenWords.has(key)) continue;
    seenWords.add(key);
    vocabulary.push(vCheck.normalized);
    if (!vCheck.valid) vocabIssues.push(...vCheck.issues);
  }

  return {
    passage: {
      ...passageObj,
      word_count: validation.wordCount,
      recommended_time_seconds: spec.recommendedTimeSec,
      content_hash: computeRcHash(passageObj.passage_text),
    },
    vocabulary,
    validation: {
      ...validation,
      vocabCount: vocabulary.length,
      vocabIssues,
    },
    meta: {
      provider: aiOut.provider || "ai",
      model: aiOut.model || "",
      usage: aiOut.usage || null,
    },
  };
}

// ============================================================================
// Intelligent Question Generation + Auto-Regeneration Loop (Sections 6 & 8)
// ============================================================================

export function buildQuestionTypeMix(requestedTypes, count) {
  const validRequested = Array.isArray(requestedTypes)
    ? requestedTypes.filter((t) => RC_QUESTION_TYPES.includes(t))
    : [];
  const pool = validRequested.length > 0 ? validRequested : RC_QUESTION_TYPES;
  const plan = [];
  for (let i = 0; i < count; i += 1) {
    plan.push(pool[i % pool.length]);
  }
  return plan;
}

export async function generateRcQuestionsWithAi(passage, config, opts = {}) {
  const questionsCount = Math.max(1, Math.min(15, Number(config.questionsPerPassage) || 5));
  const optionCount = Number(config.optionCount) === 4 ? 4 : 5;
  const includeExplanations = config.includeExplanations !== false;
  const difficulty = RC_DIFFICULTIES.includes(config.difficulty || passage.difficulty)
    ? (config.difficulty || passage.difficulty)
    : "moderate";
  const typePlan = buildQuestionTypeMix(config.questionTypes, questionsCount);
  const optionKeys = optionCount === 4 ? ["A", "B", "C", "D"] : ["A", "B", "C", "D", "E"];

  const systemPrompt = [
    "You are an expert Indian Banking Exam English Question Setter (IBPS PO, SBI PO, RBI Grade B).",
    "Generate strictly passage-grounded Reading Comprehension multiple-choice questions.",
    "RULES:",
    "1. Every question MUST have exactly ONE unambiguous correct answer strictly supported by the passage.",
    "2. Never use external facts absent from the passage.",
    "3. Distractors must be plausible yet demonstrably incorrect from the passage.",
    "4. Vocabulary/Phrase questions must test the contextual meaning used inside the passage.",
    "5. True/False/Cannot Be Determined questions must clearly separate explicit facts from unstated claims.",
    "6. Inference questions must require logical deduction strictly grounded in passage statements.",
    "7. Provide a verbatim supporting sentence/reference from the passage and a clear explanation.",
    "Return STRICT JSON ONLY.",
  ].join(" ");

  const userPrompt = JSON.stringify({
    task: `Generate ${questionsCount} unique, exam-standard Reading Comprehension questions for the passage below.`,
    examination: passage.examination,
    category: passage.category,
    difficulty,
    optionCount,
    optionKeys,
    includeExplanations,
    requiredQuestionTypesInOrder: typePlan,
    passageTitle: passage.title,
    passageText: passage.passage_text,
    outputSchema: {
      questions: [
        {
          questionType: "Exact type from requiredQuestionTypesInOrder",
          difficulty,
          questionText: "Clear, exam-standard question stem",
          options: optionKeys.map((k) => ({ key: k, text: `Option ${k} text` })),
          correctAnswer: "Single key from optionKeys (e.g., 'B')",
          explanation: includeExplanations
            ? "Detailed step-by-step explanation citing why the correct option is right and why key distractors are wrong."
            : "Brief justification from the passage.",
          passageReference: "Verbatim supporting sentence or paragraph cue from the passage.",
        },
      ],
    },
  });

  const aiOut = await callRcAi({ systemPrompt, userPrompt, ...opts });
  const parsed = safeParseJson(aiOut.rawText);
  const rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];

  const accepted = [];
  let regeneratedCount = 0;
  const validationLog = [];

  for (let i = 0; i < questionsCount; i += 1) {
    const desiredType = typePlan[i];
    const candidate = rawQuestions[i] || null;
    let check = candidate
      ? validateRcQuestion(candidate, passage.passage_text, accepted, optionCount, includeExplanations)
      : { valid: false, issues: ["Missing question from batch response."], normalized: null };

    // Automatic Quality Control Regeneration if a question fails validation
    let attempts = 0;
    while (!check.valid && attempts < 2) {
      attempts += 1;
      try {
        const repaired = await regenerateSingleRcQuestionWithAi(
          passage,
          accepted,
          {
            question_type: desiredType,
            difficulty,
            previousIssues: check.issues,
          },
          { optionCount, includeExplanations },
          opts,
        );
        regeneratedCount += 1;
        if (repaired.validation.valid) {
          check = repaired.validation;
          break;
        }
        check = repaired.validation;
      } catch (repairErr) {
        validationLog.push(`Q${i + 1} repair attempt ${attempts} failed: ${repairErr.message}`);
        break;
      }
    }

    if (check.normalized && check.normalized.question_text) {
      accepted.push({
        ...check.normalized,
        question_number: accepted.length + 1,
        category: passage.category,
        validation_status: check.valid ? "verified" : "flagged",
        validation_notes: check.issues,
      });
    } else {
      validationLog.push(`Q${i + 1} (${desiredType}) rejected after validation: ${check.issues.join("; ")}`);
    }
  }

  return {
    questions: accepted,
    qualitySummary: {
      requested: questionsCount,
      generated: accepted.length,
      verifiedCount: accepted.filter((q) => q.validation_status === "verified").length,
      flaggedCount: accepted.filter((q) => q.validation_status === "flagged").length,
      regeneratedCount,
      notes: validationLog,
    },
    meta: {
      provider: aiOut.provider || "ai",
      model: aiOut.model || "",
      usage: aiOut.usage || null,
    },
  };
}

export async function regenerateSingleRcQuestionWithAi(passage, existingQuestions = [], target = {}, config = {}, opts = {}) {
  const optionCount = Number(config.optionCount || passage.option_count) === 4 ? 4 : 5;
  const includeExplanations = config.includeExplanations !== false;
  const optionKeys = optionCount === 4 ? ["A", "B", "C", "D"] : ["A", "B", "C", "D", "E"];
  const desiredType = RC_QUESTION_TYPES.includes(target.question_type)
    ? target.question_type
    : RC_QUESTION_TYPES[0];
  const difficulty = RC_DIFFICULTIES.includes(target.difficulty || passage.difficulty)
    ? (target.difficulty || passage.difficulty)
    : "moderate";

  const systemPrompt = [
    "You are a senior Indian Banking Exam English Question Setter.",
    "Generate ONE fresh, unambiguous, strictly passage-grounded Reading Comprehension MCQ.",
    "Do NOT duplicate any of the existing questions listed. Ensure all options are distinct and exactly one answer is supported by the passage.",
    "Return STRICT JSON ONLY.",
  ].join(" ");

  const userPrompt = JSON.stringify({
    task: `Generate 1 fresh "${desiredType}" question for this passage.`,
    examination: passage.examination,
    category: passage.category,
    difficulty,
    optionCount,
    optionKeys,
    includeExplanations,
    previousValidationIssuesToFix: target.previousIssues || [],
    existingQuestionsToAvoidDuplicating: existingQuestions.map((q) => q.question_text || q.questionText).filter(Boolean),
    passageTitle: passage.title,
    passageText: passage.passage_text,
    outputSchema: {
      questionType: desiredType,
      difficulty,
      questionText: "Fresh, unambiguous question statement",
      options: optionKeys.map((k) => ({ key: k, text: `Option ${k} text` })),
      correctAnswer: "Single key from optionKeys",
      explanation: "Detailed explanation grounded strictly in the passage",
      passageReference: "Verbatim supporting sentence from the passage",
    },
  });

  const aiOut = await callRcAi({ systemPrompt, userPrompt, ...opts });
  const parsed = safeParseJson(aiOut.rawText);
  const candidate = parsed?.question || parsed;
  const validation = validateRcQuestion(candidate, passage.passage_text, existingQuestions, optionCount, includeExplanations);

  return {
    question: {
      ...validation.normalized,
      category: passage.category,
      validation_status: validation.valid ? "verified" : "flagged",
      validation_notes: validation.issues,
    },
    validation,
    meta: {
      provider: aiOut.provider || "ai",
      model: aiOut.model || "",
      usage: aiOut.usage || null,
    },
  };
}

/**
 * Single-call Combined Passage + Questions (+ Optional Vocabulary) Generator.
 * Cuts AI API calls in half (ideal for Topicwise multi-passage sets & Gemini Free Tier 503 resilience).
 */
export async function generateRcPassageAndQuestionsWithAi(config, opts = {}) {
  const examination = RC_EXAMINATIONS.includes(config.examination) ? config.examination : "IBPS PO";
  const category = RC_ALL_CATEGORIES.includes(config.category) ? config.category : RC_ALL_CATEGORIES[0];
  const difficulty = RC_DIFFICULTIES.includes(config.difficulty) ? config.difficulty : "moderate";
  const passageLength = RC_LENGTH_SPECS[config.passageLength] ? config.passageLength : "medium";
  const includeVocabulary = config.includeVocabulary !== false;
  const includeExplanations = config.includeExplanations !== false;
  const questionsCount = Math.max(1, Math.min(15, Number(config.questionsPerPassage) || 5));
  const optionCount = Number(config.optionCount) === 4 ? 4 : 5;
  const optionKeys = optionCount === 4 ? ["A", "B", "C", "D"] : ["A", "B", "C", "D", "E"];
  const typePlan = buildQuestionTypeMix(config.questionTypes, questionsCount);
  const spec = RC_LENGTH_SPECS[passageLength];

  const systemPrompt = [
    "You are a senior English Language question paper setter for Indian competitive banking examinations (IBPS PO, SBI PO, RBI Grade B, IBPS RRB, Clerk).",
    "In ONE JSON response, generate: (1) a 100% ORIGINAL newspaper/editorial-style Reading Comprehension passage, and (2) strictly passage-grounded multiple-choice questions.",
    "Every question must have distinct options, exactly ONE unambiguous correct answer strictly supported by the passage, a clear explanation, and a supporting passage reference.",
    "Return STRICT JSON ONLY with no prose outside JSON.",
  ].join(" ");

  const userPrompt = JSON.stringify({
    task: `Generate 1 original Reading Comprehension passage and ${questionsCount} unique exam-standard questions` + (includeVocabulary ? " plus 6 exam-useful vocabulary items (with Tamil meaning)" : ""),
    parameters: {
      examination,
      category,
      difficulty,
      length: `${spec.label} (${spec.targetMin}-${spec.targetMax} words, ${spec.paragraphs} paragraphs separated by \n\n)`,
      optionCount,
      optionKeys,
      requiredQuestionTypesInOrder: typePlan,
      avoidTitles: Array.isArray(config.avoidTitles) ? config.avoidTitles.slice(0, 8) : [],
    },
    outputSchema: {
      title: "Concise editorial headline (6-14 words)",
      passageText: "Full multi-paragraph passage separated by \n\n",
      questions: [
        {
          questionType: "Exact type from requiredQuestionTypesInOrder",
          difficulty,
          questionText: "Unambiguous question statement",
          options: optionKeys.map((k) => ({ key: k, text: `Option ${k}` })),
          correctAnswer: "Single key from optionKeys",
          explanation: "Detailed explanation grounded strictly in the passage",
          passageReference: "Verbatim supporting sentence from the passage",
        },
      ],
      vocabulary: includeVocabulary
        ? [
            {
              word: "exact word from passage",
              meaningEnglish: "Simple English definition",
              meaningTamil: "Accurate Tamil meaning in Tamil script",
              synonym: "Contextual synonym",
              antonym: "Contextual antonym",
              pronunciation: "Phonetic guide",
              exampleSentence: "Fresh formal example sentence",
              passageContext: "Exact clause from the passage",
            },
          ]
        : [],
    },
  });

  const aiOut = await callRcAi({ systemPrompt, userPrompt, ...opts });
  const parsed = safeParseJson(aiOut.rawText);

  const passageObj = {
    title: String(parsed?.title || `${category} — ${examination}`).trim(),
    passage_text: String(parsed?.passageText || parsed?.passage_text || "").trim(),
    examination,
    category,
    difficulty,
    passage_length: passageLength,
  };
  const passageValidation = validateRcPassage(passageObj, passageLength);

  const rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];
  const accepted = [];
  for (let i = 0; i < rawQuestions.length && accepted.length < questionsCount; i += 1) {
    const check = validateRcQuestion(
      rawQuestions[i],
      passageObj.passage_text,
      accepted,
      optionCount,
      includeExplanations,
    );
    if (check.normalized && check.normalized.question_text) {
      accepted.push({
        ...check.normalized,
        question_number: accepted.length + 1,
        category,
        validation_status: check.valid ? "verified" : "flagged",
        validation_notes: check.issues,
      });
    }
  }

  const rawVocab = includeVocabulary && Array.isArray(parsed?.vocabulary) ? parsed.vocabulary : [];
  const vocabulary = [];
  const seenWords = new Set();
  for (const item of rawVocab) {
    const vCheck = validateRcVocabularyItem(item);
    const key = vCheck.normalized.word.toLowerCase();
    if (!key || seenWords.has(key)) continue;
    seenWords.add(key);
    vocabulary.push(vCheck.normalized);
  }

  return {
    passage: {
      ...passageObj,
      word_count: passageValidation.wordCount,
      recommended_time_seconds: spec.recommendedTimeSec,
      content_hash: computeRcHash(passageObj.passage_text),
    },
    questions: accepted,
    vocabulary,
    validation: passageValidation,
    qualitySummary: {
      requested: questionsCount,
      generated: accepted.length,
      verifiedCount: accepted.filter((q) => q.validation_status === "verified").length,
      flaggedCount: accepted.filter((q) => q.validation_status === "flagged").length,
      regeneratedCount: 0,
      notes: [],
    },
    meta: {
      provider: aiOut.provider || "ai",
      model: aiOut.model || "",
      usage: aiOut.usage || null,
    },
  };
}