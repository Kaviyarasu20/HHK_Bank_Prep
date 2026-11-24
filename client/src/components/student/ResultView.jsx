// Place at: client/src/components/student/ResultView.jsx
import {
  ArrowLeft,
  Award,
  BarChart3,
  CheckCircle2,
  Clock3,
  Gauge,
  MinusCircle,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";

const STRAY_MATH_PREFIX =
  /^What value will come in place of the question mark \(\?\) in the following question\?\s*/i;

/**
 * Displays an optional passage or illustration block above a question.
 */
function PassageBlock({ title, text, language, imageUrl }) {
  if (!title && !text && !imageUrl) return null;
  return (
    <div className="rv-passage-box">
      {title && <div className="rv-passage-title">{title}</div>}
      {text && (
        <p className="rv-passage-text" lang={language || undefined}>
          {text}
        </p>
      )}
      {imageUrl && (
        <img
          className="question-illustration"
          src={imageUrl}
          alt={title || "Passage illustration"}
          loading="lazy"
        />
      )}
    </div>
  );
}

/**
 * Formats banking questions cleanly, separating Directions, numbered clues, and Question prompts.
 */
function FormattedQuestionText({ text = "" }) {
  const cleaned = String(text || "").trim();
  const withoutPrefix = cleaned.replace(STRAY_MATH_PREFIX, "");
  const isMathQuestionMarkExpr = /[=+\-×÷*/(]\s*\?|\?\s*[=+\-×÷*/)]/.test(withoutPrefix);
  const display = isMathQuestionMarkExpr ? cleaned : withoutPrefix;

  if (/^Directions:/i.test(display) && /Question:/i.test(display)) {
    const [dirBlock, ...qParts] = display.split(/\n*\s*Question:\s*/i);
    const questionPrompt = qParts.join("Question: ").trim();
    const rawDir = dirBlock.replace(/^Directions:\s*/i, "").trim();
    const clueSplit = rawDir.split(/\s*(?=\b\d+\.\s+)/);
    const intro = clueSplit[0]?.trim() || "";
    const clues = clueSplit
      .slice(1)
      .map((c) => c.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean);

    return (
      <div className="cbt-puzzle-stem">
        <div className="cbt-directions-box">
          <div className="cbt-directions-label">Directions</div>
          {intro && <p className="cbt-directions-intro">{intro}</p>}
          {clues.length > 0 && (
            <ol className="cbt-clue-list">
              {clues.map((clue, idx) => (
                <li key={idx}>{clue}</li>
              ))}
            </ol>
          )}
        </div>
        <h2 className="cbt-question-prompt">{questionPrompt}</h2>
      </div>
    );
  }

  return <h2 className="cbt-question-text">{display}</h2>;
}

const SCORECARD_STYLES = `
.rv-shell { display: flex; flex-direction: column; gap: 20px; padding: 20px; max-width: 1120px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; }
.rv-hero { display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding: 24px 28px; border-radius: 16px; background: linear-gradient(135deg, #ffffff 0%, #f5f3ff 60%, #eef2ff 100%); border: 1px solid #e0e7ff; box-shadow: 0 8px 24px rgba(79, 70, 229, 0.06); }
.rv-badge-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.rv-status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; }
.rv-status-badge.done { background: #dcfce7; color: #166534; }
.rv-status-badge.auto { background: #fef3c7; color: #92400e; }
.rv-test-pill { padding: 4px 10px; border-radius: 999px; background: #ffffff; border: 1px solid #e2e8f0; font-size: 12px; font-weight: 600; color: #475569; }
.rv-title { margin: 0 0 6px; font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
.rv-subtitle { margin: 0 0 16px; font-size: 14px; color: #475569; max-width: 560px; }
.rv-back-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 9px; border: 1px solid #cbd5e1; background: #ffffff; color: #334155; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
.rv-back-btn:hover { border-color: #6366f1; color: #4f46e5; background: #f5f3ff; }
.rv-hero-ring { position: relative; width: 112px; height: 112px; flex-shrink: 0; }
.rv-hero-ring svg { transform: rotate(-90deg); }
.rv-ring-track { fill: none; stroke: #e2e8f0; stroke-width: 9; }
.rv-ring-fill { fill: none; stroke: #5b50ec; stroke-width: 9; stroke-linecap: round; transition: stroke-dashoffset 0.6s ease; }
.rv-ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.rv-ring-center strong { font-size: 22px; font-weight: 800; color: #1e1b4b; line-height: 1.1; }
.rv-ring-center span { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; }
.rv-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(165px, 1fr)); gap: 14px; }
.rv-kpi-card { background: #ffffff; border: 1px solid #e6e8f0; border-top: 3px solid #cbd5e1; border-radius: 12px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03); transition: transform 0.15s ease, box-shadow 0.15s ease; }
.rv-kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06); }
.rv-kpi-card.tone-indigo { border-top-color: #5b50ec; }
.rv-kpi-card.tone-emerald { border-top-color: #10b981; }
.rv-kpi-card.tone-rose { border-top-color: #ef4444; }
.rv-kpi-card.tone-slate { border-top-color: #94a3b8; }
.rv-kpi-card.tone-violet { border-top-color: #8b5cf6; }
.rv-kpi-card.tone-amber { border-top-color: #f59e0b; }
.rv-kpi-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.rv-kpi-label { font-size: 12.5px; font-weight: 600; color: #64748b; }
.rv-kpi-icon { width: 30px; height: 30px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: #f8fafc; color: #475569; }
.tone-indigo .rv-kpi-icon { background: #eef2ff; color: #4f46e5; }
.tone-emerald .rv-kpi-icon { background: #ecfdf5; color: #059669; }
.tone-rose .rv-kpi-icon { background: #fef2f2; color: #dc2626; }
.tone-violet .rv-kpi-icon { background: #f5f3ff; color: #7c3aed; }
.tone-amber .rv-kpi-icon { background: #fffbeb; color: #d97706; }
.rv-kpi-value { font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.15; }
.rv-kpi-sub { margin-top: 6px; font-size: 12px; color: #64748b; }
.rv-two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 18px; }
.rv-card { background: #ffffff; border: 1px solid #e6e8f0; border-radius: 14px; padding: 20px 22px; box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03); }
.rv-card-head { display: flex; align-items: center; gap: 8px; color: #4f46e5; margin-bottom: 16px; }
.rv-card-head h2 { margin: 0; font-size: 17px; font-weight: 700; color: #0f172a; }
.rv-metric-list { display: flex; flex-direction: column; gap: 14px; }
.rv-metric-row { padding: 12px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #eef2f7; }
.rv-metric-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.rv-metric-top strong { display: block; font-size: 14px; color: #0f172a; }
.rv-metric-meta { display: block; font-size: 12px; color: #64748b; margin-top: 2px; }
.rv-metric-score { text-align: right; flex-shrink: 0; }
.rv-metric-score b { display: block; font-size: 14px; color: #0f172a; }
.rv-metric-score span { font-size: 12px; font-weight: 600; color: #64748b; }
.rv-bar-track { height: 7px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
.rv-bar-fill { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
.rv-diff-label-wrap { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.rv-diff-pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: capitalize; }
.rv-diff-pill.diff-easy { background: #dcfce7; color: #166534; }
.rv-diff-pill.diff-medium { background: #fef3c7; color: #92400e; }
.rv-diff-pill.diff-hard { background: #fee2e2; color: #991b1b; }
.rv-sw-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.rv-sw-box { padding: 16px; border-radius: 12px; border: 1px solid transparent; }
.rv-sw-box.strength { background: #f0fdf4; border-color: #bbf7d0; }
.rv-sw-box.weakness { background: #fef2f2; border-color: #fecaca; }
.rv-sw-box h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 12px; font-size: 14px; font-weight: 700; }
.rv-sw-box.strength h3 { color: #15803d; }
.rv-sw-box.weakness h3 { color: #b91c1c; }
.rv-sw-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(15, 23, 42, 0.06); font-size: 13px; color: #1e293b; }
.rv-sw-row:last-child { border-bottom: none; }
.rv-sw-empty { margin: 0; font-size: 13px; color: #64748b; }
.rv-review-list { display: flex; flex-direction: column; gap: 16px; }
.rv-review-card { border: 1px solid #e2e8f0; border-left: 4px solid #94a3b8; border-radius: 12px; padding: 16px 18px; background: #ffffff; }
.rv-review-card.state-correct { border-left-color: #10b981; }
.rv-review-card.state-wrong { border-left-color: #ef4444; }
.rv-review-card.state-skipped { border-left-color: #94a3b8; }
.rv-review-meta { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.rv-review-tags, .rv-review-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rv-q-num { padding: 3px 9px; border-radius: 6px; background: #eef2ff; color: #4338ca; font-size: 12px; font-weight: 700; }
.rv-tag { font-size: 12px; font-weight: 600; color: #475569; }
.rv-outcome-pill { padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
.rv-outcome-pill.correct { background: #dcfce7; color: #166534; }
.rv-outcome-pill.wrong { background: #fee2e2; color: #991b1b; }
.rv-outcome-pill.skipped { background: #f1f5f9; color: #475569; }
.rv-time-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; }
.rv-review-question h2 { font-size: 15.5px; margin: 0 0 12px; }
.rv-answer-strip { display: flex; gap: 20px; flex-wrap: wrap; padding: 10px 14px; border-radius: 8px; background: #f8fafc; font-size: 13.5px; margin: 12px 0; }
.rv-ans-correct { color: #15803d; }
.rv-ans-wrong { color: #dc2626; }
.rv-ans-skipped { color: #64748b; }
.rv-explanation-box { padding: 12px 14px; border-radius: 8px; background: #f5f3ff; border: 1px solid #e0e7ff; font-size: 13.5px; color: #334155; }
.rv-explanation-box strong { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #4f46e5; margin-bottom: 4px; }
.rv-explanation-box p { margin: 0; line-height: 1.55; }
.rv-passage-box { padding: 12px 14px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 12px; }
.rv-passage-title { font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px; }
.rv-passage-text { margin: 0; font-size: 13.5px; line-height: 1.55; color: #334155; white-space: pre-line; }
.cbt-directions-box { background: #f8f9fc; border: 1px solid #e2e6f0; border-left: 4px solid #5b50ec; border-radius: 10px; padding: 12px 16px; margin-bottom: 12px; }
.cbt-directions-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #5b50ec; margin-bottom: 6px; }
.cbt-directions-intro { margin: 0 0 8px; font-size: 14px; line-height: 1.55; color: #1e293b; font-weight: 500; }
.cbt-clue-list { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 13.5px; line-height: 1.5; color: #334155; }
.cbt-question-prompt { margin: 0; font-size: 15.5px; font-weight: 700; color: #0f172a; }
.cbt-question-text { white-space: pre-line; line-height: 1.55; }
.descriptive-result { padding: 12px 14px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 13.5px; }
.descriptive-result pre { white-space: pre-wrap; margin: 8px 0; font-family: inherit; color: #334155; }
`;

function fmtNum(val) {
  const n = Number(val ?? 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : Number(n.toFixed(2)).toString();
}

function formatDuration(sec) {
  const total = Math.max(0, Math.round(Number(sec || 0)));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m} min`;
}

function getBarColor(pct) {
  if (pct >= 75) return "#10b981";
  if (pct >= 45) return "#f59e0b";
  return "#ef4444";
}

function ResultView({ result = {}, onBack = () => {} }) {
  const r = result.result || {};
  const topicPerformance = result.topicPerformance ?? [];
  const difficultyPerformance = result.difficultyPerformance ?? [];
  const sw = result.strengthsWeaknesses ?? null;

  const correct = Number(r.correct_count || 0);
  const wrong = Number(r.wrong_count || 0);
  const unattempted = Number(r.unanswered_count || 0);
  const pending = Number(r.pending_review_count || 0);
  const attempted = correct + wrong;
  const accuracy = attempted > 0 ? Number(((correct / attempted) * 100).toFixed(1)) : 0;
  const score = Number(r.score || 0);
  const maxScore = Number(r.max_score || 0);
  const scorePct = maxScore > 0 ? Math.max(0, Math.min(100, Math.round((score / maxScore) * 100))) : 0;

  // SVG Ring progress math
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (scorePct / 100) * circumference;

  const kpis = [
    {
      key: "score",
      label: "Total Score",
      value: `${fmtNum(score)} / ${fmtNum(maxScore)}`,
      sub: `${scorePct}% of max marks`,
      tone: "indigo",
      Icon: Award,
    },
    {
      key: "correct",
      label: "Correct",
      value: correct,
      sub: attempted ? `${accuracy}% accuracy` : "No attempts yet",
      tone: "emerald",
      Icon: CheckCircle2,
    },
    {
      key: "wrong",
      label: "Incorrect",
      value: wrong,
      sub: wrong > 0 ? "Negative marking applied" : "Zero penalties",
      tone: "rose",
      Icon: XCircle,
    },
    {
      key: "unattempted",
      label: "Unattempted",
      value: unattempted,
      sub: `${correct + wrong + unattempted} total Qs`,
      tone: "slate",
      Icon: MinusCircle,
    },
    {
      key: "accuracy",
      label: "Accuracy",
      value: `${accuracy}%`,
      sub: `${correct} of ${attempted} attempted`,
      tone: "violet",
      Icon: Target,
    },
    {
      key: "time",
      label: "Time Taken",
      value: formatDuration(r.elapsed_seconds),
      sub: r.status === "auto_submitted" ? "Timer completed" : "Submitted on time",
      tone: "amber",
      Icon: Clock3,
    },
  ];

  if (pending > 0) {
    kpis.push({
      key: "pending",
      label: "Pending Review",
      value: pending,
      sub: "Descriptive evaluation",
      tone: "slate",
      Icon: Gauge,
    });
  }

  return (
    <div className="result-workspace rv-shell">
      <style>{SCORECARD_STYLES}</style>

      {/* Hero Scorecard Banner */}
      <section className="rv-hero">
        <div className="rv-hero-left">
          <div className="rv-badge-row">
            <span className={`rv-status-badge ${r.status === "auto_submitted" ? "auto" : "done"}`}>
              <Sparkles size={12} />
              {r.status === "auto_submitted" ? "Auto-Submitted (Time Up)" : "Test Submitted"}
            </span>
            {r.test_name && <span className="rv-test-pill">{r.test_name}</span>}
          </div>
          <h1 className="rv-title">Performance Scorecard</h1>
          <p className="rv-subtitle">
            {r.status === "auto_submitted"
              ? "Your attempt was submitted automatically when the exam timer expired."
              : "Your answers have been evaluated against the official marking scheme."}
          </p>
          <button type="button" className="rv-back-btn" onClick={onBack}>
            <ArrowLeft size={15} /> Back to Performance
          </button>
        </div>

        <div className="rv-hero-ring" aria-label={`Score ${scorePct}%`}>
          <svg width="112" height="112" viewBox="0 0 112 112">
            <circle cx="56" cy="56" r={radius} className="rv-ring-track" />
            <circle
              cx="56"
              cy="56"
              r={radius}
              className="rv-ring-fill"
              style={{
                strokeDasharray: circumference,
                strokeDashoffset: dashOffset,
              }}
            />
          </svg>
          <div className="rv-ring-center">
            <strong>{scorePct}%</strong>
            <span>Score</span>
          </div>
        </div>
      </section>

      {/* Balanced KPI Grid */}
      <div className="rv-kpi-grid">
        {kpis.map(({ key, label, value, sub, tone, Icon }) => (
          <div className={`rv-kpi-card tone-${tone}`} key={key}>
            <div className="rv-kpi-head">
              <span className="rv-kpi-label">{label}</span>
              <span className="rv-kpi-icon">
                <Icon size={16} />
              </span>
            </div>
            <div className="rv-kpi-value">{value}</div>
            <div className="rv-kpi-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Section Analysis */}
      {result.sections?.length > 0 && (
        <section className="rv-card">
          <div className="rv-card-head">
            <BarChart3 size={18} />
            <h2>Section Analysis</h2>
          </div>
          <div className="rv-metric-list">
            {result.sections.map((s) => {
              const acc = Number(s.accuracy || 0);
              return (
                <div className="rv-metric-row" key={s.section_id}>
                  <div className="rv-metric-top">
                    <div>
                      <strong>{s.section_name}</strong>
                      <span className="rv-metric-meta">
                        {s.correct_count} correct · {s.wrong_count} wrong · {s.attempted_count} attempted
                      </span>
                    </div>
                    <div className="rv-metric-score">
                      <b>{fmtNum(s.score)} marks</b>
                      <span>{acc.toFixed(1)}% acc</span>
                    </div>
                  </div>
                  <div className="rv-bar-track">
                    <div
                      className="rv-bar-fill"
                      style={{ width: `${Math.min(100, Math.max(0, acc))}%`, background: getBarColor(acc) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Topic-wise & Difficulty-wise Analytics */}
      {(topicPerformance.length > 0 || difficultyPerformance.length > 0) && (
        <div className="rv-two-col">
          {topicPerformance.length > 0 && (
            <section className="rv-card">
              <div className="rv-card-head">
                <Target size={18} />
                <h2>Topic-wise Performance</h2>
              </div>
              <div className="rv-metric-list">
                {topicPerformance.map((t) => {
                  const acc = Number(t.accuracy || 0);
                  return (
                    <div className="rv-metric-row" key={t.topicName}>
                      <div className="rv-metric-top">
                        <div>
                          <strong>{t.topicName}</strong>
                          <span className="rv-metric-meta">
                            {t.correct}✓ · {t.wrong}✗ · {t.unattempted} skipped · avg {t.avgTimeSeconds}s/Q
                          </span>
                        </div>
                        <div className="rv-metric-score">
                          <b>
                            {fmtNum(t.score)} / {fmtNum(t.maxScore)}
                          </b>
                          <span>{acc.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="rv-bar-track">
                        <div
                          className="rv-bar-fill"
                          style={{ width: `${Math.min(100, Math.max(0, acc))}%`, background: getBarColor(acc) }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {difficultyPerformance.length > 0 && (
            <section className="rv-card">
              <div className="rv-card-head">
                <Gauge size={18} />
                <h2>Difficulty-wise Performance</h2>
              </div>
              <div className="rv-metric-list">
                {difficultyPerformance.map((d) => {
                  const acc = Number(d.accuracy || 0);
                  return (
                    <div className="rv-metric-row" key={d.difficulty}>
                      <div className="rv-metric-top">
                        <div className="rv-diff-label-wrap">
                          <span className={`rv-diff-pill diff-${d.difficulty}`}>{d.difficulty}</span>
                          <span className="rv-metric-meta">
                            {d.correct}✓ · {d.wrong}✗ · {d.unattempted} skipped ({d.total} Qs)
                          </span>
                        </div>
                        <div className="rv-metric-score">
                          <b>
                            {fmtNum(d.score)} / {fmtNum(d.maxScore)}
                          </b>
                          <span>{acc.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="rv-bar-track">
                        <div
                          className="rv-bar-fill"
                          style={{ width: `${Math.min(100, Math.max(0, acc))}%`, background: getBarColor(acc) }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Strengths & Weaknesses */}
      {sw?.hasSufficientData && (sw.strengths?.length > 0 || sw.weaknesses?.length > 0) && (
        <section className="rv-card">
          <div className="rv-card-head">
            <Sparkles size={18} />
            <h2>Topic-wise Strengths &amp; Focus Areas</h2>
          </div>
          <div className="rv-sw-grid">
            <div className="rv-sw-box strength">
              <h3>
                <TrendingUp size={15} /> Strengths (≥ 75% accuracy)
              </h3>
              {sw.strengths?.length ? (
                sw.strengths.map((item) => (
                  <div className="rv-sw-row" key={item.topicName}>
                    <span>
                      {item.topicName} ({item.correct}/{item.attempted})
                    </span>
                    <b>{item.accuracy}%</b>
                  </div>
                ))
              ) : (
                <p className="rv-sw-empty">Complete more attempts to unlock strong topics.</p>
              )}
            </div>
            <div className="rv-sw-box weakness">
              <h3>
                <TrendingDown size={15} /> Needs Improvement (&lt; 60% accuracy)
              </h3>
              {sw.weaknesses?.length ? (
                sw.weaknesses.map((item) => (
                  <div className="rv-sw-row" key={item.topicName}>
                    <span>
                      {item.topicName} ({item.correct}/{item.attempted})
                    </span>
                    <b>{item.accuracy}%</b>
                  </div>
                ))
              ) : (
                <p className="rv-sw-empty">No weak topics flagged yet—keep going!</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Detailed Question Review */}
      {result.review?.length > 0 && (
        <section className="rv-card">
          <div className="rv-card-head">
            <CheckCircle2 size={18} />
            <h2>Question Review &amp; Explanations</h2>
          </div>
          <div className="rv-review-list">
            {result.review.map((q, i) => {
              const isUnanswered = !q.selected_answer;
              const isCorrect =
                !isUnanswered &&
                q.question_type !== "descriptive" &&
                String(q.selected_answer) === String(q.correct_answer);
              const badgeState = isUnanswered ? "skipped" : isCorrect ? "correct" : "wrong";
              const badgeLabel = isUnanswered ? "Unattempted" : isCorrect ? "Correct" : "Incorrect";

              return (
                <article className={`rv-review-card state-${badgeState}`} key={q.id}>
                  <div className="rv-review-meta">
                    <div className="rv-review-tags">
                      <span className="rv-q-num">Q{i + 1}</span>
                      <span className="rv-tag">{q.topic_name}</span>
                      <span className={`rv-diff-pill diff-${String(q.difficulty || "medium").toLowerCase()}`}>
                        {q.difficulty}
                      </span>
                    </div>
                    <div className="rv-review-right">
                      <span className={`rv-outcome-pill ${badgeState}`}>{badgeLabel}</span>
                      <span className="rv-time-pill">
                        <Clock3 size={12} /> {q.time_spent_seconds || 0}s
                      </span>
                    </div>
                  </div>

                  <PassageBlock
                    title={q.passage_title}
                    text={q.passage_text}
                    language={q.passage_language}
                    imageUrl={q.passage_image_url}
                  />
                  <div className="rv-review-question">
                    <FormattedQuestionText text={q.question_text} />
                  </div>
                  {q.image_url && (
                    <img
                      className="question-illustration"
                      src={q.image_url}
                      alt="Question illustration"
                      loading="lazy"
                    />
                  )}

                  {q.question_type === "descriptive" ? (
                    <div className="descriptive-result">
                      <strong>Your submitted response</strong>
                      <pre>{q.selected_answer ?? "No response"}</pre>
                      {q.manual_score === null ? (
                        <span>Awaiting evaluator review · {q.max_marks ?? ""} marks</span>
                      ) : (
                        <>
                          <b>Score: {q.manual_score} marks</b>
                          {q.grader_comment && <p>{q.grader_comment}</p>}
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="rv-answer-strip">
                        <span>
                          Your answer:{" "}
                          <b className={`rv-ans-${badgeState}`}>{q.selected_answer ?? "Not attempted"}</b>
                        </span>
                        <span>
                          Correct answer: <b className="rv-ans-correct">{q.correct_answer}</b>
                        </span>
                      </div>
                      <div className="rv-explanation-box">
                        <strong>Explanation</strong>
                        <p>{q.explanation || "No explanation has been added."}</p>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

const DEMO_PREVIEW_RESULT = {
  result: {
    test_name: "IBPS PO Prelims — Set 1",
    status: "submitted",
    score: 14.75,
    max_score: 20,
    correct_count: 15,
    wrong_count: 1,
    unanswered_count: 4,
    pending_review_count: 0,
    elapsed_seconds: 812,
  },
  sections: [
    {
      section_id: 1,
      section_name: "Quantitative Aptitude",
      correct_count: 8,
      wrong_count: 1,
      attempted_count: 9,
      score: 7.75,
      accuracy: 88.9,
    },
    {
      section_id: 2,
      section_name: "Reasoning Ability",
      correct_count: 7,
      wrong_count: 0,
      attempted_count: 7,
      score: 7,
      accuracy: 100,
    },
  ],
  topicPerformance: [
    {
      topicName: "Seating Arrangement",
      correct: 5,
      wrong: 0,
      unattempted: 0,
      avgTimeSeconds: 42,
      score: 5,
      maxScore: 5,
      accuracy: 100,
    },
    {
      topicName: "Blood Relations",
      correct: 2,
      wrong: 0,
      unattempted: 1,
      avgTimeSeconds: 38,
      score: 2,
      maxScore: 3,
      accuracy: 100,
    },
    {
      topicName: "Boats & Streams",
      correct: 4,
      wrong: 1,
      unattempted: 1,
      avgTimeSeconds: 49,
      score: 3.75,
      maxScore: 6,
      accuracy: 80,
    },
    {
      topicName: "Percentage",
      correct: 4,
      wrong: 0,
      unattempted: 2,
      avgTimeSeconds: 44,
      score: 4,
      maxScore: 6,
      accuracy: 100,
    },
  ],
  difficultyPerformance: [
    { difficulty: "easy", correct: 6, wrong: 0, unattempted: 0, total: 6, score: 6, maxScore: 6, accuracy: 100 },
    {
      difficulty: "medium",
      correct: 7,
      wrong: 1,
      unattempted: 2,
      total: 10,
      score: 6.75,
      maxScore: 10,
      accuracy: 87.5,
    },
    { difficulty: "hard", correct: 2, wrong: 0, unattempted: 2, total: 4, score: 2, maxScore: 4, accuracy: 100 },
  ],
  strengthsWeaknesses: {
    hasSufficientData: true,
    strengths: [
      { topicName: "Seating Arrangement", correct: 5, attempted: 5, accuracy: 100 },
      { topicName: "Percentage", correct: 4, attempted: 4, accuracy: 100 },
    ],
    weaknesses: [{ topicName: "Time, Speed & Distance", correct: 2, attempted: 5, accuracy: 40 }],
  },
  review: [
    {
      id: "q1",
      topic_name: "Seating Arrangement",
      difficulty: "medium",
      question_type: "mcq",
      question_text:
        "Directions: Six persons — A, B, C, D, E, F — are sitting around a triangular table such that three sit at the corners facing the centre and three sit at the middle of the sides facing outside. 1. F sits at one of the three corners. 2. B sits second to the right of D. 3. C sits second to the right of B. Question: Who sits immediately to the right of B?",
      selected_answer: "A",
      correct_answer: "A",
      time_spent_seconds: 46,
      explanation:
        "From the unique triangular arrangement, B faces outside so moving 1 seat clockwise (right) leads to A.",
    },
    {
      id: "q2",
      topic_name: "Boats & Streams",
      difficulty: "easy",
      question_type: "mcq",
      question_text:
        "A boat travels downstream at 18 km/h and upstream at 8 km/h. Find the speed of the boat in still water.",
      selected_answer: "B",
      correct_answer: "A",
      time_spent_seconds: 34,
      explanation: "Speed in still water = (Downstream + Upstream) / 2 = (18 + 8) / 2 = 13 km/h (Option A).",
    },
  ],
};

export default function App() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <ResultView result={DEMO_PREVIEW_RESULT} onBack={() => {}} />
    </div>
  );
}

export { ResultView };