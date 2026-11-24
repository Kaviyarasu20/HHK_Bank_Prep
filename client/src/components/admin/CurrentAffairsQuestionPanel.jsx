import { useEffect, useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { adminCaApi } from "../../api/currentAffairs";

const emptyQuestionForm = () => ({
  id: "",
  questionText: "",
  options: ["", "", "", ""],
  correctAnswer: "A",
  explanation: "",
});

/**
 * Independent per-article MCQ Manager.
 * Holds its own local state so editing Article A never affects Article B.
 */
export function CurrentAffairsQuestionPanel({
  affairId,
  onToast,
  onConfirmModal,
  onQuestionsChanged,
}) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [form, setForm] = useState(emptyQuestionForm);
  const [formError, setFormError] = useState("");

  async function loadQuestions() {
    setLoading(true);
    setError("");
    try {
      const res = await adminCaApi.listQuestions(affairId);
      setQuestions(res.questions ?? []);
    } catch (err) {
      setError(err.message || "Failed to load questions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQuestions();
  }, [affairId]);

  function startEdit(q) {
    const opts = Array.isArray(q.options) ? q.options : [];
    const filled = ["A", "B", "C", "D"].map(
      (key) => opts.find((o) => o.key === key)?.text ?? "",
    );
    setForm({
      id: q.id,
      questionText: q.question_text || "",
      options: filled,
      correctAnswer: q.correct_answer || "A",
      explanation: q.explanation || "",
    });
    setFormError("");
  }

  function resetForm() {
    setForm(emptyQuestionForm());
    setFormError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    const trimmedText = form.questionText.trim();
    if (trimmedText.length < 5) {
      setFormError("Question text must be at least 5 characters.");
      return;
    }

    const mappedOptions = form.options
      .map((text, idx) => ({
        key: String.fromCharCode(65 + idx),
        text: text.trim(),
      }))
      .filter((o) => o.text.length > 0);

    if (mappedOptions.length < 2) {
      setFormError("Provide at least 2 non-empty answer options.");
      return;
    }
    if (!mappedOptions.some((o) => o.key === form.correctAnswer)) {
      setFormError(`Selected correct answer (${form.correctAnswer}) must have option text.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        questionText: trimmedText,
        options: mappedOptions,
        correctAnswer: form.correctAnswer,
        explanation: form.explanation.trim(),
      };
      if (form.id) {
        await adminCaApi.updateQuestion(affairId, form.id, payload);
        onToast?.("Quiz question updated.", "success");
      } else {
        await adminCaApi.createQuestion(affairId, payload);
        onToast?.("Quiz question added.", "success");
      }
      resetForm();
      await loadQuestions();
      onQuestionsChanged?.();
    } catch (err) {
      setFormError(err.message || "Failed to save question.");
      onToast?.(err.message || "Failed to save question.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(q) {
    if (onConfirmModal) {
      const ok = await onConfirmModal({
        title: "Delete Quiz Question?",
        message:
          q.answer_count > 0
            ? `This question has ${q.answer_count} student answer(s). Permanent deletion is blocked to preserve student history.`
            : "Delete this quiz question permanently? This action cannot be undone.",
        confirmText: "Delete Question",
        cancelText: "Cancel",
        type: "danger",
        icon: "trash",
      });
      if (!ok) return;
    }

    setDeletingId(q.id);
    setError("");
    try {
      await adminCaApi.deleteQuestion(affairId, q.id);
      onToast?.("Quiz question deleted.", "success");
      if (form.id === q.id) resetForm();
      await loadQuestions();
      onQuestionsChanged?.();
    } catch (err) {
      setError(err.message || "Failed to delete question.");
      onToast?.(err.message || "Failed to delete question.", "error");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="ca-mcq-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>Article MCQs ({questions.length})</h4>
      </div>

      {error && (
        <div className="ca-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" className="outline-btn" onClick={() => void loadQuestions()}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="ca-state-box">Loading article questions…</div>
      ) : questions.length === 0 ? (
        <div className="ca-state-box">No quiz questions attached to this article yet.</div>
      ) : (
        questions.map((q, idx) => (
          <div className="ca-mcq-item" key={q.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <strong>
                Q{idx + 1}. {q.question_text}
              </strong>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="outline-btn"
                  style={{ padding: "4px 9px", fontSize: 12 }}
                  onClick={() => startEdit(q)}
                >
                  <Edit2 size={12} /> Edit
                </button>
                <button
                  type="button"
                  className="outline-btn"
                  style={{ padding: "4px 9px", fontSize: 12 }}
                  disabled={deletingId === q.id}
                  onClick={() => void handleDelete(q)}
                >
                  <Trash2 size={12} /> {deletingId === q.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "#475569", marginTop: 6 }}>
              Options: {Array.isArray(q.options) ? q.options.length : 0} · Correct:{" "}
              <strong>{q.correct_answer}</strong>
              {q.answer_count > 0 ? ` · Student answers: ${q.answer_count}` : ""}
            </div>
            {q.explanation && (
              <p style={{ fontSize: 12.5, color: "#64748b", margin: "6px 0 0" }}>
                <strong>Explanation:</strong> {q.explanation}
              </p>
            )}
          </div>
        ))
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h5 style={{ margin: 0 }}>{form.id ? "Edit MCQ" : "Add new MCQ"}</h5>
          {form.id && (
            <button type="button" className="text-link" onClick={resetForm}>
              <X size={13} /> Cancel edit
            </button>
          )}
        </div>

        {formError && (
          <div className="ca-error-banner" role="alert">
            <span>{formError}</span>
          </div>
        )}

        <input
          value={form.questionText}
          onChange={(e) => setForm((prev) => ({ ...prev, questionText: e.target.value }))}
          placeholder="Question text (minimum 5 characters)"
          style={{ width: "100%", marginBottom: 8 }}
        />

        <div className="ca-mcq-options-grid">
          {form.options.map((value, i) => {
            const key = String.fromCharCode(65 + i);
            const isCorrect = form.correctAnswer === key;
            return (
              <div className="ca-option-row" key={key}>
                <button
                  type="button"
                  className={`ca-option-key-btn ${isCorrect ? "is-correct" : ""}`}
                  title={`Mark Option ${key} as correct`}
                  onClick={() => setForm((prev) => ({ ...prev, correctAnswer: key }))}
                >
                  {key}
                </button>
                <input
                  value={value}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      options: prev.options.map((old, j) => (j === i ? e.target.value : old)),
                    }))
                  }
                  placeholder={`Option ${key}`}
                  style={{ flex: 1 }}
                />
              </div>
            );
          })}
        </div>

        <textarea
          rows={2}
          value={form.explanation}
          onChange={(e) => setForm((prev) => ({ ...prev, explanation: e.target.value }))}
          placeholder="Explanation (recommended for exam prep)"
          style={{ width: "100%", marginBottom: 8 }}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="outline-btn" onClick={resetForm} disabled={saving}>
            Reset
          </button>
          <button type="submit" className="primary-btn" disabled={saving}>
            <Plus size={14} />{" "}
            {saving
              ? "Saving…"
              : form.id
                ? `Update MCQ (Answer ${form.correctAnswer})`
                : `Add MCQ (Answer ${form.correctAnswer})`}
          </button>
        </div>
      </form>
    </div>
  );
}
