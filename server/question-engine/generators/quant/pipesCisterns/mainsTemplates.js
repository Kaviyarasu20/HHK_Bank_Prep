// server/question-engine/generators/quant/pipesCisterns/mainsTemplates.js
import { Rational, ZERO, ONE, buildPlausibleOptions } from "./rational.js";

const R = (n, d = 1) => new Rational(BigInt(n), BigInt(d));
const rate = (t) => new Rational(1n, BigInt(t));

function assembleMainsOutput({
  templateId,
  questionType,
  difficulty = "DIFFICULT",
  exam,
  question,
  exactRationalAnswer,
  plausibleDistractors = [],
  unit = "hours",
  preferMixed = true,
  maxFraction = false,
  solution,
  mathModel,
  rng,
}) {
  const opt = buildPlausibleOptions(exactRationalAnswer, plausibleDistractors, {
    unit,
    preferMixed,
    rng,
    maxFraction,
  });

  return {
    templateId,
    templateVersion: "1.0.0",
    topic: "Time and Work",
    subtopic: "Pipes and Cisterns",
    questionType,
    exam,
    examLevel: "MAINS",
    difficulty,
    question,
    options: opt.options,
    correctAnswer: opt.correctAnswer,
    correctOptionIndex: opt.correctOptionIndex,
    correctValue: opt.correctValue,
    unit,
    preferMixed,
    solution,
    exactRationalAnswer,
    mathModel,
  };
}

// ==================== MAINS – ADVANCED TEMPLATES (19–36) ====================

export const MAINS_TEMPLATES = [
  // 19. Multiple Pipes with Different Opening Times (3 pipes staggered by 1 hr each)
  {
    id: "PC_M19_MULTI_DIFF_OPEN",
    questionType: "MULTI_PIPES_DIFF_OPEN_TIMES",
    examLevel: "MAINS",
    difficulty: "DIFFICULT",
    generate(rng, exam) {
      const [a, b, c] = rng.pick([[12, 15, 20], [10, 15, 30], [15, 20, 30], [12, 20, 30]]);
      const rA = rate(a), rB = rate(b), rC = rate(c);
      const w1 = rA.mul(ONE);
      const w2 = rA.add(rB).mul(ONE);
      const rem = ONE.sub(w1).sub(w2);
      const rAll = rA.add(rB).add(rC);
      const t3 = rem.div(rAll);
      const total = R(2).add(t3);
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, exam, rng,
        question: `Three inlet pipes A, B, and C can fill a tank in ${a}, ${b}, and ${c} hours respectively. Pipe A is opened at 8:00 AM, Pipe B at 9:00 AM, and Pipe C at 10:00 AM. How many total hours from 8:00 AM will it take to fill the tank?`,
        exactRationalAnswer: total,
        plausibleDistractors: [t3, ONE.div(rAll), R(2).add(ONE.div(rAll)), total.add(R(1))],
        solution: [
          `Step 1: Rates: A = 1/${a}, B = 1/${b}, C = 1/${c} tank/hr.`,
          `Step 2: 8–9 AM (A alone) = ${w1.toFractionString()}; 9–10 AM (A+B) = ${w2.toFractionString()}.`,
          `Step 3: Remaining after 10:00 AM = ${rem.toFractionString()}.`,
          `Step 4: All three (rate ${rAll.toFractionString()}/hr) finish in ${t3.toExamString()} hrs ⇒ Total = ${total.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rA }, { type: "INLET", rate: rB }, { type: "INLET", rate: rC }],
          stages: [
            { duration: ONE, netRate: rA },
            { duration: ONE, netRate: rA.add(rB) },
            { duration: null, netRate: rAll },
          ],
        },
      });
    },
  },

  // 20. Pipes Opened and Closed at Different Intervals
  {
    id: "PC_M20_OPENED_CLOSED_INTERVALS",
    questionType: "PIPES_OPENED_CLOSED_INTERVALS",
    examLevel: "MAINS",
    difficulty: "DIFFICULT",
    generate(rng, exam) {
      const [a, b, c] = rng.pick([[12, 15, 20], [10, 15, 30], [15, 20, 30]]);
      const rA = rate(a), rB = rate(b), rC = rate(c);
      const t1 = 2, t2 = 2;
      const w1 = rA.add(rB).mul(R(t1));
      const w2 = rB.add(rC).mul(R(t2));
      const rem = ONE.sub(w1).sub(w2);
      const t3 = rem.div(rC);
      const total = R(t1 + t2).add(t3);
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, exam, rng,
        question: `Inlet pipes A, B, and C can fill a tank in ${a}, ${b}, and ${c} hours respectively. A and B are opened for ${t1} hours; then A is closed and C is opened with B for ${t2} hours; finally B is closed and C finishes alone. Find the total time to fill the tank.`,
        exactRationalAnswer: total,
        plausibleDistractors: [t3, R(t1 + t2).add(rem.div(rA)), ONE.div(rA.add(rB).add(rC)), total.add(R(2))],
        solution: [
          `Step 1: Interval 1 (A+B for ${t1} hrs) fills ${w1.toFractionString()}.`,
          `Step 2: Interval 2 (B+C for ${t2} hrs) fills ${w2.toFractionString()}.`,
          `Step 3: Remaining = ${rem.toFractionString()}, finished by C alone in ${t3.toExamString()} hrs.`,
          `Step 4: Total time = ${t1} + ${t2} + ${t3.toExamString()} = ${total.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rA }, { type: "INLET", rate: rB }, { type: "INLET", rate: rC }],
          stages: [
            { duration: R(t1), netRate: rA.add(rB) },
            { duration: R(t2), netRate: rB.add(rC) },
            { duration: null, netRate: rC },
          ],
        },
      });
    },
  },

  // 21. Alternating Inlet Pipes (1 hr each, A then B)
  {
    id: "PC_M21_ALTERNATING_INLETS",
    questionType: "ALTERNATING_INLET_PIPES",
    examLevel: "MAINS",
    difficulty: "DIFFICULT",
    generate(rng, exam) {
      const [a, b] = rng.pick([[10, 15], [12, 18], [12, 24], [15, 20], [16, 24], [8, 12]]);
      const rA = rate(a), rB = rate(b);
      const cycleWork = rA.add(rB);
      const fullCycles = BigInt(Math.floor(ONE.div(cycleWork).toNumber()));
      let level = cycleWork.mul(new Rational(fullCycles, 1n));
      let time = new Rational(fullCycles * 2n, 1n);
      if (level.cmp(ONE) < 0) {
        if (level.add(rA).cmp(ONE) >= 0) {
          time = time.add(ONE.sub(level).div(rA));
        } else {
          level = level.add(rA);
          time = time.add(ONE);
          time = time.add(ONE.sub(level).div(rB));
        }
      }
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, exam, rng,
        question: `Two inlet pipes A and B can fill a tank alone in ${a} hours and ${b} hours respectively. If they are opened on alternate hours for 1 hour each, starting with Pipe A, in how many hours will the tank be completely filled?`,
        exactRationalAnswer: time,
        plausibleDistractors: [ONE.div(cycleWork), ONE.div(cycleWork).mul(R(2)), time.add(R(1)), time.sub(R(1))],
        solution: [
          `Step 1: Rates: A = 1/${a}/hr, B = 1/${b}/hr. In 2 hours (1 cycle), filled = ${cycleWork.toFractionString()}.`,
          `Step 2: After ${fullCycles} full cycles (${fullCycles * 2n} hours), tank is ${cycleWork.mul(new Rational(fullCycles, 1n)).toFractionString()} full.`,
          `Step 3: Remaining fraction is filled in the next turn(s) ⇒ Total time = ${time.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_CYCLIC",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rA }, { type: "INLET", rate: rB }],
          cycle: [
            { duration: ONE, netRate: rA },
            { duration: ONE, netRate: rB },
          ],
        },
      });
    },
  },

  // 22. Alternating Inlet and Outlet Pipes (Stops immediately on inlet hour peak!)
  {
    id: "PC_M22_ALTERNATING_INLET_OUTLET",
    questionType: "ALTERNATING_INLET_OUTLET",
    examLevel: "MAINS",
    difficulty: "DIFFICULT",
    generate(rng, exam) {
      const [a, b] = rng.pick([[6, 12], [8, 12], [8, 16], [10, 15], [10, 20], [12, 18]]);
      const rA = rate(a), rB = rate(b).neg();
      const netCycle = rA.add(rB);
      // Reserve last hour for inlet A: need level >= 1 - rA after k full 2-hr cycles
      const preTarget = ONE.sub(rA);
      const k = BigInt(Math.ceil(preTarget.div(netCycle).toNumber()));
      const levelAfterK = netCycle.mul(new Rational(k, 1n));
      const finalFracTime = ONE.sub(levelAfterK).div(rA);
      const total = new Rational(k * 2n, 1n).add(finalFracTime);
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, exam, rng,
        question: `Inlet Pipe A can fill a tank in ${a} hours and Outlet Pipe B can empty it in ${b} hours. If they are opened alternately for 1 hour each starting with Inlet Pipe A, in how many hours will the tank first become completely full?`,
        exactRationalAnswer: total,
        plausibleDistractors: [
          ONE.div(netCycle).mul(R(2)), // Classic banking trap: forgetting tank fills on the inlet turn!
          ONE.div(netCycle),
          total.add(R(2)),
          total.sub(R(2)),
        ],
        solution: [
          `Step 1: Inlet A = +1/${a}/hr; Outlet B = -1/${b}/hr ⇒ 2-hour cycle net gain = ${netCycle.toFractionString()}.`,
          `Step 2: Reserve the final turn for Inlet A (1/${a}). Cycles needed to reach ≥ ${preTarget.toFractionString()} is ${k} cycles (${k * 2n} hours, level = ${levelAfterK.toFractionString()}).`,
          `Step 3: Remaining ${ONE.sub(levelAfterK).toFractionString()} is filled by Inlet A in ${finalFracTime.toExamString()} hr ⇒ Total = ${total.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_CYCLIC",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rA }, { type: "OUTLET", rate: rB }],
          cycle: [
            { duration: ONE, netRate: rA },
            { duration: ONE, netRate: rB },
          ],
        },
      });
    },
  },

  // 23. Pipes Working in Cyclic Intervals (3 pipes A -> B -> C, 1 hr each)
  {
    id: "PC_M23_CYCLIC_INTERVALS",
    questionType: "CYCLIC_INTERVALS",
    examLevel: "MAINS",
    difficulty: "DIFFICULT",
    generate(rng, exam) {
      const [a, b, c] = rng.pick([[12, 15, 20], [10, 12, 15], [12, 18, 36], [15, 20, 30]]);
      const rA = rate(a), rB = rate(b), rC = rate(c);
      const cycleWork = rA.add(rB).add(rC);
      const fullCycles = BigInt(Math.floor(ONE.div(cycleWork).toNumber()));
      let level = cycleWork.mul(new Rational(fullCycles, 1n));
      let time = new Rational(fullCycles * 3n, 1n);
      for (const r of [rA, rB, rC]) {
        if (level.cmp(ONE) >= 0) break;
        if (level.add(r).cmp(ONE) >= 0) {
          time = time.add(ONE.sub(level).div(r));
          level = ONE;
        } else {
          level = level.add(r);
          time = time.add(ONE);
        }
      }
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, exam, rng,
        question: `Three inlet pipes A, B, and C can fill a cistern in ${a}, ${b}, and ${c} hours respectively. They are opened one at a time in cyclic order A → B → C for 1 hour each. How many hours will it take to fill the cistern?`,
        exactRationalAnswer: time,
        plausibleDistractors: [ONE.div(cycleWork), ONE.div(cycleWork).mul(R(3)), time.add(R(1)), time.sub(R(1))],
        solution: [
          `Step 1: 3-hour cycle work = 1/${a} + 1/${b} + 1/${c} = ${cycleWork.toFractionString()}.`,
          `Step 2: After ${fullCycles} full 3-hour cycles (${fullCycles * 3n} hrs), remaining work is completed sequentially in the next cycle.`,
          `Step 3: Exact total time = ${time.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_CYCLIC",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rA }, { type: "INLET", rate: rB }, { type: "INLET", rate: rC }],
          cycle: [
            { duration: ONE, netRate: rA },
            { duration: ONE, netRate: rB },
            { duration: ONE, netRate: rC },
          ],
        },
      });
    },
  },

  // 24. Repeated Opening and Closing of Pipes (A always open; B opened every alternate hour)
  {
    id: "PC_M24_REPEATED_OPEN_CLOSE",
    questionType: "REPEATED_OPEN_CLOSE",
    examLevel: "MAINS",
    difficulty: "DIFFICULT",
    generate(rng, exam) {
      const [a, b] = rng.pick([[12, 24], [15, 30], [10, 20], [12, 18], [16, 24]]);
      const rA = rate(a), rB = rate(b);
      const step1 = rA.add(rB); // Hour 1: A+B
      const step2 = rA;         // Hour 2: A alone
      const cycleWork = step1.add(step2);
      const fullCycles = BigInt(Math.floor(ONE.div(cycleWork).toNumber()));
      let level = cycleWork.mul(new Rational(fullCycles, 1n));
      let time = new Rational(fullCycles * 2n, 1n);
      if (level.cmp(ONE) < 0) {
        if (level.add(step1).cmp(ONE) >= 0) {
          time = time.add(ONE.sub(level).div(step1));
        } else {
          level = level.add(step1);
          time = time.add(ONE);
          time = time.add(ONE.sub(level).div(step2));
        }
      }
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, exam, rng,
        question: `Inlet Pipe A (fills in ${a} hrs) remains open continuously, while Inlet Pipe B (fills in ${b} hrs) is opened during odd hours (Hour 1, 3, 5...) and closed during even hours (Hour 2, 4, 6...). How long will it take to fill the tank?`,
        exactRationalAnswer: time,
        plausibleDistractors: [ONE.div(rA.add(rB)), R(a), time.add(R(1)), time.sub(R(1))],
        solution: [
          `Step 1: Odd-hour rate (A+B) = ${step1.toFractionString()}/hr; Even-hour rate (A only) = ${step2.toFractionString()}/hr.`,
          `Step 2: 2-hour cycle fills ${cycleWork.toFractionString()} of the tank.`,
          `Step 3: Exact filling time = ${time.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_CYCLIC",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rA }, { type: "INLET", rate: rB }],
          cycle: [
            { duration: ONE, netRate: step1 },
            { duration: ONE, netRate: step2 },
          ],
        },
      });
    },
  },

  // 25. Leakage Developed After a Certain Time
  {
    id: "PC_M25_LEAKAGE_AFTER_TIME",
    questionType: "LEAKAGE_AFTER_TIME",
    examLevel: "MAINS",
    difficulty: "DIFFICULT",
    generate(rng, exam) {
      const [a, leak, t1] = rng.pick([[10, 20, 4], [12, 24, 4], [12, 36, 4], [15, 30, 5], [16, 48, 4]]);
      const rA = rate(a), rL = rate(leak).neg();
      const w1 = rA.mul(R(t1));
      const rem = ONE.sub(w1);
      const rNet = rA.add(rL);
      const t2 = rem.div(rNet);
      const total = R(t1).add(t2);
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, exam, rng,
        question: `An inlet pipe can fill an empty tank in ${a} hours. After working for ${t1} hours, a leak develops at the bottom that alone can empty a full tank in ${leak} hours. Find the total time taken to fill the tank completely.`,
        exactRationalAnswer: total,
        plausibleDistractors: [ONE.div(rNet), t2, R(a), total.add(R(2))],
        solution: [
          `Step 1: Work done before leak (${t1} hrs) = ${w1.toFractionString()}; Remaining = ${rem.toFractionString()}.`,
          `Step 2: Net rate after leak = 1/${a} - 1/${leak} = ${rNet.toFractionString()}/hr.`,
          `Step 3: Remaining time = ${t2.toExamString()} hrs ⇒ Total time = ${t1} + ${t2.toExamString()} = ${total.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rA }, { type: "OUTLET", rate: rL }],
          stages: [
            { duration: R(t1), netRate: rA },
            { duration: null, netRate: rNet },
          ],
        },
      });
    },
  },

  // 26. Leakage Present from the Beginning (Find leak emptying time)
  {
    id: "PC_M26_LEAKAGE_FROM_START",
    questionType: "LEAKAGE_FROM_BEGINNING",
    examLevel: "MAINS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      const [a, withLeak, leakTime] = rng.pick([[8, 12, 24], [10, 15, 30], [12, 18, 36], [12, 20, 30], [15, 20, 60]]);
      const ans = R(leakTime);
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `An inlet pipe normally fills a cistern in ${a} hours. Because of a leak at the bottom present from the start, it takes ${withLeak} hours to fill the cistern. In how many hours can the leak alone empty the completely full cistern?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [R(withLeak - a), R(withLeak + a), ONE.div(rate(a).add(rate(withLeak))), ans.sub(R(4))],
        solution: [
          `Step 1: Normal rate = 1/${a}/hr; Net rate with leak = 1/${withLeak}/hr.`,
          `Step 2: Leak emptying rate = 1/${a} - 1/${withLeak} = 1/${leakTime}/hr.`,
          `Step 3: Leak alone empties the full cistern in ${leakTime} hours.`,
        ],
        mathModel: {
          queryType: "UNKNOWN_PIPE_TIME",
          initialLevel: ZERO,
          targetLevel: ONE,
          knownNetRate: rate(a),
          observedNetRate: rate(withLeak),
          unknownSign: -1n,
          pipes: [{ type: "INLET", rate: rate(a) }],
          extraKey: `leak_${a}_${withLeak}`,
        },
      });
    },
  },

  // 27. Multiple Leaks with Inlet Pipes
  {
    id: "PC_M27_MULTIPLE_LEAKS",
    questionType: "MULTIPLE_LEAKS_WITH_INLETS",
    examLevel: "MAINS",
    difficulty: "DIFFICULT",
    generate(rng, exam) {
      const [a, l1, l2] = rng.pick([[6, 20, 30], [8, 24, 48], [10, 30, 60], [6, 15, 30]]);
      const net = rate(a).sub(rate(l1)).sub(rate(l2));
      const ans = ONE.div(net);
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, exam, rng,
        question: `An inlet pipe fills a tank in ${a} hours. However, two leaks at the bottom can individually empty the full tank in ${l1} hours and ${l2} hours respectively. If the inlet pipe is opened with both leaks active, how long will it take to fill the tank?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [ONE.div(rate(a).sub(rate(l1))), ONE.div(rate(a).add(rate(l1)).add(rate(l2))), ans.add(R(2)), ans.sub(R(2))],
        solution: [
          `Step 1: Inlet rate = +1/${a}/hr; Leak rates = -1/${l1}/hr and -1/${l2}/hr.`,
          `Step 2: Net filling rate = 1/${a} - 1/${l1} - 1/${l2} = ${net.toFractionString()}/hr.`,
          `Step 3: Total time = 1 ÷ (${net.toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [
            { type: "INLET", rate: rate(a) },
            { type: "OUTLET", rate: rate(l1).neg() },
            { type: "OUTLET", rate: rate(l2).neg() },
          ],
          stages: [{ duration: null, netRate: net }],
        },
      });
    },
  },

  // 28. Pipe Efficiency Changes During Operation (Drops to 50% or 75% after t1 hrs)
  {
    id: "PC_M28_EFFICIENCY_CHANGE",
    questionType: "EFFICIENCY_CHANGES_OPERATION",
    examLevel: "MAINS",
    difficulty: "DIFFICULT",
    generate(rng, exam) {
      const a = rng.pick([12, 16, 20, 24]);
      const t1 = rng.pick([4, 6]);
      const [en, ed] = rng.pick([[1, 2], [3, 4]]);
      const effFactor = R(en, ed);
      const r1 = rate(a);
      const r2 = r1.mul(effFactor);
      const w1 = r1.mul(R(t1));
      const rem = ONE.sub(w1);
      const t2 = rem.div(r2);
      const total = R(t1).add(t2);
      const pct = (en * 100) / ed;
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, exam, rng,
        question: `Pipe A can fill a tank in ${a} hours at full capacity. After running for ${t1} hours, a blockage reduces its efficiency to ${pct}% of normal for the rest of the filling. Find the total time taken to fill the tank.`,
        exactRationalAnswer: total,
        plausibleDistractors: [t2, R(a), R(a).div(effFactor), total.add(R(2))],
        solution: [
          `Step 1: Normal rate = 1/${a}/hr; Work in first ${t1} hrs = ${w1.toFractionString()}; Remaining = ${rem.toFractionString()}.`,
          `Step 2: Reduced rate = ${pct}% of 1/${a} = ${r2.toFractionString()}/hr.`,
          `Step 3: Remaining time = ${t2.toExamString()} hrs ⇒ Total = ${t1} + ${t2.toExamString()} = ${total.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: r1 }],
          stages: [
            { duration: R(t1), netRate: r1 },
            { duration: null, netRate: r2 },
          ],
          extraKey: `eff_${pct}`,
        },
      });
    },
  },

  // 29. Partial Filling Followed by Drainage
  {
    id: "PC_M29_PARTIAL_FILL_THEN_DRAIN",
    questionType: "PARTIAL_FILL_THEN_DRAIN",
    examLevel: "MAINS",
    difficulty: "DIFFICULT",
    generate(rng, exam) {
      const [a, b, t1] = rng.pick([[12, 8, 6], [15, 10, 6], [16, 12, 8], [20, 10, 8], [18, 12, 9]]);
      const rA = rate(a), rB = rate(b).neg();
      const filled = rA.mul(R(t1));
      const drainTime = filled.div(rate(b)); // Pipe A closed, Pipe B drains filled amount
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, exam, rng,
        question: `Inlet Pipe A (fills in ${a} hrs) is opened into an empty tank for ${t1} hours, after which Pipe A is closed and Outlet Pipe B (empties full tank in ${b} hrs) is opened. How long will Pipe B take to empty the water accumulated in the tank?`,
        exactRationalAnswer: drainTime,
        plausibleDistractors: [R(b), R(t1).add(drainTime), ONE.sub(filled).div(rate(b)), drainTime.add(R(2))],
        solution: [
          `Step 1: Water filled by A in ${t1} hrs = ${t1}/${a} = ${filled.toFractionString()} of tank.`,
          `Step 2: Outlet B drains at 1/${b} tank/hr.`,
          `Step 3: Time to drain = (${filled.toFractionString()}) ÷ (1/${b}) = ${drainTime.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: filled,
          targetLevel: ZERO,
          pipes: [{ type: "OUTLET", rate: rB }],
          stages: [{ duration: null, netRate: rB }],
          extraKey: `drain_after_${t1}`,
        },
      });
    },
  },

  // 30. Tank Filling in Multiple Stages (3 distinct stages)
  {
    id: "PC_M30_MULTI_STAGE_FILLING",
    questionType: "MULTI_STAGE_FILLING",
    examLevel: "MAINS",
    difficulty: "DIFFICULT",
    generate(rng, exam) {
      const [a, b, c] = rng.pick([[12, 15, 30], [10, 20, 30], [15, 20, 60]]);
      const rA = rate(a), rB = rate(b), rC = rate(c).neg();
      const t1 = 2, t2 = 3;
      const w1 = rA.mul(R(t1));
      const w2 = rA.add(rB).add(rC).mul(R(t2));
      const rem = ONE.sub(w1).sub(w2);
      const r3 = rA.add(rB);
      const t3 = rem.div(r3);
      const total = R(t1 + t2).add(t3);
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, exam, rng,
        question: `Inlet pipes A (${a} hrs) and B (${b} hrs) and Outlet pipe C (${c} hrs) are connected to an empty tank. Stage 1: A runs alone for ${t1} hrs. Stage 2: A, B, and C all run together for ${t2} hrs. Stage 3: C is closed and A + B finish filling. Find the total time taken.`,
        exactRationalAnswer: total,
        plausibleDistractors: [t3, ONE.div(r3), R(t1 + t2).add(rem.div(rA.add(rB).add(rC))), total.add(R(2))],
        solution: [
          `Step 1: Stage 1 fills ${w1.toFractionString()}; Stage 2 (rate ${rA.add(rB).add(rC).toFractionString()}/hr) fills ${w2.toFractionString()}.`,
          `Step 2: Remaining capacity = ${rem.toFractionString()}.`,
          `Step 3: Stage 3 (A+B = ${r3.toFractionString()}/hr) takes ${t3.toExamString()} hrs ⇒ Total = ${total.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rA }, { type: "INLET", rate: rB }, { type: "OUTLET", rate: rC }],
          stages: [
            { duration: R(t1), netRate: rA },
            { duration: R(t2), netRate: rA.add(rB).add(rC) },
            { duration: null, netRate: r3 },
          ],
        },
      });
    },
  },

  // 31. Finding Time When a Certain Fraction of the Tank Is Filled
  {
    id: "PC_M31_TIME_FOR_TARGET_FRACTION",
    questionType: "TIME_FOR_TARGET_FRACTION",
    examLevel: "MAINS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      const [a, b, c] = rng.pick([[12, 15, 20], [15, 20, 30], [10, 15, 30], [20, 30, 60]]);
      const [fn, fd] = rng.pick([[3, 4], [2, 3], [4, 5], [5, 6]]);
      const target = R(fn, fd);
      const net = rate(a).add(rate(b)).sub(rate(c));
      const ans = target.div(net);
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Inlet pipes A (${a} hrs) and B (${b} hrs) and Outlet pipe C (${c} hrs) are opened together into an empty tank. After how many hours will the tank be exactly ${fn}/${fd} full?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [ONE.div(net), ONE.sub(target).div(net), target.div(rate(a).add(rate(b))), ans.add(R(2))],
        solution: [
          `Step 1: Net filling rate = 1/${a} + 1/${b} - 1/${c} = ${net.toFractionString()}/hr.`,
          `Step 2: Time to reach ${fn}/${fd} = (${fn}/${fd}) ÷ (${net.toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: target,
          pipes: [
            { type: "INLET", rate: rate(a) },
            { type: "INLET", rate: rate(b) },
            { type: "OUTLET", rate: rate(c).neg() },
          ],
          stages: [{ duration: null, netRate: net }],
        },
      });
    },
  },

  // 32. Finding the Time When a Tank Becomes Empty (Net Negative Rate!)
  {
    id: "PC_M32_TIME_TANK_EMPTY",
    questionType: "TIME_WHEN_TANK_EMPTY",
    examLevel: "MAINS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      // Outlet faster than inlet => net rate < 0
      const [inlet, outlet] = rng.pick([[15, 10], [20, 12], [24, 16], [30, 15], [18, 12]]);
      const [fn, fd] = rng.pick([[1, 2], [2, 3], [3, 4], [4, 5]]);
      const initLevel = R(fn, fd);
      const netRate = rate(inlet).sub(rate(outlet)); // strictly negative!
      const ans = ZERO.sub(initLevel).div(netRate);
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `A tank is ${fn}/${fd} full. Inlet Pipe A can fill it in ${inlet} hours while Outlet Pipe B can empty the full tank in ${outlet} hours. If both pipes are opened simultaneously, in how many hours will the tank become completely empty?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [ONE.div(netRate.abs()), ONE.sub(initLevel).div(netRate.abs()), initLevel.div(rate(outlet)), ans.add(R(3))],
        solution: [
          `Step 1: Inlet rate = +1/${inlet}/hr; Outlet rate = -1/${outlet}/hr.`,
          `Step 2: Net rate = 1/${inlet} - 1/${outlet} = ${netRate.toFractionString()}/hr (negative, so tank empties).`,
          `Step 3: Time to empty ${fn}/${fd} tank = (${fn}/${fd}) ÷ (${netRate.abs().toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: initLevel,
          targetLevel: ZERO,
          pipes: [{ type: "INLET", rate: rate(inlet) }, { type: "OUTLET", rate: rate(outlet).neg() }],
          stages: [{ duration: null, netRate }],
        },
      });
    },
  },

  // 33. Tank Initially Partially Filled
  {
    id: "PC_M33_INITIALLY_PARTIAL_FILLED",
    questionType: "TANK_INITIALLY_PARTIALLY_FILLED",
    examLevel: "MAINS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      const [a, b, c] = rng.pick([[10, 15, 30], [12, 15, 20], [15, 20, 30]]);
      const [fn, fd] = rng.pick([[1, 3], [1, 4], [2, 5], [1, 2]]);
      const init = R(fn, fd);
      const rem = ONE.sub(init);
      const net = rate(a).add(rate(b)).sub(rate(c));
      const ans = rem.div(net);
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `A tank is already ${fn}/${fd} full. Inlet pipes A (${a} hrs) and B (${b} hrs) and Outlet pipe C (${c} hrs) are opened together. How long will it take to fill the remaining part of the tank?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [ONE.div(net), init.div(net), rem.div(rate(a).add(rate(b))), ans.add(R(2))],
        solution: [
          `Step 1: Remaining capacity = 1 - ${fn}/${fd} = ${rem.toFractionString()}.`,
          `Step 2: Net filling rate = 1/${a} + 1/${b} - 1/${c} = ${net.toFractionString()}/hr.`,
          `Step 3: Time required = (${rem.toFractionString()}) ÷ (${net.toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: init,
          targetLevel: ONE,
          pipes: [
            { type: "INLET", rate: rate(a) },
            { type: "INLET", rate: rate(b) },
            { type: "OUTLET", rate: rate(c).neg() },
          ],
          stages: [{ duration: null, netRate: net }],
        },
      });
    },
  },

  // 34. Tank Initially Partially Empty
  {
    id: "PC_M34_INITIALLY_PARTIAL_EMPTY",
    questionType: "TANK_INITIALLY_PARTIALLY_EMPTY",
    examLevel: "MAINS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      const [a, b] = rng.pick([[12, 18], [15, 30], [10, 15], [20, 30]]);
      const [en, ed] = rng.pick([[1, 3], [2, 5], [3, 4], [2, 3]]);
      const emptyFrac = R(en, ed);
      const initLevel = ONE.sub(emptyFrac);
      const net = rate(a).add(rate(b));
      const ans = emptyFrac.div(net);
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `A cistern is ${en}/${ed} empty. Two inlet pipes A (${a} hrs) and B (${b} hrs) are opened simultaneously. How many hours will it take to fill the cistern to full capacity?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [ONE.div(net), initLevel.div(net), ans.add(R(2)), ans.sub(R(1))],
        solution: [
          `Step 1: Remaining capacity to fill = ${en}/${ed} (initially ${initLevel.toFractionString()} full).`,
          `Step 2: Combined rate = 1/${a} + 1/${b} = ${net.toFractionString()}/hr.`,
          `Step 3: Time required = (${en}/${ed}) ÷ (${net.toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: initLevel,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rate(a) }, { type: "INLET", rate: rate(b) }],
          stages: [{ duration: null, netRate: net }],
        },
      });
    },
  },

  // 35. Different Pipe Combinations in Different Stages
  {
    id: "PC_M35_DIFF_COMBOS_STAGES",
    questionType: "DIFF_PIPE_COMBOS_STAGES",
    examLevel: "MAINS",
    difficulty: "DIFFICULT",
    generate(rng, exam) {
      const [a, b, c, d] = rng.pick([[12, 15, 20, 30], [10, 15, 20, 60]]);
      const rA = rate(a), rB = rate(b), rC = rate(c), rD = rate(d).neg();
      const t1 = 3;
      const rStage1 = rA.add(rB);
      const w1 = rStage1.mul(R(t1));
      const rem = ONE.sub(w1);
      const rStage2 = rB.add(rC).add(rD);
      const t2 = rem.div(rStage2);
      const total = R(t1).add(t2);
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, exam, rng,
        question: `Inlet pipes A (${a} hrs), B (${b} hrs), C (${c} hrs) and Outlet pipe D (${d} hrs) serve a tank. For the first ${t1} hours, only A and B are opened. Then A is closed while C and D are opened alongside B until the tank is full. Find the total filling time.`,
        exactRationalAnswer: total,
        plausibleDistractors: [t2, R(t1).add(rem.div(rB.add(rC))), ONE.div(rStage1), total.add(R(2))],
        solution: [
          `Step 1: Stage 1 (A+B for ${t1} hrs) fills ${w1.toFractionString()}; Remaining = ${rem.toFractionString()}.`,
          `Step 2: Stage 2 net rate (B + C - D) = ${rStage2.toFractionString()}/hr.`,
          `Step 3: Stage 2 time = ${t2.toExamString()} hrs ⇒ Total = ${t1} + ${t2.toExamString()} = ${total.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [
            { type: "INLET", rate: rA },
            { type: "INLET", rate: rB },
            { type: "INLET", rate: rC },
            { type: "OUTLET", rate: rD },
          ],
          stages: [
            { duration: R(t1), netRate: rStage1 },
            { duration: null, netRate: rStage2 },
          ],
        },
      });
    },
  },

  // 36. Complex Inlet and Outlet Combinations (4 pipes: 2 inlets + 2 outlets)
  {
    id: "PC_M36_COMPLEX_INLET_OUTLET",
    questionType: "COMPLEX_INLET_OUTLET_COMBO",
    examLevel: "MAINS",
    difficulty: "DIFFICULT",
    generate(rng, exam) {
      const [a, b, c, d] = rng.pick([[10, 12, 20, 30], [8, 12, 24, 48], [10, 15, 30, 60], [12, 15, 30, 60]]);
      const net = rate(a).add(rate(b)).sub(rate(c)).sub(rate(d));
      const ans = ONE.div(net);
      return assembleMainsOutput({
        templateId: this.id, questionType: this.questionType, exam, rng,
        question: `Two inlet pipes A and B can fill a tank in ${a} hours and ${b} hours respectively, while two outlet pipes C and D can empty the full tank in ${c} hours and ${d} hours respectively. If all four pipes are opened together when the tank is empty, how long will it take to fill the tank?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [
          ONE.div(rate(a).add(rate(b))),
          ONE.div(rate(a).add(rate(b)).sub(rate(c))),
          ans.add(R(2)),
          ans.sub(R(2)),
        ],
        solution: [
          `Step 1: Inlets: +1/${a}, +1/${b}; Outlets: -1/${c}, -1/${d}.`,
          `Step 2: Net filling rate = 1/${a} + 1/${b} - 1/${c} - 1/${d} = ${net.toFractionString()}/hr.`,
          `Step 3: Total filling time = 1 ÷ (${net.toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [
            { type: "INLET", rate: rate(a) },
            { type: "INLET", rate: rate(b) },
            { type: "OUTLET", rate: rate(c).neg() },
            { type: "OUTLET", rate: rate(d).neg() },
          ],
          stages: [{ duration: null, netRate: net }],
        },
      });
    },
  },
];