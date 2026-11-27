/**
 * Modular Banking Exam Phrase Replacement Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam subtopics:
 * 1. VERB_TENSE_REPLACEMENT            — Subject–verb agreement, tense consistency, gerunds after 'look forward to'
 * 2. PREPOSITION_PHRASAL_REPLACEMENT   — Fixed prepositions, phrasal verbs, 'with a view to + V-ing'
 * 3. CONJUNCTION_INVERSION_REPLACEMENT — Correlatives (No sooner..than, Hardly..when), negative inversion, lest..should
 * 4. MODIFIER_IDIOM_REPLACEMENT        — Fewer vs less, double comparatives, high time + V2, despite (no of)
 * 5. CONCISION_PARALLELISM_REPLACEMENT — Redundancy removal (return/revert), parallel verb series, reason..is that
 */

import { renderHighlightedSentence } from "./solver.js";

export const PHRASE_REPLACEMENT_SUBTOPICS = {
  VERB_TENSE_REPLACEMENT: "Verb Agreement & Tense Improvement",
  PREPOSITION_PHRASAL_REPLACEMENT: "Prepositions & Phrasal-Verb Improvement",
  CONJUNCTION_INVERSION_REPLACEMENT: "Correlatives & Inversion Improvement",
  MODIFIER_IDIOM_REPLACEMENT: "Modifiers, Comparatives & Idiomatic Usage",
  CONCISION_PARALLELISM_REPLACEMENT: "Concision, Redundancy & Parallelism (Mains)",
};

export function createPrRng(seedInput) {
  let state = (Number(seedInput) || Date.now()) >>> 0;
  if (state === 0) state = 0x9e3779b9;
  const rng = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.seed = state;
  rng.int = (min, max) => min + Math.floor(rng() * (max - min + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  return rng;
}

const BANKS = ["the public sector bank", "the regional rural bank", "the commercial bank", "the apex institution"];
const CITIES = ["Mumbai", "Chennai", "Bengaluru", "Hyderabad", "Pune", "Kolkata"];
const OFFICERS = ["the branch manager", "the chief auditor", "the zonal head", "the credit officer"];

const TEMPLATES = {
  VERB_TENSE_REPLACEMENT: [
    {
      build: (b, c) => ({
        prefix: `One of the quarterly compliance reports submitted by ${b} in ${c} `,
        wrongPhrase: `have been flagged`,
        correctPhrase: `has been flagged`,
        suffix: ` for immediate statutory review.`,
        distractors: [`were flagged`, `are being flagged`, `have flagged`, `having been flagged`],
        rule: `'One of the + plural noun' always takes a singular verb ('has been flagged').`,
      }),
    },
    {
      build: (_b, c, o) => ({
        prefix: `${o.charAt(0).toUpperCase() + o.slice(1)} `,
        wrongPhrase: `is supervising the ${c} zone since`,
        correctPhrase: `has been supervising the ${c} zone since`,
        suffix: ` April 2022.`,
        distractors: [`was supervising the ${c} zone since`, `supervises the ${c} zone since`, `had supervised the ${c} zone since`, `will supervise the ${c} zone since`],
        rule: `An action continuing from a past starting point ('since April 2022') requires Present Perfect Continuous ('has been supervising').`,
      }),
    },
    {
      build: (b) => ({
        prefix: `Retail investors look forward `,
        wrongPhrase: `to receive the dividend payout`,
        correctPhrase: `to receiving the dividend payout`,
        suffix: ` from ${b} next month.`,
        distractors: [`to received the dividend payout`, `for receiving the dividend payout`, `towards receive the dividend payout`, `at receiving the dividend payout`],
        rule: `'look forward to' ends with a preposition 'to' and must be followed by a gerund ('receiving').`,
      }),
    },
    {
      build: (b) => ({
        prefix: `If ${b} `,
        wrongPhrase: `would have verified the title deeds`,
        correctPhrase: `had verified the title deeds`,
        suffix: ` earlier, it would have avoided the loan default.`,
        distractors: [`has verified the title deeds`, `would verify the title deeds`, `was verifying the title deeds`, `have verified the title deeds`],
        rule: `Type-3 conditional uses 'had + V3' in the if-clause, never 'would have'.`,
      }),
    },
  ],

  PREPOSITION_PHRASAL_REPLACEMENT: [
    {
      build: (b) => ({
        prefix: `Additional cloud servers were provisioned so ${b} could `,
        wrongPhrase: `cope up with the festival surge`,
        correctPhrase: `cope with the festival surge`,
        suffix: ` without payment latency.`,
        distractors: [`cope up to the festival surge`, `cope against the festival surge`, `coping up with the festival surge`, `cope into the festival surge`],
        rule: `The correct idiom is 'cope with', never 'cope up with'.`,
      }),
    },
    {
      build: (b) => ({
        prefix: `The internal risk committee at ${b} `,
        wrongPhrase: `comprises of six senior auditors`,
        correctPhrase: `comprises six senior auditors`,
        suffix: ` and two legal advisors.`,
        distractors: [`comprises with six senior auditors`, `is comprising of six senior auditors`, `comprise of six senior auditors`, `consists six senior auditors`],
        rule: `In active voice, 'comprise' means 'consist of' and takes no 'of'.`,
      }),
    },
    {
      build: (b) => ({
        prefix: `${b.charAt(0).toUpperCase() + b.slice(1)} upgraded its mobile portal `,
        wrongPhrase: `with a view to simplify`,
        correctPhrase: `with a view to simplifying`,
        suffix: ` online loan renewals.`,
        distractors: [`with a view of simplify`, `with a view for simplifying`, `to a view to simplifying`, `with view to simplify`],
        rule: `'with a view to' is always followed by a gerund (V-ing: 'simplifying').`,
      }),
    },
    {
      build: (_b, c) => ({
        prefix: `Salaried customers in ${c} clearly `,
        wrongPhrase: `prefer instant UPI transfers than`,
        correctPhrase: `prefer instant UPI transfers to`,
        suffix: ` waiting in branch queues.`,
        distractors: [`prefer instant UPI transfers over than`, `prefer instant UPI transfers from`, `more prefer instant UPI transfers to`, `prefer instant UPI transfers against`],
        rule: `'prefer' is always paired with 'to' (never 'than' or 'more prefer').`,
      }),
    },
  ],

  CONJUNCTION_INVERSION_REPLACEMENT: [
    {
      build: (b) => ({
        prefix: `No sooner had ${b} launched the zero-fee account `,
        wrongPhrase: `when thousands of students applied`,
        correctPhrase: `than thousands of students applied`,
        suffix: ` online.`,
        distractors: [`then thousands of students applied`, `that thousands of students applied`, `before thousands of students applied`, `as soon as thousands of students applied`],
        rule: `'No sooner' is always paired with 'than' (not 'when' or 'then').`,
      }),
    },
    {
      build: (b) => ({
        prefix: ``,
        wrongPhrase: `Not only ${b} reduced processing fees`,
        correctPhrase: `Not only did ${b} reduce processing fees`,
        suffix: `, but it also waived prepayment penalties.`,
        distractors: [`Not only ${b} has reduced processing fees`, `Not only did ${b} reduced processing fees`, `Not only had ${b} reduce processing fees`, `Not only does ${b} reduced processing fees`],
        rule: `Starting a clause with 'Not only' requires subject–auxiliary inversion ('Not only did ... reduce').`,
      }),
    },
    {
      build: (_b, _c, o) => ({
        prefix: `${o.charAt(0).toUpperCase() + o.slice(1)} verified every account number twice `,
        wrongPhrase: `lest the transfer will fail`,
        correctPhrase: `lest the transfer should fail`,
        suffix: ` during settlement.`,
        distractors: [`lest the transfer would not fail`, `lest the transfer should not fail`, `lest the transfer may fail`, `lest the transfer fails not`],
        rule: `'lest' is always followed by 'should' and never takes a negative ('not').`,
      }),
    },
    {
      build: (b) => ({
        prefix: `Hardly had ${b} published its annual results `,
        wrongPhrase: `than its share price climbed`,
        correctPhrase: `when its share price climbed`,
        suffix: ` by four percent.`,
        distractors: [`then its share price climbed`, `that its share price climbed`, `while its share price climbed`, `until its share price climbed`],
        rule: `'Hardly / Scarcely' is always followed by 'when' (never 'than').`,
      }),
    },
  ],

  MODIFIER_IDIOM_REPLACEMENT: [
    {
      build: (b) => ({
        prefix: `It is high time that ${b} `,
        wrongPhrase: `modernizes its rural ATM network`,
        correctPhrase: `modernized its rural ATM network`,
        suffix: ` to eliminate downtime.`,
        distractors: [`has modernized its rural ATM network`, `will modernize its rural ATM network`, `is modernizing its rural ATM network`, `modernizing its rural ATM network`],
        rule: `'It is high time + subject' always takes the simple past tense ('modernized').`,
      }),
    },
    {
      build: (b) => ({
        prefix: ``,
        wrongPhrase: `Despite of facing tight liquidity`,
        correctPhrase: `Despite facing tight liquidity`,
        suffix: `, ${b} expanded MSME lending by twelve percent.`,
        distractors: [`In spite facing tight liquidity`, `Despite having of tight liquidity`, `Although facing of tight liquidity`, `Regardless facing tight liquidity`],
        rule: `'Despite' is never followed by 'of' (use either 'Despite' or 'In spite of').`,
      }),
    },
    {
      build: (_b, c) => ({
        prefix: `After introducing digital tokens, branches in ${c} logged `,
        wrongPhrase: `less customer complaints than`,
        correctPhrase: `fewer customer complaints than`,
        suffix: ` in the prior quarter.`,
        distractors: [`lesser customer complaints than`, `fewest customer complaints than`, `little customer complaints than`, `least customer complaints than`],
        rule: `'complaints' is a countable plural noun, so 'fewer' is required instead of 'less'.`,
      }),
    },
    {
      build: () => ({
        prefix: `One must carefully safeguard `,
        wrongPhrase: `his digital banking credentials`,
        correctPhrase: `one's digital banking credentials`,
        suffix: ` against social-engineering attacks.`,
        distractors: [`their digital banking credentials`, `ones digital banking credentials`, `her digital banking credentials`, `its digital banking credentials`],
        rule: `The indefinite pronoun 'one' must be matched consistently with 'one's'.`,
      }),
    },
  ],

  CONCISION_PARALLELISM_REPLACEMENT: [
    {
      build: (_b, _c, o) => ({
        prefix: `The borrower must `,
        wrongPhrase: `return back the original sanction letter`,
        correctPhrase: `return the original sanction letter`,
        suffix: ` to ${o} upon loan closure.`,
        distractors: [`return again the original sanction letter`, `returning back the original sanction letter`, `re-return the original sanction letter`, `revert back the original sanction letter`],
        rule: `'return' already means 'give back', so 'return back' is redundant.`,
      }),
    },
    {
      build: (b) => ({
        prefix: `The newly launched KYC portal of ${b} is `,
        wrongPhrase: `both swift as well as secure`,
        correctPhrase: `both swift and secure`,
        suffix: ` for first-time depositors.`,
        distractors: [`both swift along with secure`, `both swift or secure`, `both swift besides secure`, `neither swift and secure`],
        rule: `'both' is always paired with 'and', never 'as well as'.`,
      }),
    },
    {
      build: (b) => ({
        prefix: `The primary reason why ${b} raised fixed-deposit rates `,
        wrongPhrase: `is because it wanted to attract`,
        correctPhrase: `is that it wanted to attract`,
        suffix: ` stable long-term retail deposits.`,
        distractors: [`is due to it wanted to attract`, `is since it wanted to attract`, `was because it wanted to attract`, `being because it wanted to attract`],
        rule: `'The reason ... is that' is standard; 'The reason ... is because' is redundant.`,
      }),
    },
    {
      build: (_b, _c, o) => ({
        prefix: `${o.charAt(0).toUpperCase() + o.slice(1)} was tasked with `,
        wrongPhrase: `auditing ledgers, verifying KYC, and to submit`,
        correctPhrase: `auditing ledgers, verifying KYC, and submitting`,
        suffix: ` the quarterly risk report.`,
        distractors: [`audit ledgers, verifying KYC, and submitting`, `auditing ledgers, to verify KYC, and submitting`, `auditing ledgers, verified KYC, and submitting`, `to audit ledgers, verifying KYC, and submit`],
        rule: `Items in a series must maintain parallel grammatical form ('auditing, verifying, and submitting').`,
      }),
    },
  ],
};

export function buildPhraseReplacementQuestion({
  subtopicKey = "VERB_TENSE_REPLACEMENT",
  difficulty = "Medium",
  forceNoCorrection = false,
  rng,
}) {
  const bank = rng.pick(BANKS);
  const city = rng.pick(CITIES);
  const officer = rng.pick(OFFICERS);
  const family = TEMPLATES[subtopicKey] || TEMPLATES.VERB_TENSE_REPLACEMENT;
  const spec = rng.pick(family).build(bank, city, officer);

  const isNoCorrection = forceNoCorrection || rng() < 0.22;
  const shownPhrase = isNoCorrection ? spec.correctPhrase : spec.wrongPhrase;
  const sentence = renderHighlightedSentence(spec.prefix, shownPhrase, spec.suffix);

  let options;
  let correctIndex;
  if (isNoCorrection) {
    const fourDistractors = rng.shuffle(
      spec.distractors.filter((d) => d !== spec.correctPhrase),
    ).slice(0, 4);
    if (fourDistractors.length < 4) return null;
    options = [...fourDistractors, "No correction required"];
    correctIndex = 4;
  } else {
    const threeDistractors = rng.shuffle(
      spec.distractors.filter((d) => d !== spec.correctPhrase && d !== spec.wrongPhrase),
    ).slice(0, 3);
    if (threeDistractors.length < 3) return null;
    const fourChoices = rng.shuffle([spec.correctPhrase, ...threeDistractors]);
    options = [...fourChoices, "No correction required"];
    correctIndex = options.indexOf(spec.correctPhrase);
  }

  const questionText =
    `Directions: Which of the phrases (A), (B), (C), or (D) given below should replace the bracketed phrase in the sentence to make it grammatically and idiomatically correct? If the sentence is already correct, choose (E) 'No correction required'.\n\n` +
    `${sentence}`;

  const explanation = isNoCorrection
    ? `The highlighted phrase '${spec.correctPhrase}' is already grammatically sound: ${spec.rule} Hence, 'No correction required'.`
    : `Replace '${spec.wrongPhrase}' with '${spec.correctPhrase}': ${spec.rule}`;

  return {
    topic: "Phrase Replacement",
    subType: subtopicKey,
    subtopicName: PHRASE_REPLACEMENT_SUBTOPICS[subtopicKey] || PHRASE_REPLACEMENT_SUBTOPICS.VERB_TENSE_REPLACEMENT,
    difficulty,
    questionText,
    options,
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
    explanation,
    _meta: {
      subType: subtopicKey,
      sentence,
      shownPhrase,
      correctPhrase: spec.correctPhrase,
      isNoCorrection,
    },
  };
}
