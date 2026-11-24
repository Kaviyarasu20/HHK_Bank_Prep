// ============================================================================
// ADMIN OVERVIEW & MODULE ROUTER COMPONENT
// ============================================================================
// Orchestrates all administrative sub-panels and state hydration:
// - "Admin dashboard": System overview metrics, question counts, mock test KPIs
// - "Role management": User account governance, promotions, demotions, suspensions
// - "Mock tests": Rule-based and manual mock test authoring, scheduling, blueprints
// - "Reports": Aspirant test attempts, score analytics, descriptive question evaluations
// - "Activity Logs": Security and audit trail of administrative modifications
// ============================================================================

import { useEffect, useState } from "react";
import { AdminDashboardOverview } from "./components/admin/AdminDashboardOverview";
import { StudentManagementView } from "./components/admin/StudentManagementView";
import { RoleManagementView } from "./components/admin/RoleManagementView";
import { MockTestBuilderView } from "./components/admin/MockTestBuilderView";
import { TopicwiseTestView } from "./components/admin/TopicwiseTestView";
import { CurrentAffairsView } from "./components/admin/CurrentAffairsView";
import { AttemptReportsView } from "./components/admin/AttemptReportsView";
import { AuditLogsView } from "./components/admin/AuditLogsView";
import { AdminPaymentsView } from "./components/admin/AdminPaymentsView";

/**
 * Universal JSON API client with credentials and standardized error extraction
 */
const api = async (path, init) => {
  const r = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers ?? {} }
  });
  const d = r.status === 204 ? null : await r.json();
  if (!r.ok) throw new Error(d?.error ?? "Request failed.");
  return d;
};

/**
 * Helper to convert ISO dates to HTML datetime-local format
 */
function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Helper to convert HTML datetime string to ISO or null
 */
function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Build default difficulty distribution rules (30% Easy, 50% Medium, 20% Hard)
 */
function buildDefaultRules(selectedStage) {
  return (selectedStage?.sections ?? []).map((sec) => ({
    sectionId: sec.id,
    topicDistribution: [],
    easyPercent: 30,
    mediumPercent: 50,
    hardPercent: 20
  }));
}

/**
 * AdminOverview - Section Router & Controller
 */
function AdminOverview({
  section,
  onNavigate,
  onToast,
  onAlert,
  onConfirmModal
}) {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [students, setStudents] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSummary, setUserSummary] = useState(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tests, setTests] = useState([]);
  const [exams, setExams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [affairs, setAffairs] = useState([]);
  const [reports, setReports] = useState([]);
  const [descriptiveResponses, setDescriptiveResponses] = useState([]);
  const [gradingDrafts, setGradingDrafts] = useState({});
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setRawError] = useState("");
  const setError = (msg) => {
    setRawError(msg || "");
    if (msg) {
      onToast(msg, "error");
    }
  };
  const [busy, setBusy] = useState(false);
  const [builder, setBuilder] = useState(false);
  const [editingTestId, setEditingTestId] = useState("");
  const [examId, setExamId] = useState("");
  const [stageId, setStageId] = useState("");
  const [setNumber, setSetNumber] = useState(1);
  const [setLabel, setSetLabel] = useState("Set 1");
  const [supportedTopics, setSupportedTopics] = useState({ quant: [], reasoning: [] });
  const [testName, setTestName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60);
  const [reviewPolicy, setReviewPolicy] = useState("after_submit");
  const [selectionMode, setSelectionMode] = useState("rule_based");
  const [selectionRules, setSelectionRules] = useState([]);
  const [availabilityStart, setAvailabilityStart] = useState("");
  const [availabilityEnd, setAvailabilityEnd] = useState("");
  const [selected, setSelected] = useState([]);
  const [article, setArticle] = useState({
    id: "",
    categoryId: "",
    title: "",
    body: "",
    status: "draft"
  });
  const [quiz, setQuiz] = useState({
    questionText: "",
    options: ["", "", "", ""],
    correctAnswer: "A",
    explanation: ""
  });
  useEffect(() => {
    setBusy(true);
    setError("");
    let task;
    if (section === "Admin dashboard") {
      task = api("/admin/overview").then((d) => {
        setStats(d.stats);
        setActivity(d.activity);
      });
    } else if (section === "Role management") {
      task = api(`/admin/users?search=${encodeURIComponent(search)}&role=${roleFilter}&status=${statusFilter}`).then((d) => {
        setUsers(d.users ?? []);
        setUserSummary(d.summary ?? null);
        setCurrentUserId(d.currentUserId ?? "");
      });
    } else if (section === "Students") {
      task = api(`/admin/students?search=${encodeURIComponent(search)}`).then(
        (d) => setStudents(d.students)
      );
    } else if (
      section === "Mock tests" ||
      section === "Create Exam Wise Test" ||
      section === "Manage Exam Wise Tests" ||
      section === "Create Topicwise Test" ||
      section === "Manage Topicwise Tests"
    ) {
      if (section === "Create Exam Wise Test") {
        setBuilder(true);
      } else if (section === "Manage Exam Wise Tests" || section === "Mock tests") {
        setBuilder(false);
      }
      task = Promise.all([
        api("/admin/tests"),
        api("/exams"),
        api("/admin/questions?status=published"),
        api("/admin/questions/generate/topics").catch(() => ({ supportedTopics: { quant: [], reasoning: [] } }))
      ]).then(([t, e, q, sup]) => {
        setTests(t.tests);
        setExams(e.exams);
        setQuestions(q.questions);
        setSupportedTopics(sup.supportedTopics ?? { quant: [], reasoning: [] });
      });
    } else if (section === "Current affairs") {
      task = Promise.resolve();
    } else if (section === "Reports") {
      task = Promise.all([
        api("/admin/reports/attempts"),
        api("/admin/descriptive-responses")
      ]).then(([d, g]) => {
        setReports(d.attempts);
        setDescriptiveResponses(g.responses);
        setGradingDrafts(
          Object.fromEntries(
            g.responses.map((r) => [
              `${r.practice_session_id ?? r.attempt_id}:${r.question_id}`,
              { score: "", comment: "" }
            ])
          )
        );
      });
    } else if (section === "Settings" || section === "Activity Logs") {
      task = api("/admin/audit-logs").then((d) => setLogs(d.logs));
    } else {
      task = Promise.resolve();
    }
    task.catch((e) => setError(e.message)).finally(() => setBusy(false));
  }, [section, search, roleFilter, statusFilter]);

  const updateRole = async (id, newRole) => {
    setBusy(true);
    setError("");
    try {
      const res = await api(`/admin/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole })
      });
      onToast(res.message || `Role updated to ${newRole}.`);
      const d = await api(`/admin/users?search=${encodeURIComponent(search)}&role=${roleFilter}&status=${statusFilter}`);
      setUsers(d.users ?? []);
      setUserSummary(d.summary ?? null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const updateUserStatus = async (id, newStatus) => {
    setBusy(true);
    setError("");
    try {
      const res = await api(`/admin/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: newStatus })
      });
      onToast(res.message || `Account status updated.`);
      const d = await api(`/admin/users?search=${encodeURIComponent(search)}&role=${roleFilter}&status=${statusFilter}`);
      setUsers(d.users ?? []);
      setUserSummary(d.summary ?? null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const updateStudent = async (id, input) => {
    try {
      await api(`/admin/students/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input)
      });
      const d = await api(`/admin/students?search=${encodeURIComponent(search)}`);
      setStudents(d.students);
      onToast("Student account updated.");
    } catch (e) {
      setError(e.message);
    }
  };
  function resetTestBuilder() {
    setEditingTestId("");
    setExamId("");
    setStageId("");
    setSetNumber(1);
    setSetLabel("Set 1");
    setTestName("");
    setDescription("");
    setDuration(60);
    setReviewPolicy("after_submit");
    setSelectionMode("rule_based");
    setSelectionRules([]);
    setAvailabilityStart("");
    setAvailabilityEnd("");
    setSelected([]);
    setBuilder(false);
  }
  function applyExamAndStage(nextExamId, preferredStageId) {
    const nextExam = exams.find((item) => item.id === nextExamId);
    const nextStage = preferredStageId ? (nextExam?.stages ?? []).find((s) => s.id === preferredStageId) : (nextExam?.stages ?? [])[0];
    setExamId(nextExam?.id ?? "");
    setStageId(nextStage?.id ?? "");
    setSelectionRules(buildDefaultRules(nextStage));
    setSelected([]);
    setDuration(
      nextStage?.duration_seconds ? Math.round(nextStage.duration_seconds / 60) : 60
    );
    if (!editingTestId && (nextExamId !== examId || (nextStage?.id ?? "") !== stageId)) {
      setTestName("");
      if (nextExam?.id && nextStage?.id) {
        void autoIncrementExamSet(nextExam.id, nextStage.id);
      }
    }
  }
  async function autoIncrementExamSet(targetExamId, targetStageId) {
    if (!targetExamId || !targetStageId) return;
    try {
      const info = await api(
        `/admin/mock-tests/next-set?testType=EXAM_WISE&examId=${encodeURIComponent(targetExamId)}&stageId=${encodeURIComponent(targetStageId)}`
      );
      setSetNumber(info.nextSetNumber);
      setSetLabel(info.suggestedSetLabel);
      if (!editingTestId) {
        setTestName(info.suggestedName);
      }
    } catch {
      // ignore fallback
    }
  }
  async function refreshTests() {
    const res = await api("/admin/tests");
    setTests(res.tests);
  }
  async function duplicateSet(id) {
    setBusy(true);
    setError("");
    try {
      const res = await api(`/admin/mock-tests/${id}/duplicate`, { method: "POST" });
      await refreshTests();
      onToast(`Created new draft set: ${res.test?.name || res.test?.set_label}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function editTest(t) {
    setEditingTestId(t.id);
    setExamId(t.exam_id);
    setStageId(t.stage_id);
    setSetNumber(Number(t.set_number || 1));
    setSetLabel(t.set_label || `Set ${t.set_number || 1}`);
    setTestName(t.name);
    setDescription(t.description ?? "");
    setDuration(Math.round(t.duration_seconds / 60));
    setReviewPolicy(t.review_policy);
    setSelectionMode(
      t.selection_mode === "rule_based" && t.selection_rules?.length ? "rule_based" : "manual"
    );
    setSelectionRules(t.selection_rules ?? []);
    setAvailabilityStart(toLocalDateTimeInput(t.availability_start));
    setAvailabilityEnd(toLocalDateTimeInput(t.availability_end));
    setSelected(t.question_ids ?? []);
    setBuilder(true);
    setError("");
  }
  async function createTest() {
    if (!examId || !stageId || !testName.trim()) {
      setError(
        "Choose an exam, stage, and test name before saving."
      );
      return;
    }
    if (availabilityStart && availabilityEnd && new Date(availabilityEnd) <= new Date(availabilityStart)) {
      setError("Available until must be later than Available from.");
      return;
    }
    setBusy(true);
    try {
      const input = {
        examId,
        stageId,
        setNumber: Number(setNumber) || 1,
        setLabel: (setLabel || `Set ${setNumber || 1}`).trim(),
        name: testName.trim(),
        description,
        durationSeconds: duration * 60,
        reviewPolicy,
        selectionMode,
        questionIds: selectionMode === "manual" ? selected : [],
        selectionRules: selectionMode === "rule_based" ? selectionRules : [],
        availabilityStart: toIsoOrNull(availabilityStart),
        availabilityEnd: toIsoOrNull(availabilityEnd),
        status: "draft"
      };
      await api(editingTestId ? `/admin/tests/${editingTestId}` : "/admin/tests", {
        method: editingTestId ? "PUT" : "POST",
        body: JSON.stringify(input)
      });
      setTests((await api("/admin/tests")).tests);
      resetTestBuilder();
      onToast(
        editingTestId ? "Draft mock test updated." : "Mock test saved as a draft."
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(id, status) {
    try {
      await api(`/admin/mock-tests/${id}/publish`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await refreshTests();
      onToast(`Mock test ${status}.`);
    } catch (e) {
      setError(e.message);
    }
  }
  async function saveArticle() {
    try {
      const body = {
        categoryId: article.categoryId,
        title: article.title,
        body: article.body,
        status: article.status
      };
      const path = article.id ? `/admin/current-affairs/${article.id}` : "/admin/current-affairs";
      await api(path, {
        method: article.id ? "PUT" : "POST",
        body: JSON.stringify(body)
      });
      setAffairs((await api("/admin/current-affairs")).items);
      setArticle((a) => ({ ...a, id: "", title: "", body: "", status: "draft" }));
      onToast("Current affairs content saved.");
    } catch (e) {
      setError(e.message);
    }
  }
  async function addAffairQuestion(id) {
    try {
      await api(`/admin/current-affairs/${id}/questions`, {
        method: "POST",
        body: JSON.stringify({
          ...quiz,
          options: quiz.options.map((text, i) => ({
            key: String.fromCharCode(65 + i),
            text
          }))
        })
      });
      setQuiz({
        questionText: "",
        options: ["", "", "", ""],
        correctAnswer: "A",
        explanation: ""
      });
      onToast("Quiz question added.");
    } catch (e) {
      setError(e.message);
    }
  }
  async function gradeResponse(response) {
    const key = `${response.practice_session_id ?? response.attempt_id}:${response.question_id}`;
    const draft = gradingDrafts[key];
    if (draft?.score == null || draft.score === "") {
      setError("Enter a score before saving this evaluation.");
      return;
    }
    setBusy(true);
    try {
      await api(
        response.response_type === "practice" ? `/admin/practice-sessions/${response.practice_session_id}/answers/${response.question_id}/grade` : `/admin/attempts/${response.attempt_id}/answers/${response.question_id}/grade`,
        {
          method: "PUT",
          body: JSON.stringify({
            score: Number(draft.score),
            comment: draft.comment
          })
        }
      );
      const [report, queue] = await Promise.all([
        api("/admin/reports/attempts"),
        api("/admin/descriptive-responses")
      ]);
      setReports(report.attempts);
      setDescriptiveResponses(queue.responses);
      setGradingDrafts(
        Object.fromEntries(
          queue.responses.map((r) => [
            `${r.practice_session_id ?? r.attempt_id}:${r.question_id}`,
            { score: "", comment: "" }
          ])
        )
      );
      onToast("Descriptive response graded and attempt score recalculated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function exportReports() {
    const headers = [
      "Student",
      "Email",
      "Exam",
      "Test",
      "Score",
      "Maximum",
      "Correct",
      "Wrong",
      "Unanswered",
      "Submitted"
    ];
    const rows = reports.map((r) => [
      r.full_name,
      r.email,
      r.exam_name,
      r.test_name,
      r.score,
      r.max_score,
      r.correct_count,
      r.wrong_count,
      r.unanswered_count,
      r.submitted_at
    ]);
    const csv = [headers, ...rows].map(
      (row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")
    ).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "hhk-attempt-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return <div className="admin-workspace">
      <div className="admin-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> ADMIN OVERVIEW
          </div>
          <h1>{section}</h1>
          <p className="subheading">
            Manage content and oversee the HHK preparation platform.
          </p>
        </div>
        <span className="local-badge">ROLE RESTRICTED</span>
      </div>

      {error && <div className="admin-error" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>}

      {busy && <div className="admin-loading">Loading from PostgreSQL…</div>}

      {section === "Admin dashboard" && <AdminDashboardOverview
    stats={stats}
    activity={activity}
    onNavigate={onNavigate}
  />}

      {section === "Role management" && (
        <RoleManagementView
          users={users}
          summary={userSummary}
          currentUserId={currentUserId}
          search={search}
          roleFilter={roleFilter}
          statusFilter={statusFilter}
          busy={busy}
          onSearchChange={setSearch}
          onRoleFilterChange={setRoleFilter}
          onStatusFilterChange={setStatusFilter}
          onUpdateRole={updateRole}
          onUpdateStatus={updateUserStatus}
          onConfirmModal={onConfirmModal}
        />
      )}

      {section === "Students" && <StudentManagementView
    students={students}
    search={search}
    busy={busy}
    onSearchChange={setSearch}
    onUpdateStudent={updateStudent}
  />}

      {(section === "Mock tests" || section === "Create Exam Wise Test" || section === "Manage Exam Wise Tests") && (
        <MockTestBuilderView
          mode={section === "Create Exam Wise Test" ? "create" : "manage"}
          tests={tests}
          exams={exams}
          questions={questions}
          builder={builder}
          editingTestId={editingTestId}
          examId={examId}
          stageId={stageId}
          setNumber={setNumber}
          setLabel={setLabel}
          testName={testName}
          description={description}
          duration={duration}
          reviewPolicy={reviewPolicy}
          selectionMode={selectionMode}
          selectionRules={selectionRules}
          availabilityStart={availabilityStart}
          availabilityEnd={availabilityEnd}
          selected={selected}
          busy={busy}
          onSetBuilder={setBuilder}
          onResetTestBuilder={resetTestBuilder}
          onEditTest={editTest}
          onChangeStatus={changeStatus}
          onDuplicateSet={duplicateSet}
          onAutoIncrementSet={autoIncrementExamSet}
          onCreateTest={createTest}
          onExamChange={(val) => applyExamAndStage(val)}
          onStageChange={(val) => {
            if (!val) {
              setStageId("");
              setSelectionRules([]);
              setSelected([]);
              if (!editingTestId) setTestName("");
              return;
            }
            const owningExam = exams.find(
              (item) => (item.stages ?? []).some((s) => s.id === val)
            );
            if (owningExam) {
              applyExamAndStage(owningExam.id, val);
            }
          }}
          onSetSetNumber={setSetNumber}
          onSetSetLabel={setSetLabel}
          onSetTestName={setTestName}
          onSetDescription={setDescription}
          onSetDuration={setDuration}
          onSetReviewPolicy={setReviewPolicy}
          onSetSelectionMode={(mode) => {
            setSelectionMode(mode);
            if (mode === "rule_based" && !selectionRules.length && stageId) {
              const currentExam = exams.find((item) => item.id === examId);
              const currentStage = (currentExam?.stages ?? []).find(
                (s) => s.id === stageId
              );
              setSelectionRules(buildDefaultRules(currentStage));
            }
          }}
          onSetSelectionRules={setSelectionRules}
          onSetAvailabilityStart={setAvailabilityStart}
          onSetAvailabilityEnd={setAvailabilityEnd}
          onSetSelected={setSelected}
        />
      )}

      {(section === "Create Topicwise Test" || section === "Manage Topicwise Tests") && (
        <TopicwiseTestView
          mode={section === "Create Topicwise Test" ? "create" : "manage"}
          tests={tests}
          supportedTopics={supportedTopics}
          busy={busy}
          onRefreshTests={refreshTests}
          onPublishToggle={changeStatus}
          onDuplicateSet={duplicateSet}
          onToast={onToast}
          onError={setError}
          api={api}
        />
      )}

      {section === "Current affairs" && (
        <CurrentAffairsView
          onToast={onToast}
          onConfirmModal={onConfirmModal}
        />
      )}

      {section === "Reports" && <AttemptReportsView
    reports={reports}
    descriptiveResponses={descriptiveResponses}
    gradingDrafts={gradingDrafts}
    busy={busy}
    onExportReports={exportReports}
    onDraftChange={(key, field, val) => setGradingDrafts((old) => ({
      ...old,
      [key]: { ...old[key] ?? { score: "", comment: "" }, [field]: val }
    }))}
    onGradeResponse={gradeResponse}
  />}

      {section === "Payments & Pricing" && <AdminPaymentsView onToast={onToast} />}

      {(section === "Settings" || section === "Activity Logs") && <AuditLogsView logs={logs} />}
    </div>;
}
export {
  AdminOverview as default
};
