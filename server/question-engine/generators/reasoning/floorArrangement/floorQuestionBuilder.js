// Place at: server/question-engine/generators/reasoning/floorArrangement/floorQuestionBuilder.js

import { FLOOR_PUZZLE_TYPES } from "./floorGeometry.js";

/**
 * HHK Floor Arrangement - Question Builder
 *
 * Builds 5 independent MCQs (5 options A-E each) from a verified floor arrangement.
 * Covers all required question types:
 *  a. Who lives on a particular floor?
 *  b. Which floor does a particular person occupy?
 *  c. How many floors are between two people?
 *  d. Who lives immediately above/below another person?
 *  e. Which combination is correct?
 */

export function ordinalSuffix(n) {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}


function floorLabel(n) {
  return `${n}${ordinalSuffix(n)}`;
}

function shuffleOptions(rng, correctText, distractors) {
  const all = [correctText, ...distractors];
  const shuffled = [...all].sort(() => rng.random() - 0.5);
  const correctIndex = shuffled.indexOf(correctText);
  return { options: shuffled, correctIndex };
}

function mcq({ questionId, puzzleId, questionText, options, correctIndex, explanation, difficulty, topic, subType }) {
  const keys = ["A", "B", "C", "D", "E"];
  return {
    questionId,
    puzzleId,
    passageGroupKey: puzzleId,
    topicName: topic || "Floor Arrangement",
    subtopicName: subType || "Floor Arrangement",
    difficulty,
    questionType: "mcq",
    questionText,
    options: options.map((text, idx) => ({ key: keys[idx], text })),
    correctOptionIndex: correctIndex,
    correctAnswer: keys[correctIndex],
    answer: options[correctIndex],
    explanation,
    solutionSteps: [explanation],
    estimatedTimeSeconds: 90,
    generationMode: "RULE_ENGINE",
    generatorVersion: "1.0.0",
  };
}

export function buildFloorQuestions({
  puzzleId,
  geometry,
  solvedArrangement,
  persons,
  attributesByPerson,
  constraints,
  clueStatements,
  difficulty,
  puzzleType,
  buildingInfo,
  rng,
  questionCount = 5,
}) {
  const positions = geometry.positions;
  const n = positions.length;

  // Build lookup: person -> position index, position -> person
  const posOfPerson = new Map();
  const personAtPos = Array(n).fill(null);
  solvedArrangement.forEach((person, idx) => {
    posOfPerson.set(person, idx);
    personAtPos[idx] = person;
  });

  const personOfPosition = (idx) => personAtPos[idx];
  const positionOfPerson = (person) => posOfPerson.get(person);
  const floorOfPerson = (person) => positions[positionOfPerson(person)].floor;
  const personOnFloor = (f) => {
    const idx = positions.findIndex((p) => p.floor === f);
    return idx >= 0 ? personAtPos[idx] : null;
  };

  const questions = [];
  let qIdx = 0;

  const addQ = (q) => {
    if (qIdx < questionCount) {
      questions.push(q);
      qIdx++;
    }
  };

  const topic = "Floor Arrangement";

  /* ------------------------------------------------------------------ */
  /* Q(a): Who lives on a particular floor?                             */
  /* ------------------------------------------------------------------ */
  (function qWhoOnFloor() {
    const targetFloor = rng.int(1, n);
    const correctPerson = personOnFloor(targetFloor);
    if (!correctPerson) return;
    // Distractors must NOT live on the target floor (avoids ambiguity in multi-occupant floors)
    const others = persons.filter((p) => p !== correctPerson && floorOfPerson(p) !== targetFloor);
    if (others.length < 4) return; // not enough off-floor distractors for a clean MCQ
    const distractors = rng.shuffle([...others]).slice(0, 4);
    const { options, correctIndex } = shuffleOptions(rng, correctPerson, distractors);
    addQ(
      mcq({
        questionId: `${puzzleId}_Q${qIdx}`,
        puzzleId,
        questionText: `Who lives on the ${floorLabel(targetFloor)} floor?`,
        options,
        correctIndex,
        explanation: `${correctPerson} lives on the ${floorLabel(targetFloor)} floor.`,
        difficulty,
        topic,
        subType: "Who on floor",
      })
    );
  })();

  /* ------------------------------------------------------------------ */
  /* Q(b): Which floor does a particular person occupy?                 */
  /* ------------------------------------------------------------------ */
  (function qFloorOfPerson() {
    const targetPerson = rng.pick(persons);
    const correctFloor = floorOfPerson(targetPerson);
    const otherFloors = [...Array(n).keys()]
      .map((i) => i + 1)
      .filter((f) => f !== correctFloor);
    const distractors = rng.shuffle(otherFloors).slice(0, 4);
    const opts = [String(correctFloor), ...distractors.map((f) => floorLabel(f))];
    const { options, correctIndex } = shuffleOptions(rng, floorLabel(correctFloor), distractors.map((f) => floorLabel(f)));
    addQ(
      mcq({
        questionId: `${puzzleId}_Q${qIdx}`,
        puzzleId,
        questionText: `On which floor does ${targetPerson} live?`,
        options,
        correctIndex,
        explanation: `${targetPerson} lives on the ${floorLabel(correctFloor)} floor.`,
        difficulty,
        topic,
        subType: "Floor of person",
      })
    );
  })();

  /* ------------------------------------------------------------------ */
  /* Q(c): How many floors are between two people?                      */
  /* ------------------------------------------------------------------ */
  (function qBetween() {
    const pA = rng.pick(persons);
    let pB = rng.pick(persons);
    while (pB === pA) pB = rng.pick(persons);
    const posA = positionOfPerson(pA);
    const posB = positionOfPerson(pB);
    const correctBetween = geometry.getBetweenCount(posA, posB);
    const distractors = [0, 1, 2, 3, 4].filter((x) => x !== correctBetween);
    const d = rng.shuffle(distractors).slice(0, 4);
    const { options, correctIndex } = shuffleOptions(rng, String(correctBetween), d.map(String));
    addQ(
      mcq({
        questionId: `${puzzleId}_Q${qIdx}`,
        puzzleId,
        questionText: `How many floors are between ${pA} and ${pB}?`,
        options,
        correctIndex,
        explanation: `${pA} is on ${floorLabel(positions[posA].floor)} and ${pB} is on ${floorLabel(positions[posB].floor)}, so ${correctBetween} floor${correctBetween !== 1 ? "s" : ""} lie between them.`,
        difficulty,
        topic,
        subType: "Floors between",
      })
    );
  })();

  /* ------------------------------------------------------------------ */
  /* Q(d): Who lives immediately above/below another person?            */
  /* ------------------------------------------------------------------ */
  (function qImmediate() {
    const direction = rng.pick(["ABOVE", "BELOW"]);
    const reference = rng.pick(persons);
    const refPos = positionOfPerson(reference);
    const targetPos =
      direction === "ABOVE" ? geometry.stepAbove(refPos) : geometry.stepBelow(refPos);
    if (targetPos === null) return;
    const correctPerson = personOfPosition(targetPos);
    const others = persons.filter((p) => p !== correctPerson);
    const distractors = rng.shuffle([...others]).slice(0, 4);
    const { options, correctIndex } = shuffleOptions(rng, correctPerson, distractors);
    const relWord = direction === "ABOVE" ? "above" : "below";
    addQ(
      mcq({
        questionId: `${puzzleId}_Q${qIdx}`,
        puzzleId,
        questionText: `Who lives immediately ${relWord} ${reference}?`,
        options,
        correctIndex,
        explanation: `${correctPerson} lives immediately ${relWord} ${reference}.`,
        difficulty,
        topic,
        subType: "Immediate above/below",
      })
    );
  })();

  /* ------------------------------------------------------------------ */
  /* Q(e): Which combination is correct?                                */
  /* ------------------------------------------------------------------ */
  (function qCombination() {
    // Build 5 candidate combinations, only one correct
    const candidates = [];
    for (let i = 0; i < persons.length; i++) {
      const p = persons[i];
      const pos = positionOfPerson(p);
      const posObj = positions[pos];
      const floor = posObj.floor;
      let extra = "";
      if (puzzleType === FLOOR_PUZZLE_TYPES.MULTI_BUILDING) {
        extra = ` in Building ${posObj.building}`;
      } else if (puzzleType === FLOOR_PUZZLE_TYPES.FLOOR_FLAT) {
        extra = `, ${posObj.flatLabel} flat`;
      }
      candidates.push(`${p} – ${floorLabel(floor)}${extra}`);
    }
    // Pick correct one randomly; keep exactly 4 wrong options (5 total)
    const correct = rng.pick(candidates);
    const wrongCandidates = candidates.filter((c) => c !== correct);
    const sampledWrong = rng.shuffle(wrongCandidates).slice(0, 4);
    // Mutate wrong ones to make them clearly incorrect (change floor)
    const mutatedWrong = sampledWrong.map((c) => {
      const person = c.split(" – ")[0];
      let wrongFloor = rng.int(1, n);
      const correctFloor = positions[positionOfPerson(person)].floor;
      while (wrongFloor === correctFloor) wrongFloor = rng.int(1, n);
      return `${person} – ${floorLabel(wrongFloor)}`;
    });
    const allOpts = [correct, ...mutatedWrong];
    const opts = rng.shuffle(allOpts);
    const correctIndex = opts.indexOf(correct);
    addQ(
      mcq({
        questionId: `${puzzleId}_Q${qIdx}`,
        puzzleId,
        questionText: "Which of the following combinations is correct?",
        options: opts,
        correctIndex,
        explanation: `${correct} is the only correctly matched person–floor combination.`,
        difficulty,
        topic,
        subType: "Correct combination",
      })
    );
  })();

  /* ------------------------------------------------------------------ */
  /* Extra attribute-based questions (professions / multi-variable)     */
  /* ------------------------------------------------------------------ */
  if (attributesByPerson && Object.keys(attributesByPerson).length > 0 && qIdx < questionCount) {
    const attrKeys = Object.keys(attributesByPerson[persons[0]] || {});
    const primaryKey = attrKeys[0];
    (function qAttribute() {
      const targetPerson = rng.pick(persons);
      const correctVal = attributesByPerson[targetPerson][primaryKey];
      const allVals = [...new Set(persons.map((p) => attributesByPerson[p][primaryKey]))];
      const distractors = allVals.filter((v) => v !== correctVal);
      const d = rng.shuffle(distractors).slice(0, 4);
      const { options, correctIndex } = shuffleOptions(rng, correctVal, d);
      addQ(
        mcq({
          questionId: `${puzzleId}_Q${qIdx}`,
          puzzleId,
          questionText: `Who is the ${correctVal}?`.replace(/^Who is the (.+)\?$/, `Who is the $1?`),
          options,
          correctIndex,
          explanation: `${targetPerson} is the ${correctVal}.`,
          difficulty,
          topic,
          subType: "Attribute identification",
        })
      );
    })();
  }

  return questions;
}
