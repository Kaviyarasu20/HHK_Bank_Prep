/**
 * Exact Lexical Relation & Disjointness Verifier for Banking Synonyms & Antonyms
 *
 * Enforces:
 * 1. Strict synonym/antonym set disjointness for every lexicon entry (no word in both sets).
 * 2. Exact 1-of-5 uniqueness:
 *    - In SYNONYM mode: strictly 1 option ∈ entry.synonyms, 0 other options ∈ entry.synonyms.
 *    - In ANTONYM mode: strictly 1 option ∈ entry.antonyms, 0 other options ∈ entry.antonyms.
 *    - In NON_SYNONYM_OUTLIER mode: strictly 4 options ∈ entry.synonyms and 1 option ∈ entry.antonyms.
 *    - In SYN_ANT_PAIR mode: strictly 1 option is "syn / ant" with syn ∈ synonyms and ant ∈ antonyms.
 */

export function verifyLexiconEntry(entry) {
  const synSet = new Set(entry.synonyms.map((s) => s.toLowerCase()));
  const antSet = new Set(entry.antonyms.map((a) => a.toLowerCase()));
  for (const s of synSet) {
    if (antSet.has(s)) return false;
  }
  return synSet.size >= 4 && antSet.size >= 4;
}

export function verifySynonymAntonymQuestionIntegrity({
  mode,
  entry,
  options,
  correctIndex,
}) {
  const errors = [];
  if (!Array.isArray(options) || options.length !== 5) {
    return { valid: false, errors: ["Must have exactly 5 options"] };
  }
  const uniq = new Set(options.map((o) => String(o).trim().toLowerCase()));
  if (uniq.size !== 5) errors.push("Duplicate options detected");

  const synSet = new Set(entry.synonyms.map((s) => s.toLowerCase()));
  const antSet = new Set(entry.antonyms.map((a) => a.toLowerCase()));

  if (mode === "CONTEXTUAL_SYNONYM" || mode === "DUAL_CONTEXT_SYN") {
    const matches = options
      .map((o, i) => (synSet.has(o.toLowerCase()) ? i : -1))
      .filter((i) => i !== -1);
    if (matches.length !== 1 || matches[0] !== correctIndex) {
      errors.push(`Expected unique synonym at ${correctIndex}, found matches ${JSON.stringify(matches)}`);
    }
  } else if (mode === "CONTEXTUAL_ANTONYM" || mode === "DUAL_CONTEXT_ANT") {
    const matches = options
      .map((o, i) => (antSet.has(o.toLowerCase()) ? i : -1))
      .filter((i) => i !== -1);
    if (matches.length !== 1 || matches[0] !== correctIndex) {
      errors.push(`Expected unique antonym at ${correctIndex}, found matches ${JSON.stringify(matches)}`);
    }
  } else if (mode === "SYNONYM_CLUSTER_OUTLIER") {
    const synMatches = options.filter((o) => synSet.has(o.toLowerCase()));
    const antMatches = options
      .map((o, i) => (antSet.has(o.toLowerCase()) ? i : -1))
      .filter((i) => i !== -1);
    if (synMatches.length !== 4 || antMatches.length !== 1 || antMatches[0] !== correctIndex) {
      errors.push("Expected 4 synonyms + 1 antonym outlier at correctIndex");
    }
  } else if (mode === "PAIR_SYNONYM_ANTONYM_MAINS") {
    const matches = options
      .map((o, i) => {
        const parts = o.split("/").map((p) => p.trim().toLowerCase());
        return parts.length === 2 && synSet.has(parts[0]) && antSet.has(parts[1]) ? i : -1;
      })
      .filter((i) => i !== -1);
    if (matches.length !== 1 || matches[0] !== correctIndex) {
      errors.push(`Expected unique (syn / ant) pair at ${correctIndex}, found ${JSON.stringify(matches)}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
