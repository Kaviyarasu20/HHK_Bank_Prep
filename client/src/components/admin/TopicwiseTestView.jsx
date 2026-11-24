// Place at: client/src/components/admin/TopicwiseTestView.jsx
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  FileDown,
  Layers,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { BANKING_SYLLABUS } from "../../shared/bankingSyllabus";
import { AdminPdfExportButton } from "./AdminPdfExportButton";
import { exportQuestionsToPdf, isAdminUser } from "../../utils/exportQuestionsPdf";

const PRESET_COUNTS = [15, 20, 25, 30];

const EXTRA_TOPICS_BY_SUBJECT = {
  quant: ["Simplification", "Approximation", "Linear Equations"],
};

function getTopicsForSubject(subjectName) {
  const entry = BANKING_SYLLABUS.find(
    (s) => s.shortName === subjectName || s.name === subjectName
  );
  if (!entry) return [];
  const base = (entry.topics ?? []).map((t) => ({
    name: t.name,
    subtopics: t.subtopics ?? [],
  }));
  const extras = (EXTRA_TOPICS_BY_SUBJECT[entry.id] ?? [])
    .filter((name) => !base.some((b) => b.name.toLowerCase() === name.toLowerCase()))
    .map((name) => ({ name, subtopics: [] }));
  return [...extras, ...base];
}

function TopicwiseTestView({
  mode = "manage",
  tests = [],
  supportedTopics = { quant: [], reasoning: [] },
  busy,
  onRefreshTests,
  onPublishToggle,
  onDuplicateSet,
  onToast,
  onError,
  api,
  currentUser = null,
  user = null,
}) {
  // Resolve logged-in Admin user from props or /auth/me (so parent doesn't need changes)
  const [resolvedUser, setResolvedUser] = useState(currentUser || user || null);

  useEffect(() => {
    if (currentUser || user) {
      setResolvedUser(currentUser || user);
      return;
    }
    if (!api) return;
    let active = true;
    api("/auth/me")
      .then((res) => {
        if (!active) return;
        const found = res?.user || res?.data?.user || res?.account || res || null;
        setResolvedUser(found);
      })
      .catch(() => {
        if (active) setResolvedUser(null);
      });
    return () => {
      active = false;
    };
  }, [currentUser, user, api]);

  const canExportPdf = isAdminUser(resolvedUser);

  const topicwiseTests = useMemo(
    () => tests.filter((t) => t.test_type === "TOPIC_WISE"),
    [tests]
  );

  const allSupportedList = useMemo(
    () => [
      ...(supportedTopics.quant ?? []),
      ...(supportedTopics.reasoning ?? []),
    ].map((t) => String(t).toLowerCase()),
    [supportedTopics]
  );

  const isAutoSupported = (topicName) => {
    const norm = String(topicName || "").trim().toLowerCase();
    if (!norm) return false;
    return allSupportedList.some(
      (t) => norm === t || norm.includes(t) || t.includes(norm)
    );
  };

  // Builder state
  const [showForm, setShowForm] = useState(mode === "create");
  const [editingId, setEditingId] = useState("");
  const [subject, setSubject] = useState(BANKING_SYLLABUS[0]?.shortName || "Quantitative Aptitude");
  const [topic, setTopic] = useState("Simplification");
  const [subtopicName, setSubtopicName] = useState("");
  const [setNumber, setSetNumber] = useState(1);
  const [setLabel, setSetLabel] = useState("Set 1");
  const [testName, setTestName] = useState("Simplification - Set 1");
  const [description, setDescription] = useState("");
  const [targetQuestions, setTargetQuestions] = useState(20);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [marksPerQuestion, setMarksPerQuestion] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0.25);
  const [reviewPolicy, setReviewPolicy] = useState("after_submit");
  const [difficulty, setDifficulty] = useState("medium");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [topicBankQuestions, setTopicBankQuestions] = useState([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [working, setWorking] = useState(false);

  // Filters for manage list
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTopic, setFilterTopic] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Question preview modal
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    setShowForm(mode === "create");
  }, [mode]);

  const subjectTopics = useMemo(() => getTopicsForSubject(subject), [subject]);
  const selectedTopicObj = useMemo(
    () => subjectTopics.find((t) => t.name === topic),
    [subjectTopics, topic]
  );

  // Ensure topic stays valid when subject changes
  useEffect(() => {
    if (!editingId && subjectTopics.length > 0 && !subjectTopics.some((t) => t.name === topic)) {
      setTopic(subjectTopics[0].name);
      setSubtopicName("");
    }
  }, [subject, subjectTopics, editingId]);

  // Fetch auto-incremented set info when subject/topic changes (for new tests)
  async function fetchNextSet(subj = subject, top = topic) {
    if (!subj || !top) return;
    try {
      const info = await api(
        `/admin/mock-tests/next-set?testType=TOPIC_WISE&subject=${encodeURIComponent(subj)}&topic=${encodeURIComponent(top)}`
      );
      setSetNumber(info.nextSetNumber);
      setSetLabel(info.suggestedSetLabel);
      setTestName(info.suggestedName);
    } catch {
      // Fallback locally
      const existing = topicwiseTests.filter(
        (t) =>
          String(t.subject || "").toLowerCase() === subj.toLowerCase() &&
          String(t.topic || "").toLowerCase() === top.toLowerCase()
      );
      const next = existing.reduce((m, t) => Math.max(m, Number(t.set_number || 0)), 0) + 1;
      setSetNumber(next);
      setSetLabel(`Set ${next}`);
      setTestName(`${top} - Set ${next}`);
    }
  }

  useEffect(() => {
    if (!showForm || editingId || !subject || !topic) return;
    void fetchNextSet(subject, topic);
  }, [showForm, editingId, subject, topic]);

  // Load strictly topic-filtered published questions from Question Bank
  useEffect(() => {
    if (!showForm || !subject || !topic) {
      setTopicBankQuestions([]);
      return;
    }
    let active = true;
    setLoadingBank(true);
    api(
      `/admin/questions?status=published&subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}`
    )
      .then((res) => {
        if (active) setTopicBankQuestions(res.questions ?? []);
      })
      .catch(() => {
        if (active) setTopicBankQuestions([]);
      })
      .finally(() => {
        if (active) setLoadingBank(false);
      });
    return () => {
      active = false;
    };
  }, [showForm, subject, topic]);

  function resetForm(keepOpen = false) {
    setEditingId("");
    setDescription("");
    setTargetQuestions(20);
    setDurationMinutes(15);
    setMarksPerQuestion(1);
    setNegativeMarks(0.25);
    setReviewPolicy("after_submit");
    setSelectedQuestionIds([]);
    setSubtopicName("");
    setShowForm(keepOpen);
  }

  function startEdit(t) {
    setEditingId(t.id);
    setSubject(t.subject || BANKING_SYLLABUS[0]?.shortName || "Quantitative Aptitude");
    setTopic(t.topic || "");
    setSetNumber(Number(t.set_number || 1));
    setSetLabel(t.set_label || `Set ${t.set_number || 1}`);
    setTestName(t.name || "");
    setDescription(t.description || "");
    setTargetQuestions(Number(t.target_questions || 20));
    setDurationMinutes(Math.max(1, Math.round(Number(t.duration_seconds || 900) / 60)));
    setMarksPerQuestion(Number(t.marks_per_question ?? 1));
    setNegativeMarks(Number(t.negative_marks ?? 0.25));
    setReviewPolicy(t.review_policy || "after_submit");
    setSelectedQuestionIds(Array.isArray(t.question_ids) ? t.question_ids : []);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveTopicwiseDraft(autoGenerateAfterSave = false) {
    if (!subject || !topic) {
      onError("Choose a Subject and Topic first.");
      return;
    }
    const cleanTarget = Math.max(1, Math.min(200, Number(targetQuestions) || 20));
    const cleanDuration = Math.max(1, Number(durationMinutes) || 15);
    if (!autoGenerateAfterSave && selectedQuestionIds.length > cleanTarget) {
      onError(`Selected ${selectedQuestionIds.length} questions, which exceeds the target count of ${cleanTarget}.`);
      return;
    }

    setWorking(true);
    onError("");
    try {
      const payload = {
        subject,
        topic,
        setNumber: Number(setNumber) || 1,
        setLabel: (setLabel || `Set ${setNumber || 1}`).trim(),
        name: (testName || `${topic} - ${setLabel || `Set ${setNumber || 1}`}`).trim(),
        description,
        targetQuestions: cleanTarget,
        durationMinutes: cleanDuration,
        marksPerQuestion: Number(marksPerQuestion) || 1,
        negativeMarks: Number(negativeMarks) || 0,
        reviewPolicy,
        questionIds: selectedQuestionIds,
      };

      const saved = await api(
        editingId ? `/admin/mock-tests/topicwise/${editingId}` : "/admin/mock-tests/topicwise",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      const savedId = saved.test?.id || editingId;

      if (autoGenerateAfterSave && savedId) {
        const remainingNeeded = Math.max(0, cleanTarget - selectedQuestionIds.length);
        if (remainingNeeded > 0) {
          const genRes = await api(`/admin/mock-tests/${savedId}/generate-topic-questions`, {
            method: "POST",
            body: JSON.stringify({
              count: remainingNeeded,
              subtopicName,
              difficulty,
              replaceExisting: false,
            }),
          });
          onToast(
            `Saved "${payload.name}" and auto-generated ${genRes.generatedCount} fresh ${topic} questions (${genRes.assignedCount}/${genRes.targetQuestions} ready)!`
          );
        } else {
          onToast(`Saved "${payload.name}" — target count (${cleanTarget}/${cleanTarget}) already met.`);
        }
      } else {
        onToast(
          editingId
            ? `Topicwise Test "${payload.name}" updated.`
            : `Topicwise Test "${payload.name}" saved as draft.`
        );
      }

      await onRefreshTests();
      resetForm(false);
    } catch (e) {
      onError(e.message);
    } finally {
      setWorking(false);
    }
  }

  async function quickGenerateForSet(t) {
    setWorking(true);
    onError("");
    try {
      const target = Number(t.target_questions || 20);
      const current = Number(t.published_question_count ?? t.question_count ?? 0);
      const remaining = Math.max(1, target - current);
      const res = await api(`/admin/mock-tests/${t.id}/generate-topic-questions`, {
        method: "POST",
        body: JSON.stringify({
          count: remaining,
          difficulty: "medium",
          replaceExisting: false,
        }),
      });
      await onRefreshTests();
      onToast(
        `Generated ${res.generatedCount} fresh ${t.topic} questions for ${t.set_label} (${res.assignedCount}/${res.targetQuestions}).`
      );
    } catch (e) {
      onError(e.message);
    } finally {
      setWorking(false);
    }
  }

  async function openPreview(t) {
    setWorking(true);
    onError("");
    try {
      const res = await api(`/admin/mock-tests/${t.id}/questions`);
      setPreviewData(res);
    } catch (e) {
      onError(e.message);
    } finally {
      setWorking(false);
    }
  }

  // Quick 1-click Admin PDF export directly from a Topicwise Set card
  async function quickExportSetPdf(t) {
    if (!canExportPdf) {
      onError("PDF export is restricted to authorized Admin accounts only.");
      return;
    }
    setWorking(true);
    onError("");
    try {
      const res = await api(`/admin/mock-tests/${t.id}/questions`);
      const list = res?.questions ?? [];
      if (!list.length) {
        onError("No questions found in this set to export.");
        return;
      }
      await exportQuestionsToPdf({
        questions: list,
        currentUser: resolvedUser,
        includeSolutions: true,
        includeWatermark: true,
        logoUrl: "/hhk-logo.png",
        meta: {
          examName: res?.test?.name || t.name || "HHK Topicwise Test",
          stageName: res?.test?.set_label || t.set_label || "",
          sectionName: res?.test?.subject || t.subject || "Quantitative Aptitude",
          topicName: res?.test?.topic || t.topic || "Topicwise Set",
          subtopicName: res?.test?.set_label || t.set_label || "All Patterns",
          difficulty: "Mixed",
        },
      });
    } catch (e) {
      onError(e.message || "Failed to export PDF.");
    } finally {
      setWorking(false);
    }
  }

  // Group filtered topicwise tests by Subject -> Topic
  const filteredTests = useMemo(() => {
    return topicwiseTests.filter((t) => {
      if (filterSubject && t.subject !== filterSubject) return false;
      if (filterTopic && t.topic !== filterTopic) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      return true;
    });
  }, [topicwiseTests, filterSubject, filterTopic, filterStatus]);

  const groupedBySubjectTopic = useMemo(() => {
    const subjMap = new Map();
    for (const t of filteredTests) {
      const subj = t.subject || "General";
      const top = t.topic || "General";
      if (!subjMap.has(subj)) subjMap.set(subj, new Map());
      const topMap = subjMap.get(subj);
      if (!topMap.has(top)) topMap.set(top, []);
      topMap.get(top).push(t);
    }
    return [...subjMap.entries()].map(([subjName, topMap]) => ({
      subject: subjName,
      topics: [...topMap.entries()].map(([topicName, items]) => ({
        topic: topicName,
        sets: items.sort((a, b) => Number(a.set_number || 0) - Number(b.set_number || 0)),
      })),
    }));
  }, [filteredTests]);

  const availableSubjectsInList = useMemo(
    () => [...new Set(topicwiseTests.map((t) => t.subject).filter(Boolean))],
    [topicwiseTests]
  );
  const availableTopicsInList = useMemo(
    () =>
      [
        ...new Set(
          topicwiseTests
            .filter((t) => !filterSubject || t.subject === filterSubject)
            .map((t) => t.topic)
            .filter(Boolean)
        ),
      ],
    [topicwiseTests, filterSubject]
  );

  const canAutoGenerateSelectedTopic = isAutoSupported(topic);
  const isBusy = busy || working;

  return (
    <>
      <section className="panel admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="section-kicker">MULTI-SET TOPICWISE PRACTICE</span>
            <h2>{mode === "create" ? "Create Topicwise Test" : "Topicwise Tests"}</h2>
          </div>
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              if (showForm && !editingId) resetForm(false);
              else {
                resetForm(true);
              }
            }}
          >
            <Plus size={15} />
            {showForm ? "Hide Creator" : "New Topicwise Set"}
          </button>
        </div>

        {showForm && (
          <div className="test-builder topicwise-builder">
            <div className="question-config">
              <label>
                Subject
                <select
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setSelectedQuestionIds([]);
                  }}
                >
                  {BANKING_SYLLABUS.map((s) => (
                    <option key={s.id} value={s.shortName}>
                      {s.shortName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Topic
                <select
                  value={topic}
                  onChange={(e) => {
                    setTopic(e.target.value);
                    setSubtopicName("");
                    setSelectedQuestionIds([]);
                  }}
                >
                  {subjectTopics.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} {isAutoSupported(t.name) ? "✦ Auto-Gen" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {selectedTopicObj?.subtopics?.length > 0 && (
                <label>
                  Subtopic (optional for generator)
                  <select
                    value={subtopicName}
                    onChange={(e) => setSubtopicName(e.target.value)}
                  >
                    <option value="">All subtopics (balanced mix)</option>
                    {selectedTopicObj.subtopics.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                Set Number &amp; Label
                <div className="set-number-row">
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={setNumber}
                    onChange={(e) => {
                      const n = Math.max(1, Number(e.target.value) || 1);
                      setSetNumber(n);
                      setSetLabel(`Set ${n}`);
                      if (!editingId) setTestName(`${topic} - Set ${n}`);
                    }}
                    style={{ width: "78px" }}
                  />
                  <input
                    type="text"
                    value={setLabel}
                    onChange={(e) => {
                      setSetLabel(e.target.value);
                      if (!editingId) setTestName(`${topic} - ${e.target.value}`);
                    }}
                    placeholder="Set 1"
                  />
                  <button
                    type="button"
                    className="outline-btn admin-action"
                    title="Auto-suggest next set number"
                    onClick={() => void fetchNextSet(subject, topic)}
                  >
                    <RefreshCw size={13} /> Auto #
                  </button>
                </div>
              </label>

              <label>
                Test Title
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder={`${topic} - Set ${setNumber}`}
                />
              </label>

              <label>
                Question Count Target
                <div className="preset-count-row">
                  {PRESET_COUNTS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`preset-chip ${Number(targetQuestions) === preset ? "active" : ""}`}
                      onClick={() => setTargetQuestions(preset)}
                    >
                      {preset} Qs
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={targetQuestions}
                    onChange={(e) => setTargetQuestions(Math.max(1, Number(e.target.value) || 1))}
                    aria-label="Custom question count"
                    style={{ width: "74px" }}
                  />
                </div>
              </label>

              <label>
                Duration (Minutes)
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>

              <label>
                Marks / Question
                <input
                  type="number"
                  step="0.25"
                  min={0}
                  max={10}
                  value={marksPerQuestion}
                  onChange={(e) => setMarksPerQuestion(Number(e.target.value))}
                />
              </label>

              <label>
                Negative Marking
                <input
                  type="number"
                  step="0.05"
                  min={0}
                  max={5}
                  value={negativeMarks}
                  onChange={(e) => setNegativeMarks(Number(e.target.value))}
                />
              </label>

              <label>
                Generator Difficulty
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="easy">Easy (Prelims Clerk)</option>
                  <option value="medium">Medium (Prelims PO)</option>
                  <option value="hard">Hard (Mains)</option>
                  <option value="auto">Auto Blueprint Mix</option>
                </select>
              </label>

              <label>
                Review Policy
                <select
                  value={reviewPolicy}
                  onChange={(e) => setReviewPolicy(e.target.value)}
                >
                  <option value="after_submit">Allow review after submission</option>
                  <option value="never">Hide answer review</option>
                </select>
              </label>

              <label>
                Description (optional)
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Focused speed drill on this topic"
                />
              </label>
            </div>

            {/* 1-Click Auto-Generator Banner */}
            <div className={`topic-gen-banner ${canAutoGenerateSelectedTopic ? "supported" : "manual-only"}`}>
              <div>
                <strong>
                  <Sparkles size={15} />{" "}
                  {canAutoGenerateSelectedTopic
                    ? `1-Click Question Engine Ready for "${topic}"`
                    : `Manual Question Bank Mode for "${topic}"`}
                </strong>
                <p>
                  {canAutoGenerateSelectedTopic
                    ? `Generate ${Math.max(0, Number(targetQuestions) - selectedQuestionIds.length)} fresh, rule-verified ${topic} questions directly into ${setLabel} (automatically avoiding questions used in earlier sets).`
                    : `This topic is not yet in the auto-generator. Select published "${topic}" questions from the filtered Question Bank below.`}
                </p>
              </div>
              {canAutoGenerateSelectedTopic && (
                <button
                  type="button"
                  className="primary-btn"
                  disabled={isBusy}
                  onClick={() => void saveTopicwiseDraft(true)}
                >
                  <Sparkles size={14} />
                  {editingId ? "Save & Auto-Fill Remaining Qs" : `Create & Generate ${targetQuestions} Qs`}
                </button>
              )}
            </div>

            {/* Strictly Topic-Filtered Question Bank Picker */}
            <div className="test-question-picker">
              <div className="picker-header-row">
                <strong>
                  Topic-Filtered Question Bank — {topic} ({topicBankQuestions.length} published available)
                </strong>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {canExportPdf && topicBankQuestions.length > 0 && (
                    <AdminPdfExportButton
                      questions={
                        selectedQuestionIds.length > 0
                          ? topicBankQuestions.filter((q) => selectedQuestionIds.includes(q.id))
                          : topicBankQuestions
                      }
                      currentUser={resolvedUser}
                      onError={onError}
                      meta={{
                        examName: testName || `${topic} - ${setLabel}`,
                        stageName: setLabel,
                        sectionName: subject,
                        topicName: topic,
                        subtopicName: subtopicName || "All Patterns",
                        difficulty,
                      }}
                    />
                  )}
                  <span
                    className={`progress-pill ${
                      selectedQuestionIds.length === Number(targetQuestions) ? "complete" : "pending"
                    }`}
                  >
                    {selectedQuestionIds.length}/{targetQuestions} selected
                  </span>
                </div>
              </div>
              {loadingBank ? (
                <p>Loading published {topic} questions…</p>
              ) : topicBankQuestions.length > 0 ? (
                topicBankQuestions.map((q) => {
                  const checked = selectedQuestionIds.includes(q.id);
                  const limitReached =
                    !checked && selectedQuestionIds.length >= Number(targetQuestions);
                  return (
                    <label key={q.id} className={limitReached ? "disabled-opt" : ""}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={limitReached}
                        onChange={(e) =>
                          setSelectedQuestionIds((old) =>
                            e.target.checked
                              ? [...old, q.id]
                              : old.filter((id) => id !== q.id)
                          )
                        }
                      />
                      <span>
                        {q.topic_name}
                        {q.subtopic_name ? ` · ${q.subtopic_name}` : ""} · {q.difficulty}
                      </span>
                      <small>{q.question_text}</small>
                    </label>
                  );
                })
              ) : (
                <p>
                  No published questions found for "{topic}" in the Question Bank yet.
                  {canAutoGenerateSelectedTopic
                    ? " Use the 1-Click Generate button above to populate this set instantly."
                    : ""}
                </p>
              )}
            </div>

            <div className="admin-footer">
              <span>
                Topicwise sets can be published as soon as they reach{" "}
                <strong>
                  {targetQuestions}/{targetQuestions}
                </strong>{" "}
                published questions of "{topic}".
              </span>
              <div>
                <button
                  type="button"
                  className="outline-btn admin-action"
                  onClick={() => resetForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={isBusy}
                  onClick={() => void saveTopicwiseDraft(false)}
                >
                  {editingId ? "Save Changes" : "Save Draft Set"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar for Manage Grouped List */}
        <div className="topicwise-filter-bar">
          <select
            value={filterSubject}
            onChange={(e) => {
              setFilterSubject(e.target.value);
              setFilterTopic("");
            }}
            aria-label="Filter by Subject"
          >
            <option value="">All Subjects ({availableSubjectsInList.length})</option>
            {availableSubjectsInList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            aria-label="Filter by Topic"
          >
            <option value="">All Topics ({availableTopicsInList.length})</option>
            {availableTopicsInList.map((top) => (
              <option key={top} value={top}>
                {top}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by Status"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>

        {/* Grouped Subject -> Topic -> Set Cards */}
        {groupedBySubjectTopic.length > 0 ? (
          <div className="topicwise-groups">
            {groupedBySubjectTopic.map((subjGroup) => (
              <div key={subjGroup.subject} className="topicwise-subject-block">
                <div className="topicwise-subject-header">
                  <Layers size={16} />
                  <h3>{subjGroup.subject}</h3>
                </div>
                {subjGroup.topics.map((topicGroup) => (
                  <div key={topicGroup.topic} className="topicwise-topic-card">
                    <div className="topicwise-topic-title">
                      <strong>{topicGroup.topic}</strong>
                      <span>{topicGroup.sets.length} set(s)</span>
                    </div>
                    <div className="topicwise-set-grid">
                      {topicGroup.sets.map((t) => {
                        const target = Number(t.target_questions || 0);
                        const assigned = Number(t.published_question_count ?? t.question_count ?? 0);
                        const ready = target > 0 && assigned === target;
                        const missing = Math.max(0, target - assigned);
                        const canGen = t.status === "draft" && !ready && isAutoSupported(t.topic);

                        return (
                          <div key={t.id} className="topicwise-set-item">
                            <div className="topicwise-set-top">
                              <span className="set-badge">{t.set_label || `Set ${t.set_number}`}</span>
                              <span className={`status-pill status-${t.status}`}>
                                {t.status === "published" ? "Published" : "Draft"}
                              </span>
                            </div>
                            <div className="topicwise-set-name">{t.name}</div>
                            <div className="topicwise-set-meta">
                              <span className={`progress-pill ${ready ? "complete" : "pending"}`}>
                                {ready ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                                {assigned}/{target} Qs
                                {!ready && missing > 0 ? ` (${missing} needed)` : ""}
                              </span>
                              <span>
                                <Clock3 size={13} /> {Math.round(Number(t.duration_seconds || 0) / 60)} min
                              </span>
                              <span>
                                +{Number(t.marks_per_question ?? 1)} / -{Number(t.negative_marks ?? 0.25)}
                              </span>
                            </div>
                            <div className="topicwise-set-actions">
                              {canGen && (
                                <button
                                  type="button"
                                  className="outline-btn admin-action gen-btn"
                                  disabled={isBusy}
                                  onClick={() => void quickGenerateForSet(t)}
                                >
                                  <Sparkles size={13} /> Generate {missing} Qs
                                </button>
                              )}
                              <button
                                type="button"
                                className="outline-btn admin-action"
                                disabled={isBusy || assigned === 0}
                                onClick={() => void openPreview(t)}
                              >
                                <Eye size={13} /> Preview
                              </button>
                              {canExportPdf && (
                                <button
                                  type="button"
                                  className="outline-btn admin-action"
                                  disabled={isBusy || assigned === 0}
                                  title="Admin-only watermarked PDF download"
                                  onClick={() => void quickExportSetPdf(t)}
                                >
                                  <FileDown size={13} /> PDF
                                </button>
                              )}
                              <button
                                type="button"
                                className="outline-btn admin-action"
                                disabled={isBusy}
                                title="Duplicate as next Set"
                                onClick={() => onDuplicateSet(t.id)}
                              >
                                <Copy size={13} /> Next Set
                              </button>
                              {t.status === "draft" && (
                                <button
                                  type="button"
                                  className="outline-btn admin-action"
                                  disabled={isBusy}
                                  onClick={() => startEdit(t)}
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                type="button"
                                className={
                                  t.status === "published"
                                    ? "outline-btn admin-action"
                                    : "primary-btn admin-action"
                                }
                                disabled={isBusy || (t.status !== "published" && !ready)}
                                title={
                                  t.status !== "published" && !ready
                                    ? `Cannot publish: ${assigned} of ${target} questions added`
                                    : ""
                                }
                                onClick={() =>
                                  onPublishToggle(
                                    t.id,
                                    t.status === "published" ? "draft" : "published"
                                  )
                                }
                              >
                                {t.status === "published" ? "Unpublish" : "Publish"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          !isBusy && (
            <div className="empty-questions">
              No Topicwise Tests created yet. Click <strong>New Topicwise Set</strong> to create
              your first single-topic set.
            </div>
          )
        )}
      </section>

      {/* Question Preview Modal */}
      {previewData && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="panel modal-card topic-preview-modal">
            <div className="admin-panel-heading">
              <div>
                <span className="section-kicker">
                  {previewData.test?.subject} · {previewData.test?.topic} · {previewData.test?.set_label}
                </span>
                <h2>
                  {previewData.test?.name} ({previewData.questions?.length ?? 0} Questions)
                </h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <AdminPdfExportButton
                  questions={previewData.questions ?? []}
                  currentUser={resolvedUser}
                  onError={onError}
                  meta={{
                    examName: previewData.test?.name || "HHK Topicwise Test",
                    stageName: previewData.test?.set_label || "",
                    sectionName: previewData.test?.subject || "Quantitative Aptitude",
                    topicName: previewData.test?.topic || "Topicwise Set",
                    subtopicName: previewData.test?.set_label || "All Patterns",
                    difficulty: "Mixed",
                  }}
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setPreviewData(null)}
                  aria-label="Close preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="topic-preview-list">
              {(previewData.questions ?? []).map((q, idx) => (
                <div key={q.id} className="topic-preview-item">
                  <div className="saved-question-meta">
                    <span>Q{idx + 1}</span>
                    <span>{q.topic_name}</span>
                    {q.subtopic_name && <span>{q.subtopic_name}</span>}
                    <span>{q.difficulty}</span>
                    <b>Ans: {q.correct_answer}</b>
                  </div>
                  <p className="topic-preview-qtext">{q.question_text}</p>
                  {Array.isArray(q.options) && q.options.length > 0 && (
                    <div className="topic-preview-opts">
                      {q.options.map((opt) => (
                        <span
                          key={opt.key}
                          className={opt.key === q.correct_answer ? "correct-opt-pill" : ""}
                        >
                          ({opt.key}) {opt.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { TopicwiseTestView };