/**
 * Exact Grammar Rule Slot & Error-Injection Verifier for Banking Exam Error Detection
 *
 * Every question consists of 4 ordered sentence segments [segA, segB, segC, segD]
 * plus Option E ("No error"):
 *   - If errorSlot === 4 ("NO_ERROR"): all 4 segments use their verified correct form.
 *   - If errorSlot ∈ {0, 1, 2, 3}: ONLY segment[errorSlot] uses its single verified error form;
 *     all other 3 segments strictly remain in their verified correct form.
 *
 * This guarantees 100% single-error uniqueness (zero accidental double-error sentences).
 */

export function assembleErrorDetectionItem({ segments, errorSlot, errorVariant, ruleCode, correction }) {
  if (!Array.isArray(segments) || segments.length !== 4) {
    throw new Error("Error Detection requires exactly 4 sentence segments");
  }
  if (errorSlot < 0 || errorSlot > 4) {
    throw new Error(`Invalid errorSlot: ${errorSlot}`);
  }

  const finalSegments = [...segments];
  if (errorSlot < 4) {
    if (!errorVariant || errorVariant === segments[errorSlot]) {
      throw new Error("Error variant must strictly differ from correct segment");
    }
    finalSegments[errorSlot] = errorVariant;
  }

  return {
    segments: finalSegments,
    correctSegments: [...segments],
    errorSlot,
    isNoError: errorSlot === 4,
    options: [...finalSegments, "No error"],
    correctIndex: errorSlot,
    correctAnswer: String.fromCharCode(65 + errorSlot),
    ruleCode,
    correction,
  };
}

export function verifySingleErrorInvariant(item) {
  const errors = [];
  if (!item || !Array.isArray(item.segments) || item.segments.length !== 4) {
    return { valid: false, errors: ["Invalid segments array"] };
  }
  let diffCount = 0;
  let diffIndex = -1;
  for (let i = 0; i < 4; i++) {
    if (item.segments[i] !== item.correctSegments[i]) {
      diffCount += 1;
      diffIndex = i;
    }
  }
  if (item.errorSlot === 4) {
    if (diffCount !== 0) errors.push(`Expected 0 mutated segments for No Error, found ${diffCount}`);
  } else {
    if (diffCount !== 1) errors.push(`Expected exactly 1 mutated segment, found ${diffCount}`);
    if (diffIndex !== item.errorSlot) errors.push(`Mutated segment index ${diffIndex} != errorSlot ${item.errorSlot}`);
  }
  return { valid: errors.length === 0, errors };
}
