import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Edit2,
  FolderPlus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { adminCaApi } from "../../api/currentAffairs";
import { getSafeExternalUrl } from "../../utils/safeUrl";
import { Field } from "../common/Field";
import { CurrentAffairsQuestionPanel } from "./CurrentAffairsQuestionPanel";
import { CurrentAffairsReferenceAdmin } from "./CurrentAffairsReferenceAdmin";
import { CurrentAffairsAIReview } from "./CurrentAffairsAIReview";
import { CurrentAffairsQuestionGenerator } from "./CurrentAffairsQuestionGenerator";
import { CurrentAffairsOneLinerAdmin } from "./CurrentAffairsOneLinerAdmin";
import { CurrentAffairsFlashcardAdmin } from "./CurrentAffairsFlashcardAdmin";
import { MonthlyCapsuleAdmin } from "./MonthlyCapsuleAdmin";
import { GAMarathonAdmin } from "./GAMarathonAdmin";
import { PlatformAnalyticsDashboard } from "./PlatformAnalyticsDashboard";

const SAMPLE_BULK_JSON = JSON.stringify(
  {
    items: [
      {
        category: "RBI Updates",
        title: "RBI Keeps Repo Rate Unchanged in Monetary Policy Review",
        body: "The Reserve Bank of India Monetary Policy Committee (MPC) decided to keep the policy repo rate unchanged while maintaining focus on inflation alignment with the 4% target.",
        keyPoints: [
          "MPC consists of 6 members (3 RBI officials + 3 external members).",
          "CPI inflation target band is 4% (+/- 2%).",
        ],
        staticGk: "RBI HQ: Mumbai · Established: 1 April 1935 (Hilton Young Commission).",
        sourceName: "RBI",
        sourceUrl: "https://rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx",
        priorityLevel: "must_study",
        tags: ["MPC", "Repo Rate"],
        targetExams: ["IBPS PO", "SBI PO", "RBI Grade B"],
        status: "published",
        questions: [
          {
            questionText: "How many total members are there in the RBI Monetary Policy Committee (MPC)?",
            options: [
              { key: "A", text: "4" },
              { key: "B", text: "5" },
              { key: "C", text: "6" },
              { key: "D", text: "8" },
            ],
            correctAnswer: "C",
            explanation:
              "The MPC has 6 members: 3 from RBI (chaired by the Governor) and 3 nominated by the Central Government.",
          },
        ],
      },
    ],
  },
  null,
  2,
);

const emptyEditor = (defaultCategoryId = "") => ({
  id: "",
  categoryId: defaultCategoryId,
  title: "",
  body: "",
  publishedAt: "",
  status: "draft",
  keyPointsText: "",
  staticGk: "",
  sourceName: "",
  sourceUrl: "",
  priorityLevel: "important",
  tagsText: "",
  targetExamsText: "IBPS PO, SBI PO, IBPS Clerk, SBI Clerk",
});

const emptyCategoryForm = () => ({
  id: "",
  name: "",
  slug: "",
  description: "",
  icon: "",
  sortOrder: 0,
  isActive: true,
  isFeatured: false,
});

function toDateTimeLocalInput(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CurrentAffairsView({ onToast, onConfirmModal }) {
  const [subTab, setSubTab] = useState("articles"); // 'articles' | 'categories' | 'ingestion'

  // List, stats, categories & pagination
  const [categories, setCategories] = useState([]);
  const [affairs, setAffairs] = useState([]);
  const [stats, setStats] = useState({
    totalArticles: 0,
    publishedArticles: 0,
    draftArticles: 0,
    archivedArticles: 0,
    totalMcqs: 0,
    pendingApproval: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Article Editor state
  const [editor, setEditor] = useState(() => emptyEditor(""));
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [savingArticle, setSavingArticle] = useState(false);

  // Independent expanded MCQ panels (keyed by article ID)
  const [openMcqIds, setOpenMcqIds] = useState(() => new Set());
  const [busyArticleId, setBusyArticleId] = useState("");

  // Category manager state
  const [catForm, setCatForm] = useState(emptyCategoryForm);
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState("");

  // Ingestion state (uses centralized adminCaApi, zero raw fetch)
  const [fetching, setFetching] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminCaApi.listArticles({
        q: search,
        categoryId: categoryFilter,
        status: statusFilter,
        source: sourceFilter,
        dateFrom,
        dateTo,
        sort: sortBy,
        page,
        limit: 20,
      });
      setCategories(res.categories ?? []);
      setAffairs(res.items ?? []);
      if (res.stats) setStats(res.stats);
      if (res.pagination) setPagination(res.pagination);
      setEditor((prev) =>
        !prev.categoryId && res.categories?.[0]?.id
          ? { ...prev, categoryId: res.categories[0].id }
          : prev,
      );
    } catch (err) {
      setError(err.message || "Failed to load current affairs.");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter, sourceFilter, dateFrom, dateTo, sortBy, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadArticles();
    }, 180);
    return () => clearTimeout(timer);
  }, [loadArticles]);

  // Warn before browser unload when editor has unsaved changes
  useEffect(() => {
    if (!editorDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editorDirty]);

  function updateEditorField(patch) {
    setEditor((prev) => ({ ...prev, ...patch }));
    setEditorDirty(true);
    setEditorError("");
  }

  async function confirmDiscardIfDirty() {
    if (!editorDirty) return true;
    if (onConfirmModal) {
      return onConfirmModal({
        title: "Discard Unsaved Changes?",
        message: "You have unsaved edits in the article editor. Continuing will discard those changes.",
        confirmText: "Discard Changes",
        cancelText: "Keep Editing",
        type: "warning",
      });
    }
    return window.confirm("You have unsaved changes. Discard them?");
  }

  async function handleResetEditor() {
    if (!(await confirmDiscardIfDirty())) return;
    setEditor(emptyEditor(categories[0]?.id ?? ""));
    setEditorDirty(false);
    setEditorError("");
  }

  async function handleStartEditArticle(a) {
    if (editor.id !== a.id && !(await confirmDiscardIfDirty())) return;
    const keyPoints = Array.isArray(a.key_points) ? a.key_points.join("\n") : "";
    const tags = Array.isArray(a.tags) ? a.tags.join(", ") : "";
    const targetExams = Array.isArray(a.target_exams) ? a.target_exams.join(", ") : "";
    setEditor({
      id: a.id,
      categoryId: a.category_id || categories[0]?.id || "",
      title: a.title || "",
      body: a.body || "",
      publishedAt: toDateTimeLocalInput(a.published_at),
      status: a.status || "draft",
      keyPointsText: keyPoints,
      staticGk: a.static_gk || "",
      sourceName: a.source_name || "",
      sourceUrl: a.source_url || "",
      priorityLevel: a.priority_level || "important",
      tagsText: tags,
      targetExamsText: targetExams,
    });
    setEditorDirty(false);
    setEditorError("");
    setSubTab("articles");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSaveArticle(e) {
    e.preventDefault();
    if (savingArticle) return;
    setEditorError("");

    if (!editor.categoryId) {
      setEditorError("Select a category.");
      return;
    }
    if (editor.title.trim().length < 4) {
      setEditorError("Headline must be at least 4 characters.");
      return;
    }
    if (editor.body.trim().length < 10) {
      setEditorError("Article body must be at least 10 characters.");
      return;
    }
    if (editor.sourceUrl.trim() && !getSafeExternalUrl(editor.sourceUrl.trim())) {
      setEditorError("Source URL must be a valid http:// or https:// URL.");
      return;
    }

    const keyPoints = editor.keyPointsText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    const tags = editor.tagsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const targetExams = editor.targetExamsText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);

    const payload = {
      categoryId: editor.categoryId,
      title: editor.title.trim(),
      body: editor.body.trim(),
      status: editor.status,
      publishedAt: editor.publishedAt ? new Date(editor.publishedAt).toISOString() : null,
      keyPoints,
      staticGk: editor.staticGk.trim(),
      sourceName: editor.sourceName.trim(),
      sourceUrl: editor.sourceUrl.trim(),
      priorityLevel: editor.priorityLevel,
      tags,
      targetExams,
    };

    setSavingArticle(true);
    try {
      if (editor.id) {
        await adminCaApi.updateArticle(editor.id, payload);
        onToast?.("Article updated.", "success");
      } else {
        await adminCaApi.createArticle(payload);
        onToast?.("Article created.", "success");
      }
      setEditor(emptyEditor(categories[0]?.id ?? ""));
      setEditorDirty(false);
      await loadArticles();
    } catch (err) {
      setEditorError(err.message || "Failed to save article.");
      onToast?.(err.message || "Failed to save article.", "error");
    } finally {
      setSavingArticle(false);
    }
  }

  async function handleStatusChange(a, nextStatus) {
    setBusyArticleId(a.id);
    try {
      await adminCaApi.updateArticleStatus(a.id, nextStatus);
      onToast?.(`Article moved to ${nextStatus}.`, "success");
      await loadArticles();
    } catch (err) {
      onToast?.(err.message || "Failed to update status.", "error");
    } finally {
      setBusyArticleId("");
    }
  }

  async function handleDeleteArticle(a) {
    if (onConfirmModal) {
      const ok = await onConfirmModal({
        title: "Delete or Archive Article?",
        message:
          "If students have read, bookmarked, or answered MCQs on this article, it will be safely archived to preserve student history. Otherwise it will be permanently deleted.",
        confirmText: "Continue",
        cancelText: "Cancel",
        type: "danger",
        icon: "trash",
      });
      if (!ok) return;
    }

    setBusyArticleId(a.id);
    try {
      const res = await adminCaApi.deleteArticle(a.id);
      onToast?.(res.message || "Article removed.", "success");
      if (editor.id === a.id) {
        setEditor(emptyEditor(categories[0]?.id ?? ""));
        setEditorDirty(false);
      }
      await loadArticles();
    } catch (err) {
      onToast?.(err.message || "Failed to delete article.", "error");
    } finally {
      setBusyArticleId("");
    }
  }

  function toggleMcqPanel(affairId) {
    setOpenMcqIds((prev) => {
      const next = new Set(prev);
      if (next.has(affairId)) next.delete(affairId);
      else next.add(affairId);
      return next;
    });
  }

  // --- Category Management Handlers ---
  async function handleSaveCategory(e) {
    e.preventDefault();
    if (catSaving) return;
    setCatError("");
    if (catForm.name.trim().length < 2) {
      setCatError("Category name must be at least 2 characters.");
      return;
    }

    setCatSaving(true);
    try {
      const payload = {
        name: catForm.name.trim(),
        slug: catForm.slug.trim() || undefined,
        description: catForm.description.trim(),
        icon: catForm.icon.trim(),
        sortOrder: Number(catForm.sortOrder) || 0,
        isActive: Boolean(catForm.isActive),
        isFeatured: Boolean(catForm.isFeatured),
      };
      if (catForm.id) {
        await adminCaApi.updateCategory(catForm.id, payload);
        onToast?.("Category updated.", "success");
      } else {
        await adminCaApi.createCategory(payload);
        onToast?.("Category created.", "success");
      }
      setCatForm(emptyCategoryForm());
      await loadArticles();
    } catch (err) {
      setCatError(err.message || "Failed to save category.");
      onToast?.(err.message || "Failed to save category.", "error");
    } finally {
      setCatSaving(false);
    }
  }

  async function handleToggleCategory(cat) {
    try {
      await adminCaApi.toggleCategoryActive(cat.id, !cat.is_active);
      onToast?.(
        `Category "${cat.name}" ${cat.is_active ? "deactivated" : "activated"}.`,
        "success",
      );
      await loadArticles();
    } catch (err) {
      onToast?.(err.message || "Failed to toggle category.", "error");
    }
  }

  async function handleDeleteCategory(cat) {
    if (onConfirmModal) {
      const ok = await onConfirmModal({
        title: `Delete Category "${cat.name}"?`,
        message:
          cat.article_count > 0
            ? `This category has ${cat.article_count} linked article(s) and cannot be deleted. Deactivate it instead.`
            : "Permanently delete this unused category?",
        confirmText: "Delete Category",
        cancelText: "Cancel",
        type: "danger",
        icon: "trash",
      });
      if (!ok) return;
    }
    try {
      await adminCaApi.deleteCategory(cat.id);
      onToast?.(`Category "${cat.name}" deleted.`, "success");
      if (catForm.id === cat.id) setCatForm(emptyCategoryForm());
      await loadArticles();
    } catch (err) {
      onToast?.(err.message || "Cannot delete category.", "error");
    }
  }

  // --- RSS & Bulk Import Handlers (Centralized API Client) ---
  async function handleFetchFeeds(sources) {
    setFetching(true);
    setStatusMsg("");
    try {
      const data = await adminCaApi.fetchFeeds({ sources, limitPerSource: 8 });
      const msg = data.errors?.length
        ? `${data.message} Warnings: ${data.errors.join("; ")}`
        : data.message;
      setStatusMsg(msg);
      onToast?.(data.message, "success");
      await loadArticles();
    } catch (err) {
      setStatusMsg(err.message);
      onToast?.(err.message, "error");
    } finally {
      setFetching(false);
    }
  }

  async function handleBulkImport() {
    setStatusMsg("");
    let parsed;
    try {
      parsed = JSON.parse(bulkText);
    } catch {
      const msg = "Invalid JSON format. Click 'Load Sample JSON' to see the expected structure.";
      setStatusMsg(msg);
      onToast?.(msg, "error");
      return;
    }

    setBulkBusy(true);
    try {
      const payload = Array.isArray(parsed) ? { items: parsed } : parsed;
      const data = await adminCaApi.bulkImport(payload);
      setStatusMsg(data.message);
      setBulkText("");
      onToast?.(data.message, "success");
      await loadArticles();
    } catch (err) {
      setStatusMsg(err.message);
      onToast?.(err.message, "error");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <>
      {/* Real Database Dashboard Metrics */}
      <div className="ca-stats-grid">
        <div className="ca-stat-card">
          <div className="ca-stat-label">Total Articles</div>
          <div className="ca-stat-value">{stats.totalArticles}</div>
        </div>
        <div className="ca-stat-card">
          <div className="ca-stat-label">Published</div>
          <div className="ca-stat-value">{stats.publishedArticles}</div>
        </div>
        <div className="ca-stat-card">
          <div className="ca-stat-label">Drafts</div>
          <div className="ca-stat-value">{stats.draftArticles}</div>
        </div>
        <div className="ca-stat-card">
          <div className="ca-stat-label">Archived</div>
          <div className="ca-stat-value">{stats.archivedArticles}</div>
        </div>
        <div className="ca-stat-card">
          <div className="ca-stat-label">Total MCQs</div>
          <div className="ca-stat-value">{stats.totalMcqs}</div>
        </div>
        <div className="ca-stat-card">
          <div className="ca-stat-label">Pending Approval</div>
          <div className="ca-stat-value">{stats.pendingApproval}</div>
        </div>
      </div>

      {/* Workspace Sub-Navigation */}
      <div className="ca-subtabs">
        <button
          type="button"
          className={subTab === "articles" ? "primary-btn" : "outline-btn"}
          onClick={() => setSubTab("articles")}
        >
          Articles &amp; MCQs ({stats.totalArticles})
        </button>
        <button
          type="button"
          className={subTab === "categories" ? "primary-btn" : "outline-btn"}
          onClick={() => setSubTab("categories")}
        >
          Categories ({categories.length})
        </button>
        <button
          type="button"
          className={subTab === "ingestion" ? "primary-btn" : "outline-btn"}
          onClick={() => setSubTab("ingestion")}
        >
          RSS &amp; Bulk Import
        </button>
        <button
          type="button"
          className={subTab === "banking_ref" ? "primary-btn" : "outline-btn"}
          onClick={() => setSubTab("banking_ref")}
        >
          Banking Reference Hub
        </button>
        <button
          type="button"
          className={subTab === "ai_review" ? "primary-btn" : "outline-btn"}
          onClick={() => setSubTab("ai_review")}
        >
          AI Structuring &amp; Review
        </button>
        <button
          type="button"
          className={subTab === "mcq_gen" ? "primary-btn" : "outline-btn"}
          onClick={() => setSubTab("mcq_gen")}
        >
          AI MCQ Generator
        </button>
        <button
          type="button"
          className={subTab === "one_liners" ? "primary-btn" : "outline-btn"}
          onClick={() => setSubTab("one_liners")}
        >
          One-Liners
        </button>
        <button
          type="button"
          className={subTab === "flashcards" ? "primary-btn" : "outline-btn"}
          onClick={() => setSubTab("flashcards")}
        >
          Flashcards
        </button>
        <button
          type="button"
          className={subTab === "monthly_capsules" ? "primary-btn" : "outline-btn"}
          onClick={() => setSubTab("monthly_capsules")}
        >
          Monthly Capsules
        </button>
        <button
          type="button"
          className={subTab === "ga_marathon" ? "primary-btn" : "outline-btn"}
          onClick={() => setSubTab("ga_marathon")}
        >
          GA Marathon
        </button>
        <button
          type="button"
          className={subTab === "analytics" ? "primary-btn" : "outline-btn"}
          onClick={() => setSubTab("analytics")}
        >
          Platform Analytics
        </button>
      </div>

      {/* TAB 1: ARTICLES & MCQs */}
      {subTab === "articles" && (
        <>
          <section className="panel admin-panel">
            <form onSubmit={handleSaveArticle}>
              <div className="admin-panel-heading">
                <div>
                  <span className="section-kicker">CURRENT AFFAIRS EDITOR</span>
                  <h2>{editor.id ? "Edit article" : "Create article"}</h2>
                </div>
                <select
                  className="affair-status"
                  value={editor.status}
                  onChange={(e) => updateEditorField({ status: e.target.value })}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {editorError && (
                <div className="ca-error-banner" role="alert">
                  <span>{editorError}</span>
                </div>
              )}

              <div className="ca-editor-grid">
                <Field
                  label="Headline *"
                  value={editor.title}
                  onChange={(v) => updateEditorField({ title: v })}
                />
                <label className="form-field" style={{ margin: 0 }}>
                  Category *
                  <select
                    value={editor.categoryId}
                    onChange={(e) => updateEditorField({ categoryId: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.is_active === false ? "(Inactive)" : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field" style={{ margin: 0 }}>
                  Priority Level
                  <select
                    value={editor.priorityLevel}
                    onChange={(e) => updateEditorField({ priorityLevel: e.target.value })}
                  >
                    <option value="must_study">Must Study</option>
                    <option value="important">Important</option>
                    <option value="additional">Additional Awareness</option>
                  </select>
                </label>
                <label className="form-field" style={{ margin: 0 }}>
                  Publication Date
                  <input
                    type="datetime-local"
                    value={editor.publishedAt}
                    onChange={(e) => updateEditorField({ publishedAt: e.target.value })}
                  />
                </label>

                <Field
                  label="Source Name (e.g. RBI, PIB)"
                  value={editor.sourceName}
                  onChange={(v) => updateEditorField({ sourceName: v })}
                />
                <Field
                  label="Official Source URL (https://...)"
                  value={editor.sourceUrl}
                  onChange={(v) => updateEditorField({ sourceUrl: v })}
                />

                <Field
                  label="Tags (comma-separated)"
                  value={editor.tagsText}
                  onChange={(v) => updateEditorField({ tagsText: v })}
                />
                <Field
                  label="Target Exams (comma-separated)"
                  value={editor.targetExamsText}
                  onChange={(v) => updateEditorField({ targetExamsText: v })}
                />

                <label className="form-field full-span" style={{ margin: 0 }}>
                  Article Body *
                  <textarea
                    rows={5}
                    value={editor.body}
                    onChange={(e) => updateEditorField({ body: e.target.value })}
                    placeholder="Write clear, exam-focused current affairs briefing..."
                  />
                </label>

                <label className="form-field" style={{ margin: 0 }}>
                  Key Points (one bullet per line)
                  <textarea
                    rows={3}
                    value={editor.keyPointsText}
                    onChange={(e) => updateEditorField({ keyPointsText: e.target.value })}
                    placeholder="Key fact 1&#10;Key fact 2"
                  />
                </label>
                <label className="form-field" style={{ margin: 0 }}>
                  Static GK Takeaway
                  <textarea
                    rows={3}
                    value={editor.staticGk}
                    onChange={(e) => updateEditorField({ staticGk: e.target.value })}
                    placeholder="Headquarters, establishment year, governor/chairperson, etc."
                  />
                </label>
              </div>

              <div className="admin-footer" style={{ marginTop: 14 }}>
                <span>
                  {editorDirty
                    ? "Unsaved changes in editor."
                    : "Verify facts and official source links before publication."}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="outline-btn admin-action"
                    onClick={() => void handleResetEditor()}
                    disabled={savingArticle}
                  >
                    Clear form
                  </button>
                  <button type="submit" className="primary-btn" disabled={savingArticle}>
                    {savingArticle ? "Saving…" : editor.id ? "Update article" : "Save article"}
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* Article Filters & Paginated Listing */}
          <section className="panel admin-panel">
            <div className="admin-panel-heading" style={{ flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2>Articles ({pagination.total})</h2>
              </div>
              <button
                type="button"
                className="outline-btn admin-action"
                onClick={() => void loadArticles()}
                disabled={loading}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            <div className="ca-admin-filters">
              <label className="form-field" style={{ margin: 0 }}>
                Search
                <div style={{ position: "relative" }}>
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Title, body, static GK…"
                  />
                </div>
              </label>

              <label className="form-field" style={{ margin: 0 }}>
                Category
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field" style={{ margin: 0 }}>
                Status
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <label className="form-field" style={{ margin: 0 }}>
                Source
                <input
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="RBI, PIB…"
                />
              </label>

              <label className="form-field" style={{ margin: 0 }}>
                From Date
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                />
              </label>

              <label className="form-field" style={{ margin: 0 }}>
                To Date
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                />
              </label>

              <label className="form-field" style={{ margin: 0 }}>
                Sort
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="updated">Recently updated</option>
                  <option value="title">Title A–Z</option>
                </select>
              </label>
            </div>

            {error && (
              <div className="ca-error-banner" role="alert">
                <span>{error}</span>
                <button type="button" className="outline-btn" onClick={() => void loadArticles()}>
                  Retry
                </button>
              </div>
            )}

            {loading ? (
              <div className="ca-state-box">Loading current affairs articles…</div>
            ) : affairs.length === 0 ? (
              <div className="ca-state-box">
                <Search size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                No articles match the current filters.
              </div>
            ) : (
              affairs.map((a) => {
                const safeUrl = getSafeExternalUrl(a.source_url);
                const isMcqOpen = openMcqIds.has(a.id);
                const isBusy = busyArticleId === a.id;
                return (
                  <article className="ca-admin-article" key={a.id}>
                    <div className="ca-admin-article-header">
                      <div>
                        <div className="ca-admin-meta">
                          <span className={`ca-badge ca-badge--${a.status}`}>{a.status}</span>
                          {a.priority_level && (
                            <span className={`ca-badge ca-badge--${a.priority_level}`}>
                              {a.priority_level.replace("_", " ")}
                            </span>
                          )}
                          <span>{a.category}</span>
                          {a.source_name && <span>· Source: {a.source_name}</span>}
                          <span>· {a.mcq_count ?? 0} MCQ(s)</span>
                          {a.published_at && (
                            <span>
                              · Pub:{" "}
                              {new Date(a.published_at).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          )}
                          {a.updated_at && (
                            <span>
                              · Updated:{" "}
                              {new Date(a.updated_at).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </span>
                          )}
                        </div>
                        <h3 style={{ margin: "4px 0 6px", overflowWrap: "anywhere" }}>{a.title}</h3>
                      </div>
                    </div>

                    <p style={{ margin: "0 0 8px", color: "#475569", fontSize: 13.5, overflowWrap: "anywhere" }}>
                      {(a.body || "").slice(0, 260)}
                      {(a.body || "").length > 260 ? "…" : ""}
                    </p>

                    {safeUrl ? (
                      <p className="affair-source-link" style={{ marginTop: 0, marginBottom: 8 }}>
                        <a href={safeUrl} target="_blank" rel="noopener noreferrer">
                          View official source{a.source_name ? ` (${a.source_name})` : ""} ↗
                        </a>
                      </p>
                    ) : a.source_url ? (
                      <p style={{ fontSize: 12.5, marginBottom: 8, color: "#991b1b" }}>
                        Source URL blocked (invalid or unsupported protocol).
                      </p>
                    ) : null}

                    <div className="ca-admin-actions">
                      <button
                        type="button"
                        className="outline-btn admin-action"
                        onClick={() => void handleStartEditArticle(a)}
                      >
                        <Edit2 size={13} /> Edit
                      </button>

                      {a.status !== "published" && (
                        <button
                          type="button"
                          className="outline-btn admin-action"
                          disabled={isBusy}
                          onClick={() => void handleStatusChange(a, "published")}
                        >
                          <CheckCircle2 size={13} /> Publish
                        </button>
                      )}

                      {a.status === "archived" && (
                        <button
                          type="button"
                          className="outline-btn admin-action"
                          disabled={isBusy}
                          onClick={() => void handleStatusChange(a, "draft")}
                        >
                          <RotateCcw size={13} /> Restore to Draft
                        </button>
                      )}

                      {a.status !== "archived" && (
                        <button
                          type="button"
                          className="outline-btn admin-action"
                          disabled={isBusy}
                          onClick={() => void handleStatusChange(a, "archived")}
                        >
                          <Archive size={13} /> Archive
                        </button>
                      )}

                      <button
                        type="button"
                        className="outline-btn admin-action"
                        disabled={isBusy}
                        onClick={() => void handleDeleteArticle(a)}
                      >
                        <Trash2 size={13} /> {isBusy ? "Working…" : "Delete"}
                      </button>

                      <button
                        type="button"
                        className={isMcqOpen ? "primary-btn" : "outline-btn admin-action"}
                        onClick={() => toggleMcqPanel(a.id)}
                      >
                        {isMcqOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />} MCQs (
                        {a.mcq_count ?? 0})
                      </button>
                    </div>

                    {isMcqOpen && (
                      <CurrentAffairsQuestionPanel
                        affairId={a.id}
                        onToast={onToast}
                        onConfirmModal={onConfirmModal}
                        onQuestionsChanged={() => void loadArticles()}
                      />
                    )}
                  </article>
                );
              })
            )}

            {/* Pagination Controls */}
            {pagination.total > 0 && (
              <div className="ca-pagination">
                <span>
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <div className="ca-pagination-actions">
                  <button
                    type="button"
                    className="outline-btn"
                    disabled={!pagination.hasPreviousPage || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <button
                    type="button"
                    className="outline-btn"
                    disabled={!pagination.hasNextPage || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* TAB 2: CATEGORY MANAGEMENT */}
      {subTab === "categories" && (
        <>
          <section className="panel admin-panel">
            <form onSubmit={handleSaveCategory}>
              <div className="admin-panel-heading">
                <div>
                  <span className="section-kicker">TAXONOMY</span>
                  <h2>{catForm.id ? "Edit category" : "Create category"}</h2>
                </div>
              </div>

              {catError && (
                <div className="ca-error-banner" role="alert">
                  <span>{catError}</span>
                </div>
              )}

              <div className="ca-editor-grid">
                <Field
                  label="Category Name *"
                  value={catForm.name}
                  onChange={(v) => setCatForm((p) => ({ ...p, name: v }))}
                />
                <Field
                  label="Slug (optional, auto-generated)"
                  value={catForm.slug}
                  onChange={(v) => setCatForm((p) => ({ ...p, slug: v }))}
                />
                <Field
                  label="Description"
                  value={catForm.description}
                  onChange={(v) => setCatForm((p) => ({ ...p, description: v }))}
                />
                <label className="form-field" style={{ margin: 0 }}>
                  Sort Order
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={catForm.sortOrder}
                    onChange={(e) => setCatForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
                  <input
                    type="checkbox"
                    checked={catForm.isActive}
                    onChange={(e) => setCatForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Active
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
                  <input
                    type="checkbox"
                    checked={catForm.isFeatured}
                    onChange={(e) => setCatForm((p) => ({ ...p, isFeatured: e.target.checked }))}
                  />
                  Featured
                </label>
              </div>

              <div className="admin-footer" style={{ marginTop: 14 }}>
                <span>Deactivate categories that have linked articles rather than deleting them.</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() => {
                      setCatForm(emptyCategoryForm());
                      setCatError("");
                    }}
                  >
                    Clear
                  </button>
                  <button type="submit" className="primary-btn" disabled={catSaving}>
                    <FolderPlus size={14} />{" "}
                    {catSaving ? "Saving…" : catForm.id ? "Update category" : "Add category"}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <section className="panel admin-panel">
            <h2>All Categories ({categories.length})</h2>
            {categories.length === 0 ? (
              <div className="ca-state-box">No categories configured yet.</div>
            ) : (
              <div className="ca-cat-table-wrap">
                <table className="ca-cat-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Slug</th>
                      <th>Articles</th>
                      <th>Sort</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                          {c.description && (
                            <div style={{ fontSize: 12, color: "#64748b" }}>{c.description}</div>
                          )}
                        </td>
                        <td>
                          <code>{c.slug || "-"}</code>
                        </td>
                        <td>{c.article_count ?? 0}</td>
                        <td>{c.sort_order ?? 0}</td>
                        <td>
                          <span
                            className={`ca-badge ${c.is_active === false ? "ca-badge--inactive" : "ca-badge--active"}`}
                          >
                            {c.is_active === false ? "Inactive" : "Active"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="outline-btn"
                              style={{ padding: "4px 8px", fontSize: 12 }}
                              onClick={() =>
                                setCatForm({
                                  id: c.id,
                                  name: c.name,
                                  slug: c.slug || "",
                                  description: c.description || "",
                                  icon: c.icon || "",
                                  sortOrder: c.sort_order ?? 0,
                                  isActive: c.is_active !== false,
                                  isFeatured: Boolean(c.is_featured),
                                })
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="outline-btn"
                              style={{ padding: "4px 8px", fontSize: 12 }}
                              onClick={() => void handleToggleCategory(c)}
                            >
                              {c.is_active === false ? "Activate" : "Deactivate"}
                            </button>
                            <button
                              type="button"
                              className="outline-btn"
                              style={{ padding: "4px 8px", fontSize: 12 }}
                              onClick={() => void handleDeleteCategory(c)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* TAB 3: RSS & BULK IMPORT */}
      {subTab === "ingestion" && (
        <section className="panel admin-panel">
          <div className="admin-panel-heading" style={{ flexWrap: "wrap", gap: 10 }}>
            <div>
              <span className="section-kicker">AUTOMATION &amp; BULK TOOLS</span>
              <h2>Official RSS Feeds &amp; JSON Bulk Import</h2>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="outline-btn admin-action"
                disabled={fetching}
                onClick={() => void handleFetchFeeds(["rbi"])}
              >
                <Download size={14} /> Fetch RBI Drafts
              </button>
              <button
                type="button"
                className="outline-btn admin-action"
                disabled={fetching}
                onClick={() => void handleFetchFeeds(["pib"])}
              >
                <Download size={14} /> Fetch PIB Drafts
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={fetching}
                onClick={() => void handleFetchFeeds(["rbi", "pib"])}
              >
                <RefreshCw size={14} /> {fetching ? "Fetching…" : "Fetch RBI + PIB"}
              </button>
            </div>
          </div>

          {statusMsg && (
            <div className="auth-notice" role="status" style={{ marginTop: 10 }}>
              {statusMsg}
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <small>
                Paste a JSON object with an <code>items</code> array (articles + optional MCQs).
              </small>
              <button
                type="button"
                className="text-link"
                onClick={() => setBulkText(SAMPLE_BULK_JSON)}
              >
                Load Sample JSON
              </button>
            </div>
            <textarea
              rows={12}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder='{"items": [...]}'
              style={{ width: "100%", fontFamily: "monospace", fontSize: 12.5 }}
            />
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="primary-btn"
                disabled={bulkBusy || !bulkText.trim()}
                onClick={() => void handleBulkImport()}
              >
                <Upload size={14} /> {bulkBusy ? "Importing…" : "Import Articles & Quizzes"}
              </button>
            </div>
          </div>
        </section>
      )}
      {subTab === "banking_ref" && (
        <CurrentAffairsReferenceAdmin onToast={onToast} />
      )}

      {subTab === "ai_review" && (
        <CurrentAffairsAIReview onToast={onToast} onConfirmModal={onConfirmModal} />
      )}

      {subTab === "mcq_gen" && (
        <CurrentAffairsQuestionGenerator onToast={onToast} onConfirmModal={onConfirmModal} />
      )}

      {subTab === "one_liners" && (
        <CurrentAffairsOneLinerAdmin onToast={onToast} />
      )}

      {subTab === "flashcards" && (
        <CurrentAffairsFlashcardAdmin onToast={onToast} />
      )}
      {subTab === "monthly_capsules" && (
        <MonthlyCapsuleAdmin />
      )}
      {subTab === "ga_marathon" && (
        <GAMarathonAdmin />
      )}
      {subTab === "analytics" && (
        <PlatformAnalyticsDashboard />
      )}
    </>
  );
}

export { CurrentAffairsView };