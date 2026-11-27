/**
 * Exact Clause-Permutation & Word-Swap Reconstruction Solver for Banking Sentence Rearrangement
 *
 * Covers:
 * 1. Clause-fragment permutation & inverse-label mapping (4-part, 5-part, fixed-start)
 * 2. Single-pair & double-pair word-swap reconstruction & exact identity verification
 */

export function mapJumbledFragments(canonicalFragments, displayIndices, labels) {
  const n = canonicalFragments.length;
  const displayed = displayIndices.map((canonIdx, slotIdx) => ({
    label: labels[slotIdx],
    canonicalIndex: canonIdx,
    text: canonicalFragments[canonIdx],
  }));

  const correctOrder = new Array(n);
  for (const item of displayed) {
    correctOrder[item.canonicalIndex] = item.label;
  }

  return {
    displayed,
    correctOrder,
    correctSequenceStr: correctOrder.join("-"),
    isIdentity: displayIndices.every((v, i) => v === i),
  };
}

export function reconstructFragments(displayed, sequenceStr) {
  const map = new Map(displayed.map((d) => [d.label, d.text]));
  return String(sequenceStr || "")
    .split("-")
    .map((lbl) => map.get(lbl.trim()));
}

/**
 * Apply one or more label swaps (e.g., [["A","C"]] or [["A","C"],["B","D"]])
 * to a 4-word array `words` indexed by A=0, B=1, C=2, D=3.
 */
export function applyWordSwaps(words, swapPairs) {
  const arr = [...words];
  const idxOf = (lbl) => lbl.charCodeAt(0) - 65;
  for (const [l1, l2] of swapPairs) {
    const i = idxOf(l1);
    const j = idxOf(l2);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
