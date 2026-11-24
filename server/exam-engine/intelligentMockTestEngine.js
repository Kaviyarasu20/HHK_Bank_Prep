/**
 * Centralized Intelligent Exam-Wise Mock Test Engine
 *
 * Orchestrates the complete 12-step mock test creation pipeline:
 *  1. Read selected exam pattern (DB version, catalog default, or admin custom override)
 *  2. Identify sections & canonical subject keys
 *  3. Run Exam-Wise Topic Distribution Engine per section
 *  4. Check Subject Generator Registry status & availability
 *  5. Request questions from active subject generators (never faking unavailable subjects)
 *  6. Apply explicit shortage policy if a generator is unavailable or short
 *     ('FAIL_STRICT' | 'USE_BANK_FALLBACK' | 'ALLOW_PARTIAL_DRAFT')
 *  7. Validate every candidate via QuestionQualityValidator (strict 5-option & math/logic checks)
 *  8. Enforce strict within-test deduplication + cross-test repetition minimization
 *  9. Verify topic distribution & difficulty distribution compliance
 * 10. Arrange questions cleanly within each section (keeping DI/passage sets coherent, shuffling standalones)
 * 11. Emit a transparent generationReport (exact counts, generator statuses, shortages, patternFulfilled flag)
 * 12. Never claim exact pattern fulfillment if any section/topic fell short.
 */

import {
  findCatalogPattern,
  inferSubjectKeyFromSectionName,
  DEFAULT_REPETITION_POLICY,
} from "./examPatternCatalog.js";
import {
  subjectGeneratorRegistry,
  computeQuestionFingerprint,
} from "./subjectGeneratorRegistry.js";
import { validateMockTestQuestion } from "./questionQualityValidator.js";
import {
  buildSectionDistributionPlan,
  createSeededRng,
} from "./topicDistributionEngine.js";

/**
 * Preview distribution & generator readiness without generating questions.
 */
export function previewExamWiseDistribution({
  pattern,
  examCode,
  stageName = "Prelims",
  targetSectionNames = null,
  seed = Date.now(),
  varyWithinRanges = true,
  recentSubtopicCounts = {},
  registry = subjectGeneratorRegistry,
} = {}) {
  const resolvedPattern = pattern || findCatalogPattern(examCode, stageName);
  if (!resolvedPattern) {
    throw Object.assign(
      new Error(`No exam pattern found for exam "${examCode}" stage "${stageName}".`),
      { status: 404 }
    );
  }

  const sectionFilter =
    Array.isArray(targetSectionNames) && targetSectionNames.length
      ? new Set(targetSectionNames.map((n) => String(n).toLowerCase()))
      : null;

  const activeSections = (resolvedPattern.sections || [])
    .filter((s) => s.isEnabled !== false)
    .filter((s) => !sectionFilter || sectionFilter.has(String(s.sectionName || "").toLowerCase()));

  const sectionPreviews = activeSections.map((sec, idx) => {
    const subjectKey = sec.subjectKey || inferSubjectKeyFromSectionName(sec.sectionName);
    const generator = registry.get(subjectKey);
    const generatorStatus = generator ? generator.status : "UNAVAILABLE";
    const plan = buildSectionDistributionPlan(
      { ...sec, subjectKey },
      {
        seed: Number(seed) + idx * 997,
        varyWithinRanges,
        recentSubtopicCounts,
      }
    );

    const unsupportedTopics =
      generatorStatus === "ACTIVE"
        ? plan.topicPlan.filter((tp) => !generator.supportsTopic(tp.topic)).map((tp) => tp.topic)
        : plan.topicPlan.map((tp) => tp.topic);

    return {
      sectionName: sec.sectionName,
      sectionId: sec.sectionId || null,
      subjectKey,
      questionCount: Number(sec.questionCount || 0),
      marksPerQuestion: Number(sec.marksPerQuestion ?? 1),
      negativeMarks: Number(sec.negativeMarks ?? 0.25),
      durationSeconds: sec.durationSeconds ?? null,
      generatorStatus,
      generatorDisplayName: generator?.displayName || subjectKey,
      generatorVersion: generator?.version || "0.0.0",
      readyForAutoGeneration: generatorStatus === "ACTIVE" && unsupportedTopics.length === 0,
      unsupportedTopics,
      difficultyTargets: plan.difficultyTargets,
      topicPlan: plan.topicPlan,
      notes: plan.notes,
    };
  });

  const totalQuestions = sectionPreviews.reduce((s, sec) => s + sec.questionCount, 0);
  const autoGeneratableQuestions = sectionPreviews
    .filter((sec) => sec.readyForAutoGeneration)
    .reduce((s, sec) => s + sec.questionCount, 0);

  return {
    examCode: resolvedPattern.examCode,
    examName: resolvedPattern.examName,
    stageName: resolvedPattern.stageName,
    totalQuestions,
    autoGeneratableQuestions,
    durationSeconds: resolvedPattern.durationSeconds,
    sectionalTimingEnabled: Boolean(resolvedPattern.sectionalTimingEnabled),
    negativeMarkingRatio: Number(resolvedPattern.negativeMarkingRatio ?? 0.25),
    optionCount: Number(resolvedPattern.optionCount ?? 5),
    shortagePolicy: resolvedPattern.shortagePolicy || "FAIL_STRICT",
    sourceNotes: resolvedPattern.sourceNotes || "",
    allSectionsReady: sectionPreviews.length > 0 && sectionPreviews.every((s) => s.readyForAutoGeneration),
    sections: sectionPreviews,
    generatorStatuses: registry.listStatuses(),
  };
}

/**
 * Arranges questions inside a section:
 * Keeps coherent passage/DI sets grouped together while shuffling standalone question order
 * so consecutive mock tests never share identical question sequences.
 */
function arrangeSectionQuestions(questions, rng) {
  const diOrPassageGroups = new Map();
  const standalones = [];

  for (const q of questions) {
    const groupKey = q.passageGroupKey || q.passage_group_id || (q.diSetId ? `di:${q.diSetId}` : null);
    if (groupKey) {
      if (!diOrPassageGroups.has(groupKey)) diOrPassageGroups.set(groupKey, []);
      diOrPassageGroups.get(groupKey).push(q);
    } else {
      standalones.push(q);
    }
  }

  // Shuffle standalone questions
  for (let i = standalones.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [standalones[i], standalones[j]] = [standalones[j], standalones[i]];
  }

  // Combine groups + standalones into blocks and shuffle block order
  const blocks = [...Array.from(diOrPassageGroups.values()), ...standalones.map((q) => [q])];
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  }

  return blocks.flat().map((q, idx) => ({ ...q, sectionSortOrder: idx }));
}

/**
 * Generates an intelligent, validated, deduplicated Exam-Wise Mock Test.
 *
 * @param {object} params
 * @param {object} [params.pattern] - Full exam pattern object (overrides catalog lookup)
 * @param {string} [params.examCode] - e.g., 'IBPS-RRB-OA', 'IBPS-PO', 'SBI-PO'
 * @param {string} [params.stageName] - 'Prelims' | 'Mains'
 * @param {string[]} [params.targetSectionNames] - Optional subset of sections (e.g. ['Numerical Ability'])
 * @param {string} [params.shortagePolicy] - 'FAIL_STRICT' | 'USE_BANK_FALLBACK' | 'ALLOW_PARTIAL_DRAFT'
 * @param {string[]} [params.excludeFingerprints] - Fingerprints from recent tests to minimize repetition
 * @param {object} [params.recentSubtopicCounts] - Recent arithmetic subtopic usage map for rotation
 * @param {function} [params.bankFallbackProvider] - Optional async ({ sectionName, subjectKey, topic, difficulty, count, excludeFingerprints }) => Question[]
 * @param {number} [params.seed] - PRNG seed for reproducibility / variation
 * @param {object} [params.registry] - SubjectGeneratorRegistry instance (defaults to global singleton)
 */
export async function generateIntelligentExamWiseMockTest({
  pattern = null,
  examCode = "",
  stageName = "Prelims",
  targetSectionNames = null,
  shortagePolicy = null,
  repetitionPolicy = DEFAULT_REPETITION_POLICY,
  excludeFingerprints = [],
  recentSubtopicCounts = {},
  bankFallbackProvider = null,
  seed = Date.now(),
  varyWithinRanges = true,
  registry = subjectGeneratorRegistry,
} = {}) {
  const preview = previewExamWiseDistribution({
    pattern,
    examCode,
    stageName,
    targetSectionNames,
    seed,
    varyWithinRanges,
    recentSubtopicCounts,
    registry,
  });

  const effectiveShortagePolicy = shortagePolicy || preview.shortagePolicy || "FAIL_STRICT";
  const optionCount = Number(preview.optionCount ?? 5);
  const rng = createSeededRng(Number(seed) + 4099);

  // Within-test strict deduplication set + recent-test avoidance set
  const withinTestFingerprints = new Set();
  const recentAvoidSet = new Set(excludeFingerprints || []);

  const sectionResults = [];
  const allQuestions = [];
  const shortages = [];
  const rejectedStats = { totalRejected: 0, reasons: {} };

  for (const secPreview of preview.sections) {
    const subjectKey = secPreview.subjectKey;
    const generator = registry.get(subjectKey);
    const sectionQuestions = [];
    const topicSummary = [];
    const actualDifficultyCounts = { easy: 0, medium: 0, hard: 0 };

    if (!generator || generator.status !== "ACTIVE") {
      // Generator unavailable — try explicit bank fallback ONLY if configured
      let fallbackCount = 0;
      if (effectiveShortagePolicy === "USE_BANK_FALLBACK" && typeof bankFallbackProvider === "function") {
        const bankCandidates = await bankFallbackProvider({
          sectionName: secPreview.sectionName,
          sectionId: secPreview.sectionId,
          subjectKey,
          count: secPreview.questionCount,
          excludeFingerprints: Array.from(new Set([...withinTestFingerprints, ...recentAvoidSet])),
        });
        for (const cand of bankCandidates || []) {
          if (sectionQuestions.length >= secPreview.questionCount) break;
          const validation = validateMockTestQuestion(cand, {
            requiredOptionCount: optionCount,
            requireExplanation: false,
            subjectKey,
          });
          if (!validation.valid) {
            rejectedStats.totalRejected++;
            continue;
          }
          const fp = computeQuestionFingerprint(cand);
          if (withinTestFingerprints.has(fp)) continue;
          withinTestFingerprints.add(fp);
          const diff = String(cand.difficulty || "medium").toLowerCase();
          actualDifficultyCounts[diff] = (actualDifficultyCounts[diff] || 0) + 1;
          sectionQuestions.push({
            ...cand,
            options: validation.normalizedOptions,
            sectionName: secPreview.sectionName,
            sectionId: secPreview.sectionId,
            subjectKey,
            marks: secPreview.marksPerQuestion,
            negativeMarks: secPreview.negativeMarks,
            fingerprint: fp,
            sourceType: "BANK_FALLBACK",
          });
          fallbackCount++;
        }
      }

      const missing = Math.max(0, secPreview.questionCount - sectionQuestions.length);
      if (missing > 0) {
        shortages.push({
          sectionName: secPreview.sectionName,
          subjectKey,
          topic: null,
          required: secPreview.questionCount,
          generated: sectionQuestions.length,
          missing,
          reason: `${secPreview.generatorDisplayName} generator status is ${secPreview.generatorStatus} (not integrated yet).`,
        });
      }

      const arranged = arrangeSectionQuestions(sectionQuestions, rng);
      allQuestions.push(...arranged);
      sectionResults.push({
        sectionName: secPreview.sectionName,
        sectionId: secPreview.sectionId,
        subjectKey,
        generatorStatus: secPreview.generatorStatus,
        requiredQuestions: secPreview.questionCount,
        generatedQuestions: arranged.length,
        bankFallbackQuestions: fallbackCount,
        missingQuestions: missing,
        marksPerQuestion: secPreview.marksPerQuestion,
        negativeMarks: secPreview.negativeMarks,
        durationSeconds: secPreview.durationSeconds,
        fulfilled: arranged.length === secPreview.questionCount,
        difficultyTargets: secPreview.difficultyTargets,
        actualDifficultyCounts,
        topicSummary,
        questions: arranged,
      });
      continue;
    }

    // Active Subject Generator path: iterate through each topic slot & difficulty split
    for (const slot of secPreview.topicPlan) {
      let slotGenerated = 0;
      const diffEntries = Object.entries(slot.difficultySplit).filter(([, c]) => c > 0);

      for (const [difficulty, neededCount] of diffEntries) {
        let collectedForDiff = 0;
        const maxAttempts = 5;

        for (let attempt = 0; attempt < maxAttempts && collectedForDiff < neededCount; attempt++) {
          const toRequest = neededCount - collectedForDiff;
          // On final retries, relax recentAvoidSet (but NEVER relax withinTestFingerprints)
          const excludeList =
            attempt < 3
              ? Array.from(new Set([...withinTestFingerprints, ...recentAvoidSet]))
              : Array.from(withinTestFingerprints);

          const batchResult = await generator.generateQuestions({
            subject: subjectKey,
            topic: slot.topic,
            subtopic: "",
            difficulty,
            count: toRequest,
            examCode: preview.examCode,
            stageName: preview.stageName,
            optionCount,
            excludeFingerprints: excludeList,
          });

          const candidates = batchResult?.questions || [];
          for (const rawQ of candidates) {
            if (collectedForDiff >= neededCount) break;

            const validation = validateMockTestQuestion(rawQ, {
              requiredOptionCount: optionCount,
              requireExplanation: true,
              subjectKey,
            });
            if (!validation.valid) {
              rejectedStats.totalRejected++;
              for (const err of validation.errors) {
                rejectedStats.reasons[err] = (rejectedStats.reasons[err] || 0) + 1;
              }
              continue;
            }

            const fp = computeQuestionFingerprint(rawQ);
            if (withinTestFingerprints.has(fp)) {
              rejectedStats.totalRejected++;
              rejectedStats.reasons["Duplicate within same test"] =
                (rejectedStats.reasons["Duplicate within same test"] || 0) + 1;
              continue;
            }

            withinTestFingerprints.add(fp);
            collectedForDiff++;
            slotGenerated++;

            const normalizedDiff = ["easy", "medium", "hard"].includes(
              String(rawQ.difficulty || "").toLowerCase()
            )
              ? String(rawQ.difficulty).toLowerCase()
              : difficulty;
            actualDifficultyCounts[normalizedDiff] =
              (actualDifficultyCounts[normalizedDiff] || 0) + 1;

            sectionQuestions.push({
              ...rawQ,
              options: validation.normalizedOptions,
              topicName: rawQ.topicName || slot.topic,
              parentTopicGroup: slot.parentGroup,
              difficulty: normalizedDiff,
              sectionName: secPreview.sectionName,
              sectionId: secPreview.sectionId,
              subjectKey,
              marks: secPreview.marksPerQuestion,
              negativeMarks: secPreview.negativeMarks,
              fingerprint: fp,
              sourceType: "SUBJECT_GENERATOR",
            });
          }
        }

        // Optional explicit bank fallback for topic-level shortage
        const diffMissing = neededCount - collectedForDiff;
        if (
          diffMissing > 0 &&
          effectiveShortagePolicy === "USE_BANK_FALLBACK" &&
          typeof bankFallbackProvider === "function"
        ) {
          const bankCandidates = await bankFallbackProvider({
            sectionName: secPreview.sectionName,
            sectionId: secPreview.sectionId,
            subjectKey,
            topic: slot.topic,
            difficulty,
            count: diffMissing,
            excludeFingerprints: Array.from(withinTestFingerprints),
          });
          for (const cand of bankCandidates || []) {
            if (collectedForDiff >= neededCount) break;
            const validation = validateMockTestQuestion(cand, {
              requiredOptionCount: optionCount,
              requireExplanation: false,
              subjectKey,
            });
            if (!validation.valid) continue;
            const fp = computeQuestionFingerprint(cand);
            if (withinTestFingerprints.has(fp)) continue;
            withinTestFingerprints.add(fp);
            collectedForDiff++;
            slotGenerated++;
            actualDifficultyCounts[difficulty] = (actualDifficultyCounts[difficulty] || 0) + 1;
            sectionQuestions.push({
              ...cand,
              options: validation.normalizedOptions,
              sectionName: secPreview.sectionName,
              sectionId: secPreview.sectionId,
              subjectKey,
              marks: secPreview.marksPerQuestion,
              negativeMarks: secPreview.negativeMarks,
              fingerprint: fp,
              sourceType: "BANK_FALLBACK",
            });
          }
        }

        if (collectedForDiff < neededCount) {
          shortages.push({
            sectionName: secPreview.sectionName,
            subjectKey,
            topic: slot.topic,
            difficulty,
            required: neededCount,
            generated: collectedForDiff,
            missing: neededCount - collectedForDiff,
            reason: `Generator "${generator.displayName}" could only produce ${collectedForDiff}/${neededCount} valid unique ${difficulty} questions for "${slot.topic}".`,
          });
        }
      }

      topicSummary.push({
        topic: slot.topic,
        parentGroup: slot.parentGroup,
        requested: slot.count,
        generated: slotGenerated,
        fulfilled: slotGenerated === slot.count,
      });
    }

    const arranged = arrangeSectionQuestions(sectionQuestions, rng);
    allQuestions.push(...arranged);
    sectionResults.push({
      sectionName: secPreview.sectionName,
      sectionId: secPreview.sectionId,
      subjectKey,
      generatorStatus: secPreview.generatorStatus,
      requiredQuestions: secPreview.questionCount,
      generatedQuestions: arranged.length,
      missingQuestions: Math.max(0, secPreview.questionCount - arranged.length),
      marksPerQuestion: secPreview.marksPerQuestion,
      negativeMarks: secPreview.negativeMarks,
      durationSeconds: secPreview.durationSeconds,
      fulfilled: arranged.length === secPreview.questionCount,
      difficultyTargets: secPreview.difficultyTargets,
      actualDifficultyCounts,
      topicSummary,
      questions: arranged,
    });
  }

  const totalRequired = preview.totalQuestions;
  const totalGenerated = allQuestions.length;
  const patternFulfilled =
    totalGenerated === totalRequired &&
    shortages.length === 0 &&
    sectionResults.every((s) => s.fulfilled);

  const generationReport = {
    examCode: preview.examCode,
    examName: preview.examName,
    stageName: preview.stageName,
    totalRequired,
    totalGenerated,
    totalMissing: Math.max(0, totalRequired - totalGenerated),
    patternFulfilled,
    shortagePolicy: effectiveShortagePolicy,
    repetitionPolicy,
    durationSeconds: preview.durationSeconds,
    sectionalTimingEnabled: preview.sectionalTimingEnabled,
    negativeMarkingRatio: preview.negativeMarkingRatio,
    optionCount,
    rejectedStats,
    shortages,
    generatorStatuses: preview.generatorStatuses,
    sections: sectionResults.map(({ questions: _q, ...meta }) => meta),
    generatedAt: new Date().toISOString(),
  };

  // Enforce strict shortage policy: never pretend pattern is fulfilled when it is not
  if (!patternFulfilled && effectiveShortagePolicy === "FAIL_STRICT") {
    const err = Object.assign(
      new Error(
        `Mock test generation blocked by FAIL_STRICT policy: generated ${totalGenerated}/${totalRequired} questions. ${shortages.length} shortage(s) detected.`
      ),
      {
        status: 409,
        code: "PATTERN_SHORTAGE",
        generationReport,
      }
    );
    throw err;
  }

  return {
    patternFulfilled,
    mockTest: {
      examCode: preview.examCode,
      examName: preview.examName,
      stageName: preview.stageName,
      durationSeconds: preview.durationSeconds,
      sectionalTimingEnabled: preview.sectionalTimingEnabled,
      negativeMarkingRatio: preview.negativeMarkingRatio,
      optionCount,
      totalQuestions: totalGenerated,
      sections: sectionResults,
      questions: allQuestions,
    },
    generationReport,
  };
}
