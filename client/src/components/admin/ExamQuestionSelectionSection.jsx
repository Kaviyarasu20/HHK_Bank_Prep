import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Database,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
} from "lucide-react";
import api from "../../api/client";

/**
 * Exam-Wise Research-Based Question Selection & Topic Distribution Section
 *
 * Automatically loads the selected examination & stage's official pattern,
 * displays applicable subjects and historical-trend topic counts alongside live
 * Question Bank stock, lets admins edit/enable/disable topics, marks, and duration,
 * save custom patterns or restore defaults, and generate complete mock tests with
 * strict per-topic shortage warnings.
 */
export function ExamQuestionSelectionSection({
  exams = [],
  examId = "",
  stageId = "",
  testName = "",
  setLabel = "Set 1",
  reviewPolicy = "after_submit",
  onDurationSync,
  onTestCreated,
}) {
  const [blueprint, setBlueprint] = useState(null);
  const [sections, setSections] = useState([]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [shortageDetails, setShortageDetails] = useState([]);

  const selectedExam = exams.find((e) => e.id === examId) || null;
  const selectedStage = selectedExam?.stages?.find((s) => s.id === stageId) || null;

  function hydrateBlueprint(bp) {
    if (!bp) return;
    setBlueprint(bp);
    setSections(
      (bp.sections || []).map((sec) => ({
        ...sec,
        isEnabled: sec.isEnabled !== false,
        questionCount: Number(sec.questionCount || 0),
        marksPerQuestion: Number(sec.marksPerQuestion ?? 1),
        negativeMarks: Number(sec.negativeMarks ?? 0.25),
        durationMinutes: sec.durationSeconds ? Math.round(Number(sec.durationSeconds) / 60) : "",
        topicDistributions: (sec.topicDistributions || []).map((t) => ({
          ...t,
          enabled: t.enabled !== false,
          defaultQuestions: Number(t.defaultQuestions ?? t.minQuestions ?? 0),
          availableInBank: Number(t.availableInBank ?? 0),
        })),
      }))
    );
    const secMinsSum = (bp.sections || [])
      .filter((s) => s.isEnabled !== false && s.durationSeconds)
      .reduce((sum, s) => sum + Math.round(Number(s.durationSeconds) / 60), 0);
    const allHaveTimers =
      (bp.sections || []).filter((s) => s.isEnabled !== false).length > 0 &&
      (bp.sections || []).filter((s) => s.isEnabled !== false).every((s) => Number(s.durationSeconds) > 0);
    const mins = allHaveTimers && secMinsSum > 0
      ? secMinsSum
      : Math.max(1, Math.round(Number(bp.durationSeconds || 3600) / 60));
    setDurationMinutes(mins);
    onDurationSync?.(String(mins));
    setShortageDetails(bp.shortageWarnings || []);
  }

  async function loadBlueprint() {
    if (!examId || !stageId) {
      setBlueprint(null);
      setSections([]);
      setShortageDetails([]);
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const qs = new URLSearchParams({
        examId,
        stageId,
        examCode: selectedExam?.code || "",
        stageName: selectedStage?.name || "Prelims",
      });
      const res = await api(`/admin/exam-engine/selection-blueprint?${qs.toString()}`);
      hydrateBlueprint(res.blueprint);
    } catch (err) {
      setError(err.message || "Could not load exam question selection blueprint.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBlueprint();
  }, [examId, stageId]);

  const summary = useMemo(() => {
    let totalQuestions = 0;
    let totalMarks = 0;
    let totalBankMatched = 0;
    const liveShortages = [];
    const sumMismatches = [];

    for (const sec of sections) {
      if (!sec.isEnabled) continue;
      const secQ = Number(sec.questionCount || 0);
      totalQuestions += secQ;
      totalMarks += secQ * Number(sec.marksPerQuestion ?? 1);

      let topicSum = 0;
      for (const t of sec.topicDistributions || []) {
        if (!t.enabled) continue;
        const req = Math.max(0, Number(t.defaultQuestions || 0));
        const avail = Number(t.availableInBank || 0);
        topicSum += req;
        totalBankMatched += Math.min(req, avail);
        if (req > avail) {
          liveShortages.push({
            sectionName: sec.sectionName,
            topic: t.topic,
            required: req,
            available: avail,
            shortfall: req - avail,
          });
        }
      }
      if (topicSum !== secQ) {
        sumMismatches.push({
          sectionName: sec.sectionName,
          topicSum,
          sectionCount: secQ,
        });
      }
    }

    return {
      totalQuestions,
      totalMarks: Number(totalMarks.toFixed(2)),
      totalBankMatched,
      liveShortages,
      sumMismatches,
    };
  }, [sections]);

  function updateSection(secIdx, patch) {
    setSections((prev) => {
      const next = prev.map((sec, i) => (i === secIdx ? { ...sec, ...patch } : sec));
      const enabledWithTimers = next.filter((s) => s.isEnabled && Number(s.durationMinutes) > 0);
      const enabledCount = next.filter((s) => s.isEnabled).length;
      if (enabledCount > 0 && enabledWithTimers.length === enabledCount) {
        const sumMins = enabledWithTimers.reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);
        if (sumMins > 0) {
          setDurationMinutes(sumMins);
          onDurationSync?.(String(sumMins));
        }
      }
      return next;
    });
  }

  function updateTopic(secIdx, topicIdx, patch) {
    setSections((prev) =>
      prev.map((sec, i) => {
        if (i !== secIdx) return sec;
        return {
          ...sec,
          topicDistributions: sec.topicDistributions.map((t, j) =>
            j === topicIdx ? { ...t, ...patch } : t
          ),
        };
      })
    );
  }

  function rebalanceSectionTopics(secIdx) {
    setSections((prev) =>
      prev.map((sec, i) => {
        if (i !== secIdx) return sec;
        const target = Math.max(0, Number(sec.questionCount || 0));
        const enabledIndices = sec.topicDistributions
          .map((t, idx) => (t.enabled ? idx : -1))
          .filter((idx) => idx >= 0);
        if (!enabledIndices.length) return sec;

        const currentSum = enabledIndices.reduce(
          (s, idx) => s + Math.max(0, Number(sec.topicDistributions[idx].defaultQuestions || 0)),
          0
        );
        const nextTopics = sec.topicDistributions.map((t) => ({ ...t }));
        if (currentSum === 0) {
          const base = Math.floor(target / enabledIndices.length);
          let rem = target - base * enabledIndices.length;
          for (const idx of enabledIndices) {
            nextTopics[idx].defaultQuestions = base + (rem > 0 ? 1 : 0);
            if (rem > 0) rem -= 1;
          }
        } else {
          let allocated = 0;
          const scaled = enabledIndices.map((idx) => {
            const exact = (Number(nextTopics[idx].defaultQuestions || 0) * target) / currentSum;
            const floored = Math.floor(exact);
            allocated += floored;
            return { idx, floored, frac: exact - floored };
          });
          let rem = target - allocated;
          for (const item of [...scaled].sort((a, b) => b.frac - a.frac)) {
            if (rem > 0) {
              item.floored += 1;
              rem -= 1;
            }
          }
          for (const item of scaled) {
            nextTopics[item.idx].defaultQuestions = item.floored;
          }
        }
        return { ...sec, topicDistributions: nextTopics };
      })
    );
  }

  function buildNormalizedSectionsPayload() {
    return sections.map((sec, idx) => ({
      sectionId: sec.sectionId || null,
      sectionName: sec.sectionName,
      subjectKey: sec.subjectKey,
      questionCount: Number(sec.questionCount || 0),
      marksPerQuestion: Number(sec.marksPerQuestion ?? 1),
      negativeMarks: Number(sec.negativeMarks ?? 0.25),
      durationSeconds:
        sec.durationMinutes !== "" && Number(sec.durationMinutes) > 0
          ? Math.round(Number(sec.durationMinutes) * 60)
          : null,
      sortOrder: idx,
      isEnabled: Boolean(sec.isEnabled),
      difficultyDistribution: sec.difficultyDistribution || { easy: 30, medium: 50, hard: 20 },
      topicDistributions: (sec.topicDistributions || []).map((t) => ({
        topic: t.topic,
        minQuestions: t.enabled ? Number(t.defaultQuestions || 0) : 0,
        maxQuestions: t.enabled ? Math.max(Number(t.defaultQuestions || 0), Number(t.maxQuestions || 0)) : 0,
        defaultQuestions: t.enabled ? Number(t.defaultQuestions || 0) : 0,
        weight: Number(t.weight ?? 10),
        priority: Number(t.priority ?? 2),
        enabled: Boolean(t.enabled),
        isCompositeArithmetic: Boolean(t.isCompositeArithmetic),
        subtopics: t.subtopics,
      })),
    }));
  }

  async function handleSaveCustomPattern() {
    if (!examId || !stageId) return;
    if (summary.sumMismatches.length > 0) {
      setError(
        `Topic counts must match section totals before saving: ${summary.sumMismatches
          .map((m) => `${m.sectionName} (${m.topicSum}/${m.sectionCount})`)
          .join(", ")}.`
      );
      return;
    }
    setBusyAction("save");
    setError("");
    setNotice("");
    try {
      await api("/admin/exam-engine/patterns", {
        method: "POST",
        body: JSON.stringify({
          examId,
          stageId,
          isActive: true,
          durationSeconds: Math.max(60, Math.round(Number(durationMinutes || 60) * 60)),
          negativeMarkingRatio: blueprint?.negativeMarkingRatio ?? 0.25,
          sectionalTimingEnabled: sections.some((s) => Number(s.durationMinutes) > 0),
          optionCount: 5,
          shortagePolicy: "FAIL_STRICT",
          sourceNotes: blueprint?.sourceNotes || "Custom admin exam pattern.",
          sections: buildNormalizedSectionsPayload(),
        }),
      });
      onDurationSync?.(String(durationMinutes));
      setNotice("Custom examination pattern saved and activated for this exam stage.");
      await loadBlueprint();
    } catch (err) {
      setError(err.message || "Failed to save custom examination pattern.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleRestoreDefault() {
    if (!examId || !stageId) return;
    setBusyAction("reset");
    setError("");
    setNotice("");
    try {
      const res = await api("/admin/exam-engine/patterns/reset", {
        method: "POST",
        body: JSON.stringify({ examId, stageId }),
      });
      hydrateBlueprint(res.blueprint);
      const mins = Math.max(1, Math.round(Number(res.blueprint?.durationSeconds || 3600) / 60));
      onDurationSync?.(String(mins));
      setNotice("Restored recommended research-based default examination pattern.");
    } catch (err) {
      setError(err.message || "Failed to restore recommended default pattern.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleGenerateFromBank() {
    if (!examId || !stageId) return;
    if (summary.sumMismatches.length > 0) {
      setError(
        `Fix topic totals first: ${summary.sumMismatches
          .map((m) => `${m.sectionName} has ${m.topicSum}/${m.sectionCount} Qs`)
          .join(", ")}.`
      );
      return;
    }
    setBusyAction("bank");
    setError("");
    setNotice("");
    try {
      const res = await api("/admin/exam-engine/generate-from-bank", {
        method: "POST",
        body: JSON.stringify({
          examId,
          stageId,
          durationSeconds: Math.max(60, Math.round(Number(durationMinutes || 60) * 60)),
          sections: buildNormalizedSectionsPayload(),
          testName: testName || undefined,
          setLabel: setLabel || undefined,
          reviewPolicy,
        }),
      });
      setShortageDetails([]);
      setNotice(
        `Mock test draft "${res.test?.name}" generated from Question Bank (${res.generationReport?.totalGenerated}/${res.generationReport?.totalRequired} questions, 0 duplicates).`
      );
      onTestCreated?.(res.test);
    } catch (err) {
      setError(err.message || "Could not generate mock test from Question Bank.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleGenerateWithEngine() {
    if (!examId || !stageId) return;
    if (summary.sumMismatches.length > 0) {
      setError(
        `Fix topic totals first: ${summary.sumMismatches
          .map((m) => `${m.sectionName} has ${m.topicSum}/${m.sectionCount} Qs`)
          .join(", ")}.`
      );
      return;
    }
    setBusyAction("engine");
    setError("");
    setNotice("");
    try {
      const res = await api("/admin/exam-engine/generate", {
        method: "POST",
        body: JSON.stringify({
          examId,
          stageId,
          examCode: selectedExam?.code || undefined,
          stageName: selectedStage?.name || "Prelims",
          customSections: buildNormalizedSectionsPayload(),
          shortagePolicy: "USE_BANK_FALLBACK",
          varyWithinRanges: false,
          saveAsDraft: true,
          testName: testName || undefined,
          setLabel: setLabel || undefined,
          reviewPolicy,
        }),
      });
      setNotice(
        `Saved draft "${res.test?.name}" (${res.generationReport?.totalGenerated}/${res.generationReport?.totalRequired} validated questions following your exact topic blueprint).`
      );
      onTestCreated?.(res.test);
    } catch (err) {
      setError(err.message || "Auto-generation failed.");
    } finally {
      setBusyAction("");
    }
  }

  if (!examId || !stageId) {
    return (
      <div
        style={{
          border: "1px dashed #cbd5e1",
          borderRadius: 12,
          padding: 16,
          marginBottom: 18,
          background: "#f8fafc",
          color: "#475569",
          fontSize: 13,
        }}
      >
        <strong>Question Selection &amp; Topic-Wise Exam Pattern:</strong> Select an examination and stage above to load its subjects, research-based topic distribution, and Question Bank availability.
      </div>
    );
  }

  return (
    <section
      aria-label="Exam-Wise Question Selection"
      style={{
        border: "1px solid #c7d2fe",
        borderRadius: 12,
        padding: 18,
        marginBottom: 18,
        background: "#ffffff",
      }}
    >
      {/* Header & Pattern Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Sliders size={16} color="#4f46e5" />
            <strong style={{ fontSize: 15 }}>
              Question Selection — {selectedExam?.name} ({selectedStage?.name})
            </strong>
            {blueprint && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: blueprint.isCustomPattern ? "#fef3c7" : "#e0e7ff",
                  color: blueprint.isCustomPattern ? "#92400e" : "#3730a3",
                }}
              >
                {blueprint.isCustomPattern ? "Custom Saved Pattern" : "Recommended Default Pattern"}
              </span>
            )}
          </div>
          {blueprint?.sourceNotes && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
              {blueprint.sourceNotes}
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="outline-btn admin-action"
            disabled={loading || Boolean(busyAction)}
            onClick={handleSaveCustomPattern}
          >
            <Save size={13} /> {busyAction === "save" ? "Saving..." : "Save Custom Pattern"}
          </button>
          <button
            type="button"
            className="outline-btn admin-action"
            disabled={loading || Boolean(busyAction)}
            onClick={handleRestoreDefault}
          >
            <RotateCcw size={13} /> {busyAction === "reset" ? "Restoring..." : "Restore Default"}
          </button>
        </div>
      </div>

      {/* Exam Totals & Duration Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginBottom: 14,
          padding: 12,
          borderRadius: 10,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>TOTAL QUESTIONS</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{summary.totalQuestions}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>MAXIMUM MARKS</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{summary.totalMarks}</div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, color: "#64748b", fontWeight: 600 }}>
            EXAM DURATION (MINS)
            <input
              type="number"
              min="5"
              max="360"
              value={durationMinutes}
              onChange={(e) => {
                const next = Math.max(1, Number(e.target.value || 1));
                setDurationMinutes(next);
                onDurationSync?.(String(next));
              }}
              style={{
                display: "block",
                width: 90,
                marginTop: 2,
                padding: "3px 6px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                fontWeight: 700,
              }}
            />
          </label>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>QUESTION BANK MATCH</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: summary.liveShortages.length === 0 ? "#15803d" : "#b45309",
            }}
          >
            {summary.totalBankMatched}/{summary.totalQuestions} ready
          </div>
        </div>
      </div>

      {/* Live Topic-Level Shortage Warning Banner */}
      {summary.liveShortages.length > 0 && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 6 }}>
            <AlertTriangle size={15} />
            Question Bank Shortage Warning ({summary.liveShortages.length} topic{summary.liveShortages.length > 1 ? "s" : ""})
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 3, fontSize: 12 }}>
            {summary.liveShortages.slice(0, 6).map((w) => (
              <li key={`${w.sectionName}-${w.topic}`}>
                <strong>{w.sectionName} → {w.topic}:</strong> needs {w.required}, only {w.available} published (short by {w.shortfall})
              </li>
            ))}
            {summary.liveShortages.length > 6 && (
              <li>...and {summary.liveShortages.length - 6} more topic(s).</li>
            )}
          </ul>
        </div>
      )}

      {error && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {notice && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={14} /> {notice}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 16, fontSize: 13, color: "#64748b" }}>Loading exam subjects and topic distribution...</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {sections.map((sec, secIdx) => {
            const topicSum = (sec.topicDistributions || [])
              .filter((t) => t.enabled)
              .reduce((sum, t) => sum + Math.max(0, Number(t.defaultQuestions || 0)), 0);
            const sumMatches = !sec.isEnabled || topicSum === Number(sec.questionCount || 0);

            return (
              <div
                key={sec.sectionId || sec.sectionName}
                style={{
                  border: `1px solid ${sumMatches ? "#e2e8f0" : "#fca5a5"}`,
                  borderRadius: 10,
                  padding: 14,
                  background: sec.isEnabled ? "#ffffff" : "#f8fafc",
                  opacity: sec.isEnabled ? 1 : 0.7,
                }}
              >
                {/* Section Header + Editable Section Settings */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={sec.isEnabled}
                      onChange={(e) => updateSection(secIdx, { isEnabled: e.target.checked })}
                    />
                    <BookOpen size={15} color="#4f46e5" />
                    <span>{sec.sectionName}</span>
                  </label>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      Qs:
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={sec.questionCount}
                        disabled={!sec.isEnabled}
                        onChange={(e) => updateSection(secIdx, { questionCount: Math.max(0, Number(e.target.value || 0)) })}
                        style={{ width: 58, padding: "2px 6px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                      />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      +Marks:
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.25"
                        value={sec.marksPerQuestion}
                        disabled={!sec.isEnabled}
                        onChange={(e) => updateSection(secIdx, { marksPerQuestion: Number(e.target.value || 0) })}
                        style={{ width: 58, padding: "2px 6px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                      />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      -Neg:
                      <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.0625"
                        value={sec.negativeMarks}
                        disabled={!sec.isEnabled}
                        onChange={(e) => updateSection(secIdx, { negativeMarks: Number(e.target.value || 0) })}
                        style={{ width: 64, padding: "2px 6px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                      />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      Min:
                      <input
                        type="number"
                        min="0"
                        max="180"
                        placeholder="—"
                        value={sec.durationMinutes}
                        disabled={!sec.isEnabled}
                        onChange={(e) => updateSection(secIdx, { durationMinutes: e.target.value })}
                        style={{ width: 56, padding: "2px 6px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                      />
                    </label>
                  </div>
                </div>

                {/* Topic-Wise Distribution Table */}
                {sec.isEnabled && (
                  <>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b", fontSize: 12 }}>
                            <th style={{ padding: "6px 8px", width: 34 }}>On</th>
                            <th style={{ padding: "6px 8px" }}>Topic</th>
                            <th style={{ padding: "6px 8px" }}>Trend Range</th>
                            <th style={{ padding: "6px 8px", width: 96 }}>Questions</th>
                            <th style={{ padding: "6px 8px" }}>Question Bank Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(sec.topicDistributions || []).map((t, tIdx) => {
                            const req = t.enabled ? Number(t.defaultQuestions || 0) : 0;
                            const avail = Number(t.availableInBank || 0);
                            const isShort = t.enabled && req > avail;
                            return (
                              <tr key={t.topic} style={{ borderBottom: "1px solid #f1f5f9", opacity: t.enabled ? 1 : 0.5 }}>
                                <td style={{ padding: "6px 8px" }}>
                                  <input
                                    type="checkbox"
                                    checked={t.enabled}
                                    aria-label={`Enable ${t.topic}`}
                                    onChange={(e) => updateTopic(secIdx, tIdx, { enabled: e.target.checked })}
                                  />
                                </td>
                                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{t.topic}</td>
                                <td style={{ padding: "6px 8px", color: "#64748b", fontSize: 12 }}>
                                  {t.minQuestions ?? 0}–{t.maxQuestions ?? t.defaultQuestions} Qs
                                </td>
                                <td style={{ padding: "6px 8px" }}>
                                  <input
                                    type="number"
                                    min="0"
                                    max="200"
                                    disabled={!t.enabled}
                                    aria-label={`${sec.sectionName} ${t.topic} questions`}
                                    value={t.defaultQuestions}
                                    onChange={(e) =>
                                      updateTopic(secIdx, tIdx, {
                                        defaultQuestions: Math.max(0, Number(e.target.value || 0)),
                                      })
                                    }
                                    style={{ width: 70, padding: "3px 6px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                                  />
                                </td>
                                <td style={{ padding: "6px 8px", fontSize: 12 }}>
                                  {!t.enabled ? (
                                    <span style={{ color: "#94a3b8" }}>Disabled</span>
                                  ) : isShort ? (
                                    <span style={{ color: "#b45309", fontWeight: 600 }}>
                                      {avail} published · Short by {req - avail}
                                    </span>
                                  ) : (
                                    <span style={{ color: "#15803d", fontWeight: 600 }}>
                                      {avail} published · Ready
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: sumMatches ? "#15803d" : "#b91c1c" }}>
                        Topic total: {topicSum} / {sec.questionCount} questions
                        {!sumMatches && " — must equal section total"}
                      </span>
                      {!sumMatches && (
                        <button
                          type="button"
                          className="qb-mini-btn"
                          onClick={() => rebalanceSectionTopics(secIdx)}
                        >
                          Auto-Balance to {sec.questionCount}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Generation Action Bar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
        <button
          type="button"
          className="outline-btn admin-action"
          disabled={loading || Boolean(busyAction) || summary.sumMismatches.length > 0}
          onClick={handleGenerateFromBank}
        >
          <Database size={14} />{" "}
          {busyAction === "bank" ? "Selecting from Bank..." : "Generate Mock Test from Question Bank"}
        </button>
        <button
          type="button"
          className="primary-btn admin-action"
          disabled={loading || Boolean(busyAction) || summary.sumMismatches.length > 0}
          onClick={handleGenerateWithEngine}
        >
          <Sparkles size={14} />{" "}
          {busyAction === "engine" ? "Generating Mock Test..." : "Generate Mock Test (Engine + Bank)"}
        </button>
      </div>
    </section>
  );
}
