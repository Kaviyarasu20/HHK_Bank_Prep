import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Flag,
  Landmark,
  Play,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { caPracticeStudentApi } from "../../api/caPlatform";
import { BankingAwarenessDashboard } from "./BankingAwarenessDashboard";

const STUDENT_TABS = [
  { id: "daily", label: "Daily Practice", icon: Calendar },
  { id: "weekly", label: "Weekly Practice", icon: BookOpen },
  { id: "monthly", label: "Monthly Practice", icon: Award },
  { id: "performance", label: "My Performance", icon: Activity },
  { id: "revision", label: "Revision", icon: RotateCcw },
  { id: "pdfs", label: "Downloaded PDFs", icon: FileText },
  { id: "banking_hub", label: "Banking Reference Hub", icon: Landmark },
];

const PDF_OPTIONS = [
  { format: "questions_only", label: "Questions Only" },
  { format: "answer_key", label: "With Answer Key" },
  { format: "detailed_solutions", label: "Detailed Solutions" },
  { format: "complete_booklet", label: "Complete Booklet" },
];

function formatClock(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export function StudentCaPractice({ onToast }) {
  const [tab, setTab] = useState("daily");
  const [sets, setSets] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [revisionQuestions, setRevisionQuestions] = useState([]);
  const [revisionAnswers, setRevisionAnswers] = useState({});
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfBusyKey, setPdfBusyKey] = useState("");

  // Active CBT Practice Session
  const [activeSession, setActiveSession] = useState(null); // { attempt, practiceSet, questions }
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedReview, setMarkedReview] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAtRef = useRef(null);

  // Completed Result & Detailed Solutions View
  const [resultData, setResultData] = useState(null);

  const notify = (msg, type = "success") => {
    if (type === "error") setError(msg);
    onToast?.(msg, type);
  };

  async function loadTab(targetTab = tab) {
    if (targetTab === "banking_hub") return;
    setLoading(true);
    setError("");
    try {
      if (["daily", "weekly", "monthly"].includes(targetTab)) {
        const res = await caPracticeStudentApi.listSets(targetTab);
        setSets(res.sets || []);
      } else if (targetTab === "performance") {
        const res = await caPracticeStudentApi.getPerformance();
        setPerformance(res);
      } else if (targetTab === "revision") {
        const res = await caPracticeStudentApi.getRevisionQuestions();
        setRevisionQuestions(res.questions || []);
      } else if (targetTab === "pdfs") {
        const res = await caPracticeStudentApi.getDownloadedPdfs();
        setDownloads(res.downloads || []);
      }
    } catch (err) {
      setError(err.message || "Could not load Current Affairs practice data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTab(tab);
  }, [tab]);

  // Countdown timer for active CBT test
  useEffect(() => {
    if (!activeSession || secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [activeSession, secondsLeft]);

  useEffect(() => {
    if (activeSession && secondsLeft === 0 && startedAtRef.current && !submitting) {
      handleSubmitAttempt(true);
    }
  }, [secondsLeft]);

  async function handleStartSet(setId) {
    setError("");
    setLoading(true);
    try {
      const res = await caPracticeStudentApi.startAttempt(setId);
      setActiveSession(res);
      setResultData(null);
      setQIndex(0);
      setAnswers({});
      setMarkedReview({});
      setConfirmSubmit(false);
      startedAtRef.current = Date.now();
      setSecondsLeft(Math.max(60, (res.practiceSet?.duration_minutes || 15) * 60));
    } catch (err) {
      notify(err.message || "Could not start practice set.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenResult(attemptId) {
    setError("");
    setLoading(true);
    try {
      const res = await caPracticeStudentApi.getAttemptResult(attemptId);
      setActiveSession(null);
      setResultData(res);
    } catch (err) {
      notify(err.message || "Could not load detailed solutions.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectAnswer(questionId, optionLabel) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionLabel }));
    if (activeSession?.attempt?.id) {
      caPracticeStudentApi
        .saveAnswer(activeSession.attempt.id, {
          questionId,
          selectedAnswer: optionLabel,
        })
        .catch(() => {});
    }
  }

  async function handleClearResponse(questionId) {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    if (activeSession?.attempt?.id) {
      caPracticeStudentApi
        .saveAnswer(activeSession.attempt.id, {
          questionId,
          selectedAnswer: null,
        })
        .catch(() => {});
    }
  }

  async function handleToggleReview(questionId) {
    const nextVal = !markedReview[questionId];
    setMarkedReview((prev) => ({ ...prev, [questionId]: nextVal }));
    if (activeSession?.attempt?.id) {
      caPracticeStudentApi
        .saveAnswer(activeSession.attempt.id, {
          questionId,
          isMarkedReview: nextVal,
        })
        .catch(() => {});
    }
  }

  async function handleSubmitAttempt(autoSubmitted = false) {
    if (!activeSession || submitting) return;
    setSubmitting(true);
    const timeTakenSec = startedAtRef.current
      ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
      : 0;
    try {
      await caPracticeStudentApi.submitAttempt(activeSession.attempt.id, {
        autoSubmitted,
        timeTakenSec,
        answers,
      });
      const result = await caPracticeStudentApi.getAttemptResult(activeSession.attempt.id);
      setActiveSession(null);
      setConfirmSubmit(false);
      setResultData(result);
      window.dispatchEvent(new Event("hhk:activity-updated"));
      notify(autoSubmitted ? "Time up! Practice set auto-submitted." : "Practice set submitted.");
    } catch (err) {
      notify(err.message || "Submission failed.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadPdf(setId, format) {
    const key = `${setId}:${format}`;
    setPdfBusyKey(key);
    setError("");
    try {
      const res = await caPracticeStudentApi.downloadPdf(setId, format);
      notify(`Downloaded ${res.fileName}`);
    } catch (err) {
      notify(err.message || "PDF download failed.", "error");
    } finally {
      setPdfBusyKey("");
    }
  }

  // ============================================================================
  // ACTIVE CBT PRACTICE INTERFACE (Phase 7)
  // ============================================================================
  if (activeSession) {
    const { practiceSet, questions } = activeSession;
    const currentQ = questions[qIndex];
    const selected = currentQ ? answers[currentQ.id] : null;
    const answeredCount = Object.keys(answers).length;
    const reviewCount = Object.values(markedReview).filter(Boolean).length;

    return (
      <section className="panel ca-automcq-runner">
        <div className="ca-automcq-runner-top">
          <div>
            <div className="eyebrow">HHK CURRENT AFFAIRS PRACTICE · LIVE TEST</div>
            <h2 style={{ margin: "4px 0 0" }}>{practiceSet.title}</h2>
            <small style={{ color: "#64748b" }}>
              Marking: +{practiceSet.marks_per_question} / -{practiceSet.negative_marking} · Progress: {answeredCount}/{questions.length} answered
            </small>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className={`ca-automcq-timer ${secondsLeft <= 60 ? "is-urgent" : ""}`}>
              <Clock size={14} /> {formatClock(secondsLeft)}
            </span>
            <button type="button" className="primary-btn" onClick={() => setConfirmSubmit(true)}>
              Submit Test
            </button>
          </div>
        </div>

        {/* Question Palette */}
        <div className="ca-automcq-palette">
          {questions.map((q, idx) => {
            const isAns = Boolean(answers[q.id]);
            const isRev = Boolean(markedReview[q.id]);
            return (
              <button
                key={q.id}
                type="button"
                className={`ca-automcq-pill ${idx === qIndex ? "is-current" : ""} ${isRev ? "is-wrong" : isAns ? "is-answered" : ""}`}
                onClick={() => setQIndex(idx)}
                title={`Q${idx + 1}${isRev ? " (Marked for Review)" : isAns ? " (Answered)" : ""}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {currentQ && (
          <div className="affair-question">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <strong style={{ color: "#1d4ed8" }}>Question {qIndex + 1} of {questions.length}</strong>
              <span className="ca-badge ca-badge--important">{String(currentQ.question_type).replace(/_/g, " ")}</span>
              <span className="ca-badge ca-badge--additional">{currentQ.difficulty}</span>
              {currentQ.category_name && <span className="ca-badge ca-badge--additional">{currentQ.category_name}</span>}
            </div>

            <div className="ca-automcq-stem">{currentQ.question_text}</div>

            <div className="ca-automcq-options">
              {(currentQ.options || []).map((opt) => (
                <button
                  key={opt.option_label}
                  type="button"
                  className={`outline-btn ca-automcq-opt ${selected === opt.option_label ? "is-opt-selected" : ""}`}
                  onClick={() => handleSelectAnswer(currentQ.id, opt.option_label)}
                >
                  <span className="ca-automcq-opt-key">{opt.option_label}</span>
                  <span style={{ flex: 1, textAlign: "left" }}>{opt.option_text}</span>
                </button>
              ))}
            </div>

            <div className="cbt-controls" style={{ marginTop: 18, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="outline-btn"
                  disabled={qIndex === 0}
                  onClick={() => setQIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft size={15} /> Previous
                </button>
                <button
                  type="button"
                  className={markedReview[currentQ.id] ? "primary-btn" : "outline-btn"}
                  onClick={() => handleToggleReview(currentQ.id)}
                >
                  <Flag size={14} /> {markedReview[currentQ.id] ? "Marked for Review" : "Mark for Review"}
                </button>
                <button
                  type="button"
                  className="outline-btn"
                  disabled={!selected}
                  onClick={() => handleClearResponse(currentQ.id)}
                >
                  Clear Response
                </button>
              </div>
              <div>
                {qIndex + 1 < questions.length ? (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => setQIndex((i) => Math.min(questions.length - 1, i + 1))}
                  >
                    Save &amp; Next <ChevronRight size={15} />
                  </button>
                ) : (
                  <button type="button" className="primary-btn" onClick={() => setConfirmSubmit(true)}>
                    Finish &amp; Submit
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal Before Final Submission */}
        {confirmSubmit && (
          <div className="ca-modal-backdrop" role="dialog" aria-modal="true">
            <div className="ca-modal-card">
              <h3 style={{ marginTop: 0 }}>Confirm Final Submission</h3>
              <p>
                Answered: <strong>{answeredCount}</strong> / {questions.length} · Unattempted:{" "}
                <strong>{questions.length - answeredCount}</strong> · Marked for Review:{" "}
                <strong>{reviewCount}</strong>
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                <button type="button" className="outline-btn" onClick={() => setConfirmSubmit(false)} disabled={submitting}>
                  Continue Practice
                </button>
                <button type="button" className="primary-btn" onClick={() => handleSubmitAttempt(false)} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit Now"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  // ============================================================================
  // POST-SUBMISSION SCORECARD & DETAILED SOLUTIONS (Phase 7)
  // ============================================================================
  if (resultData) {
    const { attempt, ranking, solutions } = resultData;
    return (
      <section className="panel ca-automcq-runner">
        <div className="ca-automcq-runner-top">
          <div>
            <div className="eyebrow">PRACTICE RESULT &amp; DETAILED SOLUTIONS</div>
            <h2 style={{ margin: "4px 0 0" }}>{attempt.set_title}</h2>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {attempt.allow_retry && (
              <button type="button" className="outline-btn" onClick={() => handleStartSet(attempt.practice_set_id)}>
                <RotateCcw size={14} /> Retry Set
              </button>
            )}
            <button
              type="button"
              className="outline-btn"
              onClick={() => handleDownloadPdf(attempt.practice_set_id, "detailed_solutions")}
            >
              <Download size={14} /> Solutions PDF
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                setResultData(null);
                loadTab(tab);
              }}
            >
              Back to Practice Sets
            </button>
          </div>
        </div>

        <div className="ca-automcq-scorecard">
          <div className="ca-automcq-stats-row">
            <div className="stat-card"><span>Total Score</span><strong>{attempt.score} / {attempt.max_score}</strong></div>
            <div className="stat-card"><span>Correct</span><strong style={{ color: "#15803d" }}>{attempt.correct_count}</strong></div>
            <div className="stat-card"><span>Incorrect</span><strong style={{ color: "#b91c1c" }}>{attempt.incorrect_count}</strong></div>
            <div className="stat-card"><span>Unattempted</span><strong>{attempt.unattempted_count}</strong></div>
            <div className="stat-card"><span>Accuracy</span><strong>{attempt.accuracy_pct}%</strong></div>
            <div className="stat-card"><span>Time Taken</span><strong>{formatClock(attempt.time_taken_sec)}</strong></div>
            {ranking && (
              <div className="stat-card">
                <span>Rank / Percentile</span>
                <strong>#{ranking.rank}/{ranking.totalStudents} ({ranking.percentile}%ile)</strong>
              </div>
            )}
          </div>
        </div>

        <h3 style={{ marginTop: 18 }}>Detailed Question-by-Question Solutions ({solutions.length})</h3>
        {solutions.map((q, idx) => (
          <div key={q.id} className="ca-admin-article">
            <div className="ca-admin-meta">
              <strong>Q{idx + 1}</strong>
              <span className={`ca-badge ${q.is_correct ? "ca-badge--published" : q.selected_answer ? "ca-badge--must_study" : "ca-badge--additional"}`}>
                {q.is_correct ? "Correct" : q.selected_answer ? "Incorrect" : "Unattempted"} ({q.marks_awarded > 0 ? `+${q.marks_awarded}` : q.marks_awarded})
              </span>
              <span className="ca-badge ca-badge--important">{String(q.question_type).replace(/_/g, " ")}</span>
              <span className="ca-badge ca-badge--additional">{q.difficulty}</span>
            </div>
            <div className="ca-automcq-stem" style={{ fontSize: 14.5 }}>{q.question_text}</div>
            <div className="ca-automcq-options" style={{ marginBottom: 10 }}>
              {(q.options || []).map((opt) => {
                const isCorr = opt.option_label === q.correct_answer;
                const isSel = opt.option_label === q.selected_answer;
                let cls = "outline-btn ca-automcq-opt";
                if (isCorr) cls += " is-opt-correct";
                else if (isSel && !isCorr) cls += " is-opt-wrong";
                return (
                  <div key={opt.option_label} className={cls} style={{ cursor: "default" }}>
                    <span className="ca-automcq-opt-key">{opt.option_label}</span>
                    <span style={{ flex: 1 }}>{opt.option_text}</span>
                    {isCorr && <CheckCircle2 size={15} />}
                    {isSel && !isCorr && <XCircle size={15} />}
                  </div>
                );
              })}
            </div>
            <div className="affair-static-gk" style={{ background: "#f8fafc", borderLeftColor: "#1d4ed8" }}>
              <div><strong>Detailed Explanation:</strong> {q.detailed_explanation}</div>
              {q.why_correct && <div style={{ marginTop: 4 }}><strong>Why Correct:</strong> {q.why_correct}</div>}
              {q.why_others_incorrect && Object.keys(q.why_others_incorrect).length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <strong>Why Other Options Are Incorrect:</strong>{" "}
                  {Object.entries(q.why_others_incorrect).map(([k, v]) => `(${k}) ${v}`).join(" | ")}
                </div>
              )}
              {Array.isArray(q.important_facts) && q.important_facts.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <strong>Important Facts:</strong> {q.important_facts.join(" · ")}
                </div>
              )}
              {q.source_reference && (
                <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                  <strong>Source:</strong> {q.source_reference}
                </div>
              )}
            </div>
          </div>
        ))}
      </section>
    );
  }

  // ============================================================================
  // MAIN STUDENT CURRENT AFFAIRS PLATFORM SHELL
  // ============================================================================
  return (
    <div className="ca-automcq-wrap">
      <div className="student-welcome ca-header-bar">
        <div>
          <div className="eyebrow">HHK AI CURRENT AFFAIRS PRACTICE PLATFORM</div>
          <h1>Daily Current Affairs Practice</h1>
          <p>
            Practice exam-standard banking Current Affairs sets, review detailed solutions, track
            weak topics, and download A4 PDF practice papers.
          </p>
        </div>
      </div>

      {/* Phase 13 Student Navigation */}
      <div className="ca-subtabs">
        {STUDENT_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "primary-btn" : "outline-btn"}
              onClick={() => setTab(t.id)}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="ca-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" className="outline-btn" onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      {/* TABS: DAILY / WEEKLY / MONTHLY PRACTICE SETS */}
      {["daily", "weekly", "monthly"].includes(tab) && (
        loading ? (
          <div className="ca-state-box">Loading published practice sets…</div>
        ) : !sets.length ? (
          <div className="ca-state-box">
            No published {tab} practice sets available yet. Check back once your instructor publishes today&apos;s set.
          </div>
        ) : (
          <div className="ba-card-grid">
            {sets.map((ps) => {
              const completed = ps.latest_attempt_status === "submitted" || ps.latest_attempt_status === "auto_submitted";
              return (
                <article key={ps.id} className="panel affair-card" style={{ marginBottom: 0 }}>
                  <div className="affair-card-top">
                    <span className="exam-pill">
                      {String(ps.date_to || ps.date_from).slice(0, 10)} · {String(ps.set_type).replace(/_/g, " ")}
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {ps.access_tier === "premium" && <span className="ca-badge ca-badge--draft">Premium</span>}
                      <span className={`ca-badge ${completed ? "ca-badge--published" : "ca-badge--important"}`}>
                        {completed ? `Completed (${ps.latest_accuracy_pct}%)` : "Not Attempted"}
                      </span>
                    </div>
                  </div>
                  <h2 style={{ marginTop: 10 }}>{ps.title}</h2>
                  <p style={{ margin: "4px 0 10px" }}>
                    {ps.total_questions} Questions · {ps.duration_minutes} mins · Marks: {ps.total_marks} (+{ps.marks_per_question} / -{ps.negative_marking})
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <button type="button" className="primary-btn" onClick={() => handleStartSet(ps.id)}>
                      <Play size={14} /> {completed ? "Retry Practice" : "Start Practice"}
                    </button>
                    {completed && ps.latest_attempt_id && (
                      <button type="button" className="outline-btn" onClick={() => handleOpenResult(ps.latest_attempt_id)}>
                        View Solutions ({ps.latest_score}/{ps.latest_max_score})
                      </button>
                    )}
                  </div>
                  {/* 4 PDF Download Formats */}
                  <div className="ba-card-footer" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                    <strong style={{ fontSize: 12, color: "#334155" }}>Download A4 PDF Paper:</strong>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {PDF_OPTIONS.map((opt) => {
                        const busyKey = `${ps.id}:${opt.format}`;
                        return (
                          <button
                            key={opt.format}
                            type="button"
                            className="outline-btn"
                            style={{ padding: "4px 8px", fontSize: 11.5 }}
                            disabled={pdfBusyKey === busyKey}
                            onClick={() => handleDownloadPdf(ps.id, opt.format)}
                          >
                            <Download size={12} /> {pdfBusyKey === busyKey ? "Generating…" : opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}

      {/* TAB: MY PERFORMANCE (Phase 12) */}
      {tab === "performance" && (
        loading ? (
          <div className="ca-state-box">Loading your performance metrics…</div>
        ) : (
          <section className="panel">
            <h2 style={{ marginTop: 0 }}>My Current Affairs Performance</h2>
            <div className="ca-stats-grid">
              <div className="ca-stat-card"><div className="ca-stat-label">Daily Completed</div><div className="ca-stat-value">{performance?.overview?.daily_completed ?? 0}</div></div>
              <div className="ca-stat-card"><div className="ca-stat-label">Weekly Completed</div><div className="ca-stat-value">{performance?.overview?.weekly_completed ?? 0}</div></div>
              <div className="ca-stat-card"><div className="ca-stat-label">Monthly Completed</div><div className="ca-stat-value">{performance?.overview?.monthly_completed ?? 0}</div></div>
              <div className="ca-stat-card"><div className="ca-stat-label">Total Attempted</div><div className="ca-stat-value">{performance?.overview?.total_attempted ?? 0}</div></div>
              <div className="ca-stat-card"><div className="ca-stat-label">Overall Accuracy</div><div className="ca-stat-value">{performance?.overview?.overall_accuracy_pct ?? 0}%</div></div>
              <div className="ca-stat-card"><div className="ca-stat-label">Weak Topics</div><div className="ca-stat-value">{performance?.weakTopics?.length ?? 0}</div></div>
            </div>

            <h3>Category-Wise Accuracy</h3>
            {!performance?.categoryPerformance?.length ? (
              <div className="ca-state-box">Complete a practice set to unlock category-wise analytics.</div>
            ) : (
              <div className="ca-cat-table-wrap">
                <table className="ca-cat-table">
                  <thead>
                    <tr><th>Category</th><th>Attempted</th><th>Correct</th><th>Accuracy</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {performance.categoryPerformance.map((c) => (
                      <tr key={c.category_name}>
                        <td>{c.category_name}</td>
                        <td>{c.attempted}</td>
                        <td>{c.correct}</td>
                        <td>{c.accuracy_pct}%</td>
                        <td>
                          <span className={`ca-badge ${Number(c.accuracy_pct) < 70 ? "ca-badge--must_study" : "ca-badge--published"}`}>
                            {Number(c.accuracy_pct) < 70 ? "Needs Revision" : "Strong"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      )}

      {/* TAB: REVISION OF INCORRECT QUESTIONS (Phase 12) */}
      {tab === "revision" && (
        loading ? (
          <div className="ca-state-box">Loading incorrect questions for revision…</div>
        ) : !revisionQuestions.length ? (
          <div className="ca-state-box">No incorrect questions queued for revision yet. Great work!</div>
        ) : (
          <section className="panel">
            <h2 style={{ marginTop: 0 }}>Revise Previously Incorrect Questions ({revisionQuestions.length})</h2>
            {revisionQuestions.map((q, idx) => {
              const chosen = revisionAnswers[q.id];
              return (
                <div key={q.id} className="ca-admin-article">
                  <div className="ca-admin-meta">
                    <strong>Revision #{idx + 1}</strong>
                    <span className="ca-badge ca-badge--important">{q.category_name || "Current Affairs"}</span>
                    <span className="ca-badge ca-badge--additional">{q.difficulty}</span>
                  </div>
                  <div className="ca-automcq-stem" style={{ fontSize: 14.5 }}>{q.question_text}</div>
                  <div className="ca-automcq-options">
                    {(q.options || []).map((opt) => {
                      const isCorr = opt.option_label === q.correct_answer;
                      const isChosen = chosen === opt.option_label;
                      let cls = "outline-btn ca-automcq-opt";
                      if (chosen) {
                        if (isCorr) cls += " is-opt-correct";
                        else if (isChosen) cls += " is-opt-wrong";
                      }
                      return (
                        <button
                          key={opt.option_label}
                          type="button"
                          className={cls}
                          disabled={Boolean(chosen)}
                          onClick={() => setRevisionAnswers((p) => ({ ...p, [q.id]: opt.option_label }))}
                        >
                          <span className="ca-automcq-opt-key">{opt.option_label}</span>
                          <span style={{ flex: 1, textAlign: "left" }}>{opt.option_text}</span>
                        </button>
                      );
                    })}
                  </div>
                  {chosen && (
                    <div className={chosen === q.correct_answer ? "feedback-correct" : "feedback-wrong"} style={{ marginTop: 10 }}>
                      <strong>
                        {chosen === q.correct_answer ? "Mastered!" : `Correct Answer: Option (${q.correct_answer})`}
                      </strong>
                      <p style={{ margin: "4px 0 0" }}>{q.detailed_explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )
      )}

      {/* TAB: DOWNLOADED PDFs */}
      {tab === "pdfs" && (
        <section className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>My Downloaded PDF Papers ({downloads.length})</h2>
            <button type="button" className="outline-btn" onClick={() => loadTab("pdfs")}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {!downloads.length ? (
            <div className="ca-state-box">No PDFs downloaded yet. Download any practice paper from Daily, Weekly, or Monthly Practice.</div>
          ) : (
            <div className="ca-cat-table-wrap">
              <table className="ca-cat-table">
                <thead>
                  <tr><th>Practice Set</th><th>Format</th><th>Size</th><th>Downloaded On</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {downloads.map((d) => (
                    <tr key={d.id}>
                      <td>{d.practice_set_title}</td>
                      <td>{String(d.pdf_format).replace(/_/g, " ")}</td>
                      <td>{Math.max(1, Math.round((d.file_size_bytes || 0) / 1024))} KB</td>
                      <td>{new Date(d.created_at).toLocaleString("en-IN")}</td>
                      <td>
                        <button
                          type="button"
                          className="outline-btn"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => handleDownloadPdf(d.practice_set_id, d.pdf_format)}
                        >
                          <Download size={12} /> Download Again
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* PRESERVED BANKING AWARENESS REFERENCE HUB */}
      {tab === "banking_hub" && <BankingAwarenessDashboard />}
    </div>
  );
}
