import { useState } from "react";
import api from "../api/client";
import {
  RefreshCw,
  Download,
  Key,
  Building2,
  HelpCircle,
  FileText,
  ChevronRight,
} from "lucide-react";

const PUZZLE_TYPES = [
  { value: "AUTO", label: "Auto (any type)" },
  { value: "SINGLE_BUILDING", label: "Single Building (one person/floor)" },
  { value: "MULTI_BUILDING", label: "Multiple Buildings" },
  { value: "FLOOR_FLAT", label: "Floor + Flats" },
  { value: "PROFESSIONS", label: "People & Professions" },
  { value: "MULTI_VARIABLE", label: "Multi-Variable (Profession/Age/City)" },
];
const DIFFICULTIES = ["Easy", "Medium", "Hard", "Very Difficult"];
const EXAMS = ["IBPS-PO", "IBPS-CLERK", "SBI-PO", "SBI-CLERK", "IBPS-RRB"];
const STAGES = ["Prelims", "Mains"];

export default function FloorPuzzleGenerator() {
  const [form] = useState({
    exam: "IBPS-PO",
    stage: "Prelims",
    puzzleType: "AUTO",
    difficulty: "Medium",
    questionCount: 5,
  });
  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selected, setSelected] = useState({}); // questionId -> option key
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPuzzle(null);
    setShowAnswer(false);
    setSelected({});
    try {
      const data = await api("/puzzles/floor/generate", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setPuzzle(data);
    } catch (err) {
      setError(err.message || "Generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (questionId, key) => {
    setSelected({ ...selected, [questionId]: key });
  };

  const isCorrect = (q) => selected[q.questionId] === q.correctAnswer;

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(puzzle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hkk-floor-puzzle-${puzzle.puzzle.puzzleId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(puzzle, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  if (loading && !puzzle) {
    return (
      <section className="panel admin-panel">
        <div className="student-welcome">
          <div>
            <div className="eyebrow">FLOOR ARRANGEMENT GENERATOR</div>
            <h1>Generating puzzle…</h1>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel admin-panel">
        <div className="student-welcome">
          <div>
            <div className="eyebrow">FLOOR ARRANGEMENT GENERATOR</div>
            <h1>Error</h1>
            <p style={{ color: "#dc2626" }}>{error}</p>
            <button
              className="primary-btn"
              onClick={handleGenerate}
              disabled={loading}
            >
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel admin-panel">
      {/* Generator controls */}
      <div className="student-welcome" style={{ paddingBottom: 16 }}>
        <div className="form-grid">
          <div className="eyebrow" style={{ gridColumn: "1 / -1" }}>
            FLOOR ARRANGEMENT · REASONING · BANKING EXAMS
          </div>
          <form onSubmit={handleGenerate} className="gen-form" style={{ gridColumn: "1 / -1" }}>
            <div className="form-row">
              <label>
                Exam <span className="req">*</span>
                <select
                  value={form.exam}
                  onChange={(e) => (form.exam = e.target.value)}
                >
                  {EXAMS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
              <label>
                Stage
                <select
                  value={form.stage}
                  onChange={(e) => (form.stage = e.target.value)}
                >
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>
                Puzzle Type
                <select
                  value={form.puzzleType}
                  onChange={(e) => (form.puzzleType = e.target.value)}
                >
                  {PUZZLE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Difficulty
                <select
                  value={form.difficulty}
                  onChange={(e) => (form.difficulty = e.target.value)}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label>
                Questions
                <select
                  value={form.questionCount}
                  onChange={(e) => (form.questionCount = Number(e.target.value))}
                >
                  [5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)
                </select>
              </label>
              <button
                type="submit"
                className="primary-btn gen-btn"
                disabled={loading}
              >
                <RefreshCw size={16} /> Generate Verified Puzzle
              </button>
            </div>
          </form>
        </div>
      </div>

      {!puzzle ? (
        <div className="empty-state">
          <Building2 size={40} />
          <h2>Floor Arrangement Question Generator</h2>
          <p>
            Configure the exam, puzzle type and difficulty above, then generate a
            CSP-verified floor arrangement puzzle with exactly one valid solution.
            Every question has 5 options (A–E) and a concise explanation.
          </p>
          <p>
            <HelpCircle size={14} />
            Supported: Single Building, Multiple Buildings, Floor + Flats, People &
            Professions, and Multi-Variable arrangements.
          </p>
        </div>
      ) : (
        <>
          <div className="puzzle-header" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Key size={18} />
            <span>
              <strong>Puzzle ID:</strong> {puzzle.puzzle.puzzleId}&nbsp;·&nbsp;
              <strong>Type:</strong> {puzzle.puzzle.puzzleType}&nbsp;·&nbsp;
              <strong>Difficulty:</strong> {puzzle.puzzle.difficulty}&nbsp;·&nbsp;
              <strong>Valid:</strong> {puzzle.puzzle.validationStatus}
            </span>
          </div>

          {/* Scenario / Clues */}
          <div className="clues-card">
            <div className="card-title">
              <FileText size={16} />
              Scenario &amp; Clues
            </div>
            <p className="scenario">
              {puzzle.puzzle.clueStatements.length} logically connected clues define
              exactly one valid arrangement.
            </p>
            <ol className="clue-list">
              {puzzle.puzzle.clueStatements.map((clue, i) => (
                <li key={i}>{clue}</li>
              ))}
            </ol>
          </div>

          {/* Questions */}
          <div className="questions-card">
            <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                <Building2 size={16} /> Questions ({puzzle.questions.length})
              </span>
              {!showAnswer && (
                <button className="outline-btn" onClick={() => setShowAnswer(true)}>
                  Show Answer Key
                </button>
              )}
              {showAnswer && (
                <button className="outline-btn" onClick={() => setShowAnswer(false)}>Hide Answer Key</button>
              )}
            </div>

            {puzzle.questions.map((q) => {
              const answered = selected[q.questionId] !== undefined;
              const correct = isCorrect(q);
              return (
                <div key={q.questionId} className="q-card">
                  <div className="q-meta">
                    Q. {q.questionText}
                  </div>
                  <div className="q-options">
                    {q.options.map((o) => {
                      const chosen = selected[q.questionId] === o.key;
                      const isCorrectOpt = o.key === q.correctAnswer;
                      const showResult = showAnswer || (answered && chosen);
                      let cls = "q-option";
                      if (showResult && isCorrectOpt) cls += " correct";
                      if (showResult && chosen && !isCorrectOpt) cls += " wrong";
                      return (
                        <button
                          key={o.key}
                          className={cls}
                          onClick={() => !showAnswer && handleSelect(q.questionId, o.key)}
                          disabled={showAnswer}
                        >
                          <span className="opt-key">{o.key}</span>
                          <span className="opt-text">{o.text}</span>
                          {showResult && isCorrectOpt && <CheckMark size={14} />}
                          {showResult && chosen && !isCorrectOpt && <XMark size={14} />}
                        </button>
                      );
                    })}
                  </div>
                  {showAnswer && (
                    <div className="q-explanation">
                      <strong>Answer: {q.correctAnswer}</strong> &mdash;
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Answer key (solution) */}
          {showAnswer && puzzle.answerKey && (
            <div className="answer-key-card">
              <div className="card-title">
                <Key size={16} /> Verified Solution (Answer Key)
              </div>
              <p>Exactly one valid arrangement exists. Each person occupies one floor/flat.</p>
              <div className="solution-grid">
                {puzzle.answerKey.solution.map((s) => (
                  <div key={s.person} className="sol-item">
                    <strong>{s.person}</strong>{" "}
                    <span className="sol-detail">
                      {s.building ? `Building ${s.building} · ` : ""}
                      Floor {s.floor}{s.flat ? ` · ${s.flatLabel || s.flat}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* JSON export */}
          <div className="export-row" style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="outline-btn" onClick={downloadJSON} title="Download JSON">
              <Download size={16} /> Download JSON
            </button>
            <button className="outline-btn" onClick={copyJSON} title="Copy to clipboard">
              {copied ? "Copied!" : "Copy JSON"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function CheckMark({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#15803d"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XMark({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#dc2626"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
