import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Eye,
  Layers,
  Sparkles,
  XCircle,
} from "lucide-react";
import api from "../../api/client";

/**
 * Intelligent Exam-Wise Mock Test Creator Panel
 * Integrates with /api/admin/exam-engine/* to show real Subject Generator Registry statuses,
 * preview exam-specific topic & difficulty distributions, and generate validated mock test drafts.
 */
export function IntelligentExamCreatorPanel({
  exams = [],
  examId = "",
  stageId = "",
  onTestCreated,
}) {
  const [generators, setGenerators] = useState([]);
  const [shortagePolicy, setShortagePolicy] = useState("ALLOW_PARTIAL_DRAFT");
  const [quantOnly, setQuantOnly] = useState(false);
  const [preview, setPreview] = useState(null);
  const [sampleResult, setSampleResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedExam = exams.find((e) => e.id === examId) || null;
  const selectedStage = selectedExam?.stages?.find((s) => s.id === stageId) || null;

  useEffect(() => {
    let active = true;
    api("/admin/exam-engine/generators")
      .then((data) => {
        if (active && Array.isArray(data?.generators)) {
          setGenerators(data.generators);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setPreview(null);
    setSampleResult(null);
    setError("");
    setNotice("");
  }, [examId, stageId]);

  const buildPayload = (saveAsDraft = false) => {
    const quantSectionNames = (selectedStage?.sections || [])
      .filter((s) => {
        const n = String(s.name || "").toLowerCase();
        return (
          n.includes("quant") ||
          n.includes("numerical") ||
          n.includes("data analysis") ||
          n.includes("data interpretation")
        );
      })
      .map((s) => s.name);

    return {
      examId: examId || undefined,
      stageId: stageId || undefined,
      examCode: selectedExam?.code || "IBPS-RRB-OA",
      stageName: selectedStage?.name || "Prelims",
      targetSectionNames: quantOnly && quantSectionNames.length ? quantSectionNames : null,
      shortagePolicy,
      varyWithinRanges: true,
      saveAsDraft,
    };
  };

  async function handlePreviewDistribution() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await api("/admin/exam-engine/preview", {
        method: "POST",
        body: JSON.stringify(buildPayload(false)),
      });
      setPreview(res.preview);
      setSampleResult(null);
    } catch (err) {
      setError(err.message || "Failed to preview exam pattern distribution.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(saveAsDraft = false) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await api("/admin/exam-engine/generate", {
        method: "POST",
        body: JSON.stringify(buildPayload(saveAsDraft)),
      });
      setSampleResult(res);
      if (saveAsDraft && res?.test) {
        setNotice(
          `Saved draft "${res.test.name}" (${res.generationReport.totalGenerated}/${res.generationReport.totalRequired} questions generated).`
        );
        onTestCreated?.(res.test);
      } else {
        setNotice(
          `Generated sample mock test preview: ${res.generationReport.totalGenerated}/${res.generationReport.totalRequired} validated questions.`
        );
      }
    } catch (err) {
      setError(err.message || "Mock test generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="intelligent-engine-panel" style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 18, background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#0f766e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <Cpu size={14} /> Intelligent Exam-Wise Mock Test Engine
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475569" }}>
            Data-driven exam pattern distribution with weighted arithmetic subtopic rotation, 5-option quality validation, and strict duplicate prevention.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="outline-btn admin-action"
            disabled={loading || !examId || !stageId}
            onClick={handlePreviewDistribution}
          >
            <Eye size={13} /> Preview Distribution
          </button>
          <button
            type="button"
            className="outline-btn admin-action"
            disabled={loading || !examId || !stageId}
            onClick={() => handleGenerate(false)}
          >
            <Sparkles size={13} /> Generate Sample
          </button>
          <button
            type="button"
            className="primary-btn admin-action"
            disabled={loading || !examId || !stageId}
            onClick={() => handleGenerate(true)}
          >
            <Layers size={13} /> Generate &amp; Save Draft
          </button>
        </div>
      </div>

      {/* Live Subject Generator Integration Statuses */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {generators.map((g) => {
          const isActive = g.status === "ACTIVE";
          return (
            <span
              key={g.subjectKey}
              title={g.notes}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                background: isActive ? "#dcfce7" : "#f1f5f9",
                color: isActive ? "#166534" : "#64748b",
                border: `1px solid ${isActive ? "#86efac" : "#cbd5e1"}`,
              }}
            >
              {isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {g.displayName}: {g.status}
              {isActive && ` (${g.supportedTopicCount} topics)`}
            </span>
          );
        })}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <span>Shortage Policy:</span>
          <select
            value={shortagePolicy}
            onChange={(e) => setShortagePolicy(e.target.value)}
            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff" }}
          >
            <option value="FAIL_STRICT">Strict (Block if any section unavailable)</option>
            <option value="USE_BANK_FALLBACK">Use Published Bank Fallback for missing subjects</option>
            <option value="ALLOW_PARTIAL_DRAFT">Allow Partial Draft (Generate active subjects only)</option>
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={quantOnly}
            onChange={(e) => setQuantOnly(e.target.checked)}
          />
          Generate Quantitative Aptitude section only
        </label>
      </div>

      {error && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {notice && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", fontSize: 13, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={14} /> {notice}
        </div>
      )}

      {/* Distribution Preview Table */}
      {preview && (
        <div style={{ marginTop: 12, background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <strong>
              Pattern Preview: {preview.examName} ({preview.stageName}) — {preview.totalQuestions} Qs ·{" "}
              {Math.round((preview.durationSeconds || 3600) / 60)} min
            </strong>
            <span style={{ fontSize: 12, color: "#475569" }}>
              Auto-generatable right now: {preview.autoGeneratableQuestions}/{preview.totalQuestions} Qs
            </span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {preview.sections.map((sec) => (
              <div key={sec.sectionName} style={{ padding: 8, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <strong>
                    {sec.sectionName} ({sec.questionCount} Qs · +{sec.marksPerQuestion} / -{sec.negativeMarks})
                  </strong>
                  <span style={{ fontSize: 12, fontWeight: 600, color: sec.generatorStatus === "ACTIVE" ? "#15803d" : "#b45309" }}>
                    Generator: {sec.generatorStatus}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                  Difficulty Target: Easy {sec.difficultyTargets.easy} · Medium {sec.difficultyTargets.medium} · Hard {sec.difficultyTargets.hard}
                </div>
                {sec.topicPlan?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {sec.topicPlan.map((tp) => (
                      <span
                        key={`${sec.sectionName}-${tp.topic}`}
                        style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#fff", border: "1px solid #cbd5e1", color: "#334155" }}
                      >
                        {tp.topic}: <b>{tp.count}</b>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample Generation Report */}
      {sampleResult?.generationReport && (
        <div style={{ marginTop: 12, background: "#fff", borderRadius: 8, border: "1px solid #cbd5e1", padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <strong>
              Generation Report: {sampleResult.generationReport.totalGenerated}/{sampleResult.generationReport.totalRequired} Questions Validated
            </strong>
            <span style={{ fontWeight: 700, color: sampleResult.patternFulfilled ? "#15803d" : "#b45309" }}>
              {sampleResult.patternFulfilled ? "Exact Pattern Fulfilled" : "Partial / Shortages Reported"}
            </span>
          </div>
          {sampleResult.generationReport.shortages?.length > 0 && (
            <ul style={{ margin: "6px 0 0 18px", fontSize: 12, color: "#9a3412" }}>
              {sampleResult.generationReport.shortages.map((sh, i) => (
                <li key={i}>
                  <b>{sh.sectionName}</b>: {sh.reason} ({sh.missing} short)
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
