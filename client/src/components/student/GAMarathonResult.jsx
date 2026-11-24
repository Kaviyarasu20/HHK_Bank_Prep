import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, Lock, Sparkles } from "lucide-react";
import { gaMarathonStudentApi } from "../../api/phase9GaMarathon";

export function GAMarathonResult({ attemptId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    gaMarathonStudentApi
      .getAttemptResult(attemptId)
      .then((res) => {
        if (active) setResult(res.result || null);
      })
      .catch((err) => {
        if (active) setError(err?.message || "Unable to load GA Marathon result.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attemptId]);

  if (loading) {
    return (
      <div className="panel" style={{ padding: 20 }}>
        <p className="muted">Loading GA Marathon performance report...</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="panel" style={{ padding: 20, display: "grid", gap: 12 }}>
        <button type="button" className="outline-btn" onClick={onBack} style={{ width: "fit-content" }}>
          <ChevronLeft size={14} /> Back to GA Marathon
        </button>
        <div className="error-banner" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <AlertCircle size={16} /> <span>{error || "Result not available."}</span>
        </div>
      </div>
    );
  }

  const s = result.summary || {};
  const release = result.answerRelease || { allowed: false };
  const mins = Math.floor((s.elapsedSeconds || 0) / 60);
  const secs = (s.elapsedSeconds || 0) % 60;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel" style={{ padding: 18 }}>
        <button type="button" className="outline-btn" onClick={onBack}>
          <ChevronLeft size={14} /> Back to GA Marathon
        </button>
        <h2 style={{ margin: "12px 0 4px" }}>{s.testName || "GA Marathon Result"}</h2>
        <div className="muted" style={{ fontSize: 13 }}>
          Status: <strong>{s.status}</strong> · Time Taken: {mins}m {secs}s
          {result.meta?.capsuleTitle ? ` · Linked Capsule: ${result.meta.capsuleTitle}` : ""}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginTop: 14,
          }}
        >
          <div className="stat-card">
            <span className="muted">Score</span>
            <strong>{s.score} / {s.maxScore}</strong>
          </div>
          <div className="stat-card">
            <span className="muted">Accuracy</span>
            <strong>{s.accuracyPercent}%</strong>
          </div>
          <div className="stat-card">
            <span className="muted">Correct / Wrong</span>
            <strong>{s.correct} / {s.incorrect}</strong>
          </div>
          <div className="stat-card">
            <span className="muted">Unanswered</span>
            <strong>{s.unanswered}</strong>
          </div>
          <div className="stat-card">
            <span className="muted">Negative Marks</span>
            <strong>-{s.negativeMarksDeducted}</strong>
          </div>
        </div>
      </div>

      {/* Topic, Category & Difficulty Breakdowns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Topic-Wise Performance</h3>
          {(result.topicBreakdown || []).length === 0 ? (
            <p className="muted">No topic breakdown recorded.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {result.topicBreakdown.map((t) => (
                <div key={t.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{t.name}</span>
                  <strong>{t.correct}/{t.attempted} ({t.accuracyPercent}%)</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Category-Wise Performance</h3>
          {(result.categoryBreakdown || []).map((c) => (
            <div key={c.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span>{c.name.replace(/_/g, " ")}</span>
              <strong>{c.correct}/{c.attempted} ({c.accuracyPercent}%)</strong>
            </div>
          ))}
          <h3 style={{ marginTop: 14 }}>Difficulty-Wise</h3>
          {(result.difficultyBreakdown || []).map((d) => (
            <div key={d.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span>{d.name}</span>
              <strong>{d.correct}/{d.attempted} ({d.accuracyPercent}%)</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Improvement Recommendations */}
      {(result.recommendations || []).length > 0 && (
        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={16} /> Recommended Next Revision Steps
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {result.recommendations.map((rec) => (
              <div key={rec.topic} className="panel" style={{ padding: 10 }}>
                <strong>{rec.topic}</strong>
                <div className="muted" style={{ fontSize: 13 }}>{rec.reason}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{rec.suggestedAction}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Answer Review */}
      <div className="panel" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Answer Review</h3>
        {!release.allowed ? (
          <div className="info-banner" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Lock size={16} /> <span>{release.reason || "Answer review is currently locked."}</span>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {(result.review || []).map((item, idx) => (
              <div key={item.questionId} className="panel" style={{ padding: 12, display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                  <strong>Q{idx + 1}. {item.questionText}</strong>
                  <span className="ca-badge">{item.topic} · {item.difficulty}</span>
                </div>
                <div style={{ fontSize: 13 }}>
                  Your Answer: <strong>{item.selectedAnswer || "Unanswered"}</strong> · Correct Answer:{" "}
                  <strong style={{ color: "#15803d" }}>{item.correctAnswer}</strong>{" "}
                  {item.isCorrect && <CheckCircle2 size={14} style={{ verticalAlign: "middle", color: "#15803d" }} />}
                </div>
                {item.explanation && (
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                    Explanation: {item.explanation}
                  </p>
                )}
                {item.sourceArticleTitle && (
                  <div className="muted" style={{ fontSize: 12 }}>
                    Source Article: {item.sourceArticleTitle}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
