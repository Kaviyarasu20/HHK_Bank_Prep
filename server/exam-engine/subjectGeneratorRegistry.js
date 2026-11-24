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
 * Future generators (Reasoning, English, GA, Computer Knowledge) can be plugged in
 * via registerSubjectGenerator() without changing the core exam-wise engine.
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
 * Standard adapter wrapping the existing functional Quantitative Aptitude Question Engine.
 */
function createQuantitativeAptitudeGenerator() {
  const supportedTopics = [...(SUPPORTED_AUTO_TOPICS.quant || [])];

  return {
    subjectKey: "quant",
    displayName: "Quantitative Aptitude",
    status: "ACTIVE",
    version: "2.0.0",
    supportedTopics,
    notes: "Backed by HHK Modular Quantitative Aptitude Question Engine (20 verified topic modules).",

    supportsTopic(topicName = "") {
      return isEngineSupportedTopic(topicName);
    },

    getAvailableCount({ topic = "" } = {}) {
      if (!topic) return Number.POSITIVE_INFINITY;
      return isEngineSupportedTopic(topic) ? Number.POSITIVE_INFINITY : 0;
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
      if (!isEngineSupportedTopic(topic)) {
        return {
          questions: [],
          metadata: {
            subjectKey: "quant",
            topic,
            requested: count,
            generated: 0,
            error: `Topic "${topic}" is not supported by the Quantitative Aptitude generator.`,
          },
        };
      }

      const excludeSet = new Set(excludeFingerprints);
      const collected = [];
      const maxRounds = 4;
      let remaining = count;

      for (let round = 0; round < maxRounds && remaining > 0; round++) {
        // Request a small buffer when filtering duplicates
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
            subjectKey: "quant",
            topicName: item.topicName || topic,
            subtopicName: item.subtopicName || subtopic || "",
            difficulty: String(item.difficulty || difficulty || "medium").toLowerCase(),
            fingerprint,
            generatorVersion: "2.0.0",
            generatorSource: "HHK_QUANT_ENGINE_V2",
          });
        }
        remaining = count - collected.length;
      }

      return {
        questions: collected,
        metadata: {
          subjectKey: "quant",
          topic,
          subtopic,
          difficulty,
          requested: count,
          generated: collected.length,
          engine: "HHK_QUANT_ENGINE_V2",
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
    notes: `${displayName} generator is not yet implemented. Register a functional adapter via registerSubjectGenerator() once built.`,
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
    // Register functional Quantitative Aptitude generator
    this.register(createQuantitativeAptitudeGenerator());
    // Register honest UNAVAILABLE placeholders for future subjects (zero fake generation)
    this.register(
      createUnavailableSubjectDescriptor("reasoning", "Reasoning Ability", [
        "Puzzles",
        "Seating Arrangement",
        "Syllogism",
        "Inequality",
        "Coding-Decoding",
        "Blood Relations",
        "Direction & Distance",
      ])
    );
    this.register(
      createUnavailableSubjectDescriptor("english", "English Language", [
        "Reading Comprehension",
        "Cloze Test",
        "Error Detection",
        "Para Jumbles",
        "Fill in the Blanks",
      ])
    );
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

  /**
   * Validates and registers a subject generator adapter dynamically.
   * Future generators (Reasoning, English, etc.) plug in here without changing the exam engine.
   */
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
