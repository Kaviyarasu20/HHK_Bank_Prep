import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Flag,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { rcStudentApi } from "../../api/readingComprehension";

function formatClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function StudentReadingComprehension({ onToast }) {
  const [view, setView] = useState("library"); // library | practice | result
  const [meta, setMeta] = useState(null);
  const [passages, setPassages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Library filters
  const [examFilter, setExamFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  // Active Practice Session
  const [session, setSession] = useState(null); // { attempt, passage, questions }
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [timeSpent, setTimeSpent] = useState(0);
  const [fontSize, setFontSize] = useState(15);
  const [mobilePane, setMobilePane] = useState("passage"); // passage | questions
  const [submitting, setSubmitting] = useState(false);

  // Result Review
  const [resultData, setResultData] = useState(null);
  const [resultTab, setResultTab] = useState("explanations"); // explanations | vocabulary

  async function loadLibrary() {
    setLoading(true);
    setError("");
    try {
      const [m, p] = await Promise.all([rcStudentApi.getMeta(), rcStudentApi.listPassages()]);
      setMeta(m);
      setPassages(p.passages ?? []);
    } catch (e) {
      setError(e.message || "Unable to load Reading Comprehension passages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLibrary();
  }, []);

  // Countdown timer during active practice
  useEffect(() => {
    if (view !== "practice" || !session) return undefined;
    const id = setInterval(() => {
      setTimeSpent((t) => t + 1);
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          void handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [view, session?.attempt?.id]);

  async function handleStartPractice(passageId, restart = false) {
    setLoading(true);
    setError("");
    try {
      const data = await rcStudentApi.startAttempt(passageId, restart);
      setSession(data);
      setAnswers(data.attempt?.answers || {});
      setMarked(Array.isArray(data.attempt?.marked_for_review) ? data.attempt.marked_for_review : []);
      setCurrentIdx(0);
      const totalAllowed = Number(data.passage?.recommended_time_seconds || 600);
      const alreadySpent = Number(data.attempt?.time_spent_seconds || 0);
      setTimeSpent(alreadySpent);
      setSecondsLeft(Math.max(30, totalAllowed - alreadySpent));
      setMobilePane("passage");
      setView("practice");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewPreviousResult(attemptId) {
    setLoading(true);
    setError("");
    try {
      const data = await rcStudentApi.getResult(attemptId);
      setResultData(data);
      setResultTab("explanations");
      setView("result");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function persistProgress(nextAnswers, nextMarked) {
    if (!session?.attempt?.id) return;
    rcStudentApi
      .saveProgress(session.attempt.id, {
        answers: nextAnswers,
        markedForReview: nextMarked,
        timeSpentSeconds: timeSpent,
      })
      .catch(() => {});
  }

  function selectOption(questionId, key) {
    const next = { ...answers, [questionId]: key };
    setAnswers(next);
    persistProgress(next, marked);
  }

  function clearOption(questionId) {
    const next = { ...answers };
    delete next[questionId];
    setAnswers(next);
    persistProgress(next, marked);
  }

  function toggleMarkForReview(questionId) {
    const next = marked.includes(questionId)
      ? marked.filter((id) => id !== questionId)
      : [...marked, questionId];
    setMarked(next);
    persistProgress(answers, next);
  }

  async function handleSubmit(autoSubmitted = false) {
    if (!session?.attempt?.id || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await rcStudentApi.submitAttempt(session.attempt.id, {
        answers,
        markedForReview: marked,
        timeSpentSeconds: timeSpent,
        autoSubmitted,
      });
      setResultData(res);
      setResultTab("explanations");
      setView("result");
      onToast?.(autoSubmitted ? "Time's up! Your Reading Comprehension test was submitted." : "Reading Comprehension submitted!");
      void loadLibrary();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredPassages = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return passages.filter((p) => {
      if (examFilter !== "all" && p.examination !== examFilter) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (difficultyFilter !== "all" && p.difficulty !== difficultyFilter) return false;
      if (q && !`${p.title} ${p.category} ${p.examination}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [passages, examFilter, categoryFilter, difficultyFilter, searchText]);

  // ============================================================================
  // VIEW 1: PASSAGE LIBRARY
  // ============================================================================
  if (view === "library") {
    return (
      <div className="rc-student-wrap">
        <div className="rc-studio-header">
          <div>
            <span className="section-kicker">ENGLISH LANGUAGE PRACTICE</span>
            <h2>Reading Comprehension Practice</h2>
            <p className="table-subtext">
              Practice exam-standard banking passages in a split-screen CBT interface with detailed explanations, Tamil &amp; English vocabulary, and PDF downloads.
            </p>
          </div>
        </div>

        {error && <div className="admin-error" role="alert">{error}</div>}

        <div className="qb-picker-filters">
          <select value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
            <option value="all">All Examinations</option>
            {(meta?.examinations ?? []).map((ex) => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All 15 Categories</option>
            {(meta?.allCategories ?? []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}>
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="moderate">Moderate</option>
            <option value="hard">Hard</option>
            <option value="expert">Expert</option>
          </select>
          <input
            type="search"
            placeholder="Search passage topic..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        {loading && <div className="admin-loading">Loading Reading Comprehension passages...</div>}

        <div className="rc-student-grid">
          {filteredPassages.map((p) => {
            const hasCompleted = p.latest_attempt_status === "submitted" || p.latest_attempt_status === "auto_submitted";
            return (
              <div key={p.id} className="rc-student-card">
                <div className="rc-meta-badges">
                  <span className="qb-badge">{p.examination}</span>
                  <span className={`qb-badge diff-${p.difficulty === "easy" ? "easy" : p.difficulty === "moderate" ? "medium" : "hard"}`}>
                    {p.difficulty}
                  </span>
                  <span className="qb-badge">{p.question_count} Qs</span>
                </div>
                <h3>{p.title}</h3>
                <p className="table-subtext">
                  {p.category} · {p.word_count} words · {Math.round((p.recommended_time_seconds || 600) / 60)} min
                </p>
                {hasCompleted && (
                  <div className="rc-last-score">
                    Last Score: <strong>{p.latest_score}/{p.latest_max_score}</strong> ({p.latest_accuracy_pct}% accuracy)
                  </div>
                )}
                <div className="rc-card-actions">
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => void handleStartPractice(p.id, hasCompleted)}
                  >
                    <Play size={13} /> {hasCompleted ? "Practice Again" : "Start Practice"}
                  </button>
                  {hasCompleted && p.latest_attempt_id && (
                    <button
                      type="button"
                      className="outline-btn admin-action"
                      onClick={() => void handleViewPreviousResult(p.latest_attempt_id)}
                    >
                      Review Result
                    </button>
                  )}
                </div>
                <div className="rc-pdf-links">
                  <a href={rcStudentApi.getPdfUrl(p.id, "practice")} target="_blank" rel="noreferrer">
                    <Download size={12} /> Practice PDF
                  </a>
                  <a href={rcStudentApi.getPdfUrl(p.id, "answers")} target="_blank" rel="noreferrer">
                    <Download size={12} /> Answer PDF
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {!loading && !filteredPassages.length && (
          <div className="empty-questions">No published Reading Comprehension passages match your filters yet.</div>
        )}
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: SPLIT-SCREEN CBT PRACTICE INTERFACE (Desktop Split / Mobile Tabs)
  // ============================================================================
  if (view === "practice" && session) {
    const { passage, questions } = session;
    const currentQ = questions[currentIdx];
    const currentSelected = currentQ ? answers[currentQ.id] : null;
    const isMarked = currentQ ? marked.includes(currentQ.id) : false;
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="rc-cbt-shell">
        <div className="rc-cbt-topbar">
          <div>
            <button type="button" className="qb-mini-btn" onClick={() => setView("library")}>
              <ArrowLeft size={12} /> Exit
            </button>
            <strong className="rc-cbt-title">{passage.title}</strong>
            <span className="qb-badge">{passage.examination}</span>
            <span className="qb-badge">{passage.difficulty}</span>
          </div>
          <div className="rc-cbt-controls">
            <span className={`rc-timer ${secondsLeft < 60 ? "urgent" : ""}`}>
              <Clock size={14} /> {formatClock(secondsLeft)}
            </span>
            <span className="table-subtext">
              Answered: {answeredCount}/{questions.length}
            </span>
            <button
              type="button"
              className="primary-btn"
              disabled={submitting}
              onClick={() => void handleSubmit(false)}
            >
              {submitting ? "Submitting..." : "Submit Test"}
            </button>
          </div>
        </div>

        {/* Mobile Switcher */}
        <div className="rc-mobile-switcher">
          <button
            type="button"
            className={mobilePane === "passage" ? "active" : ""}
            onClick={() => setMobilePane("passage")}
          >
            <BookOpen size={14} /> Reading Passage
          </button>
          <button
            type="button"
            className={mobilePane === "questions" ? "active" : ""}
            onClick={() => setMobilePane("questions")}
          >
            Question {currentIdx + 1}/{questions.length}
          </button>
        </div>

        {/* Split-Screen Desktop Layout */}
        <div className="rc-split-layout">
          {/* LEFT PANEL: Reading Passage */}
          <article className={`rc-passage-pane ${mobilePane === "passage" ? "mobile-show" : "mobile-hide"}`}>
            <div className="rc-block-head">
              <div>
                <strong>{passage.category}</strong>
                <div className="table-subtext">{passage.word_count} words</div>
              </div>
              <div className="rc-mini-actions">
                <button type="button" className="qb-mini-btn" onClick={() => setFontSize((s) => Math.max(13, s - 1))}>A-</button>
                <button type="button" className="qb-mini-btn" onClick={() => setFontSize((s) => Math.min(20, s + 1))}>A+</button>
              </div>
            </div>
            <div className="rc-passage-body" style={{ fontSize: `${fontSize}px` }}>
              {String(passage.passage_text || "")
                .split(/\n\s*\n/)
                .map((para, idx) => (
                  <p key={idx}>{para}</p>
                ))}
            </div>
          </article>

          {/* RIGHT PANEL: Questions & Answer Options */}
          <div className={`rc-question-pane ${mobilePane === "questions" ? "mobile-show" : "mobile-hide"}`}>
            {/* Question Palette */}
            <div className="rc-palette">
              {questions.map((q, idx) => {
                const isAns = Boolean(answers[q.id]);
                const isRev = marked.includes(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={`rc-palette-btn ${idx === currentIdx ? "current" : ""} ${isRev ? "marked" : isAns ? "answered" : ""}`}
                    onClick={() => setCurrentIdx(idx)}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {currentQ && (
              <div className="rc-active-q-card">
                <div className="rc-block-head">
                  <strong>Question {currentIdx + 1} of {questions.length}</strong>
                  <span className="qb-badge">{currentQ.question_type}</span>
                </div>
                <p className="rc-q-stem">{currentQ.question_text}</p>
                <div className="rc-student-options">
                  {(currentQ.options ?? []).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`rc-student-opt ${currentSelected === opt.key ? "selected" : ""}`}
                      onClick={() => selectOption(currentQ.id, opt.key)}
                    >
                      <span className="opt-key">{opt.key}</span>
                      <span>{opt.text}</span>
                    </button>
                  ))}
                </div>

                <div className="rc-cbt-footer">
                  <div className="rc-mini-actions">
                    <button
                      type="button"
                      className={`outline-btn admin-action ${isMarked ? "marked-btn" : ""}`}
                      onClick={() => toggleMarkForReview(currentQ.id)}
                    >
                      <Flag size={13} /> {isMarked ? "Marked for Review" : "Mark for Review"}
                    </button>
                    {currentSelected && (
                      <button type="button" className="qb-mini-btn" onClick={() => clearOption(currentQ.id)}>
                        Clear Response
                      </button>
                    )}
                  </div>
                  <div className="rc-mini-actions">
                    <button
                      type="button"
                      className="outline-btn admin-action"
                      disabled={currentIdx === 0}
                      onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                    >
                      <ArrowLeft size={13} /> Previous
                    </button>
                    {currentIdx < questions.length - 1 ? (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                      >
                        Next <ArrowRight size={13} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="primary-btn"
                        disabled={submitting}
                        onClick={() => void handleSubmit(false)}
                      >
                        Finish &amp; Submit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 3: RESULTS, DETAILED EXPLANATIONS & VOCABULARY
  // ============================================================================
  if (view === "result" && resultData) {
    const { attempt, passage, questions, vocabulary } = resultData;
    return (
      <div className="rc-student-wrap">
        <div className="rc-studio-header">
          <div>
            <button type="button" className="qb-mini-btn" onClick={() => setView("library")}>
              <ArrowLeft size={12} /> Back to Passages
            </button>
            <h2>{passage.title} — Results &amp; Review</h2>
            <p className="table-subtext">
              {passage.examination} · {passage.category} · {passage.difficulty}
            </p>
          </div>
          <div className="table-action-row">
            <a className="outline-btn admin-action" href={rcStudentApi.getPdfUrl(passage.id, "practice")} target="_blank" rel="noreferrer">
              <Download size={13} /> Practice PDF
            </a>
            <a className="outline-btn admin-action" href={rcStudentApi.getPdfUrl(passage.id, "answers")} target="_blank" rel="noreferrer">
              <Download size={13} /> Answer &amp; Solutions PDF
            </a>
            <button type="button" className="primary-btn" onClick={() => void handleStartPractice(passage.id, true)}>
              <RotateCcw size={13} /> Practice Again
            </button>
          </div>
        </div>

        <div className="rc-kpi-row">
          <div className="rc-kpi-card">
            <span>Score</span>
            <strong>{attempt.score} / {attempt.max_score}</strong>
          </div>
          <div className="rc-kpi-card">
            <span>Accuracy</span>
            <strong>{attempt.accuracy_pct}%</strong>
          </div>
          <div className="rc-kpi-card">
            <span>Correct / Wrong / Skipped</span>
            <strong>{attempt.correct_count} / {attempt.wrong_count} / {attempt.unanswered_count}</strong>
          </div>
          <div className="rc-kpi-card">
            <span>Time Spent</span>
            <strong>{formatClock(attempt.time_spent_seconds || 0)}</strong>
          </div>
        </div>

        <div className="rc-tabs">
          <button
            type="button"
            className={resultTab === "explanations" ? "active" : ""}
            onClick={() => setResultTab("explanations")}
          >
            Answer Review &amp; Explanations ({questions.length})
          </button>
          <button
            type="button"
            className={resultTab === "vocabulary" ? "active" : ""}
            onClick={() => setResultTab("vocabulary")}
          >
            Passage Vocabulary ({vocabulary?.length ?? 0})
          </button>
        </div>

        {resultTab === "explanations" ? (
          <div className="rc-questions-section">
            {questions.map((q, idx) => (
              <div key={q.id} className="rc-q-card">
                <div className="rc-block-head">
                  <div>
                    <strong>Q{idx + 1}.</strong>{" "}
                    <span className="qb-badge">{q.question_type}</span>
                  </div>
                  <span className={`qb-badge ${q.outcome === "correct" ? "diff-easy" : q.outcome === "wrong" ? "diff-hard" : ""}`}>
                    {q.outcome === "correct" && <CheckCircle2 size={12} />}
                    {q.outcome === "wrong" && <XCircle size={12} />}
                    {" "}
                    {q.outcome === "correct" ? "Correct" : q.outcome === "wrong" ? "Incorrect" : "Unanswered"}
                  </span>
                </div>
                <p className="rc-q-stem">{q.question_text}</p>
                <div className="rc-q-opts">
                  {(q.options ?? []).map((opt) => {
                    const isRight = opt.key === q.correct_answer;
                    const isChosenWrong = opt.key === q.selected_answer && !isRight;
                    return (
                      <div
                        key={opt.key}
                        className={`rc-q-opt ${isRight ? "correct" : ""} ${isChosenWrong ? "wrong" : ""}`}
                      >
                        <strong>({opt.key})</strong> {opt.text}
                        {isRight && " ✓"}
                        {isChosenWrong && " (Your answer)"}
                      </div>
                    );
                  })}
                </div>
                {q.explanation && <div className="rc-q-exp"><strong>Explanation:</strong> {q.explanation}</div>}
                {q.passage_reference && <div className="rc-q-ref"><strong>Supporting Passage Reference:</strong> &ldquo;{q.passage_reference}&rdquo;</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="rc-vocab-section">
            {vocabulary?.length ? (
              <div className="section-table-wrap">
                <table className="section-table">
                  <thead>
                    <tr>
                      <th>Word &amp; Pronunciation</th>
                      <th>Meaning (English)</th>
                      <th>Tamil Meaning</th>
                      <th>Synonym / Antonym</th>
                      <th>Example &amp; Passage Context</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vocabulary.map((v) => (
                      <tr key={v.id || v.word}>
                        <td>
                          <strong>{v.word}</strong>
                          {v.pronunciation && <div className="table-subtext">{v.pronunciation}</div>}
                        </td>
                        <td>{v.meaning_english}</td>
                        <td>{v.meaning_tamil}</td>
                        <td>
                          <div><strong>Syn:</strong> {v.synonym}</div>
                          <div><strong>Ant:</strong> {v.antonym}</div>
                        </td>
                        <td>
                          <div>{v.example_sentence}</div>
                          {v.passage_context && <small className="table-subtext">Context: &ldquo;{v.passage_context}&rdquo;</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-questions">No vocabulary list was attached to this passage.</div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
