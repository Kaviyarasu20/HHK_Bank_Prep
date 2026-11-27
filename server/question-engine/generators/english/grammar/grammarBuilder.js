/**
 * Modular Banking Exam Grammar Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam Grammar subtopics:
 * 1. ACTIVE_PASSIVE_VOICE          — Tense-preserving Active ↔ Passive transformations
 * 2. DIRECT_INDIRECT_SPEECH        — Exact reported-speech backshifting, interrogatives & imperatives
 * 3. TENSE_MODAL_GRAMMAR           — Future/Past Perfect, Conditionals, Modals & Gerunds
 * 4. ARTICLES_DETERMINERS          — Phonetic a/an, definite 'the', few/a few, little/a little
 * 5. PREPOSITIONS_CONJUNCTIONS_TAGS — Fixed prepositions, correlatives, since/for & Question Tags
 */

export const GRAMMAR_SUBTOPICS = {
  ACTIVE_PASSIVE_VOICE: "Active & Passive Voice Transformation",
  DIRECT_INDIRECT_SPEECH: "Direct & Indirect Speech",
  TENSE_MODAL_GRAMMAR: "Tenses, Conditionals & Modals",
  ARTICLES_DETERMINERS: "Articles, Determiners & Quantifiers",
  PREPOSITIONS_CONJUNCTIONS_TAGS: "Prepositions, Conjunctions & Question Tags",
};

export function createGrammarRng(seedInput) {
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

const BANKS = ["Apex Bank", "Horizon Bank", "Metro Bank", "Union Commercial Bank"];
const OFFICERS = ["the branch manager", "the chief auditor", "the zonal head", "the credit officer"];

function shuffleOptionsWithAnswer(correctText, distractorTexts, rng) {
  const unique = new Set([String(correctText).toLowerCase()]);
  const pool = [];
  for (const d of distractorTexts) {
    const low = String(d || "").trim().toLowerCase();
    if (low && !unique.has(low)) {
      unique.add(low);
      pool.push(String(d).trim());
    }
    if (pool.length === 4) break;
  }
  if (pool.length < 4) return null;
  const all = rng.shuffle([String(correctText).trim(), ...pool]);
  const correctIndex = all.indexOf(String(correctText).trim());
  return {
    options: all,
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
  };
}

// 1. Active & Passive Voice
const VOICE_TEMPLATES = [
  {
    ruleTag: "VOICE_PRESENT_CONT",
    build: (b) => ({
      prompt: `Convert the following sentence into Passive Voice:\n"${b} is auditing all high-value corporate accounts this week."`,
      answer: `All high-value corporate accounts are being audited by ${b} this week.`,
      distractors: [
        `All high-value corporate accounts are audited by ${b} this week.`,
        `All high-value corporate accounts were being audited by ${b} this week.`,
        `All high-value corporate accounts have been audited by ${b} this week.`,
        `All high-value corporate accounts is being audited by ${b} this week.`,
      ],
      explanation: `Present Continuous Active ('is auditing') converts to Passive as 'are being + V3' ('are being audited') to agree with the plural subject 'accounts'.`,
    }),
  },
  {
    ruleTag: "VOICE_PRESENT_PERFECT",
    build: (b) => ({
      prompt: `Convert the following sentence into Passive Voice:\n"${b} has approved three green-energy infrastructure loans."`,
      answer: `Three green-energy infrastructure loans have been approved by ${b}.`,
      distractors: [
        `Three green-energy infrastructure loans has been approved by ${b}.`,
        `Three green-energy infrastructure loans were approved by ${b}.`,
        `Three green-energy infrastructure loans are being approved by ${b}.`,
        `Three green-energy infrastructure loans had been approved by ${b}.`,
      ],
      explanation: `Present Perfect Active ('has approved') becomes 'have been + V3' ('have been approved') with the plural passive subject.`,
    }),
  },
  {
    ruleTag: "VOICE_SIMPLE_PAST",
    build: (_b, o) => ({
      prompt: `Convert the following sentence into Passive Voice:\n"${o.charAt(0).toUpperCase() + o.slice(1)} signed the revised KYC circular yesterday."`,
      answer: `The revised KYC circular was signed by ${o} yesterday.`,
      distractors: [
        `The revised KYC circular is signed by ${o} yesterday.`,
        `The revised KYC circular had been signed by ${o} yesterday.`,
        `The revised KYC circular was being signed by ${o} yesterday.`,
        `The revised KYC circular were signed by ${o} yesterday.`,
      ],
      explanation: `Simple Past Active ('signed') converts to Passive as 'was/were + V3' ('was signed').`,
    }),
  },
  {
    ruleTag: "VOICE_MODAL_MUST",
    build: () => ({
      prompt: `Convert the following sentence into Passive Voice:\n"Every scheduled bank must report cyber incidents within six hours."`,
      answer: `Cyber incidents must be reported by every scheduled bank within six hours.`,
      distractors: [
        `Cyber incidents must have been reported by every scheduled bank within six hours.`,
        `Cyber incidents are reported by every scheduled bank within six hours.`,
        `Cyber incidents must being reported by every scheduled bank within six hours.`,
        `Cyber incidents should be reported by every scheduled bank within six hours.`,
      ],
      explanation: `Modal Active ('must + V1') converts to Passive as 'must be + V3' ('must be reported').`,
    }),
  },
];

// 2. Direct & Indirect Speech
const SPEECH_TEMPLATES = [
  {
    ruleTag: "SPEECH_PRESENT_CONT_BACKSHIFT",
    build: (_b, o) => ({
      prompt: `Convert the following sentence into Indirect (Reported) Speech:\n${o.charAt(0).toUpperCase() + o.slice(1)} said, "We are upgrading the ATM switch today."`,
      answer: `${o.charAt(0).toUpperCase() + o.slice(1)} said that they were upgrading the ATM switch that day.`,
      distractors: [
        `${o.charAt(0).toUpperCase() + o.slice(1)} said that they are upgrading the ATM switch today.`,
        `${o.charAt(0).toUpperCase() + o.slice(1)} said that we were upgrading the ATM switch that day.`,
        `${o.charAt(0).toUpperCase() + o.slice(1)} said that they had upgraded the ATM switch that day.`,
        `${o.charAt(0).toUpperCase() + o.slice(1)} said that they were upgrading the ATM switch today.`,
      ],
      explanation: `With a past reporting verb ('said'), Present Continuous ('are upgrading') backshifts to Past Continuous ('were upgrading'), 'We' becomes 'they', and 'today' becomes 'that day'.`,
    }),
  },
  {
    ruleTag: "SPEECH_INTERROGATIVE_IF",
    build: (_b, o) => ({
      prompt: `Convert the following sentence into Indirect Speech:\n${o.charAt(0).toUpperCase() + o.slice(1)} asked the applicant, "Have you submitted your income proof?"`,
      answer: `${o.charAt(0).toUpperCase() + o.slice(1)} asked the applicant whether he had submitted his income proof.`,
      distractors: [
        `${o.charAt(0).toUpperCase() + o.slice(1)} asked the applicant that whether he had submitted his income proof.`,
        `${o.charAt(0).toUpperCase() + o.slice(1)} asked the applicant whether had he submitted his income proof.`,
        `${o.charAt(0).toUpperCase() + o.slice(1)} asked the applicant if he has submitted his income proof.`,
        `${o.charAt(0).toUpperCase() + o.slice(1)} told the applicant whether he submitted his income proof.`,
      ],
      explanation: `Yes/No interrogatives use 'if/whether' (never 'that whether'), assertive word order ('he had submitted'), and Present Perfect backshifts to Past Perfect.`,
    }),
  },
  {
    ruleTag: "SPEECH_FUTURE_TOMORROW",
    build: (b) => ({
      prompt: `Convert the following sentence into Indirect Speech:\nThe spokesperson of ${b} announced, "We will publish the quarterly results tomorrow."`,
      answer: `The spokesperson of ${b} announced that they would publish the quarterly results the next day.`,
      distractors: [
        `The spokesperson of ${b} announced that they will publish the quarterly results tomorrow.`,
        `The spokesperson of ${b} announced that they would publish the quarterly results tomorrow.`,
        `The spokesperson of ${b} announced that they should publish the quarterly results the previous day.`,
        `The spokesperson of ${b} announced that we would published the quarterly results the next day.`,
      ],
      explanation: `'will' backshifts to 'would' and 'tomorrow' shifts to 'the next day'.`,
    }),
  },
  {
    ruleTag: "SPEECH_IMPERATIVE_ADVISED",
    build: () => ({
      prompt: `Convert the following sentence into Indirect Speech:\nThe security officer advised the staff, "Do not click on unverified email attachments."`,
      answer: `The security officer advised the staff not to click on unverified email attachments.`,
      distractors: [
        `The security officer advised the staff to not clicked on unverified email attachments.`,
        `The security officer advised the staff that do not click on unverified email attachments.`,
        `The security officer advised the staff didn't click on unverified email attachments.`,
        `The security officer advised the staff not clicking on unverified email attachments.`,
      ],
      explanation: `Negative imperatives convert cleanly to 'not to + V1' ('not to click').`,
    }),
  },
];

// 3. Tenses, Conditionals & Modals
const TENSE_MODAL_TEMPLATES = [
  {
    ruleTag: "TENSE_FUTURE_PERFECT",
    build: (b) => ({
      prompt: `Choose the grammatically correct verb form to complete the sentence:\nBy the end of next quarter, ${b} _____ its core-banking migration across all rural branches.`,
      answer: `will have completed`,
      distractors: [`will completed`, `has completed`, `was completing`, `had been completing`],
      explanation: `'By + future time point' ('By the end of next quarter') requires Future Perfect ('will have + V3').`,
    }),
  },
  {
    ruleTag: "TENSE_PAST_PERFECT_BEFORE_PAST",
    build: () => ({
      prompt: `Choose the grammatically correct verb form to complete the sentence:\nThe clearing window _____ by the time the courier arrived with the outstation cheques.`,
      answer: `had already closed`,
      distractors: [`has already closed`, `was already close`, `already closes`, `will already close`],
      explanation: `The earlier of two past actions takes Past Perfect ('had already closed'), while the later action takes Simple Past ('arrived').`,
    }),
  },
  {
    ruleTag: "MODAL_BE_USED_TO_GERUND",
    build: (_b, o) => ({
      prompt: `Choose the grammatically correct form to complete the sentence:\nHaving worked in treasury operations for ten years, ${o} is used to _____ tight settlement deadlines.`,
      answer: `handling`,
      distractors: [`handle`, `handled`, `handles`, `be handle`],
      explanation: `'be used to' (meaning 'accustomed to') takes a gerund ('handling'), unlike 'used to + V1' (past habit).`,
    }),
  },
  {
    ruleTag: "CONDITIONAL_TYPE2_WERE",
    build: () => ({
      prompt: `Choose the grammatically correct form to complete the sentence:\nIf the inflation rate _____ significantly lower today, the committee would cut the repo rate immediately.`,
      answer: `were`,
      distractors: [`is`, `will be`, `has been`, `would be`],
      explanation: `Type-2 hypothetical conditional uses subjunctive 'were' in the if-clause paired with 'would + V1' in the main clause.`,
    }),
  },
];

// 4. Articles, Determiners & Quantifiers
const ARTICLES_TEMPLATES = [
  {
    ruleTag: "ARTICLE_PHONETIC_AN_RBI",
    build: () => ({
      prompt: `Choose the correct pair of articles to complete the sentence:\nThe compliance desk issued _____ RBI circular following _____ unanimous resolution by the board.`,
      answer: `an / a`,
      distractors: [`a / an`, `a / a`, `an / an`, `the / an`],
      explanation: `'RBI' begins with a vowel sound ('ar-bee-eye') → 'an'; 'unanimous' begins with a consonant 'yoo' sound → 'a'.`,
    }),
  },
  {
    ruleTag: "ARTICLE_PARALLEL_COMPARATIVE",
    build: () => ({
      prompt: `Choose the correct pair of articles to complete the sentence:\n_____ higher the borrower's credit score, _____ lower the interest rate offered on the home loan.`,
      answer: `The / the`,
      distractors: [`A / a`, `The / a`, `A / the`, `An / the`],
      explanation: `Parallel double comparatives always require the definite article 'The ... the ...'.`,
    }),
  },
  {
    ruleTag: "QUANTIFIER_A_FEW_COUNTABLE",
    build: (b) => ({
      prompt: `Choose the correct determiner to complete the sentence:\nAlthough most depositors prefer mobile banking, _____ senior citizens at ${b} still visit the branch for passbook printing.`,
      answer: `a few`,
      distractors: [`a little`, `much`, `little`, `less`],
      explanation: `'senior citizens' is a countable plural noun with a positive sense ('some'), requiring 'a few' (not 'a little' or 'less').`,
    }),
  },
  {
    ruleTag: "QUANTIFIER_LITTLE_UNCOUNTABLE",
    build: () => ({
      prompt: `Choose the correct determiner to complete the sentence:\nBecause the audit deadline is only an hour away, there is very _____ time left to verify additional invoices.`,
      answer: `little`,
      distractors: [`few`, `many`, `several`, `a few`],
      explanation: `'time' is uncountable and the context emphasizes scarcity ('only an hour away'), requiring 'little'.`,
    }),
  },
];

// 5. Prepositions, Conjunctions & Question Tags
const PREP_CONJ_TAG_TEMPLATES = [
  {
    ruleTag: "TAG_EVERYONE_PLURAL",
    build: (b) => ({
      prompt: `Choose the grammatically correct question tag for the sentence below:\nEveryone in the ${b} audit team attended the cybersecurity briefing, _____?`,
      answer: `didn't they`,
      distractors: [`didn't he`, `did they`, `wasn't it`, `haven't they`],
      explanation: `Indefinite pronouns like 'Everyone' take a plural pronoun ('they') in question tags; positive past 'attended' takes negative 'didn't they'.`,
    }),
  },
  {
    ruleTag: "TAG_HARDLY_POSITIVE",
    build: () => ({
      prompt: `Choose the grammatically correct question tag for the sentence below:\nHardly anyone complained about the scheduled midnight maintenance, _____?`,
      answer: `did they`,
      distractors: [`didn't they`, `did he`, `wasn't it`, `didn't anyone`],
      explanation: `'Hardly' gives the statement a negative sense, so the question tag must be positive ('did they').`,
    }),
  },
  {
    ruleTag: "PREP_SINCE_VS_FOR",
    build: (b) => ({
      prompt: `Choose the correct pair of prepositions to complete the sentence:\n${b} has operated its regional treasury desk in Mumbai _____ 2018 and has maintained zero audit defaults _____ eight consecutive years.`,
      answer: `since / for`,
      distractors: [`for / since`, `from / since`, `since / from`, `during / since`],
      explanation: `'since' is used with an exact starting point ('2018'); 'for' is used with a duration ('eight consecutive years').`,
    }),
  },
  {
    ruleTag: "PREP_BETWEEN_VS_AMONG",
    build: () => ({
      prompt: `Choose the correct pair of prepositions to complete the sentence:\nThe merger agreement was signed _____ the two regional banks, and the bonus pool was distributed _____ all five zonal teams.`,
      answer: `between / among`,
      distractors: [`among / between`, `between / between`, `among / among`, `into / among`],
      explanation: `'between' is used for two distinct parties; 'among' is used for distribution across three or more groups.`,
    }),
  },
];

export function buildGrammarQuestion({
  subtopicKey = "ACTIVE_PASSIVE_VOICE",
  difficulty = "Medium",
  rng,
}) {
  const bank = rng.pick(BANKS);
  const officer = rng.pick(OFFICERS);
  const poolMap = {
    ACTIVE_PASSIVE_VOICE: VOICE_TEMPLATES,
    DIRECT_INDIRECT_SPEECH: SPEECH_TEMPLATES,
    TENSE_MODAL_GRAMMAR: TENSE_MODAL_TEMPLATES,
    ARTICLES_DETERMINERS: ARTICLES_TEMPLATES,
    PREPOSITIONS_CONJUNCTIONS_TAGS: PREP_CONJ_TAG_TEMPLATES,
  };
  const list = poolMap[subtopicKey] || VOICE_TEMPLATES;
  const tpl = rng.pick(list);
  const spec = tpl.build(bank, officer);
  const packed = shuffleOptionsWithAnswer(spec.answer, spec.distractors, rng);
  if (!packed) return null;

  return {
    topic: "Grammar",
    subType: subtopicKey,
    subtopicName: GRAMMAR_SUBTOPICS[subtopicKey] || GRAMMAR_SUBTOPICS.ACTIVE_PASSIVE_VOICE,
    difficulty,
    questionText: spec.prompt,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation: spec.explanation,
    _meta: {
      subType: subtopicKey,
      ruleTag: tpl.ruleTag,
      expectedAnswer: spec.answer,
    },
  };
}
