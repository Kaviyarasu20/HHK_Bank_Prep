/**
 * Exact Permutation & Inverse-Label Mapping Solver for Banking Exam Para Jumbles
 *
 * Given canonical ordered sentences [s0, s1, ..., s_{n-1}] and a display permutation
 * `displayIndices` (where displayed label i shows canonical sentence `displayIndices[i]`):
 *   - Computes exact correct label sequence (e.g., ["C", "A", "E", "B", "D"])
 *   - Computes exact label at every ordinal position (0..n-1)
 *   - Computes exact valid consecutive mandatory pairs
 *   - Independently reconstructs the paragraph from any candidate sequence string to verify 100% fidelity
 */

export function buildJumbledMapping(orderedSentences, displayIndices, labels = ["A", "B", "C", "D", "E"]) {
  const n = orderedSentences.length;
  if (displayIndices.length !== n) {
    throw new Error("displayIndices length mismatch");
  }
  const displayed = displayIndices.map((canonIdx, slotIdx) => ({
    label: labels[slotIdx],
    canonicalIndex: canonIdx,
    text: orderedSentences[canonIdx],
  }));

  // Inverse map: for each canonical position k (0..n-1), which displayed label holds it?
  const correctLabelOrder = new Array(n);
  for (const item of displayed) {
    correctLabelOrder[item.canonicalIndex] = item.label;
  }

  const mandatoryPairs = [];
  for (let i = 0; i < n - 1; i++) {
    mandatoryPairs.push(`${correctLabelOrder[i]}-${correctLabelOrder[i + 1]}`);
  }

  return {
    displayed,
    correctLabelOrder,
    correctSequenceStr: correctLabelOrder.join("-"),
    mandatoryPairs,
  };
}

export function reconstructFromLabelSequence(displayed, sequenceStr) {
  const labelMap = new Map(displayed.map((d) => [d.label, d.text]));
  return String(sequenceStr || "")
    .split("-")
    .map((lbl) => labelMap.get(lbl.trim()));
}
