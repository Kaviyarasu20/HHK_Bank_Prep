/**
 * GA Marathon Result Analysis & Answer-Release Policy Service.
 * - Enforces configured answer-release policies (immediate, scheduled, after_end, never).
 * - Never leaks correct answers or explanations before the permitted release point.
 * - Computes topic-wise, category/domain-wise, and difficulty-wise breakdowns
 *   directly from persisted immutable `student_answers.question_snapshot` rows.
 * - Produces deterministic, factual improvement recommendations linked to Phase 4-8 modules.
 */

export function canReleaseAnswers({
  policy = "immediate",
  answerReleaseAt = null,
  availabilityEnd = null,
  attemptStatus = "submitted",
  now = new Date(),
} = {}) {
  if (attemptStatus === "in_progress") {
    return { allowed: false, reason: "Answers are locked until you submit the test." };
  }
  if (policy === "never") {
    return { allowed: false, reason: "Answer review is disabled for this test." };
  }
  if (policy === "scheduled") {
    const releaseDate = answerReleaseAt ? new Date(answerReleaseAt) : null;
    if (!releaseDate || releaseDate > now) {
      return {
        allowed: false,
        reason: releaseDate
          ? `Answers and explanations will be released at ${releaseDate.toISOString()}.`
          : "Answers are scheduled for later release.",
      };
    }
    return { allowed: true, reason: null };
  }
  if (policy === "after_end") {
    const endDate = availabilityEnd ? new Date(availabilityEnd) : null;
    if (endDate && endDate > now) {
      return {
        allowed: false,
        reason: `Answers will be released after the test window closes (${endDate.toISOString()}).`,
      };
    }
    return { allowed: true, reason: null };
  }
  return { allowed: true, reason: null };
}

export function buildGaResultAnalysis({ attempt, answers = [], releasePolicy = {}, now = new Date() } = {}) {
  const release = canReleaseAnswers({
    policy: releasePolicy.policy || "immediate",
    answerReleaseAt: releasePolicy.answerReleaseAt || null,
    availabilityEnd: releasePolicy.availabilityEnd || null,
    attemptStatus: attempt?.status || "submitted",
    now,
  });

  const topicMap = new Map();
  const domainMap = new Map();
  const diffMap = new Map();

  let totalNegativeMarks = 0;
  const reviewItems = [];

  for (const row of answers) {
    const snap = row.question_snapshot || {};
    const topic = String(snap.topic_name || row.topic || "General Awareness").trim();
    const domain = String(row.ga_domain || "current_affairs").trim();
    const difficulty = String(snap.difficulty || "Moderate").trim();
    const selected = row.selected_answer || null;
    const correct = snap.correct_answer || null;
    const marks = Number(snap.marks ?? 1);
    const neg = Number(snap.negative_marks ?? 0);
    const timeSec = Number(row.time_spent_seconds ?? 0);

    const isAnswered = Boolean(selected);
    const isCorrect = isAnswered && selected === correct;
    const isWrong = isAnswered && selected !== correct;
    if (isWrong) totalNegativeMarks += neg;

    const bump = (map, key) => {
      const cur = map.get(key) || { name: key, total: 0, attempted: 0, correct: 0, incorrect: 0, timeSeconds: 0 };
      cur.total += 1;
      cur.timeSeconds += timeSec;
      if (isAnswered) cur.attempted += 1;
      if (isCorrect) cur.correct += 1;
      if (isWrong) cur.incorrect += 1;
      map.set(key, cur);
    };

    bump(topicMap, topic);
    bump(domainMap, domain);
    bump(diffMap, difficulty);

    reviewItems.push({
      questionId: row.question_id,
      questionText: snap.question_text || "",
      options: snap.options || [],
      selectedAnswer: selected,
      topic,
      domain,
      difficulty,
      timeSpentSeconds: timeSec,
      marks,
      negativeMarks: neg,
      // Strict answer security: redact correctAnswer, isCorrect & explanation if release is not allowed
      correctAnswer: release.allowed ? correct : null,
      isCorrect: release.allowed ? isCorrect : null,
      explanation: release.allowed ? snap.explanation || null : null,
      sourceArticleId: release.allowed ? row.source_article_id || null : null,
      sourceArticleTitle: release.allowed ? row.source_article_title || null : null,
      sourceReferenceType: release.allowed ? row.source_reference_type || null : null,
      sourceReferenceId: release.allowed ? row.source_reference_id || null : null,
    });
  }

  const finalize = (map) =>
    Array.from(map.values()).map((item) => ({
      ...item,
      accuracyPercent: item.attempted > 0 ? Number(((item.correct / item.attempted) * 100).toFixed(2)) : 0,
    }));

  const topicBreakdown = finalize(topicMap).sort((a, b) => a.accuracyPercent - b.accuracyPercent);
  const categoryBreakdown = finalize(domainMap);
  const difficultyBreakdown = finalize(diffMap);

  const weakTopics = topicBreakdown.filter((t) => t.incorrect > 0 && t.accuracyPercent < 65);
  const recommendations = weakTopics.slice(0, 5).map((wt) => ({
    topic: wt.name,
    reason: `${wt.incorrect} incorrect out of ${wt.attempted} attempted (${wt.accuracyPercent}% accuracy).`,
    suggestedAction: "Revise related One-Liners, Flashcards, and Smart Revision items for this topic.",
  }));

  const attempted = Number(attempt?.correct_count ?? 0) + Number(attempt?.wrong_count ?? 0);
  const accuracyPercent =
    attempted > 0 ? Number(((Number(attempt?.correct_count ?? 0) / attempted) * 100).toFixed(2)) : 0;

  return {
    summary: {
      attemptId: attempt?.id,
      mockTestId: attempt?.mock_test_id,
      testName: attempt?.test_name || "",
      status: attempt?.status || "submitted",
      startedAt: attempt?.started_at || null,
      submittedAt: attempt?.submitted_at || null,
      totalQuestions: answers.length,
      attempted,
      correct: Number(attempt?.correct_count ?? 0),
      incorrect: Number(attempt?.wrong_count ?? 0),
      unanswered: Number(attempt?.unanswered_count ?? 0),
      score: Number(attempt?.score ?? 0),
      maxScore: Number(attempt?.max_score ?? 0),
      negativeMarksDeducted: Number(totalNegativeMarks.toFixed(2)),
      accuracyPercent,
      elapsedSeconds: Number(attempt?.elapsed_seconds ?? 0),
    },
    answerRelease: release,
    topicBreakdown,
    categoryBreakdown,
    difficultyBreakdown,
    recommendations,
    review: reviewItems,
  };
}
