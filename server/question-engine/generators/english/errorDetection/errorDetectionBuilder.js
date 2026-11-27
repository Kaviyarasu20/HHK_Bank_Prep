/**
 * Modular Banking Exam Error Detection Question Builder
 *
 * Covers 5 high-frequency IBPS / SBI / RRB / RBI grammar rule families:
 * 1. SUBJECT_VERB_AGREEMENT   — Each/One of, Neither-nor, Along with, The number of vs A number of
 * 2. TENSE_CONDITIONALS       — Type-3 conditionals, Hardly..when, No sooner..than, Since/For, High time
 * 3. PREPOSITIONS_PHRASAL     — Prefer to, Senior to, Comprise (no of), Discuss (no about), Cope with
 * 4. PRONOUNS_MODIFIERS       — Between you and me, One..one's, Fewer vs Less, Double comparative
 * 5. PARALLELISM_CONJUNCTIONS — Although..yet (no but), Lest..should, Unless (no not), Negative inversion
 */

import { assembleErrorDetectionItem } from "./solver.js";

export const ERROR_DETECTION_SUBTOPICS = {
  SUBJECT_VERB_AGREEMENT: "Subject–Verb Agreement",
  TENSE_CONDITIONALS: "Tenses, Conditionals & Correlatives",
  PREPOSITIONS_PHRASAL: "Prepositions & Phrasal Verbs",
  PRONOUNS_MODIFIERS: "Pronouns, Articles & Modifiers",
  PARALLELISM_CONJUNCTIONS: "Parallelism, Conjunctions & Inversion",
};

export function createErrorDetRng(seedInput) {
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

const BANKS = ["the public sector bank", "the regional rural bank", "the apex financial institution", "the commercial bank"];
const OFFICERS = ["the branch manager", "the senior auditor", "the chief credit officer", "the compliance head"];
const PLURAL_DOCS = ["quarterly audit reports", "loan sanction files", "digital KYC applications", "branch compliance records"];
const CITIES = ["Mumbai", "Chennai", "Bengaluru", "Hyderabad", "Pune", "Kolkata"];

const TEMPLATES = {
  SUBJECT_VERB_AGREEMENT: [
    {
      ruleCode: "SVA_ONE_OF",
      build: (rng) => {
        const docs = rng.pick(PLURAL_DOCS);
        const city = rng.pick(CITIES);
        return {
          segments: [
            `One of the ${docs}`,
            `submitted by the ${city} zone`,
            `has been flagged for`,
            `immediate regulatory review.`,
          ],
          errorSlot: 2,
          errorVariant: `have been flagged for`,
          correction: `Replace 'have been' with 'has been' — 'One of the + plural noun' always takes a singular verb.`,
        };
      },
    },
    {
      ruleCode: "SVA_NEITHER_NOR",
      build: (rng) => {
        const off = rng.pick(OFFICERS);
        return {
          segments: [
            `Neither the junior clerks`,
            `nor ${off}`,
            `was aware of the sudden`,
            `revision in interest slabs.`,
          ],
          errorSlot: 2,
          errorVariant: `were aware of the sudden`,
          correction: `Replace 'were' with 'was' — with 'Neither...nor', the verb agrees with the nearest subject ('${off}', singular).`,
        };
      },
    },
    {
      ruleCode: "SVA_ALONG_WITH",
      build: (rng) => {
        const off = rng.pick(OFFICERS);
        return {
          segments: [
            `${off.charAt(0).toUpperCase() + off.slice(1)}, along with`,
            `three regional inspectors,`,
            `is scheduled to visit`,
            `the rural branches tomorrow.`,
          ],
          errorSlot: 2,
          errorVariant: `are scheduled to visit`,
          correction: `Replace 'are' with 'is' — subjects joined by 'along with' take a verb agreeing with the first subject (singular).`,
        };
      },
    },
    {
      ruleCode: "SVA_THE_NUMBER_OF",
      build: (rng) => {
        const city = rng.pick(CITIES);
        return {
          segments: [
            `The number of digital`,
            `payment transactions in ${city}`,
            `has risen sharply`,
            `over the last two quarters.`,
          ],
          errorSlot: 2,
          errorVariant: `have risen sharply`,
          correction: `Replace 'have risen' with 'has risen' — 'The number of + plural noun' always takes a singular verb.`,
        };
      },
    },
    {
      ruleCode: "SVA_EACH_OF",
      build: (rng) => {
        const docs = rng.pick(PLURAL_DOCS);
        return {
          segments: [
            `Each of the ${docs}`,
            `prepared before the deadline`,
            `requires a digital signature`,
            `from the zonal head.`,
          ],
          errorSlot: 2,
          errorVariant: `require a digital signature`,
          correction: `Replace 'require' with 'requires' — 'Each of the + plural noun' takes a singular verb.`,
        };
      },
    },
  ],

  TENSE_CONDITIONALS: [
    {
      ruleCode: "TENSE_NO_SOONER_THAN",
      build: (rng) => {
        const bank = rng.pick(BANKS);
        return {
          segments: [
            `No sooner had ${bank}`,
            `announced the repo-linked rate cut`,
            `than retail home-loan inquiries`,
            `surged across all branches.`,
          ],
          errorSlot: 2,
          errorVariant: `when retail home-loan inquiries`,
          correction: `Replace 'when' with 'than' — the correlative pair is always 'No sooner ... than'.`,
        };
      },
    },
    {
      ruleCode: "TENSE_HARDLY_WHEN",
      build: (rng) => {
        const off = rng.pick(OFFICERS);
        return {
          segments: [
            `Hardly had ${off}`,
            `completed the morning briefing`,
            `when the central server`,
            `triggered a security alert.`,
          ],
          errorSlot: 2,
          errorVariant: `than the central server`,
          correction: `Replace 'than' with 'when' — 'Hardly / Scarcely' is always paired with 'when' (or 'before'), never 'than'.`,
        };
      },
    },
    {
      ruleCode: "TENSE_TYPE3_CONDITIONAL",
      build: (rng) => {
        const bank = rng.pick(BANKS);
        return {
          segments: [
            `If ${bank} had`,
            `audited the collateral earlier,`,
            `it would have avoided`,
            `the heavy quarterly write-off.`,
          ],
          errorSlot: 0,
          errorVariant: `If ${bank} would have`,
          correction: `Replace 'would have' with 'had' in the 'if'-clause — Type-3 conditional follows 'If + S + had + V3, S + would have + V3'.`,
        };
      },
    },
    {
      ruleCode: "TENSE_HIGH_TIME",
      build: (rng) => {
        const bank = rng.pick(BANKS);
        return {
          segments: [
            `It is high time`,
            `that ${bank} upgraded`,
            `its legacy ATM switch`,
            `to prevent peak-hour timeouts.`,
          ],
          errorSlot: 1,
          errorVariant: `that ${bank} upgrades`,
          correction: `Replace 'upgrades' with 'upgraded' — 'It is high time + subject' always takes the simple past tense (V2).`,
        };
      },
    },
    {
      ruleCode: "TENSE_SINCE_PERFECT_CONT",
      build: (rng) => {
        const off = rng.pick(OFFICERS);
        const city = rng.pick(CITIES);
        return {
          segments: [
            `${off.charAt(0).toUpperCase() + off.slice(1)}`,
            `has been working at`,
            `the ${city} regional office`,
            `since January 2021.`,
          ],
          errorSlot: 1,
          errorVariant: `is working at`,
          correction: `Replace 'is working' with 'has been working' — an action continuing from a past point ('since 2021') requires Present Perfect Continuous.`,
        };
      },
    },
  ],

  PREPOSITIONS_PHRASAL: [
    {
      ruleCode: "PREP_PREFER_TO",
      build: (rng) => {
        const city = rng.pick(CITIES);
        return {
          segments: [
            `Most salaried depositors in ${city}`,
            `prefer instant UPI transfers`,
            `to visiting physical branches`,
            `for routine utility payments.`,
          ],
          errorSlot: 2,
          errorVariant: `than visiting physical branches`,
          correction: `Replace 'than' with 'to' — the verb 'prefer' is always followed by 'to', never 'than'.`,
        };
      },
    },
    {
      ruleCode: "PREP_COMPRISE_NO_OF",
      build: (rng) => {
        const bank = rng.pick(BANKS);
        return {
          segments: [
            `The newly formed audit panel`,
            `at ${bank}`,
            `comprises five chartered accountants`,
            `and two cybersecurity specialists.`,
          ],
          errorSlot: 2,
          errorVariant: `comprises of five chartered accountants`,
          correction: `Remove 'of' after 'comprises' — in active voice, 'comprise' means 'consist of' and takes no 'of'.`,
        };
      },
    },
    {
      ruleCode: "PREP_DISCUSS_NO_ABOUT",
      build: (rng) => {
        const off = rng.pick(OFFICERS);
        return {
          segments: [
            `During the board meeting,`,
            `${off} discussed`,
            `the new MSME credit framework`,
            `with all zonal representatives.`,
          ],
          errorSlot: 1,
          errorVariant: `${off} discussed about`,
          correction: `Remove 'about' after 'discussed' — 'discuss' is a transitive verb and does not take the preposition 'about'.`,
        };
      },
    },
    {
      ruleCode: "PREP_SENIOR_TO",
      build: (rng) => {
        const city = rng.pick(CITIES);
        return {
          segments: [
            `Although younger in age,`,
            `the newly appointed ${city} head`,
            `is senior to most officers`,
            `in the regional cadre.`,
          ],
          errorSlot: 2,
          errorVariant: `is senior than most officers`,
          correction: `Replace 'than' with 'to' — Latin comparatives ('senior, junior, superior, inferior') always take 'to'.`,
        };
      },
    },
    {
      ruleCode: "PREP_COPE_WITH",
      build: (rng) => {
        const bank = rng.pick(BANKS);
        return {
          segments: [
            `Additional servers were deployed`,
            `so that ${bank} could`,
            `cope with the festival rush`,
            `without any payment delays.`,
          ],
          errorSlot: 2,
          errorVariant: `cope up with the festival rush`,
          correction: `Replace 'cope up with' with 'cope with' — 'cope up with' is non-standard in formal banking English.`,
        };
      },
    },
  ],

  PRONOUNS_MODIFIERS: [
    {
      ruleCode: "PRON_BETWEEN_OBJECTIVE",
      build: (rng) => {
        const off = rng.pick(OFFICERS);
        return {
          segments: [
            `The confidential merger memo`,
            `was meant to remain strictly`,
            `between ${off} and me`,
            `until the board announcement.`,
          ],
          errorSlot: 2,
          errorVariant: `between ${off} and I`,
          correction: `Replace 'I' with 'me' — prepositions like 'between' always take the objective pronoun case ('me').`,
        };
      },
    },
    {
      ruleCode: "PRON_ONE_ONES",
      build: () => ({
        segments: [
          `One must regularly review`,
          `one's monthly credit report`,
          `to detect unauthorized inquiries`,
          `at the earliest possible stage.`,
        ],
        errorSlot: 1,
        errorVariant: `his monthly credit report`,
        correction: `Replace 'his' with 'one's' — the indefinite pronoun 'one' must be followed consistently by 'one's'.`,
      }),
    },
    {
      ruleCode: "MOD_FEWER_VS_LESS",
      build: (rng) => {
        const city = rng.pick(CITIES);
        return {
          segments: [
            `Following the app redesign,`,
            `branches in ${city} received`,
            `fewer billing complaints`,
            `than in the previous quarter.`,
          ],
          errorSlot: 2,
          errorVariant: `less billing complaints`,
          correction: `Replace 'less' with 'fewer' — 'complaints' is a countable plural noun, so 'fewer' is required.`,
        };
      },
    },
    {
      ruleCode: "MOD_DOUBLE_COMPARATIVE",
      build: (rng) => {
        const bank = rng.pick(BANKS);
        return {
          segments: [
            `The revised digital portal`,
            `launched by ${bank}`,
            `is much faster and simpler`,
            `than the legacy interface.`,
          ],
          errorSlot: 2,
          errorVariant: `is more faster and simpler`,
          correction: `Replace 'more faster' with 'much faster' (or 'faster') — avoid double comparatives.`,
        };
      },
    },
  ],

  PARALLELISM_CONJUNCTIONS: [
    {
      ruleCode: "CONJ_ALTHOUGH_NO_BUT",
      build: (rng) => {
        const bank = rng.pick(BANKS);
        return {
          segments: [
            `Although ${bank} faced`,
            `higher deposit costs this year,`,
            `yet it maintained a healthy`,
            `capital adequacy ratio.`,
          ],
          errorSlot: 2,
          errorVariant: `but it maintained a healthy`,
          correction: `Replace 'but' with 'yet' (or omit 'but') — 'Although / Though' is never paired with 'but'.`,
        };
      },
    },
    {
      ruleCode: "CONJ_LEST_SHOULD",
      build: (rng) => {
        const off = rng.pick(OFFICERS);
        return {
          segments: [
            `${off.charAt(0).toUpperCase() + off.slice(1)} double-checked`,
            `every wire-transfer instruction`,
            `lest an incorrect account number`,
            `should cause a settlement failure.`,
          ],
          errorSlot: 3,
          errorVariant: `will cause a settlement failure.`,
          correction: `Replace 'will' with 'should' — the conjunction 'lest' is always followed by 'should' (and never 'not').`,
        };
      },
    },
    {
      ruleCode: "CONJ_UNLESS_NO_NOT",
      build: () => ({
        segments: [
          `Unless the borrower submits`,
          `the verified income proof`,
          `before Friday afternoon,`,
          `the loan cannot be disbursed.`,
        ],
        errorSlot: 0,
        errorVariant: `Unless the borrower does not submit`,
        correction: `Remove 'does not' — 'unless' already carries a negative meaning ('if not'), so adding 'not' creates a double negative.`,
      }),
    },
    {
      ruleCode: "INV_SELDOM_HAVE",
      build: (rng) => {
        const bank = rng.pick(BANKS);
        return {
          segments: [
            `Seldom have analysts seen`,
            `${bank} achieve such rapid`,
            `recovery in stressed assets`,
            `within a single fiscal year.`,
          ],
          errorSlot: 0,
          errorVariant: `Seldom analysts have seen`,
          correction: `Use inversion 'Seldom have analysts seen' — starting a sentence with a negative adverb ('Seldom, Never, Rarely') requires auxiliary-subject inversion.`,
        };
      },
    },
  ],
};

export function buildErrorDetectionQuestion({
  subtopicKey = "SUBJECT_VERB_AGREEMENT",
  difficulty = "Medium",
  forceNoError = false,
  rng,
}) {
  const familyTemplates = TEMPLATES[subtopicKey] || TEMPLATES.SUBJECT_VERB_AGREEMENT;
  const tpl = rng.pick(familyTemplates);
  const spec = tpl.build(rng);

  const isNoError = forceNoError || rng() < 0.2;
  const slot = isNoError ? 4 : spec.errorSlot;

  const item = assembleErrorDetectionItem({
    segments: spec.segments,
    errorSlot: slot,
    errorVariant: spec.errorVariant,
    ruleCode: tpl.ruleCode,
    correction: spec.correction,
  });

  const formattedSentence =
    `(A) ${item.segments[0]} / (B) ${item.segments[1]} / (C) ${item.segments[2]} / (D) ${item.segments[3]} / (E) No error`;

  const questionText =
    `Directions: Read the sentence below to find out whether there is any grammatical error in it. The error, if any, will be in one part of the sentence. If there is no error, choose option (E) 'No error'.\n\n` +
    `${formattedSentence}`;

  const explanation = item.isNoError
    ? `All four parts of the sentence are grammatically sound and follow standard banking-exam usage (${tpl.ruleCode}). Hence, option (E) 'No error' is correct.`
    : `Error in part (${item.correctAnswer}): ${item.correction}`;

  return {
    topic: "Error Detection",
    subType: subtopicKey,
    subtopicName: ERROR_DETECTION_SUBTOPICS[subtopicKey] || ERROR_DETECTION_SUBTOPICS.SUBJECT_VERB_AGREEMENT,
    difficulty,
    questionText,
    options: item.options,
    correctIndex: item.correctIndex,
    correctAnswer: item.correctAnswer,
    explanation,
    _meta: {
      subType: subtopicKey,
      ruleCode: tpl.ruleCode,
      segments: item.segments,
      correctSegments: item.correctSegments,
      errorSlot: item.errorSlot,
    },
  };
}
