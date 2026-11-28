import { CustomSelect } from "../common/CustomSelect.jsx";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Cpu,
  Download,
  Edit2,
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
  const toLocalYmd = (val) => {
    if (!val) return "";
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? String(val).slice(0, 10) : d.toLocaleDateString("en-CA");
  };
  const today = toLocalYmd(new Date());
  const yesterday = toLocalYmd(new Date(Date.now() - 86400000));
  const [selectedDate, setSelectedDate] = useState(today);

  const matchesDay = (rawDate) => {
    if (!selectedDate) return true;
    return toLocalYmd(rawDate) === selectedDate;
  };
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
  const [eventFilter, setEventFilter] = useState({
    genStatus: "not_generated", // "not_generated" | "generated" | "all"
    approvalStatus: "all",      // "all" | "pending" | "approved" | "rejected"
    search: "",
  });

  // Question Review Filters
  const [qFilter, setQFilter] = useState({
    reviewStatus: "all",
    difficulty: "all",
    questionType: "all",
    eventId: "",
    search: "",
  });
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingQ, setEditingQ] = useState(null);
  const [approvedBank, setApprovedBank] = useState([]);
  const [builderSelectionMode, setBuilderSelectionMode] = useState("auto"); // "auto" | "manual"
  const [builderSelectedIds, setBuilderSelectedIds] = useState([]);
  const [builderSearch, setBuilderSearch] = useState("");
  const [managingSet, setManagingSet] = useState(null); // { practiceSet, questions }
  const [managingSelectedIds, setManagingSelectedIds] = useState([]);
  const [managingSearch, setManagingSearch] = useState("");
  const [showUsedInBuilder, setShowUsedInBuilder] = useState(false);
  const [showUsedInManager, setShowUsedInManager] = useState(false);
  const [showAllDatesInBuilder, setShowAllDatesInBuilder] = useState(false);
  const [showAllDatesInManager, setShowAllDatesInManager] = useState(false);
  const [qUsageFilter, setQUsageFilter] = useState("all"); // "all" | "unused" | "used"
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
  const [fetchOutcomes, setFetchOutcomes] = useState([]);
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

  async function loadStudioData(overrideQFilter = qFilter) {
    setBusy(true);
    setError("");
    try {
      const [m, b, e, q, ps, pe, an, appr] = await Promise.all([
        caStudioAdminApi.getMeta(),
        caStudioAdminApi.listBatches(),
        caStudioAdminApi.listEvents(),
        caStudioAdminApi.listQuestions(overrideQFilter),
        caStudioAdminApi.listPracticeSets(),
        caStudioAdminApi.listPdfExports(),
        caStudioAdminApi.getAnalytics(),
        caStudioAdminApi.listQuestions({ reviewStatus: "approved", limit: 150 }),
      ]);
      setMeta(m);
      setBatches(b.batches || []);
      setEvents(e.events || []);
      setQuestions(q.questions || []);
      setPracticeSets(ps.practiceSets || []);
      setPdfExports(pe.exports || []);
      setAnalytics(an);
      setApprovedBank(appr.questions || []);
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
      const [qRes, eRes] = await Promise.all([
        caStudioAdminApi.listQuestions(nextFilter),
        caStudioAdminApi.listEvents(),
      ]);
      setQuestions(qRes.questions || []);
      setEvents(eRes.events || []);
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
      setEventFilter((p) => ({ ...p, genStatus: "not_generated" }));
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
      if ((res.questions?.length || 0) === 0 && res.skippedDuplicates > 0) {
        notify(`All ${res.skippedDuplicates} generated question(s) already exist in the Question Bank — topic moved out of Not Generated Yet.`);
        await loadStudioData();
      } else {
        const dupNote = res.skippedDuplicates ? ` (${res.skippedDuplicates} duplicate skipped)` : "";
        notify(`Generated ${res.questions?.length || 0} question(s) for review${dupNote}.`);
        const nextFilter = { ...qFilter, reviewStatus: "pending", eventId };
        setQFilter(nextFilter);
        setTab("review");
        await loadStudioData(nextFilter);
      }
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

  async function handleApproveTopicPending(topicQs) {
    const pending = topicQs.filter((q) => q.review_status !== "approved");
    if (!pending.length) return;
    setBusy(true);
    try {
      await Promise.all(pending.map((q) => caStudioAdminApi.reviewQuestion(q.id, "approved")));
      notify(`Approved ${pending.length} question(s) for this topic.`);
      await refreshQuestions();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
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

  function openQuestionEditor(q) {
    const rawOpts = Array.isArray(q.options) ? q.options : [];
    const normalizedOpts = ["A", "B", "C", "D", "E"].map((lbl, idx) => {
      const found = rawOpts.find((o) => (o.option_label || o.key) === lbl) || rawOpts[idx];
      return { label: lbl, text: found?.option_text || found?.text || "" };
    });
    setEditingQ({
      id: q.id,
      questionText: q.question_text || "",
      questionType: q.question_type || "mcq",
      difficulty: q.difficulty || "moderate",
      options: normalizedOpts.filter((o, i) => i < 4 || o.text.trim() !== ""),
      correctAnswer: q.correct_answer || "A",
      detailedExplanation: q.detailed_explanation || "",
      whyCorrect: q.why_correct || "",
      importantFactsText: Array.isArray(q.important_facts) ? q.important_facts.join("\n") : "",
      sourceReference: q.source_reference || "",
      categoryId: q.category_id || "",
      examRelevance: Array.isArray(q.exam_relevance) && q.exam_relevance.length ? q.exam_relevance : ["IBPS PO", "SBI PO"],
    });
  }

  async function handleSaveEditedQuestion(e) {
    e.preventDefault();
    if (!editingQ) return;
    setBusy(true);
    try {
      const cleanedOpts = editingQ.options
        .map((o) => ({ label: o.label, text: String(o.text || "").trim() }))
        .filter((o) => o.text.length > 0);
      await caStudioAdminApi.updateQuestion(editingQ.id, {
        questionText: editingQ.questionText,
        questionType: editingQ.questionType,
        difficulty: editingQ.difficulty,
        options: cleanedOpts,
        correctAnswer: editingQ.correctAnswer,
        detailedExplanation: editingQ.detailedExplanation,
        whyCorrect: editingQ.whyCorrect || "",
        importantFacts: editingQ.importantFactsText.split("\n").map((s) => s.trim()).filter(Boolean),
        sourceReference: editingQ.sourceReference || "",
        categoryId: editingQ.categoryId || undefined,
        examRelevance: editingQ.examRelevance,
      });
      notify("Question updated successfully.");
      setEditingQ(null);
      await loadStudioData();
      if (managingSet?.practiceSet?.id) {
        await handleOpenManageSet(managingSet.practiceSet.id);
      }
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenManageSet(setId) {
    setBusy(true);
    try {
      const res = await caStudioAdminApi.getPracticeSetQuestions(setId);
      setManagingSet({ practiceSet: res.practiceSet, questions: res.questions || [] });
      setManagingSelectedIds((res.questions || []).map((q) => q.id));
      setManagingSearch("");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSetQuestions() {
    if (!managingSet?.practiceSet?.id) return;
    if (!managingSelectedIds.length) {
      notify("Select at least 1 approved question for this practice set.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await caStudioAdminApi.updatePracticeSetQuestions(
        managingSet.practiceSet.id,
        managingSelectedIds,
      );
      notify(`Updated practice set with ${res.questionCount} selected question(s).`);
      await loadStudioData();
      await handleOpenManageSet(managingSet.practiceSet.id);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
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
        questionIds: builderSelectionMode === "manual" ? builderSelectedIds : undefined,
      });
      setBuilderSelectedIds([]);
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

  async function handleRunFetch(sourceId = null) {
    setBusy(true);
    setFetchOutcomes([]);
    try {
      const res = await caStudioAdminApi.runAutomationFetch(sourceId);
      const list = res.outcomes || [];
      setFetchOutcomes(list);
      const okCount = list.filter((o) => o.ok).length;
      const totalItems = list.reduce((sum, o) => sum + (o.fetched || 0), 0);
      notify(`Fetched ${totalItems} item(s) from ${okCount}/${list.length} source(s).`, okCount > 0 ? "success" : "error");
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
            <button type="button" className="outline-btn" onClick={() => loadStudioData()} disabled={busy}>
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

      {/* Global Day-Wise Filter Bar (defaults to Today) */}
      {["content", "ai_processing", "review"].includes(tab) && (
        <div
          className="panel"
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13.5, color: "#0f172a" }}>Day Filter:</strong>
            <button
              type="button"
              className={selectedDate === today ? "primary-btn" : "outline-btn"}
              style={{ padding: "5px 11px", fontSize: 12.5 }}
              onClick={() => setSelectedDate(today)}
            >
              Today ({today})
            </button>
            <button
              type="button"
              className={selectedDate === yesterday ? "primary-btn" : "outline-btn"}
              style={{ padding: "5px 11px", fontSize: 12.5 }}
              onClick={() => setSelectedDate(yesterday)}
            >
              Yesterday ({yesterday})
            </button>
            <button
              type="button"
              className={selectedDate === "" ? "primary-btn" : "outline-btn"}
              style={{ padding: "5px 11px", fontSize: 12.5 }}
              onClick={() => setSelectedDate("")}
            >
              All Dates
            </button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, margin: 0 }}>
            <span>Pick Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }}
            />
          </label>
        </div>
      )}

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
                  <CustomSelect
                    value={batchForm.submissionMode}
                    onChange={(e) => setBatchForm({ ...batchForm, submissionMode: e.target.value })}
                  >
                    <option value="manual">Manual Single Event</option>
                    <option value="bulk_paste">Bulk Multi-Article Paste</option>
                    <option value="document_upload">Document Upload (.txt / .md / .csv)</option>
                    <option value="structured_import">Structured JSON Import</option>
                  </CustomSelect>
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
            {(() => {
              const dayBatches = batches.filter((b) => matchesDay(b.event_date));
              return (
                <>
            <h3 style={{ marginTop: 0 }}>
              Submitted Content Batches ({dayBatches.length}{selectedDate ? ` on ${selectedDate}` : ""})
            </h3>
            {!dayBatches.length ? (
              <div className="ca-state-box">
                {selectedDate
                  ? `No content batches submitted for ${selectedDate}. Submit one above or click "All Dates".`
                  : "No content batches submitted yet."}
              </div>
            ) : (
              dayBatches.map((b) => (
                <div key={b.id} className="ca-admin-article">
                  <div className="ca-admin-article-header">
                    <div>
                      <div className="ca-admin-meta">
                        <span className={`ca-badge ca-badge--${b.processing_status === "processed" ? "published" : b.processing_status === "failed" ? "must_study" : "draft"}`}>
                          {b.processing_status}
                        </span>
                        <span>Date: {toLocalYmd(b.event_date)}</span>
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
                </>
              );
            })()}
          </section>
        </div>
      )}

      {/* TAB 2: AI PROCESSING & EVENT RELEVANCE */}
      {tab === "ai_processing" && (() => {
        const dayEvents = events.filter((e) => matchesDay(e.event_date));
        const isNotGenerated = (e) =>
          Number(e.generated_question_count || 0) === 0 &&
          e.duplicate_status === "unique" &&
          e.approval_status !== "archived" &&
          e.approval_status !== "rejected";
        const notGenCount = dayEvents.filter(isNotGenerated).length;
        const genCount = dayEvents.filter((e) => Number(e.generated_question_count || 0) > 0).length;
        const filteredEvents = dayEvents.filter((ev) => {
          const qCount = Number(ev.generated_question_count || 0);
          if (eventFilter.genStatus === "not_generated" && !isNotGenerated(ev)) return false;
          if (eventFilter.genStatus === "generated" && qCount === 0) return false;
          if (eventFilter.approvalStatus !== "all" && ev.approval_status !== eventFilter.approvalStatus) return false;
          if (eventFilter.search.trim()) {
            const needle = eventFilter.search.trim().toLowerCase();
            const hay = `${ev.main_event || ""} ${ev.summary || ""} ${ev.category_name || ""}`.toLowerCase();
            if (!hay.includes(needle)) return false;
          }
          return true;
        });

        return (
          <section className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0 }}>AI-Extracted Current Affairs Events ({filteredEvents.length} of {dayEvents.length}{selectedDate ? ` · ${selectedDate}` : ""})</h2>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13.5 }}>
                  Showing newest topics first. Topics with generated questions automatically move to &ldquo;Already Generated&rdquo;.
                </p>
              </div>
              <div className="ca-filter-controls">
                <label className="form-field" style={{ margin: 0 }}>
                  Difficulty
                  <CustomSelect value={genConfig.difficulty} onChange={(e) => setGenConfig({ ...genConfig, difficulty: e.target.value })}>
                    <option value="easy">Easy</option>
                    <option value="moderate">Moderate</option>
                    <option value="difficult">Difficult</option>
                  </CustomSelect>
                </label>
                <label className="form-field" style={{ margin: 0 }}>
                  Questions / Event
                  <CustomSelect value={genConfig.count} onChange={(e) => setGenConfig({ ...genConfig, count: Number(e.target.value) })}>
                    {[1, 2, 3, 5, 8].map((n) => <option key={n} value={n}>{n}</option>)}
                  </CustomSelect>
                </label>
              </div>
            </div>

            {/* Quick Question-Generation Filter Tabs + Approval & Search */}
            <div className="ca-admin-filters" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", gridColumn: "span 2" }}>
                <button
                  type="button"
                  className={eventFilter.genStatus === "not_generated" ? "primary-btn" : "outline-btn"}
                  onClick={() => setEventFilter({ ...eventFilter, genStatus: "not_generated" })}
                >
                  Not Generated Yet ({notGenCount})
                </button>
                <button
                  type="button"
                  className={eventFilter.genStatus === "generated" ? "primary-btn" : "outline-btn"}
                  onClick={() => setEventFilter({ ...eventFilter, genStatus: "generated" })}
                >
                  Already Generated ({genCount})
                </button>
                <button
                  type="button"
                  className={eventFilter.genStatus === "all" ? "primary-btn" : "outline-btn"}
                  onClick={() => setEventFilter({ ...eventFilter, genStatus: "all" })}
                >
                  All Topics ({dayEvents.length})
                </button>
              </div>
              <label className="form-field" style={{ margin: 0 }}>
                Approval Status
                <CustomSelect
                  value={eventFilter.approvalStatus}
                  onChange={(e) => setEventFilter({ ...eventFilter, approvalStatus: e.target.value })}
                >
                  <option value="all">All</option>
                  <option value="pending">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </CustomSelect>
              </label>
              <label className="form-field" style={{ margin: 0 }}>
                Search Topic
                <input
                  type="search"
                  placeholder="Search headline or category..."
                  value={eventFilter.search}
                  onChange={(e) => setEventFilter({ ...eventFilter, search: e.target.value })}
                />
              </label>
            </div>

            {!filteredEvents.length ? (
              <div className="ca-state-box">
                {eventFilter.genStatus === "not_generated"
                  ? "All current topics already have questions generated! Switch to 'Already Generated' or add a new batch in Content Management."
                  : "No events match the selected filter."}
              </div>
            ) : (
              filteredEvents.map((ev) => {
                const effScore = ev.admin_override_score ?? ev.relevance_score;
                const totalQ = Number(ev.generated_question_count || 0);
                const approvedQ = Number(ev.approved_question_count || 0);
                const pendingQ = Number(ev.pending_question_count || 0);
                const isApproved = ev.approval_status === "approved";

                return (
                  <div key={ev.id} className="ca-admin-article">
                    <div className="ca-admin-meta">
                      <span className={`ca-badge ${effScore >= 75 ? "ca-badge--must_study" : "ca-badge--important"}`}>
                        Relevance: {effScore}/100 ({String(ev.admin_override_tier || ev.relevance_tier).replace(/_/g, " ")})
                      </span>
                      <span className={`ca-badge ca-badge--${isApproved ? "published" : ev.approval_status === "rejected" ? "must_study" : "draft"}`}>
                        Event: {ev.approval_status}
                      </span>
                      {totalQ > 0 ? (
                        <span className="ca-badge ca-badge--published">
                          {totalQ} Qs Generated ({approvedQ} Approved · {pendingQ} Pending)
                        </span>
                      ) : (
                        <span className="ca-badge ca-badge--draft">Not Generated Yet</span>
                      )}
                      {ev.duplicate_status !== "unique" && (
                        <span className="ca-badge ca-badge--must_study">Duplicate Flag: {ev.duplicate_status}</span>
                      )}
                      {Array.isArray(ev.uncertain_flags) && ev.uncertain_flags.length > 0 && (
                        <span className="ca-badge ca-badge--must_study"><AlertTriangle size={12} /> Needs Verification</span>
                      )}
                      <span>{ev.category_name || "General"}</span>
                      <span>{toLocalYmd(ev.event_date)}</span>
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
                        disabled={isApproved}
                        onClick={async () => {
                          await caStudioAdminApi.updateEvent(ev.id, { approvalStatus: "approved" });
                          notify("Event approved.");
                          await loadStudioData();
                        }}
                      >
                        <CheckCircle2 size={14} /> {isApproved ? "Event Approved" : "Approve Event"}
                      </button>

                      {totalQ > 0 ? (
                        <button
                          type="button"
                          className="outline-btn"
                          onClick={() => {
                            const next = { ...qFilter, reviewStatus: "all", eventId: ev.id };
                            setQFilter(next);
                            refreshQuestions(next);
                            setTab("review");
                          }}
                        >
                          View Generated Questions ({totalQ})
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={busy}
                          onClick={() => handleGenerateForEvent(ev.id)}
                        >
                          <Sparkles size={14} /> Generate {genConfig.count} Questions
                        </button>
                      )}
                      {ev.approval_status !== "archived" && (
                        <button
                          type="button"
                          className="outline-btn"
                          onClick={async () => {
                            await caStudioAdminApi.updateEvent(ev.id, { approvalStatus: "archived" });
                            notify("Topic archived and removed from Not Generated Yet.");
                            await loadStudioData();
                          }}
                        >
                          Archive / Skip
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        );
      })()}

      {/* TAB 3: ALL GENERATED QUESTIONS & REVIEW (Grouped by Topic) */}
      {tab === "review" && (() => {
        const dayQuestionsAll = questions.filter((q) => matchesDay(q.ca_date));
        const unusedQCount = dayQuestionsAll.filter((q) => !(Array.isArray(q.used_in_set_ids) && q.used_in_set_ids.length > 0)).length;
        const usedQCount = dayQuestionsAll.length - unusedQCount;
        const dayQuestions = dayQuestionsAll.filter((q) => {
          const isUsed = Array.isArray(q.used_in_set_ids) && q.used_in_set_ids.length > 0;
          if (qUsageFilter === "unused" && isUsed) return false;
          if (qUsageFilter === "used" && !isUsed) return false;
          return true;
        });
        const groupedByTopic = Object.entries(
          dayQuestions.reduce((acc, q) => {
            const key = q.event_title || "Manual / Unlinked Questions";
            if (!acc[key]) acc[key] = [];
            acc[key].push(q);
            return acc;
          }, {}),
        );

        return (
          <section className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
              <h2 style={{ margin: 0 }}>All Generated Questions &amp; Review ({dayQuestions.length} of {dayQuestionsAll.length}{selectedDate ? ` · ${selectedDate}` : ""})</h2>
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
                    <CustomSelect value={manualQ.questionType} onChange={(e) => setManualQ({ ...manualQ, questionType: e.target.value })}>
                      {(meta?.questionFormats || []).map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
                    </CustomSelect>
                  </label>
                  <label className="form-field">
                    Difficulty
                    <CustomSelect value={manualQ.difficulty} onChange={(e) => setManualQ({ ...manualQ, difficulty: e.target.value })}>
                      <option value="easy">Easy</option>
                      <option value="moderate">Moderate</option>
                      <option value="difficult">Difficult</option>
                    </CustomSelect>
                  </label>
                  <label className="form-field">
                    Category
                    <CustomSelect value={manualQ.categoryId} onChange={(e) => setManualQ({ ...manualQ, categoryId: e.target.value })}>
                      <option value="">Select Category</option>
                      {(meta?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </CustomSelect>
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

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              <button
                type="button"
                className={qUsageFilter === "all" ? "primary-btn" : "outline-btn"}
                style={{ padding: "5px 12px", fontSize: 12.5 }}
                onClick={() => setQUsageFilter("all")}
              >
                All Generated ({dayQuestionsAll.length})
              </button>
              <button
                type="button"
                className={qUsageFilter === "unused" ? "primary-btn" : "outline-btn"}
                style={{ padding: "5px 12px", fontSize: 12.5 }}
                onClick={() => setQUsageFilter("unused")}
              >
                Available / Unused ({unusedQCount})
              </button>
              <button
                type="button"
                className={qUsageFilter === "used" ? "primary-btn" : "outline-btn"}
                style={{ padding: "5px 12px", fontSize: 12.5 }}
                onClick={() => setQUsageFilter("used")}
              >
                Used in Practice Sets ({usedQCount})
              </button>
            </div>

            <div className="ca-admin-filters">
              <label className="form-field" style={{ margin: 0 }}>
                Review Status
                <CustomSelect
                  value={qFilter.reviewStatus}
                  onChange={(e) => {
                    const next = { ...qFilter, reviewStatus: e.target.value };
                    setQFilter(next);
                    refreshQuestions(next);
                  }}
                >
                  <option value="pending">Pending Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="all">All Statuses</option>
                </CustomSelect>
              </label>
              <label className="form-field" style={{ margin: 0 }}>
                Filter by Topic
                <CustomSelect
                  value={qFilter.eventId}
                  onChange={(e) => {
                    const next = { ...qFilter, eventId: e.target.value };
                    setQFilter(next);
                    refreshQuestions(next);
                  }}
                >
                  <option value="">All Topics (Grouped)</option>
                  {events
                    .filter((ev) => matchesDay(ev.event_date) && Number(ev.generated_question_count || 0) > 0)
                    .map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.main_event.slice(0, 72)} ({ev.generated_question_count} Qs)
                      </option>
                    ))}
                </CustomSelect>
              </label>
              <label className="form-field" style={{ margin: 0 }}>
                Difficulty
                <CustomSelect
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
                </CustomSelect>
              </label>
              <label className="form-field" style={{ margin: 0 }}>
                Search
                <input
                  type="search"
                  value={qFilter.search}
                  placeholder="Search question or topic..."
                  onChange={(e) => {
                    const next = { ...qFilter, search: e.target.value };
                    setQFilter(next);
                    refreshQuestions(next);
                  }}
                />
              </label>
            </div>

            {!groupedByTopic.length ? (
              <div className="ca-state-box">No questions match this filter.</div>
            ) : (
              groupedByTopic.map(([topicTitle, topicQs]) => {
                const pendingCount = topicQs.filter((q) => q.review_status !== "approved").length;
                return (
                  <div
                    key={topicTitle}
                    style={{
                      marginBottom: 20,
                      padding: 14,
                      border: "1px solid #cbd5e1",
                      borderRadius: 10,
                      background: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, fontSize: 15, color: "#0f172a" }}>{topicTitle}</h3>
                        <span className="ca-badge ca-badge--important">{topicQs.length} Qs</span>
                      </div>
                      {pendingCount > 0 && (
                        <button
                          type="button"
                          className="primary-btn"
                          style={{ padding: "5px 12px", fontSize: 12.5 }}
                          disabled={busy}
                          onClick={() => handleApproveTopicPending(topicQs)}
                        >
                          <CheckCircle2 size={13} /> Approve All Pending ({pendingCount})
                        </button>
                      )}
                    </div>

                    {topicQs.map((q) => {
                      const isApproved = q.review_status === "approved";
                      const isRejected = q.review_status === "rejected";
                      return (
                        <div key={q.id} className="ca-admin-article">
                          <div className="ca-admin-meta">
                            <span className={`ca-badge ca-badge--${isApproved ? "published" : isRejected ? "must_study" : "draft"}`}>
                              {q.review_status}
                            </span>
                            <span className="ca-badge ca-badge--important">{String(q.question_type).replace(/_/g, " ")}</span>
                            <span className="ca-badge ca-badge--additional">{q.difficulty}</span>
                            {Array.isArray(q.used_in_set_titles) && q.used_in_set_titles.length > 0 ? (
                              <span className="ca-badge ca-badge--archived">
                                Used in: {q.used_in_set_titles.join(", ")}
                              </span>
                            ) : (
                              <span className="ca-badge ca-badge--published">Available (Unused)</span>
                            )}
                            {q.duplicate_status !== "unique" && (
                              <span className="ca-badge ca-badge--must_study">{q.duplicate_status}</span>
                            )}
                            {q.uncertain_flag && (
                              <span className="ca-badge ca-badge--must_study">Flagged for Verification</span>
                            )}
                            <span>{q.category_name || "General"} · {toLocalYmd(q.ca_date)}</span>
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
                            <button
                              type="button"
                              className={isApproved ? "outline-btn" : "primary-btn"}
                              disabled={isApproved}
                              onClick={() => handleReviewQuestion(q.id, "approved")}
                            >
                              <CheckCircle2 size={14} /> {isApproved ? "Approved" : "Approve"}
                            </button>
                            <button
                              type="button"
                              className="outline-btn"
                              disabled={isRejected}
                              onClick={() => handleReviewQuestion(q.id, "rejected")}
                            >
                              <XCircle size={14} /> {isRejected ? "Rejected" : "Reject"}
                            </button>
                            <button type="button" className="outline-btn" onClick={() => openQuestionEditor(q)}>
                              <Edit2 size={14} /> Edit
                            </button>
                            <button type="button" className="outline-btn" onClick={() => handleDeleteQuestion(q.id)}>
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </section>
        );
      })()}

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
                <CustomSelect value={setForm.accessTier} onChange={(e) => setSetForm({ ...setForm, accessTier: e.target.value })}>
                  <option value="free">Free (All Logged-In Students)</option>
                  <option value="premium">Premium (Active HHK Subscription)</option>
                </CustomSelect>
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
            {/* Question Selection Mode: Auto vs Hand-Pick */}
            <div style={{ marginTop: 16, padding: 14, border: "1px solid #cbd5e1", borderRadius: 10, background: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <strong style={{ fontSize: 14 }}>Question Selection Mode</strong>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className={builderSelectionMode === "auto" ? "primary-btn" : "outline-btn"}
                    style={{ padding: "5px 11px", fontSize: 12.5 }}
                    onClick={() => setBuilderSelectionMode("auto")}
                  >
                    Auto-Pick by Date &amp; Difficulty
                  </button>
                  <button
                    type="button"
                    className={builderSelectionMode === "manual" ? "primary-btn" : "outline-btn"}
                    style={{ padding: "5px 11px", fontSize: 12.5 }}
                    onClick={() => setBuilderSelectionMode("manual")}
                  >
                    Hand-Pick Questions ({builderSelectedIds.length} Selected)
                  </button>
                </div>
              </div>

              {builderSelectionMode === "manual" && (() => {
                const usedCount = approvedBank.filter((q) => Array.isArray(q.used_in_set_ids) && q.used_in_set_ids.length > 0).length;
                const filteredApproved = approvedBank.filter((q) => {
                  const isUsed = Array.isArray(q.used_in_set_ids) && q.used_in_set_ids.length > 0;
                  const isRevMix = setForm.setType === "weekly" || setForm.setType === "monthly";
                  if ((!isRevMix || !showUsedInBuilder) && isUsed) return false;
                  if (!showAllDatesInBuilder) {
                    const qDay = toLocalYmd(q.ca_date);
                    if (setForm.dateFrom && qDay < setForm.dateFrom) return false;
                    if (setForm.dateTo && qDay > setForm.dateTo) return false;
                  }
                  if (!builderSearch.trim()) return true;
                  const hay = `${q.question_text} ${q.event_title || ""} ${q.category_name || ""}`.toLowerCase();
                  return hay.includes(builderSearch.trim().toLowerCase());
                });
                return (
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#475569", margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={showUsedInBuilder}
                          onChange={(e) => setShowUsedInBuilder(e.target.checked)}
                        />
                        Show already-used ({usedCount})
                      </label>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#475569", margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={showAllDatesInBuilder}
                          onChange={(e) => setShowAllDatesInBuilder(e.target.checked)}
                        />
                        Include other dates
                      </label>
                      <input
                        type="search"
                        placeholder="Search approved questions or topics..."
                        value={builderSearch}
                        onChange={(e) => setBuilderSearch(e.target.value)}
                        style={{ flex: 1, minWidth: 220 }}
                      />
                      <button
                        type="button"
                        className="outline-btn"
                        style={{ padding: "5px 10px", fontSize: 12 }}
                        onClick={() => setBuilderSelectedIds(filteredApproved.map((q) => q.id))}
                      >
                        Select All Shown ({filteredApproved.length})
                      </button>
                      <button
                        type="button"
                        className="outline-btn"
                        style={{ padding: "5px 10px", fontSize: 12 }}
                        onClick={() => setBuilderSelectedIds([])}
                      >
                        Clear
                      </button>
                    </div>
                    <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                      {!filteredApproved.length ? (
                        <div className="ca-state-box">No approved questions found. Approve questions in Question Review first.</div>
                      ) : (
                        filteredApproved.map((q) => {
                          const checked = builderSelectedIds.includes(q.id);
                          return (
                            <label
                              key={q.id}
                              style={{
                                display: "flex",
                                gap: 10,
                                alignItems: "flex-start",
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: checked ? "1px solid #4f46e5" : "1px solid #e2e8f0",
                                background: checked ? "#eef2ff" : "#ffffff",
                                cursor: "pointer",
                                fontSize: 13,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setBuilderSelectedIds((prev) =>
                                    checked ? prev.filter((id) => id !== q.id) : [...prev, q.id],
                                  )
                                }
                                style={{ marginTop: 3 }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: "#0f172a" }}>{q.question_text}</div>
                                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                                  {q.category_name || "General"} · {q.difficulty} · {toLocalYmd(q.ca_date)}
                                  {q.event_title ? ` · Topic: ${q.event_title.slice(0, 60)}` : ""}
                                </div>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <button
              type="submit"
              className="primary-btn"
              disabled={busy || (builderSelectionMode === "manual" && builderSelectedIds.length === 0)}
              style={{ marginTop: 12 }}
            >
              {builderSelectionMode === "manual"
                ? `Build Practice Set with ${builderSelectedIds.length} Selected Question(s)`
                : "Build Practice Set (Draft)"}
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
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={() => handleOpenManageSet(ps.id)}
                    >
                      <Edit2 size={14} /> Manage / Edit Questions
                    </button>
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

          {/* Practice Set Question Selector & Editor Drawer */}
          {managingSet && (() => {
            const currentSetId = managingSet.practiceSet.id;
            const setFrom = toLocalYmd(managingSet.practiceSet.date_from);
            const setTo = toLocalYmd(managingSet.practiceSet.date_to);
            const inSetDateRange = (q) => {
              const qDay = toLocalYmd(q.ca_date);
              if (setFrom && qDay < setFrom) return false;
              if (setTo && qDay > setTo) return false;
              return true;
            };
            const isUsedInOtherSet = (q) =>
              Array.isArray(q.used_in_set_ids) &&
              q.used_in_set_ids.some((sid) => sid !== currentSetId);
            const dateScopedPool = showAllDatesInManager ? approvedBank : approvedBank.filter((q) => inSetDateRange(q) || managingSelectedIds.includes(q.id));
            const usedElsewhereCount = dateScopedPool.filter(isUsedInOtherSet).length;
            const filteredPool = dateScopedPool.filter((q) => {
              const isRevMix = managingSet.practiceSet.set_type === "weekly" || managingSet.practiceSet.set_type === "monthly";
              if ((!isRevMix || !showUsedInManager) && isUsedInOtherSet(q) && !managingSelectedIds.includes(q.id)) {
                return false;
              }
              if (!managingSearch.trim()) return true;
              const hay = `${q.question_text} ${q.event_title || ""} ${q.category_name || ""}`.toLowerCase();
              return hay.includes(managingSearch.trim().toLowerCase());
            });
            return (
              <div style={{ marginTop: 20, padding: 16, border: "2px solid #4f46e5", borderRadius: 12, background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Manage Questions: {managingSet.practiceSet.title}</h3>
                    <small style={{ color: "#64748b" }}>
                      Check/uncheck approved questions to include in this set, or click Edit on any question.
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="primary-btn" disabled={busy} onClick={handleSaveSetQuestions}>
                      Save Set Questions ({managingSelectedIds.length} Selected)
                    </button>
                    <button type="button" className="outline-btn" onClick={() => setManagingSet(null)}>
                      Close
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                  <input
                    type="search"
                    placeholder="Search unused approved questions to add/remove..."
                    value={managingSearch}
                    onChange={(e) => setManagingSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 220 }}
                  />
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#475569", margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={showUsedInManager}
                      onChange={(e) => setShowUsedInManager(e.target.checked)}
                    />
                    Show used in other sets ({usedElsewhereCount})
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#475569", margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={showAllDatesInManager}
                      onChange={(e) => setShowAllDatesInManager(e.target.checked)}
                    />
                    Include other dates (Showing {filteredPool.length})
                  </label>
                </div>

                <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                  {filteredPool.map((q) => {
                    const checked = managingSelectedIds.includes(q.id);
                    return (
                      <div
                        key={q.id}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: checked ? "1px solid #4f46e5" : "1px solid #e2e8f0",
                          background: checked ? "#eef2ff" : "#ffffff",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setManagingSelectedIds((prev) =>
                              checked ? prev.filter((id) => id !== q.id) : [...prev, q.id],
                            )
                          }
                          style={{ marginTop: 4 }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>{q.question_text}</div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                            Ans: <strong>({q.correct_answer})</strong> · {q.category_name || "General"} · {q.difficulty} · {toLocalYmd(q.ca_date)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="outline-btn"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => openQuestionEditor(q)}
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
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
                <CustomSelect
                  value={autoCfg.automationEnabled ? "true" : "false"}
                  onChange={(e) => setAutoCfg({ ...autoCfg, automationEnabled: e.target.value === "true" })}
                >
                  <option value="false">Disabled (Manual Admin Trigger)</option>
                  <option value="true">Enabled</option>
                </CustomSelect>
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
              <button type="button" className="outline-btn" onClick={() => handleRunFetch(null)} disabled={busy}>
                <Activity size={14} /> Run Trusted Source Fetch Now
              </button>
            </div>
          </form>

          {fetchOutcomes.length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc" }}>
              <strong style={{ display: "block", marginBottom: 8, fontSize: 13.5 }}>Last Fetch Results</strong>
              {fetchOutcomes.map((o, idx) => (
                <div key={idx} style={{ fontSize: 13, marginBottom: 4, color: o.ok ? "#166534" : "#b91c1c" }}>
                  <strong>{o.source}:</strong>{" "}
                  {o.ok ? `Fetched ${o.fetched} item(s) into Content Management.` : `Failed — ${o.error}`}
                </div>
              ))}
            </div>
          )}

          <h3>Configured Trusted Sources ({meta?.sources?.length || 0})</h3>
          <form onSubmit={handleAddSource} className="ca-admin-filters" style={{ marginBottom: 14 }}>
            <input type="text" required placeholder="Source Name (e.g., RBI)" value={newSource.name} onChange={(e) => setNewSource({ ...newSource, name: e.target.value })} />
            <input type="url" placeholder="RSS / API URL" value={newSource.feedUrl} onChange={(e) => setNewSource({ ...newSource, feedUrl: e.target.value })} />
            <CustomSelect value={newSource.trustLevel} onChange={(e) => setNewSource({ ...newSource, trustLevel: e.target.value })}>
              <option value="verified">Verified Official</option>
              <option value="trusted">Trusted</option>
              <option value="requires_review">Requires Review</option>
            </CustomSelect>
            <button type="submit" className="primary-btn">Add Source</button>
          </form>
          {(meta?.sources || []).map((s) => (
            <div key={s.id} className="ba-mini-row">
              <div>
                <strong>{s.name}</strong> <span className="ca-badge ca-badge--important">{s.trust_level}</span>
                <div style={{ fontSize: 12, color: "#64748b" }}>{s.feed_url || "Manual Editorial Source"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {s.last_fetched_at ? `Last fetched: ${new Date(s.last_fetched_at).toLocaleDateString("en-IN")}` : "Not fetched yet"}
                </span>
                {s.feed_url && (
                  <button
                    type="button"
                    className="outline-btn"
                    style={{ padding: "4px 10px", fontSize: 12 }}
                    disabled={busy}
                    onClick={() => handleRunFetch(s.id)}
                  >
                    Fetch Now
                  </button>
                )}
                <button
                  type="button"
                  className="outline-btn"
                  style={{ padding: "4px 8px", fontSize: 12 }}
                  onClick={async () => {
                    await caStudioAdminApi.deleteSource(s.id);
                    notify("Source removed.");
                    await loadStudioData();
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* PRESERVED BANKING AWARENESS REFERENCE HUB */}
      {tab === "banking_hub" && <CurrentAffairsReferenceAdmin onToast={onToast} />}

      {/* QUESTION EDITOR MODAL */}
      {editingQ && (
        <div className="ca-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ca-modal-card" style={{ maxWidth: 720, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Edit Current Affairs Question</h3>
              <button type="button" className="outline-btn" onClick={() => setEditingQ(null)}>Close</button>
            </div>
            <form onSubmit={handleSaveEditedQuestion}>
              <div className="ca-editor-grid">
                <label className="form-field full-span">
                  Question Text *
                  <textarea
                    rows={3}
                    required
                    value={editingQ.questionText}
                    onChange={(e) => setEditingQ({ ...editingQ, questionText: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  Question Format
                  <CustomSelect
                    value={editingQ.questionType}
                    onChange={(e) => setEditingQ({ ...editingQ, questionType: e.target.value })}
                  >
                    {(meta?.questionFormats || []).map((f) => (
                      <option key={f.code} value={f.code}>{f.label}</option>
                    ))}
                  </CustomSelect>
                </label>
                <label className="form-field">
                  Difficulty
                  <CustomSelect
                    value={editingQ.difficulty}
                    onChange={(e) => setEditingQ({ ...editingQ, difficulty: e.target.value })}
                  >
                    <option value="easy">Easy</option>
                    <option value="moderate">Moderate</option>
                    <option value="difficult">Difficult</option>
                  </CustomSelect>
                </label>
                <label className="form-field full-span">
                  Category
                  <CustomSelect
                    value={editingQ.categoryId}
                    onChange={(e) => setEditingQ({ ...editingQ, categoryId: e.target.value })}
                  >
                    <option value="">Keep Current Category</option>
                    {(meta?.categories || []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </CustomSelect>
                </label>
                <div className="full-span ca-mcq-options-grid">
                  {editingQ.options.map((opt, idx) => (
                    <div key={opt.label} className="ca-option-row">
                      <button
                        type="button"
                        className={`ca-option-key-btn ${editingQ.correctAnswer === opt.label ? "is-correct" : ""}`}
                        onClick={() => setEditingQ({ ...editingQ, correctAnswer: opt.label })}
                        title="Click to set as correct answer"
                      >
                        {opt.label}
                      </button>
                      <input
                        type="text"
                        required={idx < 4}
                        placeholder={`Option ${opt.label}`}
                        value={opt.text}
                        onChange={(e) => {
                          const next = [...editingQ.options];
                          next[idx] = { ...opt, text: e.target.value };
                          setEditingQ({ ...editingQ, options: next });
                        }}
                      />
                    </div>
                  ))}
                </div>
                <label className="form-field full-span">
                  Detailed Explanation *
                  <textarea
                    rows={3}
                    required
                    value={editingQ.detailedExplanation}
                    onChange={(e) => setEditingQ({ ...editingQ, detailedExplanation: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  Source Reference
                  <input
                    type="text"
                    value={editingQ.sourceReference}
                    onChange={(e) => setEditingQ({ ...editingQ, sourceReference: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  Important Facts (one per line)
                  <textarea
                    rows={2}
                    value={editingQ.importantFactsText}
                    onChange={(e) => setEditingQ({ ...editingQ, importantFactsText: e.target.value })}
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                <button type="button" className="outline-btn" onClick={() => setEditingQ(null)}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={busy}>Save Question Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}