/**
 * Strict Independent Validator & Fingerprinter for Coding-Decoding Questions
 */

import crypto from "node:crypto";
import {
  encodeLetterShift,
  encodeNumberCoding,
  evaluateConditionalCode,
  evaluateNewPatternWord,
  solveChineseCoding,
} from "./solver.js";

export function validateCodingQuestion(q) {
  const errors = [];
  if (!q || typeof q !== "object") return { valid: false, errors: ["Null question"] };

  if (!q.questionText || q.questionText.length < 25) {
    errors.push("Question text missing or too short");
  }
  if (!Array.isArray(q.options) || q.options.length !== 5) {
    errors.push("Must have exactly 5 options");
  } else {
    const uniq = new Set(q.options.map((o) => String(o).trim()));
    if (uniq.size !== 5) errors.push("Duplicate options detected");
  }
  if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 4) {
    errors.push("Invalid correctIndex");
  }
  const expectedLetter = String.fromCharCode(65 + q.correctIndex);
  if (q.correctAnswer !== expectedLetter) {
    errors.push(`correctAnswer mismatch (${q.correctAnswer} vs ${expectedLetter})`);
  }

  const chosenOption = q.options?.[q.correctIndex];
  const meta = q._meta || {};

  // Independent re-verification via formal solver
  if (meta.subType === "CHINESE_CODING") {
    const solved = solveChineseCoding(meta.statements);
    const qm = meta.queryMeta;
    if (qm.mode === "SINGLE_WORD_TO_CODE") {
      if (solved.uniqueWordToCode.get(qm.targetWord) !== chosenOption) {
        errors.push("Chinese single-word decode mismatch");
      }
    } else if (qm.mode === "SINGLE_CODE_TO_WORD") {
      if (solved.uniqueCodeToWord.get(qm.targetCode) !== chosenOption) {
        errors.push("Chinese single-code decode mismatch");
      }
    } else if (qm.mode === "TWO_WORD_PHRASE") {
      const expected = `${solved.uniqueWordToCode.get(qm.targetWords[0])} ${solved.uniqueWordToCode.get(qm.targetWords[1])}`;
      if (expected !== chosenOption) errors.push("Chinese two-word phrase mismatch");
    } else if (qm.mode === "PHRASE_WITH_NEW_WORD") {
      const kCode = solved.uniqueWordToCode.get(qm.knownWord);
      if (!kCode || solved.allCodes.includes(qm.newCode)) {
        errors.push("Chinese new-word code collides with existing statement codes");
      }
      if (`${kCode} ${qm.newCode}` !== chosenOption) {
        errors.push("Chinese phrase-with-new-word answer mismatch");
      }
    } else if (qm.mode === "AMBIGUOUS_PAIR") {
      const cSet = solved.wordCandidates.get(qm.targetWord);
      if (!cSet || cSet.size !== 2) {
        errors.push("Ambiguous pair word does not have exactly 2 candidate codes");
      } else {
        const [a, b] = [...cSet].sort();
        if (`Either '${a}' or '${b}'` !== chosenOption) {
          errors.push("Ambiguous pair option mismatch");
        }
      }
    }
  } else if (meta.subType === "NEW_PATTERN_SNL") {
    const recomputed = evaluateNewPatternWord(meta.targetWord, meta.rule);
    if (recomputed !== chosenOption) errors.push("New-pattern SNL answer mismatch");
    for (const s of meta.exampleSentences) {
      for (let i = 0; i < s.words.length; i++) {
        if (evaluateNewPatternWord(s.words[i], meta.rule) !== s.codes[i]) {
          errors.push("New-pattern example sentence inconsistent with rule");
        }
      }
    }
  } else if (meta.subType === "CONDITIONAL_CODING") {
    const recomputed = evaluateConditionalCode(meta.sequence, meta.tableMap, meta.conditions);
    if (recomputed.code !== chosenOption) errors.push("Conditional coding answer mismatch");
  } else if (meta.subType === "LETTER_SHIFT") {
    const recomputed = encodeLetterShift(meta.target, meta.pattern);
    if (recomputed !== chosenOption) errors.push("Letter-shift answer mismatch");
    for (const ex of meta.examples) {
      if (encodeLetterShift(ex.word, meta.pattern) !== ex.code) {
        errors.push("Letter-shift example inconsistent with pattern");
      }
    }
  } else if (meta.subType === "NUMBER_CODING") {
    const recomputed = String(encodeNumberCoding(meta.target, meta.pattern));
    if (recomputed !== chosenOption) errors.push("Number-coding answer mismatch");
    for (const ex of meta.examples) {
      if (encodeNumberCoding(ex.word, meta.pattern) !== ex.code) {
        errors.push("Number-coding example inconsistent with pattern");
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function computeCodingFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
