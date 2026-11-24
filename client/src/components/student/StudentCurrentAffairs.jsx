import { useState } from "react";
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { openCurrentAffairsCapsulePdf } from "../../utils/exportCurrentAffairsPdf";
import { getSafeExternalUrl } from "../../utils/safeUrl";
import { BankingAwarenessDashboard } from "./BankingAwarenessDashboard";
import { CurrentAffairsOneLiners } from "./CurrentAffairsOneLiners";
import { CurrentAffairsFlashcards } from "./CurrentAffairsFlashcards";
import { SmartRevisionDashboard } from "./SmartRevisionDashboard";
import { MonthlyCapsules } from "./MonthlyCapsules";
import { GAMarathonDashboard } from "./GAMarathonDashboard";

function StudentCurrentAffairs({
  affairCategory,
  setAffairCategory,
  affairMonth,
  setAffairMonth,
  affairSearch,
  setAffairSearch,
  affairPriority,
  setAffairPriority,
  affairRelevance,
  setAffairRelevance,
  affairExam,
  setAffairExam,
  affairBookmarkedOnly,
  setAffairBookmarkedOnly,
  affairPage,
  setAffairPage,
  affairPagination,
  affairLoading,
  affairError,
  onRetryAffairs,
  affairCategories,
  affairs,
  affairQuiz,
  setAffairQuiz,
  answerAffair,
  showAffairQuestion,
  openAffair,
  openCombinedAffairQuiz,
  onUpdateAffairState,
  onStartGaTest,
}) {
  const [hubMode, setHubMode] = useState("daily");
  const readCount = affairs.filter((a) => a.is_read).length;
  const totalQuizCount = affairs.reduce((sum, a) => sum + Number(a.quiz_count || 0), 0);
  const pagination = affairPagination || {
    page: affairPage || 1,
    total: affairs.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  return (
    <>
      <div className="ca-subtabs" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className={hubMode === "daily" ? "primary-btn" : "outline-btn"}
          onClick={() => setHubMode("daily")}
        >
          Daily Current Affairs
        </button>
        <button
          type="button"
          className={hubMode === "banking" ? "primary-btn" : "outline-btn"}
          onClick={() => setHubMode("banking")}
        >
          Banking Awareness Reference Hub
        </button>
        <button
          type="button"
          className={hubMode === "one_liners" ? "primary-btn" : "outline-btn"}
          onClick={() => setHubMode("one_liners")}
        >
          One-Liner Digest
        </button>
        <button
          type="button"
          className={hubMode === "flashcards" ? "primary-btn" : "outline-btn"}
          onClick={() => setHubMode("flashcards")}
        >
          Flashcards
        </button>
        <button
          type="button"
          className={hubMode === "smart_revision" ? "primary-btn" : "outline-btn"}
          onClick={() => setHubMode("smart_revision")}
        >
          Smart Revision
        </button>
        <button
          type="button"
          className={hubMode === "monthly_capsules" ? "primary-btn" : "outline-btn"}
          onClick={() => setHubMode("monthly_capsules")}
        >
          Monthly Capsules
        </button>
        <button
          type="button"
          className={hubMode === "ga_marathon" ? "primary-btn" : "outline-btn"}
          onClick={() => setHubMode("ga_marathon")}
        >
          GA Marathon
        </button>
      </div>

      {hubMode === "banking" ? (
        <BankingAwarenessDashboard />
      ) : hubMode === "one_liners" ? (
        <CurrentAffairsOneLiners />
      ) : hubMode === "flashcards" ? (
        <CurrentAffairsFlashcards />
      ) : hubMode === "smart_revision" ? (
        <SmartRevisionDashboard />
      ) : hubMode === "monthly_capsules" ? (
        <MonthlyCapsules />
      ) : hubMode === "ga_marathon" ? (
        <GAMarathonDashboard onStartGaTest={onStartGaTest} />
      ) : (
      <>
      <div className="student-welcome ca-header-bar">
        <div>
          <div className="eyebrow">DAILY LEARNING</div>
          <h1>Current affairs</h1>
          <p>
            Read exam-focused briefings, bookmark key updates, and practice MCQs.
            {affairs.length > 0 && ` · ${readCount}/${affairs.length} read on this page`}
          </p>
        </div>

        <div className="ca-filter-controls">
          <label className="form-field" style={{ margin: 0 }}>
            Search
            <input
              type="search"
              className="ca-search-input"
              value={affairSearch ?? ""}
              placeholder="Search RBI, schemes, economy…"
              onChange={(e) => {
                setAffairSearch?.(e.target.value);
                setAffairPage?.(1);
              }}
            />
          </label>

          <label className="form-field" style={{ margin: 0 }}>
            Month
            <input
              type="month"
              value={affairMonth}
              onChange={(e) => {
                setAffairMonth(e.target.value);
                setAffairPage?.(1);
              }}
            />
          </label>

          <label className="form-field" style={{ margin: 0 }}>
            Category
            <select
              value={affairCategory}
              onChange={(e) => {
                setAffairCategory(e.target.value);
                setAffairPage?.(1);
              }}
            >
              <option value="">All categories</option>
              {affairCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field" style={{ margin: 0 }}>
            Priority
            <select
              value={affairPriority ?? ""}
              onChange={(e) => {
                setAffairPriority?.(e.target.value);
                setAffairPage?.(1);
              }}
            >
              <option value="">All priorities</option>
              <option value="must_study">Must Study</option>
              <option value="important">Important</option>
              <option value="additional">Additional</option>
            </select>
          </label>

          <label className="form-field" style={{ margin: 0 }}>
            Relevance
            <select
              value={affairRelevance ?? ""}
              onChange={(e) => {
                setAffairRelevance?.(e.target.value);
                setAffairPage?.(1);
              }}
            >
              <option value="">All relevance</option>
              <option value="highly_relevant">Highly Relevant</option>
              <option value="relevant">Relevant</option>
              <option value="moderately_relevant">Moderately Relevant</option>
              <option value="low_relevance">Low Relevance</option>
            </select>
          </label>

          <label className="form-field" style={{ margin: 0 }}>
            Exam
            <select
              value={affairExam ?? ""}
              onChange={(e) => {
                setAffairExam?.(e.target.value);
                setAffairPage?.(1);
              }}
            >
              <option value="">All exams</option>
              <option value="IBPS PO">IBPS PO</option>
              <option value="IBPS Clerk">IBPS Clerk</option>
              <option value="SBI PO">SBI PO</option>
              <option value="SBI Clerk">SBI Clerk</option>
              <option value="IBPS RRB PO">IBPS RRB PO</option>
              <option value="IBPS RRB Office Assistant">IBPS RRB OA</option>
              <option value="RBI Grade B">RBI Grade B</option>
              <option value="NABARD Grade A">NABARD Grade A</option>
            </select>
          </label>

          <button
            type="button"
            className={affairBookmarkedOnly ? "primary-btn" : "outline-btn"}
            onClick={() => {
              setAffairBookmarkedOnly((v) => !v);
              setAffairPage?.(1);
            }}
          >
            <Bookmark size={14} /> Saved
          </button>

          {!affairQuiz && totalQuizCount > 0 && (
            <button
              type="button"
              className="primary-btn"
              onClick={openCombinedAffairQuiz}
            >
              <Sparkles size={14} /> Combined Quiz ({totalQuizCount} Qs)
            </button>
          )}
          {!affairQuiz && affairs.length > 0 && (
            <button
              type="button"
              className="outline-btn"
              onClick={() =>
                openCurrentAffairsCapsulePdf({
                  affairs,
                  monthLabel: affairMonth,
                  categoryLabel:
                    affairCategories.find((c) => c.id === affairCategory)?.name || "All Categories",
                })
              }
            >
              <Download size={14} /> PDF Capsule
            </button>
          )}
        </div>
      </div>

      {affairError && (
        <div className="ca-error-banner" role="alert">
          <span>{affairError}</span>
          {onRetryAffairs && (
            <button type="button" className="outline-btn" onClick={onRetryAffairs}>
              <RefreshCw size={13} /> Retry
            </button>
          )}
        </div>
      )}

      {affairQuiz ? (
        <section className="panel admin-panel">
          <button
            type="button"
            className="outline-btn admin-action"
            onClick={() => setAffairQuiz(null)}
          >
            Back to notes
          </button>
          <h2>
            {affairQuiz.title || "Quick quiz"} · Question {affairQuiz.index + 1} of{" "}
            {affairQuiz.questions.length}
          </h2>
          {(() => {
            const q = affairQuiz.questions[affairQuiz.index];
            return (
              <div className="affair-question" key={q.id}>
                {q.affair_title && (
                  <small style={{ color: "#64748b", display: "block", marginBottom: 6 }}>
                    Topic: {q.affair_title}
                  </small>
                )}
                <strong>{q.question_text}</strong>
                <div className="pyq-options">
                  {q.options.map((o) => (
                    <button
                      type="button"
                      disabled={Boolean(affairQuiz.feedback)}
                      className="outline-btn"
                      key={o.key}
                      onClick={() => answerAffair(o.key)}
                    >
                      {o.key}. {o.text}
                    </button>
                  ))}
                </div>
                {affairQuiz.feedback && (
                  <>
                    <p
                      className={
                        affairQuiz.feedback.correct
                          ? "feedback-correct"
                          : "feedback-wrong"
                      }
                    >
                      {affairQuiz.feedback.correct ? "Correct." : "Review the answer."}{" "}
                      Correct answer: {affairQuiz.feedback.correctAnswer}.{" "}
                      {affairQuiz.feedback.explanation}
                    </p>
                    <div className="cbt-controls">
                      <button
                        type="button"
                        className="outline-btn"
                        disabled={!affairQuiz.index}
                        onClick={() => showAffairQuestion(affairQuiz.index - 1)}
                      >
                        <ChevronLeft size={15} /> Previous
                      </button>
                      <div />
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() =>
                          affairQuiz.index + 1 < affairQuiz.questions.length
                            ? showAffairQuestion(affairQuiz.index + 1)
                            : setAffairQuiz(null)
                        }
                      >
                        {affairQuiz.index + 1 < affairQuiz.questions.length
                          ? "Next question"
                          : "Finish quiz"}{" "}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </section>
      ) : affairLoading ? (
        <div className="ca-state-box">Loading current affairs briefings…</div>
      ) : (
        <>
          {affairs.map((item) => {
            const points = Array.isArray(item.key_points) ? item.key_points : [];
            const safeUrl = getSafeExternalUrl(item.source_url);
            return (
              <article className="panel affair-card" key={item.id}>
                <div className="affair-card-top">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="exam-pill">
                      {item.category}
                      {item.published_at
                        ? ` · ${new Date(item.published_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}`
                        : ""}
                    </span>
                    {item.priority_level && (
                      <span className={`ca-badge ca-badge--${item.priority_level}`}>
                        {item.priority_level.replace("_", " ")}
                      </span>
                    )}
                  </div>

                  <div className="affair-card-actions">
                    <button
                      type="button"
                      className={item.is_read ? "primary-btn" : "outline-btn"}
                      style={{ padding: "4px 10px", fontSize: 12.5 }}
                      onClick={() => onUpdateAffairState?.(item.id, { isRead: !item.is_read })}
                    >
                      <CheckCircle2 size={13} /> {item.is_read ? "Read" : "Mark read"}
                    </button>
                    <button
                      type="button"
                      className={item.is_bookmarked ? "primary-btn" : "outline-btn"}
                      style={{ padding: "4px 10px", fontSize: 12.5 }}
                      onClick={() =>
                        onUpdateAffairState?.(item.id, { isBookmarked: !item.is_bookmarked })
                      }
                    >
                      <Bookmark size={13} /> {item.is_bookmarked ? "Saved" : "Save"}
                    </button>
                  </div>
                </div>

                <h2>{item.ai_structured?.examHeadline || item.title}</h2>
                {item.ai_structured ? (
                  <>
                    <p><strong>Exam Summary:</strong> {item.ai_structured.summary}</p>
                    {item.ai_structured.detailedExplanation && (
                      <p>{item.ai_structured.detailedExplanation}</p>
                    )}
                    {item.ai_structured.whyItMatters && (
                      <p style={{ fontSize: 13.5 }}><strong>Why it matters:</strong> {item.ai_structured.whyItMatters}</p>
                    )}
                    {Array.isArray(item.ai_structured.takeaways) && item.ai_structured.takeaways.length > 0 && (
                      <ul className="affair-points">
                        {item.ai_structured.takeaways.map((tk, idx) => (
                          <li key={idx}>{tk}</li>
                        ))}
                      </ul>
                    )}
                    {Array.isArray(item.ai_structured.facts) && item.ai_structured.facts.length > 0 && (
                      <div className="affair-static-gk" style={{ background: "#f8fafc", borderLeftColor: "#1d4ed8" }}>
                        <strong>Key Exam Facts:</strong>
                        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                          {item.ai_structured.facts.map((f, idx) => (
                            <li key={idx}>
                              {f.factText}{f.factValue ? ` (${f.factValue}${f.unit ? ` ${f.unit}` : ""})` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(item.ai_structured.examTags) && item.ai_structured.examTags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {item.ai_structured.examTags.map((et, idx) => (
                          <span className="ca-badge ca-badge--important" key={idx}>{et.examCode}</span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p>{item.body}</p>
                )}

                {points.length > 0 && (
                  <ul className="affair-points">
                    {points.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ul>
                )}

                {item.static_gk && (
                  <div className="affair-static-gk">
                    <strong>Static GK Takeaway:</strong> {item.static_gk}
                  </div>
                )}

                {safeUrl && (
                  <p className="affair-source-link">
                    <a href={safeUrl} target="_blank" rel="noopener noreferrer">
                      Official source{item.source_name ? ` (${item.source_name})` : ""} ↗
                    </a>
                  </p>
                )}

                {item.quiz_count > 0 && (
                  <button
                    type="button"
                    className="text-link"
                    style={{ marginTop: 12 }}
                    onClick={() => openAffair(item.id)}
                  >
                    Take article quiz ({item.quiz_count}) <ArrowRight size={14} />
                  </button>
                )}
              </article>
            );
          })}

          {!affairs.length && (
            <div className="ca-state-box">
              {affairBookmarkedOnly
                ? "You have not saved any current affairs yet."
                : affairSearch
                  ? `No published articles match "${affairSearch}".`
                  : "No published current affairs match the selected filter."}
            </div>
          )}

          {pagination.total > 0 && pagination.totalPages > 1 && (
            <div className="ca-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} articles)
              </span>
              <div className="ca-pagination-actions">
                <button
                  type="button"
                  className="outline-btn"
                  disabled={!pagination.hasPreviousPage || affairLoading}
                  onClick={() => setAffairPage?.((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  type="button"
                  className="outline-btn"
                  disabled={!pagination.hasNextPage || affairLoading}
                  onClick={() => setAffairPage?.((p) => p + 1)}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </>
      )}
    </>
  );
}

export { StudentCurrentAffairs };