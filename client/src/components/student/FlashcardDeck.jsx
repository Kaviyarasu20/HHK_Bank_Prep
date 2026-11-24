import { useCallback, useEffect, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Eye, RotateCcw } from "lucide-react";
import { studentFlashcardsApi } from "../../api/currentAffairsRevision";
import { getSafeExternalUrl } from "../../utils/safeUrl";

/**
 * Interactive Active-Recall Flashcard Deck Component.
 * Keyboard support:
 * - Space / Enter: reveal answer (never advances card accidentally)
 * - ArrowRight: next card
 * - ArrowLeft: previous card
 */
export function FlashcardDeck({ title, cards = [], onExit, onProgressUpdated }) {
  const [deckCards, setDeckCards] = useState(cards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    setDeckCards(cards);
    setIndex(0);
    setRevealed(false);
  }, [cards]);

  const card = deckCards[index] || null;

  const goNext = useCallback(() => {
    setRevealed(false);
    setStatusMsg("");
    setIndex((i) => Math.min(deckCards.length - 1, i + 1));
  }, [deckCards.length]);

  const goPrev = useCallback(() => {
    setRevealed(false);
    setStatusMsg("");
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        setRevealed((r) => !r);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev]);

  async function handleResponse(response) {
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      const out = await studentFlashcardsApi.submitReview(card.id, response);
      setStatusMsg(`Scheduled next review in ${out.schedule.nextIntervalDays} day(s).`);
      onProgressUpdated?.();
      if (index + 1 < deckCards.length) {
        setTimeout(() => goNext(), 250);
      }
    } catch (err) {
      setStatusMsg(err.message || "Failed to save review.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleBookmark() {
    if (!card) return;
    const nextVal = !card.is_bookmarked;
    try {
      await studentFlashcardsApi.setBookmark(card.id, nextVal);
      setDeckCards((prev) =>
        prev.map((c, i) => (i === index ? { ...c, is_bookmarked: nextVal } : c)),
      );
      onProgressUpdated?.();
    } catch {
      // Ignore transient UI error
    }
  }

  if (!card) {
    return (
      <div className="ca-state-box">
        No flashcards available in this deck.
        {onExit && (
          <div style={{ marginTop: 10 }}>
            <button type="button" className="outline-btn" onClick={onExit}>Back to Decks</button>
          </div>
        )}
      </div>
    );
  }

  const safeUrl = getSafeExternalUrl(card.source_url);

  return (
    <section className="panel admin-panel" aria-label="Interactive flashcard deck">
      <div className="ca-admin-article-header" style={{ marginBottom: 14 }}>
        <div>
          <button type="button" className="outline-btn" onClick={onExit} style={{ marginBottom: 8 }}>
            <ChevronLeft size={14} /> Back to Decks
          </button>
          <h2 style={{ margin: 0 }}>{title || "Flashcard Deck"}</h2>
          <small style={{ color: "#64748b" }}>
            Card {index + 1} of {deckCards.length} · Space/Enter to reveal · Arrow keys to navigate
          </small>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={card.is_bookmarked ? "primary-btn" : "outline-btn"}
            onClick={() => void handleToggleBookmark()}
            aria-label="Bookmark flashcard"
          >
            <Bookmark size={14} /> {card.is_bookmarked ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            className="outline-btn"
            onClick={() => { setIndex(0); setRevealed(false); setStatusMsg(""); }}
          >
            <RotateCcw size={14} /> Restart
          </button>
        </div>
      </div>

      {/* Interactive Card Surface */}
      <div
        role="button"
        tabIndex={0}
        aria-label={revealed ? "Flashcard answer revealed" : "Tap or press Space to reveal answer"}
        onClick={() => setRevealed((r) => !r)}
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          padding: "28px 24px",
          background: revealed ? "#f8fafc" : "#ffffff",
          cursor: "pointer",
          minHeight: 190,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div className="ca-admin-meta" style={{ marginBottom: 10 }}>
          <span className="exam-pill">{card.topic || card.category || "Banking Awareness"}</span>
          <span className="ca-badge ca-badge--important">{card.difficulty}</span>
          {card.effective_date && <span>Effective: {String(card.effective_date).slice(0, 10)}</span>}
        </div>

        <h3 style={{ fontSize: 19, margin: "6px 0 12px", color: "#0f172a" }}>{card.front_text}</h3>

        {revealed ? (
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14, marginTop: 6 }}>
            <div style={{ fontSize: 16.5, fontWeight: 700, color: "#166534" }}>{card.back_text}</div>
            {card.explanation && (
              <p style={{ fontSize: 13.5, color: "#475569", marginTop: 8 }}>{card.explanation}</p>
            )}
            {safeUrl && (
              <p style={{ fontSize: 12.5, marginTop: 8 }}>
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Official Source ↗
                </a>
              </p>
            )}
          </div>
        ) : (
          <div style={{ color: "#1d4ed8", fontSize: 13.5, fontWeight: 600, marginTop: 8 }}>
            <Eye size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
            Click card or press Space to reveal answer
          </div>
        )}
      </div>

      {statusMsg && (
        <div className="auth-notice" role="status" style={{ marginTop: 10 }}>
          {statusMsg}
        </div>
      )}

      {/* Spaced-Repetition Response Controls (only active once answer is revealed) */}
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        <button type="button" className="outline-btn" disabled={index === 0} onClick={goPrev}>
          <ChevronLeft size={14} /> Previous
        </button>

        {!revealed ? (
          <button type="button" className="primary-btn" onClick={() => setRevealed(true)}>
            <Eye size={14} /> Reveal Answer
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="outline-btn" disabled={submitting} onClick={() => void handleResponse("again")}>
              Again (Need Revision)
            </button>
            <button type="button" className="outline-btn" disabled={submitting} onClick={() => void handleResponse("hard")}>
              Hard (1d)
            </button>
            <button type="button" className="primary-btn" disabled={submitting} onClick={() => void handleResponse("good")}>
              I Know This (3d)
            </button>
            <button type="button" className="primary-btn" disabled={submitting} onClick={() => void handleResponse("easy")}>
              Easy (7d)
            </button>
          </div>
        )}

        <button type="button" className="outline-btn" disabled={index + 1 >= deckCards.length} onClick={goNext}>
          Next <ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}
