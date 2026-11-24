// Place at: server/question-engine/generators/quant/partnership/partnershipTemplatesPart2.js
import {
  R,
  ZERO,
  formatINR,
  reduceMultiRatio,
} from "./partnershipMath.js";
import { assemblePartnerQ } from "./partnershipTemplatesPart1.js";

const NAMES = [
  "Arjun", "Bhavna", "Chirag", "Divya", "Esha", "Farhan",
  "Gauri", "Harsh", "Ishaan", "Jaya", "Karan", "Meera",
  "Neha", "Pranav", "Rohan", "Siddharth", "Tanvi", "Vikram",
];

function pickPartners(rng, count = 2) {
  return rng.shuffle(NAMES).slice(0, count);
}

// ============================================================================
// CATEGORY E: Working and Sleeping Partners (E1–E5)
// ============================================================================

// E1. Working Partner Receives Monthly Salary — Find Working Partner's Total Income
function genE1_WorkingPartnerSalary(rng, difficulty) {
  const configs = [
    // [c1, c2, monthlySalary, totalProfit]
    [40000, 60000, 1000, 42000], // Sal=12k, Dist=30k (2:3 => 12k, 18k) => W total = 24k
    [30000, 50000, 1500, 50000], // Sal=18k, Dist=32k (3:5 => 12k, 20k) => W total = 30k
    [45000, 75000, 2000, 64000], // Sal=24k, Dist=40k (3:5 => 15k, 25k) => W total = 39k
    [36000, 48000, 1000, 40000], // Sal=12k, Dist=28k (3:4 => 12k, 16k) => W total = 24k
    [50000, 75000, 1500, 48000], // Sal=18k, Dist=30k (2:3 => 12k, 18k) => W total = 30k
  ];
  const [c1, c2, monthlySal, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const annualSal = monthlySal * 12;
  const distProfit = totalProfit - annualSal;
  const red = reduceMultiRatio([c1, c2]);
  const share1 = R(distProfit * c1, c1 + c2);
  const totalWorking = share1.add(R(annualSal));
  // Classic distractor: distributing total profit BEFORE deducting salary
  const wrongNoDeduct = R(totalProfit * c1, c1 + c2).add(R(annualSal));
  const sleepingShare = R(distProfit).sub(share1);

  return assemblePartnerQ({
    templateId: "PART_E1_WORKING_SALARY",
    question_type: "Working and Sleeping Partners",
    sub_type: "Working Partner Receives Monthly Salary",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `${p1} and ${p2} started a business investing ${formatINR(c1)} and ${formatINR(c2)} respectively for 1 year. ${p1} is the working partner and receives a salary of ${formatINR(monthlySal)} per month from the business profit, with the remaining profit shared in the ratio of their investments. If the total annual profit is ${formatINR(totalProfit)}, what is ${p1}'s total annual income from the business?`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      salaryTotal: R(annualSal),
      commissionPct: ZERO,
      workingPartnerIdx: 0,
      targetIdx: 0,
      ask: "TARGET_TOTAL_INCOME",
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(12) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(12) }] },
      ],
    },
    exactRationalAnswer: totalWorking,
    plausible: [share1, wrongNoDeduct, sleepingShare, totalWorking.add(R(2000))],
    isCurrency: true,
    solution: {
      given_data: [`${p1} (Working) = ${formatINR(c1)}`, `${p2} (Sleeping) = ${formatINR(c2)}`, `Annual salary = 12 × ${formatINR(monthlySal)} = ${formatINR(annualSal)}`, `Total Profit = ${formatINR(totalProfit)}`],
      formula: "Distributable Profit = Total Profit − Annual Salary; Working Partner Income = Salary + Profit Share",
      steps: [
        `Distributable profit = ${formatINR(totalProfit)} − ${formatINR(annualSal)} = ${formatINR(distProfit)}`,
        `Capital ratio ${p1} : ${p2} = ${red.str} ⇒ ${p1}'s share of distributable profit = ${formatINR(share1)}`,
        `${p1}'s total income = ${formatINR(annualSal)} + ${formatINR(share1)} = ${formatINR(totalWorking)}`,
      ],
      final_answer: formatINR(totalWorking),
    },
    shortcut_method: `Deduct annual salary (${formatINR(annualSal)}) first, split ${formatINR(distProfit)} in ${red.str}, then add salary back to ${p1}.`,
    rng,
  });
}

// E2. Working Partner Receives Commission (% of Total Profit)
function genE2_WorkingPartnerCommission(rng, difficulty) {
  const configs = [
    [40000, 60000, 10, 50000], // Comm=5k, Dist=45k (2:3 => 18k, 27k) => W total=23k
    [30000, 50000, 20, 40000], // Comm=8k, Dist=32k (3:5 => 12k, 20k) => W total=20k
    [45000, 55000, 10, 60000], // Comm=6k, Dist=54k (9:11 => 24.3k, 29.7k) -> use 50k: 45k/20 no -> pick clean:
    [35000, 45000, 20, 40000], // Comm=8k, Dist=32k (7:9 => 14k, 18k) => W total=22k
    [25000, 35000, 10, 40000], // Comm=4k, Dist=36k (5:7 => 15k, 21k) => W total=19k
    [48000, 72000, 15, 60000], // Comm=9k, Dist=51k (2:3 => 20.4k) -> use 50k: Comm=7.5k, Dist=42.5k (2:3 => 17k, 25.5k) => W=24.5k
  ].filter(([c1, c2, pct, tp]) => {
    const dist = tp - (tp * pct) / 100;
    return Number.isInteger(dist) && (dist * c1) % (c1 + c2) === 0;
  });

  const [c1, c2, commPct, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const commAmt = (totalProfit * commPct) / 100;
  const distProfit = totalProfit - commAmt;
  const red = reduceMultiRatio([c1, c2]);
  const share1 = R(distProfit * c1, c1 + c2);
  const totalWorking = share1.add(R(commAmt));
  const wrongNoDeduct = R(totalProfit * c1, c1 + c2).add(R(commAmt));

  return assemblePartnerQ({
    templateId: "PART_E2_WORKING_COMMISSION",
    question_type: "Working and Sleeping Partners",
    sub_type: "Working Partner Receives Commission",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains", "IBPS RRB PO"],
    question: `${p1} and ${p2} invest ${formatINR(c1)} and ${formatINR(c2)} respectively in a business for 1 year. ${p1} manages the business and gets ${commPct}% of the total profit as commission, and the remaining profit is divided in the ratio of their capitals. If the total profit is ${formatINR(totalProfit)}, find ${p1}'s total earnings.`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      salaryTotal: ZERO,
      commissionPct: R(commPct),
      workingPartnerIdx: 0,
      targetIdx: 0,
      ask: "TARGET_TOTAL_INCOME",
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(12) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(12) }] },
      ],
    },
    exactRationalAnswer: totalWorking,
    plausible: [share1, wrongNoDeduct, R(distProfit - share1.toNumber()), totalWorking.add(R(1500))],
    isCurrency: true,
    solution: {
      given_data: [`${p1} = ${formatINR(c1)} (Working, ${commPct}% commission)`, `${p2} = ${formatINR(c2)}`, `Total Profit = ${formatINR(totalProfit)}`],
      formula: "Commission = Total Profit × (c/100); Distributable = Total Profit − Commission",
      steps: [
        `${p1}'s commission = ${commPct}% of ${formatINR(totalProfit)} = ${formatINR(commAmt)}`,
        `Remaining distributable profit = ${formatINR(totalProfit)} − ${formatINR(commAmt)} = ${formatINR(distProfit)}`,
        `Capital ratio = ${red.str} ⇒ ${p1}'s profit share = ${formatINR(share1)}`,
        `${p1}'s total earnings = ${formatINR(commAmt)} + ${formatINR(share1)} = ${formatINR(totalWorking)}`,
      ],
      final_answer: formatINR(totalWorking),
    },
    shortcut_method: `Set aside ${commPct}% (${formatINR(commAmt)}) for ${p1}, divide remaining ${100 - commPct}% in ${red.str}, and add both.`,
    rng,
  });
}

// E3. Sleeping Partner's Profit Share (After Working Partner Commission)
function genE3_SleepingPartnerShare(rng, difficulty) {
  const configs = [
    [30000, 50000, 20, 40000], // Dist=32k (3:5) => Sleeping B = 20k
    [40000, 60000, 10, 50000], // Dist=45k (2:3) => Sleeping B = 27k
    [25000, 35000, 10, 40000], // Dist=36k (5:7) => Sleeping B = 21k
    [35000, 45000, 20, 40000], // Dist=32k (7:9) => Sleeping B = 18k
    [20000, 30000, 15, 40000], // Dist=34k (2:3) => skip non-int -> use 50k: Dist=42.5k (2:3 => 17k, 25.5k)
    [40000, 80000, 10, 60000], // Dist=54k (1:2) => Sleeping B = 36k
  ].filter(([c1, c2, pct, tp]) => ((tp * (100 - pct)) / 100 * c2) % (c1 + c2) === 0);

  const [c1, c2, commPct, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const commAmt = (totalProfit * commPct) / 100;
  const distProfit = totalProfit - commAmt;
  const red = reduceMultiRatio([c1, c2]);
  const sleepingShare = R(distProfit * c2, c1 + c2);
  const wrongFullProfit = R(totalProfit * c2, c1 + c2);
  const workingTotal = R(totalProfit).sub(sleepingShare);

  return assemblePartnerQ({
    templateId: "PART_E3_SLEEPING_PARTNER_SHARE",
    question_type: "Working and Sleeping Partners",
    sub_type: "Find Sleeping Partner's Profit Share",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains"],
    question: `${p1} (working partner) and ${p2} (sleeping partner) invest ${formatINR(c1)} and ${formatINR(c2)} respectively in a business. ${p1} receives ${commPct}% of the total profit for managing the firm, and the remainder is distributed in proportion to their capitals. Out of a total profit of ${formatINR(totalProfit)}, what is ${p2}'s share?`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      salaryTotal: ZERO,
      commissionPct: R(commPct),
      workingPartnerIdx: 0,
      targetIdx: 1,
      ask: "TARGET_PROFIT_SHARE",
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(12) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(12) }] },
      ],
    },
    exactRationalAnswer: sleepingShare,
    plausible: [wrongFullProfit, workingTotal, sleepingShare.add(R(2000)), sleepingShare.sub(R(1500))],
    isCurrency: true,
    solution: {
      given_data: [`${p1} = ${formatINR(c1)} (${commPct}% commission)`, `${p2} = ${formatINR(c2)} (sleeping)`, `Total Profit = ${formatINR(totalProfit)}`],
      formula: "Sleeping Partner Share = (Total Profit − Commission) × [C₂ / (C₁ + C₂)]",
      steps: [
        `Commission paid to ${p1} = ${commPct}% of ${formatINR(totalProfit)} = ${formatINR(commAmt)}`,
        `Distributable profit = ${formatINR(totalProfit)} − ${formatINR(commAmt)} = ${formatINR(distProfit)}`,
        `${p2}'s share = (${red.parts[1]} / ${red.parts[0] + red.parts[1]}) × ${formatINR(distProfit)} = ${formatINR(sleepingShare)}`,
      ],
      final_answer: formatINR(sleepingShare),
    },
    shortcut_method: `${p2} gets (${red.parts[1]}/${red.parts[0] + red.parts[1]}) of ${100 - commPct}% of ${formatINR(totalProfit)} = ${formatINR(sleepingShare)}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY F: Three or More Partners (F1–F4)
// ============================================================================

// F1. Three Partners with Different Investment Durations
function genF1_ThreePartnersDiffDurations(rng, difficulty) {
  const configs = [
    // [c1, t1, c2, t2, c3, t3, totalProfit]
    [20000, 12, 30000, 8, 40000, 6, 36000], // 240:240:240 -> skip equal!
    [20000, 12, 30000, 10, 40000, 6, 39000], // 240:300:240 = 4:5:4 (sum 13) -> 12k, 15k, 12k
    [30000, 12, 40000, 9, 50000, 6, 51000],  // 360:360:300 = 6:6:5 (sum 17) -> 18k, 18k, 15k
    [24000, 12, 36000, 10, 48000, 6, 47000], // 288:360:288 -> 4:5:4
    [25000, 12, 30000, 8, 45000, 4, 36000],  // 300:240:180 = 5:4:3 (sum 12) -> 15k, 12k, 9k
    [30000, 10, 40000, 9, 60000, 5, 48000],  // 300:360:300 = 5:6:5 (sum 16) -> 15k, 18k, 15k
    [40000, 9, 30000, 8, 25000, 12, 45000],  // 360:240:300 = 6:4:5 (sum 15) -> 18k, 12k, 15k
    [36000, 10, 45000, 6, 60000, 3, 45000],  // 360:270:180 = 4:3:2 (sum 9) -> 20k, 15k, 10k
  ].filter(([c1, t1, c2, t2, c3, t3, tp]) => {
    const e1 = c1 * t1, e2 = c2 * t2, e3 = c3 * t3;
    return e1 !== e2 && e2 !== e3 && (tp * e1) % (e1 + e2 + e3) === 0;
  });

  const [c1, t1, c2, t2, c3, t3, totalProfit] = rng.pick(configs);
  const [p1, p2, p3] = pickPartners(rng, 3);
  const effs = [c1 * t1, c2 * t2, c3 * t3];
  const sumEff = effs[0] + effs[1] + effs[2];
  const targetIdx = rng.pick([0, 1, 2]);
  const targetName = [p1, p2, p3][targetIdx];
  const red = reduceMultiRatio(effs);
  const ans = R(totalProfit * effs[targetIdx], sumEff);
  const wrongNoTime = R(totalProfit * [c1, c2, c3][targetIdx], c1 + c2 + c3);

  return assemblePartnerQ({
    templateId: "PART_F1_THREE_DIFF_DURATIONS",
    question_type: "Three or More Partners",
    sub_type: "Three Partners with Different Durations",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `${p1}, ${p2}, and ${p3} enter into a partnership. ${p1} invests ${formatINR(c1)} for ${t1} months, ${p2} invests ${formatINR(c2)} for ${t2} months, and ${p3} invests ${formatINR(c3)} for ${t3} months. Out of a total profit of ${formatINR(totalProfit)}, what is ${targetName}'s share?`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      targetIdx,
      ask: "TARGET_PROFIT_SHARE",
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(t1) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(t2) }] },
        { name: p3, segments: [{ capital: R(c3), months: R(t3) }] },
      ],
    },
    exactRationalAnswer: ans,
    plausible: [
      R(totalProfit * effs[(targetIdx + 1) % 3], sumEff),
      R(totalProfit * effs[(targetIdx + 2) % 3], sumEff),
      wrongNoTime,
      ans.add(R(2000)),
    ],
    isCurrency: true,
    solution: {
      given_data: [
        `${p1}: ${formatINR(c1)} × ${t1}m`,
        `${p2}: ${formatINR(c2)} × ${t2}m`,
        `${p3}: ${formatINR(c3)} × ${t3}m`,
        `Total Profit = ${formatINR(totalProfit)}`,
      ],
      formula: "Profit Ratio = C₁T₁ : C₂T₂ : C₃T₃",
      steps: [
        `Capital-months: ${effs[0].toLocaleString("en-IN")} : ${effs[1].toLocaleString("en-IN")} : ${effs[2].toLocaleString("en-IN")}`,
        `Simplified ratio = ${red.str} (Sum of parts = ${red.parts.reduce((a, b) => a + b, 0)})`,
        `${targetName}'s share = (${red.parts[targetIdx]} / ${red.parts.reduce((a, b) => a + b, 0)}) × ${formatINR(totalProfit)} = ${formatINR(ans)}`,
      ],
      final_answer: formatINR(ans),
    },
    shortcut_method: `Drop 3 zeros and reduce (${c1 / 1000}×${t1}) : (${c2 / 1000}×${t2}) : (${c3 / 1000}×${t3}) = ${red.str}.`,
    rng,
  });
}

// F2. Three Partners with Changing Investments (Find Final Ratio)
function genF2_ThreePartnersChangingCapital(rng, difficulty) {
  const configs = [
    // A adds after 6m, B withdraws after 6m, C joins after 4m
    [20000, 10000, 40000, 10000, 45000, 4], // A:120+180=300, B:240+180=420, C:45*8=360 => 5:7:6
    [30000, 10000, 50000, 10000, 60000, 4], // A:180+240=420, B:300+240=540, C:60*8=480 => 7:9:8
    [25000, 15000, 45000, 15000, 40000, 3], // A:150+240=390, B:270+180=450, C:40*9=360 => 13:15:12
    [40000, 20000, 60000, 20000, 45000, 4], // A:240+360=600, B:360+240=600 -> skip equal!
    [24000, 12000, 48000, 12000, 36000, 2], // A:144+216=360, B:288+216=504, C:36*10=360 -> skip!
    [20000, 20000, 50000, 10000, 60000, 6], // A:120+240=360, B:300+240=540, C:60*6=360 -> skip!
    [20000, 10000, 50000, 10000, 50000, 6], // A:300, B:540, C:300 -> skip!
    [20000, 10000, 50000, 10000, 60000, 5], // A:300, B:540, C:420 => 5:9:7
  ].filter(([c1, a1, c2, s2, c3, join3]) => {
    const e1 = c1 * 6 + (c1 + a1) * 6;
    const e2 = c2 * 6 + (c2 - s2) * 6;
    const e3 = c3 * (12 - join3);
    return e1 !== e2 && e2 !== e3 && e1 !== e3;
  });

  const [c1, add1, c2, sub2, c3, join3] = rng.pick(configs);
  const [p1, p2, p3] = pickPartners(rng, 3);
  const e1 = c1 * 6 + (c1 + add1) * 6;
  const e2 = c2 * 6 + (c2 - sub2) * 6;
  const e3 = c3 * (12 - join3);
  const red = reduceMultiRatio([e1, e2, e3]);
  const wrongNoChange = reduceMultiRatio([c1 * 12, c2 * 12, c3 * (12 - join3)]).str;
  const rev = [...red.parts].reverse().join(" : ");

  return assemblePartnerQ({
    templateId: "PART_F2_THREE_CHANGING_RATIO",
    question_type: "Three or More Partners",
    sub_type: "Three Partners with Changing Investments",
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains", "SBI PO Prelims"],
    question: `${p1} and ${p2} started a business with ${formatINR(c1)} and ${formatINR(c2)} respectively. After 6 months, ${p1} added ${formatINR(add1)} while ${p2} withdrew ${formatINR(sub2)}. Meanwhile, ${p3} joined the business ${join3} months after the start with ${formatINR(c3)}. What is the profit-sharing ratio of ${p1}, ${p2}, and ${p3} at the end of 1 year?`,
    mathModel: {
      kind: "PROFIT_RATIO",
      businessMonths: R(12),
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(6) }, { capital: R(c1 + add1), months: R(6) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(6) }, { capital: R(c2 - sub2), months: R(6) }] },
        { name: p3, segments: [{ capital: R(c3), months: R(12 - join3) }] },
      ],
    },
    ratioAnswer: red.str,
    ratioFormat: {
      correct: red.str,
      parts: red.parts,
      distractors: [
        wrongNoChange,
        rev,
        `${red.parts[0] + 1} : ${red.parts[1]} : ${red.parts[2]}`,
        `${red.parts[0]} : ${red.parts[1] + 1} : ${red.parts[2]}`,
      ],
    },
    solution: {
      given_data: [
        `${p1}: ${formatINR(c1)} (6m) + ${formatINR(c1 + add1)} (6m)`,
        `${p2}: ${formatINR(c2)} (6m) + ${formatINR(c2 - sub2)} (6m)`,
        `${p3}: ${formatINR(c3)} (${12 - join3}m)`,
      ],
      formula: "Profit Ratio = Effective Capital-Months of A : B : C",
      steps: [
        `${p1} = ${e1.toLocaleString("en-IN")}; ${p2} = ${e2.toLocaleString("en-IN")}; ${p3} = ${e3.toLocaleString("en-IN")}`,
        `Dividing by their HCF gives ${red.str}`,
      ],
      final_answer: red.str,
    },
    shortcut_method: `In thousands: ${e1 / 1000} : ${e2 / 1000} : ${e3 / 1000} = ${red.str}.`,
    rng,
  });
}

// F3. Three Partners — Find Missing Investment of Third Partner
function genF3_ThreePartnersMissingCapital(rng, difficulty) {
  const configs = [
    // [c1, t1, c2, t2, t3, r1, r2, r3, c3]
    [30000, 12, 40000, 9, 6, 3, 3, 2, 40000], // A=360k, B=360k, C=240k/6 = 40k
    [40000, 12, 50000, 6, 8, 8, 5, 6, 45000], // A=480k, B=300k, C=360k/8 = 45k
    [25000, 12, 30000, 10, 6, 5, 5, 4, 40000], // A=300k, B=300k, C=240k/6 = 40k
    [36000, 10, 45000, 8, 9, 4, 4, 5, 50000], // A=360k, B=360k, C=450k/9 = 50k
    [45000, 8, 30000, 12, 6, 3, 3, 4, 80000], // A=360k, B=360k, C=480k/6 = 80k
  ];
  const [c1, t1, c2, t2, t3, r1, r2, r3, c3] = rng.pick(configs);
  const [p1, p2, p3] = pickPartners(rng, 3);

  return assemblePartnerQ({
    templateId: "PART_F3_THREE_MISSING_CAPITAL",
    question_type: "Three or More Partners",
    sub_type: "Find Missing Investment of One Partner",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: `${p1} invests ${formatINR(c1)} for ${t1} months, ${p2} invests ${formatINR(c2)} for ${t2} months, and ${p3} invests an unknown amount for ${t3} months. If they share the profit in the ratio ${r1} : ${r2} : ${r3}, how much capital did ${p3} invest?`,
    mathModel: {
      kind: "MISSING_INVESTMENT",
      businessMonths: R(12),
      knownPartnerEff: R(c1 * t1),
      unknownMonths: R(t3),
      ratioUnknownToKnown: R(r3, r1),
      priorEff: ZERO,
    },
    exactRationalAnswer: R(c3),
    plausible: [R(c3 + 5000), R(c3 - 5000), R((c1 * r3) / r1), R(c3 + 10000)],
    isCurrency: true,
    solution: {
      given_data: [`${p1}: ${formatINR(c1)} × ${t1}m`, `${p3}: C₃ × ${t3}m`, `Profit ratio ${p1}:${p3} = ${r1}:${r3}`],
      formula: "(C₁ × T₁) / (C₃ × T₃) = r₁ / r₃",
      steps: [
        `(${c1} × ${t1}) / (C₃ × ${t3}) = ${r1} / ${r3}`,
        `C₃ = (${c1} × ${t1} × ${r3}) / (${t3} × ${r1}) = ${formatINR(c3)}`,
      ],
      final_answer: formatINR(c3),
    },
    shortcut_method: `Compare ${p1} and ${p3} directly: C₃ = (${c1} × ${t1} × ${r3}) / (${t3} × ${r1}) = ${formatINR(c3)}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY G: Advanced Partnership (G1–G4)
// ============================================================================

// G1. Working Partner Salary + Commission Combined (Mains)
function genG1_SalaryAndCommission(rng, difficulty) {
  const configs = [
    // [c1, c2, monthlySalary, commPct, totalProfit]
    [40000, 60000, 1000, 10, 60000], // Sal=12k, Comm=6k, Dist=42k -> 2:3 skip -> use 5:7 or 60k:
    [50000, 75000, 1000, 10, 80000], // Sal=12k, Comm=8k, Dist=60k (2:3 => 24k, 36k) => W total = 44k
    [40000, 60000, 1500, 10, 80000], // Sal=18k, Comm=8k, Dist=54k (2:3 => 21.6k) -> use 70k: Sal=18k, Comm=7k, Dist=45k (2:3 => 18k, 27k) => W=43k
    [30000, 50000, 1000, 10, 60000], // Sal=12k, Comm=6k, Dist=42k -> skip
    [30000, 50000, 1500, 10, 60000], // Sal=18k, Comm=6k, Dist=36k -> skip
    [30000, 50000, 1000, 15, 80000], // Sal=12k, Comm=12k, Dist=56k (3:5 => 21k, 35k) => W=45k
    [45000, 75000, 2000, 10, 80000], // Sal=24k, Comm=8k, Dist=48k (3:5 => 18k, 30k) => W=50k
    [36000, 48000, 1500, 10, 60000], // Sal=18k, Comm=6k, Dist=36k -> skip
    [36000, 48000, 1000, 10, 60000], // Sal=12k, Comm=6k, Dist=42k (3:4 => 18k, 24k) => W=36k
  ].filter(([c1, c2, ms, pct, tp]) => {
    const dist = tp - ms * 12 - (tp * pct) / 100;
    return dist > 0 && Number.isInteger(dist) && (dist * c1) % (c1 + c2) === 0;
  });

  const [c1, c2, monthlySal, commPct, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const annualSal = monthlySal * 12;
  const commAmt = (totalProfit * commPct) / 100;
  const distProfit = totalProfit - annualSal - commAmt;
  const red = reduceMultiRatio([c1, c2]);
  const share1 = R(distProfit * c1, c1 + c2);
  const totalWorking = share1.add(R(annualSal + commAmt));
  const wrongNoDeduct = R(totalProfit * c1, c1 + c2).add(R(annualSal + commAmt));
  const wrongOnlySal = R((totalProfit - annualSal) * c1, c1 + c2).add(R(annualSal));

  return assemblePartnerQ({
    templateId: "PART_G1_SALARY_AND_COMMISSION",
    question_type: "Advanced Partnership",
    sub_type: "Working Partner Salary and Commission Combined",
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains"],
    question: `${p1} and ${p2} invest ${formatINR(c1)} and ${formatINR(c2)} respectively in a firm for 1 year. ${p1}, being the managing partner, draws a monthly salary of ${formatINR(monthlySal)} plus a commission of ${commPct}% of the total annual profit. The remaining profit is divided in the ratio of their capitals. If the total profit is ${formatINR(totalProfit)}, what is ${p1}'s total annual receipt?`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      salaryTotal: R(annualSal),
      commissionPct: R(commPct),
      workingPartnerIdx: 0,
      targetIdx: 0,
      ask: "TARGET_TOTAL_INCOME",
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(12) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(12) }] },
      ],
    },
    exactRationalAnswer: totalWorking,
    plausible: [wrongNoDeduct, wrongOnlySal, R(totalProfit).sub(totalWorking), totalWorking.add(R(2500))],
    isCurrency: true,
    solution: {
      given_data: [
        `Total Profit = ${formatINR(totalProfit)}`,
        `Annual Salary = ${formatINR(annualSal)}, Commission (${commPct}%) = ${formatINR(commAmt)}`,
        `Capital ratio = ${red.str}`,
      ],
      formula: "Distributable Profit = Total Profit − Salary − Commission",
      steps: [
        `Total remuneration to ${p1} = ${formatINR(annualSal)} + ${formatINR(commAmt)} = ${formatINR(annualSal + commAmt)}`,
        `Distributable profit = ${formatINR(totalProfit)} − ${formatINR(annualSal + commAmt)} = ${formatINR(distProfit)}`,
        `${p1}'s share of distributable profit = (${red.parts[0]}/${red.parts[0] + red.parts[1]}) × ${formatINR(distProfit)} = ${formatINR(share1)}`,
        `${p1}'s total receipt = ${formatINR(annualSal + commAmt)} + ${formatINR(share1)} = ${formatINR(totalWorking)}`,
      ],
      final_answer: formatINR(totalWorking),
    },
    shortcut_method: `Deduct both salary (${formatINR(annualSal)}) and commission (${formatINR(commAmt)}) before splitting ${formatINR(distProfit)}.`,
    rng,
  });
}

// G2. Find Total Profit Given Working Partner's Total Income (with Commission)
function genG2_FindTotalProfitWithCommission(rng, difficulty) {
  const configs = [
    [40000, 60000, 10, 50000], // W = 5k + 18k = 23k
    [30000, 50000, 20, 40000], // W = 8k + 12k = 20k
    [35000, 45000, 20, 40000], // W = 8k + 14k = 22k
    [25000, 35000, 10, 40000], // W = 4k + 15k = 19k
    [40000, 80000, 10, 60000], // W = 6k + 18k = 24k
  ];
  const [c1, c2, commPct, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const commAmt = (totalProfit * commPct) / 100;
  const distProfit = totalProfit - commAmt;
  const share1 = (distProfit * c1) / (c1 + c2);
  const knownWorkingTotal = commAmt + share1;
  const red = reduceMultiRatio([c1, c2]);

  return assemblePartnerQ({
    templateId: "PART_G2_TOTAL_PROFIT_COMMISSION",
    question_type: "Advanced Partnership",
    sub_type: "Find Total Profit from Working Partner's Share",
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains", "SBI PO Prelims"],
    question: `${p1} and ${p2} started a business with ${formatINR(c1)} and ${formatINR(c2)} respectively. ${p1} receives ${commPct}% of the total profit as management commission, and the rest is shared in the ratio of their investments. If ${p1} received a total of ${formatINR(knownWorkingTotal)} at the end of the year, what was the total profit of the business?`,
    mathModel: {
      kind: "FIND_TOTAL_PROFIT",
      businessMonths: R(12),
      knownShare: R(knownWorkingTotal),
      knownIdx: 0,
      workingPartnerIdx: 0,
      commissionPct: R(commPct),
      salaryTotal: ZERO,
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(12) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(12) }] },
      ],
    },
    exactRationalAnswer: R(totalProfit),
    plausible: [
      R(totalProfit + 5000),
      R(totalProfit - 5000),
      R(knownWorkingTotal * (c1 + c2), c1),
      R(totalProfit + 10000),
    ],
    isCurrency: true,
    solution: {
      given_data: [`Capital ratio = ${red.str}`, `${p1}'s commission = ${commPct}%`, `${p1}'s total receipt = ${formatINR(knownWorkingTotal)}`],
      formula: "Let Total Profit = 100P; Working Partner = cP + (100−c)P × [r₁/(r₁+r₂)]",
      steps: [
        `Capital ratio ${p1} : ${p2} = ${red.str}`,
        `${p1}'s overall fraction of total profit = ${commPct}% + (${100 - commPct}% × ${red.parts[0]}/${red.parts[0] + red.parts[1]}) = ${(knownWorkingTotal * 100) / totalProfit}%`,
        `Total Profit = ${formatINR(knownWorkingTotal)} × (100 / ${(knownWorkingTotal * 100) / totalProfit}) = ${formatINR(totalProfit)}`,
      ],
      final_answer: formatINR(totalProfit),
    },
    shortcut_method: `${p1} effectively gets ${(knownWorkingTotal * 100) / totalProfit}% of total profit ⇒ Total Profit = ${formatINR(totalProfit)}.`,
    rng,
  });
}

// G3. Three Partners with Different Joining & Leaving Dates (Mains)
function genG3_ThreePartnersJoinLeave(rng, difficulty) {
  const configs = [
    // [c1, c2, join2, c3, join3, leave1, totalProfit]
    // A stays (12 - leave1)? Let's specify stay1 directly: A leaves after stay1 months; B joins after join2; C joins after join3
    [40000, 8, 50000, 4, 60000, 6, 54000], // A:40*8=320, B:50*8=400, C:60*6=360 => 8:10:9 (sum 27) -> 16k, 20k, 18k
    [30000, 10, 40000, 3, 60000, 6, 51000], // A:300, B:360, C:360 -> skip equal B,C
    [45000, 8, 40000, 3, 50000, 6, 51000],  // A:360, B:360 -> skip
    [36000, 10, 48000, 3, 60000, 6, 55000], // A:360, B:432, C:360 -> skip
    [40000, 9, 45000, 4, 60000, 8, 48000],  // A:360, B:360 -> skip
    [30000, 8, 45000, 4, 60000, 6, 48000],  // A:240, B:360, C:360 -> skip
    [30000, 8, 40000, 3, 60000, 7, 45000],  // A:240, B:360, C:300 => 4:6:5 (sum 15) -> 12k, 18k, 15k
    [36000, 10, 50000, 4, 60000, 8, 50000], // A:360, B:400, C:240 => 9:10:6 (sum 25) -> 18k, 20k, 12k
    [45000, 8, 50000, 3, 60000, 7, 55500],  // A:360, B:450, C:300 => 12:15:10 (sum 37) -> 18k, 22.5k, 15k -> use 37000
    [45000, 8, 50000, 3, 60000, 7, 37000],  // 12:15:10 -> 12k, 15k, 10k
  ].filter(([c1, s1, c2, j2, c3, j3, tp]) => {
    const e1 = c1 * s1, e2 = c2 * (12 - j2), e3 = c3 * (12 - j3);
    return e1 !== e2 && e2 !== e3 && e1 !== e3 && (tp * e1) % (e1 + e2 + e3) === 0;
  });

  const [c1, stay1, c2, join2, c3, join3, totalProfit] = rng.pick(configs);
  const [p1, p2, p3] = pickPartners(rng, 3);
  const t2 = 12 - join2;
  const t3 = 12 - join3;
  const effs = [c1 * stay1, c2 * t2, c3 * t3];
  const sumEff = effs[0] + effs[1] + effs[2];
  const red = reduceMultiRatio(effs);
  const targetIdx = rng.pick([0, 1, 2]);
  const targetName = [p1, p2, p3][targetIdx];
  const ans = R(totalProfit * effs[targetIdx], sumEff);

  return assemblePartnerQ({
    templateId: "PART_G3_THREE_JOIN_LEAVE",
    question_type: "Advanced Partnership",
    sub_type: "Different Joining and Leaving Dates (3 Partners)",
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains"],
    question: `${p1} started a business with ${formatINR(c1)} and left after ${stay1} months. ${p2} joined ${join2} months after the start with ${formatINR(c2)}, and ${p3} joined ${join3} months after the start with ${formatINR(c3)}. If the business earned ${formatINR(totalProfit)} at the end of 1 year, what is ${targetName}'s share of the profit?`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(totalProfit),
      targetIdx,
      ask: "TARGET_PROFIT_SHARE",
      partners: [
        { name: p1, segments: [{ capital: R(c1), months: R(stay1) }] },
        { name: p2, segments: [{ capital: R(c2), months: R(t2) }] },
        { name: p3, segments: [{ capital: R(c3), months: R(t3) }] },
      ],
    },
    exactRationalAnswer: ans,
    plausible: [
      R(totalProfit * effs[(targetIdx + 1) % 3], sumEff),
      R(totalProfit * effs[(targetIdx + 2) % 3], sumEff),
      ans.add(R(2000)),
      ans.sub(R(1500)),
    ],
    isCurrency: true,
    solution: {
      given_data: [
        `${p1}: ${formatINR(c1)} for ${stay1}m`,
        `${p2}: ${formatINR(c2)} for (12 − ${join2}) = ${t2}m`,
        `${p3}: ${formatINR(c3)} for (12 − ${join3}) = ${t3}m`,
      ],
      formula: "Profit Ratio = C₁T₁ : C₂T₂ : C₃T₃",
      steps: [
        `Capital-months: ${effs[0].toLocaleString("en-IN")} : ${effs[1].toLocaleString("en-IN")} : ${effs[2].toLocaleString("en-IN")}`,
        `Simplified ratio = ${red.str} (Sum of parts = ${red.parts.reduce((a, b) => a + b, 0)})`,
        `${targetName}'s share = (${red.parts[targetIdx]} / ${red.parts.reduce((a, b) => a + b, 0)}) × ${formatINR(totalProfit)} = ${formatINR(ans)}`,
      ],
      final_answer: formatINR(ans),
    },
    shortcut_method: `Active months are ${stay1}, ${t2}, ${t3} ⇒ Ratio ${red.str}.`,
    rng,
  });
}

// G4. Combined Two-Year Partnership with Mid-Term Capital Revision (Mains)
function genG4_TwoYearCapitalRevision(rng, difficulty) {
  const configs = [
    // 24-month business: A invests c1 for 12m, then c1+add1 for 12m; B invests c2 for 24m
    [40000, 20000, 60000, 66000], // A: 40*12+60*12 = 1200k, B: 60*24 = 1440k => 5:6 -> 30k, 36k
    [30000, 15000, 45000, 51000], // A: 30*12+45*12 = 900k, B: 45*24 = 1080k => 5:6 -> skip 51k -> use 55k
    [30000, 15000, 45000, 55000], // 5:6 -> 25k, 30k
    [50000, 25000, 50000, 65000], // A: 50*12+75*12 = 1500k, B: 50*24 = 1200k => 5:4 -> skip 65k -> use 54k
    [50000, 25000, 50000, 54000], // 5:4 -> 30k, 24k
    [36000, 12000, 48000, 56000], // A: 36*12+48*12 = 1008k, B: 48*24 = 1152k => 7:8 -> skip 56k -> use 60k
    [36000, 12000, 48000, 60000], // 7:8 -> 28k, 32k
  ].filter(([c1, a1, c2, tp]) => {
    const e1 = c1 * 12 + (c1 + a1) * 12;
    const e2 = c2 * 24;
    return (tp * e1) % (e1 + e2) === 0;
  });

  const [c1, add1, c2, totalProfit] = rng.pick(configs);
  const [p1, p2] = pickPartners(rng, 2);
  const eff1 = c1 * 12 + (c1 + add1) * 12;
  const eff2 = c2 * 24;
  const red = reduceMultiRatio([eff1, eff2]);
  const share1 = R(totalProfit * eff1, eff1 + eff2);
  const share2 = R(totalProfit).sub(share1);
  const wrongFullYear = R(totalProfit * (c1 + add1), c1 + add1 + c2);

  return assemblePartnerQ({
    templateId: "PART_G4_TWO_YEAR_REVISION",
    question_type: "Advanced Partnership",
    sub_type: "Combined Two-Year Investment & Time Problem",
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains", "IBPS RRB PO"],
    question: `${p1} and ${p2} entered into a 2-year partnership investing ${formatINR(c1)} and ${formatINR(c2)} respectively. At the end of the first year, ${p1} invested an additional ${formatINR(add1)}. If the total profit earned over the 2-year period was ${formatINR(totalProfit)}, find ${p1}'s share of the profit.`,
    mathModel: {
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(24),
      totalProfit: R(totalProfit),
      targetIdx: 0,
      ask: "TARGET_PROFIT_SHARE",
      partners: [
        {
          name: p1,
          segments: [
            { capital: R(c1), months: R(12) },
            { capital: R(c1 + add1), months: R(12) },
          ],
        },
        { name: p2, segments: [{ capital: R(c2), months: R(24) }] },
      ],
    },
    exactRationalAnswer: share1,
    plausible: [share2, wrongFullYear, share1.add(R(2500)), share1.sub(R(2000))],
    isCurrency: true,
    solution: {
      given_data: [
        `Business period = 2 years (24 months)`,
        `${p1}: ${formatINR(c1)} (12m) + ${formatINR(c1 + add1)} (12m)`,
        `${p2}: ${formatINR(c2)} (24m)`,
        `Total Profit = ${formatINR(totalProfit)}`,
      ],
      formula: "Profit Ratio = Sum of (Capital × Months) over the 24-month period",
      steps: [
        `${p1} effective capital = (${c1} × 12) + (${c1 + add1} × 12) = ${eff1.toLocaleString("en-IN")}`,
        `${p2} effective capital = ${c2} × 24 = ${eff2.toLocaleString("en-IN")} ⇒ Ratio = ${red.str}`,
        `${p1}'s share = (${red.parts[0]} / ${red.parts[0] + red.parts[1]}) × ${formatINR(totalProfit)} = ${formatINR(share1)}`,
      ],
      final_answer: formatINR(share1),
    },
    shortcut_method: `In years: ${p1} = ${c1 / 1000}(1) + ${(c1 + add1) / 1000}(1); ${p2} = ${c2 / 1000}(2) ⇒ Ratio ${red.str}.`,
    rng,
  });
}

export const PARTNERSHIP_TEMPLATES_PART_2 = [
  { id: "PART_E1", category: "E", difficulties: ["Medium", "Hard"], fn: genE1_WorkingPartnerSalary },
  { id: "PART_E2", category: "E", difficulties: ["Medium", "Hard"], fn: genE2_WorkingPartnerCommission },
  { id: "PART_E3", category: "E", difficulties: ["Medium", "Hard"], fn: genE3_SleepingPartnerShare },

  { id: "PART_F1", category: "F", difficulties: ["Medium", "Hard"], fn: genF1_ThreePartnersDiffDurations },
  { id: "PART_F2", category: "F", difficulties: ["Hard"], fn: genF2_ThreePartnersChangingCapital },
  { id: "PART_F3", category: "F", difficulties: ["Medium", "Hard"], fn: genF3_ThreePartnersMissingCapital },

  { id: "PART_G1", category: "G", difficulties: ["Hard"], fn: genG1_SalaryAndCommission },
  { id: "PART_G2", category: "G", difficulties: ["Hard"], fn: genG2_FindTotalProfitWithCommission },
  { id: "PART_G3", category: "G", difficulties: ["Hard"], fn: genG3_ThreePartnersJoinLeave },
  { id: "PART_G4", category: "G", difficulties: ["Hard"], fn: genG4_TwoYearCapitalRevision },
];