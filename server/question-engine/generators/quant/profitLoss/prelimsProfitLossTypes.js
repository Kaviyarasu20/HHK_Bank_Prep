// Place at: server/question-engine/generators/quant/profitLoss/prelimsProfitLossTypes.js
import { randInt, pickRandom, shuffle } from "../../../core/mathUtils.js";

/**
 * Builds 5 unique options with optional prefix/suffix (e.g., "Rs. ", "%").
 */
export function buildPLOptions(correctVal, { prefix = "", suffix = "", step = 5, decimals = 0 } = {}) {
  const fmt = (v) => `${prefix}${decimals > 0 ? Number(v).toFixed(decimals) : Math.round(v)}${suffix}`;
  const correctStr = fmt(correctVal);
  const distractors = new Set();
  const mults = [-4, -3, -2, -1, 1, 2, 3, 4, 5, 6];

  let guard = 0;
  while (distractors.size < 4 && guard < 200) {
    guard++;
    const cand = Number(correctVal) + pickRandom(mults) * step;
    if (cand > 0) {
      const s = fmt(cand);
      if (s !== correctStr) distractors.add(s);
    }
  }
  let extra = 1;
  while (distractors.size < 4) {
    const s = fmt(Number(correctVal) + extra * step);
    if (s !== correctStr) distractors.add(s);
    extra++;
  }
  const options = shuffle([correctStr, ...distractors]);
  return { options, correctOptionIndex: options.indexOf(correctStr), answer: correctStr };
}

function makePLQ({ exam, difficulty, subType, questionText, optResult, solutionSteps }) {
  return {
    questionId: `PL_P_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Profit & Loss",
    subType,
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText,
    options: optResult.options,
    correctOptionIndex: optResult.correctOptionIndex,
    answer: optResult.answer,
    solutionSteps,
  };
}

// 1. Basic Profit and Loss
export function prelimsPL1Basic(exam, difficulty) {
  const cp = randInt(8, 35) * 50;
  const isProfit = Math.random() < 0.5;
  const delta = randInt(3, 12) * 25;
  const sp = isProfit ? cp + delta : cp - delta;
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_1_BASIC",
    questionText: `A trader buys an article for Rs. ${cp} and sells it for Rs. ${sp}. What is the ${isProfit ? "profit" : "loss"} amount?`,
    optResult: buildPLOptions(delta, { prefix: "Rs. ", step: 25 }),
    solutionSteps: [
      `${isProfit ? "Profit = SP - CP" : "Loss = CP - SP"} = Rs. ${Math.max(cp, sp)} - Rs. ${Math.min(cp, sp)} = Rs. ${delta}`,
    ],
  });
}

// 2. Finding Cost Price (CP)
export function prelimsPL2FindCP(exam, difficulty) {
  const cp = randInt(6, 30) * 100;
  const profitPct = pickRandom([10, 15, 20, 25, 30]);
  const sp = (cp * (100 + profitPct)) / 100;
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_2_FIND_CP",
    questionText: `By selling a chair for Rs. ${sp}, a shopkeeper earns a profit of ${profitPct}%. Find the cost price of the chair.`,
    optResult: buildPLOptions(cp, { prefix: "Rs. ", step: 50 }),
    solutionSteps: [
      `${100 + profitPct}% of CP = Rs. ${sp}`,
      `CP = (${sp} × 100) / ${100 + profitPct} = Rs. ${cp}`,
    ],
  });
}

// 3. Finding Selling Price (SP)
export function prelimsPL3FindSP(exam, difficulty) {
  const cp = randInt(6, 30) * 100;
  const isProfit = Math.random() < 0.6;
  const pct = pickRandom([10, 15, 20, 25, 30]);
  const sp = isProfit ? (cp * (100 + pct)) / 100 : (cp * (100 - pct)) / 100;
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_3_FIND_SP",
    questionText: `An article bought for Rs. ${cp} is sold at a ${isProfit ? "profit" : "loss"} of ${pct}%. Find its selling price.`,
    optResult: buildPLOptions(sp, { prefix: "Rs. ", step: 40 }),
    solutionSteps: [
      `SP = ${cp} × (${isProfit ? 100 + pct : 100 - pct} / 100) = Rs. ${sp}`,
    ],
  });
}

// 4. Finding Profit Percentage
export function prelimsPL4ProfitPct(exam, difficulty) {
  const profitPct = pickRandom([10, 12, 15, 20, 25, 30, 40]);
  const cp = randInt(4, 25) * 100;
  const sp = (cp * (100 + profitPct)) / 100;
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_4_PROFIT_PCT",
    questionText: `A merchant buys a watch for Rs. ${cp} and sells it for Rs. ${sp}. What is the profit percentage?`,
    optResult: buildPLOptions(profitPct, { suffix: "%", step: 2 }),
    solutionSteps: [
      `Profit = ${sp} - ${cp} = Rs. ${sp - cp}`,
      `Profit % = (${sp - cp} / ${cp}) × 100 = ${profitPct}%`,
    ],
  });
}

// 5. Finding Loss Percentage
export function prelimsPL5LossPct(exam, difficulty) {
  const lossPct = pickRandom([10, 12, 15, 20, 25, 30]);
  const cp = randInt(4, 25) * 100;
  const sp = (cp * (100 - lossPct)) / 100;
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_5_LOSS_PCT",
    questionText: `A bicycle purchased for Rs. ${cp} is sold for Rs. ${sp}. Find the loss percentage.`,
    optResult: buildPLOptions(lossPct, { suffix: "%", step: 2 }),
    solutionSteps: [
      `Loss = ${cp} - ${sp} = Rs. ${cp - sp}`,
      `Loss % = (${cp - sp} / ${cp}) × 100 = ${lossPct}%`,
    ],
  });
}

// 6. Selling Price and Cost Price Comparison (CP of X articles = SP of Y articles)
export function prelimsPL6CPvsSP(exam, difficulty) {
  const pairs = [
    { x: 25, y: 20, pct: 25 },
    { x: 15, y: 12, pct: 25 },
    { x: 24, y: 20, pct: 20 },
    { x: 30, y: 25, pct: 20 },
    { x: 18, y: 15, pct: 20 },
    { x: 22, y: 20, pct: 10 },
    { x: 26, y: 20, pct: 30 },
    { x: 28, y: 20, pct: 40 },
    { x: 15, y: 10, pct: 50 },
  ];
  const p = pickRandom(pairs);
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_6_CP_VS_SP",
    questionText: `If the cost price of ${p.x} articles is equal to the selling price of ${p.y} articles, what is the profit percentage?`,
    optResult: buildPLOptions(p.pct, { suffix: "%", step: 5 }),
    solutionSteps: [
      `Profit % = [(${p.x} - ${p.y}) / ${p.y}] × 100 = (${p.x - p.y} / ${p.y}) × 100 = ${p.pct}%`,
    ],
  });
}

// 7. Marked Price and Discount
export function prelimsPL7MPDiscount(exam, difficulty) {
  const mp = randInt(6, 30) * 100;
  const discPct = pickRandom([10, 15, 20, 25, 30]);
  const sp = (mp * (100 - discPct)) / 100;
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_7_MP_DISCOUNT",
    questionText: `An item has a marked price of Rs. ${mp}. If a discount of ${discPct}% is allowed on it, what is its selling price?`,
    optResult: buildPLOptions(sp, { prefix: "Rs. ", step: 40 }),
    solutionSteps: [
      `Discount = ${discPct}% of ${mp} = Rs. ${(mp * discPct) / 100}`,
      `SP = ${mp} - ${(mp * discPct) / 100} = Rs. ${sp}`,
    ],
  });
}

// 8. Successive Discounts
export function prelimsPL8SuccessiveDiscounts(exam, difficulty) {
  const pairs = [
    [20, 10, 28],
    [20, 25, 40],
    [30, 10, 37],
    [30, 20, 44],
    [25, 20, 40],
    [40, 10, 46],
    [40, 25, 55],
    [10, 10, 19],
  ];
  const [d1, d2, eqDisc] = pickRandom(pairs);
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_8_SUCCESSIVE_DISCOUNTS",
    questionText: `Two successive discounts of ${d1}% and ${d2}% are equivalent to a single discount of what percentage?`,
    optResult: buildPLOptions(eqDisc, { suffix: "%", step: 2 }),
    solutionSteps: [
      `Single equivalent discount = d₁ + d₂ - (d₁ × d₂) / 100`,
      `= ${d1} + ${d2} - (${d1} × ${d2} / 100) = ${eqDisc}%`,
    ],
  });
}

// 9. Profit After Discount
export function prelimsPL9ProfitAfterDiscount(exam, difficulty) {
  const cp = randInt(8, 30) * 100;
  const markupPct = 50;
  const discPct = 20;
  const mp = (cp * (100 + markupPct)) / 100;
  const sp = (mp * (100 - discPct)) / 100;
  const profit = sp - cp;
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_9_PROFIT_AFTER_DISCOUNT",
    questionText: `A dealer buys an article for Rs. ${cp}, marks it ${markupPct}% above the cost price, and offers a ${discPct}% discount on the marked price. What is the profit earned?`,
    optResult: buildPLOptions(profit, { prefix: "Rs. ", step: 40 }),
    solutionSteps: [
      `MP = 150% of ${cp} = Rs. ${mp}`,
      `SP = 80% of ${mp} = Rs. ${sp} ⇒ Profit = ${sp} - ${cp} = Rs. ${profit}`,
    ],
  });
}

// 10. Dishonest Shopkeeper (False Weight)
export function prelimsPL10DishonestShopkeeper(exam, difficulty) {
  const cleanWeights = [
    { used: 800, pct: 25 },
    { used: 750, pct: 33.33 }, // skip repeating -> keep exact terminating weights
  ];
  const exactWeights = [
    { used: 800, pct: 25, dec: 0 },
    { used: 500, pct: 100, dec: 0 },
    { used: 625, pct: 60, dec: 0 },
    { used: 800, pct: 25, dec: 0 },
    { used: 400, pct: 150, dec: 0 },
    { used: 640, pct: 56.25, dec: 2 },
  ];
  const w = pickRandom(exactWeights);
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_10_DISHONEST_WEIGHT",
    questionText: `A dishonest shopkeeper professes to sell goods at cost price, but uses a false weight of ${w.used} grams instead of 1 kg (1000 g). What is his actual profit percentage?`,
    optResult: buildPLOptions(w.pct, { suffix: "%", step: 5, decimals: w.dec }),
    solutionSteps: [
      `Error = 1000 - ${w.used} = ${1000 - w.used} g`,
      `Profit % = (${1000 - w.used} / ${w.used}) × 100 = ${w.pct}%`,
    ],
  });
}

// 11. Same Selling Price – Equal Profit and Loss (Always Loss = x²/100 %)
export function prelimsPL11SameSPEqualPL(exam, difficulty) {
  const x = pickRandom([10, 20, 30, 40]);
  const sp = randInt(12, 48) * 100;
  const lossPct = (x * x) / 100;
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_11_SAME_SP_EQUAL_PL",
    questionText: `A trader sells two articles for Rs. ${sp} each. On one he gains ${x}% and on the other he loses ${x}%. What is his overall loss percentage in the transaction?`,
    optResult: buildPLOptions(lossPct, { suffix: "%", step: 1 }),
    solutionSteps: [
      `When SP is the same and profit % = loss % = x%, there is always a net loss of (x² / 100)%`,
      `Loss % = (${x}² / 100)% = ${lossPct}%`,
    ],
  });
}

// 12. Overall Profit and Loss (Two articles with given CPs)
export function prelimsPL12OverallPL(exam, difficulty) {
  const cp1 = randInt(5, 15) * 100;
  const cp2 = randInt(5, 15) * 100;
  const p1 = pickRandom([20, 25, 30]);
  const l2 = pickRandom([10, 15]);
  const sp1 = (cp1 * (100 + p1)) / 100;
  const sp2 = (cp2 * (100 - l2)) / 100;
  const netProfit = sp1 + sp2 - (cp1 + cp2);
  const absNet = Math.abs(netProfit);
  const isGain = netProfit >= 0;
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_12_OVERALL_PL",
    questionText: `A merchant buys Item A for Rs. ${cp1} and sells it at a ${p1}% profit, and buys Item B for Rs. ${cp2} and sells it at a ${l2}% loss. What is the net ${isGain ? "profit" : "loss"} amount across both items?`,
    optResult: buildPLOptions(Math.max(10, absNet), { prefix: "Rs. ", step: 20 }),
    solutionSteps: [
      `Total CP = Rs. ${cp1 + cp2}; Total SP = ${sp1} + ${sp2} = Rs. ${sp1 + sp2}`,
      `Net ${isGain ? "Profit" : "Loss"} = Rs. ${absNet}`,
    ],
  });
}

// 13. Multiple Articles – Profit and Loss (Buy n for Rs X, sell m for Rs Y)
export function prelimsPL13MultipleArticles(exam, difficulty) {
  const cpEach = randInt(6, 15);
  const qty = pickRandom([10, 12, 15, 20]);
  const totalCP = cpEach * qty;
  const profitPct = pickRandom([20, 25, 50]);
  const totalSP = (totalCP * (100 + profitPct)) / 100;
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_13_MULTIPLE_ARTICLES",
    questionText: `A vendor buys ${qty} pens for Rs. ${totalCP} and sells all ${qty} pens for Rs. ${totalSP}. What is his profit percentage?`,
    optResult: buildPLOptions(profitPct, { suffix: "%", step: 5 }),
    solutionSteps: [
      `Total Profit = ${totalSP} - ${totalCP} = Rs. ${totalSP - totalCP}`,
      `Profit % = (${totalSP - totalCP} / ${totalCP}) × 100 = ${profitPct}%`,
    ],
  });
}

// 14. Required Selling Price for Desired Profit
export function prelimsPL14DesiredProfit(exam, difficulty) {
  const cp = randInt(8, 25) * 100;
  const lossPct = pickRandom([10, 15, 20]);
  const sp1 = (cp * (100 - lossPct)) / 100;
  const targetProfit = pickRandom([15, 20, 25, 30]);
  const sp2 = (cp * (100 + targetProfit)) / 100;
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_14_DESIRED_PROFIT",
    questionText: `By selling an article for Rs. ${sp1}, a trader incurs a loss of ${lossPct}%. At what price should he sell it to earn a profit of ${targetProfit}%?`,
    optResult: buildPLOptions(sp2, { prefix: "Rs. ", step: 50 }),
    solutionSteps: [
      `${100 - lossPct}% of CP = Rs. ${sp1} ⇒ CP = Rs. ${cp}`,
      `Required SP = ${100 + targetProfit}% of ${cp} = Rs. ${sp2}`,
    ],
  });
}

// 15. Finding Discount Percentage
export function prelimsPL15DiscountPct(exam, difficulty) {
  const discPct = pickRandom([10, 15, 20, 25, 30, 35]);
  const mp = randInt(5, 25) * 100;
  const sp = (mp * (100 - discPct)) / 100;
  return makePLQ({
    exam, difficulty, subType: "PRELIMS_PL_15_DISCOUNT_PCT",
    questionText: `An article marked at Rs. ${mp} is sold for Rs. ${sp}. What is the discount percentage offered?`,
    optResult: buildPLOptions(discPct, { suffix: "%", step: 3 }),
    solutionSteps: [
      `Discount = ${mp} - ${sp} = Rs. ${mp - sp}`,
      `Discount % = (${mp - sp} / ${mp}) × 100 = ${discPct}%`,
    ],
  });
}

export const PRELIMS_PL_MAP = {
  1: prelimsPL1Basic,
  2: prelimsPL2FindCP,
  3: prelimsPL3FindSP,
  4: prelimsPL4ProfitPct,
  5: prelimsPL5LossPct,
  6: prelimsPL6CPvsSP,
  7: prelimsPL7MPDiscount,
  8: prelimsPL8SuccessiveDiscounts,
  9: prelimsPL9ProfitAfterDiscount,
  10: prelimsPL10DishonestShopkeeper,
  11: prelimsPL11SameSPEqualPL,
  12: prelimsPL12OverallPL,
  13: prelimsPL13MultipleArticles,
  14: prelimsPL14DesiredProfit,
  15: prelimsPL15DiscountPct,
};