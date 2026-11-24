// Place at: client/src/components/student/FormattedQuestionText.jsx
const STRAY_MATH_PREFIX =
  /^What value will come in place of the question mark \(\?\) in the following question\?\s*/i;

export function FormattedQuestionText({ text = "" }) {
  const cleaned = String(text || "").trim();
  const withoutPrefix = cleaned.replace(STRAY_MATH_PREFIX, "");
  const isMathQuestionMarkExpr = /[=+\-×÷*/(]\s*\?|\?\s*[=+\-×÷*/)]/.test(withoutPrefix);
  const display = isMathQuestionMarkExpr ? cleaned : withoutPrefix;

  // Detect structured Directions + Question layout (Seating Arrangement / Puzzles)
  if (/^Directions:/i.test(display) && /Question:/i.test(display)) {
    const [dirBlock, ...qParts] = display.split(/\n*\s*Question:\s*/i);
    const questionPrompt = qParts.join("Question: ").trim();
    const rawDir = dirBlock.replace(/^Directions:\s*/i, "").trim();

    // Split intro sentence from numbered clues (1. ... 2. ... 3. ...)
    const clueSplit = rawDir.split(/\s*(?=\b\d+\.\s+)/);
    const intro = clueSplit[0]?.trim() || "";
    const clues = clueSplit.slice(1).map((c) => c.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);

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

  // Standard or multi-line questions (Simplification, Coded Blood Relations, etc.)
  return <h2 className="cbt-question-text">{display}</h2>;
}