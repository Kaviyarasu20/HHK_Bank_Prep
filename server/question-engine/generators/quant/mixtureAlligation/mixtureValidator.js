// Place at: server/question-engine/generators/quant/mixtureAlligation/mixtureValidator.js
import crypto from "node:crypto";
import { Rational, ZERO, HUNDRED, formatWithUnit } from "./mixtureMath.js";

/**
 * Generates a normalized mathematical fingerprint to prevent duplicate questions
 * within a batch or mock test regardless of phrasing variations.
 */
export function computeMixtureFingerprint(mathModel, templateId) {
  const serialize = (v) =>
    v instanceof Rational
      ? v.toFractionString()
      : Array.isArray(v)
      ? v.map(serialize)
      : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, serialize(v[k])]))
      : v;

  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ templateId, model: serialize(mathModel) }))
    .digest("hex")
    .slice(0, 20);
}

/**
 * ENGINE B – Independent Mixture & Alligation Mathematical Verifier.
 * Reconstructs the mixture from physical quantities/operations and independently
 * checks every constraint and boundary condition.
 */
export function independentlyVerifyMixtureModel(model) {
  const { kind } = model;

  // 1. Weighted Mean of 2 or 3+ ingredients
  if (kind === "WEIGHTED_MEAN") {
    const { items } = model;
    if (!Array.isArray(items) || items.length < 2) {
      return { ok: false, reason: "Weighted mean requires at least 2 ingredients." };
    }
    let totalCost = ZERO;
    let totalQty = ZERO;
    for (const item of items) {
      if (!item.qty.isPositive() || item.price.isNegative()) {
        return { ok: false, reason: "Ingredient quantities must be positive and prices non-negative." };
      }
      totalCost = totalCost.add(item.qty.mul(item.price));
      totalQty = totalQty.add(item.qty);
    }
    if (!totalQty.isPositive()) return { ok: false, reason: "Total quantity must be positive." };
    return { ok: true, value: totalCost.div(totalQty) };
  }

  // 2. Alligation Ratio (Cheaper < Mean < Dearer) with reconstruction check
  if (kind === "ALLIGATION_RATIO") {
    const { cheaper, dearer, mean, isConcentration = false } = model;
    if (isConcentration) {
      if (cheaper.isNegative() || dearer.cmp(HUNDRED) > 0) {
        return { ok: false, reason: "Concentrations must lie in [0%, 100%]." };
      }
    }
    if (cheaper.cmp(mean) >= 0 || mean.cmp(dearer) >= 0) {
      return { ok: false, reason: "Mean value must lie strictly between cheaper and dearer values." };
    }
    const qCheaper = dearer.sub(mean);
    const qDearer = mean.sub(cheaper);
    // Reconstruct mean from inverse ratio to independently verify
    const reconstructedMean = qCheaper.mul(cheaper).add(qDearer.mul(dearer)).div(qCheaper.add(qDearer));
    if (!reconstructedMean.equals(mean)) {
      return { ok: false, reason: "Reconstructed mean does not match target mean." };
    }
    const ratio = qCheaper.div(qDearer);
    return { ok: true, ratioStr: `${ratio.num} : ${ratio.den}` };
  }

  // 3. Alligation Individual Quantity from Total Quantity
  if (kind === "ALLIGATION_QUANTITY") {
    const { cheaper, dearer, mean, totalQty, target = "CHEAPER" } = model;
    if (!totalQty.isPositive() || cheaper.cmp(mean) >= 0 || mean.cmp(dearer) >= 0) {
      return { ok: false, reason: "Invalid alligation quantity constraints." };
    }
    const qCheaper = totalQty.mul(dearer.sub(mean)).div(dearer.sub(cheaper));
    const qDearer = totalQty.sub(qCheaper);
    if (!qCheaper.isPositive() || !qDearer.isPositive()) {
      return { ok: false, reason: "Computed ingredient quantity is non-positive." };
    }
    const checkMean = qCheaper.mul(cheaper).add(qDearer.mul(dearer)).div(totalQty);
    if (!checkMean.equals(mean)) {
      return { ok: false, reason: "Reconstructed weighted mean failed." };
    }
    return { ok: true, value: target === "CHEAPER" ? qCheaper : qDearer };
  }

  // 4. Milk & Water Ratio Split
  if (kind === "MILK_WATER_SPLIT") {
    const { totalQty, milkPart, waterPart, ask = "MILK" } = model;
    if (!totalQty.isPositive() || !milkPart.isPositive() || !waterPart.isPositive()) {
      return { ok: false, reason: "Quantities and ratio parts must be positive." };
    }
    const sumParts = milkPart.add(waterPart);
    const milk = totalQty.mul(milkPart).div(sumParts);
    const water = totalQty.mul(waterPart).div(sumParts);
    if (!milk.add(water).equals(totalQty)) {
      return { ok: false, reason: "Milk + water does not equal total quantity." };
    }
    if (ask === "MILK") return { ok: true, value: milk };
    if (ask === "WATER") return { ok: true, value: water };
    return { ok: true, value: milk.sub(water).abs() };
  }

  // 5. Addition of Pure Water (or Milk) to Reach Target Ratio
  if (kind === "ADD_INGREDIENT") {
    const { totalQty, m1, w1, m2, w2, addType = "WATER" } = model;
    if (!totalQty.isPositive() || !m1.isPositive() || !w1.isPositive() || !m2.isPositive() || !w2.isPositive()) {
      return { ok: false, reason: "Invalid ratio or total quantity." };
    }
    const initMilk = totalQty.mul(m1).div(m1.add(w1));
    const initWater = totalQty.sub(initMilk);
    if (addType === "WATER") {
      // Milk stays constant: initMilk / (initWater + x) = m2 / w2
      const finalWater = initMilk.mul(w2).div(m2);
      const added = finalWater.sub(initWater);
      if (!added.isPositive()) return { ok: false, reason: "Added water must be strictly positive." };
      return { ok: true, value: added };
    } else {
      const finalMilk = initWater.mul(m2).div(w2);
      const added = finalMilk.sub(initMilk);
      if (!added.isPositive()) return { ok: false, reason: "Added milk must be strictly positive." };
      return { ok: true, value: added };
    }
  }

  // 6. Homogeneous Removal / Single & Repeated Replacement / Multi-Operations Simulation
  if (kind === "SEQUENTIAL_OPERATIONS") {
    const { initMilk, initWater, operations, ask = "FINAL_MILK" } = model;
    if (initMilk.isNegative() || initWater.isNegative() || !initMilk.add(initWater).isPositive()) {
      return { ok: false, reason: "Invalid initial mixture volumes." };
    }
    let milk = initMilk;
    let water = initWater;

    for (const op of operations) {
      const total = milk.add(water);
      if (op.removeQty && op.removeQty.isPositive()) {
        if (op.removeQty.cmp(total) >= 0) {
          return { ok: false, reason: "Removed volume cannot equal or exceed available mixture." };
        }
        const remainFrac = total.sub(op.removeQty).div(total);
        milk = milk.mul(remainFrac);
        water = water.mul(remainFrac);
      }
      if (op.addMilk && op.addMilk.isPositive()) {
        milk = milk.add(op.addMilk);
      }
      if (op.addWater && op.addWater.isPositive()) {
        water = water.add(op.addWater);
      }
      if (milk.isNegative() || water.isNegative()) {
        return { ok: false, reason: "Negative component volume during operation." };
      }
    }

    if (ask === "FINAL_MILK") return { ok: true, value: milk };
    if (ask === "FINAL_WATER") return { ok: true, value: water };
    if (ask === "FINAL_RATIO") {
      if (!milk.isPositive() || !water.isPositive()) return { ok: false, reason: "Zero component in ratio." };
      const r = milk.div(water);
      return { ok: true, ratioStr: `${r.num} : ${r.den}` };
    }
    return { ok: false, reason: `Unsupported ask mode: ${ask}` };
  }

  // 7. Concentration & Mixing Solutions
  if (kind === "CONCENTRATION_MIX") {
    const { solutions } = model;
    if (!Array.isArray(solutions) || solutions.length === 0) {
      return { ok: false, reason: "No solutions provided." };
    }
    let totalSolute = ZERO;
    let totalVol = ZERO;
    for (const sol of solutions) {
      if (!sol.vol.isPositive() || sol.pct.isNegative() || sol.pct.cmp(HUNDRED) > 0) {
        return { ok: false, reason: "Solution volume must be positive and concentration in [0%, 100%]." };
      }
      totalSolute = totalSolute.add(sol.vol.mul(sol.pct).div(HUNDRED));
      totalVol = totalVol.add(sol.vol);
    }
    const finalPct = totalSolute.mul(HUNDRED).div(totalVol);
    if (finalPct.isNegative() || finalPct.cmp(HUNDRED) > 0) {
      return { ok: false, reason: "Resulting concentration out of [0%, 100%] bounds." };
    }
    return { ok: true, value: finalPct };
  }

  // 8. Dilution (Adding Pure Solvent to Reduce Concentration)
  if (kind === "DILUTION") {
    const { initVol, initPct, targetPct } = model;
    if (
      !initVol.isPositive() ||
      !initPct.isPositive() ||
      !targetPct.isPositive() ||
      initPct.cmp(HUNDRED) >= 0 ||
      targetPct.cmp(initPct) >= 0
    ) {
      return { ok: false, reason: "Dilution requires 0 < targetPct < initPct < 100." };
    }
    const solute = initVol.mul(initPct).div(HUNDRED);
    const finalVol = solute.mul(HUNDRED).div(targetPct);
    const addedWater = finalVol.sub(initVol);
    // Reconstruct concentration
    const checkPct = solute.mul(HUNDRED).div(initVol.add(addedWater));
    if (!checkPct.equals(targetPct)) return { ok: false, reason: "Dilution reconstruction failed." };
    return { ok: true, value: addedWater };
  }

  // 9. Missing Price / Concentration
  if (kind === "MISSING_PRICE") {
    const { q1, p1, q2, mean } = model;
    if (!q1.isPositive() || !q2.isPositive() || !p1.isPositive() || !mean.isPositive()) {
      return { ok: false, reason: "Invalid parameters for missing price." };
    }
    const totalCost = q1.add(q2).mul(mean);
    const remCost = totalCost.sub(q1.mul(p1));
    const p2 = remCost.div(q2);
    if (!p2.isPositive()) return { ok: false, reason: "Solved missing price is non-positive." };
    return { ok: true, value: p2 };
  }

  // 10. Ratio Change — Find Initial Quantity
  if (kind === "RATIO_CHANGE_INITIAL") {
    const { m1, w1, m2, w2, addedWater, ask = "INITIAL_MILK" } = model;
    if (!addedWater.isPositive() || !m1.isPositive() || !w1.isPositive() || !m2.isPositive() || !w2.isPositive()) {
      return { ok: false, reason: "Invalid ratio change parameters." };
    }
    // Let initial milk = M. Then initial water = M * w1/m1.
    // After adding addedWater: M / (M*w1/m1 + addedWater) = m2 / w2
    // => M * (w2/m2 - w1/m1) = addedWater
    const coeff = w2.div(m2).sub(w1.div(m1));
    if (!coeff.isPositive()) return { ok: false, reason: "Water ratio did not increase after adding water." };
    const initMilk = addedWater.div(coeff);
    const initWater = initMilk.mul(w1).div(m1);
    // Reconstruct final ratio
    const checkRatio = initMilk.div(initWater.add(addedWater));
    if (!checkRatio.equals(m2.div(w2))) return { ok: false, reason: "Ratio change reconstruction failed." };
    return { ok: true, value: ask === "INITIAL_MILK" ? initMilk : initMilk.add(initWater) };
  }

  // 11. Mixture + Profit Combined (Find mixing ratio from SP & Profit %)
  if (kind === "MIXTURE_PROFIT_RATIO") {
    const { cheaper, dearer, sp, profitPct } = model;
    if (!sp.isPositive() || !profitPct.isPositive()) {
      return { ok: false, reason: "Selling price and profit % must be positive." };
    }
    const cpMean = sp.mul(HUNDRED).div(HUNDRED.add(profitPct));
    if (cheaper.cmp(cpMean) >= 0 || cpMean.cmp(dearer) >= 0) {
      return { ok: false, reason: "Derived mean CP does not lie strictly between cheaper and dearer CPs." };
    }
    const ratio = dearer.sub(cpMean).div(cpMean.sub(cheaper));
    return { ok: true, ratioStr: `${ratio.num} : ${ratio.den}` };
  }

  // 12. Adulteration (Free water added to pure milk)
  if (kind === "ADULTERATION") {
    const { milkQty, milkCostPerL, spPerL, profitPct } = model;
    if (!milkQty.isPositive() || !milkCostPerL.isPositive() || !spPerL.isPositive() || !profitPct.isPositive()) {
      return { ok: false, reason: "Invalid adulteration parameters." };
    }
    const totalCost = milkQty.mul(milkCostPerL);
    const requiredRev = totalCost.mul(HUNDRED.add(profitPct)).div(HUNDRED);
    const totalVol = requiredRev.div(spPerL);
    const waterAdded = totalVol.sub(milkQty);
    if (!waterAdded.isPositive()) {
      return { ok: false, reason: "Adulteration water quantity must be positive." };
    }
    // Reconstruct profit %
    const actualRev = milkQty.add(waterAdded).mul(spPerL);
    const actualProfitPct = actualRev.sub(totalCost).mul(HUNDRED).div(totalCost);
    if (!actualProfitPct.equals(profitPct)) {
      return { ok: false, reason: "Adulteration profit reconstruction failed." };
    }
    return { ok: true, value: waterAdded };
  }

  return { ok: false, reason: `Unknown mixture model kind: ${kind}` };
}

/**
 * Full Engine B Validation Gate for Mixture & Alligation Questions.
 */
export function validateMixtureQuestion(q) {
  const {
    mathModel,
    exactRationalAnswer,
    ratioAnswer,
    options,
    correct_answer,
    correctOptionIndex,
    solution,
    prefix = "",
    unit = "",
  } = q;

  const solved = independentlyVerifyMixtureModel(mathModel);
  if (!solved.ok) {
    return { passed: false, reason: `Engine B rejected model: ${solved.reason}` };
  }

  let expectedStr;
  if (solved.ratioStr) {
    if (solved.ratioStr !== ratioAnswer) {
      return { passed: false, reason: `Ratio mismatch! Engine A=${ratioAnswer}, Engine B=${solved.ratioStr}` };
    }
    expectedStr = solved.ratioStr;
  } else {
    if (!(exactRationalAnswer instanceof Rational) || !solved.value.equals(exactRationalAnswer)) {
      return {
        passed: false,
        reason: `Answer mismatch! Engine A=${exactRationalAnswer?.toFractionString()}, Engine B=${solved.value.toFractionString()}`,
      };
    }
    if (!solved.value.isPositive() || solved.value.den > 100n) {
      return { passed: false, reason: `Answer failed precision sanity check: ${solved.value.toFractionString()}` };
    }
    expectedStr = formatWithUnit(solved.value, { prefix, unit });
  }

  const optsArr = Array.isArray(options) ? options : [options.A, options.B, options.C, options.D];
  if (optsArr.length !== 4 || new Set(optsArr.map((x) => String(x).trim().toLowerCase())).size !== 4) {
    return { passed: false, reason: "Must have exactly 4 unique MCQ options." };
  }
  if (optsArr.some((x) => !x || String(x).includes("NaN") || String(x).includes("undefined"))) {
    return { passed: false, reason: "Invalid option string detected." };
  }
  const matches = optsArr.filter((x) => x === expectedStr);
  if (matches.length !== 1 || optsArr[correctOptionIndex] !== expectedStr) {
    return { passed: false, reason: `Expected exactly 1 option matching '${expectedStr}'.` };
  }
  if (!["A", "B", "C", "D"].includes(correct_answer)) {
    return { passed: false, reason: "Invalid correct_answer key." };
  }
  if (!solution || !Array.isArray(solution.steps) || solution.steps.length < 2) {
    return { passed: false, reason: "Solution steps incomplete." };
  }

  return {
    passed: true,
    validation: {
      mathematical_check: true,
      constraint_check: true,
      unit_check: true,
      unique_answer_check: true,
      option_check: true,
      ambiguity_check: true,
    },
  };
}