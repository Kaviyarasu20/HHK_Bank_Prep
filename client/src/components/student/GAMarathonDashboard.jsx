import { useCallback, useEffect, useState } from "react";
import { Award, CheckCircle2, Clock, Lock, Play, RefreshCw, Sparkles } from "lucide-react";
import { gaMarathonStudentApi } from "../../api/phase9GaMarathon";
import { GAMarathonResult } from "./GAMarathonResult";

export function GAMarathonDashboard({ onStartGaTest }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [examFilter, setExamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewingAttemptId, setViewingAttemptId] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await gaMarathonStudentApi.getDashboard();
      setData(res);
    } catch (err) {
      setError(err?.message || "Unable to load GA Marathon dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (viewingAttemptId) {
    return (
      <GAMarathonResult
        attemptId={viewingAttemptId}
        onBack={() => {
          setViewingAttemptId("");
          loadDashboard();
        }}
      />
    );
  }

  if (loading && !data) {
    return (
      <div className="panel" style={{ padding: 20 }}>
        <p className="muted">Loading GA Marathon tests and performance...</p>
      </div>
    );
  }

  const perf = data?.performance || {};
  const categories = data?.categories || [];
  const exams = data?.exams || [];
  const recommended = data?.recommended || [];
  const recentAttempts = data?.recentAttempts || [];

  const filteredTests = (data?.tests || []).filter((t) => {
    if (categoryFilter && t.ga_category !== categoryFilter) return false;
    if (examFilter && !(Array.isArray(t.target_exams) && t.target_exams.includes(examFilter))) return false;
    if (statusFilter === "upcoming" && t.availability_state !== "upcoming") return false;
    if (statusFilter === "completed" && !t.latest_completed_attempt_id) return false;
    if (statusFilter === "in_progress" && !t.active_attempt_id) return false;
    return true;
  });

  const handleLaunch = (testId) => {
    if (typeof onStartGaTest === "function") {
      onStartGaTest(testId);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header & Real Performance Strip */}
      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Award size={18} /> GA Marathon (CBT & Subscription Integrated)
            </h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Timed General Awareness & Banking Awareness mock tests powered by approved Phase 6 MCQs and HHK's CBT engine.
            </p>
          </div>
          <button type="button" className="outline-btn" onClick={loadDashboard} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
            gap: 10,
            marginTop: 14,
          }}
        >
          <div className="stat-card">
            <span className="muted">Completed Tests</span>
            <strong>{perf.completedTests ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span className="muted">Questions Attempted</span>
            <strong>{perf.totalQuestionsAttempted ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span className="muted">Overall Accuracy</span>
            <strong>{perf.overallAccuracy ?? 0}%</strong>
          </div>
          <div className="stat-card">
            <span className="muted">Avg / Best Score</span>
            <strong>{perf.averageScore ?? 0} / {perf.bestScore ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span className="muted">Current Affairs Acc.</span>
            <strong>{perf.currentAffairsAccuracy ?? 0}%</strong>
          </div>
          <div className="stat-card">
            <span className="muted">Banking Awareness Acc.</span>
            <strong>{perf.bankingAwarenessAccuracy ?? 0}%</strong>
          </div>
        </div>

        {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {/* Recommended Tests */}
      {recommended.length > 0 && (
        <div className="panel" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={16} /> Recommended for You
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 }}>
            {recommended.slice(0, 3).map((t) => (
              <div key={t.id} className="panel" style={{ padding: 14, display: "grid", gap: 6 }}>
                <strong>{t.name}</strong>
                <div className="muted" style={{ fontSize: 12 }}>{t.recommendation_reason}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {t.question_count || t.target_questions} Qs · {Math.round((t.duration_seconds || 0) / 60)} min · Max {t.max_marks} marks
                </div>
                <button type="button" className="primary-btn" onClick={() => handleLaunch(t.id)}>
                  {t.has_access ? <><Play size={13} /> Start Test</> : <><Lock size={13} /> Unlock / Subscribe</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar & Test Catalog */}
      <div className="panel" style={{ padding: 18, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All GA Categories</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          <select value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
            <option value="">All Target Exams</option>
            {exams.map((ex) => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>

        {filteredTests.length === 0 ? (
          <p className="muted">No published GA Marathon tests match your current filters.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {filteredTests.map((t) => {
              const limitReached = t.attempt_limit && t.attempts_used >= t.attempt_limit;
              return (
                <div key={t.id} className="panel" style={{ padding: 16, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
                    <span className="ca-badge">{String(t.ga_category || "").replace(/_/g, " ")}</span>
                    <span className="ca-badge">
                      {t.has_access ? "Access Granted" : t.access_type === "PAID" ? `Paid (₹${((t.price_paise || 0) / 100).toFixed(0)})` : "Subscription Required"}
                    </span>
                  </div>

                  <h3 style={{ margin: 0 }}>{t.name}</h3>
                  {!t.is_official_pattern && (
                    <span className="muted" style={{ fontSize: 11 }}>HHK Practice Test</span>
                  )}

                  <div className="muted" style={{ fontSize: 13 }}>
                    {t.question_count || t.target_questions} Questions · {t.max_marks} Marks ·{" "}
                    <Clock size={12} style={{ verticalAlign: "middle" }} /> {Math.round((t.duration_seconds || 0) / 60)} min ·{" "}
                    {t.difficulty_label || "Moderate"}
                  </div>

                  {Array.isArray(t.target_exams) && t.target_exams.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {t.target_exams.map((ex) => (
                        <span key={ex} className="ca-badge" style={{ fontSize: 11 }}>{ex}</span>
                      ))}
                    </div>
                  )}

                  {t.capsule_title && (
                    <div className="muted" style={{ fontSize: 12 }}>Capsule: {t.capsule_title}</div>
                  )}

                  <div className="muted" style={{ fontSize: 12 }}>
                    Attempts: {t.attempts_used || 0}{t.attempt_limit ? ` / ${t.attempt_limit}` : " (Unlimited)"}
                    {t.latest_score !== null && t.latest_score !== undefined ? ` · Last Score: ${t.latest_score}` : ""}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={t.availability_state === "upcoming" || t.availability_state === "closed" || limitReached}
                      onClick={() => handleLaunch(t.id)}
                    >
                      {t.availability_state === "upcoming"
                        ? "Upcoming"
                        : limitReached
                          ? "Attempt Limit Reached"
                          : t.active_attempt_id
                            ? "Resume Attempt"
                            : t.has_access
                              ? "Start CBT Test"
                              : "Unlock / Subscribe"}
                    </button>
                    {t.latest_completed_attempt_id && (
                      <button
                        type="button"
                        className="outline-btn"
                        onClick={() => setViewingAttemptId(t.latest_completed_attempt_id)}
                      >
                        <CheckCircle2 size={13} /> View Analysis
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Attempts History */}
      {recentAttempts.length > 0 && (
        <div className="panel" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Recent GA Marathon Attempts</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {recentAttempts.map((a) => (
              <div
                key={a.attempt_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--border-color, #e5e7eb)",
                }}
              >
                <div>
                  <strong>{a.test_name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Status: {a.status} · Score: {a.score ?? 0}/{a.max_score ?? 0} · Correct: {a.correct_count ?? 0} · Wrong: {a.wrong_count ?? 0}
                  </div>
                </div>
                {a.status !== "in_progress" && (
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() => setViewingAttemptId(a.attempt_id)}
                  >
                    Review & Analysis
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
