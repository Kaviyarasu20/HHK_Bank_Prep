// Place at: server/question-engine/generators/quant/mixtureAlligation/mixtureTemplatesPart2.js
import { R, ZERO, HUNDRED } from "./mixtureMath.js";
import { assembleQuestion } from "./mixtureTemplatesPart1.js";

const COMMODITIES = ["tea", "rice", "coffee", "pulses", "sugar"];

// ============================================================================
// 10. Concentration and Percentage (Easy)
// ============================================================================
function genCat10_ConcentrationPct(rng, difficulty) {
  const configs = [
    [12, 38], // 24%
    [15, 35], // 30%
    [18, 42], // 30%
    [24, 56], // 30%
    [14, 36], // 28%
    [16, 24], // 40%
    [9, 36],  // 20%
    [21, 39], // 35%
  ];
  const [solute, water] = rng.pick(configs);
  const total = solute + water;
  const pct = R(solute * 100, total);
  const wrongWaterPct = HUNDRED.sub(pct);
  const wrongSoluteOverWater = R(solute * 100, water);

  return assembleQuestion({
    templateId: "MA_10_CONCENTRATION_PCT",
    question_type: "Concentration and Percentage",
    sub_type: "Direct Percentage Concentration",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `${solute} litres of pure alcohol are mixed with ${water} litres of pure water. What is the percentage concentration of alcohol in the resulting solution?`,
    mathModel: {
      kind: "CONCENTRATION_MIX",
      solutions: [
        { vol: R(solute), pct: HUNDRED },
        { vol: R(water), pct: ZERO },
      ],
    },
    exactRationalAnswer: pct,
    plausible: [wrongWaterPct, wrongSoluteOverWater, pct.add(R(5)), pct.sub(R(4))],
    unit: "%",
    maxVal: 100,
    solution: {
      given_data: [`Pure alcohol = ${solute} L`, `Pure water = ${water} L`],
      formula: "Concentration % = [Solute / (Solute + Solvent)] × 100",
      steps: [
        `Total solution volume = ${solute} + ${water} = ${total} litres`,
        `Alcohol concentration = (${solute} / ${total}) × 100 = ${pct.toExamString()}%`,
      ],
      final_answer: `${pct.toExamString()}%`,
    },
    shortcut_method: `Divide solute (${solute}) by total solution (${total}), not by water (${water}).`,
    rng,
  });
}

// ============================================================================
// 11. Dilution Problems (Medium)
// ============================================================================
function genCat11_Dilution(rng, difficulty) {
  const configs = [
    [40, 30, 20], // add 20 L
    [60, 40, 25], // add 36 L
    [50, 36, 30], // add 10 L
    [45, 40, 25], // add 27 L
    [80, 35, 20], // add 60 L
    [30, 50, 30], // add 20 L
    [60, 45, 30], // add 30 L
  ];
  const [initVol, initPct, targetPct] = rng.pick(configs);
  const solute = R(initVol * initPct, 100);
  const finalVol = solute.mul(HUNDRED).div(R(targetPct));
  const addedWater = finalVol.sub(R(initVol));

  return assembleQuestion({
    templateId: "MA_11_DILUTION",
    question_type: "Dilution Problems",
    sub_type: "Diluting Acid Solution with Water",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `How many litres of pure water must be added to ${initVol} litres of a ${initPct}% acid solution to dilute it to a ${targetPct}% acid solution?`,
    mathModel: {
      kind: "DILUTION",
      initVol: R(initVol),
      initPct: R(initPct),
      targetPct: R(targetPct),
    },
    exactRationalAnswer: addedWater,
    plausible: [finalVol, addedWater.add(R(5)), addedWater.sub(R(4)), solute],
    unit: "litres",
    solution: {
      given_data: [`Initial volume = ${initVol} L`, `Initial acid = ${initPct}%`, `Target acid = ${targetPct}%`],
      formula: "Solute remains constant: V₁ × C₁ = V₂ × C₂; Water added = V₂ − V₁",
      steps: [
        `Pure acid = ${initPct}% of ${initVol} = ${solute.toExamString()} litres`,
        `Final volume V₂ = (${solute.toExamString()} × 100) / ${targetPct} = ${finalVol.toExamString()} litres`,
        `Water added = ${finalVol.toExamString()} − ${initVol} = ${addedWater.toExamString()} litres`,
      ],
      final_answer: `${addedWater.toExamString()} litres`,
    },
    shortcut_method: `Water added = V₁ × (C₁ − C₂) / C₂ = ${initVol} × (${initPct - targetPct}) / ${targetPct} = ${addedWater.toExamString()} L.`,
    rng,
  });
}

// ============================================================================
// 12. Three-Ingredient Mixture (Medium)
// ============================================================================
function genCat12_ThreeIngredient(rng, difficulty) {
  const configs = [
    [2, 40, 3, 50, 5, 62], // (80+150+310)/10 = 54
    [1, 36, 2, 48, 3, 60], // (36+96+180)/6 = 52
    [2, 45, 3, 55, 5, 71], // (90+165+355)/10 = 61
    [3, 30, 2, 45, 5, 60], // (90+90+300)/10 = 48
    [2, 50, 5, 64, 3, 80], // (100+320+240)/10 = 66
    [1, 42, 3, 54, 4, 66], // (42+162+264)/8 = 58.5
  ];
  const [r1, p1, r2, p2, r3, p3] = rng.pick(configs);
  const mean = R(r1 * p1 + r2 * p2 + r3 * p3, r1 + r2 + r3);
  const wrongArith = R(p1 + p2 + p3, 3);
  const item = rng.pick(COMMODITIES);

  return assembleQuestion({
    templateId: "MA_12_THREE_INGREDIENT",
    question_type: "Three-Ingredient Mixture",
    sub_type: "Three-Variety Weighted Mean Price",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `Three varieties of ${item} costing Rs. ${p1}/kg, Rs. ${p2}/kg, and Rs. ${p3}/kg are mixed in the ratio ${r1} : ${r2} : ${r3}. What is the average cost price per kg of the resulting three-variety mixture?`,
    mathModel: {
      kind: "WEIGHTED_MEAN",
      items: [
        { qty: R(r1), price: R(p1) },
        { qty: R(r2), price: R(p2) },
        { qty: R(r3), price: R(p3) },
      ],
    },
    exactRationalAnswer: mean,
    plausible: [wrongArith, mean.add(R(2)), mean.sub(R(2)), mean.add(R(4))],
    prefix: "Rs. ",
    unit: "/kg",
    solution: {
      given_data: [`Prices: Rs. ${p1}, Rs. ${p2}, Rs. ${p3} per kg`, `Mixing ratio = ${r1} : ${r2} : ${r3}`],
      formula: "Weighted Mean = (r₁P₁ + r₂P₂ + r₃P₃) / (r₁ + r₂ + r₃)",
      steps: [
        `Weighted cost sum = (${r1}×${p1}) + (${r2}×${p2}) + (${r3}×${p3}) = ${r1 * p1 + r2 * p2 + r3 * p3}`,
        `Sum of ratio parts = ${r1} + ${r2} + ${r3} = ${r1 + r2 + r3}`,
        `Mean Price = ${r1 * p1 + r2 * p2 + r3 * p3} / ${r1 + r2 + r3} = Rs. ${mean.toExamString()}/kg`,
      ],
      final_answer: `Rs. ${mean.toExamString()}/kg`,
    },
    shortcut_method: `Sum (ratio × price) = ${r1 * p1 + r2 * p2 + r3 * p3} and divide by total parts (${r1 + r2 + r3}).`,
    rng,
  });
}

// ============================================================================
// 13. Mixing Different Solutions (Medium)
// ============================================================================
function genCat13_MixingSolutions(rng, difficulty) {
  const configs = [
    [20, 30, 30, 50], // (6+15)/50 = 42%
    [15, 20, 25, 60], // (3+15)/40 = 45%
    [30, 25, 20, 50], // (7.5+10)/50 = 35%
    [40, 15, 60, 40], // (6+24)/100 = 30%
    [25, 32, 75, 48], // (8+36)/100 = 44%
    [12, 25, 18, 50], // (3+9)/30 = 40%
  ];
  const [v1, c1, v2, c2] = rng.pick(configs);
  const finalPct = R(v1 * c1 + v2 * c2, v1 + v2);
  const wrongMean = R(c1 + c2, 2);
  const wrongRev = R(v2 * c1 + v1 * c2, v1 + v2);

  return assembleQuestion({
    templateId: "MA_13_MIX_SOLUTIONS",
    question_type: "Mixing Different Solutions",
    sub_type: "Combining Two Different Concentration Solutions",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains"],
    question: `Vessel A contains ${v1} litres of a ${c1}% sugar solution, and Vessel B contains ${v2} litres of a ${c2}% sugar solution. If the contents of both vessels are mixed together, what is the sugar concentration of the resulting solution?`,
    mathModel: {
      kind: "CONCENTRATION_MIX",
      solutions: [
        { vol: R(v1), pct: R(c1) },
        { vol: R(v2), pct: R(c2) },
      ],
    },
    exactRationalAnswer: finalPct,
    plausible: [wrongMean, wrongRev, finalPct.add(R(3)), finalPct.sub(R(2))],
    unit: "%",
    maxVal: 100,
    solution: {
      given_data: [`Vessel A: ${v1} L at ${c1}%`, `Vessel B: ${v2} L at ${c2}%`],
      formula: "Resulting % = (V₁C₁ + V₂C₂) / (V₁ + V₂)",
      steps: [
        `Sugar in A = ${R(v1 * c1, 100).toExamString()} L; Sugar in B = ${R(v2 * c2, 100).toExamString()} L`,
        `Total sugar = ${R(v1 * c1 + v2 * c2, 100).toExamString()} L in ${v1 + v2} L total solution`,
        `Concentration = (${v1 * c1 + v2 * c2}) / ${v1 + v2} = ${finalPct.toExamString()}%`,
      ],
      final_answer: `${finalPct.toExamString()}%`,
    },
    shortcut_method: `Never average ${c1}% and ${c2}% equally when volumes differ; compute (${v1}×${c1} + ${v2}×${c2}) / ${v1 + v2}.`,
    rng,
  });
}

// ============================================================================
// 14. Missing Price or Concentration (Medium)
// ============================================================================
function genCat14_MissingPrice(rng, difficulty) {
  const configs = [
    [20, 45, 30, 57, 65], // (900 + 1950)/50 = 57
    [15, 40, 25, 55, 64], // (600 + 1600)/40 = 55
    [12, 36, 18, 48, 56], // (432 + 1008)/30 = 48
    [25, 52, 15, 61, 76], // (1300 + 1140)/40 = 61
    [10, 48, 15, 60, 68], // (480 + 1020)/25 = 60
  ];
  const [q1, p1, q2, mean, p2] = rng.pick(configs);
  const item = rng.pick(COMMODITIES);

  return assembleQuestion({
    templateId: "MA_14_MISSING_PRICE",
    question_type: "Missing Price or Concentration",
    sub_type: "Find Unknown Ingredient Price",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS RRB PO"],
    question: `${q1} kg of ${item} costing Rs. ${p1} per kg is mixed with ${q2} kg of a second variety of ${item} so that the mean cost price of the mixture is Rs. ${mean} per kg. What is the cost price per kg of the second variety?`,
    mathModel: { kind: "MISSING_PRICE", q1: R(q1), p1: R(p1), q2: R(q2), mean: R(mean) },
    exactRationalAnswer: R(p2),
    plausible: [R(2 * mean - p1), R(p2 + 4), R(p2 - 4), R(p2 + 6)],
    prefix: "Rs. ",
    unit: "/kg",
    solution: {
      given_data: [`Q₁ = ${q1} kg at Rs. ${p1}/kg`, `Q₂ = ${q2} kg`, `Mean = Rs. ${mean}/kg`],
      formula: "P₂ = [Mean × (Q₁ + Q₂) − Q₁ × P₁] / Q₂",
      steps: [
        `Total mixture value = ${q1 + q2} × ${mean} = Rs. ${(q1 + q2) * mean}`,
        `Cost of first variety = ${q1} × ${p1} = Rs. ${q1 * p1}`,
        `Cost of ${q2} kg of second variety = Rs. ${(q1 + q2) * mean - q1 * p1} ⇒ Price = Rs. ${p2}/kg`,
      ],
      final_answer: `Rs. ${p2}/kg`,
    },
    shortcut_method: `By alligation, ${q1} kg loses Rs. ${mean - p1}/kg each, so ${q2} kg must gain (${q1}×${mean - p1})/${q2} = Rs. ${p2 - mean}/kg above ${mean}.`,
    rng,
  });
}

// ============================================================================
// 15. Ratio Change Problems (Find Initial Milk — Hard)
// ============================================================================
function genCat15_RatioChange(rng, difficulty) {
  const configs = [
    [4, 1, 4, 3, 16, 32], // 32M, 8W + 16W => 32:24 = 4:3
    [5, 2, 5, 4, 14, 35], // 35M, 14W + 14W => 35:28 = 5:4
    [3, 1, 3, 2, 15, 45], // 45M, 15W + 15W => 45:30 = 3:2
    [7, 2, 7, 5, 18, 42], // 42M, 12W + 18W => 42:30 = 7:5
    [5, 3, 1, 1, 16, 40], // 40M, 24W + 16W => 40:40 = 1:1
    [3, 2, 6, 7, 15, 30], // 30M, 20W + 15W => 30:35 = 6:7
  ];
  const [m1, w1, m2, w2, addedWater, initMilk] = rng.pick(configs);
  const initWater = (initMilk * w1) / m1;

  return assembleQuestion({
    templateId: "MA_15_RATIO_CHANGE",
    question_type: "Ratio Change Problems",
    sub_type: "Find Initial Quantity from Ratio Shift",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains", "SBI PO Mains"],
    question: `A vessel contains a mixture of milk and water in the ratio ${m1} : ${w1}. When ${addedWater} litres of pure water are added to the vessel, the ratio of milk to water becomes ${m2} : ${w2}. What was the initial quantity of milk in the vessel?`,
    mathModel: {
      kind: "RATIO_CHANGE_INITIAL",
      m1: R(m1),
      w1: R(w1),
      m2: R(m2),
      w2: R(w2),
      addedWater: R(addedWater),
      ask: "INITIAL_MILK",
    },
    exactRationalAnswer: R(initMilk),
    plausible: [R(initWater), R(initMilk + initWater), R(initMilk + 5), R(initMilk - 4)],
    unit: "litres",
    solution: {
      given_data: [`Initial ratio = ${m1}:${w1}`, `Water added = ${addedWater} L`, `New ratio = ${m2}:${w2}`],
      formula: "Milk remains unchanged: M / (M×w₁/m₁ + addedWater) = m₂ / w₂",
      steps: [
        `Express both ratios with equal milk parts to compare water parts directly`,
        `Solving for M: M × (${w2}/${m2} − ${w1}/${m1}) = ${addedWater}`,
        `Initial quantity of milk M = ${initMilk} litres`,
      ],
      final_answer: `${initMilk} litres`,
    },
    shortcut_method: `Match the milk part in both ratios; the increase in water parts corresponds directly to ${addedWater} L.`,
    rng,
  });
}

// ============================================================================
// 16. Mixture and Profit Combined (Hard)
// ============================================================================
function genCat16_MixtureProfitCombined(rng, difficulty) {
  const configs = [
    [40, 60, 48, 25, 60], // CP=48, +25% => SP=60; ratio 12:8 = 3:2
    [50, 75, 60, 20, 72], // CP=60, +20% => SP=72; ratio 15:10 = 3:2
    [32, 48, 40, 10, 44], // CP=40, +10% => SP=44; ratio 8:8 -> skip equal!
    [30, 50, 42, 20, 50.4], // avoid decimal SP -> keep clean integer SPs:
    [36, 56, 44, 25, 55], // CP=44, +25% => SP=55; ratio 12:8 = 3:2
    [45, 70, 55, 20, 66], // CP=55, +20% => SP=66; ratio 15:10 = 3:2
    [60, 90, 70, 10, 77], // CP=70, +10% => SP=77; ratio 20:10 = 2:1
    [42, 62, 50, 20, 60], // CP=50, +20% => SP=60; ratio 12:8 = 3:2
  ].filter(([c, d, m, p, sp]) => Number.isInteger(sp) && d - m !== m - c);

  const [c, d, m, profitPct, sp] = rng.pick(configs);
  const ratio = R(d - m, m - c);
  const correctStr = `${ratio.num} : ${ratio.den}`;
  const revStr = `${ratio.den} : ${ratio.num}`;
  const item = rng.pick(COMMODITIES);

  return assembleQuestion({
    templateId: "MA_16_MIXTURE_PROFIT",
    question_type: "Mixture and Profit Combined",
    sub_type: "Alligation with Selling Price and Profit %",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains", "SBI PO Mains"],
    question: `In what ratio must a shopkeeper mix two varieties of ${item} costing Rs. ${c}/kg and Rs. ${d}/kg so that by selling the mixture at Rs. ${sp}/kg, he earns a profit of ${profitPct}%?`,
    mathModel: {
      kind: "MIXTURE_PROFIT_RATIO",
      cheaper: R(c),
      dearer: R(d),
      sp: R(sp),
      profitPct: R(profitPct),
    },
    ratioAnswer: correctStr,
    ratioFormat: {
      correct: correctStr,
      p: Number(ratio.num),
      q: Number(ratio.den),
      distractors: [
        revStr,
        `${Number(ratio.num) + 1} : ${Number(ratio.den)}`,
        `${Number(ratio.num)} : ${Number(ratio.den) + 1}`,
        `${Number(ratio.num) + 2} : ${Number(ratio.den) + 1}`,
      ],
    },
    solution: {
      given_data: [`Cheaper CP = Rs. ${c}/kg`, `Dearer CP = Rs. ${d}/kg`, `SP = Rs. ${sp}/kg`, `Profit = ${profitPct}%`],
      formula: "Mean CP = (SP × 100) / (100 + Profit %); then apply Alligation on CPs",
      steps: [
        `Mean CP of mixture = (${sp} × 100) / (100 + ${profitPct}) = Rs. ${m}/kg`,
        `By Alligation: Cheaper : Dearer = (${d} − ${m}) : (${m} − ${c}) = ${d - m} : ${m - c}`,
        `Simplified ratio = ${correctStr}`,
      ],
      final_answer: correctStr,
    },
    shortcut_method: `Always convert SP (Rs. ${sp}) to Mean CP (Rs. ${m}) before applying alligation — never mix SP with CPs.`,
    rng,
  });
}

// ============================================================================
// 17. Adulteration Problems (Medium)
// ============================================================================
function genCat17_Adulteration(rng, difficulty) {
  const configs = [
    [40, 60, 60, 25, 10], // Cost 2400, +25% = 3000 @ 60/L => 50 L => 10 L water
    [50, 48, 48, 20, 10], // Cost 2400, +20% = 2880 @ 48/L => 60 L => 10 L water
    [60, 50, 45, 20, 20], // Cost 3000, +20% = 3600 @ 45/L => 80 L => 20 L water
    [45, 60, 54, 20, 15], // Cost 2700, +20% = 3240 @ 54/L => 60 L => 15 L water
    [80, 50, 50, 15, 12], // Cost 4000, +15% = 4600 @ 50/L => 92 L => 12 L water
    [32, 50, 50, 25, 8],  // Cost 1600, +25% = 2000 @ 50/L => 40 L => 8 L water
  ];
  const [milkQty, milkCost, sp, profitPct, waterAdded] = rng.pick(configs);

  return assembleQuestion({
    templateId: "MA_17_ADULTERATION",
    question_type: "Adulteration Problems",
    sub_type: "Free Water Addition for Target Profit",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `A dairy vendor buys ${milkQty} litres of pure milk at Rs. ${milkCost} per litre. How many litres of free water must he add to the milk so that by selling the resulting mixture at Rs. ${sp} per litre, he earns an overall profit of ${profitPct}%?`,
    mathModel: {
      kind: "ADULTERATION",
      milkQty: R(milkQty),
      milkCostPerL: R(milkCost),
      spPerL: R(sp),
      profitPct: R(profitPct),
    },
    exactRationalAnswer: R(waterAdded),
    plausible: [R(milkQty + waterAdded), R(waterAdded + 4), R(Math.max(1, waterAdded - 3)), R(Math.round((milkQty * profitPct) / 100) + 2)],
    unit: "litres",
    solution: {
      given_data: [`Pure milk = ${milkQty} L at Rs. ${milkCost}/L`, `SP = Rs. ${sp}/L`, `Target Profit = ${profitPct}%`],
      formula: "Total Revenue = Total Cost × (1 + Profit%/100); Total Volume = Revenue / SP",
      steps: [
        `Total Cost = ${milkQty} × ${milkCost} = Rs. ${milkQty * milkCost}`,
        `Required Revenue = ${milkQty * milkCost} × ${(100 + profitPct) / 100} = Rs. ${(milkQty * milkCost * (100 + profitPct)) / 100}`,
        `Required Total Volume = ${(milkQty * milkCost * (100 + profitPct)) / 100} / ${sp} = ${milkQty + waterAdded} L ⇒ Water added = ${waterAdded} litres`,
      ],
      final_answer: `${waterAdded} litres`,
    },
    shortcut_method: `Find total required revenue (Rs. ${(milkQty * milkCost * (100 + profitPct)) / 100}), divide by SP (${sp}) to get total volume, and subtract ${milkQty} L.`,
    rng,
  });
}

// ============================================================================
// 18. Multiple Operations on Mixtures (Hard)
// ============================================================================
function genCat18_MultiOperations(rng, difficulty) {
  const configs = [
    // [initMilk, initWater, rem1, addWater1, rem2, addMilk2]
    [40, 10, 10, 10, 10, 10], // 50L -> rem10(8M,2W)+10W => 32M,18W -> rem10(6.4M,3.6W)+10M => 35.6M
    [60, 20, 16, 16, 20, 12], // 80L -> rem16(12M,4W)+16W => 48M,32W -> rem20(12M,8W)+12M => 48M
    [45, 15, 12, 12, 15, 9],  // 60L -> rem12(9M,3W)+12W => 36M,24W -> rem15(9M,6W)+9M => 36M
    [50, 30, 16, 16, 10, 5],  // 80L -> rem16(10M,6W)+16W => 40M,40W -> rem10(5M,5W)+5M => 40M
    [72, 18, 18, 8, 20, 10],  // 90L -> rem18(14.4M,3.6W)+8W => 57.6M,22.4W (80L) -> rem20(14.4M)+10M => 53.2M
  ];
  const [m0, w0, rem1, addW1, rem2, addM2] = rng.pick(configs);
  const total0 = m0 + w0;
  const ratioInit = R(m0, w0);

  // Step 1
  const m1 = R(m0).mul(R(total0 - rem1, total0));
  const w1 = R(w0).mul(R(total0 - rem1, total0)).add(R(addW1));
  const total1 = m1.add(w1);

  // Step 2
  const m2 = m1.mul(total1.sub(R(rem2)).div(total1)).add(R(addM2));

  return assembleQuestion({
    templateId: "MA_18_MULTI_OPERATIONS",
    question_type: "Multiple Operations on Mixtures",
    sub_type: "Two-Stage Heterogeneous Removal and Replacement",
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains", "SBI PO Prelims"],
    question: `A tank contains ${total0} litres of a thoroughly mixed solution of milk and water in the ratio ${ratioInit.num} : ${ratioInit.den}. First, ${rem1} litres of the mixture are drawn out and ${addW1} litres of pure water are added. Next, ${rem2} litres of the resulting mixture are drawn out and ${addM2} litres of pure milk are added. What is the final quantity of milk in the tank?`,
    mathModel: {
      kind: "SEQUENTIAL_OPERATIONS",
      initMilk: R(m0),
      initWater: R(w0),
      operations: [
        { removeQty: R(rem1), addMilk: ZERO, addWater: R(addW1) },
        { removeQty: R(rem2), addMilk: R(addM2), addWater: ZERO },
      ],
      ask: "FINAL_MILK",
    },
    exactRationalAnswer: m2,
    plausible: [m1, m2.add(R(4)), m2.sub(R(3)), R(m0 - rem1 + addM2)],
    unit: "litres",
    solution: {
      given_data: [
        `Initial: ${total0} L (${m0} L milk, ${w0} L water)`,
        `Stage 1: remove ${rem1} L, add ${addW1} L water`,
        `Stage 2: remove ${rem2} L, add ${addM2} L milk`,
      ],
      formula: "Track milk and total volume sequentially after every removal and addition",
      steps: [
        `After Stage 1: Milk = ${m0} × (${total0 - rem1}/${total0}) = ${m1.toExamString()} L; New total volume = ${total1.toExamString()} L`,
        `After Stage 2 removal: Milk = ${m1.toExamString()} × (${total1.sub(R(rem2)).toExamString()}/${total1.toExamString()}) = ${m2.sub(R(addM2)).toExamString()} L`,
        `After adding ${addM2} L pure milk: Final Milk = ${m2.sub(R(addM2)).toExamString()} + ${addM2} = ${m2.toExamString()} litres`,
      ],
      final_answer: `${m2.toExamString()} litres`,
    },
    shortcut_method: `Track only milk & total volume across stages: ${m0} → ${m1.toExamString()} → ${m2.sub(R(addM2)).toExamString()} + ${addM2} = ${m2.toExamString()} L.`,
    rng,
  });
}

export const MIXTURE_TEMPLATES_PART_2 = [
  { id: "MA_10", category: 10, difficulties: ["Easy"], fn: genCat10_ConcentrationPct },
  { id: "MA_11", category: 11, difficulties: ["Medium"], fn: genCat11_Dilution },
  { id: "MA_12", category: 12, difficulties: ["Medium"], fn: genCat12_ThreeIngredient },
  { id: "MA_13", category: 13, difficulties: ["Medium"], fn: genCat13_MixingSolutions },
  { id: "MA_14", category: 14, difficulties: ["Medium"], fn: genCat14_MissingPrice },
  { id: "MA_15", category: 15, difficulties: ["Hard"], fn: genCat15_RatioChange },
  { id: "MA_16", category: 16, difficulties: ["Hard"], fn: genCat16_MixtureProfitCombined },
  { id: "MA_17", category: 17, difficulties: ["Medium", "Hard"], fn: genCat17_Adulteration },
  { id: "MA_18", category: 18, difficulties: ["Hard"], fn: genCat18_MultiOperations },
];