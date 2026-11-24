import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Edit2,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { adminCaApi } from "../../api/currentAffairs";
import { adminBankingApi } from "../../api/bankingAwareness";
import { adminCaQuestionsApi } from "../../api/currentAffairsQuestions";

const EXAM_CODES = [
  "IBPS PO",
  "IBPS Clerk",
  "IBPS RRB PO",
  "IBPS RRB Office Assistant",
  "SBI PO",
  "SBI Clerk",
  "RBI Grade B",
  "NABARD Grade A",
];

const QUESTION_TYPES = [
  { code: "direct_factual", label: "Direct Factual MCQ" },
  { code: "statement_based", label: "Statement-Based MCQ" },
  { code: "match_following", label: "Match the Following" },
  { code: "correct_incorrect", label: "Correct / Incorrect Statement" },
  { code: "fill_blank", label: "Fill in the Blank" },
  { code: "assertion_reason", label: "Assertion & Reason" },
  { code: "chronology", label: "Chronology-Based MCQ" },
  { code: "numerical_data", label: "Numerical & Data-Based MCQ" },
  { code: "institution_abbreviation", label: "Institution & Abbreviation MCQ" },
];

const REF_ENTITIES = [
  { code: "rates", label: "RBI Policy Rates" },
  { code: "limits", label: "Banking Limits" },
  { code: "institutions", label: "Banking Institutions" },
  { code: "regulatory_bodies", label: "Regulatory Bodies" },
  { code: "leaders", label: "Banking Leaders" },
  { code: "static_gk", label: "Static GK" },
  { code: "terminology", label: "Banking Terminology" },
];

export function CurrentAffairsQuestionGenerator({ onToast, onConfirmModal }) {
  const [stats, setStats] = useState(null);
  const [batches, setBatches] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [articles, setArticles] = useState([]);
  const [refRecords, setRefRecords] = useState([]);

  // Generator config
  const [sourceType, setSourceType] = useState("current_affairs");
  const [sourceArticleId, setSourceArticleId] = useState("");
  const [sourceRefType, setSourceRefType] = useState("terminology");
  const [sourceRefId, setSourceRefId] = useState("");
  const [examCode, setExamCode] = useState("IBPS PO");
  const [questionType, setQuestionType] = useState("direct_factual");
  const [difficulty, setDifficulty] = useState("moderate");
  const [count, setCount] = useState(3);

  // Review queue filters
  const [reviewFilter, setReviewFilter] = useState("all");
  const [valFilter, setValFilter] = useState("all");
  const [dupFilter, setDupFilter] = useState("all");
  const [examFilter, setExamFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Active detail / editor
  const [activeQ, setActiveQ] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, batchRes, qRes, artRes] = await Promise.all([
        adminCaQuestionsApi.getStatistics(),
        adminCaQuestionsApi.listBatches({ limit: 8 }),
        adminCaQuestionsApi.listQuestions({
          reviewStatus: reviewFilter,
          validationStatus: valFilter,
          duplicateStatus: dupFilter,
          examCode: examFilter,
          search,
          limit: 25,
        }),
        adminCaApi.listArticles({ limit: 25, page: 1 }),
      ]);
      setStats(statsRes.stats ?? null);
      setBatches(batchRes.items ?? []);
      setQuestions(qRes.items ?? []);
      setArticles(artRes.items ?? []);
      if (!sourceArticleId && artRes.items?.[0]?.id) {
        setSourceArticleId(artRes.items[0].id);
      }
    } catch (err) {
      setError(err.message || "Failed to load MCQ Generator dashboard.");
    } finally {
      setLoading(false);
    }
  }, [reviewFilter, valFilter, dupFilter, examFilter, search, sourceArticleId]);

  useEffect(() => {
    const t = setTimeout(() => void loadAll(), search ? 200 : 0);
    return () => clearTimeout(t);
  }, [loadAll, search]);

  useEffect(() => {
    if (sourceType !== "banking_reference") return;
    const entitySlug = sourceRefType === "regulatory_bodies" ? "regulatory-bodies" : sourceRefType === "static_gk" ? "static-gk" : sourceRefType;
    adminBankingApi
      .list(entitySlug)
      .then((res) => {
        const published = (res.items ?? []).filter((r) => ["approved", "published"].includes(r.status));
        setRefRecords(published);
        setSourceRefId(published[0]?.id || "");
      })
      .catch(() => setRefRecords([]));
  }, [sourceType, sourceRefType]);

  async function handleGenerate(e) {
    e.preventDefault();
    if (generating) return;
    setGenerating(true);
    try {
      const payload =
        sourceType === "current_affairs"
          ? { sourceType, sourceArticleId, examCode, questionType, difficulty, count: Number(count) }
          : {
              sourceType,
              sourceReferenceType: sourceRefType,
              sourceReferenceId: sourceRefId,
              examCode,
              questionType,
              difficulty,
              count: Number(count),
            };
      const out = await adminCaQuestionsApi.generate(payload);
      onToast?.(
        `Generated ${out.questions?.length ?? 0} draft MCQ(s) for ${examCode}. Review before approving.`,
        "success",
      );
      await loadAll();
    } catch (err) {
      onToast?.(err.message || "MCQ generation failed.", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function openReview(id) {
    try {
      const res = await adminCaQuestionsApi.getQuestion(id);
      const q = res.question;
      setActiveQ(q);
      setRejectReason("");
      setEditForm({
        questionText: q.question_text || "",
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: q.correct_answer || "A",
        explanation: q.explanation || "",
        difficulty: q.difficulty || "moderate",
        topic: q.topic || "General Awareness",
        examCodes: Array.isArray(q.exam_codes) ? q.exam_codes : ["IBPS PO"],
        sourceReference: q.source_reference || "",
      });
    } catch (err) {
      onToast?.(err.message || "Failed to load question detail.", "error");
    }
  }

  async function handleSaveEdit() {
    if (!activeQ || !editForm || saving) return;
    setSaving(true);
    try {
      await adminCaQuestionsApi.updateQuestion(activeQ.id, editForm);
      onToast?.("Question updated and re-validated.", "success");
      await openReview(activeQ.id);
      await loadAll();
    } catch (err) {
      onToast?.(err.message || "Failed to update question.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(qId) {
    setSaving(true);
    try {
      const res = await adminCaQuestionsApi.approveQuestion(qId, {
        adminFeedback: "Approved via MCQ Generator Dashboard",
      });
      onToast?.(
        res.canonicalQuestionId
          ? "Question approved and synced to canonical HHK Question Bank."
          : "Question approved.",
        "success",
      );
      await loadAll();
      if (activeQ?.id === qId) await openReview(qId);
    } catch (err) {
      onToast?.(err.message || "Approval failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(qId) {
    const feedback = rejectReason.trim() || "Rejected during editorial review";
    if (onConfirmModal) {
      const ok = await onConfirmModal({
        title: "Reject Generated MCQ?",
        message: "This question will remain hidden from students and the canonical question bank.",
        confirmText: "Reject Question",
        cancelText: "Cancel",
        type: "danger",
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await adminCaQuestionsApi.rejectQuestion(qId, feedback);
      onToast?.("Question rejected.", "success");
      await loadAll();
      if (activeQ?.id === qId) await openReview(qId);
    } catch (err) {
      onToast?.(err.message || "Rejection failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate(qId) {
    setGenerating(true);
    try {
      await adminCaQuestionsApi.regenerateQuestion(qId);
      onToast?.("Generated a new version of this question.", "success");
      await loadAll();
    } catch (err) {
      onToast?.(err.message || "Regeneration failed.", "error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      {stats && (
        <div className="ca-stats-grid">
          <div className="ca-stat-card">
            <div className="ca-stat-label">Batches</div>
            <div className="ca-stat-value">{stats.totalBatches}</div>
          </div>
          <div className="ca-stat-card">
            <div className="ca-stat-label">Generated MCQs</div>
            <div className="ca-stat-value">{stats.totalGenerated}</div>
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
            <div className="ca-stat-label">Val. Failed / Dups</div>
            <div className="ca-stat-value">{stats.validationFailed} / {stats.duplicates}</div>
          </div>
          <div className="ca-stat-card">
            <div className="ca-stat-label">Avg Quality Score</div>
            <div className="ca-stat-value">{stats.avgQualityScore}/100</div>
          </div>
        </div>
      )}

      {/* A. Generation Configuration */}
      <section className="panel admin-panel">
        <form onSubmit={handleGenerate}>
          <div className="admin-panel-heading">
            <div>
              <span className="section-kicker">EXAM-WISE MCQ ENGINE</span>
              <h2>Generate Grounded Banking MCQs</h2>
            </div>
            <button type="submit" className="primary-btn" disabled={generating}>
              <Cpu size={14} /> {generating ? "Generating…" : "Generate Draft MCQs"}
            </button>
          </div>

          <div className="ca-editor-grid">
            <label className="form-field" style={{ margin: 0 }}>
              Source Type
              <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                <option value="current_affairs">Approved Current Affairs Article</option>
                <option value="banking_reference">Banking Awareness Reference Hub</option>
              </select>
            </label>

            {sourceType === "current_affairs" ? (
              <label className="form-field" style={{ margin: 0 }}>
                Source Article
                <select value={sourceArticleId} onChange={(e) => setSourceArticleId(e.target.value)}>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title.slice(0, 75)} ({a.status})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="form-field" style={{ margin: 0 }}>
                  Reference Table
                  <select value={sourceRefType} onChange={(e) => setSourceRefType(e.target.value)}>
                    {REF_ENTITIES.map((r) => (
                      <option key={r.code} value={r.code}>{r.label}</option>
                    ))}
                  </select>
                </label>
                <label className="form-field" style={{ margin: 0 }}>
                  Approved Reference Record
                  <select value={sourceRefId} onChange={(e) => setSourceRefId(e.target.value)}>
                    {refRecords.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.rate_name || r.title || r.institution_name || r.organization_name || r.person_name || r.term}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <label className="form-field" style={{ margin: 0 }}>
              Target Examination Profile
              <select value={examCode} onChange={(e) => setExamCode(e.target.value)}>
                {EXAM_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label className="form-field" style={{ margin: 0 }}>
              Question Format
              <select value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
                {QUESTION_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </label>

            <label className="form-field" style={{ margin: 0 }}>
              Difficulty
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="difficult">Difficult</option>
              </select>
            </label>

            <label className="form-field" style={{ margin: 0 }}>
              Question Count (1–10)
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
          </div>
        </form>
      </section>

      {/* Active Question Editor & Validation Report */}
      {activeQ && editForm && (
        <section className="panel admin-panel">
          <div className="admin-panel-heading" style={{ flexWrap: "wrap", gap: 8 }}>
            <div>
              <span className="section-kicker">VALIDATION &amp; APPROVAL</span>
              <h2>
                Question v{activeQ.version_number} · Quality {activeQ.quality_score}/100 ({activeQ.quality_status})
              </h2>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="outline-btn" onClick={() => void handleRegenerate(activeQ.id)} disabled={generating}>
                <RotateCcw size={13} /> Regenerate
              </button>
              <button type="button" className="outline-btn" onClick={() => void handleSaveEdit()} disabled={saving}>
                <Save size={13} /> Save &amp; Re-Validate
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={saving || activeQ.validation_status === "failed"}
                onClick={() => void handleApprove(activeQ.id)}
              >
                <CheckCircle2 size={13} /> Approve &amp; Sync to Bank
              </button>
              <button type="button" className="outline-btn" onClick={() => setActiveQ(null)}>
                Close
              </button>
            </div>
          </div>

          {activeQ.latestValidation && (
            <div style={{ marginBottom: 12, fontSize: 13 }}>
              <ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Structural: <strong>{activeQ.latestValidation.structural_status}</strong> · Answer:{" "}
              <strong>{activeQ.latestValidation.answer_validation_status}</strong> · Source:{" "}
              <strong>{activeQ.latestValidation.source_validation_status}</strong> · Ambiguity:{" "}
              <strong>{activeQ.latestValidation.ambiguity_status}</strong> · Duplicate:{" "}
              <strong>{activeQ.duplicate_status}</strong>
              {Array.isArray(activeQ.latestValidation.validation_errors) &&
                activeQ.latestValidation.validation_errors.length > 0 && (
                  <div className="ca-error-banner" style={{ marginTop: 8 }}>
                    <span>Errors: {activeQ.latestValidation.validation_errors.join(" | ")}</span>
                  </div>
                )}
            </div>
          )}

          <label className="form-field">
            Question Text
            <textarea
              rows={3}
              value={editForm.questionText}
              onChange={(e) => setEditForm((p) => ({ ...p, questionText: e.target.value }))}
            />
          </label>

          <div className="ca-mcq-options-grid">
            {editForm.options.map((opt, idx) => (
              <div className="ca-option-row" key={opt.key}>
                <button
                  type="button"
                  className={`ca-option-key-btn ${editForm.correctAnswer === opt.key ? "is-correct" : ""}`}
                  onClick={() => setEditForm((p) => ({ ...p, correctAnswer: opt.key }))}
                >
                  {opt.key}
                </button>
                <input
                  value={opt.text}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      options: p.options.map((o, i) => (i === idx ? { ...o, text: e.target.value } : o)),
                    }))
                  }
                  style={{ flex: 1 }}
                />
              </div>
            ))}
          </div>

          <label className="form-field">
            Explanation
            <textarea
              rows={3}
              value={editForm.explanation}
              onChange={(e) => setEditForm((p) => ({ ...p, explanation: e.target.value }))}
            />
          </label>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason…"
              style={{ flex: 1 }}
            />
            <button type="button" className="outline-btn" onClick={() => void handleReject(activeQ.id)} disabled={saving}>
              <XCircle size={13} /> Reject
            </button>
          </div>
        </section>
      )}

      {/* Review Queue */}
      <section className="panel admin-panel">
        <div className="admin-panel-heading">
          <h2>Generated MCQ Review Queue ({questions.length})</h2>
          <button type="button" className="outline-btn" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className="ca-admin-filters">
          <label className="form-field" style={{ margin: 0 }}>
            Search
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Question or topic…" />
          </label>
          <label className="form-field" style={{ margin: 0 }}>
            Review Status
            <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label className="form-field" style={{ margin: 0 }}>
            Validation
            <select value={valFilter} onChange={(e) => setValFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="passed">Passed</option>
              <option value="warnings">Warnings</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="form-field" style={{ margin: 0 }}>
            Duplicates
            <select value={dupFilter} onChange={(e) => setDupFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="unique">Unique</option>
              <option value="exact_duplicate">Exact Duplicate</option>
              <option value="near_duplicate">Near Duplicate</option>
              <option value="same_fact">Same Fact</option>
            </select>
          </label>
          <label className="form-field" style={{ margin: 0 }}>
            Exam
            <select value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
              <option value="all">All exams</option>
              {EXAM_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        {error && <div className="ca-error-banner" role="alert"><span>{error}</span></div>}

        {loading ? (
          <div className="ca-state-box">Loading generated MCQs…</div>
        ) : questions.length === 0 ? (
          <div className="ca-state-box">No generated questions match the current filters.</div>
        ) : (
          questions.map((q) => (
            <div className="ca-admin-article" key={q.id}>
              <div className="ca-admin-article-header">
                <div>
                  <div className="ca-admin-meta">
                    <span className={`ca-badge ca-badge--${q.review_status === "approved" ? "published" : "draft"}`}>
                      {q.review_status}
                    </span>
                    <span className="ca-badge ca-badge--important">{q.difficulty}</span>
                    <span>Quality: <strong>{q.quality_score}/100</strong></span>
                    <span>· Val: <strong>{q.validation_status}</strong></span>
                    {q.duplicate_status !== "unique" && (
                      <span style={{ color: "#991b1b" }}>
                        <AlertTriangle size={12} style={{ verticalAlign: "middle" }} /> {q.duplicate_status}
                      </span>
                    )}
                    {q.canonical_question_id && (
                      <span style={{ color: "#166534" }}>· Synced to Question Bank</span>
                    )}
                  </div>
                  <strong style={{ display: "block", margin: "4px 0" }}>{q.question_text}</strong>
                  <div style={{ fontSize: 12.5, color: "#64748b" }}>
                    Answer: <strong>{q.correct_answer}</strong> · Format: {q.question_type} · Topic: {q.topic}
                  </div>
                </div>
                <button type="button" className="outline-btn" onClick={() => void openReview(q.id)}>
                  <Edit2 size={13} /> Review &amp; Edit
                </button>
              </div>
            </div>
          ))
        )}

        {batches.length > 0 && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: "#64748b" }}>
            <strong>Recent Batches:</strong>{" "}
            {batches.map((b) => `${b.batch_name} (${b.generated_question_count} Qs, ${b.exam_code})`).join(" · ")}
          </div>
        )}
      </section>
    </div>
  );
}
