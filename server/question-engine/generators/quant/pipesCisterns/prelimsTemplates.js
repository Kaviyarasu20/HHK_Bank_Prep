// server/question-engine/generators/quant/pipesCisterns/prelimsTemplates.js
import { Rational, ZERO, ONE, buildPlausibleOptions } from "./rational.js";

const R = (n, d = 1) => new Rational(BigInt(n), BigInt(d));
const rate = (t) => new Rational(1n, BigInt(t));

function assembleTemplateOutput({
  templateId,
  questionType,
  examLevel = "PRELIMS",
  difficulty,
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
    examLevel,
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

// ==================== PRELIMS – CORE TEMPLATES (1–18) ====================

export const PRELIMS_TEMPLATES = [
  // 1. Single Inlet Pipe
  {
    id: "PC_P01_SINGLE_INLET",
    questionType: "SINGLE_INLET",
    examLevel: "PRELIMS",
    difficulty: "EASY",
    generate(rng, exam) {
      const a = rng.pick([8, 10, 12, 15, 16, 18, 20, 24]);
      const [fn, fd] = rng.pick([[1, 2], [3, 4], [2, 3], [3, 5], [4, 5]]);
      const frac = R(fn, fd);
      const ans = frac.div(rate(a));
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Inlet Pipe A alone can fill an empty tank in ${a} hours. How long will Pipe A take to fill ${fn}/${fd} of the tank?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [R(a), R(a).div(frac), R(a).sub(ans), ans.add(R(2))],
        solution: [
          `Step 1: Pipe A is an inlet pipe.`,
          `Step 2: Filling rate of Pipe A = 1/${a} tank/hour.`,
          `Step 3: Required work = ${fn}/${fd} of the tank.`,
          `Step 4: Time required = (${fn}/${fd}) ÷ (1/${a}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: frac,
          pipes: [{ type: "INLET", rate: rate(a) }],
          stages: [{ duration: null, netRate: rate(a) }],
        },
      });
    },
  },

  // 2. Single Outlet Pipe
  {
    id: "PC_P02_SINGLE_OUTLET",
    questionType: "SINGLE_OUTLET",
    examLevel: "PRELIMS",
    difficulty: "EASY",
    generate(rng, exam) {
      const b = rng.pick([10, 12, 15, 16, 20, 24, 30]);
      const [fn, fd] = rng.pick([[1, 2], [2, 3], [3, 4], [3, 5], [4, 5]]);
      const initFrac = R(fn, fd);
      const ans = initFrac.div(rate(b));
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Outlet Pipe B alone can empty a completely full tank in ${b} hours. If the tank is initially ${fn}/${fd} full, how long will Pipe B take to empty it completely?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [R(b), ONE.sub(initFrac).div(rate(b)), R(b).add(ans), ans.add(R(2))],
        solution: [
          `Step 1: Pipe B is an outlet pipe.`,
          `Step 2: Emptying rate of Pipe B = -1/${b} tank/hour.`,
          `Step 3: Water to be drained = ${fn}/${fd} of the tank.`,
          `Step 4: Time required = (${fn}/${fd}) ÷ (1/${b}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: initFrac,
          targetLevel: ZERO,
          pipes: [{ type: "OUTLET", rate: rate(b).neg() }],
          stages: [{ duration: null, netRate: rate(b).neg() }],
        },
      });
    },
  },

  // 3. Two Inlet Pipes Working Together
  {
    id: "PC_P03_TWO_INLETS_TOGETHER",
    questionType: "TWO_INLETS_TOGETHER",
    examLevel: "PRELIMS",
    difficulty: "EASY",
    generate(rng, exam) {
      const [a, b] = rng.pick([[10, 15], [12, 24], [15, 30], [20, 30], [18, 36], [12, 20], [15, 20], [24, 40]]);
      const net = rate(a).add(rate(b));
      const ans = ONE.div(net);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Two inlet pipes A and B can fill an empty tank alone in ${a} hours and ${b} hours respectively. If both pipes are opened together, how long will they take to fill the tank?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [R(a + b), R(Math.abs(a - b)), R(a + b, 2), ONE.div(rate(a).sub(rate(b)).abs())],
        solution: [
          `Step 1: Both Pipe A and Pipe B are inlet pipes.`,
          `Step 2: Individual rates: A = 1/${a}/hr, B = 1/${b}/hr.`,
          `Step 3: Combined filling rate = 1/${a} + 1/${b} = ${net.toFractionString()}/hr.`,
          `Step 4: Total time = 1 ÷ (${net.toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rate(a) }, { type: "INLET", rate: rate(b) }],
          stages: [{ duration: null, netRate: net }],
        },
      });
    },
  },

  // 4. Two Pipes Filling a Tank in Different Times
  {
    id: "PC_P04_TWO_PIPES_DIFF_TIMES",
    questionType: "TWO_PIPES_DIFF_TIMES",
    examLevel: "PRELIMS",
    difficulty: "EASY",
    generate(rng, exam) {
      const a = rng.pick([8, 10, 12, 14, 16, 18]);
      const diff = rng.pick([4, 6, 8, 12]);
      const b = a + diff;
      const net = rate(a).add(rate(b));
      const ans = ONE.div(net);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Pipe A fills a tank in ${a} hours, while Pipe B takes ${diff} hours more than Pipe A to fill the same tank. Working together, in how many hours will both pipes fill the tank?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [R(a + b), R(a + diff, 2), ONE.div(rate(a).add(rate(diff))), ans.add(R(2))],
        solution: [
          `Step 1: Pipe A takes ${a} hours; Pipe B takes ${a} + ${diff} = ${b} hours.`,
          `Step 2: Combined rate = 1/${a} + 1/${b} = ${net.toFractionString()}/hr.`,
          `Step 3: Time required = 1 ÷ (${net.toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rate(a) }, { type: "INLET", rate: rate(b) }],
          stages: [{ duration: null, netRate: net }],
        },
      });
    },
  },

  // 5. One Inlet and One Outlet Pipe
  {
    id: "PC_P05_ONE_INLET_ONE_OUTLET",
    questionType: "ONE_INLET_ONE_OUTLET",
    examLevel: "PRELIMS",
    difficulty: "EASY",
    generate(rng, exam) {
      const [a, b] = rng.pick([[10, 15], [12, 18], [12, 20], [15, 25], [16, 24], [18, 30], [20, 30], [8, 12]]);
      const net = rate(a).sub(rate(b));
      const ans = ONE.div(net);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Inlet Pipe A can fill a tank in ${a} hours, while Outlet Pipe B can empty the full tank in ${b} hours. If both pipes are opened simultaneously when the tank is empty, how long will it take to fill the tank?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [ONE.div(rate(a).add(rate(b))), R(b - a), R(a + b), ans.sub(R(4))],
        solution: [
          `Step 1: Pipe A is an inlet (+1/${a}/hr) and Pipe B is an outlet (-1/${b}/hr).`,
          `Step 2: Net filling rate = 1/${a} - 1/${b} = ${net.toFractionString()}/hr (positive, so tank fills).`,
          `Step 3: Total time = 1 ÷ (${net.toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rate(a) }, { type: "OUTLET", rate: rate(b).neg() }],
          stages: [{ duration: null, netRate: net }],
        },
      });
    },
  },

  // 6. Three Inlet Pipes Working Together
  {
    id: "PC_P06_THREE_INLETS",
    questionType: "THREE_INLETS_TOGETHER",
    examLevel: "PRELIMS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      const [a, b, c] = rng.pick([[10, 15, 30], [12, 15, 20], [12, 24, 24], [15, 20, 30], [10, 20, 60], [18, 24, 36]]);
      const net = rate(a).add(rate(b)).add(rate(c));
      const ans = ONE.div(net);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Three inlet pipes A, B, and C can fill a cistern individually in ${a} hours, ${b} hours, and ${c} hours respectively. How long will it take to fill the empty cistern if all three pipes are opened together?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [ONE.div(rate(a).add(rate(b))), R(a + b + c, 3), ans.add(R(2)), ans.add(R(4))],
        solution: [
          `Step 1: All three pipes A, B, and C are inlets.`,
          `Step 2: Individual rates: 1/${a}, 1/${b}, 1/${c} tank/hour.`,
          `Step 3: Combined rate = 1/${a} + 1/${b} + 1/${c} = ${net.toFractionString()}/hr.`,
          `Step 4: Total time = 1 ÷ (${net.toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [
            { type: "INLET", rate: rate(a) },
            { type: "INLET", rate: rate(b) },
            { type: "INLET", rate: rate(c) },
          ],
          stages: [{ duration: null, netRate: net }],
        },
      });
    },
  },

  // 7. Two Inlet Pipes and One Outlet Pipe
  {
    id: "PC_P07_TWO_INLETS_ONE_OUTLET",
    questionType: "TWO_INLETS_ONE_OUTLET",
    examLevel: "PRELIMS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      const [a, b, c] = rng.pick([[12, 15, 20], [15, 20, 30], [20, 30, 60], [24, 30, 40], [10, 12, 15], [10, 15, 30]]);
      const net = rate(a).add(rate(b)).sub(rate(c));
      const ans = ONE.div(net);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Inlet Pipe A can fill a tank in ${a} hours and Inlet Pipe B can fill it in ${b} hours, while Outlet Pipe C can empty the full tank in ${c} hours. If all three pipes are opened together, in how many hours will the empty tank be filled?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [
          ONE.div(rate(a).add(rate(b))),
          ONE.div(rate(a).add(rate(b)).add(rate(c))),
          ans.add(R(2)),
          ans.sub(R(2)),
        ],
        solution: [
          `Step 1: Pipes A and B are inlets; Pipe C is an outlet.`,
          `Step 2: Individual rates: A = +1/${a}, B = +1/${b}, C = -1/${c} tank/hour.`,
          `Step 3: Net filling rate = 1/${a} + 1/${b} - 1/${c} = ${net.toFractionString()}/hr.`,
          `Step 4: Total time = 1 ÷ (${net.toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
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

  // 8. Pipes Opened Simultaneously (with initial check)
  {
    id: "PC_P08_PIPES_SIMULTANEOUS",
    questionType: "PIPES_SIMULTANEOUS",
    examLevel: "PRELIMS",
    difficulty: "EASY",
    generate(rng, exam) {
      const [a, b, c] = rng.pick([[12, 18, 36], [10, 20, 30], [15, 25, 75], [16, 24, 48]]);
      const net = rate(a).add(rate(b)).sub(rate(c));
      const ans = ONE.div(net);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Three pipes A, B, and C are connected to an empty cistern. Pipes A and B can fill it in ${a} hours and ${b} hours respectively, while Pipe C can drain it in ${c} hours. If all three are opened simultaneously at 9:00 AM, how many hours will it take to fill the cistern?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [ONE.div(rate(a).add(rate(b))), ONE.div(rate(a).add(rate(b)).add(rate(c))), ans.add(R(3)), ans.sub(R(1))],
        solution: [
          `Step 1: Inlets A (+1/${a}) and B (+1/${b}); Outlet C (-1/${c}).`,
          `Step 2: Combined net rate = 1/${a} + 1/${b} - 1/${c} = ${net.toFractionString()}/hr.`,
          `Step 3: Total time = 1 ÷ (${net.toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
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

  // 9. Pipes Opened at Different Time Intervals
  {
    id: "PC_P09_DIFF_TIME_INTERVALS",
    questionType: "PIPES_DIFF_INTERVALS",
    examLevel: "PRELIMS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      const [a, b, t1] = rng.pick([[12, 18, 4], [15, 20, 5], [16, 24, 4], [18, 36, 6], [20, 30, 5]]);
      const work1 = rate(a).mul(R(t1));
      const rem = ONE.sub(work1);
      const net = rate(a).add(rate(b));
      const t2 = rem.div(net);
      const totalTime = R(t1).add(t2);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Pipe A can fill a tank in ${a} hours and Pipe B can fill it in ${b} hours. Pipe A is opened first, and after ${t1} hours Pipe B is also opened. Find the total time taken from the start to fill the tank completely.`,
        exactRationalAnswer: totalTime,
        plausibleDistractors: [t2, ONE.div(net), R(t1).add(ONE.div(net)), totalTime.add(R(2))],
        solution: [
          `Step 1: Both A and B are inlets (A = 1/${a}/hr, B = 1/${b}/hr).`,
          `Step 2: Work done by A alone in ${t1} hours = ${t1}/${a} = ${work1.toFractionString()}.`,
          `Step 3: Remaining capacity = 1 - ${work1.toFractionString()} = ${rem.toFractionString()}.`,
          `Step 4: Combined rate of A + B = ${net.toFractionString()}/hr ⇒ Remaining time = ${t2.toExamString()} hours.`,
          `Step 5: Total time = ${t1} + ${t2.toExamString()} = ${totalTime.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rate(a) }, { type: "INLET", rate: rate(b) }],
          stages: [
            { duration: R(t1), netRate: rate(a) },
            { duration: null, netRate: net },
          ],
        },
      });
    },
  },

  // 10. One Pipe Opened After Another Pipe (Find remaining time after 2nd opens)
  {
    id: "PC_P10_ONE_AFTER_ANOTHER",
    questionType: "ONE_PIPE_AFTER_ANOTHER",
    examLevel: "PRELIMS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      const [a, b, t1] = rng.pick([[12, 24, 3], [15, 30, 5], [20, 30, 6], [10, 15, 2], [18, 27, 6]]);
      const work1 = rate(a).mul(R(t1));
      const rem = ONE.sub(work1);
      const net = rate(a).add(rate(b));
      const remTime = rem.div(net);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Inlet Pipe A can fill a tank in ${a} hours and Inlet Pipe B in ${b} hours. Pipe A is opened for ${t1} hours and then Pipe B is opened alongside Pipe A. How many MORE hours will it take for the tank to be completely filled?`,
        exactRationalAnswer: remTime,
        plausibleDistractors: [R(t1).add(remTime), ONE.div(net), rem.div(rate(b)), remTime.add(R(1))],
        solution: [
          `Step 1: Work completed by A in ${t1} hours = ${work1.toFractionString()}.`,
          `Step 2: Remaining capacity = ${rem.toFractionString()}.`,
          `Step 3: Combined rate = ${net.toFractionString()}/hr.`,
          `Step 4: Additional time required = (${rem.toFractionString()}) ÷ (${net.toFractionString()}) = ${remTime.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: work1,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rate(a) }, { type: "INLET", rate: rate(b) }],
          stages: [{ duration: null, netRate: net }],
          extraKey: `after_${t1}`,
        },
      });
    },
  },

  // 11. One Pipe Closed Before the Tank Is Full
  {
    id: "PC_P11_CLOSED_BEFORE_FULL",
    questionType: "ONE_PIPE_CLOSED_BEFORE_FULL",
    examLevel: "PRELIMS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      const [a, b, tTogether] = rng.pick([[12, 18, 4], [15, 25, 5], [20, 30, 6], [16, 24, 4], [10, 20, 4]]);
      const netAB = rate(a).add(rate(b));
      const work1 = netAB.mul(R(tTogether));
      const rem = ONE.sub(work1);
      const tBAlone = rem.div(rate(b));
      const totalTime = R(tTogether).add(tBAlone);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Pipes A and B can fill a tank in ${a} hours and ${b} hours respectively. Both pipes are opened together, but Pipe A is closed after ${tTogether} hours and Pipe B fills the remaining tank alone. Find the total time taken to fill the tank.`,
        exactRationalAnswer: totalTime,
        plausibleDistractors: [tBAlone, ONE.div(netAB), R(tTogether).add(rem.div(rate(a))), totalTime.add(R(2))],
        solution: [
          `Step 1: Combined rate of A + B = 1/${a} + 1/${b} = ${netAB.toFractionString()}/hr.`,
          `Step 2: Work done in ${tTogether} hours = ${work1.toFractionString()}; Remaining = ${rem.toFractionString()}.`,
          `Step 3: Pipe B alone finishes remaining work in (${rem.toFractionString()}) ÷ (1/${b}) = ${tBAlone.toExamString()} hours.`,
          `Step 4: Total time = ${tTogether} + ${tBAlone.toExamString()} = ${totalTime.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rate(a) }, { type: "INLET", rate: rate(b) }],
          stages: [
            { duration: R(tTogether), netRate: netAB },
            { duration: null, netRate: rate(b) },
          ],
        },
      });
    },
  },

  // 12. Finding Individual Pipe Time
  {
    id: "PC_P12_FIND_INDIVIDUAL_TIME",
    questionType: "FIND_INDIVIDUAL_PIPE_TIME",
    examLevel: "PRELIMS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      const [a, b, comb] = rng.pick([[12, 24, 8], [10, 15, 6], [20, 30, 12], [15, 30, 10], [18, 36, 12]]);
      const ans = R(b);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Two inlet pipes A and B working together can fill a tank in ${comb} hours. If Pipe A alone can fill the tank in ${a} hours, how long will Pipe B alone take to fill it?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [R(a + comb), R(a - comb), ONE.div(rate(comb).add(rate(a))), ans.add(R(4))],
        solution: [
          `Step 1: Combined rate (A + B) = 1/${comb}/hr; Rate of A = 1/${a}/hr.`,
          `Step 2: Rate of B = 1/${comb} - 1/${a} = 1/${b}/hr.`,
          `Step 3: Time for Pipe B alone = ${b} hours.`,
        ],
        mathModel: {
          queryType: "UNKNOWN_PIPE_TIME",
          initialLevel: ZERO,
          targetLevel: ONE,
          knownNetRate: rate(a),
          observedNetRate: rate(comb),
          unknownSign: 1n,
          pipes: [{ type: "INLET", rate: rate(a) }],
          extraKey: `find_ind_${a}_${comb}`,
        },
      });
    },
  },

  // 13. Finding Combined Filling Time (with rate expressed via fraction)
  {
    id: "PC_P13_FIND_COMBINED_TIME",
    questionType: "FIND_COMBINED_FILLING_TIME",
    examLevel: "PRELIMS",
    difficulty: "EASY",
    generate(rng, exam) {
      const a = rng.pick([12, 16, 20, 24]);
      const b = rng.pick([15, 18, 24, 30]);
      const net = rate(a).add(rate(b));
      const ans = ONE.div(net);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Pipe A fills 1/2 of a tank in ${a / 2} hours, and Pipe B fills 1/3 of the same tank in ${b / 3} hours. How long will both pipes take together to fill the entire empty tank?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [ONE.div(rate(a / 2).add(rate(b / 3))), R(a + b, 2), ans.add(R(2)), ans.sub(R(1))],
        solution: [
          `Step 1: Full time of A = 2 × ${a / 2} = ${a} hours; Full time of B = 3 × ${b / 3} = ${b} hours.`,
          `Step 2: Combined rate = 1/${a} + 1/${b} = ${net.toFractionString()}/hr.`,
          `Step 3: Combined filling time = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rate(a) }, { type: "INLET", rate: rate(b) }],
          stages: [{ duration: null, netRate: net }],
        },
      });
    },
  },

  // 14. Finding Remaining Work
  {
    id: "PC_P14_REMAINING_WORK",
    questionType: "FIND_REMAINING_WORK",
    examLevel: "PRELIMS",
    difficulty: "EASY",
    generate(rng, exam) {
      const [a, b, t] = rng.pick([[12, 18, 4], [15, 20, 4], [16, 24, 5], [10, 15, 3], [20, 30, 6]]);
      const filled = rate(a).add(rate(b)).mul(R(t));
      const rem = ONE.sub(filled);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Pipes A and B can fill a tank in ${a} hours and ${b} hours respectively. If both pipes are opened together for ${t} hours, what fraction of the tank remains empty?`,
        exactRationalAnswer: rem,
        plausibleDistractors: [filled, rate(a).mul(R(t)), ONE.sub(rate(a).mul(R(t))), rem.add(R(1, 12))],
        unit: "",
        preferMixed: false,
        maxFraction: true,
        solution: [
          `Step 1: Combined rate = 1/${a} + 1/${b} = ${rate(a).add(rate(b)).toFractionString()}/hr.`,
          `Step 2: Fraction filled in ${t} hours = ${filled.toFractionString()}.`,
          `Step 3: Remaining empty fraction = 1 - ${filled.toFractionString()} = ${rem.toFractionString()}.`,
        ],
        mathModel: {
          queryType: "REMAINING_WORK",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rate(a) }, { type: "INLET", rate: rate(b) }],
          stages: [{ duration: R(t), netRate: rate(a).add(rate(b)) }],
        },
      });
    },
  },

  // 15. Partial Tank Filling
  {
    id: "PC_P15_PARTIAL_FILLING",
    questionType: "PARTIAL_TANK_FILLING",
    examLevel: "PRELIMS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      const [a, b] = rng.pick([[12, 24], [15, 30], [10, 15], [20, 30], [18, 36]]);
      const [fn, fd] = rng.pick([[2, 3], [3, 4], [4, 5], [5, 6]]);
      const target = R(fn, fd);
      const net = rate(a).add(rate(b));
      const ans = target.div(net);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Inlet pipes A and B can fill a full tank in ${a} hours and ${b} hours respectively. How long will they take working together to fill ${fn}/${fd} of the tank?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [ONE.div(net), ONE.sub(target).div(net), ans.add(R(2)), ans.add(R(3))],
        solution: [
          `Step 1: Combined filling rate = 1/${a} + 1/${b} = ${net.toFractionString()}/hr.`,
          `Step 2: Required capacity = ${fn}/${fd}.`,
          `Step 3: Time required = (${fn}/${fd}) ÷ (${net.toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: target,
          pipes: [{ type: "INLET", rate: rate(a) }, { type: "INLET", rate: rate(b) }],
          stages: [{ duration: null, netRate: net }],
        },
      });
    },
  },

  // 16. Fraction of Tank Filled in a Given Time
  {
    id: "PC_P16_FRACTION_FILLED",
    questionType: "FRACTION_FILLED_IN_TIME",
    examLevel: "PRELIMS",
    difficulty: "EASY",
    generate(rng, exam) {
      const [a, b, t] = rng.pick([[12, 24, 4], [15, 30, 5], [10, 20, 4], [16, 24, 6], [18, 36, 6]]);
      const net = rate(a).add(rate(b));
      const filled = net.mul(R(t));
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Pipes A and B can fill a tank alone in ${a} hours and ${b} hours respectively. What fraction of the tank will be filled if both pipes are opened together for ${t} hours?`,
        exactRationalAnswer: filled,
        plausibleDistractors: [ONE.sub(filled), rate(a).mul(R(t)), rate(b).mul(R(t)), filled.add(R(1, 12))],
        unit: "",
        preferMixed: false,
        maxFraction: true,
        solution: [
          `Step 1: Combined filling rate = 1/${a} + 1/${b} = ${net.toFractionString()}/hr.`,
          `Step 2: Fraction filled in ${t} hours = ${t} × (${net.toFractionString()}) = ${filled.toFractionString()}.`,
        ],
        mathModel: {
          queryType: "FRACTION_FILLED",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rate(a) }, { type: "INLET", rate: rate(b) }],
          stages: [{ duration: R(t), netRate: net }],
        },
      });
    },
  },

  // 17. Pipe Efficiency Comparison
  {
    id: "PC_P17_EFFICIENCY_COMPARISON",
    questionType: "PIPE_EFFICIENCY_COMPARISON",
    examLevel: "PRELIMS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      const mult = rng.pick([2, 3]);
      const fastTime = rng.pick([6, 8, 9, 10, 12, 15]);
      const slowTime = fastTime * mult;
      const net = rate(fastTime).add(rate(slowTime));
      const ans = ONE.div(net);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Pipe A is ${mult} times as fast as Pipe B. If Pipe A alone can fill a tank in ${fastTime} hours, how long will both pipes take to fill the tank together?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [R(slowTime), R(fastTime + slowTime, 2), ONE.div(rate(fastTime).sub(rate(slowTime))), ans.add(R(2))],
        solution: [
          `Step 1: Since A is ${mult} times faster than B, Pipe B takes ${mult} × ${fastTime} = ${slowTime} hours alone.`,
          `Step 2: Combined rate = 1/${fastTime} + 1/${slowTime} = ${net.toFractionString()}/hr.`,
          `Step 3: Combined filling time = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [{ type: "INLET", rate: rate(fastTime) }, { type: "INLET", rate: rate(slowTime) }],
          stages: [{ duration: null, netRate: net }],
        },
      });
    },
  },

  // 18. Tank Filling with Equal and Unequal Efficiencies
  {
    id: "PC_P18_EQUAL_UNEQUAL_EFF",
    questionType: "EQUAL_UNEQUAL_EFFICIENCIES",
    examLevel: "PRELIMS",
    difficulty: "MODERATE",
    generate(rng, exam) {
      const equalTime = rng.pick([18, 24, 30, 36]);
      const thirdTime = rng.pick([12, 15, 18, 20]);
      const net = rate(equalTime).add(rate(equalTime)).add(rate(thirdTime));
      const ans = ONE.div(net);
      return assembleTemplateOutput({
        templateId: this.id, questionType: this.questionType, difficulty: this.difficulty, exam, rng,
        question: `Two identical inlet pipes A and B can each fill a tank in ${equalTime} hours, while a third inlet pipe C can fill it in ${thirdTime} hours. How long will all three pipes take together to fill the tank?`,
        exactRationalAnswer: ans,
        plausibleDistractors: [
          ONE.div(rate(equalTime).add(rate(thirdTime))),
          R(equalTime, 2),
          ans.add(R(2)),
          ans.add(R(3)),
        ],
        solution: [
          `Step 1: Rates: A = 1/${equalTime}, B = 1/${equalTime}, C = 1/${thirdTime} tank/hr.`,
          `Step 2: Combined rate = 2/${equalTime} + 1/${thirdTime} = ${net.toFractionString()}/hr.`,
          `Step 3: Total filling time = 1 ÷ (${net.toFractionString()}) = ${ans.toExamString()} hours.`,
        ],
        mathModel: {
          queryType: "TIME_TO_TARGET_STAGES",
          initialLevel: ZERO,
          targetLevel: ONE,
          pipes: [
            { type: "INLET", rate: rate(equalTime) },
            { type: "INLET", rate: rate(equalTime) },
            { type: "INLET", rate: rate(thirdTime) },
          ],
          stages: [{ duration: null, netRate: net }],
        },
      });
    },
  },
];