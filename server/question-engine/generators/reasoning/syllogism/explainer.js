import { STMT, CONCL } from "./solver.js";

/**
 * Natural banking-exam phrasing & step-by-step Venn diagram explanations for Syllogism.
 */

export function formatStatementText(st, terms, synonymMode = false, rng = null) {
  const A = terms[st.a];
  const B = terms[st.b];
  const pick = (arr) => (rng ? arr[Math.floor(rng.random() * arr.length)] : arr[0]);

  if (st.type === STMT.ALL) {
    if (synonymMode) return pick([`100% of ${A} are ${B}.`, `Each ${A.replace(/s$/, "")} is a ${B.replace(/s$/, "")}.`, `Every ${A.replace(/s$/, "")} is ${B}.`]);
    return `All ${A} are ${B}.`;
  }
  if (st.type === STMT.NO) {
    if (synonymMode) return pick([`0% of ${A} are ${B}.`, `No ${A} is ever ${B}.`, `None of the ${A} are ${B}.`]);
    return `No ${A} is ${B}.`;
  }
  if (st.type === STMT.SOME) {
    if (synonymMode) return pick([`Mostly ${A} are ${B}.`, `At least some ${A} are ${B}.`, `Few ${A} are ${B}.`]);
    return `Some ${A} are ${B}.`;
  }
  if (st.type === STMT.SOME_NOT) {
    if (synonymMode) return pick([`Hardly any ${A} are ${B}.`, `Seldom ${A} are ${B}.`, `Some ${A} are not ${B}.`]);
    return `Some ${A} are not ${B}.`;
  }
  if (st.type === STMT.ONLY_A_FEW) {
    return `Only a few ${A} are ${B}.`;
  }
  if (st.type === STMT.ONLY) {
    return `Only ${A} are ${B}.`;
  }
  return `Some ${A} are ${B}.`;
}

export function formatConclusionText(c, terms) {
  const A = terms[c.a];
  const B = terms[c.b];
  switch (c.type) {
    case CONCL.ALL:
      return `All ${A} are ${B}.`;
    case CONCL.NO:
      return `No ${A} is ${B}.`;
    case CONCL.SOME:
      return `Some ${A} are ${B}.`;
    case CONCL.SOME_NOT:
      return `Some ${A} are not ${B}.`;
    case CONCL.POSS_ALL:
      return `All ${A} being ${B} is a possibility.`;
    case CONCL.POSS_NO:
      return `No ${A} being ${B} is a possibility.`;
    case CONCL.POSS_SOME:
      return `Some ${A} being ${B} is a possibility.`;
    case CONCL.POSS_SOME_NOT:
      return `Some ${A} not being ${B} is a possibility.`;
    case CONCL.CAN_NEVER_BE_ALL:
      return `All ${A} can never be ${B}.`;
    case CONCL.CAN_NEVER_BE_SOME:
      return `Some ${A} can never be ${B}.`;
    default:
      return `Some ${A} are ${B}.`;
  }
}

export function explainStatementRule(st, terms) {
  const A = terms[st.a];
  const B = terms[st.b];
  switch (st.type) {
    case STMT.ALL:
      return `All ${A} are ${B} ⇒ circle '${A}' lies completely inside '${B}'.`;
    case STMT.NO:
      return `No ${A} is ${B} ⇒ circles '${A}' and '${B}' have zero overlap.`;
    case STMT.SOME:
      return `Some ${A} are ${B} ⇒ '${A}' and '${B}' share at least one common region.`;
    case STMT.SOME_NOT:
      return `Some ${A} are not ${B} ⇒ at least part of '${A}' lies strictly outside '${B}'.`;
    case STMT.ONLY_A_FEW:
      return `Only a few ${A} are ${B} ⇒ BOTH 'Some ${A} are ${B}' AND 'Some ${A} are not ${B}' hold strictly.`;
    case STMT.ONLY:
      return `Only ${A} are ${B} ⇒ All '${B}' are exclusively inside '${A}' and '${B}' cannot overlap any other element.`;
    default:
      return `${A} relates to ${B}.`;
  }
}

export function explainConclusionResult(label, c, result, terms) {
  const text = formatConclusionText(c, terms);
  if (result.kind === "possibility") {
    if (result.follows) {
      return `Conclusion ${label} ("${text}"): FOLLOWS — There exists at least one valid Venn diagram consistent with all statements where this relation holds (and it is not already definitely true).`;
    }
    if (result.alreadyDefinite) {
      return `Conclusion ${label} ("${text}"): DOES NOT FOLLOW — In banking syllogisms, a statement that is already definitely true is not counted as a mere possibility.`;
    }
    return `Conclusion ${label} ("${text}"): DOES NOT FOLLOW — Every valid Venn diagram satisfying the statements contradicts this possibility.`;
  }
  if (result.follows) {
    return `Conclusion ${label} ("${text}"): FOLLOWS — Holds true in every valid Venn diagram satisfying the given statements.`;
  }
  return `Conclusion ${label} ("${text}"): DOES NOT FOLLOW — A valid counter-example Venn diagram exists where this statement is false.`;
}

export function buildSyllogismExplanation({
  statements,
  conclusions,
  results,
  terms,
  outcomeLabel,
  isEitherOr = false,
}) {
  const steps = [
    "Step 1 (Minimal Venn Relations): " +
      statements.map((st) => explainStatementRule(st, terms)).join(" | "),
  ];
  const romans = ["I", "II", "III", "IV"];
  conclusions.forEach((c, idx) => {
    steps.push(`Step ${idx + 2}: ${explainConclusionResult(romans[idx] || idx + 1, c, results[idx], terms)}`);
  });
  if (isEitherOr) {
    steps.push(
      "Either–Or Check: Both conclusions are individually false, share matching subject–predicate terms, and form a complementary pair where at least one must hold in every valid Venn diagram ⇒ Either I or II follows."
    );
  }
  steps.push(`Final Answer: ${outcomeLabel}`);
  return steps;
}
