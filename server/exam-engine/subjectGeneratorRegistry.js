/**
 * Centralized Subject Generator Registry
 *
 * Decouples the Exam-Wise Mock Test Engine from individual subject generator
 * implementations. Every subject generator adheres to the standard interface:
 *   - subjectKey: string ('quant', 'reasoning', 'english', 'general_awareness', 'computer_knowledge', ...)
 *   - displayName: string
 *   - status: 'ACTIVE' | 'UNAVAILABLE' | 'PLANNED'
 *   - version: string
 *   - supportedTopics: string[]
 *   - supportsTopic(topicName): boolean
 *   - getAvailableCount({ topic, subtopic, difficulty }): number (Infinity for procedural generators)
 *   - generateQuestions({ subject, topic, subtopic, difficulty, count, examCode, stageName, optionCount, excludeFingerprints }): { questions, metadata }
 *
 * IMPORTANT:
 * Only real, functional generators are registered as ACTIVE.
 * Quantitative Aptitude (20 topics), Reasoning Ability (19 topics), and
 * English Language (12 modular topics) are all ACTIVE via HHK Question Engine V2.
 */

import crypto from "node:crypto";
import { generateFromQuestionEngine } from "../question-engine/core/engineRouter.js";
import { SUPPORTED_AUTO_TOPICS, isEngineSupportedTopic } from "../services/questionGenerator.js";

function ensureBankingOptionCount(item, targetOptionCount = 5) {
  if (!Array.isArray(item?.options) || !targetOptionCount) return item;
  const opts = item.options.map((o, idx) =>
    typeof o === "object" && o !== null
      ? { key: String(o.key || String.fromCharCode(65 + idx)).toUpperCase(), text: String(o.text ?? "").trim() }
      : { key: String.fromCharCode(65 + idx), text: String(o ?? "").trim() }
  );
  if (opts.length === targetOptionCount) return { ...item, options: opts };
  if (opts.length === 4 && targetOptionCount === 5) {
    const existingLower = new Set(opts.map((o) => o.text.toLowerCase()));
    const fifthText = existingLower.has("none of these")
      ? "Cannot be determined"
      : "None of these";
    if (!existingLower.has(fifthText.toLowerCase())) {
      opts.push({ key: "E", text: fifthText });
    }
  }
  return { ...item, options: opts };
}

function computeQuestionFingerprint(q) {
  if (q?.fingerprint) return String(q.fingerprint);
  const normText = String(q?.questionText || q?.question_text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const normAns = String(q?.correctAnswer || q?.correct_answer || "").trim().toUpperCase();
  const opts = Array.isArray(q?.options)
    ? q.options.map((o) => (typeof o === "object" ? o.text : String(o))).join("|")
    : "";
  return crypto.createHash("sha256").update(`${normText}::${opts}::${normAns}`).digest("hex").slice(0, 24);
}

/**
 * Shared adapter factory wrapping HHK Modular Question Engine V2 subjects
 * (Quantitative Aptitude, Reasoning Ability, and English Language).
 */
function createModularEngineSubjectGenerator({
  subjectKey,
  displayName,
  supportedTopics,
  version = "2.0.0",
  engineTag,
  notes,
}) {
  const normalizedSupported = new Set(
    (supportedTopics || []).map((t) => String(t).trim().toLowerCase())
  );

  const supportsTopicLocal = (topicName = "") => {
    const clean = String(topicName || "").trim().toLowerCase();
    if (!clean) return false;
    if (normalizedSupported.has(clean)) return true;
    // Also check canonical engine matchers for aliases (e.g. "Puzzles & Seating Arrangements", "Direction and Distance")
    if (subjectKey === "reasoning") {
      return isEngineSupportedTopic(clean) && !SUPPORTED_AUTO_TOPICS.quant.some((q) => q.toLowerCase() === clean);
    }
    if (subjectKey === "english") {
      // Reading Comprehension uses the separate Gemini AI service, not procedural engineRouter
      if (clean.includes("reading comprehension")) return false;
      return isEngineSupportedTopic(clean);
    }
    return isEngineSupportedTopic(clean);
  };

  return {
    subjectKey,
    displayName,
    status: "ACTIVE",
    version,
    supportedTopics: [...supportedTopics],
    notes,

    supportsTopic(topicName = "") {
      return supportsTopicLocal(topicName);
    },

    getAvailableCount({ topic = "" } = {}) {
      if (!topic) return Number.POSITIVE_INFINITY;
      return supportsTopicLocal(topic) ? Number.POSITIVE_INFINITY : 0;
    },

    generateQuestions({
      topic,
      subtopic = "",
      difficulty = "medium",
      count = 5,
      examCode = "IBPS-PO",
      stageName = "Prelims",
      optionCount = 5,
      excludeFingerprints = [],
    }) {
      if (!supportsTopicLocal(topic)) {
        return {
          questions: [],
          metadata: {
            subjectKey,
            topic,
            requested: count,
            generated: 0,
            error: `Topic "${topic}" is not supported by the ${displayName} procedural generator.`,
          },
        };
      }

      const excludeSet = new Set(excludeFingerprints);
      const collected = [];
      const maxRounds = 4;
      let remaining = count;

      for (let round = 0; round < maxRounds && remaining > 0; round++) {
        const batchSize = round === 0 ? remaining : Math.min(remaining * 2, remaining + 6);
        const rawBatch = generateFromQuestionEngine({
          examCode,
          stageName,
          topicName: topic,
          subtopicName: subtopic,
          difficulty,
          count: batchSize,
          optionCount,
        });

        for (const rawItem of rawBatch) {
          const item = ensureBankingOptionCount(rawItem, optionCount);
          if (collected.length >= count) break;
          const fingerprint = computeQuestionFingerprint(item);
          if (excludeSet.has(fingerprint)) continue;
          excludeSet.add(fingerprint);
          collected.push({
            ...item,
            subjectKey,
            topicName: item.topicName || topic,
            subtopicName: item.subtopicName || subtopic || "",
            difficulty: String(item.difficulty || difficulty || "medium").toLowerCase(),
            fingerprint,
            generatorVersion: version,
            generatorSource: engineTag,
          });
        }
        remaining = count - collected.length;
      }

      return {
        questions: collected,
        metadata: {
          subjectKey,
          topic,
          subtopic,
          difficulty,
          requested: count,
          generated: collected.length,
          engine: engineTag,
        },
      };
    },
  };
}

/**
 * Honest unavailable descriptor for planned future subject generators.
 * Never fakes question generation.
 */
function createUnavailableSubjectDescriptor(subjectKey, displayName, plannedTopics = []) {
  return {
    subjectKey,
    displayName,
    status: "UNAVAILABLE",
    version: "0.0.0",
    supportedTopics: [],
    plannedTopics,
    notes: `${displayName} procedural generator is not yet built. Use Question Bank selection for these topics.`,
    supportsTopic() {
      return false;
    },
    getAvailableCount() {
      return 0;
    },
    generateQuestions({ topic, count = 0 }) {
      return {
        questions: [],
        metadata: {
          subjectKey,
          topic,
          requested: count,
          generated: 0,
          status: "UNAVAILABLE",
          error: `${displayName} generator is not integrated yet.`,
        },
      };
    },
  };
}

class SubjectGeneratorRegistry {
  constructor() {
    this._registry = new Map();
    this.resetDefaults();
  }

  resetDefaults() {
    this._registry.clear();

    // 1. Quantitative Aptitude — ACTIVE
    this.register(
      createModularEngineSubjectGenerator({
        subjectKey: "quant",
        displayName: "Quantitative Aptitude",
        supportedTopics: SUPPORTED_AUTO_TOPICS.quant || [],
        version: "2.0.0",
        engineTag: "HHK_QUANT_ENGINE_V2",
        notes: "Backed by HHK Modular Quantitative Aptitude Question Engine.",
      })
    );

    // 2. Reasoning Ability — ACTIVE (all 19 verified banking reasoning topics)
    this.register(
      createModularEngineSubjectGenerator({
        subjectKey: "reasoning",
        displayName: "Reasoning Ability",
        supportedTopics: SUPPORTED_AUTO_TOPICS.reasoning || [],
        version: "2.0.0",
        engineTag: "HHK_REASONING_ENGINE_V2",
        notes: "Backed by HHK Modular Reasoning Ability Question Engine (19 verified topics).",
      })
    );

    // 3. English Language — ACTIVE (all 12 modular English topics; RC handled via Gemini AI)
    this.register(
      createModularEngineSubjectGenerator({
        subjectKey: "english",
        displayName: "English Language",
        supportedTopics: SUPPORTED_AUTO_TOPICS.english || [],
        version: "2.0.0",
        engineTag: "HHK_ENGLISH_ENGINE_V2",
        notes: "Backed by HHK Modular English Language Question Engine (12 verified topics; Reading Comprehension via Gemini AI).",
      })
    );

    // 4. General Awareness & Computer Knowledge — Question Bank backed until procedural engines are built
    this.register(
      createUnavailableSubjectDescriptor("general_awareness", "General Awareness", [
        "Current Affairs",
        "Banking Current Affairs",
        "RBI Updates",
        "Government Schemes",
      ])
    );
    this.register(
      createUnavailableSubjectDescriptor("computer_knowledge", "Computer Knowledge", [
        "Computer Fundamentals",
        "MS Office",
        "Networking & Internet",
        "DBMS & Security",
      ])
    );
  }

  register(adapter) {
    if (!adapter || typeof adapter !== "object") {
      throw new Error("Subject generator adapter must be an object.");
    }
    const key = String(adapter.subjectKey || "").trim().toLowerCase();
    if (!key) {
      throw new Error("Subject generator adapter requires a non-empty subjectKey.");
    }
    if (typeof adapter.generateQuestions !== "function") {
      throw new Error(`Generator "${key}" must implement generateQuestions().`);
    }
    if (typeof adapter.getAvailableCount !== "function") {
      throw new Error(`Generator "${key}" must implement getAvailableCount().`);
    }
    if (typeof adapter.supportsTopic !== "function") {
      throw new Error(`Generator "${key}" must implement supportsTopic().`);
    }

    this._registry.set(key, {
      ...adapter,
      subjectKey: key,
      status: adapter.status || "ACTIVE",
      version: adapter.version || "1.0.0",
      supportedTopics: Array.isArray(adapter.supportedTopics) ? adapter.supportedTopics : [],
    });
    return this._registry.get(key);
  }

  unregister(subjectKey) {
    return this._registry.delete(String(subjectKey || "").trim().toLowerCase());
  }

  get(subjectKey) {
    return this._registry.get(String(subjectKey || "").trim().toLowerCase()) || null;
  }

  isAvailable(subjectKey) {
    const gen = this.get(subjectKey);
    return Boolean(gen && gen.status === "ACTIVE");
  }

  listStatuses() {
    return Array.from(this._registry.values()).map((gen) => ({
      subjectKey: gen.subjectKey,
      displayName: gen.displayName,
      status: gen.status,
      version: gen.version,
      supportedTopicCount: gen.supportedTopics.length,
      supportedTopics: gen.supportedTopics,
      plannedTopics: gen.plannedTopics || [],
      notes: gen.notes || "",
    }));
  }
}

export const subjectGeneratorRegistry = new SubjectGeneratorRegistry();

export function registerSubjectGenerator(adapter) {
  return subjectGeneratorRegistry.register(adapter);
}

export { SubjectGeneratorRegistry, computeQuestionFingerprint };
