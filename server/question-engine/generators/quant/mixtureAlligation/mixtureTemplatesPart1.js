// Place at: server/question-engine/generators/quant/mixtureAlligation/mixtureTemplatesPart1.js
import { R, ZERO, buildMixtureOptions } from "./mixtureMath.js";

const COMMODITIES = ["rice", "wheat", "tea", "sugar", "pulses", "coffee beans"];

export function assembleQuestion({
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
  prefix = "",
  unit = "",
  maxVal = null,
  solution,
  shortcut_method = "",
  rng,
}) {
  const built = buildMixtureOptions(exactRationalAnswer, plausible, {
    prefix,
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
    prefix,
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
// 1. Basic Mixture and Mean Price (Easy)
// ============================================================================
function genCat01_BasicMeanPrice(rng, difficulty) {
  const configs = [
    [20, 40, 30, 50], // mean = 46
    [15, 36, 25, 52], // mean = 46
    [12, 45, 18, 60], // mean = 54
    [10, 54, 15, 64], // mean = 60
    [24, 30, 16, 45], // mean = 36
    [18, 42, 12, 57], // mean = 48
    [14, 50, 21, 65], // mean = 59
  ];
  const [q1, p1, q2, p2] = rng.pick(configs);
  const mean = R(q1 * p1 + q2 * p2, q1 + q2);
  const wrongArith = R(p1 + p2, 2);
  const wrongRev = R(q2 * p1 + q1 * p2, q1 + q2);
  const item = rng.pick(COMMODITIES);

  return assembleQuestion({
    templateId: "MA_01_BASIC_MEAN_PRICE",
    question_type: "Basic Mixture and Mean Price",
    sub_type: "Weighted Mean Cost Price",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `A grocer mixes ${q1} kg of ${item} costing Rs. ${p1} per kg with ${q2} kg of another variety of ${item} costing Rs. ${p2} per kg. What is the mean cost price per kg of the resulting mixture?`,
    mathModel: {
      kind: "WEIGHTED_MEAN",
      items: [
        { qty: R(q1), price: R(p1) },
        { qty: R(q2), price: R(p2) },
      ],
    },
    exactRationalAnswer: mean,
    plausible: [wrongArith, wrongRev, mean.add(R(2)), mean.sub(R(2))],
    prefix: "Rs. ",
    unit: "/kg",
    solution: {
      given_data: [`Variety 1: ${q1} kg at Rs. ${p1}/kg`, `Variety 2: ${q2} kg at Rs. ${p2}/kg`],
      formula: "Mean Price = (Q₁×P₁ + Q₂×P₂) / (Q₁ + Q₂)",
      steps: [
        `Total cost = (${q1} × ${p1}) + (${q2} × ${p2}) = ${q1 * p1} + ${q2 * p2} = Rs. ${q1 * p1 + q2 * p2}`,
        `Total quantity = ${q1} + ${q2} = ${q1 + q2} kg`,
        `Mean Price = ${q1 * p1 + q2 * p2} / ${q1 + q2} = Rs. ${mean.toExamString()}/kg`,
      ],
      final_answer: `Rs. ${mean.toExamString()}/kg`,
    },
    shortcut_method: `Use quantity ratio ${q1}:${q2} to weight the price gap (${p2 - p1}): ${p1} + (${q2}/${q1 + q2})×${p2 - p1} = Rs. ${mean.toExamString()}/kg.`,
    rng,
  });
}

// ============================================================================
// 2. Alligation Rule (Easy)
// ============================================================================
function genCat02_AlligationRule(rng, difficulty) {
  const configs = [
    [42, 54, 46], // 8:4 = 2:1
    [36, 52, 42], // 10:6 = 5:3
    [48, 68, 56], // 12:8 = 3:2
    [60, 85, 70], // 15:10 = 3:2
    [30, 48, 42], // 6:12 = 1:2
    [55, 75, 63], // 12:8 = 3:2
    [40, 65, 50], // 15:10 = 3:2
  ];
  const [c, d, m] = rng.pick(configs);
  const ratio = R(d - m, m - c);
  const correctStr = `${ratio.num} : ${ratio.den}`;
  const revStr = `${ratio.den} : ${ratio.num}`;
  const priceRatio = R(c, d);
  const item = rng.pick(COMMODITIES);

  return assembleQuestion({
    templateId: "MA_02_ALLIGATION_RULE",
    question_type: "Alligation Rule",
    sub_type: "Two-Ingredient Alligation Ratio",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims", "IBPS PO Prelims"],
    question: `In what ratio must a trader mix two varieties of ${item} costing Rs. ${c} per kg and Rs. ${d} per kg respectively so that the mixture is worth Rs. ${m} per kg?`,
    mathModel: { kind: "ALLIGATION_RATIO", cheaper: R(c), dearer: R(d), mean: R(m), isConcentration: false },
    ratioAnswer: correctStr,
    ratioFormat: {
      correct: correctStr,
      p: Number(ratio.num),
      q: Number(ratio.den),
      distractors: [
        revStr,
        `${priceRatio.num} : ${priceRatio.den}`,
        `${Number(ratio.num) + 1} : ${Number(ratio.den)}`,
        `${Number(ratio.num)} : ${Number(ratio.den) + 1}`,
      ],
    },
    solution: {
      given_data: [`Cheaper price (C) = Rs. ${c}/kg`, `Dearer price (D) = Rs. ${d}/kg`, `Mean price (M) = Rs. ${m}/kg`],
      formula: "Cheaper : Dearer = (D − M) : (M − C)",
      steps: [
        `D − M = ${d} − ${m} = ${d - m}`,
        `M − C = ${m} − ${c} = ${m - c}`,
        `Required ratio = ${d - m} : ${m - c} = ${correctStr}`,
      ],
      final_answer: correctStr,
    },
    shortcut_method: `Cross-subtract around the mean (${m}): (${d}−${m}) : (${m}−${c}) = ${correctStr}.`,
    rng,
  });
}

// ============================================================================
// 3. Find Ingredient Ratio (Concentration Alligation — Easy)
// ============================================================================
function genCat03_FindIngredientRatio(rng, difficulty) {
  const configs = [
    [20, 50, 32], // 18:12 = 3:2
    [15, 40, 25], // 15:10 = 3:2
    [25, 65, 45], // 20:20 = skip equal -> pick unequal:
    [30, 70, 42], // 28:12 = 7:3
    [18, 42, 34], // 8:16 = 1:2
    [24, 54, 36], // 18:12 = 3:2
    [10, 35, 20], // 15:10 = 3:2
  ].filter(([c, d, m]) => d - m !== m - c);

  const [c1, c2, m] = rng.pick(configs);
  const ratio = R(c2 - m, m - c1);
  const correctStr = `${ratio.num} : ${ratio.den}`;
  const revStr = `${ratio.den} : ${ratio.num}`;
  const rawRatio = R(c1, c2);

  return assembleQuestion({
    templateId: "MA_03_INGREDIENT_RATIO",
    question_type: "Find Ingredient Ratio",
    sub_type: "Solution Concentration Mixing Ratio",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `In what ratio must a ${c1}% acid solution be mixed with a ${c2}% acid solution to obtain a resulting solution of ${m}% acid concentration?`,
    mathModel: { kind: "ALLIGATION_RATIO", cheaper: R(c1), dearer: R(c2), mean: R(m), isConcentration: true },
    ratioAnswer: correctStr,
    ratioFormat: {
      correct: correctStr,
      p: Number(ratio.num),
      q: Number(ratio.den),
      distractors: [
        revStr,
        `${rawRatio.num} : ${rawRatio.den}`,
        `${Number(ratio.num) + 1} : ${Number(ratio.den)}`,
        `${Number(ratio.num)} : ${Number(ratio.den) + 2}`,
      ],
    },
    solution: {
      given_data: [`Solution A = ${c1}%`, `Solution B = ${c2}%`, `Target Mean = ${m}%`],
      formula: "Ratio (A : B) = (C₂ − M) : (M − C₁)",
      steps: [
        `C₂ − M = ${c2} − ${m} = ${c2 - m}`,
        `M − C₁ = ${m} − ${c1} = ${m - c1}`,
        `Required ratio = ${c2 - m} : ${m - c1} = ${correctStr}`,
      ],
      final_answer: correctStr,
    },
    shortcut_method: `By alligation, (${c2}−${m}) : (${m}−${c1}) = ${correctStr}.`,
    rng,
  });
}

// ============================================================================
// 4. Find Individual Ingredient Quantity (Easy)
// ============================================================================
function genCat04_IndividualQuantity(rng, difficulty) {
  const configs = [
    [40, 60, 48, 50], // ratio 12:8 = 3:2 -> 30 kg & 20 kg
    [30, 50, 38, 60], // ratio 12:8 = 3:2 -> 36 kg & 24 kg
    [45, 70, 55, 75], // ratio 15:10 = 3:2 -> 45 kg & 30 kg
    [50, 80, 60, 90], // ratio 20:10 = 2:1 -> 60 kg & 30 kg
    [32, 48, 42, 80], // ratio 6:10 = 3:5 -> 30 kg & 50 kg
    [60, 90, 72, 100], // ratio 18:12 = 3:2 -> 60 kg & 40 kg
  ];
  const [c, d, m, total] = rng.pick(configs);
  const askCheaper = rng.random() < 0.5;
  const qCheaper = R(total * (d - m), d - c);
  const qDearer = R(total).sub(qCheaper);
  const ans = askCheaper ? qCheaper : qDearer;
  const other = askCheaper ? qDearer : qCheaper;
  const item = rng.pick(COMMODITIES);

  return assembleQuestion({
    templateId: "MA_04_INDIVIDUAL_QTY",
    question_type: "Find Individual Ingredient Quantity",
    sub_type: askCheaper ? "Cheaper Ingredient Quantity" : "Dearer Ingredient Quantity",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `A merchant prepares ${total} kg of a blend of ${item} worth Rs. ${m}/kg by mixing a cheaper variety costing Rs. ${c}/kg with a dearer variety costing Rs. ${d}/kg. How many kilograms of the ${askCheaper ? "cheaper" : "dearer"} variety were used?`,
    mathModel: {
      kind: "ALLIGATION_QUANTITY",
      cheaper: R(c),
      dearer: R(d),
      mean: R(m),
      totalQty: R(total),
      target: askCheaper ? "CHEAPER" : "DEARER",
    },
    exactRationalAnswer: ans,
    plausible: [other, R(total, 2), ans.add(R(5)), ans.sub(R(5))],
    unit: "kg",
    solution: {
      given_data: [`Total = ${total} kg`, `Cheaper = Rs. ${c}/kg`, `Dearer = Rs. ${d}/kg`, `Mean = Rs. ${m}/kg`],
      formula: "Cheaper : Dearer = (D − M) : (M − C)",
      steps: [
        `Ratio of Cheaper : Dearer = (${d} − ${m}) : (${m} − ${c}) = ${d - m} : ${m - c}`,
        `Sum of parts = ${d - c}; Cheaper qty = ${total} × (${d - m}/${d - c}) = ${qCheaper.toExamString()} kg`,
        `Dearer qty = ${total} − ${qCheaper.toExamString()} = ${qDearer.toExamString()} kg`,
      ],
      final_answer: `${ans.toExamString()} kg`,
    },
    shortcut_method: `Split ${total} kg in the inverse gap ratio ${d - m} : ${m - c} to get ${ans.toExamString()} kg.`,
    rng,
  });
}

// ============================================================================
// 5. Milk and Water (Easy)
// ============================================================================
function genCat05_MilkAndWater(rng, difficulty) {
  const mR = rng.pick([3, 4, 5, 7]);
  const wR = rng.pick([1, 2, 3]);
  if (mR === wR) return genCat05_MilkAndWater(rng, difficulty);
  const unit = rng.randInt(5, 16);
  const total = (mR + wR) * unit;
  const askMode = rng.pick(["MILK", "WATER", "DIFF"]);
  const milk = R(mR * unit);
  const water = R(wR * unit);
  const ans = askMode === "MILK" ? milk : askMode === "WATER" ? water : milk.sub(water).abs();

  const askPhrase =
    askMode === "MILK"
      ? "the quantity of milk in the mixture"
      : askMode === "WATER"
      ? "the quantity of water in the mixture"
      : "the difference between the quantities of milk and water";

  return assembleQuestion({
    templateId: "MA_05_MILK_WATER",
    question_type: "Milk and Water",
    sub_type: "Basic Milk-Water Composition",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `A container holds ${total} litres of a mixture of milk and water in the ratio ${mR} : ${wR}. Find ${askPhrase}.`,
    mathModel: {
      kind: "MILK_WATER_SPLIT",
      totalQty: R(total),
      milkPart: R(mR),
      waterPart: R(wR),
      ask: askMode,
    },
    exactRationalAnswer: ans,
    plausible: [milk, water, ans.add(R(4)), ans.sub(R(3))],
    unit: "litres",
    solution: {
      given_data: [`Total mixture = ${total} L`, `Milk : Water = ${mR} : ${wR}`],
      formula: "1 ratio unit = Total / (Milk part + Water part)",
      steps: [
        `Total ratio parts = ${mR} + ${wR} = ${mR + wR}`,
        `1 part = ${total} / ${mR + wR} = ${unit} litres`,
        `Milk = ${mR * unit} L, Water = ${wR * unit} L ⇒ Required value = ${ans.toExamString()} litres`,
      ],
      final_answer: `${ans.toExamString()} litres`,
    },
    shortcut_method: `1 part = ${total}/${mR + wR} = ${unit} L; multiply by ${askMode === "MILK" ? mR : askMode === "WATER" ? wR : Math.abs(mR - wR)}.`,
    rng,
  });
}

// ============================================================================
// 6. Addition of an Ingredient (Medium)
// ============================================================================
function genCat06_AdditionOfIngredient(rng, difficulty) {
  const configs = [
    [3, 1, 3, 2, 12], // 48L (36M, 12W) -> add 12L W -> 36:24 = 3:2
    [5, 2, 5, 3, 10], // 70L (50M, 20W) -> add 10L W -> 50:30 = 5:3
    [4, 1, 2, 1, 15], // 75L (60M, 15W) -> add 15L W -> 60:30 = 2:1
    [5, 1, 5, 3, 10], // 60L (50M, 10W) -> add 20L W -> 50:30 = 5:3
    [7, 3, 7, 5, 8],  // 80L (56M, 24W) -> add 16L W -> 56:40 = 7:5
    [3, 2, 1, 1, 14], // 70L (42M, 28W) -> add 14L W -> 42:42 = 1:1
  ];
  const [m1, w1, m2, w2, k] = rng.pick(configs);
  const total = (m1 + w1) * k;
  const initMilk = R(m1 * k);
  const initWater = R(w1 * k);
  const addedWater = initMilk.mul(R(w2, m2)).sub(initWater);

  return assembleQuestion({
    templateId: "MA_06_ADDITION",
    question_type: "Addition of an Ingredient",
    sub_type: "Adding Water to Change Ratio",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `A ${total}-litre mixture contains milk and water in the ratio ${m1} : ${w1}. How many litres of pure water must be added to this mixture so that the new ratio of milk to water becomes ${m2} : ${w2}?`,
    mathModel: {
      kind: "ADD_INGREDIENT",
      totalQty: R(total),
      m1: R(m1),
      w1: R(w1),
      m2: R(m2),
      w2: R(w2),
      addType: "WATER",
    },
    exactRationalAnswer: addedWater,
    plausible: [addedWater.add(R(4)), addedWater.sub(R(4)), initWater, addedWater.add(R(6))],
    unit: "litres",
    solution: {
      given_data: [`Total = ${total} L`, `Initial Milk:Water = ${m1}:${w1}`, `Target Milk:Water = ${m2}:${w2}`],
      formula: "Since only water is added, Milk remains constant: Milk / (Water + x) = m₂ / w₂",
      steps: [
        `Initial Milk = ${initMilk.toExamString()} L, Initial Water = ${initWater.toExamString()} L`,
        `Required final water = ${initMilk.toExamString()} × (${w2}/${m2}) = ${initWater.add(addedWater).toExamString()} L`,
        `Water to be added = ${initWater.add(addedWater).toExamString()} − ${initWater.toExamString()} = ${addedWater.toExamString()} litres`,
      ],
      final_answer: `${addedWater.toExamString()} litres`,
    },
    shortcut_method: `Equate the constant milk part across both ratios, then multiply the water-part increase by 1 unit.`,
    rng,
  });
}

// ============================================================================
// 7. Removal of an Ingredient (Homogeneous Draw-Out — Medium)
// ============================================================================
function genCat07_RemovalOfIngredient(rng, difficulty) {
  const mR = rng.pick([4, 5, 7]);
  const wR = rng.pick([1, 2, 3]);
  const sumR = mR + wR;
  const totalUnits = rng.randInt(8, 15);
  const removeUnits = rng.randInt(2, 5);
  const total = sumR * totalUnits;
  const rem = sumR * removeUnits;
  const initMilk = R(mR * totalUnits);
  const initWater = R(wR * totalUnits);
  const remMilk = R(mR * (totalUnits - removeUnits));
  const remWater = R(wR * (totalUnits - removeUnits));

  return assembleQuestion({
    templateId: "MA_07_REMOVAL",
    question_type: "Removal of an Ingredient",
    sub_type: "Homogeneous Mixture Draw-Out",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
    question: `A vessel contains ${total} litres of a thoroughly mixed solution of milk and water in the ratio ${mR} : ${wR}. If ${rem} litres of the mixture are drawn out from the vessel, how many litres of milk remain in the vessel?`,
    mathModel: {
      kind: "SEQUENTIAL_OPERATIONS",
      initMilk,
      initWater,
      operations: [{ removeQty: R(rem), addMilk: ZERO, addWater: ZERO }],
      ask: "FINAL_MILK",
    },
    exactRationalAnswer: remMilk,
    plausible: [initMilk.sub(R(rem)), remWater, remMilk.add(R(5)), remMilk.sub(R(4))],
    unit: "litres",
    solution: {
      given_data: [`Total = ${total} L`, `Milk:Water = ${mR}:${wR}`, `Drawn out = ${rem} L`],
      formula: "Remaining Milk = (Total − Removed) × [Milk part / (Milk + Water parts)]",
      steps: [
        `Remaining total mixture = ${total} − ${rem} = ${total - rem} litres`,
        `Since the mixture is homogeneous, the ratio remains ${mR} : ${wR}`,
        `Remaining Milk = ${total - rem} × (${mR}/${sumR}) = ${remMilk.toExamString()} litres`,
      ],
      final_answer: `${remMilk.toExamString()} litres`,
    },
    shortcut_method: `Remaining volume (${total - rem} L) still has milk fraction ${mR}/${sumR} ⇒ ${remMilk.toExamString()} L.`,
    rng,
  });
}

// ============================================================================
// 8. Replacement Problems (Single Replacement — Medium)
// ============================================================================
function genCat08_SingleReplacement(rng, difficulty) {
  const configs = [
    [60, 3, 2, 10], // 36M, 24W -> remove 10 (6M, 4W) -> add 10W -> 30M, 30W
    [80, 5, 3, 16], // 50M, 30W -> remove 16 (10M, 6W) -> add 16W -> 40M, 40W
    [70, 4, 3, 14], // 40M, 30W -> remove 14 (8M, 6W) -> add 14W -> 32M, 38W
    [90, 7, 2, 18], // 70M, 20W -> remove 18 (14M, 4W) -> add 18W -> 56M, 34W
    [50, 3, 2, 15], // 30M, 20W -> remove 15 (9M, 6W) -> add 15W -> 21M, 29W
    [72, 5, 4, 18], // 40M, 32W -> remove 18 (10M, 8W) -> add 18W -> 30M, 42W
  ];
  const [total, mR, wR, x] = rng.pick(configs);
  const initMilk = R(total * mR, mR + wR);
  const initWater = R(total).sub(initMilk);
  const finalMilk = initMilk.mul(R(total - x, total));
  const finalWater = R(total).sub(finalMilk);

  return assembleQuestion({
    templateId: "MA_08_SINGLE_REPLACEMENT",
    question_type: "Replacement Problems",
    sub_type: "Single Mixture Replacement with Water",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `A tank contains ${total} litres of a thoroughly mixed solution of milk and water in the ratio ${mR} : ${wR}. If ${x} litres of the mixture are drawn out and replaced with ${x} litres of pure water, how many litres of milk are left in the tank?`,
    mathModel: {
      kind: "SEQUENTIAL_OPERATIONS",
      initMilk,
      initWater,
      operations: [{ removeQty: R(x), addMilk: ZERO, addWater: R(x) }],
      ask: "FINAL_MILK",
    },
    exactRationalAnswer: finalMilk,
    plausible: [initMilk.sub(R(x)), finalWater, finalMilk.add(R(4)), finalMilk.sub(R(3))],
    unit: "litres",
    solution: {
      given_data: [`Total = ${total} L`, `Initial Milk:Water = ${mR}:${wR}`, `Replaced = ${x} L with water`],
      formula: "Final Milk = Initial Milk × (1 − Replaced / Total)",
      steps: [
        `Initial Milk = ${total} × (${mR}/${mR + wR}) = ${initMilk.toExamString()} litres`,
        `Milk removed in ${x} L = ${x} × (${mR}/${mR + wR}) = ${initMilk.sub(finalMilk).toExamString()} litres`,
        `Final Milk = ${initMilk.toExamString()} − ${initMilk.sub(finalMilk).toExamString()} = ${finalMilk.toExamString()} litres`,
      ],
      final_answer: `${finalMilk.toExamString()} litres`,
    },
    shortcut_method: `Multiply initial milk (${initMilk.toExamString()} L) by remaining fraction (${total - x}/${total}) = ${finalMilk.toExamString()} L.`,
    rng,
  });
}

// ============================================================================
// 9. Repeated Replacement (Hard)
// ============================================================================
function genCat09_RepeatedReplacement(rng, difficulty) {
  const configs = [
    [40, 4, 2],  // 40 * (9/10)^2 = 32.4 L
    [50, 5, 2],  // 50 * (9/10)^2 = 40.5 L
    [64, 16, 3], // 64 * (3/4)^3 = 27 L
    [80, 16, 2], // 80 * (4/5)^2 = 51.2 L
    [100, 10, 3], // 100 * (9/10)^3 = 72.9 L
    [50, 10, 3], // 50 * (4/5)^3 = 25.6 L
    [80, 8, 2],  // 80 * (9/10)^2 = 64.8 L
  ];
  const [vol, x, n] = rng.pick(configs);
  const ops = Array.from({ length: n }, () => ({ removeQty: R(x), addMilk: ZERO, addWater: R(x) }));
  let milk = R(vol);
  for (let i = 0; i < n; i++) {
    milk = milk.mul(R(vol - x, vol));
  }
  const wrongLinear = R(vol - n * x);
  const wrongOneStep = R(vol - x);

  return assembleQuestion({
    templateId: "MA_09_REPEATED_REPLACEMENT",
    question_type: "Repeated Replacement",
    sub_type: "Equal-Volume Repeated Replacement",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains", "SBI PO Mains"],
    question: `A vessel contains ${vol} litres of pure milk. From this vessel, ${x} litres of milk are drawn out and replaced with ${x} litres of water. This process is carried out a total of ${n} times (with thorough mixing before each draw). How much milk is left in the vessel?`,
    mathModel: {
      kind: "SEQUENTIAL_OPERATIONS",
      initMilk: R(vol),
      initWater: ZERO,
      operations: ops,
      ask: "FINAL_MILK",
    },
    exactRationalAnswer: milk,
    plausible: [wrongLinear, wrongOneStep, milk.add(R(2)), milk.sub(R(2))],
    unit: "litres",
    solution: {
      given_data: [`Initial pure milk (V) = ${vol} L`, `Replaced each time (x) = ${x} L`, `Total operations (n) = ${n}`],
      formula: "Remaining Milk = V × (1 − x/V)ⁿ",
      steps: [
        `Remaining fraction per step = (${vol} − ${x}) / ${vol} = ${R(vol - x, vol).toFractionString()}`,
        `After ${n} operations: ${vol} × (${R(vol - x, vol).toFractionString()})^${n}`,
        `Remaining Milk = ${milk.toExamString()} litres`,
      ],
      final_answer: `${milk.toExamString()} litres`,
    },
    shortcut_method: `Apply V × ((V−x)/V)^n = ${vol} × (${R(vol - x, vol).toFractionString()})^${n} = ${milk.toExamString()} L (never subtract ${n}×${x} linearly).`,
    rng,
  });
}

export const MIXTURE_TEMPLATES_PART_1 = [
  { id: "MA_01", category: 1, difficulties: ["Easy", "Medium"], fn: genCat01_BasicMeanPrice },
  { id: "MA_02", category: 2, difficulties: ["Easy", "Medium"], fn: genCat02_AlligationRule },
  { id: "MA_03", category: 3, difficulties: ["Easy", "Medium"], fn: genCat03_FindIngredientRatio },
  { id: "MA_04", category: 4, difficulties: ["Easy", "Medium"], fn: genCat04_IndividualQuantity },
  { id: "MA_05", category: 5, difficulties: ["Easy"], fn: genCat05_MilkAndWater },
  { id: "MA_06", category: 6, difficulties: ["Medium"], fn: genCat06_AdditionOfIngredient },
  { id: "MA_07", category: 7, difficulties: ["Medium"], fn: genCat07_RemovalOfIngredient },
  { id: "MA_08", category: 8, difficulties: ["Medium"], fn: genCat08_SingleReplacement },
  { id: "MA_09", category: 9, difficulties: ["Hard"], fn: genCat09_RepeatedReplacement },
];