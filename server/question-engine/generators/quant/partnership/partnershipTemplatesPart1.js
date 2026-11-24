// Place at: server/question-engine/generators/quant/partnership/partnershipTemplatesPart1.js
import {
  R,
  ZERO,
  formatINR,
  reduceMultiRatio,
  buildFivePartnerOptions,
} from "./partnershipMath.js";

const NAMES = [
  "Aarav", "Bhavna", "Chirag", "Deepak", "Esha", "Farhan",
  "Gauri", "Harsh", "Ishaan", "Jaya", "Karan", "Meera",
  "Nikhil", "Priya", "Rohan", "Sneha", "Tanvi", "Vikram",
];

function pickPartners(rng, count = 2) {
  return rng.shuffle(NAMES).slice(0, count);
}

export function assemblePartnerQ({
  templateId,
  question_type,
  sub_type,
  difficulty,
  exam_level,
  question,
  mathModel,
  exactRationalAnswer = null,
  ratioAnswer = null,
  ratioFormat = null,
  plausible = [],
  isCurrency = false,
  unit = "",
  maxVal = null,
  solution,
  shortcut_method = "",
  rng,
}) {
  const built = buildFivePartnerOptions(exactRationalAnswer, plausible, {
    isCurrency,
    unit,
    rng,
    ratioFormat,
    maxVal,
  });

  return {
    templateId,
    question_type,
    sub_type,
    difficulty,
    exam_level,
    question,
    mathModel,
    exactRationalAnswer,
    ratioAnswer,
    isCurrency,
    unit,
    options: built.optionsObj,
    optionsArray: built.optionsArray,
    correct_answer: built.correctKey,
    correctOptionIndex: built.correctOptionIndex,
    correct_answer_value: built.correctValue,
    solution,
    shortcut_method,
  };
}

// ============================================================================
// CATEGORY A: Basic Partnership (A1–A4)
// ============================================================================

// A1. Find Profit-Sharing Ratio (Equal Duration)
function genA1_ProfitSharingRatio(rng, difficulty) {
  const pairs = [
    [24000, 36000], [35000, 49000], [42000, 56000], [45000, 60000],
    [28000, 42000], [32000, 48000], [54000, 72000], [25000, 40000],
  ];
  const [c1, c2] = rng.pick(pairs);
  const [p1, p2] = pickPartners(rng, 2);
  const red = reduceMultiRatio([c1, c2]);
  const rev = `${red.parts[1]} : ${red.parts[0]}`;

  return assemblePartnerQ({
    templateId: "PART_A1_PROFIT_RATIO",
    question_type: "Basic Partnership",
    sub_type: "Find Profit-Sharing Ratio",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `${p1} and ${p2} start a business together by investing ${formatINR(c1)} and ${formatINR(c2)} respectively for 1 year. In what ratio will they share the annual profit?`,
    mathModel: {
      kind: "PROFIT_RATIO",
      businessMonths: R(12),
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(12) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(12) }] },
      ],
    },
    ratioAnswer: red.str,
    ratioFormat: {
      correct: red.str,
      parts: red.parts,
      distractors: [
        rev,
        `${red.parts[0] + 1} : ${red.parts[1]}`,
        `${red.parts[0]} : ${red.parts[1] + 1}`,
        `${red.parts[0] + 2} : ${red.parts[1] + 1}`,
      ],
    },
    solution: {
      given_data: [`${p1}'s capital = ${formatINR(c1)}`, `${p2}'s capital = ${formatINR(c2)}`, `Duration = 12 months each`],
      formula: "Profit Ratio = (Capital₁ × Time₁) : (Capital₂ × Time₂)",
      steps: [
        `Since both invest for equal time (12 months), Profit Ratio = ${c1} : ${c2}`,
        `Simplifying by HCF gives ${red.str}`,
      ],
      final_answer: red.str,
    },
    shortcut_method: `Equal durations cancel out; simply reduce ${c1 / 1000} : ${c2 / 1000} = ${red.str}.`,
    rng,
  });
}

// A2. Find Individual Partner's Profit (2 Partners, Equal Time)
function genA2_IndividualProfit(rng, difficulty) {
  const configs = [
    [30000, 45000, 15000], // 2:3 -> 6000, 9000
    [25000, 35000, 24000], // 5:7 -> 10000, 14000
    [40000, 60000, 25000], // 2:3 -> 10000, 15000
    [36000, 48000, 28000], // 3:4 -> 12000, 16000
    [45000, 75000, 32000], // 3:5 -> 12000, 20000
    [28000, 36000, 32000], // 7:9 -> 14000, 18000
  ];
  const [c1, c2, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const askFirst = rng.random() < 0.5;
  const share1 = R(totalProfit * c1, c1 + c2);
  const share2 = R(totalProfit).sub(share1);
  const ans = askFirst ? share1 : share2;
  const other = askFirst ? share2 : share1;
  const red = reduceMultiRatio([c1, c2]);

  return assemblePartnerQ({
    templateId: "PART_A2_INDIVIDUAL_PROFIT",
    question_type: "Basic Partnership",
    sub_type: "Find Individual Partner's Profit",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `${p1} and ${p2} invest ${formatINR(c1)} and ${formatINR(c2)} respectively in a venture for one full year. If the total profit earned at the end of the year is ${formatINR(totalProfit)}, what is ${askFirst ? p1 : p2}'s share of the profit?`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      targetIdx: askFirst ? 0 : 1,
      ask: "TARGET_PROFIT_SHARE",
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(12) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(12) }] },
      ],
    },
    exactRationalAnswer: ans,
    plausible: [other, R(totalProfit, 2), ans.add(R(1500)), ans.sub(R(1000))],
    isCurrency: true,
    solution: {
      given_data: [`${p1} = ${formatINR(c1)}`, `${p2} = ${formatINR(c2)}`, `Total Profit = ${formatINR(totalProfit)}`],
      formula: "Individual Share = Total Profit × (Individual Ratio / Sum of Ratios)",
      steps: [
        `Profit ratio ${p1} : ${p2} = ${red.str} (Sum of parts = ${red.parts[0] + red.parts[1]})`,
        `${askFirst ? p1 : p2}'s share = (${askFirst ? red.parts[0] : red.parts[1]} / ${red.parts[0] + red.parts[1]}) × ${formatINR(totalProfit)} = ${formatINR(ans)}`,
      ],
      final_answer: formatINR(ans),
    },
    shortcut_method: `1 ratio part = ${formatINR(totalProfit / (red.parts[0] + red.parts[1]))}; multiply by ${askFirst ? red.parts[0] : red.parts[1]}.`,
    rng,
  });
}

// A3. Find Total Profit from One Partner's Share
function genA3_FindTotalProfit(rng, difficulty) {
  const configs = [
    [32000, 48000, 12000, 30000], // 2:3 -> A=12000 => Total=30000
    [40000, 50000, 16000, 36000], // 4:5 -> A=16000 => Total=36000
    [35000, 45000, 14000, 32000], // 7:9 -> A=14000 => Total=32000
    [24000, 40000, 15000, 40000], // 3:5 -> A=15000 => Total=40000
    [45000, 60000, 18000, 42000], // 3:4 -> A=18000 => Total=42000
  ];
  const [c1, c2, shareA, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const red = reduceMultiRatio([c1, c2]);
  const shareB = totalProfit - shareA;

  return assemblePartnerQ({
    templateId: "PART_A3_FIND_TOTAL_PROFIT",
    question_type: "Basic Partnership",
    sub_type: "Find Total Profit",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `${p1} and ${p2} started a business investing ${formatINR(c1)} and ${formatINR(c2)} respectively for 1 year. If ${p1} received ${formatINR(shareA)} as profit at the end of the year, what was the total profit earned by the business?`,
    mathModel: {
      kind: "FIND_TOTAL_PROFIT",
      businessMonths: R(12),
      knownShare: R(shareA),
      knownIdx: 0,
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(12) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(12) }] },
      ],
    },
    exactRationalAnswer: R(totalProfit),
    plausible: [R(shareB), R(shareA * 2), R(totalProfit + 3000), R(totalProfit - 2000)],
    isCurrency: true,
    solution: {
      given_data: [`${p1} = ${formatINR(c1)}`, `${p2} = ${formatINR(c2)}`, `${p1}'s profit = ${formatINR(shareA)}`],
      formula: "Total Profit = Known Share × (Sum of Ratio Parts / Known Partner's Part)",
      steps: [
        `Profit ratio ${p1} : ${p2} = ${red.str} (Total parts = ${red.parts[0] + red.parts[1]})`,
        `${red.parts[0]} parts = ${formatINR(shareA)} ⇒ 1 part = ${formatINR(shareA / red.parts[0])}`,
        `Total Profit = ${red.parts[0] + red.parts[1]} × ${formatINR(shareA / red.parts[0])} = ${formatINR(totalProfit)}`,
      ],
      final_answer: formatINR(totalProfit),
    },
    shortcut_method: `Total Profit = ${formatINR(shareA)} × (${red.parts[0] + red.parts[1]}/${red.parts[0]}) = ${formatINR(totalProfit)}.`,
    rng,
  });
}

// A4. Find Missing Investment (2 Partners, Equal Time)
function genA4_MissingInvestment(rng, difficulty) {
  const configs = [
    [36000, 4, 5, 45000],
    [42000, 3, 4, 56000],
    [30000, 5, 7, 42000],
    [48000, 6, 5, 40000],
    [25000, 5, 8, 40000],
    [54000, 9, 7, 42000],
  ];
  const [c1, r1, r2, c2] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);

  return assemblePartnerQ({
    templateId: "PART_A4_MISSING_INVESTMENT",
    question_type: "Basic Partnership",
    sub_type: "Find Missing Investment",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
    question: `${p1} and ${p2} invested in a business for 1 year and shared the annual profit in the ratio ${r1} : ${r2}. If ${p1} invested ${formatINR(c1)}, how much capital did ${p2} invest?`,
    mathModel: {
      kind: "MISSING_INVESTMENT",
      businessMonths: R(12),
      knownPartnerEff: R(c1 * 12),
      unknownMonths: R(12),
      ratioUnknownToKnown: R(r2, r1),
      priorEff: ZERO,
    },
    exactRationalAnswer: R(c2),
    plausible: [R(c1 * r1, r2), R(c2 + 4000), R(c2 - 3000), R(c1 + c2)],
    isCurrency: true,
    solution: {
      given_data: [`${p1}'s capital = ${formatINR(c1)}`, `Profit ratio ${p1}:${p2} = ${r1}:${r2}`, `Equal time = 1 year`],
      formula: "For equal duration, Capital₁ / Capital₂ = Profit₁ / Profit₂",
      steps: [
        `${c1} / Capital₂ = ${r1} / ${r2}`,
        `Capital₂ = (${c1} × ${r2}) / ${r1} = ${formatINR(c2)}`,
      ],
      final_answer: formatINR(c2),
    },
    shortcut_method: `${r1} parts = ${formatINR(c1)} ⇒ 1 part = ${formatINR(c1 / r1)} ⇒ ${r2} parts = ${formatINR(c2)}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY B: Simple Partnership (B1–B3)
// ============================================================================

// B1. Three Partners Investing Different Amounts (Equal Duration)
function genB1_ThreePartnersSimple(rng, difficulty) {
  const configs = [
    [20000, 30000, 50000, 40000], // 2:3:5 -> 8k, 12k, 20k
    [24000, 36000, 48000, 36000], // 2:3:4 -> 8k, 12k, 16k
    [15000, 25000, 35000, 30000], // 3:5:7 -> 6k, 10k, 14k
    [30000, 40000, 50000, 48000], // 3:4:5 -> 12k, 16k, 20k
    [25000, 35000, 40000, 50000], // 5:7:8 -> 12.5k, 17.5k, 20k
  ];
  const [c1, c2, c3, totalProfit] = rng.pick(configs);
  const [p1, p2, p3] = pickPartners(rng, 3);
  const targetIdx = rng.pick([0, 1, 2]);
  const targetName = [p1, p2, p3][targetIdx];
  const sumC = c1 + c2 + c3;
  const shares = [R(totalProfit * c1, sumC), R(totalProfit * c2, sumC), R(totalProfit * c3, sumC)];
  const ans = shares[targetIdx];
  const red = reduceMultiRatio([c1, c2, c3]);

  return assemblePartnerQ({
    templateId: "PART_B1_THREE_PARTNERS_SIMPLE",
    question_type: "Simple Partnership",
    sub_type: "Three Partners Investing Different Amounts",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `${p1}, ${p2}, and ${p3} invested ${formatINR(c1)}, ${formatINR(c2)}, and ${formatINR(c3)} respectively in a partnership for 1 year. Out of a total annual profit of ${formatINR(totalProfit)}, what is ${targetName}'s share?`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      targetIdx,
      ask: "TARGET_PROFIT_SHARE",
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(12) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(12) }] },
        { name: p3, segments: [{ capital: R(c3), months: R(12) }] },
      ],
    },
    exactRationalAnswer: ans,
    plausible: [shares[(targetIdx + 1) % 3], shares[(targetIdx + 2) % 3], ans.add(R(2000)), ans.sub(R(1500))],
    isCurrency: true,
    solution: {
      given_data: [`Capitals: ${formatINR(c1)}, ${formatINR(c2)}, ${formatINR(c3)}`, `Total Profit = ${formatINR(totalProfit)}`],
      formula: "Partner Share = Total Profit × (Partner Capital / Total Capital)",
      steps: [
        `Profit-sharing ratio = ${red.str} (Sum of parts = ${red.parts.reduce((a, b) => a + b, 0)})`,
        `${targetName}'s share = (${red.parts[targetIdx]} / ${red.parts.reduce((a, b) => a + b, 0)}) × ${formatINR(totalProfit)} = ${formatINR(ans)}`,
      ],
      final_answer: formatINR(ans),
    },
    shortcut_method: `Sum of ratio parts = ${red.parts.reduce((a, b) => a + b, 0)}; 1 part = ${formatINR(totalProfit / red.parts.reduce((a, b) => a + b, 0))}.`,
    rng,
  });
}

// B2. Find Investment Ratio from Profit Ratio and Time Ratio
function genB2_InvestmentRatioFromProfit(rng, difficulty) {
  const configs = [
    [[5, 6], [4, 3]],   // (5/4):(6/3) = 5:8
    [[4, 5], [3, 5]],   // (4/3):(5/5) = 4:3
    [[7, 9], [7, 6]],   // 1 : 3/2 = 2:3
    [[3, 4], [2, 3]],   // 9:8
    [[8, 9], [4, 3]],   // 2:3
    [[5, 7], [2, 3]],   // 15:14
  ];
  const [[pr1, pr2], [t1, t2]] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const red = reduceMultiRatio([pr1 * t2, pr2 * t1]);
  const wrongMul = reduceMultiRatio([pr1 * t1, pr2 * t2]).str;
  const rev = `${red.parts[1]} : ${red.parts[0]}`;

  return assemblePartnerQ({
    templateId: "PART_B2_INV_RATIO_FROM_PROFIT",
    question_type: "Simple Partnership",
    sub_type: "Find Investment Ratio from Profit Ratio",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `${p1} and ${p2} invested in a business for time periods in the ratio ${t1} : ${t2}. If the profits at the end of the business term were shared in the ratio ${pr1} : ${pr2}, what was the ratio of their investments?`,
    mathModel: {
      kind: "INVESTMENT_RATIO_FROM_PROFIT",
      profitParts: [R(pr1), R(pr2)],
      durations: [R(t1), R(t2)],
    },
    ratioAnswer: red.str,
    ratioFormat: {
      correct: red.str,
      parts: red.parts,
      distractors: [
        wrongMul,
        rev,
        `${pr1} : ${pr2}`,
        `${red.parts[0] + 1} : ${red.parts[1]}`,
      ],
    },
    solution: {
      given_data: [`Profit ratio = ${pr1} : ${pr2}`, `Time ratio = ${t1} : ${t2}`],
      formula: "Investment Ratio = (Profit₁ / Time₁) : (Profit₂ / Time₂)",
      steps: [
        `Investment Ratio = (${pr1}/${t1}) : (${pr2}/${t2})`,
        `Cross-multiplying: (${pr1} × ${t2}) : (${pr2} × ${t1}) = ${pr1 * t2} : ${pr2 * t1} = ${red.str}`,
      ],
      final_answer: red.str,
    },
    shortcut_method: `Divide profit parts by time parts: (${pr1}×${t2}) : (${pr2}×${t1}) = ${red.str}.`,
    rng,
  });
}

// B3. Difference Between Two Partners' Profit Shares
function genB3_DifferenceInShares(rng, difficulty) {
  const configs = [
    [25000, 40000, 39000], // 5:8 (sum 13) -> diff 3 parts = 9000
    [30000, 50000, 40000], // 3:5 (sum 8) -> diff 2 parts = 10000
    [36000, 54000, 45000], // 2:3 (sum 5) -> diff 1 part = 9000
    [28000, 44000, 36000], // 7:11 (sum 18) -> diff 4 parts = 8000
    [45000, 75000, 48000], // 3:5 (sum 8) -> diff 2 parts = 12000
  ];
  const [c1, c2, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const red = reduceMultiRatio([c1, c2]);
  const sumParts = red.parts[0] + red.parts[1];
  const diffShare = R(totalProfit * Math.abs(red.parts[1] - red.parts[0]), sumParts);
  const s1 = R(totalProfit * red.parts[0], sumParts);
  const s2 = R(totalProfit * red.parts[1], sumParts);

  return assemblePartnerQ({
    templateId: "PART_B3_DIFF_PROFIT_SHARES",
    question_type: "Simple Partnership",
    sub_type: "Difference in Profit Distribution",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `${p1} and ${p2} started a firm by investing ${formatINR(c1)} and ${formatINR(c2)} respectively for 1 year. If the annual profit was ${formatINR(totalProfit)}, find the difference between the profit shares of ${p2} and ${p1}.`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      targetIdx: 1,
      otherIdx: 0,
      ask: "DIFF_SHARES",
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(12) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(12) }] },
      ],
    },
    exactRationalAnswer: diffShare,
    plausible: [s1, s2, diffShare.add(R(1500)), diffShare.sub(R(1000))],
    isCurrency: true,
    solution: {
      given_data: [`${p1} = ${formatINR(c1)}`, `${p2} = ${formatINR(c2)}`, `Total Profit = ${formatINR(totalProfit)}`],
      formula: "Difference = Total Profit × |r₂ − r₁| / (r₁ + r₂)",
      steps: [
        `Profit ratio = ${red.str} (Sum = ${sumParts}, Difference = ${Math.abs(red.parts[1] - red.parts[0])} parts)`,
        `Difference in shares = (${Math.abs(red.parts[1] - red.parts[0])} / ${sumParts}) × ${formatINR(totalProfit)} = ${formatINR(diffShare)}`,
      ],
      final_answer: formatINR(diffShare),
    },
    shortcut_method: `Directly compute (|${red.parts[1]}−${red.parts[0]}| / ${sumParts}) × ${formatINR(totalProfit)} = ${formatINR(diffShare)}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY C: Time-Based Partnership (C1–C5)
// ============================================================================

// C1. Partners Invest for Different Time Periods
function genC1_DifferentDurations(rng, difficulty) {
  const configs = [
    [30000, 12, 40000, 9, 28000],  // 360:360 -> skip equal -> pick unequal:
    [30000, 8, 40000, 9, 30000],   // 240:360 = 2:3 -> 12k, 18k
    [40000, 9, 50000, 6, 33000],   // 360:300 = 6:5 -> 18k, 15k
    [25000, 12, 30000, 8, 27000],  // 300:240 = 5:4 -> 15k, 12k
    [36000, 10, 45000, 6, 35000],  // 360:270 = 4:3 -> 20k, 15k
    [45000, 8, 60000, 9, 35000],   // 360:540 = 2:3 -> 14k, 21k
  ].filter(([c1, t1, c2, t2]) => c1 * t1 !== c2 * t2);

  const [c1, t1, c2, t2, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const eff1 = c1 * t1;
  const eff2 = c2 * t2;
  const red = reduceMultiRatio([eff1, eff2]);
  const share1 = R(totalProfit * eff1, eff1 + eff2);
  const share2 = R(totalProfit).sub(share1);
  // Common mistake: ignoring durations (using capital ratio only)
  const wrongNoTime = R(totalProfit * c1, c1 + c2);

  return assemblePartnerQ({
    templateId: "PART_C1_DIFF_DURATIONS",
    question_type: "Time-Based Partnership",
    sub_type: "Different Investment Durations",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `${p1} invests ${formatINR(c1)} for ${t1} months and ${p2} invests ${formatINR(c2)} for ${t2} months in a business. If the total profit earned is ${formatINR(totalProfit)}, what is ${p1}'s share of the profit?`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      targetIdx: 0,
      ask: "TARGET_PROFIT_SHARE",
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(t1) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(t2) }] },
      ],
    },
    exactRationalAnswer: share1,
    plausible: [share2, wrongNoTime, share1.add(R(1500)), share1.sub(R(1500))],
    isCurrency: true,
    solution: {
      given_data: [`${p1}: ${formatINR(c1)} × ${t1} months`, `${p2}: ${formatINR(c2)} × ${t2} months`, `Total Profit = ${formatINR(totalProfit)}`],
      formula: "Profit Ratio = (C₁ × T₁) : (C₂ × T₂)",
      steps: [
        `Capital-months ratio = (${c1} × ${t1}) : (${c2} × ${t2}) = ${red.str}`,
        `${p1}'s share = (${red.parts[0]} / ${red.parts[0] + red.parts[1]}) × ${formatINR(totalProfit)} = ${formatINR(share1)}`,
      ],
      final_answer: formatINR(share1),
    },
    shortcut_method: `Reduce (${c1 / 1000}×${t1}) : (${c2 / 1000}×${t2}) = ${red.str}, then split ${formatINR(totalProfit)}.`,
    rng,
  });
}

// C2. One Partner Joins After Some Months (Find Profit Share)
function genC2_PartnerJoinsLater(rng, difficulty) {
  const configs = [
    [40000, 60000, 4, 24000], // A: 40*12=480, B: 60*8=480 -> skip equal!
    [45000, 60000, 3, 36000], // A: 540, B: 540 -> skip equal!
    [40000, 50000, 4, 33000], // A: 480, B: 400 => 6:5 -> 18k, 15k
    [36000, 48000, 3, 32000], // A: 432, B: 432 -> skip equal!
    [30000, 45000, 6, 35000], // A: 360, B: 270 => 4:3 -> 20k, 15k
    [50000, 60000, 4, 36000], // A: 600, B: 480 => 5:4 -> 20k, 16k
    [32000, 48000, 4, 28000], // A: 384, B: 384 -> skip!
    [40000, 60000, 6, 35000], // A: 480, B: 360 => 4:3 -> 20k, 15k
    [36000, 45000, 4, 38000], // A: 432, B: 360 => 6:5 -> skip 38k -> use 33k
    [36000, 45000, 4, 33000], // A: 432, B: 360 => 6:5 -> 18k, 15k
    [48000, 60000, 4, 34000], // A: 576, B: 480 => 6:5 -> skip 34k -> use 44k
    [48000, 60000, 4, 44000], // 6:5 -> 24k, 20k
  ].filter(([c1, c2, joinAfter]) => c1 * 12 !== c2 * (12 - joinAfter));

  const [c1, c2, joinAfter, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const t2 = 12 - joinAfter;
  const eff1 = c1 * 12;
  const eff2 = c2 * t2;
  const red = reduceMultiRatio([eff1, eff2]);
  const share2 = R(totalProfit * eff2, eff1 + eff2);
  const share1 = R(totalProfit).sub(share2);
  // Distractor: using `joinAfter` instead of `12 - joinAfter`
  const wrongJoinTime = R(totalProfit * c2 * joinAfter, eff1 + c2 * joinAfter);

  return assemblePartnerQ({
    templateId: "PART_C2_PARTNER_JOINS_LATER",
    question_type: "Time-Based Partnership",
    sub_type: "Partner Joins After Some Months",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `${p1} started a business with an investment of ${formatINR(c1)}. After ${joinAfter} months, ${p2} joined the business with ${formatINR(c2)}. At the end of 1 year, they earned a total profit of ${formatINR(totalProfit)}. What is ${p2}'s share of the profit?`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      targetIdx: 1,
      ask: "TARGET_PROFIT_SHARE",
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(12) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(t2) }] },
      ],
    },
    exactRationalAnswer: share2,
    plausible: [share1, wrongJoinTime, share2.add(R(1500)), share2.sub(R(1000))],
    isCurrency: true,
    solution: {
      given_data: [`${p1}: ${formatINR(c1)} for 12 months`, `${p2}: ${formatINR(c2)} for (12 − ${joinAfter}) = ${t2} months`, `Total Profit = ${formatINR(totalProfit)}`],
      formula: "Profit Ratio = (C₁ × 12) : (C₂ × (12 − join delay))",
      steps: [
        `${p2}'s active investment duration = 12 − ${joinAfter} = ${t2} months`,
        `Profit ratio ${p1} : ${p2} = (${c1} × 12) : (${c2} × ${t2}) = ${red.str}`,
        `${p2}'s share = (${red.parts[1]} / ${red.parts[0] + red.parts[1]}) × ${formatINR(totalProfit)} = ${formatINR(share2)}`,
      ],
      final_answer: formatINR(share2),
    },
    shortcut_method: `${p2} stays for 12 − ${joinAfter} = ${t2} months (not ${joinAfter}); ratio is ${red.str}.`,
    rng,
  });
}

// C3. One Partner Leaves Before Year End
function genC3_PartnerLeavesEarly(rng, difficulty) {
  const configs = [
    [40000, 30000, 9, 36000], // A: 40*9=360, B: 30*12=360 -> skip!
    [45000, 30000, 8, 36000], // A: 360, B: 360 -> skip!
    [50000, 40000, 8, 44000], // A: 400, B: 480 => 5:6 -> 20k, 24k
    [36000, 30000, 8, 42000], // A: 288, B: 360 => 4:5 -> 18k? 42/9 no -> use 36k
    [36000, 30000, 8, 36000], // 4:5 -> 16k, 20k
    [60000, 45000, 6, 30000], // A: 360, B: 540 => 2:3 -> 12k, 18k
    [48000, 36000, 6, 35000], // A: 288, B: 432 => 2:3 -> 14k, 21k
    [40000, 50000, 9, 32000], // A: 360, B: 600 => 3:5 -> 12k, 20k
  ].filter(([c1, c2, t1]) => c1 * t1 !== c2 * 12);

  const [c1, c2, stayMonths, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const leftBefore = 12 - stayMonths;
  const eff1 = c1 * stayMonths;
  const eff2 = c2 * 12;
  const red = reduceMultiRatio([eff1, eff2]);
  const share1 = R(totalProfit * eff1, eff1 + eff2);
  const share2 = R(totalProfit).sub(share1);
  const wrongLeftMonths = R(totalProfit * c1 * leftBefore, c1 * leftBefore + eff2);

  return assemblePartnerQ({
    templateId: "PART_C3_PARTNER_LEAVES_EARLY",
    question_type: "Time-Based Partnership",
    sub_type: "Partner Leaves Before End of Year",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI PO Prelims"],
    question: `${p1} and ${p2} started a partnership by investing ${formatINR(c1)} and ${formatINR(c2)} respectively. ${p1} withdrew completely ${leftBefore} months before the end of the year. If the annual profit was ${formatINR(totalProfit)}, what is ${p1}'s share?`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      targetIdx: 0,
      ask: "TARGET_PROFIT_SHARE",
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(stayMonths) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(12) }] },
      ],
    },
    exactRationalAnswer: share1,
    plausible: [share2, wrongLeftMonths, share1.add(R(1500)), share1.sub(R(1500))],
    isCurrency: true,
    solution: {
      given_data: [`${p1}: ${formatINR(c1)} for (12 − ${leftBefore}) = ${stayMonths} months`, `${p2}: ${formatINR(c2)} for 12 months`, `Total Profit = ${formatINR(totalProfit)}`],
      formula: "Profit Ratio = (C₁ × Active Months₁) : (C₂ × 12)",
      steps: [
        `${p1}'s active duration = 12 − ${leftBefore} = ${stayMonths} months`,
        `Profit ratio ${p1} : ${p2} = (${c1} × ${stayMonths}) : (${c2} × 12) = ${red.str}`,
        `${p1}'s share = (${red.parts[0]} / ${red.parts[0] + red.parts[1]}) × ${formatINR(totalProfit)} = ${formatINR(share1)}`,
      ],
      final_answer: formatINR(share1),
    },
    shortcut_method: `${p1} invested for ${stayMonths} months; reduce (${c1 / 1000}×${stayMonths}) : (${c2 / 1000}×12) = ${red.str}.`,
    rng,
  });
}

// C4. Find Joining Time of a Partner (After how many months did B join?)
function genC4_FindJoiningTime(rng, difficulty) {
  const configs = [
    [45000, 60000, 3, 2, 6], // A: 540k, B: 60k * t = 360k => t=6 => joined after 6 months
    [40000, 60000, 4, 3, 6], // A: 480k, B: 60k * t = 360k => t=6 => joined after 6 months
    [36000, 54000, 4, 3, 6], // A: 432k, B: 54k * t = 324k => t=6 => joined after 6 months
    [50000, 75000, 4, 3, 6], // t=6 => joined after 6 months
    [42000, 63000, 1, 1, 8], // A: 504k, B: 63k * 8 = 504k => joined after 4 months!
    [48000, 72000, 2, 1, 4], // A: 576k, B: 72k * 4 = 288k => joined after 8 months!
    [35000, 42000, 2, 1, 5], // A: 420k, B: 42k * 5 = 210k => joined after 7 months!
    [40000, 48000, 5, 4, 8], // A: 480k, B: 48k * 8 = 384k => joined after 4 months!
    [45000, 54000, 10, 9, 9], // A: 540k, B: 54k * 9 = 486k => joined after 3 months!
  ];
  const [c1, c2, p1Part, p2Part, activeMonths] = rng.pick(configs);
  const joinedAfter = 12 - activeMonths;
  const [p1, p2] = pickPartners(rng, 2);

  return assemblePartnerQ({
    templateId: "PART_C4_FIND_JOINING_TIME",
    question_type: "Time-Based Partnership",
    sub_type: "Find Joining Time of a Partner",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `${p1} started a business with ${formatINR(c1)} and was later joined by ${p2} with ${formatINR(c2)}. If the annual profits at the end of 1 year were divided in the ratio ${p1Part} : ${p2Part}, after how many months did ${p2} join the business?`,
    mathModel: {
      kind: "MISSING_DURATION",
      businessMonths: R(12),
      knownPartnerEff: R(c1 * 12),
      unknownCapital: R(c2),
      ratioUnknownToKnown: R(p2Part, p1Part),
      ask: "JOINED_AFTER",
    },
    exactRationalAnswer: R(joinedAfter),
    plausible: [R(activeMonths), R(joinedAfter + 1), R(Math.max(1, joinedAfter - 1)), R(joinedAfter + 2)],
    unit: "months",
    maxVal: 11,
    solution: {
      given_data: [`${p1} = ${formatINR(c1)} (12 months)`, `${p2} = ${formatINR(c2)} (t months)`, `Profit ratio = ${p1Part}:${p2Part}`],
      formula: "(C₁ × 12) / (C₂ × t) = P₁ / P₂; Joining delay = 12 − t",
      steps: [
        `(${c1} × 12) / (${c2} × t) = ${p1Part} / ${p2Part}`,
        `Solving for active duration t gives t = ${activeMonths} months`,
        `Therefore, ${p2} joined after 12 − ${activeMonths} = ${joinedAfter} months`,
      ],
      final_answer: `${joinedAfter} months`,
    },
    shortcut_method: `Find active duration t = ${activeMonths} months first, then subtract from 12 to get joining delay = ${joinedAfter} months.`,
    rng,
  });
}

// C5. Find Leaving Time (Active Investment Duration)
function genC5_FindInvestmentDuration(rng, difficulty) {
  const configs = [
    [40000, 60000, 4, 3, 6], // B active 6m
    [35000, 50000, 21, 20, 8], // A: 420k, B: 50k*8=400k => 21:20
    [45000, 60000, 3, 2, 6], // B active 6m
    [48000, 64000, 9, 8, 8], // A: 576k, B: 64k*8=512k => 9:8
    [30000, 45000, 8, 9, 9], // A: 360k, B: 45k*9=405k => 8:9
    [40000, 48000, 5, 4, 8], // B active 8m
  ];
  const [c1, c2, p1Part, p2Part, activeMonths] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);

  return assemblePartnerQ({
    templateId: "PART_C5_FIND_DURATION",
    question_type: "Time-Based Partnership",
    sub_type: "Find Investment Duration / Leaving Time",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `${p1} and ${p2} entered into a partnership investing ${formatINR(c1)} and ${formatINR(c2)} respectively. ${p1} stayed for the entire year (12 months), whereas ${p2} withdrew after a few months. If their annual profit ratio was ${p1Part} : ${p2Part}, for how many months was ${p2}'s money invested?`,
    mathModel: {
      kind: "MISSING_DURATION",
      businessMonths: R(12),
      knownPartnerEff: R(c1 * 12),
      unknownCapital: R(c2),
      ratioUnknownToKnown: R(p2Part, p1Part),
      ask: "DURATION",
    },
    exactRationalAnswer: R(activeMonths),
    plausible: [R(12 - activeMonths), R(activeMonths + 1), R(Math.max(1, activeMonths - 1)), R(activeMonths + 2)],
    unit: "months",
    maxVal: 12,
    solution: {
      given_data: [`${p1}: ${formatINR(c1)} for 12 months`, `${p2}: ${formatINR(c2)} for t months`, `Profit ratio = ${p1Part}:${p2Part}`],
      formula: "t = (C₁ × 12 × P₂) / (C₂ × P₁)",
      steps: [
        `(${c1} × 12) / (${c2} × t) = ${p1Part} / ${p2Part}`,
        `t = (${c1} × 12 × ${p2Part}) / (${c2} × ${p1Part}) = ${activeMonths} months`,
      ],
      final_answer: `${activeMonths} months`,
    },
    shortcut_method: `t = (12 × ${c1 / 1000} × ${p2Part}) / (${c2 / 1000} × ${p1Part}) = ${activeMonths} months.`,
    rng,
  });
}

// ============================================================================
// CATEGORY D: Change in Investment (D1–D4)
// ============================================================================

// D1. Partner Adds Capital After Some Months (Find Profit Ratio)
function genD1_PartnerAddsCapital(rng, difficulty) {
  const configs = [
    [20000, 10000, 6, 30000], // A: 20*6 + 30*6 = 300; B: 30*12 = 360 => 5:6
    [30000, 15000, 4, 45000], // A: 30*4 + 45*8 = 480; B: 45*12 = 540 => 8:9
    [24000, 12000, 6, 36000], // A: 24*6 + 36*6 = 360; B: 36*12 = 432 => 5:6
    [40000, 20000, 6, 60000], // A: 40*6 + 60*6 = 600; B: 60*12 = 720 => 5:6
    [25000, 15000, 4, 40000], // A: 25*4 + 40*8 = 420; B: 40*12 = 480 => 7:8
    [30000, 10000, 3, 40000], // A: 30*3 + 40*9 = 450; B: 40*12 = 480 => 15:16
  ];
  const [c1, addAmt, afterM, c2] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const eff1 = c1 * afterM + (c1 + addAmt) * (12 - afterM);
  const eff2 = c2 * 12;
  const red = reduceMultiRatio([eff1, eff2]);
  // Classic mistake: applying final capital (c1 + addAmt) to full 12 months, or ignoring addition
  const wrongNoAdd = reduceMultiRatio([c1, c2]).str;
  const rev = `${red.parts[1]} : ${red.parts[0]}`;

  return assemblePartnerQ({
    templateId: "PART_D1_ADDS_CAPITAL_RATIO",
    question_type: "Change in Investment",
    sub_type: "Partner Adds Capital After Some Months",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `${p1} and ${p2} started a business by investing ${formatINR(c1)} and ${formatINR(c2)} respectively. After ${afterM} months, ${p1} invested an additional ${formatINR(addAmt)}. What will be the ratio of their profits at the end of 1 year?`,
    mathModel: {
      kind: "PROFIT_RATIO",
      businessMonths: R(12),
      partners: [
        {
          name: p1,
          segments: [
            { capital: R(c1), months: R(afterM) },
            { capital: R(c1 + addAmt), months: R(12 - afterM) },
          ],
        },
        { name: p2, segments: [{ capital: R(c2), months: R(12) }] },
      ],
    },
    ratioAnswer: red.str,
    ratioFormat: {
      correct: red.str,
      parts: red.parts,
      distractors: [
        wrongNoAdd,
        rev,
        `${red.parts[0] + 1} : ${red.parts[1]}`,
        `${red.parts[0]} : ${red.parts[1] + 2}`,
      ],
    },
    solution: {
      given_data: [
        `${p1}: ${formatINR(c1)} for ${afterM}m, then ${formatINR(c1 + addAmt)} for ${12 - afterM}m`,
        `${p2}: ${formatINR(c2)} for 12m`,
      ],
      formula: "Effective Capital = Sum of (Capital × Duration) for each period",
      steps: [
        `${p1}'s capital-months = (${c1} × ${afterM}) + (${c1 + addAmt} × ${12 - afterM}) = ${eff1.toLocaleString("en-IN")}`,
        `${p2}'s capital-months = ${c2} × 12 = ${eff2.toLocaleString("en-IN")}`,
        `Profit Ratio = ${eff1} : ${eff2} = ${red.str}`,
      ],
      final_answer: red.str,
    },
    shortcut_method: `Never apply ${formatINR(c1 + addAmt)} to all 12 months; sum segments (${c1 / 1000}×${afterM} + ${(c1 + addAmt) / 1000}×${12 - afterM}) : (${c2 / 1000}×12) = ${red.str}.`,
    rng,
  });
}

// D2. Partner Withdraws Part of Investment (Find Profit Share)
function genD2_PartnerWithdrawsCapital(rng, difficulty) {
  const configs = [
    [40000, 10000, 6, 30000, 39000], // A: 40*6+30*6=420, B: 30*12=360 => 7:6 -> 21k, 18k
    [50000, 20000, 6, 40000, 32000], // A: 50*6+30*6=480, B: 40*12=480 -> skip equal!
    [60000, 20000, 6, 40000, 38000], // A: 60*6+40*6=600, B: 40*12=480 => 5:4 -> skip 38k -> use 36k
    [60000, 20000, 6, 40000, 36000], // 5:4 -> 20k, 16k
    [50000, 15000, 4, 30000, 38000], // A: 50*4+35*8=480, B: 30*12=360 => 4:3 -> skip 38k -> use 35k
    [50000, 15000, 4, 30000, 35000], // 4:3 -> 20k, 15k
    [45000, 15000, 6, 40000, 31000], // A: 45*6+30*6=450, B: 40*12=480 => 15:16 -> 15k, 16k
  ].filter(([c1, w, m, c2]) => c1 * m + (c1 - w) * (12 - m) !== c2 * 12);

  const [c1, withdrawAmt, afterM, c2, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const eff1 = c1 * afterM + (c1 - withdrawAmt) * (12 - afterM);
  const eff2 = c2 * 12;
  const red = reduceMultiRatio([eff1, eff2]);
  const share1 = R(totalProfit * eff1, eff1 + eff2);
  const share2 = R(totalProfit).sub(share1);
  // Distractor: ignoring withdrawal
  const wrongNoWithdraw = R(totalProfit * c1, c1 + c2);

  return assemblePartnerQ({
    templateId: "PART_D2_WITHDRAWS_CAPITAL",
    question_type: "Change in Investment",
    sub_type: "Partner Withdraws Part of Capital",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `${p1} and ${p2} started a business investing ${formatINR(c1)} and ${formatINR(c2)} respectively. After ${afterM} months, ${p1} withdrew ${formatINR(withdrawAmt)}. If they earned an annual profit of ${formatINR(totalProfit)}, what is ${p1}'s share of the profit?`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      targetIdx: 0,
      ask: "TARGET_PROFIT_SHARE",
      partners: [
        {
          name: p1,
          segments: [
            { capital: R(c1), months: R(afterM) },
            { capital: R(c1 - withdrawAmt), months: R(12 - afterM) },
          ],
        },
        { name: p2, segments: [{ capital: R(c2), months: R(12) }] },
      ],
    },
    exactRationalAnswer: share1,
    plausible: [share2, wrongNoWithdraw, share1.add(R(1500)), share1.sub(R(1500))],
    isCurrency: true,
    solution: {
      given_data: [
        `${p1}: ${formatINR(c1)} for ${afterM}m, then ${formatINR(c1 - withdrawAmt)} for ${12 - afterM}m`,
        `${p2}: ${formatINR(c2)} for 12m`,
        `Total Profit = ${formatINR(totalProfit)}`,
      ],
      formula: "Effective Capital = (Initial Capital × t₁) + (Reduced Capital × t₂)",
      steps: [
        `${p1}'s capital-months = (${c1} × ${afterM}) + (${c1 - withdrawAmt} × ${12 - afterM}) = ${eff1.toLocaleString("en-IN")}`,
        `${p2}'s capital-months = ${c2} × 12 = ${eff2.toLocaleString("en-IN")} ⇒ Ratio = ${red.str}`,
        `${p1}'s share = (${red.parts[0]} / ${red.parts[0] + red.parts[1]}) × ${formatINR(totalProfit)} = ${formatINR(share1)}`,
      ],
      final_answer: formatINR(share1),
    },
    shortcut_method: `Compute capital-months in thousands: (${c1 / 1000}×${afterM} + ${(c1 - withdrawAmt) / 1000}×${12 - afterM}) : (${c2 / 1000}×12) = ${red.str}.`,
    rng,
  });
}

// D3. Multiple Changes in Investment (Both Partners Modify Capital)
function genD3_BothPartnersChangeCapital(rng, difficulty) {
  const configs = [
    // [c1, add1, m1, c2, sub2, m2, totalProfit]
    [30000, 10000, 6, 50000, 10000, 6, 48000], // A: 180+240=420, B: 300+240=540 => 7:9 -> 21k, 27k
    [40000, 20000, 6, 60000, 20000, 6, 44000], // A: 240+360=600, B: 360+240=600 -> skip equal!
    [36000, 12000, 4, 60000, 15000, 4, 46000], // A: 144+384=528, B: 240+360=600 => 22:25 -> skip
    [25000, 15000, 6, 50000, 10000, 6, 47000], // A: 150+240=390, B: 300+240=540 => 13:18 -> skip
    [30000, 20000, 6, 60000, 20000, 6, 45000], // A: 180+300=480, B: 360+240=600 => 4:5 -> 20k, 25k
    [20000, 10000, 6, 40000, 10000, 6, 36000], // A: 120+180=300, B: 240+180=420 => 5:7 -> 15k, 21k
    [40000, 10000, 4, 60000, 15000, 8, 56000], // A: 160+400=560, B: 480+180=660 => 28:33 -> skip
    [40000, 20000, 4, 50000, 10000, 6, 54000], // A: 160+480=640, B: 300+240=540 => 32:27 -> skip
    [30000, 15000, 4, 50000, 20000, 6, 44000], // A: 120+360=480, B: 300+180=480 -> skip!
    [45000, 15000, 4, 60000, 15000, 6, 43000], // A: 180+480=660, B: 360+270=630 => 22:21 -> 22k, 21k
    [24000, 12000, 6, 48000, 12000, 6, 39000], // A: 144+216=360, B: 288+216=504 => 5:7 -> skip 39k -> use 36k
    [24000, 12000, 6, 48000, 12000, 6, 36000], // 5:7 -> 15k, 21k
  ].filter(([c1, a1, m1, c2, s2, m2, tp]) => {
    const e1 = c1 * m1 + (c1 + a1) * (12 - m1);
    const e2 = c2 * m2 + (c2 - s2) * (12 - m2);
    return e1 !== e2 && (tp * e1) % (e1 + e2) === 0;
  });

  const [c1, add1, m1, c2, sub2, m2, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const eff1 = c1 * m1 + (c1 + add1) * (12 - m1);
  const eff2 = c2 * m2 + (c2 - sub2) * (12 - m2);
  const red = reduceMultiRatio([eff1, eff2]);
  const share1 = R(totalProfit * eff1, eff1 + eff2);
  const share2 = R(totalProfit).sub(share1);
  const wrongInitialOnly = R(totalProfit * c1, c1 + c2);

  return assemblePartnerQ({
    templateId: "PART_D3_MULTIPLE_CHANGES",
    question_type: "Change in Investment",
    sub_type: "Multiple Changes in Investment",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains", "SBI PO Mains"],
    question: `${p1} and ${p2} started a business with ${formatINR(c1)} and ${formatINR(c2)} respectively. After ${m1} months, ${p1} added ${formatINR(add1)}, while after ${m2} months ${p2} withdrew ${formatINR(sub2)}. Out of an annual profit of ${formatINR(totalProfit)}, what is ${p1}'s share?`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      targetIdx: 0,
      ask: "TARGET_PROFIT_SHARE",
      partners: [
        {
          name: p1,
          segments: [
            { capital: R(c1), months: R(m1) },
            { capital: R(c1 + add1), months: R(12 - m1) },
          ],
        },
        {
          name: p2,
          segments: [
            { capital: R(c2), months: R(m2) },
            { capital: R(c2 - sub2), months: R(12 - m2) },
          ],
        },
      ],
    },
    exactRationalAnswer: share1,
    plausible: [share2, wrongInitialOnly, share1.add(R(2000)), share1.sub(R(1500))],
    isCurrency: true,
    solution: {
      given_data: [
        `${p1}: ${formatINR(c1)} (${m1}m) + ${formatINR(c1 + add1)} (${12 - m1}m)`,
        `${p2}: ${formatINR(c2)} (${m2}m) + ${formatINR(c2 - sub2)} (${12 - m2}m)`,
        `Total Profit = ${formatINR(totalProfit)}`,
      ],
      formula: "Profit Ratio = Sum of Capital-Months for each partner",
      steps: [
        `${p1} effective capital = (${c1}×${m1}) + (${c1 + add1}×${12 - m1}) = ${eff1.toLocaleString("en-IN")}`,
        `${p2} effective capital = (${c2}×${m2}) + (${c2 - sub2}×${12 - m2}) = ${eff2.toLocaleString("en-IN")}`,
        `Ratio = ${red.str} ⇒ ${p1}'s share = (${red.parts[0]}/${red.parts[0] + red.parts[1]}) × ${formatINR(totalProfit)} = ${formatINR(share1)}`,
      ],
      final_answer: formatINR(share1),
    },
    shortcut_method: `Drop 3 zeros: ${p1} = ${eff1 / 1000}, ${p2} = ${eff2 / 1000} ⇒ ratio ${red.str}.`,
    rng,
  });
}

// D4. Find Missing Additional Capital After Some Months
function genD4_FindMissingAddedCapital(rng, difficulty) {
  const configs = [
    // [c1_init, afterM, c2, r1, r2, finalCap1] => added = finalCap1 - c1_init
    [30000, 6, 40000, 7, 8, 40000], // B=480k, A needs 420k; first 6m=180k -> rem 240k/6 = 40k => added 10k
    [25000, 6, 40000, 3, 4, 35000], // B=480k, A needs 360k; first 6m=150k -> rem 210k/6 = 35k => added 10k
    [20000, 4, 36000, 7, 9, 32000], // B=432k, A needs 336k; first 4m=80k -> rem 256k/8 = 32k => added 12k
    [36000, 6, 48000, 7, 8, 48000], // B=576k, A needs 504k; first 6m=216k -> rem 288k/6 = 48k => added 12k
    [40000, 6, 50000, 9, 10, 50000], // B=600k, A needs 540k; first 6m=240k -> rem 300k/6 = 50k => added 10k
  ];
  const [c1, afterM, c2, r1, r2, finalCap1] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const added = finalCap1 - c1;

  return assemblePartnerQ({
    templateId: "PART_D4_MISSING_CAPITAL_CHANGE",
    question_type: "Change in Investment",
    sub_type: "Find Missing Capital After Investment Change",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: `${p1} and ${p2} started a business with ${formatINR(c1)} and ${formatINR(c2)} respectively. After ${afterM} months, ${p1} invested some more capital so that at the end of 1 year their profits were shared in the ratio ${r1} : ${r2}. What was ${p1}'s total capital during the remaining ${12 - afterM} months?`,
    mathModel: {
      kind: "MISSING_INVESTMENT",
      businessMonths: R(12),
      knownPartnerEff: R(c2 * 12),
      unknownMonths: R(12 - afterM),
      ratioUnknownToKnown: R(r1, r2),
      priorEff: R(c1 * afterM),
    },
    exactRationalAnswer: R(finalCap1),
    plausible: [R(added), R(finalCap1 + 5000), R(finalCap1 - 4000), R(c1 + 2 * added)],
    isCurrency: true,
    solution: {
      given_data: [`${p1} initial = ${formatINR(c1)} (${afterM}m)`, `${p2} = ${formatINR(c2)} (12m)`, `Profit ratio = ${r1}:${r2}`],
      formula: "[(C₁ × t₁) + (C_new × t₂)] / (C₂ × 12) = r₁ / r₂",
      steps: [
        `${p2}'s capital-months = ${c2} × 12 = ${(c2 * 12).toLocaleString("en-IN")}`,
        `Required capital-months for ${p1} = (${r1}/${r2}) × ${(c2 * 12).toLocaleString("en-IN")} = ${((c2 * 12 * r1) / r2).toLocaleString("en-IN")}`,
        `Remaining ${12 - afterM} months need ${(((c2 * 12 * r1) / r2) - c1 * afterM).toLocaleString("en-IN")} ⇒ Total capital = ${formatINR(finalCap1)} (added ${formatINR(added)})`,
      ],
      final_answer: formatINR(finalCap1),
    },
    shortcut_method: `Find ${p1}'s target capital-months, subtract (${c1}×${afterM}), and divide by ${12 - afterM} months.`,
    rng,
  });
}

export const PARTNERSHIP_TEMPLATES_PART_1 = [
  { id: "PART_A1", category: "A", difficulties: ["Easy"], fn: genA1_ProfitSharingRatio },
  { id: "PART_A2", category: "A", difficulties: ["Easy"], fn: genA2_IndividualProfit },
  { id: "PART_A3", category: "A", difficulties: ["Easy", "Medium"], fn: genA3_FindTotalProfit },
  { id: "PART_A4", category: "A", difficulties: ["Easy", "Medium"], fn: genA4_MissingInvestment },

  { id: "PART_B1", category: "B", difficulties: ["Easy", "Medium"], fn: genB1_ThreePartnersSimple },
  { id: "PART_B2", category: "B", difficulties: ["Easy", "Medium"], fn: genB2_InvestmentRatioFromProfit },
  { id: "PART_B3", category: "B", difficulties: ["Easy"], fn: genB3_DifferenceInShares },

  { id: "PART_C1", category: "C", difficulties: ["Medium"], fn: genC1_DifferentDurations },
  { id: "PART_C2", category: "C", difficulties: ["Medium"], fn: genC2_PartnerJoinsLater },
  { id: "PART_C3", category: "C", difficulties: ["Medium"], fn: genC3_PartnerLeavesEarly },
  { id: "PART_C4", category: "C", difficulties: ["Medium", "Hard"], fn: genC4_FindJoiningTime },
  { id: "PART_C5", category: "C", difficulties: ["Medium"], fn: genC5_FindInvestmentDuration },

  { id: "PART_D1", category: "D", difficulties: ["Medium"], fn: genD1_PartnerAddsCapital },
  { id: "PART_D2", category: "D", difficulties: ["Medium"], fn: genD2_PartnerWithdrawsCapital },
  { id: "PART_D3", category: "D", difficulties: ["Hard"], fn: genD3_BothPartnersChangeCapital },
  { id: "PART_D4", category: "D", difficulties: ["Hard"], fn: genD4_FindMissingAddedCapital },
];