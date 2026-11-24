import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { monthlyCapsulesAdminApi } from "../../api/phase8RevisionCapsules";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const LINK_TYPES = [
  { value: "article", label: "Current Affairs Article" },
  { value: "one_liner", label: "One-Liner Fact" },
  { value: "mcq", label: "Approved MCQ" },
  { value: "flashcard", label: "Flashcard" },
  { value: "banking_reference", label: "Banking Reference" },
];

export function MonthlyCapsuleAdmin() {
  const now = new Date();
  const [capsules, setCapsules] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Create / Generate form
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [examTagsText, setExamTagsText] = useState("IBPS PO, SBI PO, RBI Grade B");
  const [useAi, setUseAi] = useState(false);

  // Add section form
  const [secTitle, setSecTitle] = useState("");
  const [secCategory, setSecCategory] = useState("");
  const [secIntro, setSecIntro] = useState("");

  // Add link form
  const [linkSectionId, setLinkSectionId] = useState("");
  const [linkType, setLinkType] = useState("article");
  const [linkContentId, setLinkContentId] = useState("");
  const [linkSourceUrl, setLinkSourceUrl] = useState("");

  const [validationResult, setValidationResult] = useState(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await monthlyCapsulesAdminApi.list();
      setCapsules(res.capsules || []);
    } catch (err) {
      setError(err?.message || "Unable to load monthly capsules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadDetail = async (id) => {
    setBusy(true);
    setError("");
    setValidationResult(null);
    try {
      const res = await monthlyCapsulesAdminApi.getDetail(id);
      setSelected(res.capsule);
      if (res.capsule?.sections?.length && !linkSectionId) {
        setLinkSectionId(res.capsule.sections[0].id);
      }
    } catch (err) {
      setError(err?.message || "Unable to load capsule details.");
    } finally {
      setBusy(false);
    }
  };

  const parseExamTags = () =>
    examTagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const handleCreateManual = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await monthlyCapsulesAdminApi.create({
        capsuleYear: Number(year),
        capsuleMonth: Number(month),
        title,
        description,
        examTags: parseExamTags(),
      });
      setMessage("Draft capsule created.");
      setTitle("");
      setDescription("");
      await loadList();
      setSelected(res.capsule);
    } catch (err) {
      setError(err?.message || "Failed to create capsule draft.");
    } finally {
      setBusy(false);
    }
  };

  const handleAutoGenerate = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await monthlyCapsulesAdminApi.generateDraft({
        capsuleYear: Number(year),
        capsuleMonth: Number(month),
        examTags: parseExamTags(),
        useAi,
      });
      setMessage(
        `Draft capsule generated from approved monthly content${res.usedAi ? " (with AI draft summary)" : ""}. Review before publishing.`,
      );
      await loadList();
      setSelected(res.capsule);
    } catch (err) {
      setError(err?.message || "Failed to generate draft capsule.");
    } finally {
      setBusy(false);
    }
  };

  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!selected || !secTitle.trim()) return;
    setBusy(true);
    setError("");
    try {
      await monthlyCapsulesAdminApi.addSection(selected.id, {
        title: secTitle,
        categoryName: secCategory || null,
        introduction: secIntro,
      });
      setSecTitle("");
      setSecCategory("");
      setSecIntro("");
      await loadDetail(selected.id);
    } catch (err) {
      setError(err?.message || "Failed to add section.");
    } finally {
      setBusy(false);
    }
  };

  const handleMoveSection = async (index, direction) => {
    if (!selected?.sections) return;
    const ids = selected.sections.map((s) => s.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true);
    try {
      const res = await monthlyCapsulesAdminApi.reorderSections(selected.id, ids);
      setSelected(res.capsule);
    } catch (err) {
      setError(err?.message || "Failed to reorder sections.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!selected) return;
    setBusy(true);
    try {
      await monthlyCapsulesAdminApi.deleteSection(selected.id, sectionId);
      await loadDetail(selected.id);
    } catch (err) {
      setError(err?.message || "Failed to delete section.");
    } finally {
      setBusy(false);
    }
  };

  const handleAddLink = async (e) => {
    e.preventDefault();
    if (!selected || !linkSectionId || !linkContentId.trim()) return;
    setBusy(true);
    setError("");
    try {
      await monthlyCapsulesAdminApi.addLink(selected.id, linkSectionId, {
        contentType: linkType,
        contentId: linkContentId.trim(),
        sourceUrl: linkSourceUrl.trim() || null,
      });
      setLinkContentId("");
      setLinkSourceUrl("");
      await loadDetail(selected.id);
    } catch (err) {
      setError(err?.message || "Failed to link content item.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveLink = async (linkId) => {
    if (!selected) return;
    setBusy(true);
    try {
      await monthlyCapsulesAdminApi.removeLink(selected.id, linkId);
      await loadDetail(selected.id);
    } catch (err) {
      setError(err?.message || "Failed to remove link.");
    } finally {
      setBusy(false);
    }
  };

  const handleValidate = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const res = await monthlyCapsulesAdminApi.validate(selected.id);
      setValidationResult(res.validation);
      await loadDetail(selected.id);
    } catch (err) {
      setError(err?.message || "Validation request failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (targetStatus) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await monthlyCapsulesAdminApi.setStatus(selected.id, targetStatus);
      setSelected(res.capsule);
      setMessage(`Capsule status updated to "${targetStatus}".`);
      await loadList();
    } catch (err) {
      setError(err?.message || `Failed to transition capsule to ${targetStatus}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0 }}>Monthly Capsules Control Center</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Build, validate, approve, and publish structured monthly capsules linked to approved HHK content.
            </p>
          </div>
          <button type="button" className="outline-btn" onClick={loadList} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}
        {message && <div className="info-banner" style={{ marginTop: 12 }}>{message}</div>}

        <form onSubmit={handleCreateManual} style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 110 }} />
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Capsule Title (for manual draft)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <input
              type="text"
              placeholder="Exam tags (comma-separated)"
              value={examTagsText}
              onChange={(e) => setExamTagsText(e.target.value)}
              style={{ minWidth: 220 }}
            />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button type="submit" className="outline-btn" disabled={busy || title.trim().length < 4}>
              <Plus size={14} /> Create Manual Draft
            </button>
            <button type="button" className="primary-btn" disabled={busy} onClick={handleAutoGenerate}>
              <Sparkles size={14} /> Auto-Generate Draft from Approved Content
            </button>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
              Use AI Draft Summary (Draft-only, never auto-published)
            </label>
          </div>
        </form>
      </div>

      {/* Capsule list */}
      <div className="panel" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>All Monthly Capsules ({capsules.length})</h3>
        {loading ? (
          <p className="muted">Loading capsules...</p>
        ) : capsules.length === 0 ? (
          <p className="muted">No monthly capsules created yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {capsules.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: 10,
                  borderRadius: 8,
                  border:
                    selected?.id === c.id
                      ? "2px solid var(--primary, #2563eb)"
                      : "1px solid var(--border-color, #e5e7eb)",
                }}
              >
                <div>
                  <strong>{c.title}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {MONTH_NAMES[(c.capsule_month || 1) - 1]} {c.capsule_year} · Status: {c.publication_status} · Validation: {c.validation_status} · {c.sections_count || 0} sections · {c.items_count || 0} links
                  </div>
                </div>
                <button type="button" className="outline-btn" onClick={() => loadDetail(c.id)}>
                  Manage
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected capsule workspace */}
      {selected && (
        <div className="panel" style={{ padding: 18, display: "grid", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>{selected.title}</h3>
              <div className="muted" style={{ fontSize: 13 }}>
                Status: <strong>{selected.publication_status}</strong> · Validation: <strong>{selected.validation_status}</strong> · Unapproved links: <strong>{selected.unapproved_links_count ?? 0}</strong>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="outline-btn" disabled={busy} onClick={handleValidate}>
                <ShieldCheck size={14} /> Run Safeguards Check
              </button>
              <button type="button" className="outline-btn" disabled={busy} onClick={() => handleStatus("review")}>
                Mark Review
              </button>
              <button type="button" className="outline-btn" disabled={busy} onClick={() => handleStatus("approved")}>
                <CheckCircle2 size={14} /> Approve
              </button>
              <button type="button" className="primary-btn" disabled={busy} onClick={() => handleStatus("published")}>
                Publish
              </button>
              <button type="button" className="outline-btn" disabled={busy} onClick={() => handleStatus("archived")}>
                Archive
              </button>
            </div>
          </div>

          {validationResult && (
            <div className={validationResult.ok ? "info-banner" : "error-banner"}>
              <strong>Validation: {validationResult.status}</strong>
              {validationResult.errors?.length > 0 && (
                <ul>
                  {validationResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {validationResult.warnings?.length > 0 && (
                <ul>
                  {validationResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Add section */}
          <form onSubmit={handleAddSection} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="New section title"
              value={secTitle}
              onChange={(e) => setSecTitle(e.target.value)}
              style={{ flex: 1, minWidth: 180 }}
            />
            <input
              type="text"
              placeholder="Category (optional)"
              value={secCategory}
              onChange={(e) => setSecCategory(e.target.value)}
              style={{ width: 160 }}
            />
            <input
              type="text"
              placeholder="Short intro (optional)"
              value={secIntro}
              onChange={(e) => setSecIntro(e.target.value)}
              style={{ flex: 1, minWidth: 180 }}
            />
            <button type="submit" className="outline-btn" disabled={busy || secTitle.trim().length < 2}>
              <Plus size={14} /> Add Section
            </button>
          </form>

          {/* Add relational link */}
          {selected.sections?.length > 0 && (
            <form onSubmit={handleAddLink} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={linkSectionId} onChange={(e) => setLinkSectionId(e.target.value)}>
                {selected.sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <select value={linkType} onChange={(e) => setLinkType(e.target.value)}>
                {LINK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Existing Approved Content ID (UUID)"
                value={linkContentId}
                onChange={(e) => setLinkContentId(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <input
                type="text"
                placeholder="Source URL (optional)"
                value={linkSourceUrl}
                onChange={(e) => setLinkSourceUrl(e.target.value)}
                style={{ minWidth: 180 }}
              />
              <button type="submit" className="outline-btn" disabled={busy || !linkContentId.trim()}>
                Link Item
              </button>
            </form>
          )}

          {/* Sections & Links */}
          <div style={{ display: "grid", gap: 12 }}>
            {(selected.sections || []).map((sec, idx) => (
              <div key={sec.id} className="panel" style={{ padding: 14, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong>
                    {idx + 1}. {sec.title}
                  </strong>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="outline-btn"
                      disabled={busy || idx === 0}
                      onClick={() => handleMoveSection(idx, -1)}
                      title="Move up"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="outline-btn"
                      disabled={busy || idx === selected.sections.length - 1}
                      onClick={() => handleMoveSection(idx, 1)}
                      title="Move down"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="outline-btn"
                      disabled={busy}
                      onClick={() => handleDeleteSection(sec.id)}
                      title="Delete section"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {!sec.links || sec.links.length === 0 ? (
                  <span className="muted" style={{ fontSize: 12 }}>No linked items in this section.</span>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {sec.links.map((l) => (
                      <div
                        key={l.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                        }}
                      >
                        <div>
                          <span className="ca-badge" style={{ marginRight: 6 }}>{l.content_type}</span>
                          <span>{l.resolved_title || l.content_id}</span>{" "}
                          {!l.is_approved && (
                            <span style={{ color: "#dc2626", fontWeight: 600 }}>(Unapproved — blocks publish)</span>
                          )}
                        </div>
                        <button type="button" className="outline-btn" onClick={() => handleRemoveLink(l.id)}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
