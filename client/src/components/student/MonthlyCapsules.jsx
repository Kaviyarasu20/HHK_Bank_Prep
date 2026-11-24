import { useCallback, useEffect, useState } from "react";
import { BookOpen, CheckCircle2, ChevronLeft, ExternalLink, RefreshCw } from "lucide-react";
import { monthlyCapsulesStudentApi } from "../../api/phase8RevisionCapsules";
import { getSafeExternalUrl } from "../../utils/safeUrl";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TYPE_LABEL = {
  article: "Article",
  one_liner: "One-Liner",
  mcq: "MCQ",
  flashcard: "Flashcard",
  banking_reference: "Banking Ref",
};

export function MonthlyCapsules() {
  const [capsules, setCapsules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [examFilter, setExamFilter] = useState("");

  const [activeCapsule, setActiveCapsule] = useState(null);
  const [progress, setProgress] = useState(null);
  const [completedSectionIds, setCompletedSectionIds] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updatingSectionId, setUpdatingSectionId] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await monthlyCapsulesStudentApi.list({
        year: yearFilter,
        month: monthFilter,
        exam: examFilter,
      });
      setCapsules(res.capsules || []);
    } catch (err) {
      setError(err?.message || "Unable to load monthly capsules.");
    } finally {
      setLoading(false);
    }
  }, [yearFilter, monthFilter, examFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openCapsule = async (id) => {
    setDetailLoading(true);
    setError("");
    try {
      const res = await monthlyCapsulesStudentApi.getDetail(id);
      setActiveCapsule(res.capsule);
      setProgress(res.progress || null);
      setCompletedSectionIds(res.completedSectionIds || []);
    } catch (err) {
      setError(err?.message || "Failed to open monthly capsule.");
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleSection = async (sectionId) => {
    if (!activeCapsule) return;
    const alreadyDone = completedSectionIds.includes(sectionId);
    setUpdatingSectionId(sectionId);
    try {
      const res = await monthlyCapsulesStudentApi.updateSectionProgress(
        activeCapsule.id,
        sectionId,
        !alreadyDone,
      );
      setProgress(res.progress || null);
      setCompletedSectionIds(res.completedSectionIds || []);
    } catch (err) {
      setError(err?.message || "Failed to update section progress.");
    } finally {
      setUpdatingSectionId("");
    }
  };

  if (activeCapsule) {
    const pct = Number(progress?.completion_percent ?? 0);
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div className="panel" style={{ padding: 18 }}>
          <button
            type="button"
            className="outline-btn"
            onClick={() => {
              setActiveCapsule(null);
              loadList();
            }}
          >
            <ChevronLeft size={14} /> Back to Monthly Capsules
          </button>

          <h2 style={{ margin: "12px 0 6px" }}>{activeCapsule.title}</h2>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
            {MONTH_NAMES[(activeCapsule.capsule_month || 1) - 1]} {activeCapsule.capsule_year} ·{" "}
            ~{activeCapsule.estimated_read_minutes || 15} min read
          </div>
          {activeCapsule.description && <p style={{ margin: "0 0 12px" }}>{activeCapsule.description}</p>}

          {Array.isArray(activeCapsule.exam_tags) && activeCapsule.exam_tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {activeCapsule.exam_tags.map((tag) => (
                <span key={tag} className="ca-badge">{tag}</span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180, height: 8, background: "#e5e7eb", borderRadius: 99 }}>
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, pct))}%`,
                  height: "100%",
                  background: "var(--primary, #2563eb)",
                  borderRadius: 99,
                }}
              />
            </div>
            <strong>
              {pct}% ({progress?.completed_sections_count ?? 0}/{progress?.total_sections_count ?? activeCapsule.sections?.length ?? 0} sections)
            </strong>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {(activeCapsule.sections || []).map((sec) => {
          const isDone = completedSectionIds.includes(sec.id);
          return (
            <div key={sec.id} className="panel" style={{ padding: 18, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{sec.title}</h3>
                  {sec.category_name && (
                    <span className="muted" style={{ fontSize: 12 }}>{sec.category_name}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={isDone ? "primary-btn" : "outline-btn"}
                  disabled={updatingSectionId === sec.id}
                  onClick={() => toggleSection(sec.id)}
                >
                  <CheckCircle2 size={14} /> {isDone ? "Section Completed" : "Mark Section Complete"}
                </button>
              </div>

              {sec.introduction && <p className="muted" style={{ margin: 0 }}>{sec.introduction}</p>}

              {!sec.links || sec.links.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>No linked items in this section yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {sec.links.map((link) => {
                    const safeUrl = getSafeExternalUrl(link.resolved_source_url);
                    return (
                      <div
                        key={link.id}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          border: "1px solid var(--border-color, #e5e7eb)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <span className="ca-badge" style={{ marginRight: 8 }}>
                            {TYPE_LABEL[link.content_type] || link.content_type}
                          </span>
                          <span>{link.resolved_title || link.content_id}</span>
                        </div>
                        {safeUrl && (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="outline-btn"
                            style={{ fontSize: 12, padding: "4px 8px" }}
                          >
                            Source <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen size={18} /> Monthly Revision Capsules
            </h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Structured monthly digests curated strictly from approved articles, one-liners, MCQs, flashcards, and banking references.
            </p>
          </div>
          <button type="button" className="outline-btn" onClick={loadList} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <input
            type="number"
            placeholder="Year (e.g. 2026)"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            style={{ width: 140 }}
          />
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">All Months</option>
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx + 1}>{m}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Exam (e.g. IBPS PO)"
            value={examFilter}
            onChange={(e) => setExamFilter(e.target.value)}
            style={{ width: 160 }}
          />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading || detailLoading ? (
        <div className="panel" style={{ padding: 20 }}>
          <p className="muted">Loading monthly capsules...</p>
        </div>
      ) : capsules.length === 0 ? (
        <div className="panel" style={{ padding: 20 }}>
          <p className="muted">No published monthly capsules match the current filters.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 }}>
          {capsules.map((cap) => {
            const prog = cap.student_progress || {};
            const pct = Number(prog.completion_percent ?? 0);
            return (
              <div key={cap.id} className="panel" style={{ padding: 16, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="ca-badge">
                    {MONTH_NAMES[(cap.capsule_month || 1) - 1]} {cap.capsule_year}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    ~{cap.estimated_read_minutes || 15} min
                  </span>
                </div>
                <h3 style={{ margin: 0 }}>{cap.title}</h3>
                {cap.description && (
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>{cap.description}</p>
                )}
                <div className="muted" style={{ fontSize: 12 }}>
                  {cap.sections_count || 0} sections · {cap.items_count || 0} linked items · {pct}% complete
                </div>
                <button type="button" className="primary-btn" onClick={() => openCapsule(cap.id)}>
                  {pct > 0 && pct < 100 ? "Resume Capsule" : pct >= 100 ? "Review Capsule" : "Start Capsule"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
