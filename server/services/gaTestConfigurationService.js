/**
 * GA Marathon Test Configuration & Validation Service.
 * - Defines supported GA Marathon categories and banking target exams.
 * - Validates test duration, question counts, marks, negative marking,
 *   availability windows, attempt limits, and answer-release policies.
 * - Never invents official exam patterns; defaults to HHK practice test
 *   (isOfficialPattern = false) unless explicitly mapped to a verified pattern.
 */

export const GA_MARATHON_CATEGORIES = [
  { code: "daily_ga", label: "Daily GA Practice" },
  { code: "weekly_marathon", label: "Weekly GA Marathon" },
  { code: "monthly_marathon", label: "Monthly GA Marathon" },
  { code: "monthly_capsule_test", label: "Monthly Capsule Tests" },
  { code: "banking_awareness", label: "Banking Awareness Tests" },
  { code: "current_affairs", label: "Current Affairs Tests" },
  { code: "static_banking_gk", label: "Static Banking GK Tests" },
  { code: "exam_wise_ga", label: "Exam-Wise GA Tests" },
  { code: "full_length_ga", label: "Full-Length GA Mock Tests" },
  { code: "previous_month_revision", label: "Previous Month Revision Tests" },
];

export const GA_SUPPORTED_EXAMS = [
  "IBPS PO",
  "IBPS Clerk",
  "SBI PO",
  "SBI Clerk",
  "IBPS RRB PO",
  "IBPS RRB Office Assistant",
  "RBI Grade B",
  "NABARD Grade A",
];

export const ANSWER_RELEASE_POLICIES = ["immediate", "scheduled", "after_end", "never"];
export const ACCESS_TYPES = ["FREE", "PAID", "SUBSCRIPTION_ONLY", "PROMOTIONAL"];

const CATEGORY_SET = new Set(GA_MARATHON_CATEGORIES.map((c) => c.code));
const EXAM_SET = new Set(GA_SUPPORTED_EXAMS);

export function validateGaTestConfig(input = {}) {
  const errors = [];

  const title = String(input.title || input.name || "").trim();
  if (title.length < 4 || title.length > 200) {
    errors.push("Test title must be between 4 and 200 characters.");
  }

  const gaCategory = String(input.gaCategory || input.ga_category || "").trim();
  if (!CATEGORY_SET.has(gaCategory)) {
    errors.push(`Invalid GA category "${gaCategory}".`);
  }

  const targetExams = Array.isArray(input.targetExams ?? input.target_exams)
    ? [...new Set((input.targetExams ?? input.target_exams).map((e) => String(e).trim()).filter(Boolean))]
    : [];
  for (const ex of targetExams) {
    if (!EXAM_SET.has(ex)) {
      errors.push(`Unsupported target examination "${ex}".`);
    }
  }

  const questionCount = Number(input.questionCount ?? input.target_questions);
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 200) {
    errors.push("Question count must be an integer between 1 and 200.");
  }

  const durationMinutes = Number(input.durationMinutes ?? (input.duration_seconds ? input.duration_seconds / 60 : 0));
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 240) {
    errors.push("Duration must be between 1 and 240 minutes.");
  }

  const marksPerQuestion = Number(input.marksPerQuestion ?? input.marks_per_question ?? 1);
  if (!Number.isFinite(marksPerQuestion) || marksPerQuestion <= 0 || marksPerQuestion > 10) {
    errors.push("Marks per question must be greater than 0 and at most 10.");
  }

  const negativeMarks = Number(input.negativeMarks ?? input.negative_marks ?? 0.25);
  if (!Number.isFinite(negativeMarks) || negativeMarks < 0 || negativeMarks > marksPerQuestion) {
    errors.push("Negative marking must be between 0 and marksPerQuestion.");
  }

  const attemptLimit =
    input.attemptLimit === undefined || input.attemptLimit === null || input.attemptLimit === ""
      ? null
      : Number(input.attemptLimit);
  if (attemptLimit !== null && (!Number.isInteger(attemptLimit) || attemptLimit < 1 || attemptLimit > 100)) {
    errors.push("Attempt limit must be an integer between 1 and 100, or empty for unlimited.");
  }

  const accessType = String(input.accessType || input.access_type || "FREE").toUpperCase();
  if (!ACCESS_TYPES.includes(accessType)) {
    errors.push(`Unsupported accessType "${accessType}".`);
  }

  const pricePaise = Number(input.pricePaise ?? input.price_paise ?? 0);
  if (!Number.isInteger(pricePaise) || pricePaise < 0) {
    errors.push("pricePaise must be a non-negative integer.");
  }
  if (accessType === "PAID" && pricePaise <= 0) {
    errors.push("Paid tests require a positive pricePaise value.");
  }

  const answerReleasePolicy = String(input.answerReleasePolicy || input.answer_release_policy || "immediate");
  if (!ANSWER_RELEASE_POLICIES.includes(answerReleasePolicy)) {
    errors.push(`Unsupported answerReleasePolicy "${answerReleasePolicy}".`);
  }
  if (answerReleasePolicy === "scheduled" && !input.answerReleaseAt && !input.answer_release_at) {
    errors.push("Scheduled answer release policy requires answerReleaseAt timestamp.");
  }

  if (input.availabilityStart && input.availabilityEnd) {
    const start = new Date(input.availabilityStart);
    const end = new Date(input.availabilityEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      errors.push("availabilityEnd must be later than availabilityStart.");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    normalized: {
      title,
      description: String(input.description || "").trim(),
      gaCategory,
      targetExams,
      isOfficialPattern: Boolean(input.isOfficialPattern ?? false),
      questionCount,
      durationSeconds: Math.round(durationMinutes * 60),
      marksPerQuestion,
      negativeMarks,
      maxMarks: Number((questionCount * marksPerQuestion).toFixed(2)),
      attemptLimit,
      accessType,
      pricePaise: accessType === "FREE" ? 0 : pricePaise,
      randomizeQuestions: Boolean(input.randomizeQuestions ?? false),
      randomizeOptions: Boolean(input.randomizeOptions ?? false),
      answerReleasePolicy,
      answerReleaseAt: input.answerReleaseAt || input.answer_release_at || null,
      availabilityStart: input.availabilityStart || null,
      availabilityEnd: input.availabilityEnd || null,
      capsuleId: input.capsuleId || null,
      difficultyLabel: String(input.difficultyLabel || "Moderate").trim(),
      topicDistribution: input.topicDistribution && typeof input.topicDistribution === "object" ? input.topicDistribution : {},
      difficultyDistribution:
        input.difficultyDistribution && typeof input.difficultyDistribution === "object" ? input.difficultyDistribution : {},
      selectionFilters: input.selectionFilters && typeof input.selectionFilters === "object" ? input.selectionFilters : {},
    },
  };
}
