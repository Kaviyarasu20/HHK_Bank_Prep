/**
 * Group-Aware Question Sequencer for Banking Exam Mock Tests
 *
 * Guarantees that all questions belonging to the same group-based set
 * (Data Interpretation, Seating Arrangement, Floor/Box/Month/Date/Linear/Circular Puzzles,
 * Reading Comprehension, Cloze Test, Caselets, or shared passage/table sets) ALWAYS appear:
 *  1. Strictly consecutively (never split by standalone questions or other sets)
 *  2. In their exact original internal order (1, 2, 3, 4, 5)
 *
 * Meanwhile, different sets and standalone questions are shuffled at the block level
 * so consecutive mock tests remain varied without breaking set continuity.
 */

import crypto from "node:crypto";

const GROUP_TOPIC_KEYWORDS = [
  "data interpretation",
  "caselet",
  "seating",
  "puzzle",
  "floor",
  "box",
  "month",
  "date",
  "linear",
  "circular",
  "reading comprehension",
  "cloze",
  "passage",
];

function hashShort(text) {
  return crypto.createHash("sha1").update(String(text)).digest("hex").slice(0, 16);
}

function normalizeWhitespace(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function isGroupBasedTopic(topicName = "") {
  const t = String(topicName || "").toLowerCase();
  return GROUP_TOPIC_KEYWORDS.some((kw) => t.includes(kw));
}

/**
 * Extracts a stable signature from a shared DI table, chart, Directions block, or passage stem
 * embedded inside questionText / question_text (works even for plain DB rows with no group ID).
 */
export function extractSharedStemSignature(rawText = "") {
  const text = normalizeWhitespace(rawText);
  if (text.length < 80) return null;

  // 1. Split off trailing question line if separated by double newline or explicit "Question:" / "Q."
  let stem = "";
  const explicitQMatch = text.match(/^([\s\S]+?)\n+(?:Q(?:uestion)?\s*[:.\d-]|Based on the (?:above|given)|From the (?:above|given)|Find the|What is|Which of|Who |How many|In which)/i);
  if (explicitQMatch && explicitQMatch[1].trim().length >= 60) {
    stem = explicitQMatch[1].trim();
  } else {
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length >= 2) {
      const prefix = paragraphs.slice(0, -1).join("\n").trim();
      if (prefix.length >= 60) {
        stem = prefix;
      }
    } else {
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length >= 3) {
        const lastLine = lines[lines.length - 1];
        if (lastLine.endsWith("?") || /^(?:who|what|which|how|where|find|if )/i.test(lastLine)) {
          const prefix = lines.slice(0, -1).join("\n").trim();
          if (prefix.length >= 60) {
            stem = prefix;
          }
        }
      }
    }
  }

  if (!stem || stem.length < 60) return null;

  // Only treat as a shared group stem if it looks like a DI table/chart, Directions, or Passage
  const looksLikeGroupStem =
    /^(?:\[|directions\s*:|study the following|read the following|table|bar graph|pie chart|line graph|caselet|passage)/i.test(stem) ||
    stem.includes("|") ||
    /\n\s*1\.\s+/.test(stem);

  if (!looksLikeGroupStem) return null;
  return `stem:${hashShort(stem.toLowerCase())}`;
}

/**
 * Resolves a deterministic group key for any question object (engine-generated or DB row).
 * Returns null for standalone questions.
 */
export function resolveQuestionGroupKey(q) {
  if (!q || typeof q !== "object") return null;

  // 1. Explicit group / passage / DI / puzzle set identifiers
  const explicit =
    q.passageGroupKey ||
    q.passage_group_id ||
    q.passageGroupId ||
    (q.diSetId ? `di:${q.diSetId}` : null) ||
    (q.puzzleSetId ? `puz:${q.puzzleSetId}` : null) ||
    (q.puzzle_set_id ? `puz:${q.puzzle_set_id}` : null) ||
    (q.setId ? `set:${q.setId}` : null) ||
    (q.groupId ? `grp:${q.groupId}` : null);
  if (explicit) return String(explicit);

  // 2. Data Interpretation metadata (diSetMeta)
  if (q.diSetMeta && typeof q.diSetMeta === "object") {
    const metaSig = JSON.stringify({
      id: q.diSetMeta.setId || q.diSetMeta.id || null,
      title: q.diSetMeta.title || null,
      chartType: q.diSetMeta.chartType || q.diSetMeta.type || null,
      headers: q.diSetMeta.headers || q.diSetMeta.columns || null,
      rows: q.diSetMeta.rows || q.diSetMeta.data || q.diSetMeta.table || null,
    });
    if (metaSig.length > 30) {
      return `dimeta:${hashShort(metaSig)}`;
    }
  }

  // 3. Explicit passage text field
  const passageText = normalizeWhitespace(q.passageText || q.passage_text || "");
  if (passageText.length >= 40) {
    return `passage:${hashShort(passageText.toLowerCase())}`;
  }

  // 4. Shared stem inside questionText / question_text (DI tables, Directions puzzles, Seating, Cloze)
  const stemSig = extractSharedStemSignature(q.questionText || q.question_text || "");
  if (stemSig) return stemSig;

  // 5. Batch-prefix questionId fallback for group-based topics (e.g. FLOOR_<seed>_0, FLOOR_<seed>_1)
  const topic = q.topicName || q.topic_name || "";
  const qid = String(q.questionId || "");
  if (isGroupBasedTopic(topic) && qid) {
    const match = qid.match(/^([A-Za-z0-9_-]+?)[_-](\d+)$/);
    if (match && match[1].length >= 4) {
      return `qid:${match[1]}`;
    }
  }

  return null;
}

/**
 * Arranges a section's questions so every multi-question group (DI, Puzzles, Seating, Passages)
 * is treated as one atomic block whose internal order is strictly preserved (1, 2, 3, 4, 5),
 * while block order across the section is randomly shuffled.
 *
 * @param {Array<object>} questions - Section questions in generation/retrieval order
 * @param {() => number} [rng=Math.random] - Optional seeded RNG returning [0, 1)
 * @param {object} [options]
 * @param {boolean} [options.shuffleBlocks=true] - Whether to randomize block order
 * @returns {Array<object>} Arranged questions with contiguous group sets and sectionSortOrder
 */
export function arrangeSectionQuestionsGrouped(
  questions = [],
  rng = Math.random,
  { shuffleBlocks = true } = {}
) {
  if (!Array.isArray(questions) || questions.length === 0) return [];

  const groupsByKey = new Map();
  const blockOrder = [];

  for (const q of questions) {
    const key = resolveQuestionGroupKey(q);
    if (key) {
      if (!groupsByKey.has(key)) {
        const list = [];
        groupsByKey.set(key, list);
        blockOrder.push({ key, items: list });
      }
      groupsByKey.get(key).push(q);
    } else {
      blockOrder.push({ key: null, items: [q] });
    }
  }

  const blocks = blockOrder.map((b) => b.items);

  if (shuffleBlocks && blocks.length > 1) {
    for (let i = blocks.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }
  }

  return blocks.flat().map((q, idx) => ({
    ...q,
    sectionSortOrder: idx,
  }));
}

/**
 * Audits an ordered section array to verify that NO group-based set is split
 * into non-contiguous positions.
 */
export function verifyContiguousGroupOrdering(questions = []) {
  const seenClosed = new Set();
  let currentKey = null;
  const violations = [];

  for (let i = 0; i < questions.length; i++) {
    const key = resolveQuestionGroupKey(questions[i]);
    if (key !== currentKey) {
      if (currentKey !== null) seenClosed.add(currentKey);
      if (key !== null && seenClosed.has(key)) {
        violations.push({
          index: i,
          groupKey: key,
          topic: questions[i]?.topicName || questions[i]?.topic_name || "unknown",
        });
      }
      currentKey = key;
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
