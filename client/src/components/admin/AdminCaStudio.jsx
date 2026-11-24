import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Cpu,
  Download,
  FileText,
  FolderPlus,
  Globe,
  Landmark,
  Layers,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { caStudioAdminApi } from "../../api/caPlatform";
import { CurrentAffairsReferenceAdmin } from "./CurrentAffairsReferenceAdmin";

const ADMIN_TABS = [
  { id: "content", label: "Content Management", icon: FolderPlus },
  { id: "ai_processing", label: "AI Processing", icon: Cpu },
  { id: "review", label: "Question Review", icon: ShieldCheck },
  { id: "builder", label: "Practice Set Builder", icon: Layers },
  { id: "published", label: "Published Sets", icon: Globe },
  { id: "pdfs", label: "PDF Management", icon: FileText },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "ai_config", label: "AI Configuration", icon: Settings },
  { id: "banking_hub", label: "Banking Reference Hub", icon: Landmark },
];

const PDF_FORMATS = [
  { code: "questions_only", label: "Questions Only PDF" },
  { code: "answer_key", label: "Questions + Answer Key PDF" },
  { code: "detailed_solutions", label: "Detailed Solutions PDF" },
  { code: "complete_booklet", label: "Complete Practice Booklet PDF" },
];

export function AdminCaStudio({ onToast }) {
  const [tab, setTab] = useState("content");
  const [meta, setMeta] = useState(null);
  const [batches, setBatches] = useState([]);
  const [events, setEvents] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [practiceSets, setPracticeSets] = useState([]);
  const [pdfExports, setPdfExports] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Content Management Form
  const today = new Date().toISOString().slice(0, 10);
  const [batchForm, setBatchForm] = useState({
    title: "",
    eventDate: today,
    submissionMode: "bulk_paste",
    sourceName: "",
    sourceUrl: "",
    categoryIds: [],
    targetExams: ["IBPS PO", "SBI PO", "IBPS Clerk", "RBI Grade B"],
    rawContent: "",
    fileName: "",
  });

  // AI Question Generation Options per event
  const [genConfig, setGenConfig] = useState({
    questionFormats: ["mcq", "multiple_statement", "banking_financial"],
    difficulty: "moderate",
    count: 3,
  });

  // Question Review Filters
  const [qFilter, setQFilter] = useState({
    reviewStatus: "all",
    difficulty: "all",
    questionType: "all",
    search: "",
  });
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualQ, setManualQ] = useState({
    questionText: "",
    questionType: "mcq",
    difficulty: "moderate",
    options: [
      { label: "A", text: "" },
      { label: "B", text: "" },
      { label: "C", text: "" },
      { label: "D", text: "" },
      { label: "E", text: "" },
    ],
    correctAnswer: "A",
    detailedExplanation: "",
    whyCorrect: "",
    importantFactsText: "",
    sourceReference: "",
    caDate: today,
    categoryId: "",
    autoApprove: true,
  });

  // Practice Set Builder Form
  const [setForm, setSetForm] = useState({
    title: `Daily Current Affairs Practice — ${today}`,
    setType: "daily_standard",
    dateFrom: today,
    dateTo: today,
    questionCount: 20,
    durationMinutes: 15,
    marksPerQuestion: 1,
    negativeMarking: 0.25,
    easyPct: 30,
    modPct: 50,
    diffPct: 20,
    accessTier: "free",
    allowRetry: true,
    instructions: "",
  });

  // Automation Config
  const [autoCfg, setAutoCfg] = useState({
    automationEnabled: false,
    dailyRunTimeIst: "06:30",
    minRelevanceScore: 60,
    defaultQuestionsPerEvent: 2,
    requireAdminApproval: true,
  });
  const [newSource, setNewSource] = useState({
    name: "",
    sourceType: "official_rss",
    feedUrl: "",
    trustLevel: "verified",
  });

  const notify = (msg, type = "success") => {
    if (type === "error") setError(msg);
    onToast?.(msg, type);
  };

  async function loadStudioData() {
    setBusy(true);
    setError("");
    try {
      const [m, b, e, q, ps, pe, an] = await Promise.all([
        caStudioAdminApi.getMeta(),
        caStudioAdminApi.listBatches(),
        caStudioAdminApi.listEvents(),
        caStudioAdminApi.listQuestions(qFilter),
        caStudioAdminApi.listPracticeSets(),
        caStudioAdminApi.listPdfExports(),
        caStudioAdminApi.getAnalytics(),
      ]);
      setMeta(m);
      setBatches(b.batches || []);
      setEvents(e.events || []);
      setQuestions(q.questions || []);
      setPracticeSets(ps.practiceSets || []);
      setPdfExports(pe.exports || []);
      setAnalytics(an);
      if (m.automationConfig) {
        setAutoCfg({
          automationEnabled: Boolean(m.automationConfig.automation_enabled),
          dailyRunTimeIst: m.automationConfig.daily_run_time_ist || "06:30",
          minRelevanceScore: Number(m.automationConfig.min_relevance_score ?? 60),
          defaultQuestionsPerEvent: Number(m.automationConfig.default_questions_per_event ?? 2),
          requireAdminApproval: Boolean(m.automationConfig.require_admin_approval),
        });
      }
    } catch (err) {
      setError(err.message || "Failed to load AI Current Affairs Studio.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadStudioData();
  }, []);

  async function refreshQuestions(nextFilter = qFilter) {
    try {
      const res = await caStudioAdminApi.listQuestions(nextFilter);
      setQuestions(res.questions || []);
    } catch (err) {
      notify(err.message, "error");
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setBatchForm((prev) => ({
        ...prev,
        submissionMode: file.name.endsWith(".json") ? "structured_import" : "document_upload",
        title: prev.title || file.name.replace(/\.[^.]+$/, ""),
        fileName: file.name,
        rawContent: text.slice(0, 60000),
      }));
      notify(`Loaded "${file.name}" (${text.length} chars) for submission.`);
    } catch {
      notify("Could not read uploaded file.", "error");
    }
  }

  async function handleCreateBatch(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await caStudioAdminApi.createBatch(batchForm);
      setBatchForm((p) => ({ ...p, title: "", rawContent: "", fileName: "" }));
      notify("Current Affairs content batch saved. Ready for AI processing.");
      await loadStudioData();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleAnalyzeBatch(batchId) {
    setBusy(true);
    setError("");
    try {
      const res = await caStudioAdminApi.analyzeBatch(batchId);
      notify(`AI extracted ${res.events?.length || 0} structured event(s) using ${res.provider}.`);
      setTab("ai_processing");
      await loadStudioData();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateForEvent(eventId) {
    setBusy(true);
    setError("");
    try {
      const res = await caStudioAdminApi.generateQuestionsForEvent(eventId, {
        questionFormats: genConfig.questionFormats,
        difficulty: genConfig.difficulty,
        count: Number(genConfig.count) || 3,
      });
      notify(`Generated ${res.questions?.length || 0} pending banking question(s) for admin review.`);
      setTab("review");
      await loadStudioData();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateManualQuestion(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await caStudioAdminApi.createManualQuestion({
        ...manualQ,
        categoryId: manualQ.categoryId || undefined,
        importantFacts: manualQ.importantFactsText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      notify("Question saved to Question Review bank.");
      setShowManualForm(false);
      await loadStudioData();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleReviewQuestion(id, action) {
    try {
      await caStudioAdminApi.reviewQuestion(id, action);
      notify(`Question marked as ${action}.`);
      await refreshQuestions();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  async function handleDeleteQuestion(id) {
    try {
      await caStudioAdminApi.deleteQuestion(id);
      notify("Question deleted.");
      await refreshQuestions();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  function applyPreset(preset) {
    const labelDate = preset.setType.startsWith("daily") ? today : `${today}`;
    setSetForm((p) => ({
      ...p,
      setType: preset.setType,
      title: `${preset.label} — ${labelDate}`,
      questionCount: preset.defaultQuestions,
      durationMinutes: preset.defaultDurationMinutes,
      easyPct: preset.difficultyDistribution.easy,
      modPct: preset.difficultyDistribution.moderate,
      diffPct: preset.difficultyDistribution.difficult,
    }));
  }

  async function handleCreatePracticeSet(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await caStudioAdminApi.createPracticeSet({
        title: setForm.title,
        setType: setForm.setType,
        dateFrom: setForm.dateFrom,
        dateTo: setForm.dateTo,
        questionCount: Number(setForm.questionCount),
        durationMinutes: Number(setForm.durationMinutes),
        marksPerQuestion: Number(setForm.marksPerQuestion),
        negativeMarking: Number(setForm.negativeMarking),
        difficultyDistribution: {
          easy: Number(setForm.easyPct),
          moderate: Number(setForm.modPct),
          difficult: Number(setForm.diffPct),
        },
        accessTier: setForm.accessTier,
        allowRetry: setForm.allowRetry,
        instructions: setForm.instructions || undefined,
      });
      notify("Practice set created in Draft status. Review and publish in Published Sets.");
      setTab("published");
      await loadStudioData();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSetStatus(id, publicationStatus) {
    try {
      await caStudioAdminApi.updatePracticeSetStatus(id, publicationStatus);
      notify(`Practice set updated to ${publicationStatus}.`);
      await loadStudioData();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  async function handleDownloadPdf(setId, format) {
    try {
      const res = await caStudioAdminApi.downloadAdminPdf(setId, format);
      notify(`Downloaded ${res.fileName}`);
      await loadStudioData();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  async function handleSaveAutomation(e) {
    e.preventDefault();
    try {
      await caStudioAdminApi.updateAutomationConfig(autoCfg);
      notify("Daily automation settings saved.");
    } catch (err) {
      notify(err.message, "error");
    }
  }

  async function handleAddSource(e) {
    e.preventDefault();
    try {
      await caStudioAdminApi.createSource(newSource);
      setNewSource({ name: "", sourceType: "official_rss", feedUrl: "", trustLevel: "verified" });
      notify("Trusted source added.");
      await loadStudioData();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  async function handleRunFetch() {
    setBusy(true);
    try {
      const res = await caStudioAdminApi.runAutomationFetch();
      const okCount = (res.outcomes || []).filter((o) => o.ok).length;
      notify(`Fetched ${okCount}/${(res.outcomes || []).length} configured source(s).`);
      await loadStudioData();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ca-studio-wrap">
      <div className="student-welcome ca-header-bar">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow">HHK AI CURRENT AFFAIRS STUDIO</div>
            <h1>AI Current Affairs Question Generator &amp; Practice Platform</h1>
            <p>
              Ingest daily current affairs, analyze banking exam relevance with AI, review 14-format
              questions, publish daily/weekly/monthly practice sets, and generate 4-format A4 PDFs.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className={`ca-badge ${meta?.aiStatus?.ready ? "ca-badge--published" : "ca-badge--draft"}`}>
              {meta?.aiStatus?.ready
                ? `AI Ready (${meta.aiStatus.provider})`
                : "AI Credentials Not Configured"}
            </span>
            <button type="button" className="outline-btn" onClick={loadStudioData} disabled={busy}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Admin 8-Section Studio Navigation + Preserved Banking Reference Hub */}
      <div className="ca-subtabs">
        {ADMIN_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "primary-btn" : "outline-btn"}
              onClick={() => setTab(t.id)}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="ca-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" className="outline-btn" onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      {/* TAB 1: CONTENT MANAGEMENT */}
      {tab === "content" && (
        <div className="ca-studio-grid">
          <section className="panel">
            <h2 style={{ marginTop: 0 }}>Submit Daily Current Affairs Content</h2>
            <form onSubmit={handleCreateBatch}>
              <div className="ca-editor-grid">
                <label className="form-field">
                  Batch Title *
                  <input
                    type="text"
                    required
                    value={batchForm.title}
                    placeholder="e.g., RBI MPC & Banking News — 24 Nov 2026"
                    onChange={(e) => setBatchForm({ ...batchForm, title: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  Current Affairs Date *
                  <input
                    type="date"
                    required
                    value={batchForm.eventDate}
                    onChange={(e) => setBatchForm({ ...batchForm, eventDate: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  Submission Mode
                  <select
                    value={batchForm.submissionMode}
                    onChange={(e) => setBatchForm({ ...batchForm, submissionMode: e.target.value })}
                  >
                    <option value="manual">Manual Single Event</option>
                    <option value="bulk_paste">Bulk Multi-Article Paste</option>
                    <option value="document_upload">Document Upload (.txt / .md / .csv)</option>
                    <option value="structured_import">Structured JSON Import</option>
                  </select>
                </label>
                <label className="form-field">
                  Upload Supported Document
                  <input type="file" accept=".txt,.md,.csv,.json" onChange={handleFileUpload} />
                </label>
                <label className="form-field">
                  Source Name
                  <input
                    type="text"
                    value={batchForm.sourceName}
                    placeholder="e.g., RBI Press Release / PIB"
                    onChange={(e) => setBatchForm({ ...batchForm, sourceName: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  Official Source URL
                  <input
                    type="url"
                    value={batchForm.sourceUrl}
                    placeholder="https://rbi.org.in/..."
                    onChange={(e) => setBatchForm({ ...batchForm, sourceUrl: e.target.value })}
                  />
                </label>
                <label className="form-field full-span">
                  Current Affairs Content (paste one or multiple news items — AI splits individual events automatically) *
                  <textarea
                    rows={8}
                    required
                    value={batchForm.rawContent}
                    onChange={(e) => setBatchForm({ ...batchForm, rawContent: e.target.value })}
                    placeholder="Paste daily banking, RBI, economy, government scheme, appointment, and report updates..."
                  />
                </label>
              </div>
              <button type="submit" className="primary-btn" disabled={busy} style={{ marginTop: 12 }}>
                <Upload size={14} /> Save Content Batch
              </button>
            </form>
          </section>

          <section className="panel" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Submitted Content Batches ({batches.length})</h3>
            {!batches.length ? (
              <div className="ca-state-box">No content batches submitted yet.</div>
            ) : (
              batches.map((b) => (
                <div key={b.id} className="ca-admin-article">
                  <div className="ca-admin-article-header">
                    <div>
                      <div className="ca-admin-meta">
                        <span className={`ca-badge ca-badge--${b.processing_status === "processed" ? "published" : b.processing_status === "failed" ? "must_study" : "draft"}`}>
                          {b.processing_status}
                        </span>
                        <span>Date: {String(b.event_date).slice(0, 10)}</span>
                        <span>Mode: {b.submission_mode}</span>
                        <span>Events Extracted: {b.events_extracted}</span>
                      </div>
                      <strong>{b.title}</strong>
                      {b.error_message && <p style={{ color: "#b91c1c", fontSize: 13 }}>{b.error_message}</p>}
                    </div>
                    <div className="ca-admin-actions" style={{ marginTop: 0 }}>
                      <button
                        type="button"
                        className="primary-btn"
                        disabled={busy}
                        onClick={() => handleAnalyzeBatch(b.id)}
                      >
                        <Sparkles size={14} /> Run AI Analysis
                      </button>
                      <button
                        type="button"
                        className="outline-btn"
                        onClick={async () => {
                          await caStudioAdminApi.deleteBatch(b.id);
                          await loadStudioData();
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      )}

      {/* TAB 2: AI PROCESSING & EVENT RELEVANCE */}
      {tab === "ai_processing" && (
        <section className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0 }}>AI-Extracted Current Affairs Events ({events.length})</h2>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13.5 }}>
                Review relevance scores (0–100), override classifications if needed, approve events, and generate 14-format banking questions.
              </p>
            </div>
            <div className="ca-filter-controls">
              <label className="form-field" style={{ margin: 0 }}>
                Difficulty
                <select value={genConfig.difficulty} onChange={(e) => setGenConfig({ ...genConfig, difficulty: e.target.value })}>
                  <option value="easy">Easy</option>
                  <option value="moderate">Moderate</option>
                  <option value="difficult">Difficult</option>
                </select>
              </label>
              <label className="form-field" style={{ margin: 0 }}>
                Questions / Event
                <select value={genConfig.count} onChange={(e) => setGenConfig({ ...genConfig, count: Number(e.target.value) })}>
                  {[1, 2, 3, 5, 8].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
          </div>

          {!events.length ? (
            <div className="ca-state-box">No AI-processed events yet. Submit a batch in Content Management and click "Run AI Analysis".</div>
          ) : (
            events.map((ev) => {
              const effScore = ev.admin_override_score ?? ev.relevance_score;
              return (
                <div key={ev.id} className="ca-admin-article">
                  <div className="ca-admin-meta">
                    <span className={`ca-badge ${effScore >= 75 ? "ca-badge--must_study" : "ca-badge--important"}`}>
                      Relevance: {effScore}/100 ({String(ev.admin_override_tier || ev.relevance_tier).replace(/_/g, " ")})
                    </span>
                    <span className={`ca-badge ca-badge--${ev.approval_status === "approved" ? "published" : "draft"}`}>
                      {ev.approval_status}
                    </span>
                    {ev.duplicate_status !== "unique" && (
                      <span className="ca-badge ca-badge--must_study">Duplicate Flag: {ev.duplicate_status}</span>
                    )}
                    {Array.isArray(ev.uncertain_flags) && ev.uncertain_flags.length > 0 && (
                      <span className="ca-badge ca-badge--must_study"><AlertTriangle size={12} /> Needs Verification</span>
                    )}
                    <span>{ev.category_name || "General"}</span>
                    <span>{String(ev.event_date).slice(0, 10)}</span>
                  </div>
                  <h3 style={{ margin: "6px 0" }}>{ev.main_event}</h3>
                  <p style={{ fontSize: 13.5, color: "#475569", margin: "4px 0 8px" }}>{ev.summary}</p>
                  {ev.banking_implications && (
                    <div className="affair-static-gk" style={{ marginBottom: 8 }}>
                      <strong>Banking Exam Implication:</strong> {ev.banking_implications}
                    </div>
                  )}
                  <div className="ca-admin-actions">
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={async () => {
                        await caStudioAdminApi.updateEvent(ev.id, { approvalStatus: "approved" });
                        notify("Event approved.");
                        await loadStudioData();
                      }}
                    >
                      <CheckCircle2 size={14} /> Approve Event
                    </button>
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={busy}
                      onClick={() => handleGenerateForEvent(ev.id)}
                    >
                      <Sparkles size={14} /> Generate {genConfig.count} Questions
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {/* TAB 3: QUESTION REVIEW */}
      {tab === "review" && (
        <section className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0 }}>Question Review &amp; Approval Bank ({questions.length})</h2>
            <button type="button" className="primary-btn" onClick={() => setShowManualForm((v) => !v)}>
              <Plus size={14} /> {showManualForm ? "Close Editorial Form" : "Add Verified Question"}
            </button>
          </div>

          {showManualForm && (
            <form onSubmit={handleCreateManualQuestion} className="ca-mcq-panel" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Author Verified Current Affairs Question</h3>
              <div className="ca-editor-grid">
                <label className="form-field full-span">
                  Question Text *
                  <textarea rows={3} required value={manualQ.questionText} onChange={(e) => setManualQ({ ...manualQ, questionText: e.target.value })} />
                </label>
                <label className="form-field">
                  Question Format
                  <select value={manualQ.questionType} onChange={(e) => setManualQ({ ...manualQ, questionType: e.target.value })}>
                    {(meta?.questionFormats || []).map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  Difficulty
                  <select value={manualQ.difficulty} onChange={(e) => setManualQ({ ...manualQ, difficulty: e.target.value })}>
                    <option value="easy">Easy</option>
                    <option value="moderate">Moderate</option>
                    <option value="difficult">Difficult</option>
                  </select>
                </label>
                <label className="form-field">
                  Category
                  <select value={manualQ.categoryId} onChange={(e) => setManualQ({ ...manualQ, categoryId: e.target.value })}>
                    <option value="">Select Category</option>
                    {(meta?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  Current Affairs Date
                  <input type="date" value={manualQ.caDate} onChange={(e) => setManualQ({ ...manualQ, caDate: e.target.value })} />
                </label>
                <div className="full-span ca-mcq-options-grid">
                  {manualQ.options.map((opt, idx) => (
                    <div key={opt.label} className="ca-option-row">
                      <button
                        type="button"
                        className={`ca-option-key-btn ${manualQ.correctAnswer === opt.label ? "is-correct" : ""}`}
                        onClick={() => setManualQ({ ...manualQ, correctAnswer: opt.label })}
                        title="Click to set as correct answer"
                      >
                        {opt.label}
                      </button>
                      <input
                        type="text"
                        required
                        placeholder={`Option ${opt.label}`}
                        value={opt.text}
                        onChange={(e) => {
                          const next = [...manualQ.options];
                          next[idx] = { ...opt, text: e.target.value };
                          setManualQ({ ...manualQ, options: next });
                        }}
                      />
                    </div>
                  ))}
                </div>
                <label className="form-field full-span">
                  Detailed Explanation *
                  <textarea rows={2} required value={manualQ.detailedExplanation} onChange={(e) => setManualQ({ ...manualQ, detailedExplanation: e.target.value })} />
                </label>
                <label className="form-field">
                  Source Reference
                  <input type="text" value={manualQ.sourceReference} onChange={(e) => setManualQ({ ...manualQ, sourceReference: e.target.value })} />
                </label>
                <label className="form-field">
                  Important Facts (one per line)
                  <textarea rows={2} value={manualQ.importantFactsText} onChange={(e) => setManualQ({ ...manualQ, importantFactsText: e.target.value })} />
                </label>
              </div>
              <button type="submit" className="primary-btn" disabled={busy} style={{ marginTop: 10 }}>
                Save Verified Question
              </button>
            </form>
          )}

          <div className="ca-admin-filters">
            <label className="form-field" style={{ margin: 0 }}>
              Review Status
              <select
                value={qFilter.reviewStatus}
                onChange={(e) => {
                  const next = { ...qFilter, reviewStatus: e.target.value };
                  setQFilter(next);
                  refreshQuestions(next);
                }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label className="form-field" style={{ margin: 0 }}>
              Difficulty
              <select
                value={qFilter.difficulty}
                onChange={(e) => {
                  const next = { ...qFilter, difficulty: e.target.value };
                  setQFilter(next);
                  refreshQuestions(next);
                }}
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="difficult">Difficult</option>
              </select>
            </label>
            <label className="form-field" style={{ margin: 0 }}>
              Search
              <input
                type="search"
                value={qFilter.search}
                placeholder="Search question text..."
                onChange={(e) => {
                  const next = { ...qFilter, search: e.target.value };
                  setQFilter(next);
                  refreshQuestions(next);
                }}
              />
            </label>
          </div>

          {!questions.length ? (
            <div className="ca-state-box">No questions match this filter.</div>
          ) : (
            questions.map((q) => (
              <div key={q.id} className="ca-admin-article">
                <div className="ca-admin-meta">
                  <span className={`ca-badge ca-badge--${q.review_status === "approved" ? "published" : q.review_status === "rejected" ? "must_study" : "draft"}`}>
                    {q.review_status}
                  </span>
                  <span className="ca-badge ca-badge--important">{String(q.question_type).replace(/_/g, " ")}</span>
                  <span className="ca-badge ca-badge--additional">{q.difficulty}</span>
                  {q.duplicate_status !== "unique" && <span className="ca-badge ca-badge--must_study">{q.duplicate_status}</span>}
                  {q.uncertain_flag && <span className="ca-badge ca-badge--must_study">Flagged for Verification</span>}
                  <span>{q.category_name || "General"} · {String(q.ca_date).slice(0, 10)}</span>
                </div>
                <strong style={{ display: "block", marginBottom: 8, whiteSpace: "pre-wrap" }}>{q.question_text}</strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 6, fontSize: 13.5, marginBottom: 8 }}>
                  {(q.options || []).map((o) => (
                    <div
                      key={o.option_label}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #e2e8f0",
                        background: o.option_label === q.correct_answer ? "#dcfce7" : "#f8fafc",
                      }}
                    >
                      <strong>({o.option_label})</strong> {o.option_text}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 13, color: "#334155", margin: "4px 0" }}>
                  <strong>Explanation:</strong> {q.detailed_explanation}
                </p>
                <div className="ca-admin-actions">
                  <button type="button" className="primary-btn" onClick={() => handleReviewQuestion(q.id, "approved")}>
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button type="button" className="outline-btn" onClick={() => handleReviewQuestion(q.id, "rejected")}>
                    <XCircle size={14} /> Reject
                  </button>
                  <button type="button" className="outline-btn" onClick={() => handleDeleteQuestion(q.id)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* TAB 4: PRACTICE SET BUILDER */}
      {tab === "builder" && (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Daily / Weekly / Monthly Practice Set Builder</h2>
          <div className="ca-subtabs">
            {(meta?.practiceSetPresets || []).map((pr) => (
              <button
                key={pr.setType}
                type="button"
                className={setForm.setType === pr.setType ? "primary-btn" : "outline-btn"}
                onClick={() => applyPreset(pr)}
              >
                {pr.label} ({pr.defaultQuestions} Qs)
              </button>
            ))}
          </div>

          <form onSubmit={handleCreatePracticeSet}>
            <div className="ca-editor-grid">
              <label className="form-field full-span">
                Practice Set Title *
                <input type="text" required value={setForm.title} onChange={(e) => setSetForm({ ...setForm, title: e.target.value })} />
              </label>
              <label className="form-field">
                Date From *
                <input type="date" required value={setForm.dateFrom} onChange={(e) => setSetForm({ ...setForm, dateFrom: e.target.value })} />
              </label>
              <label className="form-field">
                Date To *
                <input type="date" required value={setForm.dateTo} onChange={(e) => setSetForm({ ...setForm, dateTo: e.target.value })} />
              </label>
              <label className="form-field">
                Number of Questions
                <input type="number" min={1} max={150} value={setForm.questionCount} onChange={(e) => setSetForm({ ...setForm, questionCount: e.target.value })} />
              </label>
              <label className="form-field">
                Duration (Minutes)
                <input type="number" min={1} max={240} value={setForm.durationMinutes} onChange={(e) => setSetForm({ ...setForm, durationMinutes: e.target.value })} />
              </label>
              <label className="form-field">
                Marks per Question
                <input type="number" step="0.25" value={setForm.marksPerQuestion} onChange={(e) => setSetForm({ ...setForm, marksPerQuestion: e.target.value })} />
              </label>
              <label className="form-field">
                Negative Marking
                <input type="number" step="0.05" value={setForm.negativeMarking} onChange={(e) => setSetForm({ ...setForm, negativeMarking: e.target.value })} />
              </label>
              <label className="form-field">
                Access Tier
                <select value={setForm.accessTier} onChange={(e) => setSetForm({ ...setForm, accessTier: e.target.value })}>
                  <option value="free">Free (All Logged-In Students)</option>
                  <option value="premium">Premium (Active HHK Subscription)</option>
                </select>
              </label>
              <label className="form-field">
                Difficulty Split (Easy% / Moderate% / Difficult%)
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="number" value={setForm.easyPct} onChange={(e) => setSetForm({ ...setForm, easyPct: e.target.value })} />
                  <input type="number" value={setForm.modPct} onChange={(e) => setSetForm({ ...setForm, modPct: e.target.value })} />
                  <input type="number" value={setForm.diffPct} onChange={(e) => setSetForm({ ...setForm, diffPct: e.target.value })} />
                </div>
              </label>
              <label className="form-field full-span">
                Instructions
                <textarea rows={2} value={setForm.instructions} onChange={(e) => setSetForm({ ...setForm, instructions: e.target.value })} />
              </label>
            </div>
            <button type="submit" className="primary-btn" disabled={busy} style={{ marginTop: 12 }}>
              Build Practice Set (Draft)
            </button>
          </form>
        </section>
      )}

      {/* TAB 5: PUBLISHED SETS */}
      {tab === "published" && (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Manage Practice Sets ({practiceSets.length})</h2>
          {!practiceSets.length ? (
            <div className="ca-state-box">No practice sets created yet.</div>
          ) : (
            practiceSets.map((ps) => (
              <div key={ps.id} className="ca-admin-article">
                <div className="ca-admin-article-header">
                  <div>
                    <div className="ca-admin-meta">
                      <span className={`ca-badge ca-badge--${ps.publication_status === "published" ? "published" : ps.publication_status === "draft" ? "draft" : "archived"}`}>
                        {ps.publication_status}
                      </span>
                      <span className="ca-badge ca-badge--important">{String(ps.set_type).replace(/_/g, " ")}</span>
                      <span className="ca-badge ca-badge--additional">{ps.access_tier}</span>
                      <span>{ps.total_questions} Qs · {ps.duration_minutes} min · Attempts: {ps.attempt_count || 0} · PDFs: {ps.pdf_download_count || 0}</span>
                    </div>
                    <strong>{ps.title}</strong>
                  </div>
                  <div className="ca-admin-actions" style={{ marginTop: 0 }}>
                    {ps.publication_status !== "published" ? (
                      <button type="button" className="primary-btn" onClick={() => handleSetStatus(ps.id, "published")}>
                        Publish
                      </button>
                    ) : (
                      <button type="button" className="outline-btn" onClick={() => handleSetStatus(ps.id, "unpublished")}>
                        Unpublish
                      </button>
                    )}
                    <button type="button" className="outline-btn" onClick={() => handleSetStatus(ps.id, "archived")}>
                      Archive
                    </button>
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={async () => {
                        await caStudioAdminApi.deletePracticeSet(ps.id);
                        await loadStudioData();
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* TAB 6: PDF MANAGEMENT */}
      {tab === "pdfs" && (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>4-Format A4 PDF Question Paper Management</h2>
          {!practiceSets.length ? (
            <div className="ca-state-box">Create a practice set first to generate PDFs.</div>
          ) : (
            practiceSets.map((ps) => (
              <div key={ps.id} className="ca-admin-article">
                <strong>{ps.title}</strong> ({ps.total_questions} Questions)
                <div className="ca-admin-actions">
                  {PDF_FORMATS.map((fmt) => (
                    <button key={fmt.code} type="button" className="outline-btn" onClick={() => handleDownloadPdf(ps.id, fmt.code)}>
                      <Download size={14} /> {fmt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}

          <h3 style={{ marginTop: 20 }}>Recent PDF Export Audit Log ({pdfExports.length})</h3>
          <div className="ca-cat-table-wrap">
            <table className="ca-cat-table">
              <thead>
                <tr>
                  <th>Practice Set</th>
                  <th>Format</th>
                  <th>Downloaded By</th>
                  <th>Size</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {pdfExports.map((ex) => (
                  <tr key={ex.id}>
                    <td>{ex.practice_set_title}</td>
                    <td>{String(ex.pdf_format).replace(/_/g, " ")}</td>
                    <td>{ex.downloaded_by || "Student"}</td>
                    <td>{Math.max(1, Math.round((ex.file_size_bytes || 0) / 1024))} KB</td>
                    <td>{new Date(ex.created_at).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 7: ANALYTICS */}
      {tab === "analytics" && (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>AI Current Affairs Platform Analytics</h2>
          <div className="ca-stats-grid">
            <div className="ca-stat-card"><div className="ca-stat-label">Items Processed</div><div className="ca-stat-value">{analytics?.summary?.events_extracted ?? 0}</div></div>
            <div className="ca-stat-card"><div className="ca-stat-label">AI Questions</div><div className="ca-stat-value">{analytics?.summary?.total_questions ?? 0}</div></div>
            <div className="ca-stat-card"><div className="ca-stat-label">Approved</div><div className="ca-stat-value">{analytics?.summary?.approved_questions ?? 0}</div></div>
            <div className="ca-stat-card"><div className="ca-stat-label">Published Sets</div><div className="ca-stat-value">{analytics?.summary?.published_sets ?? 0}</div></div>
            <div className="ca-stat-card"><div className="ca-stat-label">Student Attempts</div><div className="ca-stat-value">{analytics?.summary?.total_attempts ?? 0}</div></div>
            <div className="ca-stat-card"><div className="ca-stat-label">PDF Downloads</div><div className="ca-stat-value">{analytics?.summary?.pdf_downloads ?? 0}</div></div>
            <div className="ca-stat-card"><div className="ca-stat-label">Avg Accuracy</div><div className="ca-stat-value">{analytics?.summary?.avg_accuracy_pct ?? 0}%</div></div>
            <div className="ca-stat-card"><div className="ca-stat-label">Duplicates Caught</div><div className="ca-stat-value">{analytics?.summary?.duplicate_questions ?? 0}</div></div>
            <div className="ca-stat-card"><div className="ca-stat-label">AI Failures</div><div className="ca-stat-value">{analytics?.summary?.ai_failures ?? 0}</div></div>
          </div>

          <h3>Category-Wise Practice &amp; Accuracy</h3>
          <div className="ca-cat-table-wrap">
            <table className="ca-cat-table">
              <thead>
                <tr><th>Category</th><th>Questions</th><th>Student Answers</th><th>Avg Accuracy</th></tr>
              </thead>
              <tbody>
                {(analytics?.categoryBreakdown || []).map((c) => (
                  <tr key={c.category_name}>
                    <td>{c.category_name}</td>
                    <td>{c.question_count}</td>
                    <td>{c.answer_count}</td>
                    <td>{c.avg_accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 8: AI CONFIGURATION & DAILY AUTOMATION */}
      {tab === "ai_config" && (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>AI Provider &amp; Daily Automation Configuration</h2>
          <div className="info-banner" style={{ marginBottom: 16 }}>
            <strong>Backend AI Status:</strong>{" "}
            {meta?.aiStatus?.ready
              ? `Connected (${meta.aiStatus.provider} / ${meta.aiStatus.model})`
              : "AI API credentials are not configured on the backend. Set CA_AI_ENABLED=true, CA_AI_PROVIDER=gemini (or openai), CA_AI_API_KEY, and CA_AI_MODEL in your server .env file. API keys are never exposed to the browser."}
          </div>

          <form onSubmit={handleSaveAutomation} style={{ marginBottom: 20 }}>
            <h3>Daily Automation Workflow Controls</h3>
            <div className="ca-editor-grid">
              <label className="form-field">
                Enable Automated Daily Ingestion
                <select
                  value={autoCfg.automationEnabled ? "true" : "false"}
                  onChange={(e) => setAutoCfg({ ...autoCfg, automationEnabled: e.target.value === "true" })}
                >
                  <option value="false">Disabled (Manual Admin Trigger)</option>
                  <option value="true">Enabled</option>
                </select>
              </label>
              <label className="form-field">
                Daily Run Time (IST)
                <input type="time" value={autoCfg.dailyRunTimeIst} onChange={(e) => setAutoCfg({ ...autoCfg, dailyRunTimeIst: e.target.value })} />
              </label>
              <label className="form-field">
                Minimum Relevance Score (0–100)
                <input type="number" min={0} max={100} value={autoCfg.minRelevanceScore} onChange={(e) => setAutoCfg({ ...autoCfg, minRelevanceScore: Number(e.target.value) })} />
              </label>
              <label className="form-field">
                Default Questions per Event
                <input type="number" min={1} max={5} value={autoCfg.defaultQuestionsPerEvent} onChange={(e) => setAutoCfg({ ...autoCfg, defaultQuestionsPerEvent: Number(e.target.value) })} />
              </label>
            </div>
            <div className="ca-admin-actions">
              <button type="submit" className="primary-btn">Save Automation Config</button>
              <button type="button" className="outline-btn" onClick={handleRunFetch} disabled={busy}>
                <Activity size={14} /> Run Trusted Source Fetch Now
              </button>
            </div>
          </form>

          <h3>Configured Trusted Sources ({meta?.sources?.length || 0})</h3>
          <form onSubmit={handleAddSource} className="ca-admin-filters" style={{ marginBottom: 14 }}>
            <input type="text" required placeholder="Source Name (e.g., RBI)" value={newSource.name} onChange={(e) => setNewSource({ ...newSource, name: e.target.value })} />
            <input type="url" placeholder="RSS / API URL" value={newSource.feedUrl} onChange={(e) => setNewSource({ ...newSource, feedUrl: e.target.value })} />
            <select value={newSource.trustLevel} onChange={(e) => setNewSource({ ...newSource, trustLevel: e.target.value })}>
              <option value="verified">Verified Official</option>
              <option value="trusted">Trusted</option>
              <option value="requires_review">Requires Review</option>
            </select>
            <button type="submit" className="primary-btn">Add Source</button>
          </form>
          {(meta?.sources || []).map((s) => (
            <div key={s.id} className="ba-mini-row">
              <div>
                <strong>{s.name}</strong> <span className="ca-badge ca-badge--important">{s.trust_level}</span>
                <div style={{ fontSize: 12, color: "#64748b" }}>{s.feed_url || "Manual Editorial Source"}</div>
              </div>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {s.last_fetched_at ? `Last fetched: ${new Date(s.last_fetched_at).toLocaleDateString("en-IN")}` : "Not fetched yet"}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* PRESERVED BANKING AWARENESS REFERENCE HUB */}
      {tab === "banking_hub" && <CurrentAffairsReferenceAdmin onToast={onToast} />}
    </div>
  );
}
