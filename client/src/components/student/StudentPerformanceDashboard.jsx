import { useEffect, useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import { phase10AnalyticsApi } from "../../api/phase10Analytics";

export function StudentPerformanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    let active = true;
    phase10AnalyticsApi
      .getStudentPerformance()
      .then((res) => {
        if (active) setAnalytics(res.analytics || null);
      })
      .catch((err) => {
        if (active) setError(err?.message || "Unable to load performance analytics.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="panel" style={{ padding: 18, marginTop: 16 }}>
        <p className="muted">Loading cross-module preparation analytics...</p>
      </div>
    );
  }
  if (error || !analytics) {
    return error ? <div className="error-banner" style={{ marginTop: 16 }}>{error}</div> : null;
  }

  const ov = analytics.overall || {};
  const lp = analytics.learningProgress || {};
  const topics = analytics.topicBreakdown || [];
  const weak = analytics.weakTopics || [];
  const trends = analytics.trends || [];

  return (
    <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
      <div className="panel" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 size={17} /> Cross-Module Preparation Progress
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10 }}>
          <div className="stat-card"><span className="muted">Completed Tests</span><strong>{ov.completedTests ?? 0}</strong></div>
          <div className="stat-card"><span className="muted">Overall Accuracy</span><strong>{ov.averageAccuracy ?? 0}%</strong></div>
          <div className="stat-card"><span className="muted">Avg / Best Score</span><strong>{ov.averageScore ?? 0} / {ov.bestScore ?? 0}</strong></div>
          <div className="stat-card"><span className="muted">Articles Read</span><strong>{lp.articles_read ?? 0}</strong></div>
          <div className="stat-card"><span className="muted">Flashcards Studied</span><strong>{lp.flashcards_reviewed ?? 0}</strong></div>
          <div className="stat-card"><span className="muted">Smart Revisions</span><strong>{lp.revision_reviews_completed ?? 0}</strong></div>
          <div className="stat-card"><span className="muted">Capsules Completed</span><strong>{lp.capsules_completed ?? 0}</strong></div>
          <div className="stat-card"><span className="muted">GA Marathons Done</span><strong>{lp.ga_marathons_completed ?? 0}</strong></div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <div className="panel" style={{ padding: 16 }}>
          <h4 style={{ marginTop: 0 }}>Topic-Wise Accuracy ({topics.length})</h4>
          {topics.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Attempt mock tests or GA Marathons to see topic-wise accuracy.</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {topics.slice(0, 10).map((t) => (
                <div key={t.topicName} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{t.topicName}</span>
                  <strong>{t.correctCount}/{t.attemptsCount} ({t.accuracyPercent}%)</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <h4 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <TrendingUp size={15} /> 30-Day Score & Accuracy Trend
          </h4>
          {trends.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>No completed test attempts in the last 30 days yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {trends.map((tr) => (
                <div key={tr.date} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{tr.date} ({tr.testsCompleted} test{tr.testsCompleted === 1 ? "" : "s"})</span>
                  <strong>Avg {tr.avgScore} · {tr.accuracyPercent}%</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {weak.length > 0 && (
        <div className="panel" style={{ padding: 16 }}>
          <h4 style={{ marginTop: 0 }}>Weak Topics (Minimum 5 Answered Questions)</h4>
          <div style={{ display: "grid", gap: 6 }}>
            {weak.map((w) => (
              <div key={w.topicName} style={{ fontSize: 13 }}>
                <strong>{w.topicName}</strong> — {w.explanation}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
