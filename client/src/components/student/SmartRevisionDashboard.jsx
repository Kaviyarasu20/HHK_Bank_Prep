import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { smartRevisionApi } from "../../api/phase8RevisionCapsules";

const EXAM_OPTIONS = [
  "IBPS PO",
  "IBPS Clerk",
  "SBI PO",
  "SBI Clerk",
  "RBI Grade B",
  "RBI Assistant",
  "RRB PO",
  "RRB Clerk",
  "NABARD",
  "LIC AAO",
];

const PRIORITY_LABELS = {
  must_study: { label: "Must Study", cls: "ca-badge-priority-must" },
  important: { label: "Important", cls: "ca-badge-priority-important" },
  additional: { label: "Additional", cls: "ca-badge-priority-additional" },
};

const CONTENT_TYPE_LABELS = {
  flashcard: "Flashcard",
  one_liner: "One-Liner",
  mcq: "MCQ",
  article: "Article",
  banking_reference: "Banking Ref",
};

export function SmartRevisionDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [daily, setDaily] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [submittingId, setSubmittingId] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefLimit, setPrefLimit] = useState(15);
  const [prefExams, setPrefExams] = useState([]);
  const [feedback, setFeedback] = useState("");

  const loadDaily = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await smartRevisionApi.getDaily();
      setDaily(data);
      if (data?.preferences) {
        setPrefLimit(data.preferences.dailyItemLimit || 15);
        setPrefExams(Array.isArray(data.preferences.targetExams) ? data.preferences.targetExams : []);
      }
    } catch (err) {
      setError(err?.message || "Unable to load Smart Revision plan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  const handleLoadHistory = async () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next && history.length === 0) {
      try {
        const res = await smartRevisionApi.getHistory(25);
        setHistory(res.history || []);
      } catch {
        // non-fatal
      }
    }
  };

  const handleReview = async (itemId, outcome) => {
    if (!itemId) return;
    setSubmittingId(itemId);
    setFeedback("");
    try {
      const res = await smartRevisionApi.submitReview(itemId, outcome);
      setFeedback(
        `Recorded "${outcome}" — next review scheduled in ${res.schedule?.nextIntervalDays ?? 0} day(s).`,
      );
      await loadDaily();
      if (showHistory) {
        const h = await smartRevisionApi.getHistory(25);
        setHistory(h.history || []);
      }
    } catch (err) {
      setError(err?.message || "Failed to record revision outcome.");
    } finally {
      setSubmittingId("");
    }
  };

  const handleSavePrefs = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    setFeedback("");
    try {
      await smartRevisionApi.updatePreferences({
        dailyItemLimit: Number(prefLimit) || 15,
        targetExams: prefExams,
      });
      setShowPrefs(false);
      setFeedback("Revision preferences saved.");
      await loadDaily();
    } catch (err) {
      setError(err?.message || "Failed to save preferences.");
    } finally {
      setSavingPrefs(false);
    }
  };

  const toggleExam = (code) => {
    setPrefExams((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code],
    );
  };

  if (loading && !daily) {
    return (
      <div className="panel" style={{ padding: 20 }}>
        <p className="muted">Building your personalized Smart Revision plan...</p>
      </div>
    );
  }

  const plan = daily?.plan || { items: [], totalItems: 0, totalEstimatedMinutes: 0, completedToday: 0, breakdown: {} };
  const weakTopics = daily?.weakTopics || [];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={18} /> Smart Revision Plan
            </h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Prioritized from your real practice mistakes, weak topics, bookmarks, and due flashcards.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="outline-btn" onClick={() => setShowPrefs((v) => !v)}>
              <SlidersHorizontal size={14} /> Preferences
            </button>
            <button type="button" className="outline-btn" onClick={handleLoadHistory}>
              <Clock size={14} /> {showHistory ? "Hide History" : "Revision History"}
            </button>
            <button type="button" className="outline-btn" onClick={loadDaily} disabled={loading}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            marginTop: 14,
          }}
        >
          <div className="stat-card">
            <span className="muted">Today's Queue</span>
            <strong>{plan.totalItems} items</strong>
          </div>
          <div className="stat-card">
            <span className="muted">Must Study</span>
            <strong>{plan.breakdown?.must_study ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span className="muted">Completed Today</span>
            <strong>{plan.completedToday ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span className="muted">Estimated Time</span>
            <strong>{plan.totalEstimatedMinutes ?? 0} min</strong>
          </div>
        </div>

        {error && (
          <div className="error-banner" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} /> <span>{error}</span>
          </div>
        )}
        {feedback && (
          <div className="info-banner" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} /> <span>{feedback}</span>
          </div>
        )}

        {showPrefs && (
          <form onSubmit={handleSavePrefs} className="panel" style={{ marginTop: 14, padding: 14 }}>
            <h3 style={{ marginTop: 0 }}>Revision Preferences</h3>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 4, maxWidth: 260 }}>
                <span>Daily item limit (3–50)</span>
                <input
                  type="number"
                  min={3}
                  max={50}
                  value={prefLimit}
                  onChange={(e) => setPrefLimit(e.target.value)}
                />
              </label>
              <div>
                <div style={{ marginBottom: 6 }}>Target Banking Exams</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {EXAM_OPTIONS.map((code) => (
                    <button
                      key={code}
                      type="button"
                      className={prefExams.includes(code) ? "primary-btn" : "outline-btn"}
                      onClick={() => toggleExam(code)}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <button type="submit" className="primary-btn" disabled={savingPrefs}>
                  {savingPrefs ? "Saving..." : "Save Preferences"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Daily Revision Queue */}
      <div className="panel" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>Today's Priority Items</h3>
        {plan.items.length === 0 ? (
          <p className="muted">
            No revision items are due right now. Practice MCQs, bookmark articles, or review flashcards to populate your personalized queue.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {plan.items.map((item) => {
              const prio = PRIORITY_LABELS[item.priorityLevel] || PRIORITY_LABELS.important;
              return (
                <div
                  key={item.id || `${item.contentType}:${item.contentId}`}
                  className="panel"
                  style={{ padding: 14, display: "grid", gap: 8 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span className={`ca-badge ${prio.cls}`}>{prio.label}</span>
                      <span className="ca-badge">{CONTENT_TYPE_LABELS[item.contentType] || item.contentType}</span>
                      {item.topic && <span className="ca-badge">{item.topic}</span>}
                      <span className="muted" style={{ fontSize: 12 }}>
                        Stage {item.revisionStage ?? 0}/5 · ~{item.estimatedMinutes || 1} min
                      </span>
                    </div>
                    <span className="muted" style={{ fontSize: 12 }}>
                      Score: {item.priorityScore}/100
                    </span>
                  </div>

                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Why recommended: {item.recommendationReason}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    <button
                      type="button"
                      className="outline-btn"
                      disabled={submittingId === item.id}
                      onClick={() => handleReview(item.id, "again")}
                    >
                      Again (4h)
                    </button>
                    <button
                      type="button"
                      className="outline-btn"
                      disabled={submittingId === item.id}
                      onClick={() => handleReview(item.id, "hard")}
                    >
                      Hard (1d)
                    </button>
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={submittingId === item.id}
                      onClick={() => handleReview(item.id, "good")}
                    >
                      Good
                    </button>
                    <button
                      type="button"
                      className="outline-btn"
                      disabled={submittingId === item.id}
                      onClick={() => handleReview(item.id, "easy")}
                    >
                      Easy
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Weak Topics */}
      <div className="panel" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>Detected Weak Topics</h3>
        {weakTopics.length === 0 ? (
          <p className="muted">
            No weak topics flagged yet. Topics are analyzed once you have answered at least 5 questions in a topic (unanswered questions are never penalized).
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {weakTopics.map((wt) => (
              <div key={wt.topicName} className="panel" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <strong>{wt.topicName}</strong>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {wt.accuracyPercent}% accuracy · {wt.attemptsCount} answered · {wt.avgResponseSeconds}s avg
                  </span>
                </div>
                <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
                  {wt.explanation}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Optional History */}
      {showHistory && (
        <div className="panel" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Recent Revision History</h3>
          {history.length === 0 ? (
            <p className="muted">No completed reviews recorded yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {history.map((h) => (
                <div
                  key={h.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--border-color, #e5e7eb)",
                  }}
                >
                  <div>
                    <strong>{h.title || h.content_id}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {h.content_type} · Outcome: {h.review_outcome} · Stage {h.revision_stage}
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {h.reviewed_at ? new Date(h.reviewed_at).toLocaleString() : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
