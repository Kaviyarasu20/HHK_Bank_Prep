import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Plus, RefreshCw, Sparkles, Users } from "lucide-react";
import { gaMarathonAdminApi } from "../../api/phase9GaMarathon";

export function GAMarathonAdmin() {
  const [meta, setMeta] = useState({ categories: [], exams: [], answerReleasePolicies: [], accessTypes: [] });
  const [tests, setTests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Create form state
  const [title, setTitle] = useState("");
  const [gaCategory, setGaCategory] = useState("daily_ga");
  const [targetExams, setTargetExams] = useState(["IBPS PO", "SBI PO"]);
  const [questionCount, setQuestionCount] = useState(20);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [marksPerQuestion, setMarksPerQuestion] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0.25);
  const [attemptLimit, setAttemptLimit] = useState("");
  const [accessType, setAccessType] = useState("FREE");
  const [pricePaise, setPricePaise] = useState(0);
  const [answerReleasePolicy, setAnswerReleasePolicy] = useState("immediate");

  // Selection filters
  const [filterTopic, setFilterTopic] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterExam, setFilterExam] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [mRes, tRes] = await Promise.all([
        gaMarathonAdminApi.getMetadata(),
        gaMarathonAdminApi.listTests(),
      ]);
      setMeta({
        categories: mRes.categories || [],
        exams: mRes.exams || [],
        answerReleasePolicies: mRes.answerReleasePolicies || [],
        accessTypes: mRes.accessTypes || [],
      });
      setTests(tRes.tests || []);
    } catch (err) {
      setError(err?.message || "Failed to load GA Marathon admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadDetail = async (testId) => {
    setBusy(true);
    setError("");
    try {
      const [dRes, aRes] = await Promise.all([
        gaMarathonAdminApi.getTestDetail(testId),
        gaMarathonAdminApi.getAttempts(testId),
      ]);
      setSelected(dRes.test);
      setAttempts(aRes.attempts || []);
    } catch (err) {
      setError(err?.message || "Failed to load test details.");
    } finally {
      setBusy(false);
    }
  };

  const toggleExam = (code) => {
    setTargetExams((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code],
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await gaMarathonAdminApi.createTest({
        title,
        gaCategory,
        targetExams,
        questionCount: Number(questionCount),
        durationMinutes: Number(durationMinutes),
        marksPerQuestion: Number(marksPerQuestion),
        negativeMarks: Number(negativeMarks),
        attemptLimit: attemptLimit === "" ? null : Number(attemptLimit),
        accessType,
        pricePaise: Number(pricePaise) || 0,
        answerReleasePolicy,
        isOfficialPattern: false,
      });
      setMessage("Draft GA Marathon test created. Select approved questions before publishing.");
      setTitle("");
      await loadAll();
      setSelected(res.test);
      setAttempts([]);
    } catch (err) {
      setError(err?.message || "Failed to create GA Marathon test.");
    } finally {
      setBusy(false);
    }
  };

  const handleSelectQuestions = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await gaMarathonAdminApi.selectQuestions(selected.id, {
        filters: {
          topic: filterTopic || undefined,
          difficulty: filterDifficulty || undefined,
          examCode: filterExam || undefined,
        },
      });
      setSelected(res.test);
      setMessage(`Assigned ${res.selectedCount} approved question(s) from the canonical question bank.`);
      await loadAll();
    } catch (err) {
      setError(err?.message || "Question selection failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (targetStatus) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await gaMarathonAdminApi.setStatus(selected.id, targetStatus);
      setSelected(res.test);
      setMessage(`GA Marathon test status updated to "${targetStatus}".`);
      await loadAll();
    } catch (err) {
      setError(err?.message || `Unable to set status to ${targetStatus}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0 }}>GA Marathon Test Builder & Control Center</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Create CBT-ready GA Marathon tests using approved Phase 6 MCQs and existing HHK subscription entitlements.
            </p>
          </div>
          <button type="button" className="outline-btn" onClick={loadAll} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}
        {message && <div className="info-banner" style={{ marginTop: 12 }}>{message}</div>}

        <form onSubmit={handleCreate} style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="GA Marathon Test Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ flex: 2, minWidth: 220 }}
            />
            <select value={gaCategory} onChange={(e) => setGaCategory(e.target.value)}>
              {meta.categories.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <select value={accessType} onChange={(e) => setAccessType(e.target.value)}>
              {meta.accessTypes.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            {accessType === "PAID" && (
              <input
                type="number"
                placeholder="Price (paise)"
                value={pricePaise}
                onChange={(e) => setPricePaise(e.target.value)}
                style={{ width: 130 }}
              />
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 12 }}>
              Questions
              <input type="number" min={1} max={200} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} style={{ width: 76, marginLeft: 6 }} />
            </label>
            <label style={{ fontSize: 12 }}>
              Duration (min)
              <input type="number" min={1} max={240} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} style={{ width: 76, marginLeft: 6 }} />
            </label>
            <label style={{ fontSize: 12 }}>
              Marks/Q
              <input type="number" step="0.25" value={marksPerQuestion} onChange={(e) => setMarksPerQuestion(e.target.value)} style={{ width: 76, marginLeft: 6 }} />
            </label>
            <label style={{ fontSize: 12 }}>
              Negative
              <input type="number" step="0.25" value={negativeMarks} onChange={(e) => setNegativeMarks(e.target.value)} style={{ width: 76, marginLeft: 6 }} />
            </label>
            <label style={{ fontSize: 12 }}>
              Attempt Limit
              <input type="number" placeholder="∞" value={attemptLimit} onChange={(e) => setAttemptLimit(e.target.value)} style={{ width: 76, marginLeft: 6 }} />
            </label>
            <select value={answerReleasePolicy} onChange={(e) => setAnswerReleasePolicy(e.target.value)}>
              {meta.answerReleasePolicies.map((p) => (
                <option key={p} value={p}>Answers: {p}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {meta.exams.map((ex) => (
              <button
                key={ex}
                type="button"
                className={targetExams.includes(ex) ? "primary-btn" : "outline-btn"}
                onClick={() => toggleExam(ex)}
                style={{ fontSize: 12, padding: "4px 8px" }}
              >
                {ex}
              </button>
            ))}
          </div>

          <div>
            <button type="submit" className="primary-btn" disabled={busy || title.trim().length < 4}>
              <Plus size={14} /> Create Draft GA Test
            </button>
          </div>
        </form>
      </div>

      {/* Existing GA Tests */}
      <div className="panel" style={{ padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>All GA Marathon Tests ({tests.length})</h3>
        {loading ? (
          <p className="muted">Loading tests...</p>
        ) : tests.length === 0 ? (
          <p className="muted">No GA Marathon tests created yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {tests.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: 10,
                  borderRadius: 8,
                  border: selected?.id === t.id ? "2px solid var(--primary, #2563eb)" : "1px solid var(--border-color, #e5e7eb)",
                }}
              >
                <div>
                  <strong>{t.name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t.ga_category} · Status: {t.status} · Questions: {t.assigned_questions}/{t.target_questions} · Access: {t.access_type} · Attempts: {t.attempts_count || 0} (Avg: {t.avg_score || 0})
                  </div>
                </div>
                <button type="button" className="outline-btn" onClick={() => loadDetail(t.id)}>
                  Manage
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Test Editor & Attempts Monitor */}
      {selected && (
        <div className="panel" style={{ padding: 18, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>{selected.name}</h3>
              <div className="muted" style={{ fontSize: 13 }}>
                Status: <strong>{selected.status}</strong> · Assigned: <strong>{selected.assigned_questions}/{selected.target_questions}</strong> · Access: <strong>{selected.access_type}</strong>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="primary-btn" disabled={busy} onClick={() => handleStatus("published")}>
                <CheckCircle2 size={14} /> Publish
              </button>
              <button type="button" className="outline-btn" disabled={busy} onClick={() => handleStatus("draft")}>
                Unpublish (Draft)
              </button>
              <button type="button" className="outline-btn" disabled={busy} onClick={() => handleStatus("archived")}>
                Archive
              </button>
            </div>
          </div>

          {/* Select Approved Questions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Filter Topic (optional)"
              value={filterTopic}
              onChange={(e) => setFilterTopic(e.target.value)}
            />
            <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
              <option value="">Any Difficulty</option>
              <option value="Easy">Easy</option>
              <option value="Moderate">Moderate</option>
              <option value="Difficult">Difficult</option>
            </select>
            <select value={filterExam} onChange={(e) => setFilterExam(e.target.value)}>
              <option value="">Any Exam</option>
              {meta.exams.map((ex) => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
            <button type="button" className="outline-btn" disabled={busy} onClick={handleSelectQuestions}>
              <Sparkles size={14} /> Select Approved Questions
            </button>
          </div>

          {/* Question Set Preview */}
          <div>
            <h4>Assigned Questions Preview ({selected.questions?.length || 0})</h4>
            {!selected.questions || selected.questions.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No approved questions assigned yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                {selected.questions.map((q) => (
                  <div key={q.question_id} style={{ fontSize: 13, padding: 6, borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>
                    <strong>{q.sort_order}.</strong> {q.question_text}{" "}
                    <span className="muted">({q.topic_name || "GA"} · {q.difficulty})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attempts Monitor */}
          <div>
            <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={15} /> Student Attempts ({attempts.length})
            </h4>
            {attempts.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No student attempts recorded yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {attempts.map((a) => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span>{a.student_name} ({a.student_email}) · {a.status}</span>
                    <strong>Score: {a.score ?? 0}/{a.max_score ?? 0}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
