import { CustomSelect } from "../common/CustomSelect.jsx";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Edit2, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { adminBankingApi } from "../../api/bankingAwareness";
import { getSafeExternalUrl } from "../../utils/safeUrl";
import { Field } from "../common/Field";

const ENTITIES = [
  { id: "rates", label: "RBI Rates" },
  { id: "limits", label: "Banking Limits" },
  { id: "institutions", label: "Institutions" },
  { id: "regulatory-bodies", label: "Regulatory Bodies" },
  { id: "leaders", label: "Banking Leaders" },
  { id: "static-gk", label: "Static GK" },
  { id: "terminology", label: "Terminology" },
];

const STATUS_OPTIONS = ["draft", "pending_review", "approved", "published", "archived", "rejected"];

const initialForm = (entity) => {
  if (entity === "rates") {
    return {
      id: "",
      rateCode: "REPO",
      rateName: "Policy Repo Rate",
      rateValue: "",
      unit: "%",
      effectiveDate: "",
      previousValue: "",
      announcementNote: "",
      sourceName: "Reserve Bank of India",
      sourceUrl: "",
      status: "draft",
    };
  }
  if (entity === "limits") {
    return {
      id: "",
      title: "",
      category: "Priority Sector Lending",
      value: "",
      unit: "",
      applicableTo: "",
      effectiveFrom: "",
      effectiveUntil: "",
      description: "",
      examNotes: "",
      importanceLevel: "important",
      targetExamsText: "IBPS PO, SBI PO, IBPS Clerk, SBI Clerk",
      sourceName: "Reserve Bank of India",
      sourceUrl: "",
      status: "draft",
    };
  }
  if (entity === "institutions") {
    return {
      id: "",
      institutionName: "",
      shortName: "",
      institutionType: "Regulatory Institution",
      establishedYear: "",
      headquarters: "",
      officialWebsite: "",
      parentOrganization: "",
      description: "",
      sourceName: "",
      sourceUrl: "",
      status: "draft",
    };
  }
  if (entity === "regulatory-bodies") {
    return {
      id: "",
      organizationName: "",
      shortName: "",
      regulatoryDomain: "",
      applicableSector: "",
      establishedYear: "",
      headquarters: "",
      officialWebsite: "",
      responsibilities: "",
      sourceName: "",
      sourceUrl: "",
      status: "draft",
    };
  }
  if (entity === "leaders") {
    return {
      id: "",
      personName: "",
      designation: "",
      organizationName: "",
      appointmentDate: "",
      endDate: "",
      previousDesignation: "",
      notes: "",
      sourceName: "",
      sourceUrl: "",
      status: "draft",
    };
  }
  if (entity === "static-gk") {
    return {
      id: "",
      title: "",
      topic: "Banking History",
      description: "",
      keyFactsText: "",
      importanceLevel: "important",
      targetExamsText: "IBPS PO, SBI PO, IBPS Clerk, SBI Clerk",
      tagsText: "",
      sourceName: "",
      sourceUrl: "",
      status: "draft",
    };
  }
  return {
    id: "",
    term: "",
    abbreviation: "",
    fullForm: "",
    definition: "",
    example: "",
    category: "Monetary Policy",
    importanceLevel: "important",
    targetExamsText: "IBPS PO, SBI PO, IBPS Clerk, SBI Clerk",
    sourceName: "Reserve Bank of India",
    sourceUrl: "",
    status: "draft",
  };
};

export function CurrentAffairsReferenceAdmin({ onToast }) {
  const [entity, setEntity] = useState("rates");
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => initialForm("rates"));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, alertsRes, listRes] = await Promise.all([
        adminBankingApi.getStats(),
        adminBankingApi.getAlerts(),
        adminBankingApi.list(entity),
      ]);
      setStats(statsRes.stats ?? null);
      setAlerts(alertsRes.alerts ?? null);
      setItems(listRes.items ?? []);
    } catch (err) {
      setError(err.message || "Failed to load Banking Reference Hub data.");
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useEffect(() => {
    setForm(initialForm(entity));
    setFormError("");
    void loadAll();
  }, [entity, loadAll]);

  function startEdit(row) {
    setFormError("");
    if (entity === "rates") {
      setForm({
        id: row.id,
        rateCode: row.rate_code || "",
        rateName: row.rate_name || "",
        rateValue: String(row.rate_value ?? ""),
        unit: row.unit || "%",
        effectiveDate: row.effective_date ? String(row.effective_date).slice(0, 10) : "",
        previousValue: row.previous_value != null ? String(row.previous_value) : "",
        announcementNote: row.announcement_note || "",
        sourceName: row.source_name || "",
        sourceUrl: row.source_url || "",
        status: row.status || "draft",
      });
    } else if (entity === "limits") {
      setForm({
        id: row.id,
        title: row.title || "",
        category: row.category || "Other Banking Limits",
        value: row.value || "",
        unit: row.unit || "",
        applicableTo: row.applicable_to || "",
        effectiveFrom: row.effective_from ? String(row.effective_from).slice(0, 10) : "",
        effectiveUntil: row.effective_until ? String(row.effective_until).slice(0, 10) : "",
        description: row.description || "",
        examNotes: row.exam_notes || "",
        importanceLevel: row.importance_level || "important",
        targetExamsText: Array.isArray(row.target_exams) ? row.target_exams.join(", ") : "",
        sourceName: row.source_name || "",
        sourceUrl: row.source_url || "",
        status: row.status || "draft",
      });
    } else if (entity === "institutions") {
      setForm({
        id: row.id,
        institutionName: row.institution_name || "",
        shortName: row.short_name || "",
        institutionType: row.institution_type || "Other Financial Organization",
        establishedYear: row.established_year ? String(row.established_year) : "",
        headquarters: row.headquarters || "",
        officialWebsite: row.official_website || "",
        parentOrganization: row.parent_organization || "",
        description: row.description || "",
        sourceName: row.source_name || "",
        sourceUrl: row.source_url || "",
        status: row.status || "draft",
      });
    } else if (entity === "regulatory-bodies") {
      setForm({
        id: row.id,
        organizationName: row.organization_name || "",
        shortName: row.short_name || "",
        regulatoryDomain: row.regulatory_domain || "",
        applicableSector: row.applicable_sector || "",
        establishedYear: row.established_year ? String(row.established_year) : "",
        headquarters: row.headquarters || "",
        officialWebsite: row.official_website || "",
        responsibilities: row.responsibilities || "",
        sourceName: row.source_name || "",
        sourceUrl: row.source_url || "",
        status: row.status || "draft",
      });
    } else if (entity === "leaders") {
      setForm({
        id: row.id,
        personName: row.person_name || "",
        designation: row.designation || "",
        organizationName: row.organization_name || "",
        appointmentDate: row.appointment_date ? String(row.appointment_date).slice(0, 10) : "",
        endDate: row.end_date ? String(row.end_date).slice(0, 10) : "",
        previousDesignation: row.previous_designation || "",
        notes: row.notes || "",
        sourceName: row.source_name || "",
        sourceUrl: row.source_url || "",
        status: row.status || "draft",
      });
    } else if (entity === "static-gk") {
      setForm({
        id: row.id,
        title: row.title || "",
        topic: row.topic || "Banking History",
        description: row.description || "",
        keyFactsText: Array.isArray(row.key_facts) ? row.key_facts.join("\n") : "",
        importanceLevel: row.importance_level || "important",
        targetExamsText: Array.isArray(row.target_exams) ? row.target_exams.join(", ") : "",
        tagsText: Array.isArray(row.tags) ? row.tags.join(", ") : "",
        sourceName: row.source_name || "",
        sourceUrl: row.source_url || "",
        status: row.status || "draft",
      });
    } else {
      setForm({
        id: row.id,
        term: row.term || "",
        abbreviation: row.abbreviation || "",
        fullForm: row.full_form || "",
        definition: row.definition || "",
        example: row.example || "",
        category: row.category || "General Banking",
        importanceLevel: row.importance_level || "important",
        targetExamsText: Array.isArray(row.target_exams) ? row.target_exams.join(", ") : "",
        sourceName: row.source_name || "",
        sourceUrl: row.source_url || "",
        status: row.status || "draft",
      });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(e) {
    e.preventDefault();
    if (saving) return;
    setFormError("");

    if (form.sourceUrl && !getSafeExternalUrl(form.sourceUrl)) {
      setFormError("Source URL must be a valid http:// or https:// URL.");
      return;
    }

    const splitCsv = (s) =>
      String(s || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

    let payload = { ...form };
    delete payload.id;

    if (entity === "rates") {
      payload.rateValue = Number(form.rateValue);
      payload.previousValue = form.previousValue === "" ? null : Number(form.previousValue);
    } else if (entity === "limits") {
      payload.targetExams = splitCsv(form.targetExamsText);
      delete payload.targetExamsText;
    } else if (entity === "institutions" || entity === "regulatory-bodies") {
      payload.establishedYear = form.establishedYear ? Number(form.establishedYear) : null;
    } else if (entity === "static-gk") {
      payload.keyFacts = String(form.keyFactsText || "")
        .split("\n")
        .map((x) => x.trim())
        .filter((x) => x.length >= 2);
      payload.targetExams = splitCsv(form.targetExamsText);
      payload.tags = splitCsv(form.tagsText);
      delete payload.keyFactsText;
      delete payload.targetExamsText;
      delete payload.tagsText;
    } else if (entity === "terminology") {
      payload.targetExams = splitCsv(form.targetExamsText);
      delete payload.targetExamsText;
    }

    setSaving(true);
    try {
      if (form.id) {
        await adminBankingApi.update(entity, form.id, payload);
        onToast?.("Reference record updated.", "success");
      } else {
        await adminBankingApi.create(entity, payload);
        onToast?.("Reference record created.", "success");
      }
      setForm(initialForm(entity));
      await loadAll();
    } catch (err) {
      setFormError(err.message || "Failed to save reference record.");
      onToast?.(err.message || "Failed to save reference record.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(row, nextStatus) {
    try {
      await adminBankingApi.updateStatus(
        entity,
        row.id,
        nextStatus,
        nextStatus === "approved" || nextStatus === "published",
      );
      onToast?.(`Record moved to ${nextStatus}.`, "success");
      await loadAll();
    } catch (err) {
      onToast?.(err.message || "Failed to update status.", "error");
    }
  }

  const totalAlerts =
    (alerts?.overdueRates?.length ?? 0) +
    (alerts?.expiredLimits?.length ?? 0) +
    (alerts?.missingSources?.length ?? 0);

  return (
    <div>
      {stats && (
        <div className="ca-stats-grid">
          <div className="ca-stat-card">
            <div className="ca-stat-label">Active RBI Rates</div>
            <div className="ca-stat-value">{stats.activeRates} / {stats.totalRates}</div>
          </div>
          <div className="ca-stat-card">
            <div className="ca-stat-label">Banking Limits</div>
            <div className="ca-stat-value">{stats.totalLimits}</div>
          </div>
          <div className="ca-stat-card">
            <div className="ca-stat-label">Institutions &amp; Reg.</div>
            <div className="ca-stat-value">{stats.totalInstitutions + stats.totalRegulatoryBodies}</div>
          </div>
          <div className="ca-stat-card">
            <div className="ca-stat-label">Current Leaders</div>
            <div className="ca-stat-value">{stats.currentLeaders}</div>
          </div>
          <div className="ca-stat-card">
            <div className="ca-stat-label">Static GK &amp; Terms</div>
            <div className="ca-stat-value">{stats.totalStaticGk + stats.totalTerminology}</div>
          </div>
          <div className="ca-stat-card">
            <div className="ca-stat-label">Pending / Verify</div>
            <div className="ca-stat-value">{stats.pendingApprovals} / {stats.needsVerification}</div>
          </div>
        </div>
      )}

      {totalAlerts > 0 && (
        <div className="ca-error-banner" role="status">
          <span>
            <ShieldAlert size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Freshness Alerts: {alerts.overdueRates.length} overdue RBI rate(s),{" "}
            {alerts.expiredLimits.length} expired limit(s), {alerts.missingSources.length} record(s) missing official source URL.
          </span>
        </div>
      )}

      <div className="ca-subtabs">
        {ENTITIES.map((e) => (
          <button
            key={e.id}
            type="button"
            className={entity === e.id ? "primary-btn" : "outline-btn"}
            onClick={() => setEntity(e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>

      <section className="panel admin-panel">
        <form onSubmit={handleSave}>
          <div className="admin-panel-heading">
            <div>
              <span className="section-kicker">BANKING REFERENCE MANAGER</span>
              <h2>{form.id ? `Edit ${ENTITIES.find((x) => x.id === entity)?.label}` : `Add ${ENTITIES.find((x) => x.id === entity)?.label}`}</h2>
            </div>
            <CustomSelect
              className="affair-status"
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </CustomSelect>
          </div>

          {formError && <div className="ca-error-banner" role="alert"><span>{formError}</span></div>}

          <div className="ca-editor-grid">
            {entity === "rates" && (
              <>
                <Field label="Rate Code * (REPO, SDF, MSF, BANK_RATE, CRR, SLR)" value={form.rateCode} onChange={(v) => setForm((p) => ({ ...p, rateCode: v }))} />
                <Field label="Rate Name *" value={form.rateName} onChange={(v) => setForm((p) => ({ ...p, rateName: v }))} />
                <Field label="Rate Value (%) *" value={form.rateValue} onChange={(v) => setForm((p) => ({ ...p, rateValue: v }))} />
                <Field label="Previous Value (%)" value={form.previousValue} onChange={(v) => setForm((p) => ({ ...p, previousValue: v }))} />
                <label className="form-field" style={{ margin: 0 }}>
                  Effective Date * (YYYY-MM-DD)
                  <input type="date" value={form.effectiveDate} onChange={(e) => setForm((p) => ({ ...p, effectiveDate: e.target.value }))} />
                </label>
                <Field label="RBI Announcement Note" value={form.announcementNote} onChange={(v) => setForm((p) => ({ ...p, announcementNote: v }))} />
              </>
            )}

            {entity === "limits" && (
              <>
                <Field label="Limit Title *" value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} />
                <Field label="Category *" value={form.category} onChange={(v) => setForm((p) => ({ ...p, category: v }))} />
                <Field label="Value *" value={form.value} onChange={(v) => setForm((p) => ({ ...p, value: v }))} />
                <Field label="Unit (%, Rs Crore, Rs Lakh)" value={form.unit} onChange={(v) => setForm((p) => ({ ...p, unit: v }))} />
                <Field label="Applicable To" value={form.applicableTo} onChange={(v) => setForm((p) => ({ ...p, applicableTo: v }))} />
                <label className="form-field" style={{ margin: 0 }}>
                  Effective From
                  <input type="date" value={form.effectiveFrom} onChange={(e) => setForm((p) => ({ ...p, effectiveFrom: e.target.value }))} />
                </label>
                <Field label="Exam Notes" value={form.examNotes} onChange={(v) => setForm((p) => ({ ...p, examNotes: v }))} />
                <Field label="Target Exams (comma-separated)" value={form.targetExamsText} onChange={(v) => setForm((p) => ({ ...p, targetExamsText: v }))} />
              </>
            )}

            {entity === "institutions" && (
              <>
                <Field label="Institution Name *" value={form.institutionName} onChange={(v) => setForm((p) => ({ ...p, institutionName: v }))} />
                <Field label="Short Name" value={form.shortName} onChange={(v) => setForm((p) => ({ ...p, shortName: v }))} />
                <Field label="Type *" value={form.institutionType} onChange={(v) => setForm((p) => ({ ...p, institutionType: v }))} />
                <Field label="Established Year" value={form.establishedYear} onChange={(v) => setForm((p) => ({ ...p, establishedYear: v }))} />
                <Field label="Headquarters" value={form.headquarters} onChange={(v) => setForm((p) => ({ ...p, headquarters: v }))} />
                <Field label="Official Website (https://...)" value={form.officialWebsite} onChange={(v) => setForm((p) => ({ ...p, officialWebsite: v }))} />
                <label className="form-field full-span" style={{ margin: 0 }}>
                  Description
                  <textarea rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                </label>
              </>
            )}

            {entity === "regulatory-bodies" && (
              <>
                <Field label="Organization Name *" value={form.organizationName} onChange={(v) => setForm((p) => ({ ...p, organizationName: v }))} />
                <Field label="Short Name" value={form.shortName} onChange={(v) => setForm((p) => ({ ...p, shortName: v }))} />
                <Field label="Regulatory Domain" value={form.regulatoryDomain} onChange={(v) => setForm((p) => ({ ...p, regulatoryDomain: v }))} />
                <Field label="Applicable Sector" value={form.applicableSector} onChange={(v) => setForm((p) => ({ ...p, applicableSector: v }))} />
                <Field label="Headquarters" value={form.headquarters} onChange={(v) => setForm((p) => ({ ...p, headquarters: v }))} />
                <Field label="Official Website (https://...)" value={form.officialWebsite} onChange={(v) => setForm((p) => ({ ...p, officialWebsite: v }))} />
                <label className="form-field full-span" style={{ margin: 0 }}>
                  Responsibilities
                  <textarea rows={3} value={form.responsibilities} onChange={(e) => setForm((p) => ({ ...p, responsibilities: e.target.value }))} />
                </label>
              </>
            )}

            {entity === "leaders" && (
              <>
                <Field label="Person Name *" value={form.personName} onChange={(v) => setForm((p) => ({ ...p, personName: v }))} />
                <Field label="Designation *" value={form.designation} onChange={(v) => setForm((p) => ({ ...p, designation: v }))} />
                <Field label="Organization *" value={form.organizationName} onChange={(v) => setForm((p) => ({ ...p, organizationName: v }))} />
                <Field label="Previous Designation" value={form.previousDesignation} onChange={(v) => setForm((p) => ({ ...p, previousDesignation: v }))} />
                <label className="form-field" style={{ margin: 0 }}>
                  Appointment Date
                  <input type="date" value={form.appointmentDate} onChange={(e) => setForm((p) => ({ ...p, appointmentDate: e.target.value }))} />
                </label>
                <label className="form-field" style={{ margin: 0 }}>
                  End Date (leave empty if current)
                  <input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
                </label>
              </>
            )}

            {entity === "static-gk" && (
              <>
                <Field label="Title *" value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} />
                <Field label="Topic *" value={form.topic} onChange={(v) => setForm((p) => ({ ...p, topic: v }))} />
                <label className="form-field full-span" style={{ margin: 0 }}>
                  Explanation *
                  <textarea rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                </label>
                <label className="form-field full-span" style={{ margin: 0 }}>
                  Key Facts (one per line)
                  <textarea rows={3} value={form.keyFactsText} onChange={(e) => setForm((p) => ({ ...p, keyFactsText: e.target.value }))} />
                </label>
                <Field label="Target Exams (comma-separated)" value={form.targetExamsText} onChange={(v) => setForm((p) => ({ ...p, targetExamsText: v }))} />
                <Field label="Tags (comma-separated)" value={form.tagsText} onChange={(v) => setForm((p) => ({ ...p, tagsText: v }))} />
              </>
            )}

            {entity === "terminology" && (
              <>
                <Field label="Term *" value={form.term} onChange={(v) => setForm((p) => ({ ...p, term: v }))} />
                <Field label="Abbreviation" value={form.abbreviation} onChange={(v) => setForm((p) => ({ ...p, abbreviation: v }))} />
                <Field label="Full Form" value={form.fullForm} onChange={(v) => setForm((p) => ({ ...p, fullForm: v }))} />
                <Field label="Category" value={form.category} onChange={(v) => setForm((p) => ({ ...p, category: v }))} />
                <label className="form-field full-span" style={{ margin: 0 }}>
                  Definition *
                  <textarea rows={3} value={form.definition} onChange={(e) => setForm((p) => ({ ...p, definition: e.target.value }))} />
                </label>
                <Field label="Practical Example" value={form.example} onChange={(v) => setForm((p) => ({ ...p, example: v }))} />
                <Field label="Target Exams (comma-separated)" value={form.targetExamsText} onChange={(v) => setForm((p) => ({ ...p, targetExamsText: v }))} />
              </>
            )}

            <Field label="Official Source Name" value={form.sourceName} onChange={(v) => setForm((p) => ({ ...p, sourceName: v }))} />
            <Field label="Official Source URL (required to publish rates/limits/leaders)" value={form.sourceUrl} onChange={(v) => setForm((p) => ({ ...p, sourceUrl: v }))} />
          </div>

          <div className="admin-footer" style={{ marginTop: 14 }}>
            <span>Verify against official RBI / MoF / Regulator circulars before publishing.</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="outline-btn" onClick={() => setForm(initialForm(entity))}>
                Clear
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                <Plus size={14} /> {saving ? "Saving…" : form.id ? "Update Record" : "Save Record"}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="panel admin-panel">
        <div className="admin-panel-heading">
          <h2>{ENTITIES.find((x) => x.id === entity)?.label} Records ({items.length})</h2>
          <button type="button" className="outline-btn" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && <div className="ca-error-banner" role="alert"><span>{error}</span></div>}

        {loading ? (
          <div className="ca-state-box">Loading records…</div>
        ) : items.length === 0 ? (
          <div className="ca-state-box">No records in this table yet. Add a verified record above.</div>
        ) : (
          items.map((row) => {
            const title =
              row.rate_name ||
              row.title ||
              row.institution_name ||
              row.organization_name ||
              row.person_name ||
              row.term;
            const subtitle =
              entity === "rates"
                ? `${row.rate_value}${row.unit} · Effective ${String(row.effective_date || "").slice(0, 10)}`
                : entity === "limits"
                  ? `${row.value} ${row.unit} · ${row.category}`
                  : entity === "leaders"
                    ? `${row.designation} · ${row.resolved_organization || row.organization_name}`
                    : row.short_name || row.topic || row.abbreviation || "";
            return (
              <div className="ca-admin-article" key={row.id}>
                <div className="ca-admin-article-header">
                  <div>
                    <div className="ca-admin-meta">
                      <span className={`ca-badge ca-badge--${row.status}`}>{row.status}</span>
                      {row.freshness && (
                        <span className={`ba-freshness ba-freshness--${row.freshness.state}`}>
                          {row.freshness.label}
                        </span>
                      )}
                      {!row.source_url && (
                        <span style={{ color: "#991b1b" }}>
                          <AlertTriangle size={12} style={{ verticalAlign: "middle" }} /> Missing source URL
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: "4px 0" }}>{title}</h3>
                    {subtitle && <div style={{ fontSize: 13, color: "#475569" }}>{subtitle}</div>}
                  </div>
                  <div className="ca-admin-actions" style={{ marginTop: 0 }}>
                    <button type="button" className="outline-btn" onClick={() => startEdit(row)}>
                      <Edit2 size={13} /> Edit
                    </button>
                    {row.status !== "published" && (
                      <button type="button" className="outline-btn" onClick={() => void handleStatus(row, "published")}>
                        <CheckCircle2 size={13} /> Approve &amp; Publish
                      </button>
                    )}
                    {row.status !== "archived" && (
                      <button type="button" className="outline-btn" onClick={() => void handleStatus(row, "archived")}>
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
