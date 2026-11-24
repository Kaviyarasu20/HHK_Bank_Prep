/**
 * Exam-Wise Topic Distribution Engine
 *
 * Responsibilities:
 * 1. Allocates exact section question counts across enabled topics while respecting
 *    each topic's [minQuestions, maxQuestions], weight, and priority.
 * 2. Introduces realistic variation across mock tests (within configured ranges) using
 *    a deterministic-when-seeded PRNG so every generated test feels authentic yet reproducible.
 * 3. For composite Arithmetic pools, uses intelligent weighted subtopic sampling so each
 *    mock test covers a realistic subset of arithmetic topics (not every topic in every test)
 *    while ensuring broad syllabus coverage across multiple sets.
 * 4. Apportions exam-specific difficulty distributions (easy / medium / hard) across slots
 *    using exact largest-remainder allocation.
 */

export function createSeededRng(seedInput = Date.now()) {
  let state = (Number(seedInput) >>> 0) || 0x9e3779b9;
  return function nextFloat() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Largest-remainder apportionment of an integer total across weighted buckets.
 */
export function apportionByWeights(total, items, weightKey = "weight") {
  if (total <= 0 || !items.length) return items.map(() => 0);
  const weights = items.map((item) => Math.max(0, Number(item?.[weightKey] ?? 1)));
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  if (sumWeights <= 0) {
    const base = Math.floor(total / items.length);
    const rem = total - base * items.length;
    return items.map((_, i) => base + (i < rem ? 1 : 0));
  }

  const raw = weights.map((w) => (total * w) / sumWeights);
  const floors = raw.map((v) => Math.floor(v));
  let remainder = total - floors.reduce((a, b) => a + b, 0);

  const ranked = raw
    .map((v, idx) => ({ idx, frac: v - floors[idx] }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < remainder; i++) {
    floors[ranked[i % ranked.length].idx] += 1;
  }
  return floors;
}

/**
 * Normalizes a difficultyDistribution object ({ easy, medium, hard }) to sum to 100.
 */
export function normalizeDifficultyDistribution(dist = {}) {
  const easy = Math.max(0, Number(dist.easy ?? dist.easyPercent ?? 30));
  const medium = Math.max(0, Number(dist.medium ?? dist.mediumPercent ?? 50));
  const hard = Math.max(0, Number(dist.hard ?? dist.hardPercent ?? 20));
  const total = easy + medium + hard;
  if (total <= 0) return { easy: 30, medium: 50, hard: 20 };
  return {
    easy: Math.round((easy / total) * 100),
    medium: Math.round((medium / total) * 100),
    hard: 100 - Math.round((easy / total) * 100) - Math.round((medium / total) * 100),
  };
}

/**
 * Computes exact { easy, medium, hard } integer counts for a given question count.
 */
export function allocateDifficultyCounts(totalQuestions, difficultyDistribution = {}) {
  const norm = normalizeDifficultyDistribution(difficultyDistribution);
  const buckets = [
    { key: "easy", weight: norm.easy },
    { key: "medium", weight: norm.medium },
    { key: "hard", weight: norm.hard },
  ];
  const counts = apportionByWeights(totalQuestions, buckets, "weight");
  return {
    easy: counts[0],
    medium: counts[1],
    hard: counts[2],
  };
}

/**
 * Weighted sampling without replacement (when distinct subtopics are chosen for a test).
 * High-priority / high-weight arithmetic topics appear more often across mock tests,
 * while lower-weight syllabus topics rotate in naturally across multiple sets.
 */
export function sampleWeightedArithmeticSubtopics(
  totalArithmeticQuestions,
  subtopicsPool = [],
  { rng = Math.random, recentSubtopicCounts = {} } = {}
) {
  const enabled = subtopicsPool.filter((s) => s.enabled !== false);
  if (!enabled.length || totalArithmeticQuestions <= 0) return [];

  // Choose a realistic number of distinct subtopics for this test:
  // Do NOT cram all 15 arithmetic topics into a 10-question slot; pick min(total, max(4, ceil(total * 0.75)))
  const maxDistinct = Math.min(
    enabled.length,
    Math.max(Math.min(4, totalArithmeticQuestions), Math.min(totalArithmeticQuestions, Math.ceil(totalArithmeticQuestions * 0.8)))
  );

  // Build effective weights (penalize subtopics heavily used in recent sets to improve cross-test coverage)
  const candidates = enabled.map((sub) => {
    const baseWeight = Math.max(1, Number(sub.weight ?? 10));
    const priorityBoost = sub.priority === 1 ? 1.25 : sub.priority === 2 ? 1.0 : 0.8;
    const recentUsage = Number(recentSubtopicCounts[sub.name] || 0);
    const freshnessFactor = 1 / (1 + recentUsage * 0.35);
    return {
      ...sub,
      effectiveWeight: baseWeight * priorityBoost * freshnessFactor,
    };
  });

  // Sample `maxDistinct` subtopics without replacement proportional to effectiveWeight
  const chosen = [];
  const pool = [...candidates];
  while (chosen.length < maxDistinct && pool.length > 0) {
    const totalW = pool.reduce((sum, item) => sum + item.effectiveWeight, 0);
    let r = rng() * totalW;
    let pickIdx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].effectiveWeight;
      if (r <= 0) {
        pickIdx = i;
        break;
      }
    }
    chosen.push(pool.splice(pickIdx, 1)[0]);
  }

  // Assign 1 question to each chosen subtopic, then distribute any extra questions by weight
  const allocationMap = new Map(chosen.map((sub) => [sub.name, 1]));
  let remaining = totalArithmeticQuestions - chosen.length;

  while (remaining > 0) {
    const totalW = chosen.reduce((sum, item) => sum + item.effectiveWeight, 0);
    let r = rng() * totalW;
    let picked = chosen[chosen.length - 1];
    for (const item of chosen) {
      r -= item.effectiveWeight;
      if (r <= 0) {
        picked = item;
        break;
      }
    }
    // Cap any single arithmetic subtopic at 2 questions per test (unless very few subtopics exist)
    const currentCount = allocationMap.get(picked.name) || 0;
    if (currentCount >= 2 && chosen.some((c) => (allocationMap.get(c.name) || 0) < 2)) {
      continue;
    }
    allocationMap.set(picked.name, currentCount + 1);
    remaining -= 1;
  }

  return Array.from(allocationMap.entries()).map(([topicName, count]) => ({
    topic: topicName,
    parentGroup: "Arithmetic",
    count,
  }));
}

/**
 * Computes a concrete topic-wise & difficulty-wise question plan for a single section.
 *
 * @param {object} sectionRule
 * @param {object} options
 * @returns {{
 *   sectionName: string,
 *   subjectKey: string,
 *   totalQuestions: number,
 *   difficultyTargets: { easy: number, medium: number, hard: number },
 *   topicPlan: Array<{ topic: string, parentGroup: string|null, count: number, minQuestions: number, maxQuestions: number, difficultySplit: { easy: number, medium: number, hard: number } }>,
 *   notes: string[]
 * }}
 */
export function buildSectionDistributionPlan(
  sectionRule,
  { seed = Date.now(), varyWithinRanges = true, recentSubtopicCounts = {} } = {}
) {
  const rng = createSeededRng(seed);
  const totalQuestions = Math.max(0, Number(sectionRule.questionCount || 0));
  const enabledTopics = (sectionRule.topicDistributions || []).filter((t) => t.enabled !== false);
  const notes = [];

  if (totalQuestions === 0 || !enabledTopics.length) {
    return {
      sectionName: sectionRule.sectionName,
      subjectKey: sectionRule.subjectKey,
      totalQuestions,
      difficultyTargets: { easy: 0, medium: 0, hard: 0 },
      topicPlan: [],
      notes: totalQuestions === 0 ? ["Section has 0 configured questions."] : ["No enabled topics configured for section."],
    };
  }

  // Sort by priority ASC, weight DESC for deterministic tie-breaking
  const sorted = [...enabledTopics].sort(
    (a, b) => Number(a.priority ?? 2) - Number(b.priority ?? 2) || Number(b.weight ?? 10) - Number(a.weight ?? 10)
  );

  // Step 1: Compute bounded initial targets per topic
  const allocations = sorted.map((t) => {
    const minQ = Math.max(0, Number(t.minQuestions ?? 0));
    const maxQ = Math.max(minQ, Number(t.maxQuestions ?? totalQuestions));
    const defQ =
      t.defaultQuestions !== undefined && t.defaultQuestions !== null
        ? Math.min(maxQ, Math.max(minQ, Number(t.defaultQuestions)))
        : Math.round((minQ + maxQ) / 2);

    let target = defQ;
    if (varyWithinRanges && maxQ > minQ) {
      // Vary smoothly around defaultQuestions within [minQ, maxQ]
      const span = maxQ - minQ;
      const jitter = Math.floor(rng() * (span + 1));
      target = minQ + jitter;
    }
    return {
      rule: t,
      minQ,
      maxQ,
      weight: Math.max(1, Number(t.weight ?? 10)),
      count: target,
    };
  });

  // Step 2: Reconcile sum to exact totalQuestions while respecting [minQ, maxQ]
  let currentSum = allocations.reduce((s, a) => s + a.count, 0);

  // Ensure sum of mins doesn't exceed totalQuestions
  const sumMin = allocations.reduce((s, a) => s + a.minQ, 0);
  if (sumMin > totalQuestions) {
    notes.push(`Configured topic minimums (${sumMin}) exceeded section count (${totalQuestions}); scaled proportionally.`);
    const scaled = apportionByWeights(totalQuestions, allocations, "weight");
    allocations.forEach((a, i) => {
      a.count = scaled[i];
    });
    currentSum = totalQuestions;
  }

  let guard = 0;
  while (currentSum !== totalQuestions && guard < 500) {
    guard++;
    if (currentSum < totalQuestions) {
      const expandable = allocations.filter((a) => a.count < a.maxQ);
      const pool = expandable.length ? expandable : allocations;
      // Pick weighted random expandable topic
      const totalW = pool.reduce((s, a) => s + a.weight, 0);
      let r = rng() * totalW;
      let chosen = pool[0];
      for (const item of pool) {
        r -= item.weight;
        if (r <= 0) {
          chosen = item;
          break;
        }
      }
      chosen.count += 1;
      currentSum += 1;
    } else {
      const shrinkable = allocations.filter((a) => a.count > a.minQ);
      const pool = shrinkable.length ? shrinkable : allocations.filter((a) => a.count > 0);
      if (!pool.length) break;
      // Shrink lower-priority / lower-weight topics first with slight randomness
      const chosen = pool[Math.floor(rng() * pool.length)];
      chosen.count -= 1;
      currentSum -= 1;
    }
  }

  // Step 3: Expand composite Arithmetic group into weighted subtopic slots
  const expandedTopics = [];
  for (const alloc of allocations) {
    if (alloc.count <= 0) continue;
    const isCompositeArith =
      alloc.rule.isCompositeArithmetic ||
      (String(alloc.rule.topic || "").toLowerCase() === "arithmetic" &&
        Array.isArray(alloc.rule.subtopics) &&
        alloc.rule.subtopics.length > 0);

    if (isCompositeArith && Array.isArray(alloc.rule.subtopics) && alloc.rule.subtopics.length > 0) {
      const sampledSubtopics = sampleWeightedArithmeticSubtopics(alloc.count, alloc.rule.subtopics, {
        rng,
        recentSubtopicCounts,
      });
      for (const sub of sampledSubtopics) {
        expandedTopics.push({
          topic: sub.topic,
          parentGroup: "Arithmetic",
          count: sub.count,
          minQuestions: 0,
          maxQuestions: alloc.maxQ,
        });
      }
    } else {
      expandedTopics.push({
        topic: alloc.rule.topic,
        parentGroup: null,
        count: alloc.count,
        minQuestions: alloc.minQ,
        maxQuestions: alloc.maxQ,
      });
    }
  }

  // Step 4: Apportion exam-specific difficulty across expanded topic slots
  const difficultyTargets = allocateDifficultyCounts(totalQuestions, sectionRule.difficultyDistribution);
  const diffPool = [
    ...Array(difficultyTargets.easy).fill("easy"),
    ...Array(difficultyTargets.medium).fill("medium"),
    ...Array(difficultyTargets.hard).fill("hard"),
  ];
  // Shuffle diffPool deterministically using rng
  for (let i = diffPool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [diffPool[i], diffPool[j]] = [diffPool[j], diffPool[i]];
  }

  let cursor = 0;
  const topicPlan = expandedTopics.map((slot) => {
    const slice = diffPool.slice(cursor, cursor + slot.count);
    cursor += slot.count;
    const difficultySplit = { easy: 0, medium: 0, hard: 0 };
    for (const d of slice) {
      difficultySplit[d] = (difficultySplit[d] || 0) + 1;
    }
    return {
      ...slot,
      difficultySplit,
    };
  });

  return {
    sectionName: sectionRule.sectionName,
    subjectKey: sectionRule.subjectKey,
    totalQuestions,
    difficultyTargets,
    topicPlan,
    notes,
  };
}
