// Place at: server/question-engine/generators/quant/profitLoss/mainsProfitLossTypes.js
import { randInt, pickRandom } from "../../../core/mathUtils.js";
import { buildPLOptions } from "./prelimsProfitLossTypes.js";

function makeMainsPLQ({ exam, difficulty, subType, questionText, optResult, solutionSteps }) {
  return {
    questionId: `PL_M_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
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

// 1. Successive Profit and Loss (A -> B -> C)
export function mainsPL1SuccessiveChain(exam, difficulty) {
  const cpA = randInt(6, 25) * 1000;
  const p1 = pickRandom([10, 20, 25]);
  const l2 = pickRandom([10, 20]);
  const spA = (cpA * (100 + p1)) / 100;
  const spB = (spA * (100 - l2)) / 100;
  return makeMainsPLQ({
    exam, difficulty, subType: "MAINS_PL_1_SUCCESSIVE_CHAIN",
    questionText: `A sells an article to B at a profit of ${p1}%, and B sells it to C at a loss of ${l2}%. If A originally purchased the article for Rs. ${cpA}, how much did C pay for it?`,
    optResult: buildPLOptions(spB, { prefix: "Rs. ", step: 100 }),
    solutionSteps: [
      `B's CP = ${100 + p1}% of ${cpA} = Rs. ${spA}`,
      `C's CP = ${100 - l2}% of ${spA} = Rs. ${spB}`,
    ],
  });
}

// 2. Multiple Discounts and Markups
export function mainsPL2MultipleDiscountsMarkup(exam, difficulty) {
  const cp = randInt(5, 20) * 1000;
  const markupPct = pickRandom([40, 50, 60]);
  const d1 = 20, d2 = 10;
  const mp = (cp * (100 + markupPct)) / 100;
  const sp = (mp * (100 - d1) * (100 - d2)) / 10000;
  const profit = sp - cp;
  const isGain = profit >= 0;
  return makeMainsPLQ({
    exam, difficulty, subType: "MAINS_PL_2_MULTI_DISCOUNT_MARKUP",
    questionText: `A shopkeeper marks an article of cost price Rs. ${cp} by ${markupPct}% above CP and allows two successive discounts of ${d1}% and ${d2}%. Find the final selling price of the article.`,
    optResult: buildPLOptions(sp, { prefix: "Rs. ", step: 80 }),
    solutionSteps: [
      `MP = ${100 + markupPct}% of ${cp} = Rs. ${mp}`,
      `SP = ${mp} × 0.8 × 0.9 = Rs. ${sp} (Net ${isGain ? "profit" : "loss"} = Rs. ${Math.abs(profit)})`,
    ],
  });
}

// 3. Marked Price, Discount and Profit Combined (Find MP given CP, discount%, profit%)
export function mainsPL3MPDiscountProfitCombined(exam, difficulty) {
  const discPct = 20; // 80% of MP = (100 + p)% of CP
  const profitPct = pickRandom([20, 40, 60]);
  const cp = randInt(8, 25) * 100;
  const sp = (cp * (100 + profitPct)) / 100;
  const mp = (sp * 100) / (100 - discPct);
  return makeMainsPLQ({
    exam, difficulty, subType: "MAINS_PL_3_MP_DISC_PROFIT",
    questionText: `A merchant buys a gadget for Rs. ${cp}. At what marked price should he list it so that after allowing a discount of ${discPct}%, he still earns a profit of ${profitPct}%?`,
    optResult: buildPLOptions(mp, { prefix: "Rs. ", step: 50 }),
    solutionSteps: [
      `Required SP = ${100 + profitPct}% of ${cp} = Rs. ${sp}`,
      `${100 - discPct}% of MP = Rs. ${sp} ⇒ MP = (${sp} × 100) / ${100 - discPct} = Rs. ${mp}`,
    ],
  });
}

// 4. Dishonest Shopkeeper with False Weight + Markup Combined
export function mainsPL4DishonestCombined(exam, difficulty) {
  const markupPct = pickRandom([10, 20, 25]);
  const usedGrams = 800; // Gives 800g instead of 1000g => × 1.25 factor
  // Effective SP/CP = ((100 + markupPct)/100) * (1000/800)
  const netRatio = ((100 + markupPct) * 1000) / (100 * usedGrams);
  const netProfitPct = Math.round((netRatio - 1) * 10000) / 100;
  const dec = Number.isInteger(netProfitPct) ? 0 : 2;
  return makeMainsPLQ({
    exam, difficulty, subType: "MAINS_PL_4_DISHONEST_COMBINED",
    questionText: `A dishonest merchant marks up his goods by ${markupPct}% above cost price and also uses a weight of ${usedGrams} grams instead of 1 kg. What is his overall profit percentage?`,
    optResult: buildPLOptions(netProfitPct, { suffix: "%", step: 2.5, decimals: dec }),
    solutionSteps: [
      `Price factor = ${(100 + markupPct) / 100}; Weight factor = 1000 / ${usedGrams} = 1.25`,
      `Overall multiplier = ${netRatio} ⇒ Net Profit % = ${netProfitPct}%`,
    ],
  });
}

// 5. Profit and Loss on Multiple Articles (Part sold at profit, rest at loss)
export function mainsPL5MultipleArticlesSplit(exam, difficulty) {
  const totalCost = randInt(4, 12) * 1000;
  const part1 = totalCost * 0.4;
  const part2 = totalCost * 0.6;
  const p1 = pickRandom([20, 25, 30]);
  const p2 = pickRandom([10, 15, 20]);
  const profit1 = (part1 * p1) / 100;
  const profit2 = (part2 * p2) / 100;
  const totalProfit = profit1 + profit2;
  return makeMainsPLQ({
    exam, difficulty, subType: "MAINS_PL_5_MULTI_ARTICLES_SPLIT",
    questionText: `A wholesaler buys stock worth Rs. ${totalCost}. He sells 40% of the stock at a ${p1}% profit and the remaining 60% at a ${p2}% profit. What is his total profit in rupees?`,
    optResult: buildPLOptions(totalProfit, { prefix: "Rs. ", step: 40 }),
    solutionSteps: [
      `Profit on 40% stock (Rs. ${part1}) at ${p1}% = Rs. ${profit1}`,
      `Profit on 60% stock (Rs. ${part2}) at ${p2}% = Rs. ${profit2}`,
      `Total Profit = Rs. ${profit1} + Rs. ${profit2} = Rs. ${totalProfit}`,
    ],
  });
}

// 6. Different Selling Prices and Profit Percentages (Sold for Rs. D more)
export function mainsPL6DiffSPDiffProfit(exam, difficulty) {
  const cp = randInt(8, 30) * 100;
  const p1 = pickRandom([10, 12, 15]);
  const p2 = p1 + pickRandom([8, 10, 12]);
  const diffRs = (cp * (p2 - p1)) / 100;
  return makeMainsPLQ({
    exam, difficulty, subType: "MAINS_PL_6_DIFF_SP_PROFIT",
    questionText: `An article was sold at a profit of ${p1}%. Had it been sold for Rs. ${diffRs} more, the profit would have been ${p2}%. Find the cost price of the article.`,
    optResult: buildPLOptions(cp, { prefix: "Rs. ", step: 100 }),
    solutionSteps: [
      `Difference in profit % = ${p2}% - ${p1}% = ${p2 - p1}% of CP = Rs. ${diffRs}`,
      `CP = (${diffRs} × 100) / ${p2 - p1} = Rs. ${cp}`,
    ],
  });
}

// 7. Equal Selling Price – Different Profit/Loss (Find exact net loss/profit in Rs.)
export function mainsPL7EqualSPDiffPL(exam, difficulty) {
  // Choose CP1, CP2 such that SP1 = SP2 cleanly:
  // Item 1 at +25% (5/4), Item 2 at -20% (4/5) -> SP = 20k => CP1 = 16k, CP2 = 25k
  const k = randInt(2, 8) * 100;
  const sp = 20 * k;
  const cp1 = 16 * k; // +25% -> 20k
  const cp2 = 25 * k; // -20% -> 20k
  const netLoss = cp1 + cp2 - 2 * sp; // 41k - 40k = k
  return makeMainsPLQ({
    exam, difficulty, subType: "MAINS_PL_7_EQUAL_SP_DIFF_PL",
    questionText: `A dealer sells two laptops for Rs. ${sp} each. On the first he makes a profit of 25% and on the second he suffers a loss of 20%. What is his net loss in the entire transaction?`,
    optResult: buildPLOptions(netLoss, { prefix: "Rs. ", step: 50 }),
    solutionSteps: [
      `CP₁ = ${sp} / 1.25 = Rs. ${cp1}; CP₂ = ${sp} / 0.80 = Rs. ${cp2}`,
      `Total CP = Rs. ${cp1 + cp2}, Total SP = Rs. ${2 * sp} ⇒ Net Loss = Rs. ${netLoss}`,
    ],
  });
}

// 8. Equal Cost Price – Different Profit/Loss
export function mainsPL8EqualCPDiffPL(exam, difficulty) {
  const cp = randInt(10, 30) * 100;
  const p1 = pickRandom([24, 28, 32, 36]);
  const l2 = pickRandom([10, 12, 14, 16]);
  const overallPct = (p1 - l2) / 2;
  return makeMainsPLQ({
    exam, difficulty, subType: "MAINS_PL_8_EQUAL_CP_DIFF_PL",
    questionText: `A trader buys two articles at Rs. ${cp} each. He sells the first at a profit of ${p1}% and the second at a loss of ${l2}%. What is his overall profit percentage?`,
    optResult: buildPLOptions(overallPct, { suffix: "%", step: 1 }),
    solutionSteps: [
      `When CP is equal, overall % = (+${p1} - ${l2}) / 2 = ${overallPct}% profit`,
    ],
  });
}

// 9. Overall Profit and Loss with Multiple Transactions (3 items)
export function mainsPL9MultiTransactions(exam, difficulty) {
  const cp1 = randInt(4, 10) * 100;
  const cp2 = randInt(5, 12) * 100;
  const cp3 = randInt(6, 14) * 100;
  const sp1 = (cp1 * 120) / 100;
  const sp2 = (cp2 * 110) / 100;
  const sp3 = (cp3 * 90) / 100;
  const totalSP = sp1 + sp2 + sp3;
  return makeMainsPLQ({
    exam, difficulty, subType: "MAINS_PL_9_MULTI_TRANSACTIONS",
    questionText: `A retailer sells three items: Item 1 (CP Rs. ${cp1}) at 20% profit, Item 2 (CP Rs. ${cp2}) at 10% profit, and Item 3 (CP Rs. ${cp3}) at 10% loss. What is the combined selling price of all three items?`,
    optResult: buildPLOptions(totalSP, { prefix: "Rs. ", step: 50 }),
    solutionSteps: [
      `SP₁ = Rs. ${sp1}, SP₂ = Rs. ${sp2}, SP₃ = Rs. ${sp3}`,
      `Total SP = ${sp1} + ${sp2} + ${sp3} = Rs. ${totalSP}`,
    ],
  });
}

// 10. Finding Original Price After Multiple Changes (Reverse A -> B -> C)
export function mainsPL10ReverseMultiChange(exam, difficulty) {
  const cpA = randInt(5, 20) * 1000;
  const p1 = pickRandom([20, 25]);
  const p2 = pickRandom([10, 20]);
  const paidByC = (cpA * (100 + p1) * (100 + p2)) / 10000;
  return makeMainsPLQ({
    exam, difficulty, subType: "MAINS_PL_10_REVERSE_MULTI",
    questionText: `Manufacturer A sells a product to Wholesaler B at a ${p1}% profit, and B sells it to Retailer C at a ${p2}% profit. If C pays Rs. ${paidByC} for the product, what was A's original cost price?`,
    optResult: buildPLOptions(cpA, { prefix: "Rs. ", step: 250 }),
    solutionSteps: [
      `A's CP × ${(100 + p1) / 100} × ${(100 + p2) / 100} = Rs. ${paidByC}`,
      `A's CP = Rs. ${cpA}`,
    ],
  });
}

// 11. Profit and Loss-Based Ratio Problems (CP : MP ratio)
export function mainsPL11RatioPL(exam, difficulty) {
  const k = randInt(4, 12) * 50;
  const rCP = 4, rMP = 6; // CP = 4k, MP = 6k
  const cp = rCP * k, mp = rMP * k;
  const discPct = 20;
  const sp = (mp * (100 - discPct)) / 100; // 4.8k => +20% profit
  const profit = sp - cp;
  return makeMainsPLQ({
    exam, difficulty, subType: "MAINS_PL_11_RATIO_PL",
    questionText: `The ratio of the cost price to the marked price of an article is 2 : 3, and the marked price is Rs. ${mp}. If a discount of ${discPct}% is given on the marked price, what is the profit earned?`,
    optResult: buildPLOptions(profit, { prefix: "Rs. ", step: 20 }),
    solutionSteps: [
      `CP = (2/3) × ${mp} = Rs. ${cp}`,
      `SP = 80% of ${mp} = Rs. ${sp} ⇒ Profit = ${sp} - ${cp} = Rs. ${profit}`,
    ],
  });
}

// 12. Caselet-Based Profit and Loss Problems
export function mainsPL12Caselet(exam, difficulty) {
  const qtyA = randInt(10, 25), cpA = randInt(4, 10) * 50;
  const qtyB = randInt(10, 20), cpB = randInt(5, 12) * 50;
  const profitA = ((qtyA * cpA) * 20) / 100;
  const profitB = ((qtyB * cpB) * 10) / 100;
  const totalProfit = profitA + profitB;
  return makeMainsPLQ({
    exam, difficulty, subType: "MAINS_PL_12_CASELET",
    questionText: `A store purchased ${qtyA} jackets at Rs. ${cpA} each and ${qtyB} shirts at Rs. ${cpB} each. All jackets were sold at a 20% profit and all shirts were sold at a 10% profit. What was the store's total profit from selling all jackets and shirts?`,
    optResult: buildPLOptions(totalProfit, { prefix: "Rs. ", step: 50 }),
    solutionSteps: [
      `Profit on jackets = 20% of (${qtyA} × ${cpA}) = Rs. ${profitA}`,
      `Profit on shirts = 10% of (${qtyB} × ${cpB}) = Rs. ${profitB}`,
      `Total Profit = Rs. ${profitA} + Rs. ${profitB} = Rs. ${totalProfit}`,
    ],
  });
}

export const MAINS_PL_MAP = {
  1: mainsPL1SuccessiveChain,
  2: mainsPL2MultipleDiscountsMarkup,
  3: mainsPL3MPDiscountProfitCombined,
  4: mainsPL4DishonestCombined,
  5: mainsPL5MultipleArticlesSplit,
  6: mainsPL6DiffSPDiffProfit,
  7: mainsPL7EqualSPDiffPL,
  8: mainsPL8EqualCPDiffPL,
  9: mainsPL9MultiTransactions,
  10: mainsPL10ReverseMultiChange,
  11: mainsPL11RatioPL,
  12: mainsPL12Caselet,
};