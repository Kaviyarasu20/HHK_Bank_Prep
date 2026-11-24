import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  History,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import { adminCaApi } from "../../api/currentAffairs";
import { adminCaAiApi } from "../../api/currentAffairsAi";
import { getSafeExternalUrl } from "../../utils/safeUrl";
import { Field } from "../common/Field";

const SUPPORTED_EXAMS = [
  "IBPS PO",
  "IBPS Clerk",
  "SBI PO",
  "SBI Clerk",
  "IBPS RRB PO",
  "IBPS RRB Office Assistant",
  "RBI Grade B",
  "NABARD Grade A",
];

export function CurrentAffairsAIReview({ onToast, onConfirmModal }) {
  const [stats, setStats] = useState(null);
  const [aiConfig, setAiConfig] = useState(null);
  const [results, setResults] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [relevanceFilter, setRelevanceFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Active review detail
  const [activeDetail, setActiveDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [editForm, setEditForm] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [removedFactIds, setRemovedFactIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, listRes, artRes] = await Promise.all([
        adminCaAiApi.getStatistics(),
        adminCaAiApi.listResults({
          status: statusFilter,
          priority: priorityFilter,
          relevance: relevanceFilter,
          search,
          limit: 30,
        }),
        adminCaApi.listArticles({ limit: 30, page: 1 }),
      ]);
      setStats(statsRes.stats ?? null);
      setAiConfig(statsRes.aiConfig ?? null);
      setResults(listRes.items ?? []);
      setArticles(artRes.items ?? []);
    } catch (err) {
      setError(err.message || "Failed to load AI review dashboard.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, relevanceFilter, search]);

  useEffect(() => {
    const t = setTimeout(() => void loadDashboard(), search ? 200 : 0);
    return () => clearTimeout(t);
  }, [loadDashboard, search]);

  async function openReview(resultId) {
    setError("");
    try {
      const [detailRes, histRes] = await Promise.all([
        adminCaAiApi.getResult(resultId),
        adminCaAiApi.getHistory(resultId),
      ]);
      const r = detailRes.result;
      setActiveDetail(r);
      setHistory(histRes.history ?? []);
      setRemovedFactIds([]);
      setRejectReason("");
      setEditForm({
        examHeadline: r.exam_headline || "",
        summary: r.summary || "",
        detailedExplanation: r.detailed_explanation || "",
        whyItMatters: r.why_it_matters || "",
        takeawaysText: Array.isArray(r.takeaways) ? r.takeaways.join("\n") : "",
        bankingRelevanceScore: r.banking_relevance_score ?? 0,
        relevanceReason: r.relevance_reason || "",
        studyPriority: r.study_priority || "important",
        examCodes: (r.examTags || []).map((e) => e.exam_code),
      });
    } catch (err) {
      onToast?.(err.message || "Failed to load AI result details.", "error");
    }
  }

  async function handleProcessSingle(articleId) {
    setProcessing(true);
    try {
      const out = await adminCaAiApi.processArticle(articleId, false);
      onToast?.(
        out.skipped
          ? out.message
          : `AI processing finished (${out.processingStatus}). Review before approving.`,
        out.processingStatus === "failed" || out.processingStatus === "validation_failed"
          ? "error"
          : "success",
      );
      await loadDashboard();
      if (out.resultId) await openReview(out.resultId);
    } catch (err) {
      onToast?.(err.message || "AI processing failed.", "error");
    } finally {
      setProcessing(false);
    }
  }

  async function handleProcessBulk() {
    if (!selectedArticleIds.length) return;
    setProcessing(true);
    try {
      const out = await adminCaAiApi.processBulk(selectedArticleIds.slice(0, 10), false);
      onToast?.(
        `Bulk AI processing complete: ${out.succeeded} succeeded, ${out.failed} failed.`,
        out.failed > 0 ? "error" : "success",
      );
      setSelectedArticleIds([]);
      await loadDashboard();
    } catch (err) {
      onToast?.(err.message || "Bulk AI processing failed.", "error");
    } finally {
      setProcessing(false);
    }
  }

  async function handleSaveEdits() {
    if (!activeDetail || !editForm || saving) return;
    setSaving(true);
    try {
      await adminCaAiApi.updateResult(activeDetail.id, {
        examHeadline: editForm.examHeadline,
        summary: editForm.summary,
        detailedExplanation: editForm.detailedExplanation,
        whyItMatters: editForm.whyItMatters,
        takeaways: editForm.takeawaysText
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s.length >= 2),
        bankingRelevanceScore: Number(editForm.bankingRelevanceScore),
        relevanceReason: editForm.relevanceReason,
        studyPriority: editForm.studyPriority,
        examTags: editForm.examCodes.map((code) => ({ examCode: code, relevanceReason: "Admin verified" })),
        removeFactIds: removedFactIds,
      });
      onToast?.("AI draft edits saved.", "success");
      await openReview(activeDetail.id);
      await loadDashboard();
    } catch (err) {
      onToast?.(err.message || "Failed to save edits.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (!activeDetail) return;
    setSaving(true);
    try {
      await adminCaAiApi.approve(activeDetail.id, "Approved via Admin AI Review Dashboard");
      onToast?.("AI structured content approved for student display.", "success");
      await openReview(activeDetail.id);
      await loadDashboard();
    } catch (err) {
      onToast?.(err.message || "Approval failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    if (!activeDetail) return;
    const reason = rejectReason.trim() || "Rejected during editorial review";
    if (onConfirmModal) {
      const ok = await onConfirmModal({
        title: "Reject AI Result?",
        message: "This marks the AI draft as rejected so it will not be shown to students.",
        confirmText: "Reject Result",
        cancelText: "Cancel",
        type: "danger",
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await adminCaAiApi.reject(activeDetail.id, reason);
      onToast?.("AI result rejected.", "success");
      await openReview(activeDetail.id);
      await loadDashboard();
    } catch (err) {
      onToast?.(err.message || "Rejection failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    if (!activeDetail) return;
    setProcessing(true);
    try {
      const out = await adminCaAiApi.regenerate(activeDetail.id);
      onToast?.(`Regenerated new AI attempt (${out.processingStatus}).`, "success");
      await loadDashboard();
      if (out.resultId) await openReview(out.resultId);
    } catch (err) {
      onToast?.(err.message || "Regeneration failed.", "error");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div>
      {aiConfig && !aiConfig.enabled && (
        <div className="ca-error-banner" role="status">
          <span>
            <AlertTriangle size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
            AI processing is currently disabled (<code>CA_AI_ENABLED=false</code>). Set{" "}
            <code>CA_AI_ENABLED=true</code>, <code>CA_AI_PROVIDER</code>, and{" "}
            <code>CA_AI_API_KEY</code> in your server environment to run live structuring.
          </span>
        </div>
      )}

      {stats && (
        <div className="ca-stats-grid">
          <div className="ca-stat-card">
            <div className="ca-stat-label">Awaiting AI</div>
            <div className="ca-stat-value">{stats.awaitingAi}</div>
          </div>
          <div className="ca-stat-card">
            <div className="ca-stat-label">Processed</div>
            <div className="ca-stat-value">{stats.processed}</div>
          </div>
          <div className="ca-stat-card">
            <div className="ca-stat-label">Awaiting Review</div>
            <div className="ca-stat-value">{stats.awaitingReview}</div>
          </div>
          <div className="ca-stat-card">
            <div className="ca-stat-label">Approved / Rejected</div>
            <div className="ca-stat-value">{stats.approved} / {stats.rejected}</div>
          </div>
          <div className="ca-stat-card">
            <div className="ca-stat-label">Failed Attempts</div>
            <div className="ca-stat-value">{stats.failed}</div>
          </div>
          <div className="ca-stat-card">
            <div className="ca-stat-label">Must Study / High Rel.</div>
            <div className="ca-stat-value">{stats.mustStudy} / {stats.highlyRelevant}</div>
          </div>
        </div>
      )}

      {/* Trigger AI Processing on Existing Articles */}
      <section className="panel admin-panel">
        <div className="admin-panel-heading" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <span className="section-kicker">AI TRIAGE QUEUE</span>
            <h2>Process Current Affairs Articles with AI</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="primary-btn"
              disabled={processing || !selectedArticleIds.length}
              onClick={() => void handleProcessBulk()}
            >
              <Cpu size={14} />{" "}
              {processing
                ? "Processing…"
                : `Process Selected (${selectedArticleIds.length})`}
            </button>
            <button type="button" className="outline-btn" onClick={() => void loadDashboard()}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {articles.length === 0 ? (
          <div className="ca-state-box">No articles available to process.</div>
        ) : (
          <div className="ca-cat-table-wrap">
            <table className="ca-cat-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>Sel</th>
                  <th>Article</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {articles.slice(0, 12).map((a) => {
                  const checked = selectedArticleIds.includes(a.id);
                  return (
                    <tr key={a.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedArticleIds((prev) =>
                              e.target.checked
                                ? [...prev, a.id].slice(0, 10)
                                : prev.filter((id) => id !== a.id),
                            )
                          }
                        />
                      </td>
                      <td><strong>{a.title}</strong></td>
                      <td>{a.category}</td>
                      <td><span className={`ca-badge ca-badge--${a.status}`}>{a.status}</span></td>
                      <td>
                        <button
                          type="button"
                          className="outline-btn"
                          style={{ padding: "4px 9px", fontSize: 12 }}
                          disabled={processing}
                          onClick={() => void handleProcessSingle(a.id)}
                        >
                          <Cpu size={12} /> Structure
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Active Side-by-Side Editorial Review Panel */}
      {activeDetail && editForm && (
        <section className="panel admin-panel">
          <div className="admin-panel-heading" style={{ flexWrap: "wrap", gap: 10 }}>
            <div>
              <span className="section-kicker">EDITORIAL REVIEW</span>
              <h2>Review AI Draft · {activeDetail.processing_status}</h2>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="outline-btn" disabled={processing} onClick={() => void handleRegenerate()}>
                <RotateCcw size={13} /> Regenerate
              </button>
              <button type="button" className="outline-btn" disabled={saving} onClick={() => void handleSaveEdits()}>
                <Save size={13} /> Save Edits
              </button>
              <button type="button" className="primary-btn" disabled={saving} onClick={() => void handleApprove()}>
                <CheckCircle2 size={13} /> Approve
              </button>
              <button type="button" className="outline-btn" onClick={() => setActiveDetail(null)}>
                Close
              </button>
            </div>
          </div>

          {Array.isArray(activeDetail.validation_errors) && activeDetail.validation_errors.length > 0 && (
            <div className="ca-error-banner" role="alert">
              <div>
                <strong>Validation Warnings / Errors:</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {activeDetail.validation_errors.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="ba-overview-grid">
            <div className="ca-admin-article">
              <h3>Original Article (Source Evidence)</h3>
              <p style={{ fontSize: 13, color: "#64748b" }}>
                Category: {activeDetail.category} · Source: {activeDetail.source_name || "Unspecified"}
                {getSafeExternalUrl(activeDetail.source_url) && (
                  <>
                    {" "}·{" "}
                    <a
                      href={getSafeExternalUrl(activeDetail.source_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Official Source ↗
                    </a>
                  </>
                )}
              </p>
              <strong>{activeDetail.original_title}</strong>
              <p style={{ whiteSpace: "pre-wrap", fontSize: 13.5, marginTop: 8 }}>
                {activeDetail.original_body}
              </p>
            </div>

            <div className="ca-admin-article">
              <h3>AI Structured Content (Editable)</h3>
              <div className="ca-editor-grid">
                <Field
                  label="Exam-Friendly Headline"
                  value={editForm.examHeadline}
                  onChange={(v) => setEditForm((p) => ({ ...p, examHeadline: v }))}
                />
                <label className="form-field" style={{ margin: 0 }}>
                  Study Priority
                  <select
                    value={editForm.studyPriority}
                    onChange={(e) => setEditForm((p) => ({ ...p, studyPriority: e.target.value }))}
                  >
                    <option value="must_study">Must Study</option>
                    <option value="important">Important</option>
                    <option value="additional">Additional</option>
                  </select>
                </label>

                <label className="form-field" style={{ margin: 0 }}>
                  Banking Relevance Score (0–100)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editForm.bankingRelevanceScore}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, bankingRelevanceScore: Number(e.target.value) }))
                    }
                  />
                </label>
                <Field
                  label="Relevance Explanation"
                  value={editForm.relevanceReason}
                  onChange={(v) => setEditForm((p) => ({ ...p, relevanceReason: v }))}
                />

                <label className="form-field full-span" style={{ margin: 0 }}>
                  Short Summary
                  <textarea
                    rows={3}
                    value={editForm.summary}
                    onChange={(e) => setEditForm((p) => ({ ...p, summary: e.target.value }))}
                  />
                </label>

                <label className="form-field full-span" style={{ margin: 0 }}>
                  Detailed Explanation
                  <textarea
                    rows={3}
                    value={editForm.detailedExplanation}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, detailedExplanation: e.target.value }))
                    }
                  />
                </label>

                <label className="form-field full-span" style={{ margin: 0 }}>
                  Exam Takeaways (one per line)
                  <textarea
                    rows={3}
                    value={editForm.takeawaysText}
                    onChange={(e) => setEditForm((p) => ({ ...p, takeawaysText: e.target.value }))}
                  />
                </label>
              </div>

              <div style={{ marginTop: 10 }}>
                <strong style={{ fontSize: 13 }}>Recommended Banking Exams:</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {SUPPORTED_EXAMS.map((code) => {
                    const active = editForm.examCodes.includes(code);
                    return (
                      <label key={code} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              examCodes: e.target.checked
                                ? [...p.examCodes, code]
                                : p.examCodes.filter((c) => c !== code),
                            }))
                          }
                        />
                        {code}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Extracted Facts with Removal Controls */}
          <div style={{ marginTop: 14 }}>
            <h4>Extracted Key Facts ({(activeDetail.facts || []).length - removedFactIds.length})</h4>
            {(activeDetail.facts || [])
              .filter((f) => !removedFactIds.includes(f.id))
              .map((f) => (
                <div className="ba-mini-row" key={f.id}>
                  <div>
                    <span className="ca-badge ca-badge--important">{f.fact_type}</span>{" "}
                    <strong>{f.fact_text}</strong>
                    {f.fact_value && (
                      <span>
                        {" "}— {f.fact_value} {f.unit}
                      </span>
                    )}
                    {f.source_reference && (
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Source cue: “{f.source_reference}”
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="outline-btn"
                    style={{ padding: "3px 8px", fontSize: 12 }}
                    onClick={() => setRemovedFactIds((prev) => [...prev, f.id])}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              ))}
          </div>

          {/* Reject Form & History */}
          <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection feedback (required to reject)…"
              style={{ flex: 1, minWidth: 220 }}
            />
            <button type="button" className="outline-btn" disabled={saving} onClick={() => void handleReject()}>
              <XCircle size={13} /> Reject Result
            </button>
          </div>

          {history.length > 0 && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: "#64748b" }}>
              <History size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />
              <strong>Previous Attempts ({history.length}):</strong>{" "}
              {history
                .map(
                  (h) =>
                    `${h.processing_status} (${h.provider}/${h.model || "n/a"}, score ${h.banking_relevance_score ?? "—"})`,
                )
                .join(" · ")}
            </div>
          )}
        </section>
      )}

      {/* AI Results Review Queue */}
      <section className="panel admin-panel">
        <h2>AI Processing Results ({results.length})</h2>
        <div className="ca-admin-filters">
          <label className="form-field" style={{ margin: 0 }}>
            Search
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title or exam headline…" />
          </label>
          <label className="form-field" style={{ margin: 0 }}>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="review_required">Review Required</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="validation_failed">Validation Failed</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="form-field" style={{ margin: 0 }}>
            Priority
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">All priorities</option>
              <option value="must_study">Must Study</option>
              <option value="important">Important</option>
              <option value="additional">Additional</option>
            </select>
          </label>
          <label className="form-field" style={{ margin: 0 }}>
            Relevance
            <select value={relevanceFilter} onChange={(e) => setRelevanceFilter(e.target.value)}>
              <option value="all">All relevance levels</option>
              <option value="highly_relevant">Highly Relevant (80–100)</option>
              <option value="relevant">Relevant (60–79)</option>
              <option value="moderately_relevant">Moderately Relevant (40–59)</option>
              <option value="low_relevance">Low Relevance (0–39)</option>
            </select>
          </label>
        </div>

        {error && <div className="ca-error-banner" role="alert"><span>{error}</span></div>}

        {loading ? (
          <div className="ca-state-box">Loading AI results…</div>
        ) : results.length === 0 ? (
          <div className="ca-state-box">No AI processing results yet. Select an article above to process.</div>
        ) : (
          results.map((r) => (
            <div className="ca-admin-article" key={r.id}>
              <div className="ca-admin-article-header">
                <div>
                  <div className="ca-admin-meta">
                    <span className={`ca-badge ca-badge--${r.study_priority}`}>{r.study_priority.replace("_", " ")}</span>
                    <span className="ca-badge ca-badge--draft">{r.processing_status}</span>
                    <span>Score: <strong>{r.banking_relevance_score ?? "—"}/100</strong> ({r.banking_relevance_level.replace("_", " ")})</span>
                    <span>· {r.provider}/{r.model || "n/a"}</span>
                  </div>
                  <h3 style={{ margin: "4px 0" }}>{r.exam_headline || r.original_title}</h3>
                  {r.summary && <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "#475569" }}>{r.summary}</p>}
                  {r.error_message && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#991b1b" }}>{r.error_message}</p>}
                </div>
                <button type="button" className="outline-btn" onClick={() => void openReview(r.id)}>
                  Review &amp; Edit
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
