import crypto from "node:crypto";

/**
 * Shared Banking Exam 5-Question Builder & Tabular Solution Explainer for Unified Puzzles.
 *
 * Takes any CSP-verified unique arrangement:
 *  - orderedEntities: string[] (slot 0 .. n-1 in canonical top-to-bottom / Mon-to-Sun / Senior-to-Junior order)
 *  - slotLabels: string[] (e.g. ["Box 7 (Top)", ...] or ["Monday", ...] or ["CMD", ...])
 *  - secondaryLabel: string | null (e.g. "Color", "City", "Department")
 *  - secondaryByEntity: Record<string, string> | null
 *
 * Generates 5 distinct, exam-grade 5-option MCQs guaranteed to match the solved arrangement 100%.
 */

export const PERSON_POOLS = [
  ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
  ["P", "Q", "R", "S", "T", "U", "V", "W", "X"],
  ["J", "K", "L", "M", "N", "O", "P", "Q", "R"],
  ["Arun", "Bhavna", "Chetan", "Divya", "Esha", "Farhan", "Gaurav", "Hina", "Ishan"],
  ["Kiran", "Lata", "Manoj", "Neha", "Omkar", "Pooja", "Rohan", "Sneha", "Tarun"],
  ["Amit", "Bina", "Deepak", "Geeta", "Harsh", "Jyoti", "Kabir", "Meera", "Nitin"],
];

export const ATTRIBUTE_POOLS = {
  Color: ["Red", "Blue", "Green", "Yellow", "White", "Black", "Purple", "Orange"],
  City: ["Mumbai", "Delhi", "Chennai", "Kolkata", "Pune", "Jaipur", "Kochi", "Bhopal"],
  Department: ["Credit", "Treasury", "Forex", "Audit", "Retail", "IT", "HR", "Compliance"],
  Profession: ["Doctor", "Engineer", "Lawyer", "Architect", "Banker", "Teacher", "Analyst", "Pilot"],
  Fruit: ["Apple", "Mango", "Orange", "Guava", "Papaya", "Cherry", "Peach", "Grape"],
  Subject: ["Economics", "History", "Physics", "Biology", "Commerce", "Law", "Finance", "Statistics"],
};

function makeUniqueFiveOptions(correct, distractorPool, rng) {
  const cleanCorrect = String(correct).trim();
  const seen = new Set([cleanCorrect.toLowerCase()]);
  const distractors = [];
  for (const item of rng.shuffle(distractorPool)) {
    const str = String(item).trim();
    if (!str || seen.has(str.toLowerCase())) continue;
    seen.add(str.toLowerCase());
    distractors.push(str);
    if (distractors.length === 4) break;
  }
  const fallbacks = ["None of these", "Cannot be determined", "Both A and B", "Either A or B"];
  for (const fb of fallbacks) {
    if (distractors.length >= 4) break;
    if (!seen.has(fb.toLowerCase())) {
      seen.add(fb.toLowerCase());
      distractors.push(fb);
    }
  }
  const options = rng.shuffle([cleanCorrect, ...distractors.slice(0, 4)]);
  const correctOptionIndex = options.indexOf(cleanCorrect);
  return { options, correctOptionIndex, answer: cleanCorrect };
}

export function buildTabularSolutionText({ orderedEntities, slotLabels, secondaryLabel = null, secondaryByEntity = null }) {
  const rows = orderedEntities.map((ent, idx) => {
    const attrPart = secondaryLabel && secondaryByEntity ? ` | ${secondaryLabel}: ${secondaryByEntity[ent]}` : "";
    return `${slotLabels[idx]} → ${ent}${attrPart}`;
  });
  return `Final Verified Arrangement:\n${rows.join("\n")}`;
}

export function buildFivePuzzleQuestions({
  puzzleType,
  subtopicName,
  difficulty,
  passageTitle,
  passageText,
  orderedEntities,
  slotLabels,
  entityNoun = "person",
  positionAboveWord = "above",
  positionBelowWord = "below",
  secondaryLabel = null,
  secondaryByEntity = null,
  oddGroupMeta = null, // optional { groupLabel, memberCheck: (idx) => boolean }
  rng,
}) {
  const n = orderedEntities.length;
  const tableText = buildTabularSolutionText({
    orderedEntities,
    slotLabels,
    secondaryLabel,
    secondaryByEntity,
  });

  const questions = [];

  // Q1: Direct Slot Lookup
  {
    const targetIdx = rng.int(1, n - 2);
    const correct = orderedEntities[targetIdx];
    const opt = makeUniqueFiveOptions(correct, orderedEntities, rng);
    const stem = `Who/Which ${entityNoun} is at ${slotLabels[targetIdx]}?`;
    questions.push({
      stem,
      ...opt,
      step: `From the unique arrangement, ${slotLabels[targetIdx]} corresponds to ${correct}.`,
    });
  }

  // Q2: Immediate Neighbor / Relative Offset Deduction
  {
    const useAbove = rng.random() < 0.5;
    const anchorIdx = useAbove ? rng.int(2, n - 1) : rng.int(0, n - 3);
    const offset = rng.int(1, 2);
    const targetIdx = useAbove ? anchorIdx - offset : anchorIdx + offset;
    const correct = orderedEntities[targetIdx];
    const dirText =
      offset === 1
        ? `immediately ${useAbove ? positionAboveWord : positionBelowWord}`
        : `second ${useAbove ? positionAboveWord : positionBelowWord}`;
    const stem = `Who/Which ${entityNoun} is ${dirText} ${orderedEntities[anchorIdx]}?`;
    const opt = makeUniqueFiveOptions(correct, orderedEntities, rng);
    questions.push({
      stem,
      ...opt,
      step: `${orderedEntities[anchorIdx]} is at ${slotLabels[anchorIdx]}; moving ${offset} step(s) ${useAbove ? positionAboveWord : positionBelowWord} lands on ${slotLabels[targetIdx]} → ${correct}.`,
    });
  }

  // Q3: Count Between Two Entities
  {
    const i1 = rng.int(0, Math.floor(n / 2) - 1);
    const i2 = rng.int(i1 + 2, n - 1);
    const between = i2 - i1 - 1;
    const countWords = ["None", "One", "Two", "Three", "Four", "Five", "Six"];
    const correct = countWords[between] ?? String(between);
    const distractors = countWords.filter((w) => w !== correct);
    const opt = makeUniqueFiveOptions(correct, distractors, rng);
    const stem = `How many ${entityNoun}s are placed between ${orderedEntities[i1]} and ${orderedEntities[i2]}?`;
    questions.push({
      stem,
      ...opt,
      step: `${orderedEntities[i1]} is at position ${i1 + 1} and ${orderedEntities[i2]} is at position ${i2 + 1}, so there are |${i2} - ${i1}| - 1 = ${between} (${correct}) between them.`,
    });
  }

  // Q4: Secondary Attribute Combination (Hybrid/Distribution) OR True Statement Check
  if (secondaryLabel && secondaryByEntity) {
    const idx = rng.int(0, n - 1);
    const ent = orderedEntities[idx];
    const correct = `${ent} – ${secondaryByEntity[ent]} (${slotLabels[idx]})`;
    const distractors = [];
    for (let k = 0; k < n; k += 1) {
      if (k === idx) continue;
      const wrongAttr = secondaryByEntity[orderedEntities[(k + 1) % n]];
      distractors.push(`${orderedEntities[k]} – ${wrongAttr} (${slotLabels[k]})`);
    }
    const opt = makeUniqueFiveOptions(correct, distractors, rng);
    const stem = `Which of the following ${entityNoun}–${secondaryLabel} combinations is definitely TRUE according to the final arrangement?`;
    questions.push({
      stem,
      ...opt,
      step: `Verifying against the final table: ${correct} is the only valid combination.`,
    });
  } else {
    const idx = rng.int(0, n - 1);
    const correct = `${orderedEntities[idx]} is at ${slotLabels[idx]}`;
    const distractors = [];
    for (let k = 0; k < n; k += 1) {
      if (k === idx) continue;
      const wrongSlot = slotLabels[(k + 1) % n];
      distractors.push(`${orderedEntities[k]} is at ${wrongSlot}`);
    }
    const opt = makeUniqueFiveOptions(correct, distractors, rng);
    const stem = `Which of the following statements is definitely TRUE based on the given arrangement?`;
    questions.push({
      stem,
      ...opt,
      step: `Checking each option against the final arrangement confirms "${correct}" is true.`,
    });
  }

  // Q5: Odd-One-Out (Classic Banking Exam Pattern)
  {
    let oddEntity;
    let groupFour;
    let reason;
    if (oddGroupMeta) {
      const inGroup = [];
      const outGroup = [];
      for (let i = 0; i < n; i += 1) {
        if (oddGroupMeta.memberCheck(i)) inGroup.push(orderedEntities[i]);
        else outGroup.push(orderedEntities[i]);
      }
      if (inGroup.length >= 4 && outGroup.length >= 1) {
        groupFour = rng.shuffle(inGroup).slice(0, 4);
        oddEntity = rng.pick(outGroup);
        reason = `The other four satisfy "${oddGroupMeta.groupLabel}", whereas ${oddEntity} does not.`;
      }
    }
    if (!oddEntity) {
      // Fallback: 4 adjacent pairs vs 1 non-adjacent pair
      const adjPairs = [];
      for (let i = 0; i < n - 1; i += 1) {
        adjPairs.push(`${orderedEntities[i]} – ${orderedEntities[i + 1]}`);
      }
      const nonAdj = `${orderedEntities[0]} – ${orderedEntities[n - 1]}`;
      groupFour = rng.shuffle(adjPairs).slice(0, 4);
      oddEntity = nonAdj;
      reason = `The other four pairs are immediately adjacent to each other in the arrangement, whereas ${oddEntity} are at the extreme ends.`;
    }
    const opt = makeUniqueFiveOptions(oddEntity, groupFour, rng);
    const stem = `Four of the following five are alike in a certain way based on the arrangement and hence form a group. Which one does NOT belong to that group?`;
    questions.push({
      stem,
      ...opt,
      step: reason,
    });
  }

  return questions.map((q, qIdx) => {
    const fullQuestionText = `${passageText}\n\nQuestion: ${q.stem}`;
    const fingerprint = crypto
      .createHash("sha256")
      .update(`${puzzleType}|${passageTitle}|${qIdx}|${q.stem}|${q.answer}`)
      .digest("hex")
      .slice(0, 24);
    return {
      topic: "Puzzles",
      subType: puzzleType,
      subtopicName,
      difficulty,
      passageTitle,
      passageText,
      questionText: fullQuestionText,
      options: q.options,
      answer: q.answer,
      correctOptionIndex: q.correctOptionIndex,
      solutionSteps: [tableText, `Deduction: ${q.step}`, `Final Answer: ${q.answer}`],
      fingerprint,
      validation: { solverVerified: true, uniqueSolution: true },
    };
  });
}
