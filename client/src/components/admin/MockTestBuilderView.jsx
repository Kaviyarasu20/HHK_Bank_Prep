import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  FileQuestion,
  RefreshCw
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

function MockTestBuilderView({
  mode = "manage",
  tests,
  exams,
  questions,
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
  const eligibleQuestions = questions.filter(
    (q) => q.exam_name === selectedExam?.name && q.stage_name === stage?.name
  );
  const testNameGroups = buildTestNameGroups(selectedExam, stage, examWiseTests, setLabel);
  const [customNameMode, setCustomNameMode] = useState(false);

  useEffect(() => {
    setCustomNameMode(false);
  }, [examId, stageId, editingTestId, builder]);

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
    const selectedQuestionObjs = eligibleQuestions.filter((q) => selected.includes(q.id));
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
  }, [stage, eligibleQuestions, selected, selectionMode]);

  return (
    <>
      <section className="panel admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="section-kicker">EXAM WISE MOCK TESTS (MULTI-SET)</span>
            <h2>{mode === "create" ? "Create Exam Wise Test" : "Manage Exam Wise Tests"}</h2>
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
                    getLabel={(e) => `${e.name} · ${e.status}`}
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
                  <option value="manual">Manual question selection</option>
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

            <IntelligentExamCreatorPanel
              exams={exams}
              examId={examId}
              stageId={stageId}
              onTestCreated={() => onResetTestBuilder?.()}
            />

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
                <div className="test-question-picker">
                  <strong>Published questions for this stage</strong>
                  <span>{selected.length} selected</span>
                  {eligibleQuestions.map((q) => (
                    <label key={q.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(q.id)}
                        onChange={(e) =>
                          onSetSelected((old) =>
                            e.target.checked
                              ? [...old, q.id]
                              : old.filter((id) => id !== q.id)
                          )
                        }
                      />
                      <span>
                        {q.section_name} · {q.topic_name}
                      </span>
                      <small>{q.question_text}</small>
                    </label>
                  ))}
                  {!eligibleQuestions.length && (
                    <p>No published questions match this exam stage yet.</p>
                  )}
                </div>
              ) : (
                <RuleBasedSelector
                  sections={stage?.sections ?? []}
                  questions={eligibleQuestions}
                  value={selectionRules}
                  onChange={onSetSelectionRules}
                />
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
