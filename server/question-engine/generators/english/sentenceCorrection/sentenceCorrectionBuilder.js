/**
 * Modular Banking Exam Sentence Correction Question Builder
 *
 * Covers 5 real IBPS PO / SBI PO / RBI Grade B subtopics:
 * 1. CORRECT_SENTENCE_CHOICE          — Choose the 1 grammatically correct full sentence among 5
 * 2. INCORRECT_SENTENCE_CHOICE        — Identify the 1 grammatically incorrect sentence among 5
 * 3. MODIFIER_CORRECTION              — Dangling & misplaced modifier full-sentence correction
 * 4. PARALLEL_COMPARISON_CORRECTION   — Illogical comparisons ('than that of') & parallel clauses
 * 5. SUBJUNCTIVE_CONDITIONAL_CORRECTION — Mandative subjunctive, Type-2/3 conditionals & verb mood
 */

export const SENTENCE_CORRECTION_SUBTOPICS = {
  CORRECT_SENTENCE_CHOICE: "Identify the Grammatically Correct Sentence",
  INCORRECT_SENTENCE_CHOICE: "Identify the Grammatically Incorrect Sentence",
  MODIFIER_CORRECTION: "Dangling & Misplaced Modifier Correction",
  PARALLEL_COMPARISON_CORRECTION: "Parallelism & Comparison Completeness",
  SUBJUNCTIVE_CONDITIONAL_CORRECTION: "Subjunctive & Conditional Sentence Clarity",
};

export function createScEngRng(seedInput) {
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

const BANKS = ["Apex Bank", "Horizon Bank", "Metro National Bank", "Union Commercial Bank"];
const CITIES = ["Mumbai", "Chennai", "Bengaluru", "Hyderabad", "Pune"];
const NAMES = ["Priya", "Aarav", "Kavya", "Rohan", "Meera", "Vikram"];

// 1. Choose the 1 Grammatically Correct Sentence
const CORRECT_CHOICE_TEMPLATES = [
  {
    build: (b, c) => ({
      correct: `Neither the branch clerks nor the regional manager of ${b} in ${c} was informed about the revised KYC deadline.`,
      incorrects: [
        `Neither the branch clerks nor the regional manager of ${b} in ${c} were informed about the revised KYC deadline.`,
        `Neither the branch clerks or the regional manager of ${b} in ${c} was informed about the revised KYC deadline.`,
        `Neither the branch clerks nor the regional manager of ${b} in ${c} have been informed about the revised KYC deadline.`,
        `Neither the branch clerks nor the regional manager of ${b} in ${c} was inform about the revised KYC deadline.`,
      ],
      rule: `'Neither...nor' takes a verb agreeing with the nearest subject ('the regional manager' — singular 'was informed').`,
    }),
  },
  {
    build: (b) => ({
      correct: `No sooner had ${b} launched its zero-fee digital savings account than retail applications doubled across rural districts.`,
      incorrects: [
        `No sooner had ${b} launched its zero-fee digital savings account when retail applications doubled across rural districts.`,
        `No sooner ${b} had launched its zero-fee digital savings account than retail applications doubled across rural districts.`,
        `No sooner had ${b} launch its zero-fee digital savings account than retail applications doubled across rural districts.`,
        `No sooner did ${b} launched its zero-fee digital savings account than retail applications doubled across rural districts.`,
      ],
      rule: `'No sooner' requires auxiliary inversion ('No sooner had + S + V3') and pairs strictly with 'than'.`,
    }),
  },
  {
    build: (b, c) => ({
      correct: `The number of small merchants adopting QR payments through ${b} in ${c} has increased steadily this year.`,
      incorrects: [
        `The number of small merchants adopting QR payments through ${b} in ${c} have increased steadily this year.`,
        `The number of small merchant adopting QR payments through ${b} in ${c} has increased steadily this year.`,
        `The number of small merchants adopting QR payments through ${b} in ${c} are increasing steadily this year.`,
        `The number of small merchants adopting QR payments through ${b} in ${c} has been increase steadily this year.`,
      ],
      rule: `'The number of + plural noun' always takes a singular verb ('has increased').`,
    }),
  },
  {
    build: (b) => ({
      correct: `Hardly had the statutory auditors submitted their report to ${b} when the board convened an emergency review.`,
      incorrects: [
        `Hardly had the statutory auditors submitted their report to ${b} than the board convened an emergency review.`,
        `Hardly the statutory auditors had submitted their report to ${b} when the board convened an emergency review.`,
        `Hardly had the statutory auditors submit their report to ${b} when the board convened an emergency review.`,
        `Hardly did the statutory auditors submitted their report to ${b} when the board convened an emergency review.`,
      ],
      rule: `'Hardly' requires inversion ('Hardly had + S + V3') and pairs strictly with 'when'.`,
    }),
  },
];

// 2. Pool of flawless sentences + single-error sentences for INCORRECT_SENTENCE_CHOICE
const FLAWLESS_BANKING_SENTENCES = [
  (b, c) => `Each of the regional branches of ${b} in ${c} undergoes an independent cybersecurity audit every quarter.`,
  (b) => `Although ${b} faced tighter liquidity in Q2, it maintained a healthy capital adequacy ratio.`,
  (_b, c) => `Salaried depositors in ${c} increasingly prefer instant mobile transfers to visiting physical bank counters.`,
  (b) => `The newly constituted risk committee at ${b} comprises five chartered accountants and two legal specialists.`,
  (b) => `Unless the borrower furnishes verified income documents by Friday, ${b} cannot disburse the housing loan.`,
  (_b, c) => `Following the digital-token rollout, retail branches in ${c} recorded fewer customer complaints than last year.`,
];

const SINGLE_ERROR_SENTENCES = [
  {
    build: (b) => `One of the senior auditors at ${b} have recommended stricter collateral norms for corporate loans.`,
    reason: `'One of the + plural noun' requires a singular verb ('has recommended', not 'have recommended').`,
  },
  {
    build: (b) => `Despite of facing higher deposit costs, ${b} expanded its rural credit portfolio this year.`,
    reason: `'Despite' is never followed by 'of' (use 'Despite facing' or 'In spite of facing').`,
  },
  {
    build: (_b, c) => `The zonal compliance officer has discussed about the new anti-money-laundering norms with ${c} branch heads.`,
    reason: `'discuss' is a transitive verb and does not take the redundant preposition 'about'.`,
  },
  {
    build: (b) => `It is high time that ${b} upgrades its legacy ATM switch to eliminate peak-hour timeouts.`,
    reason: `'It is high time + subject' requires the simple past tense ('upgraded', not 'upgrades').`,
  },
];

// 3. Dangling & Misplaced Modifier Correction
const MODIFIER_TEMPLATES = [
  {
    build: (b, _c, n) => ({
      correct: `Walking into the main lobby of ${b}, ${n} immediately noticed the newly installed self-service passbook kiosk.`,
      incorrects: [
        `Walking into the main lobby of ${b}, the newly installed self-service passbook kiosk immediately caught ${n}'s eye.`,
        `Walking into the main lobby of ${b}, it was the newly installed self-service passbook kiosk that ${n} noticed.`,
        `Having walked into the main lobby of ${b}, the newly installed self-service passbook kiosk was noticed immediately.`,
        `While walking into the main lobby of ${b}, the passbook kiosk stood directly in front of ${n}.`,
      ],
      rule: `The participial phrase 'Walking into the main lobby' must immediately precede the person performing the action ('${n}'), not 'the kiosk'.`,
    }),
  },
  {
    build: (b, _c, n) => ({
      correct: `Having reviewed all quarterly NPA statements, ${n} advised ${b} to tighten unsecured lending norms.`,
      incorrects: [
        `Having reviewed all quarterly NPA statements, unsecured lending norms were tightened by ${b} on ${n}'s advice.`,
        `Having reviewed all quarterly NPA statements, it was recommended by ${n} that ${b} tighten norms.`,
        `Reviewing all quarterly NPA statements, the recommendation to tighten norms was issued by ${n} to ${b}.`,
        `After reviewing all quarterly NPA statements, ${b}'s unsecured lending norms were advised by ${n} to be tightened.`,
      ],
      rule: `The subject immediately following 'Having reviewed...' must be the reviewer ('${n}'), avoiding a dangling modifier.`,
    }),
  },
  {
    build: (b, c) => ({
      correct: `Designed to prevent phishing attacks, the biometric login feature protects ${b}'s mobile users in ${c}.`,
      incorrects: [
        `Designed to prevent phishing attacks, ${b}'s mobile users in ${c} are protected by the biometric login feature.`,
        `Designed to prevent phishing attacks, customers in ${c} can safely use ${b}'s biometric login feature.`,
        `Designing to prevent phishing attacks, the biometric login feature protects ${b}'s mobile users in ${c}.`,
        `Designed for preventing phishing attacks, ${c}'s mobile users rely on ${b}'s biometric login feature.`,
      ],
      rule: `'Designed to prevent phishing attacks' must directly modify the noun that was designed ('the biometric login feature'), not 'users' or 'customers'.`,
    }),
  },
];

// 4. Parallelism & Illogical Comparison Correction
const PARALLEL_COMPARISON_TEMPLATES = [
  {
    build: (b) => ({
      correct: `The capital adequacy ratio of ${b} is significantly higher than that of most peer regional lenders.`,
      incorrects: [
        `The capital adequacy ratio of ${b} is significantly higher than most peer regional lenders.`,
        `The capital adequacy ratio of ${b} is significantly higher than those of most peer regional lenders.`,
        `The capital adequacy ratio of ${b} is more higher than that of most peer regional lenders.`,
        `The capital adequacy ratio of ${b} is significantly higher to that of most peer regional lenders.`,
      ],
      rule: `Compare like with like: 'ratio' (singular) must be compared with 'that of most peer regional lenders', not with the lenders themselves.`,
    }),
  },
  {
    build: (b, c) => ({
      correct: `The digital transaction volumes in ${c} far exceed those of neighboring semi-urban districts served by ${b}.`,
      incorrects: [
        `The digital transaction volumes in ${c} far exceed neighboring semi-urban districts served by ${b}.`,
        `The digital transaction volumes in ${c} far exceed that of neighboring semi-urban districts served by ${b}.`,
        `The digital transaction volumes in ${c} far exceeds those of neighboring semi-urban districts served by ${b}.`,
        `The digital transaction volumes in ${c} is far exceeding those of neighboring semi-urban districts served by ${b}.`,
      ],
      rule: `'volumes' (plural) requires the plural demonstrative pronoun 'those of' and the plural verb 'exceed'.`,
    }),
  },
  {
    build: (b) => ({
      correct: `To strengthen cyber resilience, ${b} plans to upgrade its firewalls, train branch staff, and audit third-party vendors.`,
      incorrects: [
        `To strengthen cyber resilience, ${b} plans to upgrade its firewalls, training branch staff, and auditing third-party vendors.`,
        `To strengthen cyber resilience, ${b} plans upgrading its firewalls, to train branch staff, and audit third-party vendors.`,
        `To strengthen cyber resilience, ${b} plans to upgrade its firewalls, train branch staff, and the auditing of third-party vendors.`,
        `To strengthen cyber resilience, ${b} plans to upgrading its firewalls, train branch staff, and audit third-party vendors.`,
      ],
      rule: `All three items in the infinitive series must stay parallel: 'to upgrade..., train..., and audit...'.`,
    }),
  },
];

// 5. Subjunctive & Conditional Sentence Clarity
const SUBJUNCTIVE_CONDITIONAL_TEMPLATES = [
  {
    build: (b) => ({
      correct: `The central regulator mandated that ${b} submit its reconciled liquidity statement before the close of business.`,
      incorrects: [
        `The central regulator mandated that ${b} submits its reconciled liquidity statement before the close of business.`,
        `The central regulator mandated that ${b} submitted its reconciled liquidity statement before the close of business.`,
        `The central regulator mandated that ${b} should submits its reconciled liquidity statement before the close of business.`,
        `The central regulator mandated that ${b} submitting its reconciled liquidity statement before the close of business.`,
      ],
      rule: `Verbs of mandate/demand ('mandated that') take the bare-infinitive mandative subjunctive ('submit', not 'submits').`,
    }),
  },
  {
    build: (b) => ({
      correct: `Had ${b} conducted an early cash-flow audit, it would have detected the borrower's liquidity stress in time.`,
      incorrects: [
        `Had ${b} conducted an early cash-flow audit, it would detect the borrower's liquidity stress in time.`,
        `If ${b} would have conducted an early cash-flow audit, it would have detected the borrower's liquidity stress in time.`,
        `Had ${b} conduct an early cash-flow audit, it would have detected the borrower's liquidity stress in time.`,
        `Would ${b} have conducted an early cash-flow audit, it had detected the borrower's liquidity stress in time.`,
      ],
      rule: `Inverted Type-3 conditional follows 'Had + S + V3, S + would have + V3'.`,
    }),
  },
  {
    build: (b) => ({
      correct: `The audit committee insisted that every branch manager verify high-value cheque endorsements personally.`,
      incorrects: [
        `The audit committee insisted that every branch manager verifies high-value cheque endorsements personally.`,
        `The audit committee insisted that every branch manager verified high-value cheque endorsements personally.`,
        `The audit committee insisted that every branch manager is verifying high-value cheque endorsements personally.`,
        `The audit committee insisted every branch manager to verifying high-value cheque endorsements personally.`,
      ],
      rule: `'insisted that' requires the bare-infinitive subjunctive ('verify', not 'verifies').`,
    }),
  },
];

export function buildSentenceCorrectionQuestion({
  subtopicKey = "CORRECT_SENTENCE_CHOICE",
  difficulty = "Medium",
  rng,
}) {
  const bank = rng.pick(BANKS);
  const city = rng.pick(CITIES);
  const name = rng.pick(NAMES);

  if (subtopicKey === "INCORRECT_SENTENCE_CHOICE") {
    const fourCorrect = rng.shuffle(FLAWLESS_BANKING_SENTENCES).slice(0, 4).map((fn) => ({
      text: fn(bank, city),
      isCorrect: true,
    }));
    const badSpec = rng.pick(SINGLE_ERROR_SENTENCES);
    const badObj = { text: badSpec.build(bank, city), isCorrect: false };
    const tagged = rng.shuffle([...fourCorrect, badObj]);
    const correctIndex = tagged.findIndex((o) => !o.isCorrect);

    const questionText =
      `Directions: Four of the five sentences given below are grammatically correct, while ONE sentence contains a grammatical error. Identify the INCORRECT sentence.`;

    return {
      topic: "Sentence Correction",
      subType: "INCORRECT_SENTENCE_CHOICE",
      subtopicName: SENTENCE_CORRECTION_SUBTOPICS.INCORRECT_SENTENCE_CHOICE,
      difficulty,
      questionText,
      options: tagged.map((o) => o.text),
      correctIndex,
      correctAnswer: String.fromCharCode(65 + correctIndex),
      explanation: `Option (${String.fromCharCode(65 + correctIndex)}) is grammatically incorrect: ${badSpec.reason}`,
      _meta: {
        subType: "INCORRECT_SENTENCE_CHOICE",
        mode: "FIND_INCORRECT",
        taggedOptions: tagged,
      },
    };
  }

  const tplMap = {
    CORRECT_SENTENCE_CHOICE: CORRECT_CHOICE_TEMPLATES,
    MODIFIER_CORRECTION: MODIFIER_TEMPLATES,
    PARALLEL_COMPARISON_CORRECTION: PARALLEL_COMPARISON_TEMPLATES,
    SUBJUNCTIVE_CONDITIONAL_CORRECTION: SUBJUNCTIVE_CONDITIONAL_TEMPLATES,
  };
  const list = tplMap[subtopicKey] || CORRECT_CHOICE_TEMPLATES;
  const spec = rng.pick(list).build(bank, city, name);

  const tagged = rng.shuffle([
    { text: spec.correct, isCorrect: true },
    ...spec.incorrects.map((t) => ({ text: t, isCorrect: false })),
  ]);
  const correctIndex = tagged.findIndex((o) => o.isCorrect);

  const questionText =
    `Directions: Five versions of a sentence are given below. Choose the ONLY sentence that is grammatically correct, concise, and structurally sound.`;

  return {
    topic: "Sentence Correction",
    subType: subtopicKey,
    subtopicName: SENTENCE_CORRECTION_SUBTOPICS[subtopicKey] || SENTENCE_CORRECTION_SUBTOPICS.CORRECT_SENTENCE_CHOICE,
    difficulty,
    questionText,
    options: tagged.map((o) => o.text),
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
    explanation: `Option (${String.fromCharCode(65 + correctIndex)}) is correct: ${spec.rule}`,
    _meta: {
      subType: subtopicKey,
      mode: "FIND_CORRECT",
      taggedOptions: tagged,
    },
  };
}
