import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Cpu, RefreshCw, XCircle } from "lucide-react";
import { adminCaApi } from "../../api/currentAffairs";
import { adminOneLinersApi } from "../../api/currentAffairsRevision";

export function CurrentAffairsOneLinerAdmin({ onToast }) {
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [articles, setArticles] = useState([]);
  const [articleId, setArticleId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, lRes, aRes] = await Promise.all([
        adminOneLinersApi.getStatistics(),
        adminOneLinersApi.list({ status: statusFilter, limit: 40 }),
        adminCaApi.listArticles({ limit: 25, page: 1 }),
      ]);
      setStats(sRes.stats ?? null);
      setItems(lRes.items ?? []);
      setArticles(aRes.items ?? []);
      if (!articleId && aRes.items?.[0]?.id) setArticleId(aRes.items[0].id);
    } catch (err) {
      onToast?.(err.message || "Failed to load One-Liner Admin.", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, articleId, onToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleGenerate() {
    if (!articleId || generating) return;
    setGenerating(true);
    try {
      const out = await adminOneLinersApi.generate({ articleId, maxItems: 4 });
      onToast?.(`Generated ${out.items?.length ?? 0} draft one-liner(s).`, "success");
      await loadAll();
    } catch (err) {
      onToast?.(err.message || "Generation failed.", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(id) {
    try {
      await adminOneLinersApi.approve(id);
      onToast?.("One-liner approved and published.", "success");
      await loadAll();
    } catch (err) {
      onToast?.(err.message || "Approval failed.", "error");
    }
  }

  async function handleReject(id) {
    try {
      await adminOneLinersApi.reject(id);
      onToast?.("One-liner rejected.", "success");
      await loadAll();
    } catch (err) {
      onToast?.(err.message || "Rejection failed.", "error");
    }
  }

  return (
    <div>
      {stats && (
        <div className="ca-stats-grid">
          <div className="ca-stat-card"><div className="ca-stat-label">Total One-Liners</div><div className="ca-stat-value">{stats.total}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Pending Review</div><div className="ca-stat-value">{stats.pendingReview}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Approved</div><div className="ca-stat-value">{stats.approved}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Rejected</div><div className="ca-stat-value">{stats.rejected}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Duplicates</div><div className="ca-stat-value">{stats.duplicates}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Must Study</div><div className="ca-stat-value">{stats.mustStudy}</div></div>
        </div>
      )}

      <section className="panel admin-panel">
        <div className="admin-panel-heading" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <span className="section-kicker">ONE-LINER DIGEST</span>
            <h2>Generate &amp; Approve One-Liners</h2>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={articleId} onChange={(e) => setArticleId(e.target.value)} style={{ maxWidth: 320 }}>
              {articles.map((a) => <option key={a.id} value={a.id}>{a.title.slice(0, 70)}</option>)}
            </select>
            <button type="button" className="primary-btn" disabled={generating || !articleId} onClick={() => void handleGenerate()}>
              <Cpu size={14} /> {generating ? "Generating…" : "Generate One-Liners"}
            </button>
            <button type="button" className="outline-btn" onClick={() => void loadAll()}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="affair-status">
            <option value="all">All statuses</option>
            <option value="draft">Draft (Pending)</option>
            <option value="published">Published</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div className="ca-state-box">Loading one-liners…</div>
        ) : items.length === 0 ? (
          <div className="ca-state-box">No one-liners found.</div>
        ) : (
          items.map((o) => (
            <div className="ca-admin-article" key={o.id}>
              <div className="ca-admin-article-header">
                <div>
                  <div className="ca-admin-meta">
                    <span className={`ca-badge ca-badge--${o.publication_status === "published" ? "published" : "draft"}`}>
                      {o.publication_status}
                    </span>
                    <span className={`ca-badge ca-badge--${o.study_priority}`}>{o.study_priority}</span>
                    <span>{o.category_name}</span>
                    {o.duplicate_status !== "unique" && <span style={{ color: "#991b1b" }}>· {o.duplicate_status}</span>}
                  </div>
                  <p style={{ margin: "6px 0", fontWeight: 600, color: "#0f172a" }}>{o.fact_text}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {o.publication_status !== "published" && (
                    <button type="button" className="primary-btn" onClick={() => void handleApprove(o.id)}>
                      <CheckCircle2 size={13} /> Approve
                    </button>
                  )}
                  {o.publication_status !== "rejected" && (
                    <button type="button" className="outline-btn" onClick={() => void handleReject(o.id)}>
                      <XCircle size={13} /> Reject
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
