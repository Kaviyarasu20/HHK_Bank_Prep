// Place at: server/question-engine/generators/reasoning/seatingArrangement/seatingQuestionBuilder.js

/**
 * Multi-Question Set Builder, Plausible Distractor Generator & Independent CSP Validator
 *
 * Derives up to 5 distinct, verified questions from ONE validated seating arrangement,
 * generates 5 unique banking options (A–E) rooted in real seating reasoning mistakes,
 * computes structural fingerprints, and independently re-solves every puzzle via CSP.
 */

import crypto from "node:crypto";
import { solveSeatingCSP } from "./seatingSolver.js";
import { ARRANGEMENT_TYPES } from "./seatingGeometry.js";

function buildFiveUniqueOptions(correctAnswer, plausibleDistractors, fallbackPool, rng) {
  const ans = String(correctAnswer).trim();
  const seen = new Set([ans.toLowerCase()]);
  const distractors = [];

  for (const cand of [...plausibleDistractors, ...rng.shuffle(fallbackPool)]) {
    const clean = String(cand ?? "").trim();
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    distractors.push(clean);
    if (distractors.length === 4) break;
  }

  const optionsArray = rng.shuffle([ans, ...distractors.slice(0, 4)]);
  const correctOptionIndex = optionsArray.findIndex((o) => o === ans);
  const keys = ["A", "B", "C", "D", "E"];
  const options = optionsArray.map((text, idx) => ({ key: keys[idx], text }));

  return {
    options,
    optionsArray,
    correctOptionIndex,
    correctOption: keys[correctOptionIndex],
    correctAnswer: ans,
  };
}

/**
 * Builds 1–5 verified banking questions from a solved arrangement.
 */
export function buildQuestionsForArrangement({
  puzzleId,
  geometry,
  solvedArrangement,
  persons,
  instructions,
  clueStatements,
  attrKey,
  attributesByPerson,
  difficulty,
  profile,
  questionCount = 5,
  rng,
}) {
  const n = geometry.seatCount;
  const posOf = new Map(solvedArrangement.map((p, idx) => [p, idx]));
  const questionSpecs = [];

  const fullStemPrefix = `Directions: ${instructions}\n${clueStatements.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nQuestion: `;

  // Format arrangement summary for post-submission explanation
  const arrangementSummary = solvedArrangement
    .map((p, idx) => `${geometry.seats[idx].label}: ${p} (${geometry.seats[idx].facing})`)
    .join(" | ");

  // Candidate Question Type 1: "Who sits second/third to the left/right of X?"
  for (const person of rng.shuffle(persons)) {
    const idx = posOf.get(person);
    const dir = rng.pick(["LEFT", "RIGHT"]);
    const steps = rng.pick([1, 2, 3]);
    const targetIdx = dir === "LEFT" ? geometry.stepLeft(idx, steps) : geometry.stepRight(idx, steps);
    if (targetIdx === null || targetIdx === idx) continue;

    const correctPerson = solvedArrangement[targetIdx];
    // Plausible distractors: reversed direction, off-by-one step, immediate neighbours
    const oppDirIdx = dir === "LEFT" ? geometry.stepRight(idx, steps) : geometry.stepLeft(idx, steps);
    const offByOneIdx = dir === "LEFT" ? geometry.stepLeft(idx, Math.max(1, steps - 1)) : geometry.stepRight(idx, Math.max(1, steps - 1));
    const plausible = [
      oppDirIdx !== null ? solvedArrangement[oppDirIdx] : null,
      offByOneIdx !== null ? solvedArrangement[offByOneIdx] : null,
      ...geometry.getNeighbours(targetIdx).map((ni) => solvedArrangement[ni]),
    ].filter((p) => p && p !== person);

    const stepWord = steps === 1 ? "immediately" : steps === 2 ? "second" : "third";
    const prompt = `Who sits ${stepWord} to the ${dir.toLowerCase()} of ${person}?`;
    questionSpecs.push({
      qType: "RELATIVE_SHIFT",
      prompt,
      correctAnswer: correctPerson,
      plausible,
      fallbackPool: persons.filter((p) => p !== person),
      explanation: `From the unique arrangement (${arrangementSummary}), ${person} faces ${geometry.seats[idx].facing}. Moving ${steps} seat(s) to ${person}'s ${dir.toLowerCase()} leads to ${correctPerson}.`,
      verify: (arr) => {
        const pIdx = arr.indexOf(person);
        const tIdx = dir === "LEFT" ? geometry.stepLeft(pIdx, steps) : geometry.stepRight(pIdx, steps);
        return tIdx !== null ? arr[tIdx] : null;
      },
    });
    if (questionSpecs.length >= 2) break;
  }

  // Candidate Question Type 2: Opposite person (ONLY when geometry supports opposite!)
  if (geometry.supportsOpposite) {
    const refPerson = rng.pick(persons);
    const idx = posOf.get(refPerson);
    const oppIdx = geometry.getOpposite(idx);
    if (oppIdx !== null) {
      const correctPerson = solvedArrangement[oppIdx];
      const plausible = geometry.getNeighbours(oppIdx).map((ni) => solvedArrangement[ni]);
      const verb =
        geometry.type === ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW ||
        geometry.type === ARRANGEMENT_TYPES.PARALLEL_ROWS
          ? "sits opposite"
          : "sits opposite";
      questionSpecs.push({
        qType: "OPPOSITE",
        prompt: `Who ${verb} ${refPerson}?`,
        correctAnswer: correctPerson,
        plausible,
        fallbackPool: persons.filter((p) => p !== refPerson),
        explanation: `In the validated arrangement (${arrangementSummary}), ${correctPerson} occupies the exact opposite position to ${refPerson}.`,
        verify: (arr) => {
          const pIdx = arr.indexOf(refPerson);
          const oIdx = geometry.getOpposite(pIdx);
          return oIdx !== null ? arr[oIdx] : null;
        },
      });
    }
  }

  // Candidate Question Type 3: Between-count question
  const pairCandidates = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const b = geometry.getBetweenCount(i, j);
      if (b >= 0 && b <= 4) pairCandidates.push([solvedArrangement[i], solvedArrangement[j], b]);
    }
  }
  if (pairCandidates.length) {
    const [pA, pB, countBetween] = rng.pick(pairCandidates);
    const correctStr = countBetween === 0 ? "None" : String(countBetween);
    const allCounts = ["None", "1", "2", "3", "4", "5"];
    questionSpecs.push({
      qType: "BETWEEN_COUNT",
      prompt: geometry.isCyclic
        ? `How many persons sit between ${pA} and ${pB} when counted along the shorter side?`
        : `How many persons sit between ${pA} and ${pB}?`,
      correctAnswer: correctStr,
      plausible: [String(countBetween + 1), countBetween > 1 ? String(countBetween - 1) : "None", "3", "4"],
      fallbackPool: allCounts,
      explanation: `In the validated arrangement (${arrangementSummary}), there ${countBetween === 1 ? "is 1 person" : `are ${countBetween} persons`} between ${pA} and ${pB}.`,
      verify: (arr) => {
        const b = geometry.getBetweenCount(arr.indexOf(pA), arr.indexOf(pB));
        return b === 0 ? "None" : String(b);
      },
    });
  }

  // Candidate Question Type 4: Geometry-specific Extreme End / Corner / Side question
  if (geometry.type === ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW) {
    const rightEnd = solvedArrangement[geometry.getExtremeRightEnd()];
    const leftEnd = solvedArrangement[geometry.getExtremeLeftEnd()];
    questionSpecs.push({
      qType: "EXTREME_END",
      prompt: `Who sits at the extreme right end of the row?`,
      correctAnswer: rightEnd,
      plausible: [leftEnd, ...geometry.getNeighbours(geometry.getExtremeRightEnd()).map((i) => solvedArrangement[i])],
      fallbackPool: persons,
      explanation: `Since everyone faces ${geometry.seats[0].facing}, the extreme right end is occupied by ${rightEnd}.`,
      verify: (arr) => arr[geometry.getExtremeRightEnd()],
    });
  } else if (
    geometry.type === ARRANGEMENT_TYPES.SQUARE ||
    geometry.type === ARRANGEMENT_TYPES.TRIANGULAR ||
    geometry.type === ARRANGEMENT_TYPES.RECTANGULAR
  ) {
    const cornerIndices = geometry.seats.filter((s) => s.posType === "CORNER").map((s) => s.index);
    const sideIndices = geometry.seats.filter((s) => s.posType !== "CORNER").map((s) => s.index);
    if (cornerIndices.length && sideIndices.length >= 4) {
      const oneCorner = solvedArrangement[rng.pick(cornerIndices)];
      const fourSides = rng.shuffle(sideIndices).slice(0, 4).map((i) => solvedArrangement[i]);
      questionSpecs.push({
        qType: "CORNER_IDENTIFICATION",
        prompt: `Who among the following sits at one of the corners of the table?`,
        correctAnswer: oneCorner,
        plausible: fourSides,
        fallbackPool: persons,
        explanation: `From the arrangement (${arrangementSummary}), ${oneCorner} sits at a corner while the other four options occupy side positions.`,
        verify: (arr) => {
          const idx = arr.indexOf(oneCorner);
          return geometry.seats[idx].posType === "CORNER" ? oneCorner : null;
        },
      });
    }
  }

  // Candidate Question Type 5: Immediate Neighbour / Attribute question to fill up to `questionCount`
  if (attrKey && Object.keys(attributesByPerson).length === persons.length) {
    const targetPerson = rng.pick(persons);
    const idx = posOf.get(targetPerson);
    const rightIdx = geometry.stepRight(idx, 1);
    if (rightIdx !== null) {
      const rightPerson = solvedArrangement[rightIdx];
      const attrVal = attributesByPerson[targetPerson][attrKey];
      const attrPhrase =
        attrKey === "profession"
          ? `the ${attrVal}`
          : attrKey === "city"
          ? `the person from ${attrVal}`
          : `the person who likes ${attrVal}`;
      questionSpecs.push({
        qType: "ATTRIBUTE_RELATIVE",
        prompt: `Who sits immediately to the right of ${attrPhrase}?`,
        correctAnswer: rightPerson,
        plausible: [
          geometry.stepLeft(idx, 1) !== null ? solvedArrangement[geometry.stepLeft(idx, 1)] : null,
          ...persons.filter((p) => p !== targetPerson && p !== rightPerson),
        ].filter(Boolean),
        fallbackPool: persons.filter((p) => p !== targetPerson),
        explanation: `${targetPerson} is ${attrPhrase} (facing ${geometry.seats[idx].facing}). Immediately to ${targetPerson}'s right sits ${rightPerson}.`,
        verify: (arr) => {
          const pIdx = arr.indexOf(targetPerson);
          const rIdx = geometry.stepRight(pIdx, 1);
          return rIdx !== null ? arr[rIdx] : null;
        },
      });
    }
  }

  // Fill remaining slots with distinct relative-position questions if needed
  for (const person of rng.shuffle(persons)) {
    if (questionSpecs.length >= questionCount) break;
    const idx = posOf.get(person);
    const leftIdx = geometry.stepLeft(idx, 1);
    if (leftIdx === null) continue;
    const prompt = `Who sits immediately to the left of ${person}?`;
    if (questionSpecs.some((q) => q.prompt === prompt)) continue;
    const correctPerson = solvedArrangement[leftIdx];
    const rightIdx = geometry.stepRight(idx, 1);
    questionSpecs.push({
      qType: "IMMEDIATE_LEFT",
      prompt,
      correctAnswer: correctPerson,
      plausible: [rightIdx !== null ? solvedArrangement[rightIdx] : null].filter(Boolean),
      fallbackPool: persons.filter((p) => p !== person),
      explanation: `${person} faces ${geometry.seats[idx].facing}; immediately to ${person}'s left sits ${correctPerson}.`,
      verify: (arr) => {
        const lIdx = geometry.stepLeft(arr.indexOf(person), 1);
        return lIdx !== null ? arr[lIdx] : null;
      },
    });
  }

  const selectedSpecs = questionSpecs.slice(0, questionCount);

  return selectedSpecs.map((spec, idx) => {
    const optPack = buildFiveUniqueOptions(spec.correctAnswer, spec.plausible, spec.fallbackPool, rng);
    return {
      questionId: `${puzzleId}_Q${idx + 1}`,
      puzzleId,
      passageGroupKey: puzzleId, // Preserves shared puzzle-set grouping in Mock Test Engine!
      examName: profile.examCode,
      examStage: profile.stage,
      subject: "Reasoning Ability",
      subjectKey: "reasoning",
      topic: "Seating Arrangement",
      topicName: "Seating Arrangement",
      subtopic: geometry.label,
      subtopicName: geometry.label,
      arrangementType: geometry.type,
      difficulty: String(difficulty).toLowerCase(),
      questionType: "mcq",
      puzzleInstructions: instructions,
      clueStatements,
      questionText: `${fullStemPrefix}${spec.prompt}`,
      shortPrompt: spec.prompt,
      options: optPack.options,
      optionsArray: optPack.optionsArray,
      correctOptionIndex: optPack.correctOptionIndex,
      correctOption: optPack.correctOption,
      correctAnswer: optPack.correctOption, // HHK standard option key 'A'-'E'
      correctAnswerValue: optPack.correctAnswer,
      explanation: spec.explanation,
      estimatedTimeSeconds: Math.round((profile.estimatedTimeSeconds || 210) / Math.max(1, selectedSpecs.length)),
      generatorVersion: "1.0.0",
      validationStatus: "VERIFIED",
      _verifyFn: spec.verify,
    };
  });
}

/**
 * Computes a structural puzzle fingerprint independent of person names.
 */
export function computeSeatingPuzzleFingerprint({ geometry, constraints, attrKey }) {
  const sig = JSON.stringify({
    type: geometry.type,
    seatCount: geometry.seatCount,
    facings: geometry.seats.map((s) => s.facing),
    clueTypes: constraints.map((c) => `${c.type}:${c.direction || ""}:${c.steps || ""}:${c.posType || ""}`).sort(),
    attrKey: attrKey || null,
  });
  return crypto.createHash("sha256").update(sig).digest("hex").slice(0, 24);
}

/**
 * Independent CSP + Answer Validator for a complete Seating Arrangement Puzzle Set.
 * Re-runs `solveSeatingCSP` from scratch to prove unique solution + verifies every question!
 */
export function validateSeatingPuzzleSet(puzzleSet) {
  const errors = [];
  if (!puzzleSet || !puzzleSet.geometry || !puzzleSet.constraints) {
    return { valid: false, errors: ["Missing geometry or constraints in puzzleSet."] };
  }

  const solveRes = solveSeatingCSP({
    geometry: puzzleSet.geometry,
    persons: puzzleSet.persons,
    constraints: puzzleSet.constraints,
    attributesByPerson: puzzleSet.attributesByPerson || {},
    maxSolutions: 2,
  });

  if (!solveRes.unique || solveRes.solutionCount !== 1) {
    errors.push(`Expected exactly 1 unique canonical solution, solver found status=${solveRes.status} (${solveRes.solutionCount}).`);
    return { valid: false, errors, solveRes };
  }

  const verifiedArr = solveRes.solutions[0];
  for (const q of puzzleSet.questions || []) {
    if (!Array.isArray(q.options) || q.options.length !== 5) {
      errors.push(`${q.questionId}: expected 5 options.`);
      continue;
    }
    const texts = q.options.map((o) => o.text.trim().toLowerCase());
    if (new Set(texts).size !== 5) {
      errors.push(`${q.questionId}: duplicate options detected.`);
    }
    const matchedOpt = q.options.find((o) => o.key === q.correctAnswer);
    if (!matchedOpt || matchedOpt.text !== q.correctAnswerValue) {
      errors.push(`${q.questionId}: correctAnswer key mismatch.`);
    }
    if (typeof q._verifyFn === "function") {
      const solvedVal = q._verifyFn(verifiedArr);
      if (solvedVal !== q.correctAnswerValue) {
        errors.push(`${q.questionId}: independent answer mismatch (solver="${solvedVal}", claimed="${q.correctAnswerValue}").`);
      }
    }
  }

  return { valid: errors.length === 0, errors, solveRes };
}