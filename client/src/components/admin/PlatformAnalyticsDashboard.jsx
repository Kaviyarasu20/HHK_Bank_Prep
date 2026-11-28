import { CustomSelect } from "../common/CustomSelect.jsx";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, RefreshCw, ShieldCheck } from "lucide-react";
import { phase10AnalyticsApi } from "../../api/phase10Analytics";

export function PlatformAnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState(null);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError("");
    try {
      const res = await phase10AnalyticsApi.getAdminOverview({ days, refresh: forceRefresh });
      setAnalytics(res.analytics || null);
    } catch (err) {
      setError(err?.message || "Unable to load platform analytics.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load(false);
  }, [load]);

  if (loading && !analytics) {
    return (
      <div className="panel" style={{ padding: 20 }}>
        <p className="muted">Loading real-time platform analytics...</p>
      </div>
    );
  }

  const ov = analytics?.overview || {};
  const ga = analytics?.gaMarathon || {};
  const content = analytics?.content || {};
  const subs = analytics?.subscriptions || {};
  const fin = subs.financial || {};
  const exams = analytics?.examPreferences || [];
  const defs = analytics?.definitions || {};

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <BarChart3 size={18} /> HHK Platform Analytics
            </h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
              Live database-backed overview ({days}-day window · {defs.timezone || "UTC"}).
              {analytics?.cached ? " (Cached 60s)" : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <CustomSelect value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
              <option value={365}>Last 365 Days</option>
            </CustomSelect>
            <button type="button" className="outline-btn" onClick={() => load(true)} disabled={loading}>
              <RefreshCw size={14} /> Refresh Live
            </button>
          </div>
        </div>

        {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            marginTop: 14,
          }}
        >
          <div className="stat-card"><span className="muted">Total Students</span><strong>{ov.total_students ?? 0}</strong></div>
          <div className="stat-card"><span className="muted">New ({days}d)</span><strong>{ov.new_registrations ?? 0}</strong></div>
          <div className="stat-card"><span className="muted">DAU / WAU / MAU</span><strong>{ov.dau ?? 0} / {ov.wau ?? 0} / {ov.mau ?? 0}</strong></div>
          <div className="stat-card"><span className="muted">CBT Attempts (Done)</span><strong>{ov.total_test_attempts ?? 0} ({ov.completed_test_attempts ?? 0})</strong></div>
          <div className="stat-card"><span className="muted">Published GA Tests</span><strong>{ov.published_ga_tests ?? 0}</strong></div>
          <div className="stat-card"><span className="muted">Articles / MCQs</span><strong>{ov.published_articles ?? 0} / {ov.approved_mcqs ?? 0}</strong></div>
          <div className="stat-card"><span className="muted">One-Liners / Cards</span><strong>{ov.published_one_liners ?? 0} / {ov.published_flashcards ?? 0}</strong></div>
          <div className="stat-card"><span className="muted">Monthly Capsules</span><strong>{ov.published_capsules ?? 0}</strong></div>
        </div>
      </div>

      {/* GA Marathon & Content Engagement */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>GA Marathon Analytics</h3>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <div>Tests Created / Published: <strong>{ga.ga_tests_created ?? 0} / {ga.ga_tests_published ?? 0}</strong></div>
            <div>Total / Completed / Abandoned: <strong>{ga.ga_total_attempts ?? 0} / {ga.ga_completed_attempts ?? 0} / {ga.ga_abandoned_attempts ?? 0}</strong></div>
            <div>Average Score: <strong>{ga.ga_avg_score ?? 0}</strong></div>
            <div>Avg Completion Time: <strong>{ga.ga_avg_completion_seconds ?? 0}s</strong></div>
          </div>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Content & Revision Engagement</h3>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <div>Articles Read / Bookmarked: <strong>{content.total_articles_read ?? 0} / {content.total_articles_bookmarked ?? 0}</strong></div>
            <div>Flashcards Studied (Difficult): <strong>{content.total_flashcards_studied ?? 0} ({content.difficult_flashcards_count ?? 0})</strong></div>
            <div>Smart Revision Reviews: <strong>{content.total_revision_reviews ?? 0}</strong></div>
            <div>Avg Capsule Completion: <strong>{content.avg_capsule_completion_percent ?? 0}%</strong></div>
          </div>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Subscription & Payment Analytics ({days}d)</h3>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <div>Active / Expired / Cancelled: <strong>{subs.active_subscriptions ?? 0} / {subs.expired_subscriptions ?? 0} / {subs.cancelled_subscriptions ?? 0}</strong></div>
            <div>Paid / Failed / Pending Orders: <strong>{fin.paidOrdersCount ?? 0} / {fin.failedOrdersCount ?? 0} / {fin.pendingOrdersCount ?? 0}</strong></div>
            <div>Gross Collected / Refunded: <strong>₹{fin.grossCollectedInr ?? 0} / ₹{fin.totalRefundedInr ?? 0}</strong></div>
            <div>Net Collected: <strong>₹{fin.netCollectedInr ?? 0}</strong> (Success Rate: {fin.paymentSuccessRatePercent ?? 0}%)</div>
          </div>
        </div>
      </div>

      {/* Exam Preferences */}
      <div className="panel" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Student Target-Exam Preferences</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          Reflects student-selected preparation targets only (not official exam registration).
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {exams.map((e) => (
            <span key={e.examCode} className="ca-badge">
              {e.examCode}: <strong>{e.studentsTargeting}</strong>
            </span>
          ))}
        </div>
      </div>

      {/* Metric Definitions */}
      <div className="panel" style={{ padding: 14, fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, marginBottom: 4 }}>
          <ShieldCheck size={14} /> Metric Definitions & Financial Integrity
        </div>
        <div className="muted">• Active Student: {defs.activeStudentDefinition}</div>
        <div className="muted">• Revenue: {defs.revenueDefinition}</div>
      </div>
    </div>
  );
}
