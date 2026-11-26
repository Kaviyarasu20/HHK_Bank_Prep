import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  FileQuestion,
  RefreshCw,
  Trash2
} from "lucide-react";
import { Field } from "../common/Field";
import { RuleBasedSelector } from "./RuleBasedSelector";
import { IntelligentExamCreatorPanel } from "./IntelligentExamCreatorPanel";
import { ExamOptGroups } from "../../utils/examCategories";

function buildTestNameGroups(selectedExam, stage, tests, setLabel = "Set 1") {
  const series = selectedExam && stage ? [
    `${selectedExam.name} ${stage.name} - ${setLabel}`,
    ...[1, 2, 3, 4, 5].map(
      (n) => `${selectedExam.name} ${stage.name} - Set ${n}`
    ),
    `${selectedExam.name} ${stage.name} - Live All-India Mock`,
    `${selectedExam.name} ${stage.name} - Speed & Accuracy Test`,
    `${selectedExam.name} ${stage.name} - Memory-Based Pattern Test`
  ] : [
    ...[1, 2, 3, 4, 5].map((n) => `Full Mock Test - Set ${n}`),
    "Live All-India Mock",
    "Speed & Accuracy Test",
    "Memory-Based Pattern Test"
  ];
  const uniqueSeries = [...new Set(series)];
  const sectional = selectedExam && stage ? (stage.sections ?? []).map(
    (sec) => `${selectedExam.name} ${stage.name} - ${sec.name} Sectional Test`
  ) : [];
  const known = new Set([...uniqueSeries, ...sectional]);
  const existing = [
    ...new Set(
      tests.filter(
        (t) => selectedExam && stage ? t.exam_id === selectedExam.id && t.stage_id === stage.id : true
      ).map((t) => String(t.name ?? "")).filter((name) => Boolean(name) && !known.has(name))
    )
  ];
  return {
    series: uniqueSeries,
    sectional,
    existing,
    all: [...uniqueSeries, ...sectional, ...existing]
  };
}

function formatAvailabilityWindow(start, end) {
  if (!start && !end) return null;
  const fmt = (iso) => new Date(iso).toLocaleString(void 0, {
    dateStyle: "medium",
    timeStyle: "short"
  });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end)}`;
}

function normalizeLabel(value, fallback) {
  const cleaned = String(value ?? "").trim();
  return cleaned || fallback;
}

function getOtherUsedSets(question, editingTestId) {
  const raw = Array.isArray(question?.used_in_sets) ? question.used_in_sets : [];
  return raw.filter((s) => s && s.id && s.id !== editingTestId);
}

function MockTestBuilderView({
  mode = "manage",
  tests,
  exams,
  questions,
  stageQuestions = [],
  stageQuestionsLoading = false,
  builder,
  editingTestId,
  examId,
  stageId,
  setNumber = 1,
  setLabel = "Set 1",
  testName,
  description,
  duration,
  reviewPolicy,
  selectionMode,
  selectionRules,
  availabilityStart,
  availabilityEnd,
  selected,
  busy,
  onSetBuilder,
  onResetTestBuilder,
  onEditTest,
  onDeleteTest,
  onChangeStatus,
  onDuplicateSet,
  onAutoIncrementSet,
  onCreateTest,
  onExamChange,
  onStageChange,
  onSetSetNumber,
  onSetSetLabel,
  onSetTestName,
  onSetDescription,
  onSetDuration,
  onSetReviewPolicy,
  onSetSelectionMode,
  onSetSelectionRules,
  onSetAvailabilityStart,
  onSetAvailabilityEnd,
  onSetSelected
}) {
  const examWiseTests = useMemo(
    () => tests.filter((t) => (t.test_type || "EXAM_WISE") === "EXAM_WISE"),
    [tests]
  );

  const selectedExam = exams.find((e) => e.id === examId);
  const stages = selectedExam?.stages ?? [];
  const stage = stages.find((s) => s.id === stageId);

  // Prefer the complete stage-scoped Question Bank list (not capped at global 500)
  const eligibleQuestions = useMemo(() => {
    if (!stageId) return [];
    if (stageQuestions.length > 0) return stageQuestions;
    return questions.filter(
      (q) => q.exam_name === selectedExam?.name && q.stage_name === stage?.name
    );
  }, [stageId, stageQuestions, questions, selectedExam?.name, stage?.name]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const testNameGroups = buildTestNameGroups(selectedExam, stage, examWiseTests, setLabel);
  const [customNameMode, setCustomNameMode] = useState(false);

  // Manual Question Bank Picker filter state
  const [activeSectionId, setActiveSectionId] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [subtopicFilter, setSubtopicFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [pickerSearch, setPickerSearch] = useState("");
  const [hideUsedInOtherSets, setHideUsedInOtherSets] = useState(false);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [collapsedTopics, setCollapsedTopics] = useState({});

  useEffect(() => {
    setCustomNameMode(false);
  }, [examId, stageId, editingTestId, builder]);

  useEffect(() => {
    setActiveSectionId("all");
    setTopicFilter("all");
    setSubtopicFilter("all");
    setDifficultyFilter("all");
    setPickerSearch("");
    setSelectedOnly(false);
    setCollapsedTopics({});
  }, [examId, stageId, editingTestId]);

  // Reset topic/subtopic filter when section changes
  useEffect(() => {
    setTopicFilter("all");
    setSubtopicFilter("all");
  }, [activeSectionId]);

  useEffect(() => {
    setSubtopicFilter("all");
  }, [topicFilter]);

  const isCustomTestName = customNameMode || Boolean(testName) && !testNameGroups.all.includes(testName);
  const testNameSelectValue = isCustomTestName ? "__custom__" : testName;

  const selectionRulesValid = Boolean(stage?.sections?.length) && stage.sections.every((section) => {
    const rule = selectionRules.find(
      (item) => item.sectionId === section.id
    );
    return Boolean(rule) && Number(rule.easyPercent) + Number(rule.mediumPercent) + Number(rule.hardPercent) === 100 && (!rule.topicDistribution?.length || rule.topicDistribution.reduce(
      (sum, item) => sum + Number(item.percent),
      0
    ) === 100);
  });

  // Live Exam Blueprint Checklist calculation for the Builder
  const builderBlueprint = useMemo(() => {
    if (!stage?.sections?.length) return null;
    const selectedQuestionObjs = eligibleQuestions.filter((q) => selectedSet.has(q.id));
    const sections = stage.sections.map((sec) => {
      const required = Number(sec.question_count || 0);
      const availableInBank = eligibleQuestions.filter((q) => q.section_id === sec.id).length;
      const assigned =
        selectionMode === "manual"
          ? selectedQuestionObjs.filter((q) => q.section_id === sec.id).length
          : Math.min(required, availableInBank);
      const missing = Math.max(0, required - assigned);
      return {
        id: sec.id,
        name: sec.name,
        required,
        assigned,
        availableInBank,
        missing,
        complete: required > 0 && assigned === required,
      };
    });
    const totalRequired = sections.reduce((s, x) => s + x.required, 0);
    const totalAssigned = sections.reduce((s, x) => s + x.assigned, 0);
    const isComplete = sections.every((s) => s.complete);
    return { sections, totalRequired, totalAssigned, isComplete };
  }, [stage, eligibleQuestions, selectedSet, selectionMode]);

  const sectionLimitMap = useMemo(() => {
    const map = new Map();
    for (const sec of builderBlueprint?.sections ?? []) {
      map.set(sec.id, sec);
    }
    return map;
  }, [builderBlueprint]);

  // Questions scoped to the active section tab
  const sectionScopedQuestions = useMemo(() => {
    if (activeSectionId === "all") return eligibleQuestions;
    return eligibleQuestions.filter((q) => q.section_id === activeSectionId);
  }, [eligibleQuestions, activeSectionId]);

  // Distinct topics in the active section (with counts)
  const availableTopics = useMemo(() => {
    const counts = new Map();
    for (const q of sectionScopedQuestions) {
      const t = normalizeLabel(q.topic_name, "Uncategorized Topic");
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [sectionScopedQuestions]);

  // Distinct subtopics in the active section + topic (with counts)
  const availableSubtopics = useMemo(() => {
    const counts = new Map();
    for (const q of sectionScopedQuestions) {
      const t = normalizeLabel(q.topic_name, "Uncategorized Topic");
      if (topicFilter !== "all" && t !== topicFilter) continue;
      const st = normalizeLabel(q.subtopic_name, "General");
      counts.set(st, (counts.get(st) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [sectionScopedQuestions, topicFilter]);

  // Filtered questions for the hierarchical Topic -> Subtopic tree
  const filteredPickerQuestions = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    return sectionScopedQuestions.filter((q) => {
      const isPicked = selectedSet.has(q.id);
      if (selectedOnly && !isPicked) return false;
      const t = normalizeLabel(q.topic_name, "Uncategorized Topic");
      if (topicFilter !== "all" && t !== topicFilter) return false;
      const st = normalizeLabel(q.subtopic_name, "General");
      if (subtopicFilter !== "all" && st !== subtopicFilter) return false;
      if (difficultyFilter !== "all" && String(q.difficulty || "").toLowerCase() !== difficultyFilter) {
        return false;
      }
      if (hideUsedInOtherSets && !isPicked && getOtherUsedSets(q, editingTestId).length > 0) {
        return false;
      }
      if (query) {
        const hay = `${q.question_text || ""} ${q.topic_name || ""} ${q.subtopic_name || ""} ${q.section_name || ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [
    sectionScopedQuestions,
    selectedSet,
    selectedOnly,
    topicFilter,
    subtopicFilter,
    difficultyFilter,
    hideUsedInOtherSets,
    editingTestId,
    pickerSearch
  ]);

  // Group filtered questions by Section + Topic -> Subtopic
  const groupedByTopic = useMemo(() => {
    const topicMap = new Map();
    for (const q of filteredPickerQuestions) {
      const topicName = normalizeLabel(q.topic_name, "Uncategorized Topic");
      const subtopicName = normalizeLabel(q.subtopic_name, "General");
      const key = `${q.section_id}::${topicName}`;
      if (!topicMap.has(key)) {
        topicMap.set(key, {
          key,
          sectionId: q.section_id,
          sectionName: q.section_name,
          topicName,
          totalCount: 0,
          selectedCount: 0,
          subtopicsMap: new Map(),
        });
      }
      const topicEntry = topicMap.get(key);
      topicEntry.totalCount += 1;
      if (selectedSet.has(q.id)) topicEntry.selectedCount += 1;

      if (!topicEntry.subtopicsMap.has(subtopicName)) {
        topicEntry.subtopicsMap.set(subtopicName, {
          name: subtopicName,
          questions: [],
          selectedCount: 0,
        });
      }
      const subEntry = topicEntry.subtopicsMap.get(subtopicName);
      subEntry.questions.push(q);
      if (selectedSet.has(q.id)) subEntry.selectedCount += 1;
    }

    return [...topicMap.values()].map((t) => ({
      ...t,
      subtopics: [...t.subtopicsMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [filteredPickerQuestions, selectedSet]);

  function toggleQuestion(q, checked) {
    if (checked) {
      const secMeta = sectionLimitMap.get(q.section_id);
      if (secMeta && secMeta.required > 0 && secMeta.assigned >= secMeta.required) {
        return;
      }
      onSetSelected((old) => (old.includes(q.id) ? old : [...old, q.id]));
    } else {
      onSetSelected((old) => old.filter((id) => id !== q.id));
    }
  }

  function toggleRcPassageSet(setQuestions, checked) {
    if (!setQuestions.length) return;
    const setIds = setQuestions.map((q) => q.id);
    if (checked) {
      const secId = setQuestions[0].section_id;
      const secMeta = sectionLimitMap.get(secId);
      const unpickedInSet = setQuestions.filter((q) => !selectedSet.has(q.id)).length;
      if (secMeta && secMeta.required > 0 && secMeta.assigned + unpickedInSet > secMeta.required) {
        return;
      }
      onSetSelected((old) => {
        const next = new Set(old);
        for (const id of setIds) next.add(id);
        return [...next];
      });
    } else {
      const removeSet = new Set(setIds);
      onSetSelected((old) => old.filter((id) => !removeSet.has(id)));
    }
  }

  function selectBatchRespectingCaps(questionList) {
    onSetSelected((old) => {
      const next = new Set(old);
      const countsBySection = new Map();
      for (const q of eligibleQuestions) {
        if (next.has(q.id)) {
          countsBySection.set(q.section_id, (countsBySection.get(q.section_id) ?? 0) + 1);
        }
      }
      // Group Reading Comprehension passage_group_id questions atomically so partial sets are never added
      const handledRcGroups = new Set();
      for (const q of questionList) {
        const isRcSetQ =
          String(q.topic_name || "").trim().toLowerCase() === "reading comprehension" &&
          Boolean(q.passage_group_id);
        if (isRcSetQ) {
          if (handledRcGroups.has(q.passage_group_id)) continue;
          handledRcGroups.add(q.passage_group_id);
          const groupQs = eligibleQuestions.filter((item) => item.passage_group_id === q.passage_group_id);
          const missingIds = groupQs.filter((item) => !next.has(item.id)).map((item) => item.id);
          if (!missingIds.length) continue;
          const secMeta = sectionLimitMap.get(q.section_id);
          const currentCount = countsBySection.get(q.section_id) ?? 0;
          if (secMeta && secMeta.required > 0 && currentCount + missingIds.length > secMeta.required) {
            continue;
          }
          for (const id of missingIds) next.add(id);
          countsBySection.set(q.section_id, currentCount + missingIds.length);
          continue;
        }
        if (next.has(q.id)) continue;
        const secMeta = sectionLimitMap.get(q.section_id);
        const currentCount = countsBySection.get(q.section_id) ?? 0;
        if (secMeta && secMeta.required > 0 && currentCount >= secMeta.required) {
          continue;
        }
        next.add(q.id);
        countsBySection.set(q.section_id, currentCount + 1);
      }
      return [...next];
    });
  }

  function deselectBatch(questionList) {
    const removeIds = new Set(questionList.map((q) => q.id));
    onSetSelected((old) => old.filter((id) => !removeIds.has(id)));
  }

  function clearSectionSelection(secId) {
    if (secId === "all") {
      onSetSelected([]);
      return;
    }
    const secIds = new Set(
      eligibleQuestions.filter((q) => q.section_id === secId).map((q) => q.id)
    );
    onSetSelected((old) => old.filter((id) => !secIds.has(id)));
  }

  return (
    <>
      <section className="panel admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="section-kicker">EXAM WISE MOCK TESTS (MULTI-SET)</span>
            <h2>
              {editingTestId
                ? `Edit Test Set — ${testName || setLabel}`
                : mode === "create"
                  ? "Create Exam Wise Test"
                  : "Manage Exam Wise Tests"}
            </h2>
          </div>
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              if (builder) onResetTestBuilder();
              else onSetBuilder(true);
            }}
          >
            {builder ? "Close builder" : "Create Exam Wise Set"}{" "}
            <ArrowRight size={14} />
          </button>
        </div>

        {builder && (
          <div className="test-builder">
            <div className="question-config">
              <label>
                Examination
                <select
                  value={examId}
                  onChange={(e) => onExamChange(e.target.value)}
                >
                  <option value="">Select exam</option>
                  <ExamOptGroups
                    exams={exams}
                    getKey={(e) => e.id}
                    getValue={(e) => e.id}
                    getLabel={(e) => e.name}
                  />
                </select>
              </label>

              <label>
                Stage
                <select
                  value={stageId}
                  onChange={(e) => onStageChange(e.target.value)}
                >
                  <option value="">Select stage</option>
                  {examId
                    ? stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {s.sections?.length ?? 0} sections ·{" "}
                          {Math.round((s.duration_seconds ?? 3600) / 60)} min
                        </option>
                      ))
                    : exams.map((e) => (
                        <optgroup key={e.id} label={e.name}>
                          {(e.stages ?? []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {e.name} — {s.name} ({s.sections?.length ?? 0} sections ·{" "}
                              {Math.round((s.duration_seconds ?? 3600) / 60)} min)
                            </option>
                          ))}
                        </optgroup>
                      ))}
                </select>
              </label>

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
                      onSetSetNumber?.(n);
                      onSetSetLabel?.(`Set ${n}`);
                    }}
                    style={{ width: "76px" }}
                  />
                  <input
                    type="text"
                    value={setLabel}
                    onChange={(e) => onSetSetLabel?.(e.target.value)}
                    placeholder="Set 1"
                  />
                  <button
                    type="button"
                    className="outline-btn admin-action"
                    disabled={!examId || !stageId}
                    title="Auto-increment Set Number for this exam & stage"
                    onClick={() => onAutoIncrementSet?.(examId, stageId)}
                  >
                    <RefreshCw size={13} /> Auto #
                  </button>
                </div>
              </label>

              <label>
                Test name
                <select
                  value={testNameSelectValue}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setCustomNameMode(true);
                      if (testNameGroups.all.includes(testName)) {
                        onSetTestName("");
                      }
                    } else {
                      setCustomNameMode(false);
                      onSetTestName(e.target.value);
                    }
                  }}
                >
                  <option value="">Select test name</option>
                  <optgroup
                    label={
                      selectedExam && stage
                        ? "Multi-set full-length mocks"
                        : "General mock templates"
                    }
                  >
                    {testNameGroups.series.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </optgroup>
                  {testNameGroups.sectional.length > 0 && (
                    <optgroup label="Sectional mocks">
                      {testNameGroups.sectional.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {testNameGroups.existing.length > 0 && (
                    <optgroup label="Saved test names">
                      {testNameGroups.existing.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="__custom__">Custom test name...</option>
                </select>
                {isCustomTestName && (
                  <input
                    className="custom-test-name-input"
                    type="text"
                    placeholder="Enter custom test name"
                    value={testName}
                    onChange={(e) => onSetTestName(e.target.value)}
                  />
                )}
              </label>

              <Field
                type="number"
                label="Duration (minutes)"
                value={String(duration)}
                onChange={(v) => onSetDuration(Number(v))}
              />
              <Field
                label="Description"
                value={description}
                onChange={onSetDescription}
              />

              <label>
                Available from (optional)
                <div className="datetime-input-row">
                  <input
                    type="datetime-local"
                    value={availabilityStart}
                    onChange={(e) => onSetAvailabilityStart(e.target.value)}
                  />
                  {availabilityStart && (
                    <button
                      type="button"
                      className="outline-btn admin-action"
                      onClick={() => onSetAvailabilityStart("")}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </label>

              <label>
                Available until (optional)
                <div className="datetime-input-row">
                  <input
                    type="datetime-local"
                    min={availabilityStart || void 0}
                    value={availabilityEnd}
                    onChange={(e) => onSetAvailabilityEnd(e.target.value)}
                  />
                  {availabilityEnd && (
                    <button
                      type="button"
                      className="outline-btn admin-action"
                      onClick={() => onSetAvailabilityEnd("")}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </label>

              <label>
                Question selection
                <select
                  value={selectionMode}
                  onChange={(e) => onSetSelectionMode(e.target.value)}
                >
                  <option value="rule_based">
                    Automatic question selection (no repeats)
                  </option>
                  <option value="manual">
                    Manual question selection (Question Bank by Topic &amp; Subtopic)
                  </option>
                </select>
              </label>

              <label>
                Question review
                <select
                  value={reviewPolicy}
                  onChange={(e) => onSetReviewPolicy(e.target.value)}
                >
                  <option value="after_submit">
                    Allow review after submission
                  </option>
                  <option value="never">Hide answer review</option>
                </select>
              </label>
            </div>

            {!editingTestId && (
              <IntelligentExamCreatorPanel
                exams={exams}
                examId={examId}
                stageId={stageId}
                onTestCreated={() => onResetTestBuilder?.()}
              />
            )}

            {/* Live Exam Blueprint Checklist */}
            {builderBlueprint && (
              <div className={`blueprint-guard-box ${builderBlueprint.isComplete ? "ready" : "incomplete"}`}>
                <div className="blueprint-guard-head">
                  <strong>
                    {builderBlueprint.isComplete ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    Exam Blueprint Checklist ({builderBlueprint.totalAssigned}/{builderBlueprint.totalRequired} questions)
                  </strong>
                  <span>
                    {builderBlueprint.isComplete
                      ? "100% Complete — Ready to publish after saving"
                      : "Complete all sections before publishing"}
                  </span>
                </div>
                <div className="blueprint-section-chips">
                  {builderBlueprint.sections.map((sec) => (
                    <div
                      key={sec.id}
                      className={`blueprint-chip ${sec.complete ? "done" : "missing"}`}
                    >
                      <strong>{sec.name}:</strong> {sec.assigned}/{sec.required}
                      {!sec.complete && sec.missing > 0 && (
                        <em> — {sec.missing} more needed</em>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <>
              {selectionMode === "manual" ? (
                <div className="qb-picker-panel">
                  <div className="qb-picker-head">
                    <div>
                      <strong>Question Bank Picker — Organized by Section, Topic &amp; Subtopic</strong>
                      <div>
                        <span>
                          {stageQuestionsLoading
                            ? "Loading published questions for this stage..."
                            : `${selected.length} selected · ${filteredPickerQuestions.length} of ${eligibleQuestions.length} published questions shown`}
                        </span>
                      </div>
                    </div>
                    <div className="qb-subtopic-actions">
                      <button
                        type="button"
                        className="qb-mini-btn"
                        disabled={!groupedByTopic.length}
                        onClick={() => setCollapsedTopics({})}
                      >
                        Expand All
                      </button>
                      <button
                        type="button"
                        className="qb-mini-btn"
                        disabled={!groupedByTopic.length}
                        onClick={() => {
                          const next = {};
                          for (const g of groupedByTopic) next[g.key] = true;
                          setCollapsedTopics(next);
                        }}
                      >
                        Collapse All
                      </button>
                      <button
                        type="button"
                        className="qb-mini-btn"
                        disabled={!selected.length}
                        onClick={() => clearSectionSelection(activeSectionId)}
                      >
                        {activeSectionId === "all" ? "Clear All Selected" : "Clear Section"}
                      </button>
                    </div>
                  </div>

                  {/* Section Tabs */}
                  {builderBlueprint?.sections?.length > 0 && (
                    <div className="qb-picker-tabs">
                      <button
                        type="button"
                        className={`qb-section-tab ${activeSectionId === "all" ? "active" : ""}`}
                        onClick={() => setActiveSectionId("all")}
                      >
                        All Sections
                        <span className="tab-count">
                          {builderBlueprint.totalAssigned}/{builderBlueprint.totalRequired}
                        </span>
                      </button>
                      {builderBlueprint.sections.map((sec) => (
                        <button
                          key={sec.id}
                          type="button"
                          className={`qb-section-tab ${activeSectionId === sec.id ? "active" : ""} ${sec.complete ? "complete" : ""}`}
                          onClick={() => setActiveSectionId(sec.id)}
                        >
                          {sec.name}
                          <span className="tab-count">
                            {sec.assigned}/{sec.required}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Topic, Subtopic, Difficulty & Search Filters */}
                  <div className="qb-picker-filters">
                    <select
                      aria-label="Filter by Topic"
                      value={topicFilter}
                      onChange={(e) => setTopicFilter(e.target.value)}
                    >
                      <option value="all">All Topics ({availableTopics.length})</option>
                      {availableTopics.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name} ({t.count})
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Filter by Subtopic"
                      value={subtopicFilter}
                      onChange={(e) => setSubtopicFilter(e.target.value)}
                    >
                      <option value="all">All Subtopics ({availableSubtopics.length})</option>
                      {availableSubtopics.map((st) => (
                        <option key={st.name} value={st.name}>
                          {st.name} ({st.count})
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Filter by Difficulty"
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value)}
                    >
                      <option value="all">All Difficulties</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>

                    <input
                      type="search"
                      placeholder="Search question text, topic, subtopic..."
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                    />
                  </div>

                  {/* Quick Toggles */}
                  <div className="qb-picker-toggles">
                    <div className="qb-picker-toggles-left">
                      <label className="qb-toggle-label">
                        <input
                          type="checkbox"
                          checked={hideUsedInOtherSets}
                          onChange={(e) => setHideUsedInOtherSets(e.target.checked)}
                        />
                        Hide questions already used in other sets
                      </label>
                      <label className="qb-toggle-label">
                        <input
                          type="checkbox"
                          checked={selectedOnly}
                          onChange={(e) => setSelectedOnly(e.target.checked)}
                        />
                        Show selected only ({selected.length})
                      </label>
                    </div>
                    {(topicFilter !== "all" || subtopicFilter !== "all" || difficultyFilter !== "all" || pickerSearch || hideUsedInOtherSets || selectedOnly) && (
                      <button
                        type="button"
                        className="qb-mini-btn"
                        onClick={() => {
                          setTopicFilter("all");
                          setSubtopicFilter("all");
                          setDifficultyFilter("all");
                          setPickerSearch("");
                          setHideUsedInOtherSets(false);
                          setSelectedOnly(false);
                        }}
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>

                  {/* Hierarchical Topic -> Subtopic Question List */}
                  {stageQuestionsLoading ? (
                    <p>Loading published questions from the Question Bank…</p>
                  ) : !stageId ? (
                    <p>Select an examination and stage above to browse the Question Bank.</p>
                  ) : !eligibleQuestions.length ? (
                    <p>No published questions match this exam stage yet. Add or publish questions in the Question Bank first.</p>
                  ) : !groupedByTopic.length ? (
                    <p>No questions match the current Topic / Subtopic / Search filters.</p>
                  ) : (
                    <div className="qb-topic-list">
                      {groupedByTopic.map((topicGroup) => {
                        const isCollapsed = Boolean(collapsedTopics[topicGroup.key]);
                        const topicQuestions = topicGroup.subtopics.flatMap((st) => st.questions);
                        const allTopicSelected = topicGroup.selectedCount === topicGroup.totalCount && topicGroup.totalCount > 0;
                        return (
                          <div key={topicGroup.key} className="qb-topic-group">
                            <div
                              className="qb-topic-header"
                              onClick={() =>
                                setCollapsedTopics((prev) => ({
                                  ...prev,
                                  [topicGroup.key]: !prev[topicGroup.key],
                                }))
                              }
                            >
                              <div className="qb-topic-title">
                                {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                                <span>{topicGroup.topicName}</span>
                                {activeSectionId === "all" && (
                                  <span className="qb-badge">{topicGroup.sectionName}</span>
                                )}
                              </div>
                              <div
                                className="qb-topic-meta"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span>
                                  {topicGroup.selectedCount}/{topicGroup.totalCount} selected
                                </span>
                                <button
                                  type="button"
                                  className="qb-mini-btn"
                                  onClick={() =>
                                    allTopicSelected
                                      ? deselectBatch(topicQuestions)
                                      : selectBatchRespectingCaps(topicQuestions)
                                  }
                                >
                                  {allTopicSelected ? "Deselect Topic" : "Select Topic"}
                                </button>
                              </div>
                            </div>

                            {!isCollapsed &&
                              String(topicGroup.topicName || "").trim().toLowerCase() === "reading comprehension" ? (
                                (() => {
                                  // Group RC questions into atomic passage sets (cannot select individual questions)
                                  const rcSetsMap = new Map();
                                  const standaloneRc = [];
                                  for (const q of topicQuestions) {
                                    if (q.passage_group_id) {
                                      if (!rcSetsMap.has(q.passage_group_id)) {
                                        rcSetsMap.set(q.passage_group_id, {
                                          groupId: q.passage_group_id,
                                          title: q.passage_title || "Reading Comprehension Passage Set",
                                          passageText: q.passage_text || "",
                                          sectionId: q.section_id,
                                          difficulty: q.difficulty || "medium",
                                          questions: [],
                                        });
                                      }
                                      rcSetsMap.get(q.passage_group_id).questions.push(q);
                                    } else {
                                      standaloneRc.push(q);
                                    }
                                  }
                                  const rcSets = [...rcSetsMap.values()].map((s) => {
                                    // Always include ALL published questions in this passage_group_id from eligibleQuestions
                                    const fullSetQs = eligibleQuestions.filter((item) => item.passage_group_id === s.groupId);
                                    return { ...s, questions: fullSetQs.length ? fullSetQs : s.questions };
                                  });

                                  return (
                                    <div className="qb-subtopic-group">
                                      <div className="qb-subtopic-head">
                                        <span className="qb-subtopic-name">
                                          Complete Reading Comprehension Passage Sets (Select as Full Set Only)
                                        </span>
                                        <div className="qb-subtopic-actions">
                                          <span>{rcSets.length} passage set(s)</span>
                                        </div>
                                      </div>
                                      {rcSets.map((setObj, sIdx) => {
                                        const allPicked =
                                          setObj.questions.length > 0 &&
                                          setObj.questions.every((q) => selectedSet.has(q.id));
                                        const secMeta = sectionLimitMap.get(setObj.sectionId);
                                        const remainingSlots = secMeta && secMeta.required > 0
                                          ? Math.max(0, secMeta.required - secMeta.assigned)
                                          : Infinity;
                                        const unpickedCount = setObj.questions.filter((q) => !selectedSet.has(q.id)).length;
                                        const notEnoughSlots = !allPicked && unpickedCount > remainingSlots;
                                        const otherSetsMap = new Map();
                                        for (const q of setObj.questions) {
                                          for (const os of getOtherUsedSets(q, editingTestId)) {
                                            otherSetsMap.set(os.id, os);
                                          }
                                        }
                                        const otherSets = [...otherSetsMap.values()];

                                        return (
                                          <label
                                            key={setObj.groupId}
                                            className={`qb-question-row ${allPicked ? "selected" : ""} ${notEnoughSlots ? "disabled-opt" : ""}`}
                                            title={
                                              notEnoughSlots
                                                ? `This RC set requires ${unpickedCount} slots in ${secMeta?.name || "this section"}, but only ${remainingSlots} slot(s) remain.`
                                                : `Select all ${setObj.questions.length} questions of this Reading Comprehension passage together`
                                            }
                                          >
                                            <input
                                              type="checkbox"
                                              checked={allPicked}
                                              disabled={notEnoughSlots}
                                              onChange={(e) => toggleRcPassageSet(setObj.questions, e.target.checked)}
                                            />
                                            <div style={{ display: "grid", gap: "6px" }}>
                                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                                                <strong style={{ fontSize: "13px", color: "#1e2133" }}>
                                                  RC Set {sIdx + 1}: {setObj.title}
                                                </strong>
                                                <div className="qb-question-badges">
                                                  <span className="qb-badge" style={{ background: "#eef2ff", color: "#4338ca" }}>
                                                    Atomic Set · {setObj.questions.length} Qs
                                                  </span>
                                                  <span className={`qb-badge diff-${String(setObj.difficulty).toLowerCase()}`}>
                                                    {setObj.difficulty}
                                                  </span>
                                                  {otherSets.length > 0 && (
                                                    <span className="qb-badge used-other">
                                                      Used in {otherSets.slice(0, 2).map((x) => x.set_label || x.name).join(", ")}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              {setObj.passageText && (
                                                <div style={{ fontSize: "12px", color: "#5e6178", lineHeight: 1.45 }}>
                                                  {setObj.passageText.slice(0, 220)}
                                                  {setObj.passageText.length > 220 ? "…" : ""}
                                                </div>
                                              )}
                                              <div style={{ display: "grid", gap: "3px", paddingLeft: "8px", borderLeft: "2px solid #dcd8fa" }}>
                                                {setObj.questions.map((sq, qIdx) => (
                                                  <div key={sq.id} style={{ fontSize: "11.5px", color: "#3a3d52" }}>
                                                    <strong>Q{qIdx + 1}.</strong> {sq.question_text}{" "}
                                                    {sq.subtopic_name && <span className="qb-badge">{sq.subtopic_name}</span>}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </label>
                                        );
                                      })}
                                      {standaloneRc.length > 0 && (
                                        <div style={{ fontSize: "12px", color: "#8a8d9f" }}>
                                          {standaloneRc.length} ungrouped RC question(s) without a passage set.
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : !isCollapsed &&
                              topicGroup.subtopics.map((subGroup) => {
                                const allSubSelected =
                                  subGroup.selectedCount === subGroup.questions.length &&
                                  subGroup.questions.length > 0;
                                return (
                                  <div key={subGroup.name} className="qb-subtopic-group">
                                    <div className="qb-subtopic-head">
                                      <span className="qb-subtopic-name">
                                        {subGroup.name}
                                      </span>
                                      <div className="qb-subtopic-actions">
                                        <span>
                                          {subGroup.selectedCount}/{subGroup.questions.length} selected
                                        </span>
                                        <button
                                          type="button"
                                          className="qb-mini-btn"
                                          onClick={() =>
                                            allSubSelected
                                              ? deselectBatch(subGroup.questions)
                                              : selectBatchRespectingCaps(subGroup.questions)
                                          }
                                        >
                                          {allSubSelected ? "Clear Subtopic" : "Select Subtopic"}
                                        </button>
                                      </div>
                                    </div>

                                    {subGroup.questions.map((q) => {
                                      const isPicked = selectedSet.has(q.id);
                                      const secMeta = sectionLimitMap.get(q.section_id);
                                      const sectionFull =
                                        !isPicked &&
                                        Boolean(secMeta) &&
                                        secMeta.required > 0 &&
                                        secMeta.assigned >= secMeta.required;
                                      const otherSets = getOtherUsedSets(q, editingTestId);
                                      const diff = String(q.difficulty || "medium").toLowerCase();

                                      return (
                                        <label
                                          key={q.id}
                                          className={`qb-question-row ${isPicked ? "selected" : ""} ${sectionFull ? "disabled-opt" : ""}`}
                                          title={
                                            sectionFull
                                              ? `${secMeta.name} already has ${secMeta.assigned}/${secMeta.required} questions selected`
                                              : ""
                                          }
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isPicked}
                                            disabled={sectionFull}
                                            onChange={(e) => toggleQuestion(q, e.target.checked)}
                                          />
                                          <div>
                                            <div className="qb-question-text">{q.question_text}</div>
                                            <div className="qb-question-badges">
                                              <span className={`qb-badge diff-${diff}`}>{diff}</span>
                                              <span className="qb-badge">
                                                +{q.marks ?? 1} / -{q.negative_marks ?? 0}
                                              </span>
                                              {q.question_type && q.question_type !== "mcq" && (
                                                <span className="qb-badge">{q.question_type}</span>
                                              )}
                                              {otherSets.length > 0 && (
                                                <span
                                                  className="qb-badge used-other"
                                                  title={otherSets.map((s) => s.name).join(", ")}
                                                >
                                                  Used in{" "}
                                                  {otherSets
                                                    .slice(0, 2)
                                                    .map((s) => s.set_label || s.name)
                                                    .join(", ")}
                                                  {otherSets.length > 2 ? ` +${otherSets.length - 2}` : ""}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {editingTestId && (
                    <div className="qb-switch-banner">
                      <span>
                        Want to hand-pick or replace specific questions from the Question Bank by Topic &amp; Subtopic?
                      </span>
                      <button
                        type="button"
                        className="outline-btn admin-action"
                        onClick={() => onSetSelectionMode("manual")}
                      >
                        Switch to Manual Question Bank Selection
                      </button>
                    </div>
                  )}
                  <RuleBasedSelector
                    sections={stage?.sections ?? []}
                    questions={eligibleQuestions}
                    value={selectionRules}
                    onChange={onSetSelectionRules}
                  />
                </>
              )}
            </>

            <div className="admin-footer">
              <span>
                {editingTestId
                  ? "Editing a draft updates its question selection. Tests with attempts cannot be changed."
                  : "You can save partial drafts, but publishing is strictly blocked until 100% of every blueprint section is filled."}
              </span>
              <div>
                <button
                  type="button"
                  className="outline-btn admin-action"
                  onClick={onResetTestBuilder}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={busy || (selectionMode === "rule_based" && !selectionRulesValid)}
                  onClick={onCreateTest}
                >
                  {editingTestId ? "Save changes" : "Save draft"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="section-table-wrap">
          <table className="section-table">
            <thead>
              <tr>
                <th>Set &amp; Test</th>
                <th>Examination / Stage</th>
                <th>Blueprint Progress</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {examWiseTests.map((t) => {
                const bp = t.blueprint_progress;
                const totalReq = bp?.totalRequired ?? Number(t.target_questions || 0);
                const totalPub = bp?.totalPublished ?? Number(t.published_question_count ?? t.question_count ?? 0);
                const isReady = Boolean(t.ready_to_publish);
                const blockReason = !isReady
                  ? t.exam_status !== "published"
                    ? "Publish parent examination first"
                    : `${totalPub}/${totalReq} questions added — complete all sections before publishing`
                  : "";

                return (
                  <tr key={t.id}>
                    <td>
                      <div className="test-name-cell">
                        <span className="set-badge">{t.set_label || `Set ${t.set_number || 1}`}</span>
                        <span>{t.name}</span>
                      </div>
                      {formatAvailabilityWindow(t.availability_start, t.availability_end) && (
                        <small className="table-subtext">
                          {formatAvailabilityWindow(t.availability_start, t.availability_end)}
                        </small>
                      )}
                    </td>
                    <td>
                      <div>{t.exam_name}</div>
                      <small className="table-subtext">{t.stage_name}</small>
                    </td>
                    <td>
                      <div className="table-blueprint-cell">
                        <span className={`progress-pill ${bp?.isComplete ? "complete" : "pending"}`}>
                          {bp?.isComplete ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                          {totalPub}/{totalReq || t.question_count} Qs
                        </span>
                        {bp?.sections?.length > 0 && !bp.isComplete && (
                          <div className="table-blueprint-missing">
                            {bp.sections
                              .filter((s) => !s.complete)
                              .map((s) => `${s.sectionName}: ${s.published}/${s.required}`)
                              .join(" · ")}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{Math.round(t.duration_seconds / 60)} min</td>
                    <td>
                      <span className={`status-pill status-${t.status}`}>{t.status}</span>
                    </td>
                    <td>
                      <div className="table-action-row">
                        {t.status === "draft" && (
                          <button
                            type="button"
                            className="outline-btn admin-action"
                            onClick={() => onEditTest(t)}
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          className="outline-btn admin-action"
                          disabled={busy}
                          title="Duplicate as next Set"
                          onClick={() => onDuplicateSet?.(t.id)}
                        >
                          <Copy size={12} /> Next Set
                        </button>
                        <button
                          type="button"
                          className={
                            t.status === "published"
                              ? "outline-btn admin-action"
                              : "primary-btn admin-action"
                          }
                          disabled={
                            busy ||
                            t.status === "archived" ||
                            (t.status !== "published" && !isReady)
                          }
                          title={blockReason}
                          onClick={() =>
                            onChangeStatus(
                              t.id,
                              t.status === "published" ? "draft" : "published"
                            )
                          }
                        >
                          {t.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          type="button"
                          className="danger-outline-btn"
                          disabled={busy}
                          title="Permanently delete this test set"
                          onClick={() => onDeleteTest?.(t)}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!examWiseTests.length && !busy && (
          <div className="empty-questions">No Exam Wise mock tests have been created.</div>
        )}
      </section>
      <div className="admin-note">
        <FileQuestion size={16} />
        <span>
          Exam Wise Tests simulate the official exam pattern and cannot be published until 100% of
          every section&apos;s question count and timer is fulfilled.
        </span>
      </div>
    </>
  );
}

export { MockTestBuilderView };