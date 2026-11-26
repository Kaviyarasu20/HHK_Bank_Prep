import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileText,
  Globe,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { rcAdminApi } from "../../api/readingComprehension";

function emptyQuestionDraft(optionCount = 5, category = "", difficulty = "moderate") {
  const keys = optionCount === 4 ? ["A", "B", "C", "D"] : ["A", "B", "C", "D", "E"];
  return {
    question_type: "Main Idea / Central Theme",
    category,
    difficulty,
    question_text: "",
    options: keys.map((k) => ({ key: k, text: "" })),
    correct_answer: "A",
    explanation: "",
    passage_reference: "",
  };
}

export function AdminReadingComprehension({ onToast, onConfirmModal }) {
  const [tab, setTab] = useState("generator"); // generator | manage | editor
  const [meta, setMeta] = useState(null);
  const [passages, setPassages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [error, setError] = useState("");

  // Generator configuration state
  const [examination, setExamination] = useState("IBPS PO");
  const [selectedCategories, setSelectedCategories] = useState(["Reading Comprehension – Banking"]);
  const [difficulty, setDifficulty] = useState("moderate");
  const [passageLength, setPassageLength] = useState("medium");
  const [numberOfPassages, setNumberOfPassages] = useState(1);
  const [questionsPerPassage, setQuestionsPerPassage] = useState(5);
  const [questionTypeMode, setQuestionTypeMode] = useState("all"); // all | specific
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState([]);
  const [optionCount, setOptionCount] = useState(5);
  const [includeExplanations, setIncludeExplanations] = useState(true);
  const [includeVocabulary, setIncludeVocabulary] = useState(true);

  // Active passage preview/detail state
  const [activePassage, setActivePassage] = useState(null);
  const [passageDraft, setPassageDraft] = useState(null);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestionDraft, setNewQuestionDraft] = useState(emptyQuestionDraft());

  // Manage tab filters
  const [filterExam, setFilterExam] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchText, setSearchText] = useState("");

  // Guided Question Editor (Section 9) state
  const [editExam, setEditExam] = useState("all");
  const [editCategory, setEditCategory] = useState("all");
  const [editPassageId, setEditPassageId] = useState("");
  const [editPassageDetail, setEditPassageDetail] = useState(null);
  const [editQuestionId, setEditQuestionId] = useState("");
  const [editQuestionForm, setEditQuestionForm] = useState(null);

  async function loadMetaAndPassages() {
    setLoading(true);
    setError("");
    try {
      const [m, p] = await Promise.all([rcAdminApi.getMeta(), rcAdminApi.listPassages()]);
      setMeta(m);
      setPassages(p.passages ?? []);
    } catch (e) {
      setError(e.message || "Failed to load Reading Comprehension studio.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMetaAndPassages();
  }, []);

  async function refreshPassages() {
    const p = await rcAdminApi.listPassages();
    setPassages(p.passages ?? []);
  }

  async function openPassageDetail(passageId) {
    setBusyMsg("Loading passage...");
    setError("");
    try {
      const res = await rcAdminApi.getPassage(passageId);
      setActivePassage(res.passage);
      setPassageDraft({
        title: res.passage.title,
        examination: res.passage.examination,
        category: res.passage.category,
        difficulty: res.passage.difficulty,
        passage_length: res.passage.passage_length,
        passage_text: res.passage.passage_text,
        recommended_time_seconds: res.passage.recommended_time_seconds || 600,
      });
      setShowAddQuestion(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyMsg("");
    }
  }

  function toggleCategory(cat) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? (prev.length > 1 ? prev.filter((c) => c !== cat) : prev) : [...prev, cat],
    );
  }

  function toggleQuestionType(qt) {
    setSelectedQuestionTypes((prev) =>
      prev.includes(qt) ? prev.filter((x) => x !== qt) : [...prev, qt],
    );
  }

  async function handleGenerate(generateQuestionsImmediately = true) {
    if (!selectedCategories.length) {
      setError("Select at least one Reading Comprehension category.");
      return;
    }
    if (questionTypeMode === "specific" && selectedQuestionTypes.length === 0) {
      setError("Select at least one specific question type or switch to All Question Types.");
      return;
    }
    setBusyMsg(
      generateQuestionsImmediately
        ? `Generating ${numberOfPassages} passage(s) + ${questionsPerPassage} validated questions with AI...`
        : `Generating ${numberOfPassages} draft passage(s) with AI...`,
    );
    setError("");
    try {
      const res = await rcAdminApi.generate({
        examination,
        categories: selectedCategories,
        difficulty,
        passageLength,
        numberOfPassages: Number(numberOfPassages) || 1,
        questionsPerPassage: Number(questionsPerPassage) || 5,
        questionTypes: questionTypeMode === "specific" ? selectedQuestionTypes : [],
        optionCount: Number(optionCount) === 4 ? 4 : 5,
        includeExplanations,
        includeVocabulary,
        generateQuestionsImmediately,
      });
      await refreshPassages();
      if (res.passages?.length) {
        const first = res.passages[0];
        setActivePassage(first);
        setPassageDraft({
          title: first.title,
          examination: first.examination,
          category: first.category,
          difficulty: first.difficulty,
          passage_length: first.passage_length,
          passage_text: first.passage_text,
          recommended_time_seconds: first.recommended_time_seconds || 600,
        });
      }
      onToast?.(res.message || "Draft Reading Comprehension generated. Review before publishing.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyMsg("");
    }
  }

  async function handleRegeneratePassage(id) {
    setBusyMsg("Regenerating passage & vocabulary with AI...");
    setError("");
    try {
      const res = await rcAdminApi.regeneratePassage(id);
      setActivePassage(res.passage);
      setPassageDraft({
        title: res.passage.title,
        examination: res.passage.examination,
        category: res.passage.category,
        difficulty: res.passage.difficulty,
        passage_length: res.passage.passage_length,
        passage_text: res.passage.passage_text,
        recommended_time_seconds: res.passage.recommended_time_seconds || 600,
      });
      await refreshPassages();
      onToast?.("Passage regenerated as draft.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyMsg("");
    }
  }

  async function handleGenerateQuestionsForActive(replaceExisting = true) {
    if (!activePassage) return;
    setBusyMsg("Generating & validating passage questions with AI...");
    setError("");
    try {
      const res = await rcAdminApi.generateQuestions(activePassage.id, {
        questionsPerPassage: Number(questionsPerPassage) || 5,
        questionTypes: questionTypeMode === "specific" ? selectedQuestionTypes : [],
        optionCount: Number(optionCount) === 4 ? 4 : 5,
        includeExplanations,
        replaceExisting,
      });
      setActivePassage(res.passage);
      await refreshPassages();
      onToast?.(
        `Generated ${res.qualitySummary?.generated ?? res.passage.questions.length} question(s) (${res.qualitySummary?.verifiedCount ?? 0} verified).`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyMsg("");
    }
  }

  async function handleSavePassageEdit() {
    if (!activePassage || !passageDraft) return;
    setBusyMsg("Saving passage edits...");
    setError("");
    try {
      const res = await rcAdminApi.updatePassage(activePassage.id, {
        ...passageDraft,
        recommended_time_seconds: Number(passageDraft.recommended_time_seconds) || 600,
      });
      setActivePassage(res.passage);
      await refreshPassages();
      onToast?.("Passage updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyMsg("");
    }
  }

  async function handleStatusChange(passage, nextStatus) {
    setBusyMsg(`${nextStatus === "published" ? "Publishing" : "Updating"} passage...`);
    setError("");
    try {
      const res = await rcAdminApi.updateStatus(passage.id, nextStatus);
      if (activePassage?.id === passage.id) setActivePassage(res.passage);
      await refreshPassages();
      onToast?.(`Passage "${passage.title}" marked as ${nextStatus}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyMsg("");
    }
  }

  async function handleDeletePassage(passage) {
    const confirmed = onConfirmModal
      ? await onConfirmModal({
          title: `Delete "${passage.title}"?`,
          message:
            "This will permanently delete the passage, all its generated questions, vocabulary list, and student practice attempts.",
          confirmText: "Delete Passage",
          cancelText: "Cancel",
          type: "danger",
          icon: "trash",
        })
      : window.confirm(`Delete passage "${passage.title}" and all its questions?`);
    if (!confirmed) return;

    setBusyMsg("Deleting passage...");
    setError("");
    try {
      await rcAdminApi.deletePassage(passage.id);
      if (activePassage?.id === passage.id) {
        setActivePassage(null);
        setPassageDraft(null);
      }
      if (editPassageId === passage.id) {
        setEditPassageId("");
        setEditPassageDetail(null);
        setEditQuestionId("");
        setEditQuestionForm(null);
      }
      await refreshPassages();
      onToast?.(`Deleted "${passage.title}".`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyMsg("");
    }
  }

  async function handleRegenerateSingleQuestion(questionId, overrideType) {
    setBusyMsg("Regenerating individual question with AI...");
    setError("");
    try {
      const res = await rcAdminApi.regenerateQuestion(
        questionId,
        overrideType ? { question_type: overrideType } : {},
      );
      if (activePassage?.id === res.passage.id) setActivePassage(res.passage);
      if (editPassageDetail?.id === res.passage.id) {
        setEditPassageDetail(res.passage);
        const updatedQ = res.passage.questions.find((q) => q.id === questionId);
        if (updatedQ) setEditQuestionForm(updatedQ);
      }
      await refreshPassages();
      onToast?.("Question regenerated without modifying sibling questions.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyMsg("");
    }
  }

  async function handleDeleteSingleQuestion(questionId) {
    setBusyMsg("Deleting question...");
    setError("");
    try {
      const res = await rcAdminApi.deleteQuestion(questionId);
      if (activePassage?.id === res.passage.id) setActivePassage(res.passage);
      if (editPassageDetail?.id === res.passage.id) {
        setEditPassageDetail(res.passage);
        setEditQuestionId("");
        setEditQuestionForm(null);
      }
      await refreshPassages();
      onToast?.("Question deleted.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyMsg("");
    }
  }

  async function handleAddManualQuestion() {
    if (!activePassage) return;
    setBusyMsg("Adding question...");
    setError("");
    try {
      const res = await rcAdminApi.addQuestion(activePassage.id, newQuestionDraft);
      setActivePassage(res.passage);
      setShowAddQuestion(false);
      setNewQuestionDraft(emptyQuestionDraft(activePassage.option_count, activePassage.category, activePassage.difficulty));
      await refreshPassages();
      onToast?.("Question added to passage.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyMsg("");
    }
  }

  // Guided Question Editor loader
  async function handleSelectEditPassage(pid) {
    setEditPassageId(pid);
    setEditQuestionId("");
    setEditQuestionForm(null);
    if (!pid) {
      setEditPassageDetail(null);
      return;
    }
    setBusyMsg("Loading passage questions...");
    try {
      const res = await rcAdminApi.getPassage(pid);
      setEditPassageDetail(res.passage);
      if (res.passage.questions?.length) {
        const firstQ = res.passage.questions[0];
        setEditQuestionId(firstQ.id);
        setEditQuestionForm({ ...firstQ });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyMsg("");
    }
  }

  async function handleSaveGuidedQuestion() {
    if (!editQuestionForm?.id) return;
    setBusyMsg("Saving question changes...");
    setError("");
    try {
      const res = await rcAdminApi.updateQuestion(editQuestionForm.id, {
        question_type: editQuestionForm.question_type,
        category: editQuestionForm.category,
        difficulty: editQuestionForm.difficulty,
        question_text: editQuestionForm.question_text,
        options: editQuestionForm.options,
        correct_answer: editQuestionForm.correct_answer,
        explanation: editQuestionForm.explanation || "",
        passage_reference: editQuestionForm.passage_reference || "",
      });
      setEditPassageDetail(res.passage);
      setEditQuestionForm({ ...res.question });
      if (activePassage?.id === res.passage.id) setActivePassage(res.passage);
      await refreshPassages();
      onToast?.("Question updated independently.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyMsg("");
    }
  }

  const filteredPassages = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return passages.filter((p) => {
      if (filterExam !== "all" && p.examination !== filterExam) return false;
      if (filterCategory !== "all" && p.category !== filterCategory) return false;
      if (filterDifficulty !== "all" && p.difficulty !== filterDifficulty) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (q && !`${p.title} ${p.category} ${p.examination}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [passages, filterExam, filterCategory, filterDifficulty, filterStatus, searchText]);

  const editorCandidatePassages = useMemo(() => {
    return passages.filter((p) => {
      if (editExam !== "all" && p.examination !== editExam) return false;
      if (editCategory !== "all" && p.category !== editCategory) return false;
      return true;
    });
  }, [passages, editExam, editCategory]);

  const aiReady = Boolean(meta?.aiStatus?.ready);

  return (
    <div className="rc-studio-wrap">
      <div className="rc-studio-header">
        <div>
          <span className="section-kicker">HHK ENGLISH LANGUAGE STUDIO</span>
          <h2>AI Reading Comprehension Generator &amp; Manager</h2>
          <p className="table-subtext">
            Generate original banking-exam passages across all 15 categories and 10 question types with automated quality validation, Tamil vocabulary support, and PDF exports.
          </p>
        </div>
        <div className="rc-studio-status-row">
          <span className={`status-pill ${aiReady ? "status-published" : "status-draft"}`}>
            {aiReady
              ? `AI Ready (${meta.aiStatus.provider})`
              : "AI Disabled — Configure CA_AI_ENABLED & API Key"}
          </span>
          <button type="button" className="outline-btn admin-action" onClick={() => void loadMetaAndPassages()}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div className="rc-tabs">
        <button type="button" className={tab === "generator" ? "active" : ""} onClick={() => setTab("generator")}>
          <Sparkles size={14} /> AI Generator Studio
        </button>
        <button type="button" className={tab === "manage" ? "active" : ""} onClick={() => setTab("manage")}>
          <BookOpen size={14} /> Manage Passages ({passages.length})
        </button>
        <button type="button" className={tab === "editor" ? "active" : ""} onClick={() => setTab("editor")}>
          <Edit3 size={14} /> Guided Question Editor
        </button>
      </div>

      {error && (
        <div className="admin-error" role="alert">
          {error}
          <button type="button" onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      {(loading || busyMsg) && (
        <div className="admin-loading">{busyMsg || "Loading Reading Comprehension Studio..."}</div>
      )}

      {/* TAB 1: AI GENERATOR STUDIO */}
      {tab === "generator" && (
        <section className="panel admin-panel rc-panel">
          <h3>Passage &amp; Question Configuration</h3>
          <div className="question-config">
            <label>
              Examination
              <select value={examination} onChange={(e) => setExamination(e.target.value)}>
                {(meta?.examinations ?? []).map((ex) => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            </label>

            <label>
              Passage Difficulty
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
              </select>
            </label>

            <label>
              Passage Length
              <select value={passageLength} onChange={(e) => setPassageLength(e.target.value)}>
                <option value="short">Short (220–320 words)</option>
                <option value="medium">Medium (380–520 words)</option>
                <option value="long">Long (560–740 words)</option>
              </select>
            </label>

            <label>
              Number of Passages (1–5)
              <input
                type="number"
                min={1}
                max={5}
                value={numberOfPassages}
                onChange={(e) => setNumberOfPassages(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
              />
            </label>

            <label>
              Questions Per Passage (1–15)
              <input
                type="number"
                min={1}
                max={15}
                value={questionsPerPassage}
                onChange={(e) => setQuestionsPerPassage(Math.max(1, Math.min(15, Number(e.target.value) || 5)))}
              />
            </label>

            <label>
              Number of Options
              <select value={optionCount} onChange={(e) => setOptionCount(Number(e.target.value))}>
                <option value={5}>5 Options (A–E — Banking Standard)</option>
                <option value={4}>4 Options (A–D)</option>
              </select>
            </label>

            <label>
              Include Detailed Explanations
              <select
                value={includeExplanations ? "yes" : "no"}
                onChange={(e) => setIncludeExplanations(e.target.value === "yes")}
              >
                <option value="yes">Yes — Detailed Explanations + Passage Ref</option>
                <option value="no">No — Brief Justification Only</option>
              </select>
            </label>

            <label>
              Include Vocabulary List (English + Tamil)
              <select
                value={includeVocabulary ? "yes" : "no"}
                onChange={(e) => setIncludeVocabulary(e.target.value === "yes")}
              >
                <option value="yes">Yes — Auto-Extract Banking Vocabulary</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>

          {/* All 15 Categories Multi-Select */}
          <div className="rc-config-block">
            <div className="rc-block-head">
              <strong>Passage Categories — Select One or Multiple ({selectedCategories.length} selected)</strong>
              <div className="rc-mini-actions">
                <button
                  type="button"
                  className="qb-mini-btn"
                  onClick={() => setSelectedCategories(meta?.allCategories ?? [])}
                >
                  Select All 15
                </button>
                <button
                  type="button"
                  className="qb-mini-btn"
                  onClick={() => setSelectedCategories(["Reading Comprehension – Banking"])}
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="rc-cat-group-label">A. Passage Subject Categories (10)</div>
            <div className="rc-chip-grid">
              {(meta?.subjectCategories ?? []).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`rc-chip ${selectedCategories.includes(cat) ? "selected" : ""}`}
                  onClick={() => toggleCategory(cat)}
                >
                  {cat.replace("Reading Comprehension – ", "")}
                </button>
              ))}
            </div>
            <div className="rc-cat-group-label">B. Question-Focused Categories (5)</div>
            <div className="rc-chip-grid">
              {(meta?.questionFocusedCategories ?? []).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`rc-chip ${selectedCategories.includes(cat) ? "selected" : ""}`}
                  onClick={() => toggleCategory(cat)}
                >
                  {cat.replace("Reading Comprehension – ", "")}
                </button>
              ))}
            </div>
          </div>

          {/* Question Types Configuration */}
          <div className="rc-config-block">
            <div className="rc-block-head">
              <strong>Question Types (10 Banking Formats)</strong>
              <div className="rc-mini-actions">
                <label className="qb-toggle-label">
                  <input
                    type="radio"
                    name="qtMode"
                    checked={questionTypeMode === "all"}
                    onChange={() => setQuestionTypeMode("all")}
                  />
                  All Question Types (Balanced Mix)
                </label>
                <label className="qb-toggle-label">
                  <input
                    type="radio"
                    name="qtMode"
                    checked={questionTypeMode === "specific"}
                    onChange={() => setQuestionTypeMode("specific")}
                  />
                  Select Specific Types
                </label>
              </div>
            </div>
            {questionTypeMode === "specific" && (
              <div className="rc-chip-grid">
                {(meta?.questionTypes ?? []).map((qt) => (
                  <button
                    key={qt}
                    type="button"
                    className={`rc-chip ${selectedQuestionTypes.includes(qt) ? "selected" : ""}`}
                    onClick={() => toggleQuestionType(qt)}
                  >
                    {qt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rc-action-bar">
            <button
              type="button"
              className="primary-btn"
              disabled={Boolean(busyMsg) || !aiReady}
              onClick={() => void handleGenerate(true)}
            >
              <Sparkles size={15} /> Generate Passage &amp; Questions (Save as Draft)
            </button>
            <button
              type="button"
              className="outline-btn admin-action"
              disabled={Boolean(busyMsg) || !aiReady}
              onClick={() => void handleGenerate(false)}
            >
              <FileText size={14} /> Generate Passage Only (Draft)
            </button>
          </div>
        </section>
      )}

      {/* TAB 2: MANAGE PASSAGES & FULL CRUD */}
      {tab === "manage" && (
        <section className="panel admin-panel rc-panel">
          <div className="qb-picker-filters">
            <select value={filterExam} onChange={(e) => setFilterExam(e.target.value)}>
              <option value="all">All Examinations</option>
              {(meta?.examinations ?? []).map((ex) => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">All 15 Categories</option>
              {(meta?.allCategories ?? []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="moderate">Moderate</option>
              <option value="hard">Hard</option>
              <option value="expert">Expert</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <input
              type="search"
              placeholder="Search passage title or category..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="section-table-wrap">
            <table className="section-table">
              <thead>
                <tr>
                  <th>Passage &amp; Category</th>
                  <th>Exam / Difficulty</th>
                  <th>Questions &amp; Vocab</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPassages.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.title}</strong>
                      <div className="table-subtext">{p.category} · {p.word_count} words</div>
                    </td>
                    <td>
                      <div>{p.examination}</div>
                      <small className="table-subtext">{p.difficulty} · {p.passage_length}</small>
                    </td>
                    <td>
                      <div>{p.question_count ?? 0} Questions</div>
                      <small className="table-subtext">{p.vocabulary_count ?? 0} Vocab words</small>
                    </td>
                    <td>
                      <span className={`status-pill status-${p.status}`}>{p.status}</span>
                    </td>
                    <td>
                      <div className="table-action-row">
                        <button
                          type="button"
                          className="outline-btn admin-action"
                          onClick={() => void openPassageDetail(p.id)}
                        >
                          <Eye size={12} /> Preview / Edit
                        </button>
                        <button
                          type="button"
                          className={p.status === "published" ? "outline-btn admin-action" : "primary-btn admin-action"}
                          disabled={Boolean(busyMsg)}
                          onClick={() => void handleStatusChange(p, p.status === "published" ? "draft" : "published")}
                        >
                          {p.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                        <a
                          className="outline-btn admin-action"
                          href={rcAdminApi.getPdfUrl(p.id, "practice")}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download size={12} /> Practice PDF
                        </a>
                        <a
                          className="outline-btn admin-action"
                          href={rcAdminApi.getPdfUrl(p.id, "answers")}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download size={12} /> Answer PDF
                        </a>
                        <button
                          type="button"
                          className="danger-outline-btn"
                          disabled={Boolean(busyMsg)}
                          onClick={() => void handleDeletePassage(p)}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredPassages.length && (
            <div className="empty-questions">No Reading Comprehension passages found for the selected filters.</div>
          )}
        </section>
      )}

      {/* TAB 3: GUIDED QUESTION EDITOR (Independent Single-Question Selection) */}
      {tab === "editor" && (
        <section className="panel admin-panel rc-panel">
          <h3>Guided Independent Question Editor</h3>
          <p className="table-subtext">
            Select Examination → Category → Passage → Question Number to edit any question independently without modifying sibling questions.
          </p>
          <div className="qb-picker-filters">
            <select
              value={editExam}
              onChange={(e) => {
                setEditExam(e.target.value);
                setEditPassageId("");
                setEditPassageDetail(null);
                setEditQuestionId("");
                setEditQuestionForm(null);
              }}
            >
              <option value="all">1. All Examinations</option>
              {(meta?.examinations ?? []).map((ex) => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>

            <select
              value={editCategory}
              onChange={(e) => {
                setEditCategory(e.target.value);
                setEditPassageId("");
                setEditPassageDetail(null);
                setEditQuestionId("");
                setEditQuestionForm(null);
              }}
            >
              <option value="all">2. All Categories</option>
              {(meta?.allCategories ?? []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select value={editPassageId} onChange={(e) => void handleSelectEditPassage(e.target.value)}>
              <option value="">3. Select Passage ({editorCandidatePassages.length})</option>
              {editorCandidatePassages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.examination})
                </option>
              ))}
            </select>

            <select
              value={editQuestionId}
              disabled={!editPassageDetail?.questions?.length}
              onChange={(e) => {
                const qid = e.target.value;
                setEditQuestionId(qid);
                const found = editPassageDetail?.questions?.find((q) => q.id === qid);
                setEditQuestionForm(found ? { ...found } : null);
              }}
            >
              <option value="">4. Select Question Number</option>
              {(editPassageDetail?.questions ?? []).map((q, idx) => (
                <option key={q.id} value={q.id}>
                  Q{idx + 1} — {q.question_type}
                </option>
              ))}
            </select>
          </div>

          {editPassageDetail && editQuestionForm && (
            <div className="rc-split-editor">
              <div className="rc-passage-ref-pane">
                <h4>{editPassageDetail.title}</h4>
                <div className="rc-meta-badges">
                  <span className="qb-badge">{editPassageDetail.examination}</span>
                  <span className="qb-badge">{editPassageDetail.category}</span>
                  <span className="qb-badge">{editPassageDetail.difficulty}</span>
                </div>
                <div className="rc-passage-body">
                  {String(editPassageDetail.passage_text || "")
                    .split(/\n\s*\n/)
                    .map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                </div>
              </div>

              <div className="rc-question-edit-pane">
                <div className="rc-block-head">
                  <strong>Editing Question #{editQuestionForm.question_number}</strong>
                  <div className="rc-mini-actions">
                    <button
                      type="button"
                      className="outline-btn admin-action"
                      disabled={Boolean(busyMsg) || !aiReady}
                      onClick={() => void handleRegenerateSingleQuestion(editQuestionForm.id, editQuestionForm.question_type)}
                    >
                      <RefreshCw size={12} /> Regenerate This Question
                    </button>
                    <button
                      type="button"
                      className="danger-outline-btn"
                      disabled={Boolean(busyMsg)}
                      onClick={() => void handleDeleteSingleQuestion(editQuestionForm.id)}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>

                <div className="question-config">
                  <label>
                    5. Question Type
                    <select
                      value={editQuestionForm.question_type}
                      onChange={(e) => setEditQuestionForm({ ...editQuestionForm, question_type: e.target.value })}
                    >
                      {(meta?.questionTypes ?? []).map((qt) => (
                        <option key={qt} value={qt}>{qt}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Question Category
                    <select
                      value={editQuestionForm.category || editPassageDetail.category}
                      onChange={(e) => setEditQuestionForm({ ...editQuestionForm, category: e.target.value })}
                    >
                      {(meta?.allCategories ?? []).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Difficulty
                    <select
                      value={editQuestionForm.difficulty}
                      onChange={(e) => setEditQuestionForm({ ...editQuestionForm, difficulty: e.target.value })}
                    >
                      <option value="easy">Easy</option>
                      <option value="moderate">Moderate</option>
                      <option value="hard">Hard</option>
                      <option value="expert">Expert</option>
                    </select>
                  </label>
                  <label>
                    Correct Answer
                    <select
                      value={editQuestionForm.correct_answer}
                      onChange={(e) => setEditQuestionForm({ ...editQuestionForm, correct_answer: e.target.value })}
                    >
                      {(editQuestionForm.options ?? []).map((o) => (
                        <option key={o.key} value={o.key}>Option {o.key}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="rc-full-field">
                  Question Statement
                  <textarea
                    rows={3}
                    value={editQuestionForm.question_text}
                    onChange={(e) => setEditQuestionForm({ ...editQuestionForm, question_text: e.target.value })}
                  />
                </label>

                <div className="rc-options-editor">
                  {(editQuestionForm.options ?? []).map((opt, idx) => (
                    <label key={opt.key} className="rc-opt-field">
                      <span>Option {opt.key}</span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const nextOpts = editQuestionForm.options.map((o, i) =>
                            i === idx ? { ...o, text: e.target.value } : o,
                          );
                          setEditQuestionForm({ ...editQuestionForm, options: nextOpts });
                        }}
                      />
                    </label>
                  ))}
                </div>

                <label className="rc-full-field">
                  Detailed Explanation
                  <textarea
                    rows={3}
                    value={editQuestionForm.explanation || ""}
                    onChange={(e) => setEditQuestionForm({ ...editQuestionForm, explanation: e.target.value })}
                  />
                </label>

                <label className="rc-full-field">
                  Supporting Passage Reference
                  <input
                    type="text"
                    value={editQuestionForm.passage_reference || ""}
                    onChange={(e) => setEditQuestionForm({ ...editQuestionForm, passage_reference: e.target.value })}
                  />
                </label>

                <div className="rc-action-bar">
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={Boolean(busyMsg)}
                    onClick={() => void handleSaveGuidedQuestion()}
                  >
                    <CheckCircle2 size={14} /> Save Question Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* PREVIEW / EDIT DRAWER FOR ACTIVE PASSAGE */}
      {activePassage && passageDraft && tab !== "editor" && (
        <section className="panel admin-panel rc-panel rc-preview-panel">
          <div className="rc-block-head">
            <div>
              <span className={`status-pill status-${activePassage.status}`}>{activePassage.status}</span>{" "}
              <strong>Preview &amp; Manage: {activePassage.title}</strong>
            </div>
            <div className="table-action-row">
              <button
                type="button"
                className="outline-btn admin-action"
                disabled={Boolean(busyMsg) || !aiReady}
                onClick={() => void handleRegeneratePassage(activePassage.id)}
              >
                <RefreshCw size={12} /> Regenerate Passage
              </button>
              <button
                type="button"
                className="outline-btn admin-action"
                disabled={Boolean(busyMsg) || !aiReady}
                onClick={() => void handleGenerateQuestionsForActive(true)}
              >
                <Sparkles size={12} /> {activePassage.questions?.length ? "Regenerate All Questions" : "Generate Questions"}
              </button>
              <button
                type="button"
                className={activePassage.status === "published" ? "outline-btn admin-action" : "primary-btn admin-action"}
                disabled={Boolean(busyMsg)}
                onClick={() =>
                  void handleStatusChange(activePassage, activePassage.status === "published" ? "draft" : "published")
                }
              >
                <Globe size={12} /> {activePassage.status === "published" ? "Unpublish" : "Publish Passage"}
              </button>
              <button
                type="button"
                className="danger-outline-btn"
                disabled={Boolean(busyMsg)}
                onClick={() => void handleDeletePassage(activePassage)}
              >
                <Trash2 size={12} /> Delete
              </button>
              <button type="button" className="qb-mini-btn" onClick={() => setActivePassage(null)}>
                Close
              </button>
            </div>
          </div>

          <div className="question-config">
            <label>
              Passage Title
              <input
                type="text"
                value={passageDraft.title}
                onChange={(e) => setPassageDraft({ ...passageDraft, title: e.target.value })}
              />
            </label>
            <label>
              Examination
              <select
                value={passageDraft.examination}
                onChange={(e) => setPassageDraft({ ...passageDraft, examination: e.target.value })}
              >
                {(meta?.examinations ?? []).map((ex) => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={passageDraft.category}
                onChange={(e) => setPassageDraft({ ...passageDraft, category: e.target.value })}
              >
                {(meta?.allCategories ?? []).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Difficulty
              <select
                value={passageDraft.difficulty}
                onChange={(e) => setPassageDraft({ ...passageDraft, difficulty: e.target.value })}
              >
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
              </select>
            </label>
          </div>

          <label className="rc-full-field">
            Passage Content ({activePassage.word_count} words)
            <textarea
              rows={8}
              value={passageDraft.passage_text}
              onChange={(e) => setPassageDraft({ ...passageDraft, passage_text: e.target.value })}
            />
          </label>

          <div className="rc-action-bar">
            <button type="button" className="primary-btn" disabled={Boolean(busyMsg)} onClick={() => void handleSavePassageEdit()}>
              Save Passage Changes
            </button>
            <button
              type="button"
              className="outline-btn admin-action"
              onClick={() => {
                setNewQuestionDraft(emptyQuestionDraft(activePassage.option_count, activePassage.category, activePassage.difficulty));
                setShowAddQuestion((v) => !v);
              }}
            >
              <Plus size={13} /> Add Question Manually
            </button>
          </div>

          {showAddQuestion && (
            <div className="rc-add-question-box">
              <h4>Add New Question to This Passage</h4>
              <div className="question-config">
                <label>
                  Question Type
                  <select
                    value={newQuestionDraft.question_type}
                    onChange={(e) => setNewQuestionDraft({ ...newQuestionDraft, question_type: e.target.value })}
                  >
                    {(meta?.questionTypes ?? []).map((qt) => (
                      <option key={qt} value={qt}>{qt}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Correct Answer
                  <select
                    value={newQuestionDraft.correct_answer}
                    onChange={(e) => setNewQuestionDraft({ ...newQuestionDraft, correct_answer: e.target.value })}
                  >
                    {newQuestionDraft.options.map((o) => (
                      <option key={o.key} value={o.key}>Option {o.key}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="rc-full-field">
                Question Statement
                <textarea
                  rows={2}
                  value={newQuestionDraft.question_text}
                  onChange={(e) => setNewQuestionDraft({ ...newQuestionDraft, question_text: e.target.value })}
                />
              </label>
              <div className="rc-options-editor">
                {newQuestionDraft.options.map((opt, idx) => (
                  <label key={opt.key} className="rc-opt-field">
                    <span>Option {opt.key}</span>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => {
                        const next = newQuestionDraft.options.map((o, i) =>
                          i === idx ? { ...o, text: e.target.value } : o,
                        );
                        setNewQuestionDraft({ ...newQuestionDraft, options: next });
                      }}
                    />
                  </label>
                ))}
              </div>
              <label className="rc-full-field">
                Explanation
                <textarea
                  rows={2}
                  value={newQuestionDraft.explanation}
                  onChange={(e) => setNewQuestionDraft({ ...newQuestionDraft, explanation: e.target.value })}
                />
              </label>
              <label className="rc-full-field">
                Supporting Passage Reference
                <input
                  type="text"
                  value={newQuestionDraft.passage_reference}
                  onChange={(e) => setNewQuestionDraft({ ...newQuestionDraft, passage_reference: e.target.value })}
                />
              </label>
              <button type="button" className="primary-btn" onClick={() => void handleAddManualQuestion()}>
                Save New Question
              </button>
            </div>
          )}

          {/* Questions List */}
          <div className="rc-questions-section">
            <h4>Generated Questions ({activePassage.questions?.length ?? 0})</h4>
            {(activePassage.questions ?? []).map((q, idx) => (
              <div key={q.id} className="rc-q-card">
                <div className="rc-block-head">
                  <div>
                    <strong>Q{idx + 1}.</strong>{" "}
                    <span className="qb-badge">{q.question_type}</span>{" "}
                    <span className={`qb-badge ${q.validation_status === "flagged" ? "diff-hard" : "diff-easy"}`}>
                      {q.validation_status}
                    </span>
                  </div>
                  <div className="rc-mini-actions">
                    <button
                      type="button"
                      className="qb-mini-btn"
                      onClick={() => {
                        setEditExam(activePassage.examination);
                        setEditCategory(activePassage.category);
                        setEditPassageId(activePassage.id);
                        setEditPassageDetail(activePassage);
                        setEditQuestionId(q.id);
                        setEditQuestionForm({ ...q });
                        setTab("editor");
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="qb-mini-btn"
                      disabled={Boolean(busyMsg) || !aiReady}
                      onClick={() => void handleRegenerateSingleQuestion(q.id)}
                    >
                      Regenerate
                    </button>
                    <button
                      type="button"
                      className="qb-mini-btn"
                      disabled={Boolean(busyMsg)}
                      onClick={() => void handleDeleteSingleQuestion(q.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="rc-q-stem">{q.question_text}</p>
                <div className="rc-q-opts">
                  {(q.options ?? []).map((opt) => (
                    <div key={opt.key} className={`rc-q-opt ${opt.key === q.correct_answer ? "correct" : ""}`}>
                      <strong>({opt.key})</strong> {opt.text}
                    </div>
                  ))}
                </div>
                {q.explanation && <div className="rc-q-exp"><strong>Explanation:</strong> {q.explanation}</div>}
                {q.passage_reference && <div className="rc-q-ref"><strong>Passage Reference:</strong> &ldquo;{q.passage_reference}&rdquo;</div>}
              </div>
            ))}
          </div>

          {/* Vocabulary Table */}
          {activePassage.vocabulary?.length > 0 && (
            <div className="rc-vocab-section">
              <h4>Passage Vocabulary ({activePassage.vocabulary.length} Words — English &amp; Tamil)</h4>
              <div className="section-table-wrap">
                <table className="section-table">
                  <thead>
                    <tr>
                      <th>Word &amp; Pronunciation</th>
                      <th>English Meaning</th>
                      <th>Tamil Meaning</th>
                      <th>Synonym / Antonym</th>
                      <th>Example &amp; Context</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePassage.vocabulary.map((v) => (
                      <tr key={v.id || v.word}>
                        <td>
                          <strong>{v.word}</strong>
                          {v.pronunciation && <div className="table-subtext">{v.pronunciation}</div>}
                        </td>
                        <td>{v.meaning_english}</td>
                        <td>{v.meaning_tamil}</td>
                        <td>
                          <div><strong>Syn:</strong> {v.synonym}</div>
                          <div><strong>Ant:</strong> {v.antonym}</div>
                        </td>
                        <td>
                          <div>{v.example_sentence}</div>
                          {v.passage_context && <small className="table-subtext">Context: &ldquo;{v.passage_context}&rdquo;</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
