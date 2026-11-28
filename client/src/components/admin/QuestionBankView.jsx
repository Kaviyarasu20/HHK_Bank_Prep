import { CustomSelect } from "../common/CustomSelect.jsx";
// ============================================================================
// QUESTION BANK MANAGEMENT & CONTENT AUTHORING VIEW
// ============================================================================
// Features:
// 1. Smart Auto-Question Generator (1-Click 100% Logic-Verified Seating, Puzzles, Syllogism, Inequality, DI, Quant)
// 2. Bulk CSV/Excel Importer with 20-question minimum validation & automatic activation
// 3. Exam -> Stage -> Section -> Topic -> Subtopic -> Difficulty hierarchy authoring
// 4. Dynamic banking syllabus topic dropdowns with subtopic cascade (DI, Puzzles, etc.)
// 5. Passage-group comprehension linking, image-based, MCQ, and descriptive questions
// 6. Saved questions search, filter by topic, multi-select bulk operations, and deduplication
// ============================================================================

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  FileQuestion,
  FileSpreadsheet,
  Save,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Field } from "../common/Field";
import {
  ExamOptGroups,
  groupExamsByCategory,
} from "../../utils/examCategories";
import {
  BANKING_SYLLABUS,
  getTopicsForSection,
  getSubtopicsForTopic,
} from "../../shared/bankingSyllabus.js";
import { AdminPdfExportButton } from "./AdminPdfExportButton";

/**
 * QuestionBankView - Full banking syllabus question authoring, auto-generator, and bulk import
 */
function QuestionBankView({
  exams,
  examIndex,
  stageIndex,
  questions,
  visibleQuestions,
  filter,
  form,
  editId,
  preview,
  uploadFile,
  uploadPreview,
  confirmRows,
  passageGroups,
  newPassage,
  showNewPassage,
  selectedQuestionIds,
  generatorPreview,
  busy,
  onSetExamIndex,
  onSetStageIndex,
  onSetFilter,
  onSetForm,
  onSetPreview,
  onSetUploadFile,
  onSetUploadPreview,
  onSetNewPassage,
  onSetShowNewPassage,
  onSetSelectedQuestionIds,
  onSetGeneratorPreview,
  onAutoGenerateQuestions,
  onPreviewUpload,
  onConfirmUpload,
  onCreatePassageGroup,
  onSaveQuestion,
  onEditQuestion,
  onDuplicateQuestion,
  onBulkQuestionStatus,
  onRemoveQuestion,
}) {
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [isCustomSubtopic, setIsCustomSubtopic] = useState(false);
  const [supportedAutoTopics, setSupportedAutoTopics] = useState([]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/questions/generate/topics", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.supportedTopics) return;
        const flat = [
          ...(data.supportedTopics.quant ?? []),
          ...(data.supportedTopics.reasoning ?? []),
          ...(data.supportedTopics.english ?? []),
        ].map((t) => String(t).trim().toLowerCase());
        setSupportedAutoTopics(flat);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const isTopicGeneratable = (topicName) => {
    const norm = String(topicName || "").trim().toLowerCase();
    if (!norm) return false;
    if (!supportedAutoTopics.length) return true;
    return supportedAutoTopics.some((t) => norm === t || norm.includes(t) || t.includes(norm));
  };
  const [topicFilter, setTopicFilter] = useState("");
  const [genCount, setGenCount] = useState(15);
  const [genDifficulty, setGenDifficulty] = useState("medium");

  const exam = exams[examIndex];
  const stage = exam?.stages[stageIndex];
  const selectedSection = stage?.sections.find((s) => s.id === form.sectionId);
  const syllabusTopics = selectedSection
    ? getTopicsForSection(selectedSection.name)
    : [];
  const availableSubtopics =
    selectedSection && form.topicName
      ? getSubtopicsForTopic(selectedSection.name, form.topicName)
      : [];

  const stagePublishedCount = questions.filter(
    (q) =>
      q.exam_name === exam?.name &&
      q.stage_name === stage?.name &&
      q.status === "published",
  ).length;
  const minRequired = Number(uploadPreview?.minimumRequired ?? 20);
  const meetsMinimumUpload = confirmRows.length >= minRequired;

  const distinctTopics = [
    ...new Set(questions.map((q) => q.topic_name).filter(Boolean)),
  ].sort();
  const filteredQuestions = topicFilter
    ? visibleQuestions.filter((q) => q.topic_name === topicFilter)
    : visibleQuestions;

  const isSetTopic =
    form.topicName &&
    (form.topicName.toLowerCase().includes("seating") ||
      form.topicName.toLowerCase().includes("puzzle") ||
      form.topicName.toLowerCase().includes("data interpretation"));

  return (
    <>
      {/* 1. SMART AUTO-QUESTION GENERATOR PANEL (100% Logic-Verified) */}
      <section className="panel admin-panel import-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="section-kicker">
              ZERO-MISTAKE ANSWER-FIRST ENGINE
            </span>
            <h2>
              <Sparkles size={17} /> Smart Topic Question Generator (No Logic
              Errors)
            </h2>
          </div>
          <span
            style={{
              fontSize: "12px",
              padding: "4px 10px",
              borderRadius: "999px",
              background: "var(--emerald-50, #ecfdf5)",
              color: "var(--emerald-800, #065f46)",
              fontWeight: 600,
            }}
          >
            100% Mathematically &amp; Logically Verified
          </span>
        </div>

        <p
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            margin: "0 0 12px",
          }}
        >
          Automatically generates verified <strong>Seating Arrangement</strong>{" "}
          (5-question passage sets), <strong>Puzzles</strong>,{" "}
          <strong>Syllogism</strong>, <strong>Inequality</strong>,{" "}
          <strong>Coding-Decoding</strong>, <strong>Data Interpretation</strong>
          , and <strong>Quantitative Aptitude</strong> questions using the
          selected Exam, Stage, Section, and Topic below.
        </p>

        <div
          className="question-config"
          style={{
            marginBottom: "12px",
            padding: "12px",
            borderRadius: "8px",
            background: "var(--bg-muted, #f8fafc)",
            border: "1px solid var(--border)",
          }}
        >
          <label>
            Exam
            <CustomSelect
              value={examIndex}
              onChange={(e) => {
                onSetExamIndex(Number(e.target.value));
                onSetStageIndex(0);
                onSetForm((v) => ({
                  ...v,
                  sectionId: "",
                  passageGroupId: "",
                }));
                onSetGeneratorPreview?.(null);
              }}
            >
              <ExamOptGroups
                exams={exams}
                getKey={(e) => e.id}
                getValue={(_e, i) => i}
                getLabel={(e) => e.name}
              />
            </CustomSelect>
          </label>

          <label>
            Stage
            <CustomSelect
              value={stageIndex}
              onChange={(e) => {
                onSetStageIndex(Number(e.target.value));
                onSetForm((v) => ({
                  ...v,
                  sectionId: "",
                  passageGroupId: "",
                }));
                onSetGeneratorPreview?.(null);
              }}
            >
              {exam?.stages.map((s, i) => (
                <option value={i} key={s.id ?? i}>
                  {s.name}
                </option>
              ))}
            </CustomSelect>
          </label>

          <label>
            Section
            <CustomSelect
              value={form.sectionId}
              onChange={(e) => {
                onSetForm({
                  ...form,
                  sectionId: e.target.value,
                  topicName: "",
                  subtopicName: "",
                  passageGroupId: "",
                });
                setIsCustomTopic(false);
                setIsCustomSubtopic(false);
                onSetGeneratorPreview?.(null);
              }}
            >
              <option value="">Choose section</option>
              {stage?.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </CustomSelect>
          </label>

          <label>
            Topic to Auto-Generate
            <CustomSelect
              value={form.topicName}
              disabled={!selectedSection}
              onChange={(e) => {
                onSetForm({
                  ...form,
                  topicName: e.target.value,
                  subtopicName: "",
                });
                onSetGeneratorPreview?.(null);
              }}
            >
              <option value="">
                {selectedSection
                  ? "Choose topic to generate"
                  : "← Choose section first"}
              </option>
              {syllabusTopics.length > 0
                ? (() => {
                    const ready = syllabusTopics.filter((t) => isTopicGeneratable(t.name));
                    const manualOnly = syllabusTopics.filter((t) => !isTopicGeneratable(t.name));
                    return (
                      <>
                        {ready.length > 0 && (
                          <optgroup label={`Auto-Generate Ready (${ready.length})`}>
                            {ready.map((t) => (
                              <option key={t.name} value={t.name}>
                                ✓ {t.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {manualOnly.length > 0 && (
                          <optgroup label={`Manual / CSV Only (${manualOnly.length})`}>
                            {manualOnly.map((t) => (
                              <option key={t.name} value={t.name} disabled>
                                {t.name} (Manual / CSV only)
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    );
                  })()
                : BANKING_SYLLABUS.map((subj) => (
                    <optgroup key={subj.id} label={subj.shortName}>
                      {subj.topics.map((t) => {
                        const ok = isTopicGeneratable(t.name);
                        return (
                          <option key={t.name} value={t.name} disabled={!ok}>
                            {ok ? `✓ ${t.name}` : `${t.name} (Manual / CSV only)`}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
            </CustomSelect>
          </label>

          {availableSubtopics.length > 0 && (
            <label>
              Subtopic Pattern
              <CustomSelect
                value={form.subtopicName}
                onChange={(e) => {
                  onSetForm({ ...form, subtopicName: e.target.value });
                  onSetGeneratorPreview?.(null);
                }}
              >
                <option value="">
                  Default ({availableSubtopics[0]})
                </option>
                {availableSubtopics.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </CustomSelect>
            </label>
          )}

          <label>
            Questions Count
            <CustomSelect
              value={genCount}
              onChange={(e) => setGenCount(Number(e.target.value))}
            >
              <option value={5}>5 Questions (1 Set)</option>
              <option value={10}>10 Questions (2 Sets)</option>
              <option value={15}>15 Questions (3 Sets)</option>
              <option value={20}>
                20 Questions (4 Sets · Unlocks Mock Test)
              </option>
              <option value={35}>35 Questions (Full Prelims Section)</option>
              <option value={40}>40 Questions (Full RRB Section)</option>
            </CustomSelect>
          </label>

          <label>
            Difficulty
            <CustomSelect
              value={genDifficulty}
              onChange={(e) => setGenDifficulty(e.target.value)}
            >
              <option value="easy">Easy (Prelims Clerk)</option>
              <option value="medium">Medium (Prelims PO)</option>
              <option value="hard">Hard (Mains Level)</option>
            </CustomSelect>
          </label>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="outline-btn admin-action"
            disabled={!form.sectionId || !form.topicName || busy}
            onClick={() =>
              onAutoGenerateQuestions?.({
                sectionId: form.sectionId,
                topicName: form.topicName,
                subtopicName: form.subtopicName,
                difficulty: genDifficulty,
                count: genCount,
                status: "published",
                previewOnly: true,
              })
            }
          >
            Preview {genCount} {form.topicName || ""} Questions
          </button>

          <button
            type="button"
            className="primary-btn"
            disabled={!form.sectionId || !form.topicName || busy}
            onClick={() =>
              onAutoGenerateQuestions?.({
                sectionId: form.sectionId,
                topicName: form.topicName,
                subtopicName: form.subtopicName,
                difficulty: genDifficulty,
                count: genCount,
                status: "published",
                previewOnly: false,
              })
            }
          >
            <Sparkles size={15} /> Auto-Generate &amp; Publish {genCount}{" "}
            Questions
          </button>

          {isSetTopic && (
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Creates {Math.ceil(genCount / 5)} solved{" "}
              <code>passage_groups</code> set(s) with 5 linked MCQs each.
            </span>
          )}
        </div>

        {generatorPreview && (
          <div
            style={{
              marginTop: "14px",
              padding: "14px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "#ffffff",
              maxHeight: "420px",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <strong>
                Preview: {generatorPreview.totalQuestions} Verified Questions (
                {generatorPreview.section?.examName} ·{" "}
                {generatorPreview.section?.name})
              </strong>
              <button
                type="button"
                className="text-link"
                onClick={() => onSetGeneratorPreview?.(null)}
              >
                Close preview
              </button>
            </div>

            {generatorPreview.mode === "passage_sets"
              ? generatorPreview.passageSets.map((setItem, sIdx) => (
                  <div
                    key={sIdx}
                    style={{
                      marginBottom: "14px",
                      padding: "10px",
                      borderRadius: "6px",
                      background: "var(--bg-muted, #f8fafc)",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                      {setItem.passage.title}
                    </div>
                    <p
                      style={{
                        fontSize: "12.5px",
                        whiteSpace: "pre-line",
                        marginBottom: "8px",
                      }}
                    >
                      {setItem.passage.passageText}
                    </p>
                    {setItem.questions.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        style={{
                          padding: "8px",
                          marginBottom: "6px",
                          background: "#fff",
                          borderRadius: "4px",
                          border: "1px solid var(--border)",
                          fontSize: "12.5px",
                        }}
                      >
                        <strong>
                          Q{sIdx * 5 + qIdx + 1}. {q.questionText}
                        </strong>
                        <div style={{ margin: "4px 0" }}>
                          {q.options.map((o) => (
                            <span key={o.key} style={{ marginRight: "12px" }}>
                              <b>{o.key}.</b> {o.text}
                            </span>
                          ))}
                        </div>
                        <div style={{ color: "var(--emerald-800, #065f46)" }}>
                          <b>Ans: {q.correctAnswer}</b> — {q.explanation}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              : generatorPreview.standaloneQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "8px",
                      marginBottom: "6px",
                      background: "var(--bg-muted, #f8fafc)",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      fontSize: "12.5px",
                    }}
                  >
                    <div style={{ display: "flex", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                      {q.subtopicName && (
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", background: "#e0e7ff", color: "#1e40af" }}>
                          {q.subtopicName}
                        </span>
                      )}
                      {q.difficulty && (
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", background: "#fef3c7", color: "#92400e", textTransform: "uppercase" }}>
                          {q.difficulty}
                        </span>
                      )}
                    </div>
                    <strong style={{ whiteSpace: "pre-line" }}>
                      Q{idx + 1}. {q.questionText}
                    </strong>
                    <div style={{ margin: "4px 0" }}>
                      {q.options.map((o) => (
                        <span key={o.key} style={{ marginRight: "12px" }}>
                          <b>{o.key}.</b> {o.text}
                        </span>
                      ))}
                    </div>
                    <div style={{ color: "var(--emerald-800, #065f46)" }}>
                      <b>Ans: {q.correctAnswer}</b> — {q.explanation}
                    </div>
                  </div>
                ))}
          </div>
        )}
      </section>

      <section className="panel admin-panel import-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="section-kicker">BULK QUESTION UPLOAD</span>
            <h2>
              <FileSpreadsheet size={17} /> CSV or Excel import (Min 20
              questions)
            </h2>
          </div>
          <a
            className="outline-btn admin-action"
            href="/api/admin/questions/import/template.csv"
          >
            Download template
          </a>
        </div>
        <div className="import-controls">
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => {
              onSetUploadFile(e.target.files?.[0] ?? null);
              onSetUploadPreview(null);
            }}
          />
          <button
            className="outline-btn admin-action"
            disabled={!uploadFile || busy}
            onClick={onPreviewUpload}
          >
            Validate upload
          </button>
        </div>
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            margin: "4px 0 10px",
          }}
        >
          Template columns: <code>exam_code</code>, <code>stage</code>,{" "}
          <code>section</code>, <code>topic</code>, <code>subtopic</code>{" "}
          (optional), <code>difficulty</code>, <code>question</code>,{" "}
          <code>option_a..d</code>, <code>correct_answer</code>,{" "}
          <code>explanation</code>, <code>language</code>, <code>source</code>
        </p>
        {exams.length > 0 && (
          <details className="supported-codes-hint">
            <summary>
              Supported <code>exam_code</code> values ({exams.length} exams
              across {groupExamsByCategory(exams).length} categories)
            </summary>
            <div className="supported-codes-grid">
              {groupExamsByCategory(exams).map((group) => (
                <div key={group.category}>
                  <strong>{group.category}</strong>
                  <span>
                    {group.exams
                      .map((item) => `${item.code} (${item.name})`)
                      .join(" \xB7 ")}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
        {uploadPreview && (
          <div className="upload-results">
            <div>
              <b>{uploadPreview.total}</b>
              <span>Total</span>
            </div>
            <div>
              <b>{uploadPreview.successful}</b>
              <span>Valid</span>
            </div>
            <div>
              <b>{uploadPreview.failed}</b>
              <span>Failed</span>
            </div>
            <div>
              <b>{uploadPreview.duplicate}</b>
              <span>Duplicates</span>
            </div>
            <button
              className="primary-btn"
              disabled={!meetsMinimumUpload || busy}
              onClick={onConfirmUpload}
            >
              {meetsMinimumUpload
                ? `Upload & publish ${confirmRows.length} questions to Mock Tests`
                : `Minimum ${minRequired} valid questions required (${confirmRows.length}/${minRequired})`}
            </button>
            {!meetsMinimumUpload && (
              <div className="min-upload-warning" role="alert">
                At least <strong>{minRequired} valid questions</strong> are
                required to upload to the Question Bank and publish to Student
                Mock Tests (currently {confirmRows.length} valid — add{" "}
                {minRequired - confirmRows.length} more).
              </div>
            )}
            {uploadPreview.errors.length > 0 && (
              <>
                <a
                  className="outline-btn admin-action"
                  href={`/api/admin/questions/import/${uploadPreview.batchId}/errors.csv`}
                >
                  Download row error report
                </a>
                <details>
                  <summary>Row errors</summary>
                  {uploadPreview.errors.map((x) => (
                    <p key={x.rowNumber}>
                      Row {x.rowNumber}: {x.errors.join("; ")}
                    </p>
                  ))}
                </details>
              </>
            )}
          </div>
        )}
      </section>

      <div className="question-bank-layout">
        <section className="panel admin-panel question-editor">
          <div className="admin-panel-heading">
            <div>
              <span className="section-kicker">CONTENT AUTHORING</span>
              <h2>
                <FileQuestion size={18} />{" "}
                {editId ? "Edit question" : "Add a question"}
              </h2>
            </div>
          </div>
          {exam && stage && (
            <div
              className={`stage-readiness-bar ${stagePublishedCount >= 20 ? "ready" : ""}`}
              role="status"
            >
              <strong>
                {exam.name} · {stage.name}
              </strong>
              <span>
                {stagePublishedCount >= 20
                  ? `${stagePublishedCount} published questions \xB7 Active in Student Mock Tests & Daily Challenge`
                  : `${stagePublishedCount} / 20 published questions \xB7 Add ${20 - stagePublishedCount} more to unlock Student Mock Tests`}
              </span>
            </div>
          )}
          {exam && exam.status !== "published" && (
            <div className="admin-notice" role="status">
              <strong>{exam.name}</strong> is currently in{" "}
              <strong>{exam.status}</strong> status. Uploading or publishing{" "}
              <strong>20+ questions</strong> will automatically activate it in
              Student Mock Tests, Practice, and Daily Challenge.
            </div>
          )}
          <div className="question-config">
            <label>
              Exam
              <CustomSelect
                value={examIndex}
                onChange={(e) => {
                  onSetExamIndex(Number(e.target.value));
                  onSetStageIndex(0);
                  onSetForm((v) => ({
                    ...v,
                    sectionId: "",
                    passageGroupId: "",
                  }));
                }}
              >
                <ExamOptGroups
                  exams={exams}
                  getKey={(e) => e.id}
                  getValue={(_e, i) => i}
                  getLabel={(e) => e.name}
                />
              </CustomSelect>
            </label>
            <label>
              Stage
              <CustomSelect
                value={stageIndex}
                onChange={(e) => {
                  onSetStageIndex(Number(e.target.value));
                  onSetForm((v) => ({
                    ...v,
                    sectionId: "",
                    passageGroupId: "",
                  }));
                }}
              >
                {exam?.stages.map((s, i) => (
                  <option value={i} key={s.id ?? i}>
                    {s.name}
                  </option>
                ))}
              </CustomSelect>
            </label>
            <label>
              Section
              <CustomSelect
                value={form.sectionId}
                onChange={(e) => {
                  onSetForm({
                    ...form,
                    sectionId: e.target.value,
                    topicName: "",
                    subtopicName: "",
                    passageGroupId: "",
                  });
                  setIsCustomTopic(false);
                  setIsCustomSubtopic(false);
                }}
              >
                <option value="">Choose section</option>
                {stage?.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </CustomSelect>
            </label>

            {!selectedSection ? (
              <label>
                Topic
                <CustomSelect
                  value=""
                  disabled
                  style={{
                    background: "var(--bg-muted, #f8fafc)",
                    cursor: "not-allowed",
                    opacity: 0.8,
                  }}
                  title="Choose a section first to view topics"
                >
                  <option value="">← Choose a section first</option>
                </CustomSelect>
              </label>
            ) : !isCustomTopic ? (
              <label>
                Topic
                <CustomSelect
                  value={
                    syllabusTopics.some((t) => t.name === form.topicName)
                      ? form.topicName
                      : form.topicName
                        ? "__custom__"
                        : ""
                  }
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setIsCustomTopic(true);
                    } else {
                      onSetForm({
                        ...form,
                        topicName: e.target.value,
                        subtopicName: "",
                      });
                      setIsCustomSubtopic(false);
                    }
                  }}
                >
                  <option value="">
                    {syllabusTopics.length > 0
                      ? `Choose syllabus topic (${syllabusTopics.length} available)`
                      : "Choose topic"}
                  </option>
                  {syllabusTopics.length > 0
                    ? syllabusTopics.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name}{" "}
                          {t.subtopics && t.subtopics.length
                            ? `(${t.subtopics.length} subtopics)`
                            : ""}
                        </option>
                      ))
                    : BANKING_SYLLABUS.map((subj) => (
                        <optgroup key={subj.id} label={subj.shortName}>
                          {subj.topics.map((t) => (
                            <option key={t.name} value={t.name}>
                              {t.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                  <option value="__custom__">+ Custom topic...</option>
                </CustomSelect>
              </label>
            ) : (
              <div>
                <Field
                  label="Topic (Custom)"
                  value={form.topicName}
                  placeholder="Enter custom topic"
                  onChange={(v) => onSetForm({ ...form, topicName: v })}
                />
                <button
                  type="button"
                  className="text-link"
                  style={{ fontSize: "12px", marginTop: "4px" }}
                  onClick={() => setIsCustomTopic(false)}
                >
                  ← Choose from syllabus
                </button>
              </div>
            )}

            {availableSubtopics.length > 0 && !isCustomSubtopic ? (
              <label>
                Subtopic (optional)
                <CustomSelect
                  value={
                    availableSubtopics.includes(form.subtopicName)
                      ? form.subtopicName
                      : form.subtopicName
                        ? "__custom__"
                        : ""
                  }
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setIsCustomSubtopic(true);
                    } else {
                      onSetForm({ ...form, subtopicName: e.target.value });
                    }
                  }}
                >
                  <option value="">General / All ({form.topicName})</option>
                  {availableSubtopics.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                  <option value="__custom__">+ Custom subtopic...</option>
                </CustomSelect>
              </label>
            ) : form.topicName ? (
              <div>
                <Field
                  label={
                    availableSubtopics.length > 0
                      ? "Subtopic (Custom)"
                      : "Subtopic (optional)"
                  }
                  value={form.subtopicName || ""}
                  placeholder="e.g. Table DI"
                  onChange={(v) => onSetForm({ ...form, subtopicName: v })}
                />
                {availableSubtopics.length > 0 && (
                  <button
                    type="button"
                    className="text-link"
                    style={{ fontSize: "12px", marginTop: "4px" }}
                    onClick={() => setIsCustomSubtopic(false)}
                  >
                    ← Choose from subtopics
                  </button>
                )}
              </div>
            ) : null}
            <label>
              Difficulty
              <CustomSelect
                value={form.difficulty}
                onChange={(e) =>
                  onSetForm({ ...form, difficulty: e.target.value })
                }
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </CustomSelect>
            </label>
            <label>
              Question type
              <CustomSelect
                value={form.questionType}
                onChange={(e) => {
                  const questionType = e.target.value;
                  onSetForm({
                    ...form,
                    questionType,
                    options:
                      questionType === "descriptive"
                        ? []
                        : form.options.length
                          ? form.options
                          : ["", "", "", ""],
                    correctAnswer:
                      questionType === "descriptive"
                        ? ""
                        : form.correctAnswer || "A",
                  });
                }}
              >
                <option value="mcq">Multiple choice</option>
                <option value="passage">Passage group</option>
                <option value="image">Image based</option>
                <option value="numeric">Numeric multiple choice</option>
                <option value="descriptive">Descriptive response</option>
              </CustomSelect>
            </label>
            <label>
              Language
              <CustomSelect
                value={form.language}
                onChange={(e) =>
                  onSetForm({ ...form, language: e.target.value })
                }
              >
                <option>English</option>
                <option>Hindi</option>
              </CustomSelect>
            </label>
            <Field
              label="Source year (optional)"
              type="number"
              value={form.sourceYear}
              onChange={(v) => onSetForm({ ...form, sourceYear: v })}
            />
            <Field
              label="Source (optional)"
              value={form.source}
              onChange={(v) => onSetForm({ ...form, source: v })}
            />
          </div>

          {form.questionType === "passage" && (
            <div className="passage-group-editor">
              <label className="form-field">
                Passage group
                <CustomSelect
                  value={form.passageGroupId}
                  onChange={(e) =>
                    onSetForm((v) => ({
                      ...v,
                      passageGroupId: e.target.value,
                    }))
                  }
                >
                  <option value="">Choose a passage group</option>
                  {passageGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.title} · {group.language}
                    </option>
                  ))}
                </CustomSelect>
              </label>
              {passageGroups.find(
                (group) => group.id === form.passageGroupId,
              ) && (
                <article className="passage-excerpt">
                  <strong>
                    {
                      passageGroups.find(
                        (group) => group.id === form.passageGroupId,
                      ).title
                    }
                  </strong>
                  <p>
                    {
                      passageGroups.find(
                        (group) => group.id === form.passageGroupId,
                      ).passage_text
                    }
                  </p>
                  {passageGroups.find(
                    (group) => group.id === form.passageGroupId,
                  ).image_url && (
                    <img
                      src={
                        passageGroups.find(
                          (group) => group.id === form.passageGroupId,
                        ).image_url
                      }
                      alt="Passage illustration"
                    />
                  )}
                </article>
              )}
              <button
                type="button"
                className="outline-btn admin-action"
                onClick={() => onSetShowNewPassage((value) => !value)}
              >
                {showNewPassage ? "Cancel new passage" : "Create passage group"}
              </button>
              {showNewPassage && (
                <div className="passage-create-form">
                  <Field
                    label="Passage title"
                    value={newPassage.title}
                    onChange={(v) =>
                      onSetNewPassage((old) => ({ ...old, title: v }))
                    }
                  />
                  <Field
                    label="Language"
                    value={newPassage.language}
                    onChange={(v) =>
                      onSetNewPassage((old) => ({ ...old, language: v }))
                    }
                  />
                  <Field
                    label="Passage image URL (optional, HTTPS)"
                    value={newPassage.imageUrl}
                    placeholder="https://..."
                    onChange={(v) =>
                      onSetNewPassage((old) => ({ ...old, imageUrl: v }))
                    }
                  />
                  <label className="form-field">
                    Shared passage text
                    <textarea
                      rows={6}
                      value={newPassage.text}
                      onChange={(e) =>
                        onSetNewPassage((old) => ({
                          ...old,
                          text: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={busy}
                    onClick={onCreatePassageGroup}
                  >
                    Save passage group
                  </button>
                </div>
              )}
            </div>
          )}

          {form.questionType === "image" && (
            <Field
              label="Image URL (HTTPS)"
              value={form.imageUrl}
              placeholder="https://..."
              onChange={(v) => onSetForm({ ...form, imageUrl: v })}
            />
          )}

          <label className="form-field">
            Question text
            <textarea
              rows={4}
              value={form.questionText}
              onChange={(e) =>
                onSetForm({ ...form, questionText: e.target.value })
              }
              placeholder="Enter the question text."
            />
          </label>

          {form.questionType !== "descriptive" && (
            <div className="option-editor">
              <div className="form-label">
                Options — select the letter for the correct answer
              </div>
              {form.options.map((option, i) => {
                const key = String.fromCharCode(65 + i);
                return (
                  <div
                    className={`option-input ${form.correctAnswer === key ? "correct-option" : ""}`}
                    key={key}
                  >
                    <button
                      type="button"
                      onClick={() => onSetForm({ ...form, correctAnswer: key })}
                    >
                      {key}
                    </button>
                    <input
                      value={option}
                      onChange={(e) =>
                        onSetForm({
                          ...form,
                          options: form.options.map((v, index) =>
                            index === i ? e.target.value : v,
                          ),
                        })
                      }
                      placeholder={`Option ${key}`}
                    />
                    {form.correctAnswer === key && <Check size={15} />}
                  </div>
                );
              })}
            </div>
          )}

          <label className="form-field">
            {form.questionType === "descriptive"
              ? "Grading rubric / evaluation guidance"
              : "Answer explanation"}
            <textarea
              rows={3}
              value={form.explanation}
              onChange={(e) =>
                onSetForm({ ...form, explanation: e.target.value })
              }
              placeholder="Explain the solution for aspirants."
            />
          </label>

          <div className="config-fields scoring-fields">
            <Field
              label="Marks"
              type="number"
              value={form.marks}
              onChange={(v) => onSetForm({ ...form, marks: v })}
            />
            <Field
              label="Negative marks"
              type="number"
              value={form.negativeMarks}
              onChange={(v) => onSetForm({ ...form, negativeMarks: v })}
            />
          </div>

          <div className="question-preview-control">
            <button
              className="outline-btn admin-action"
              onClick={() => onSetPreview((v) => !v)}
            >
              Preview question
            </button>
            {preview && (
              <div className="question-preview">
                <span>
                  {exam?.name} · {stage?.name} · {form.topicName || "Topic"} ·{" "}
                  {form.difficulty}
                </span>
                {form.questionType === "passage" &&
                  passageGroups.find(
                    (group) => group.id === form.passageGroupId,
                  ) && (
                    <div className="preview-passage">
                      <strong>
                        {
                          passageGroups.find(
                            (group) => group.id === form.passageGroupId,
                          ).title
                        }
                      </strong>
                      <p>
                        {
                          passageGroups.find(
                            (group) => group.id === form.passageGroupId,
                          ).passage_text
                        }
                      </p>
                    </div>
                  )}
                <p>
                  {form.questionText || "Question preview will appear here."}
                </p>
                {form.imageUrl && (
                  <img
                    src={form.imageUrl}
                    alt="Question illustration preview"
                  />
                )}
                {form.questionType === "descriptive" ? (
                  <div>
                    Descriptive written response · evaluated using the rubric
                  </div>
                ) : (
                  <>
                    {form.options.map((o, i) => (
                      <div key={i}>
                        {String.fromCharCode(65 + i)}. {o || "Option text"}
                      </div>
                    ))}
                    <strong>Answer: {form.correctAnswer}</strong>
                  </>
                )}
                <p>{form.explanation}</p>
              </div>
            )}
          </div>

          <div className="admin-footer question-submit">
            <span>
              Questions are stored on the server; drafts are excluded from
              student tests.
            </span>
            <div>
              <button
                className="outline-btn admin-action"
                disabled={busy}
                onClick={() => onSaveQuestion("draft")}
              >
                Save draft
              </button>
              <button
                className="primary-btn"
                disabled={busy}
                onClick={() => onSaveQuestion("published")}
              >
                <Check size={15} /> Publish question
              </button>
            </div>
          </div>
        </section>

        <section className="panel admin-panel saved-questions">
          <div className="admin-panel-heading">
            <div>
              <span className="section-kicker">QUESTION BANK</span>
              <h2>
                Saved questions{" "}
                <span className="question-count">{questions.length}</span>
              </h2>
            </div>
            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {distinctTopics.length > 0 && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>Topic:</span>
                  <CustomSelect
                    value={topicFilter}
                    onChange={(e) => setTopicFilter(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      fontSize: "13px",
                      background: "var(--input-bg, #fff)",
                    }}
                  >
                    <option value="">
                      All topics ({distinctTopics.length})
                    </option>
                    {distinctTopics.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </CustomSelect>
                </label>
              )}
              <label className="question-search">
                <Search size={15} />
                <input
                  value={filter}
                  onChange={(e) => onSetFilter(e.target.value)}
                  placeholder="Search questions"
                />
              </label>
            </div>
          </div>

          {selectedQuestionIds.length > 0 && (
            <div className="bulk-question-actions">
              <strong>{selectedQuestionIds.length} selected</strong>
              <button
                className="outline-btn admin-action"
                disabled={busy}
                onClick={() => void onBulkQuestionStatus("draft")}
              >
                Return to drafts
              </button>
              <button
                className="primary-btn"
                disabled={busy}
                onClick={() => void onBulkQuestionStatus("published")}
              >
                Publish selected
              </button>
              <button
                className="outline-btn admin-action"
                disabled={busy}
                onClick={() => void onBulkQuestionStatus("archived")}
              >
                Archive selected
              </button>
              <button
                className="text-link"
                onClick={() => onSetSelectedQuestionIds([])}
              >
                Clear selection
              </button>
            </div>
          )}

          {filteredQuestions.length ? (
            <div className="saved-question-list">
              {filteredQuestions.map((q) => (
                <article className="saved-question" key={q.id}>
                  <div className="saved-question-meta">
                    <label className="question-select">
                      <input
                        type="checkbox"
                        checked={selectedQuestionIds.includes(q.id)}
                        onChange={(e) =>
                          onSetSelectedQuestionIds((old) =>
                            e.target.checked
                              ? [...old, q.id]
                              : old.filter((id) => id !== q.id),
                          )
                        }
                      />
                      <span>Select</span>
                    </label>
                    <span>{q.exam_name}</span>
                    <span>
                      {q.stage_name} · {q.section_name}
                    </span>
                    <span>{q.topic_name}</span>
                    {q.subtopic_name && (
                      <span
                        style={{
                          padding: "2px 7px",
                          fontSize: "11px",
                          fontWeight: 600,
                          borderRadius: "4px",
                          backgroundColor: "var(--lavender-100, #ede9fe)",
                          color: "var(--lavender-900, #5b21b6)",
                        }}
                      >
                        {q.subtopic_name}
                      </span>
                    )}
                    {q.passage_title && <span>{q.passage_title}</span>}
                    <b className={q.status === "published" ? "published" : ""}>
                      {q.status}
                    </b>
                  </div>
                  <p>{q.question_text}</p>
                  {q.image_url && (
                    <img
                      className="saved-question-image"
                      src={q.image_url}
                      alt="Question illustration"
                      loading="lazy"
                    />
                  )}
                  <div className="saved-question-bottom">
                    <span>
                      {q.difficulty} · {q.marks} marks · −{q.negative_marks} ·{" "}
                      {q.language}
                    </span>
                    <div>
                      <button
                        className="icon-btn"
                        aria-label="Edit question"
                        onClick={() => onEditQuestion(q)}
                      >
                        <Save size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Duplicate question"
                        onClick={() => onDuplicateQuestion(q)}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Archive question"
                        onClick={() => onRemoveQuestion(q.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-questions">
              <div>
                <FileQuestion size={22} />
              </div>
              <strong>No questions yet</strong>
              <span>Enter a question or validate a CSV/XLSX import.</span>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
export { QuestionBankView };