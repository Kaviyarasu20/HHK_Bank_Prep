/**
 * Data-Driven Banking Examination Pattern Catalog
 *
 * IMPORTANT:
 * - Official structural parameters (sections, question counts, marks, duration, sectional timing,
 *   negative marking) reflect 2025-2026 official recruitment notifications.
 * - Topic-wise question ranges and weights are configurable historical-trend estimates
 *   (NOT fixed official examination quotas). Admins can customize, version, and override
 *   every parameter via the Exam Pattern Management API/UI.
 */

export const ARITHMETIC_SUBTOPICS_POOL = [
  { name: "Percentage", weight: 14, priority: 1, enabled: true },
  { name: "Profit & Loss", weight: 13, priority: 1, enabled: true },
  { name: "Ratio & Proportion", weight: 12, priority: 1, enabled: true },
  { name: "Time & Work", weight: 11, priority: 1, enabled: true },
  { name: "Simple Interest", weight: 7, priority: 2, enabled: true },
  { name: "Compound Interest", weight: 7, priority: 2, enabled: true },
  { name: "Average", weight: 9, priority: 2, enabled: true },
  { name: "Time, Speed & Distance", weight: 10, priority: 1, enabled: true },
  { name: "Boats & Streams", weight: 6, priority: 2, enabled: true },
  { name: "Mixture & Alligation", weight: 8, priority: 2, enabled: true },
  { name: "Partnership", weight: 7, priority: 2, enabled: true },
  { name: "Problems on Ages", weight: 8, priority: 2, enabled: true },
  { name: "Pipes & Cisterns", weight: 5, priority: 3, enabled: true },
  { name: "Probability", weight: 5, priority: 3, enabled: true },
  { name: "Permutation & Combination", weight: 4, priority: 3, enabled: true },
];

export const DEFAULT_REPETITION_POLICY = {
  withinTest: "STRICT_NO_DUPLICATES",
  recentTestsWindow: 5,
  globalPolicy: "ALLOW_AFTER_WINDOW",
};

/**
 * Default topic distribution templates (historical trend-based configurable ranges).
 * Note: "Arithmetic" uses weighted subtopic sampling so each mock test selects a realistic
 * subset of arithmetic topics rather than forcing all 15 subtopics into every paper.
 */
function quantTopicsClerkPrelims(totalQ = 35) {
  if (totalQ === 40) {
    // IBPS RRB Office Assistant Prelims (40 Qs)
    return [
      { topic: "Simplification & Approximation", minQuestions: 10, maxQuestions: 15, defaultQuestions: 12, weight: 30, priority: 1, enabled: true },
      { topic: "Number Series", minQuestions: 4, maxQuestions: 6, defaultQuestions: 5, weight: 13, priority: 1, enabled: true },
      { topic: "Quadratic Equations", minQuestions: 0, maxQuestions: 5, defaultQuestions: 3, weight: 8, priority: 2, enabled: true },
      { topic: "Data Interpretation", minQuestions: 5, maxQuestions: 10, defaultQuestions: 10, weight: 25, priority: 1, enabled: true },
      {
        topic: "Arithmetic",
        minQuestions: 8,
        maxQuestions: 14,
        defaultQuestions: 10,
        weight: 24,
        priority: 1,
        enabled: true,
        isCompositeArithmetic: true,
        subtopics: ARITHMETIC_SUBTOPICS_POOL,
      },
    ];
  }
  // IBPS Clerk / SBI Clerk Prelims (35 Qs)
  return [
    { topic: "Simplification & Approximation", minQuestions: 8, maxQuestions: 12, defaultQuestions: 10, weight: 29, priority: 1, enabled: true },
    { topic: "Number Series", minQuestions: 4, maxQuestions: 6, defaultQuestions: 5, weight: 14, priority: 1, enabled: true },
    { topic: "Quadratic Equations", minQuestions: 0, maxQuestions: 5, defaultQuestions: 3, weight: 9, priority: 2, enabled: true },
    { topic: "Data Interpretation", minQuestions: 5, maxQuestions: 10, defaultQuestions: 7, weight: 20, priority: 1, enabled: true },
    {
      topic: "Arithmetic",
      minQuestions: 8,
      maxQuestions: 12,
      defaultQuestions: 10,
      weight: 28,
      priority: 1,
      enabled: true,
      isCompositeArithmetic: true,
      subtopics: ARITHMETIC_SUBTOPICS_POOL,
    },
  ];
}

function quantTopicsPOPrelims(totalQ = 35) {
  if (totalQ === 40) {
    // IBPS RRB Officer Scale I Prelims (40 Qs)
    return [
      { topic: "Approximation", minQuestions: 4, maxQuestions: 6, defaultQuestions: 5, weight: 13, priority: 2, enabled: true },
      { topic: "Number Series", minQuestions: 4, maxQuestions: 6, defaultQuestions: 5, weight: 13, priority: 1, enabled: true },
      { topic: "Quadratic Equations", minQuestions: 4, maxQuestions: 6, defaultQuestions: 5, weight: 13, priority: 1, enabled: true },
      { topic: "Data Interpretation", minQuestions: 10, maxQuestions: 15, defaultQuestions: 13, weight: 32, priority: 1, enabled: true },
      {
        topic: "Arithmetic",
        minQuestions: 10,
        maxQuestions: 14,
        defaultQuestions: 12,
        weight: 29,
        priority: 1,
        enabled: true,
        isCompositeArithmetic: true,
        subtopics: ARITHMETIC_SUBTOPICS_POOL,
      },
    ];
  }
  if (totalQ === 30) {
    // SBI PO Prelims (30 Qs — revised 2025/2026 pattern)
    return [
      { topic: "Approximation", minQuestions: 3, maxQuestions: 5, defaultQuestions: 4, weight: 13, priority: 2, enabled: true },
      { topic: "Number Series", minQuestions: 3, maxQuestions: 5, defaultQuestions: 4, weight: 13, priority: 1, enabled: true },
      { topic: "Quadratic Equations", minQuestions: 3, maxQuestions: 5, defaultQuestions: 4, weight: 13, priority: 1, enabled: true },
      { topic: "Data Interpretation", minQuestions: 8, maxQuestions: 12, defaultQuestions: 10, weight: 34, priority: 1, enabled: true },
      {
        topic: "Arithmetic",
        minQuestions: 7,
        maxQuestions: 10,
        defaultQuestions: 8,
        weight: 27,
        priority: 1,
        enabled: true,
        isCompositeArithmetic: true,
        subtopics: ARITHMETIC_SUBTOPICS_POOL,
      },
    ];
  }
  // IBPS PO Prelims (35 Qs)
  return [
    { topic: "Approximation", minQuestions: 3, maxQuestions: 6, defaultQuestions: 5, weight: 14, priority: 2, enabled: true },
    { topic: "Number Series", minQuestions: 4, maxQuestions: 6, defaultQuestions: 5, weight: 14, priority: 1, enabled: true },
    { topic: "Quadratic Equations", minQuestions: 4, maxQuestions: 6, defaultQuestions: 5, weight: 14, priority: 1, enabled: true },
    { topic: "Data Interpretation", minQuestions: 10, maxQuestions: 15, defaultQuestions: 10, weight: 29, priority: 1, enabled: true },
    {
      topic: "Arithmetic",
      minQuestions: 9,
      maxQuestions: 13,
      defaultQuestions: 10,
      weight: 29,
      priority: 1,
      enabled: true,
      isCompositeArithmetic: true,
      subtopics: ARITHMETIC_SUBTOPICS_POOL,
    },
  ];
}

function quantTopicsMains(totalQ = 40, isPO = false) {
  if (isPO) {
    // IBPS PO Mains (40 Qs) / SBI PO Mains (30 Qs) — Heavy DI + Data Sufficiency + High-level Arithmetic
    const diDefault = Math.round(totalQ * 0.45);
    const dsDefault = Math.round(totalQ * 0.12);
    const numDefault = Math.round(totalQ * 0.13);
    const arithDefault = totalQ - diDefault - dsDefault - numDefault;
    return [
      { topic: "Data Interpretation", minQuestions: Math.max(8, diDefault - 4), maxQuestions: diDefault + 4, defaultQuestions: diDefault, weight: 45, priority: 1, enabled: true },
      { topic: "Data Sufficiency", minQuestions: 2, maxQuestions: 6, defaultQuestions: dsDefault, weight: 12, priority: 2, enabled: true },
      { topic: "Number Series", minQuestions: 2, maxQuestions: 5, defaultQuestions: Math.ceil(numDefault / 2), weight: 7, priority: 2, enabled: true },
      { topic: "Quadratic Equations", minQuestions: 2, maxQuestions: 5, defaultQuestions: Math.floor(numDefault / 2), weight: 6, priority: 2, enabled: true },
      {
        topic: "Arithmetic",
        minQuestions: Math.max(6, arithDefault - 3),
        maxQuestions: arithDefault + 4,
        defaultQuestions: arithDefault,
        weight: 30,
        priority: 1,
        enabled: true,
        isCompositeArithmetic: true,
        subtopics: ARITHMETIC_SUBTOPICS_POOL,
      },
    ];
  }
  // Clerk / RRB Mains (40 or 50 Qs)
  const diDefault = Math.round(totalQ * 0.35);
  const approxDefault = Math.round(totalQ * 0.12);
  const seriesDefault = Math.round(totalQ * 0.12);
  const quadDefault = Math.round(totalQ * 0.10);
  const arithDefault = totalQ - diDefault - approxDefault - seriesDefault - quadDefault;
  return [
    { topic: "Data Interpretation", minQuestions: Math.max(8, diDefault - 4), maxQuestions: diDefault + 5, defaultQuestions: diDefault, weight: 35, priority: 1, enabled: true },
    { topic: "Approximation", minQuestions: 3, maxQuestions: 7, defaultQuestions: approxDefault, weight: 12, priority: 2, enabled: true },
    { topic: "Number Series", minQuestions: 3, maxQuestions: 6, defaultQuestions: seriesDefault, weight: 12, priority: 1, enabled: true },
    { topic: "Quadratic Equations", minQuestions: 3, maxQuestions: 6, defaultQuestions: quadDefault, weight: 10, priority: 2, enabled: true },
    {
      topic: "Arithmetic",
      minQuestions: Math.max(8, arithDefault - 4),
      maxQuestions: arithDefault + 4,
      defaultQuestions: arithDefault,
      weight: 31,
      priority: 1,
      enabled: true,
      isCompositeArithmetic: true,
      subtopics: ARITHMETIC_SUBTOPICS_POOL,
    },
  ];
}

function reasoningTopicsDefault(totalQ = 35, isMains = false) {
  const puzzleDefault = Math.round(totalQ * (isMains ? 0.50 : 0.43));
  const syllogismDefault = Math.round(totalQ * 0.12);
  const ineqDefault = Math.round(totalQ * 0.12);
  const codingDefault = Math.round(totalQ * 0.12);
  const miscDefault = totalQ - puzzleDefault - syllogismDefault - ineqDefault - codingDefault;
  return [
    { topic: "Puzzles", minQuestions: Math.max(5, Math.floor(puzzleDefault * 0.5)), maxQuestions: Math.ceil(puzzleDefault * 0.7), defaultQuestions: Math.ceil(puzzleDefault / 2), weight: 25, priority: 1, enabled: true },
    { topic: "Seating Arrangement", minQuestions: Math.max(5, Math.floor(puzzleDefault * 0.4)), maxQuestions: Math.ceil(puzzleDefault * 0.6), defaultQuestions: Math.floor(puzzleDefault / 2), weight: 22, priority: 1, enabled: true },
    { topic: "Syllogism", minQuestions: 2, maxQuestions: 5, defaultQuestions: syllogismDefault, weight: 12, priority: 1, enabled: true },
    { topic: "Inequality", minQuestions: 2, maxQuestions: 5, defaultQuestions: ineqDefault, weight: 12, priority: 1, enabled: true },
    { topic: "Coding-Decoding", minQuestions: 2, maxQuestions: 6, defaultQuestions: codingDefault, weight: 12, priority: 2, enabled: true },
    { topic: "Blood Relations", minQuestions: 1, maxQuestions: 4, defaultQuestions: Math.ceil(miscDefault / 2), weight: 9, priority: 2, enabled: true },
    { topic: "Direction & Distance", minQuestions: 1, maxQuestions: 4, defaultQuestions: Math.floor(miscDefault / 2), weight: 8, priority: 2, enabled: true },
  ];
}

function englishTopicsDefault(totalQ = 30) {
  const rcDefault = Math.round(totalQ * 0.30);
  const clozeDefault = Math.round(totalQ * 0.20);
  const errorDefault = Math.round(totalQ * 0.17);
  const paraDefault = Math.round(totalQ * 0.16);
  const vocabDefault = totalQ - rcDefault - clozeDefault - errorDefault - paraDefault;
  return [
    { topic: "Reading Comprehension", minQuestions: Math.max(5, rcDefault - 2), maxQuestions: rcDefault + 3, defaultQuestions: rcDefault, weight: 30, priority: 1, enabled: true },
    { topic: "Cloze Test", minQuestions: 4, maxQuestions: 8, defaultQuestions: clozeDefault, weight: 20, priority: 1, enabled: true },
    { topic: "Error Detection", minQuestions: 3, maxQuestions: 7, defaultQuestions: errorDefault, weight: 17, priority: 1, enabled: true },
    { topic: "Para Jumbles", minQuestions: 3, maxQuestions: 6, defaultQuestions: paraDefault, weight: 16, priority: 2, enabled: true },
    { topic: "Fill in the Blanks", minQuestions: 3, maxQuestions: 7, defaultQuestions: vocabDefault, weight: 17, priority: 2, enabled: true },
  ];
}

function gaTopicsDefault(totalQ = 40) {
  const caDefault = Math.round(totalQ * 0.45);
  const bankDefault = Math.round(totalQ * 0.30);
  const staticDefault = totalQ - caDefault - bankDefault;
  return [
    { topic: "Current Affairs", minQuestions: Math.max(10, caDefault - 4), maxQuestions: caDefault + 5, defaultQuestions: caDefault, weight: 45, priority: 1, enabled: true },
    { topic: "Banking Current Affairs", minQuestions: Math.max(6, bankDefault - 3), maxQuestions: bankDefault + 4, defaultQuestions: bankDefault, weight: 30, priority: 1, enabled: true },
    { topic: "Government Schemes", minQuestions: 3, maxQuestions: 8, defaultQuestions: Math.ceil(staticDefault / 2), weight: 13, priority: 2, enabled: true },
    { topic: "RBI Updates", minQuestions: 3, maxQuestions: 8, defaultQuestions: Math.floor(staticDefault / 2), weight: 12, priority: 2, enabled: true },
  ];
}

function computerTopicsDefault(totalQ = 40) {
  return [
    { topic: "Computer Fundamentals", minQuestions: 8, maxQuestions: 14, defaultQuestions: 10, weight: 25, priority: 1, enabled: true },
    { topic: "MS Office", minQuestions: 6, maxQuestions: 12, defaultQuestions: 10, weight: 25, priority: 1, enabled: true },
    { topic: "Networking & Internet", minQuestions: 6, maxQuestions: 12, defaultQuestions: 10, weight: 25, priority: 1, enabled: true },
    { topic: "DBMS & Security", minQuestions: 6, maxQuestions: 12, defaultQuestions: 10, weight: 25, priority: 2, enabled: true },
  ];
}

export const EXAM_PATTERN_CATALOG = [
  // =========================================================================
  // 1. IBPS RRB Office Assistant (Clerk / Multipurpose)
  // =========================================================================
  {
    patternCode: "IBPS-RRB-OA-PRELIMS",
    examCode: "IBPS-RRB-OA",
    examName: "IBPS RRB Office Assistant (Clerk)",
    stageName: "Prelims",
    totalQuestions: 80,
    totalMarks: 80,
    durationSeconds: 45 * 60,
    sectionalTimingEnabled: true,
    negativeMarkingRatio: 0.25,
    optionCount: 5,
    shortagePolicy: "FAIL_STRICT",
    repetitionPolicy: DEFAULT_REPETITION_POLICY,
    sourceNotes: "Official IBPS CRP RRB Office Assistant Prelims pattern (80 Qs, 80 marks, 45 min, 0.25 negative marking). Topic distributions are historical-trend configurable estimates.",
    sections: [
      {
        sectionName: "Reasoning",
        subjectKey: "reasoning",
        questionCount: 40,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 25 * 60,
        sortOrder: 0,
        difficultyDistribution: { easy: 55, medium: 35, hard: 10 },
        topicDistributions: reasoningTopicsDefault(40, false),
      },
      {
        sectionName: "Numerical Ability",
        subjectKey: "quant",
        questionCount: 40,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 1,
        difficultyDistribution: { easy: 55, medium: 35, hard: 10 },
        topicDistributions: quantTopicsClerkPrelims(40),
      },
    ],
  },
  {
    patternCode: "IBPS-RRB-OA-MAINS",
    examCode: "IBPS-RRB-OA",
    examName: "IBPS RRB Office Assistant (Clerk)",
    stageName: "Mains",
    totalQuestions: 200,
    totalMarks: 200,
    durationSeconds: 120 * 60,
    sectionalTimingEnabled: true,
    negativeMarkingRatio: 0.25,
    optionCount: 5,
    shortagePolicy: "FAIL_STRICT",
    repetitionPolicy: DEFAULT_REPETITION_POLICY,
    sourceNotes: "Official IBPS CRP RRB Office Assistant Mains pattern (200 Qs, 200 marks, 120 min, 1/4th negative marking). Topic distributions are historical-trend configurable estimates.",
    sections: [
      {
        sectionName: "Reasoning",
        subjectKey: "reasoning",
        questionCount: 40,
        marksPerQuestion: 1.25,
        negativeMarks: 0.3125,
        durationSeconds: 30 * 60,
        sortOrder: 0,
        difficultyDistribution: { easy: 20, medium: 55, hard: 25 },
        topicDistributions: reasoningTopicsDefault(40, true),
      },
      {
        sectionName: "Computer Knowledge",
        subjectKey: "computer_knowledge",
        questionCount: 40,
        marksPerQuestion: 0.5,
        negativeMarks: 0.125,
        durationSeconds: 15 * 60,
        sortOrder: 1,
        difficultyDistribution: { easy: 40, medium: 45, hard: 15 },
        topicDistributions: computerTopicsDefault(40),
      },
      {
        sectionName: "General Awareness",
        subjectKey: "general_awareness",
        questionCount: 40,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 15 * 60,
        sortOrder: 2,
        difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
        topicDistributions: gaTopicsDefault(40),
      },
      {
        sectionName: "English Language",
        subjectKey: "english",
        questionCount: 40,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 30 * 60,
        sortOrder: 3,
        difficultyDistribution: { easy: 25, medium: 55, hard: 20 },
        topicDistributions: englishTopicsDefault(40),
      },
      {
        sectionName: "Numerical Ability",
        subjectKey: "quant",
        questionCount: 40,
        marksPerQuestion: 1.25,
        negativeMarks: 0.3125,
        durationSeconds: 30 * 60,
        sortOrder: 4,
        difficultyDistribution: { easy: 20, medium: 55, hard: 25 },
        topicDistributions: quantTopicsMains(40, false),
      },
    ],
  },

  // =========================================================================
  // 2. IBPS RRB Officer Scale I (PO)
  // =========================================================================
  {
    patternCode: "IBPS-RRB-PO-PRELIMS",
    examCode: "IBPS-RRB-PO",
    examName: "IBPS RRB Officer Scale I (PO)",
    stageName: "Prelims",
    totalQuestions: 80,
    totalMarks: 80,
    durationSeconds: 45 * 60,
    sectionalTimingEnabled: true,
    negativeMarkingRatio: 0.25,
    optionCount: 5,
    shortagePolicy: "FAIL_STRICT",
    repetitionPolicy: DEFAULT_REPETITION_POLICY,
    sourceNotes: "Official IBPS CRP RRB Officer Scale I Prelims pattern (80 Qs, 80 marks, 45 min, 0.25 negative marking). Topic distributions are historical-trend configurable estimates.",
    sections: [
      {
        sectionName: "Reasoning",
        subjectKey: "reasoning",
        questionCount: 40,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 25 * 60,
        sortOrder: 0,
        difficultyDistribution: { easy: 25, medium: 55, hard: 20 },
        topicDistributions: reasoningTopicsDefault(40, false),
      },
      {
        sectionName: "Quantitative Aptitude",
        subjectKey: "quant",
        questionCount: 40,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 1,
        difficultyDistribution: { easy: 20, medium: 60, hard: 20 },
        topicDistributions: quantTopicsPOPrelims(40),
      },
    ],
  },
  {
    patternCode: "IBPS-RRB-PO-MAINS",
    examCode: "IBPS-RRB-PO",
    examName: "IBPS RRB Officer Scale I (PO)",
    stageName: "Mains",
    totalQuestions: 200,
    totalMarks: 200,
    durationSeconds: 120 * 60,
    sectionalTimingEnabled: true,
    negativeMarkingRatio: 0.25,
    optionCount: 5,
    shortagePolicy: "FAIL_STRICT",
    repetitionPolicy: DEFAULT_REPETITION_POLICY,
    sourceNotes: "Official IBPS CRP RRB Officer Scale I Mains pattern (200 Qs, 200 marks, 120 min, 1/4th negative marking). Topic distributions are historical-trend configurable estimates.",
    sections: [
      {
        sectionName: "Reasoning",
        subjectKey: "reasoning",
        questionCount: 40,
        marksPerQuestion: 1.25,
        negativeMarks: 0.3125,
        durationSeconds: 30 * 60,
        sortOrder: 0,
        difficultyDistribution: { easy: 10, medium: 50, hard: 40 },
        topicDistributions: reasoningTopicsDefault(40, true),
      },
      {
        sectionName: "Computer Knowledge",
        subjectKey: "computer_knowledge",
        questionCount: 40,
        marksPerQuestion: 0.5,
        negativeMarks: 0.125,
        durationSeconds: 15 * 60,
        sortOrder: 1,
        difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
        topicDistributions: computerTopicsDefault(40),
      },
      {
        sectionName: "General Awareness",
        subjectKey: "general_awareness",
        questionCount: 40,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 15 * 60,
        sortOrder: 2,
        difficultyDistribution: { easy: 20, medium: 55, hard: 25 },
        topicDistributions: gaTopicsDefault(40),
      },
      {
        sectionName: "English Language",
        subjectKey: "english",
        questionCount: 40,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 30 * 60,
        sortOrder: 3,
        difficultyDistribution: { easy: 15, medium: 55, hard: 30 },
        topicDistributions: englishTopicsDefault(40),
      },
      {
        sectionName: "Quantitative Aptitude",
        subjectKey: "quant",
        questionCount: 40,
        marksPerQuestion: 1.25,
        negativeMarks: 0.3125,
        durationSeconds: 30 * 60,
        sortOrder: 4,
        difficultyDistribution: { easy: 10, medium: 45, hard: 45 },
        topicDistributions: quantTopicsMains(40, true),
      },
    ],
  },

  // =========================================================================
  // 3. IBPS Clerk / CSA (CRP CSA-XVI 2026)
  // =========================================================================
  {
    patternCode: "IBPS-CSA-PRELIMS",
    examCode: "IBPS-CSA",
    examName: "IBPS Clerk / CSA",
    stageName: "Prelims",
    totalQuestions: 100,
    totalMarks: 100,
    durationSeconds: 60 * 60,
    sectionalTimingEnabled: true,
    negativeMarkingRatio: 0.25,
    optionCount: 5,
    shortagePolicy: "FAIL_STRICT",
    repetitionPolicy: DEFAULT_REPETITION_POLICY,
    sourceNotes: "Official IBPS CRP CSA-XVI Prelims pattern (100 Qs, 100 marks, 60 min with 20 min sectional timers, 0.25 negative marking). Topic distributions are historical-trend configurable estimates.",
    sections: [
      {
        sectionName: "English Language",
        subjectKey: "english",
        questionCount: 30,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 0,
        difficultyDistribution: { easy: 40, medium: 45, hard: 15 },
        topicDistributions: englishTopicsDefault(30),
      },
      {
        sectionName: "Numerical Ability",
        subjectKey: "quant",
        questionCount: 35,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 1,
        difficultyDistribution: { easy: 40, medium: 50, hard: 10 },
        topicDistributions: quantTopicsClerkPrelims(35),
      },
      {
        sectionName: "Reasoning Ability",
        subjectKey: "reasoning",
        questionCount: 35,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 2,
        difficultyDistribution: { easy: 40, medium: 45, hard: 15 },
        topicDistributions: reasoningTopicsDefault(35, false),
      },
    ],
  },
  {
    patternCode: "IBPS-CSA-MAINS",
    examCode: "IBPS-CSA",
    examName: "IBPS Clerk / CSA",
    stageName: "Mains",
    totalQuestions: 160,
    totalMarks: 200,
    durationSeconds: 125 * 60,
    sectionalTimingEnabled: true,
    negativeMarkingRatio: 0.25,
    optionCount: 5,
    shortagePolicy: "FAIL_STRICT",
    repetitionPolicy: DEFAULT_REPETITION_POLICY,
    sourceNotes: "Revised 2026 IBPS CRP CSA-XVI Mains pattern (160 Qs, 200 marks, 125 min sectional timers, 1/4th negative marking). Topic distributions are historical-trend configurable estimates.",
    sections: [
      {
        sectionName: "General / Financial Awareness",
        subjectKey: "general_awareness",
        questionCount: 40,
        marksPerQuestion: 1.25,
        negativeMarks: 0.3125,
        durationSeconds: 20 * 60,
        sortOrder: 0,
        difficultyDistribution: { easy: 25, medium: 50, hard: 25 },
        topicDistributions: gaTopicsDefault(40),
      },
      {
        sectionName: "General English",
        subjectKey: "english",
        questionCount: 40,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 35 * 60,
        sortOrder: 1,
        difficultyDistribution: { easy: 20, medium: 55, hard: 25 },
        topicDistributions: englishTopicsDefault(40),
      },
      {
        sectionName: "Reasoning Ability",
        subjectKey: "reasoning",
        questionCount: 40,
        marksPerQuestion: 1.5,
        negativeMarks: 0.375,
        durationSeconds: 35 * 60,
        sortOrder: 2,
        difficultyDistribution: { easy: 15, medium: 50, hard: 35 },
        topicDistributions: reasoningTopicsDefault(40, true),
      },
      {
        sectionName: "Quantitative Aptitude",
        subjectKey: "quant",
        questionCount: 40,
        marksPerQuestion: 1.25,
        negativeMarks: 0.3125,
        durationSeconds: 35 * 60,
        sortOrder: 3,
        difficultyDistribution: { easy: 15, medium: 55, hard: 30 },
        topicDistributions: quantTopicsMains(40, false),
      },
    ],
  },

  // =========================================================================
  // 4. IBPS PO (2026 Pattern)
  // =========================================================================
  {
    patternCode: "IBPS-PO-PRELIMS",
    examCode: "IBPS-PO",
    examName: "IBPS PO",
    stageName: "Prelims",
    totalQuestions: 100,
    totalMarks: 100,
    durationSeconds: 60 * 60,
    sectionalTimingEnabled: true,
    negativeMarkingRatio: 0.25,
    optionCount: 5,
    shortagePolicy: "FAIL_STRICT",
    repetitionPolicy: DEFAULT_REPETITION_POLICY,
    sourceNotes: "Official IBPS PO Prelims pattern (100 Qs, 100 marks, 60 min with 20 min per section, 0.25 negative marking). Topic distributions are historical-trend configurable estimates.",
    sections: [
      {
        sectionName: "English Language",
        subjectKey: "english",
        questionCount: 30,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 0,
        difficultyDistribution: { easy: 20, medium: 55, hard: 25 },
        topicDistributions: englishTopicsDefault(30),
      },
      {
        sectionName: "Quantitative Aptitude",
        subjectKey: "quant",
        questionCount: 35,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 1,
        difficultyDistribution: { easy: 15, medium: 55, hard: 30 },
        topicDistributions: quantTopicsPOPrelims(35),
      },
      {
        sectionName: "Reasoning Ability",
        subjectKey: "reasoning",
        questionCount: 35,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 2,
        difficultyDistribution: { easy: 15, medium: 55, hard: 30 },
        topicDistributions: reasoningTopicsDefault(35, false),
      },
    ],
  },
  {
    patternCode: "IBPS-PO-MAINS",
    examCode: "IBPS-PO",
    examName: "IBPS PO",
    stageName: "Mains",
    totalQuestions: 170,
    totalMarks: 200,
    durationSeconds: 160 * 60,
    sectionalTimingEnabled: true,
    negativeMarkingRatio: 0.25,
    optionCount: 5,
    shortagePolicy: "FAIL_STRICT",
    repetitionPolicy: DEFAULT_REPETITION_POLICY,
    sourceNotes: "Revised 2026 IBPS PO Mains Objective pattern (170 Qs, 200 marks, 160 min sectional timers, 1/4th negative marking). Topic distributions are historical-trend configurable estimates.",
    sections: [
      {
        sectionName: "Reasoning",
        subjectKey: "reasoning",
        questionCount: 40,
        marksPerQuestion: 1.5,
        negativeMarks: 0.375,
        durationSeconds: 45 * 60,
        sortOrder: 0,
        difficultyDistribution: { easy: 5, medium: 40, hard: 55 },
        topicDistributions: reasoningTopicsDefault(40, true),
      },
      {
        sectionName: "General / Economy / Banking Awareness",
        subjectKey: "general_awareness",
        questionCount: 50,
        marksPerQuestion: 1.2,
        negativeMarks: 0.3,
        durationSeconds: 35 * 60,
        sortOrder: 1,
        difficultyDistribution: { easy: 15, medium: 50, hard: 35 },
        topicDistributions: gaTopicsDefault(50),
      },
      {
        sectionName: "English Language",
        subjectKey: "english",
        questionCount: 40,
        marksPerQuestion: 0.5,
        negativeMarks: 0.125,
        durationSeconds: 35 * 60,
        sortOrder: 2,
        difficultyDistribution: { easy: 10, medium: 45, hard: 45 },
        topicDistributions: englishTopicsDefault(40),
      },
      {
        sectionName: "Data Analysis & Interpretation",
        subjectKey: "quant",
        questionCount: 40,
        marksPerQuestion: 1.5,
        negativeMarks: 0.375,
        durationSeconds: 45 * 60,
        sortOrder: 3,
        difficultyDistribution: { easy: 5, medium: 35, hard: 60 },
        topicDistributions: quantTopicsMains(40, true),
      },
    ],
  },

  // =========================================================================
  // 5. SBI Clerk (Junior Associate)
  // =========================================================================
  {
    patternCode: "SBI-JA-PRELIMS",
    examCode: "SBI-JA",
    examName: "SBI Clerk",
    stageName: "Prelims",
    totalQuestions: 100,
    totalMarks: 100,
    durationSeconds: 60 * 60,
    sectionalTimingEnabled: true,
    negativeMarkingRatio: 0.25,
    optionCount: 5,
    shortagePolicy: "FAIL_STRICT",
    repetitionPolicy: DEFAULT_REPETITION_POLICY,
    sourceNotes: "Official SBI Junior Associate (Clerk) Prelims pattern (100 Qs, 100 marks, 60 min with 20 min sectional timers, 0.25 negative marking). Topic distributions are historical-trend configurable estimates.",
    sections: [
      {
        sectionName: "English Language",
        subjectKey: "english",
        questionCount: 30,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 0,
        difficultyDistribution: { easy: 35, medium: 50, hard: 15 },
        topicDistributions: englishTopicsDefault(30),
      },
      {
        sectionName: "Numerical Ability",
        subjectKey: "quant",
        questionCount: 35,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 1,
        difficultyDistribution: { easy: 35, medium: 50, hard: 15 },
        topicDistributions: quantTopicsClerkPrelims(35),
      },
      {
        sectionName: "Reasoning Ability",
        subjectKey: "reasoning",
        questionCount: 35,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 2,
        difficultyDistribution: { easy: 35, medium: 50, hard: 15 },
        topicDistributions: reasoningTopicsDefault(35, false),
      },
    ],
  },
  {
    patternCode: "SBI-JA-MAINS",
    examCode: "SBI-JA",
    examName: "SBI Clerk",
    stageName: "Mains",
    totalQuestions: 190,
    totalMarks: 200,
    durationSeconds: 160 * 60,
    sectionalTimingEnabled: true,
    negativeMarkingRatio: 0.25,
    optionCount: 5,
    shortagePolicy: "FAIL_STRICT",
    repetitionPolicy: DEFAULT_REPETITION_POLICY,
    sourceNotes: "Official SBI Junior Associate (Clerk) Mains pattern (190 Qs, 200 marks, 160 min sectional timers, 1/4th negative marking). Topic distributions are historical-trend configurable estimates.",
    sections: [
      {
        sectionName: "General / Financial Awareness",
        subjectKey: "general_awareness",
        questionCount: 50,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 35 * 60,
        sortOrder: 0,
        difficultyDistribution: { easy: 25, medium: 50, hard: 25 },
        topicDistributions: gaTopicsDefault(50),
      },
      {
        sectionName: "General English",
        subjectKey: "english",
        questionCount: 40,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 35 * 60,
        sortOrder: 1,
        difficultyDistribution: { easy: 20, medium: 55, hard: 25 },
        topicDistributions: englishTopicsDefault(40),
      },
      {
        sectionName: "Quantitative Aptitude",
        subjectKey: "quant",
        questionCount: 50,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 45 * 60,
        sortOrder: 2,
        difficultyDistribution: { easy: 15, medium: 55, hard: 30 },
        topicDistributions: quantTopicsMains(50, false),
      },
      {
        sectionName: "Reasoning Ability & Computer Aptitude",
        subjectKey: "reasoning",
        questionCount: 50,
        marksPerQuestion: 1.2,
        negativeMarks: 0.3,
        durationSeconds: 45 * 60,
        sortOrder: 3,
        difficultyDistribution: { easy: 15, medium: 50, hard: 35 },
        topicDistributions: reasoningTopicsDefault(50, true),
      },
    ],
  },

  // =========================================================================
  // 6. SBI PO (Revised 2025/2026 Pattern)
  // =========================================================================
  {
    patternCode: "SBI-PO-PRELIMS",
    examCode: "SBI-PO",
    examName: "SBI PO",
    stageName: "Prelims",
    totalQuestions: 100,
    totalMarks: 100,
    durationSeconds: 60 * 60,
    sectionalTimingEnabled: true,
    negativeMarkingRatio: 0.25,
    optionCount: 5,
    shortagePolicy: "FAIL_STRICT",
    repetitionPolicy: DEFAULT_REPETITION_POLICY,
    sourceNotes: "Revised 2025/2026 SBI PO Prelims pattern (English 40, Quant 30, Reasoning 30; 100 Qs, 100 marks, 60 min with 20 min sectional timers, 0.25 negative marking). Topic distributions are historical-trend configurable estimates.",
    sections: [
      {
        sectionName: "English Language",
        subjectKey: "english",
        questionCount: 40,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 0,
        difficultyDistribution: { easy: 15, medium: 50, hard: 35 },
        topicDistributions: englishTopicsDefault(40),
      },
      {
        sectionName: "Quantitative Aptitude",
        subjectKey: "quant",
        questionCount: 30,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 1,
        difficultyDistribution: { easy: 10, medium: 45, hard: 45 },
        topicDistributions: quantTopicsPOPrelims(30),
      },
      {
        sectionName: "Reasoning Ability",
        subjectKey: "reasoning",
        questionCount: 30,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 20 * 60,
        sortOrder: 2,
        difficultyDistribution: { easy: 10, medium: 45, hard: 45 },
        topicDistributions: reasoningTopicsDefault(30, false),
      },
    ],
  },
  {
    patternCode: "SBI-PO-MAINS",
    examCode: "SBI-PO",
    examName: "SBI PO",
    stageName: "Mains",
    totalQuestions: 170,
    totalMarks: 200,
    durationSeconds: 180 * 60,
    sectionalTimingEnabled: true,
    negativeMarkingRatio: 0.25,
    optionCount: 5,
    shortagePolicy: "FAIL_STRICT",
    repetitionPolicy: DEFAULT_REPETITION_POLICY,
    sourceNotes: "Revised 2025/2026 SBI PO Mains Objective pattern (170 Qs, 200 marks, 180 min sectional timers, 1/4th negative marking). Topic distributions are historical-trend configurable estimates.",
    sections: [
      {
        sectionName: "Reasoning & Computer Aptitude",
        subjectKey: "reasoning",
        questionCount: 40,
        marksPerQuestion: 1.5,
        negativeMarks: 0.375,
        durationSeconds: 50 * 60,
        sortOrder: 0,
        difficultyDistribution: { easy: 5, medium: 35, hard: 60 },
        topicDistributions: reasoningTopicsDefault(40, true),
      },
      {
        sectionName: "Data Analysis & Interpretation",
        subjectKey: "quant",
        questionCount: 30,
        marksPerQuestion: 2,
        negativeMarks: 0.5,
        durationSeconds: 45 * 60,
        sortOrder: 1,
        difficultyDistribution: { easy: 5, medium: 30, hard: 65 },
        topicDistributions: quantTopicsMains(30, true),
      },
      {
        sectionName: "General / Economy / Banking Awareness",
        subjectKey: "general_awareness",
        questionCount: 60,
        marksPerQuestion: 1,
        negativeMarks: 0.25,
        durationSeconds: 45 * 60,
        sortOrder: 2,
        difficultyDistribution: { easy: 15, medium: 50, hard: 35 },
        topicDistributions: gaTopicsDefault(60),
      },
      {
        sectionName: "English Language",
        subjectKey: "english",
        questionCount: 40,
        marksPerQuestion: 0.5,
        negativeMarks: 0.125,
        durationSeconds: 40 * 60,
        sortOrder: 3,
        difficultyDistribution: { easy: 10, medium: 40, hard: 50 },
        topicDistributions: englishTopicsDefault(40),
      },
    ],
  },
];

/**
 * Resolves a default catalog pattern for any examCode + stageName pair.
 */
export function findCatalogPattern(examCode = "", stageName = "Prelims") {
  const code = String(examCode || "").trim().toUpperCase();
  const stage = String(stageName || "Prelims").trim().toUpperCase();
  const isMains = stage.includes("MAIN") || stage.includes("PHASE II");
  const targetStage = isMains ? "MAINS" : "PRELIMS";

  // Direct exact match
  const exact = EXAM_PATTERN_CATALOG.find(
    (p) => p.examCode.toUpperCase() === code && p.stageName.toUpperCase() === targetStage
  );
  if (exact) return structuredClone(exact);

  // Alias match for Clerk / RRB naming variations
  let canonicalCode = code;
  if (code.includes("RRB") && (code.includes("CLERK") || code.includes("OA") || code.includes("ASSISTANT"))) {
    canonicalCode = "IBPS-RRB-OA";
  } else if (code.includes("RRB")) {
    canonicalCode = "IBPS-RRB-PO";
  } else if (code.includes("SBI") && (code.includes("CLERK") || code.includes("JA"))) {
    canonicalCode = "SBI-JA";
  } else if (code.includes("SBI")) {
    canonicalCode = "SBI-PO";
  } else if (code.includes("CLERK") || code.includes("CSA")) {
    canonicalCode = "IBPS-CSA";
  } else if (code.includes("IBPS") && code.includes("PO")) {
    canonicalCode = "IBPS-PO";
  }

  const matched = EXAM_PATTERN_CATALOG.find(
    (p) => p.examCode === canonicalCode && p.stageName.toUpperCase() === targetStage
  );
  return matched ? structuredClone(matched) : null;
}

/**
 * Infers canonical subjectKey from a free-text section name.
 */
export function inferSubjectKeyFromSectionName(sectionName = "") {
  const s = String(sectionName || "").toLowerCase();
  if (
    s.includes("quant") ||
    s.includes("numerical") ||
    s.includes("data analysis") ||
    s.includes("data interpretation") ||
    s.includes("math")
  ) {
    return "quant";
  }
  if (s.includes("reason") || s.includes("logic")) {
    return "reasoning";
  }
  if (s.includes("english") || s.includes("verbal")) {
    return "english";
  }
  if (s.includes("computer")) {
    return "computer_knowledge";
  }
  if (s.includes("awareness") || s.includes("current affairs") || s.includes("economy") || s.includes("banking")) {
    return "general_awareness";
  }
  return "general";
}
