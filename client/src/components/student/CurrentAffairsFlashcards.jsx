import { useCallback, useEffect, useState } from "react";
import { Bookmark, Clock, Layers, RefreshCw } from "lucide-react";
import { studentFlashcardsApi } from "../../api/currentAffairsRevision";
import { FlashcardDeck } from "./FlashcardDeck";

export function CurrentAffairsFlashcards() {
  const [progress, setProgress] = useState(null);
  const [decks, setDecks] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [progRes, decksRes] = await Promise.all([
        studentFlashcardsApi.getProgress(),
        studentFlashcardsApi.listDecks(),
      ]);
      setProgress(progRes.progress ?? null);
      setDecks(decksRes.decks ?? []);
    } catch (err) {
      setError(err.message || "Failed to load flashcards.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  async function openDeck(deck) {
    setLoading(true);
    try {
      const res = await studentFlashcardsApi.getDeck(deck.id);
      setActiveSession({ title: deck.deck_name, cards: res.cards ?? [] });
    } catch (err) {
      setError(err.message || "Failed to open deck.");
    } finally {
      setLoading(false);
    }
  }

  async function openQueue(mode, label) {
    setLoading(true);
    try {
      const res = await studentFlashcardsApi.getDueQueue(mode);
      setActiveSession({ title: label, cards: res.cards ?? [] });
    } catch (err) {
      setError(err.message || "Failed to load review queue.");
    } finally {
      setLoading(false);
    }
  }

  if (activeSession) {
    return (
      <FlashcardDeck
        title={activeSession.title}
        cards={activeSession.cards}
        onExit={() => {
          setActiveSession(null);
          void loadHub();
        }}
        onProgressUpdated={() => void loadHub()}
      />
    );
  }

  return (
    <div>
      <div className="student-welcome ca-header-bar">
        <div>
          <div className="eyebrow">ACTIVE RECALL</div>
          <h1>Flashcards &amp; Spaced Repetition</h1>
          <p>Review banking terms, RBI updates, and exam facts with deterministic spaced repetition.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="primary-btn" onClick={() => void openQueue("due", "Due Today Queue")}>
            <Clock size={14} /> Due Today ({progress?.dueToday ?? 0})
          </button>
          <button type="button" className="outline-btn" onClick={() => void openQueue("difficult", "Difficult Cards")}>
            Needs Revision ({progress?.needsRevision ?? 0})
          </button>
          <button type="button" className="outline-btn" onClick={() => void openQueue("bookmarked", "Bookmarked Cards")}>
            <Bookmark size={14} /> Saved ({progress?.bookmarked ?? 0})
          </button>
        </div>
      </div>

      {progress && (
        <div className="ca-stats-grid">
          <div className="ca-stat-card"><div className="ca-stat-label">Total Cards</div><div className="ca-stat-value">{progress.totalCards}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Studied</div><div className="ca-stat-value">{progress.studied}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Known</div><div className="ca-stat-value">{progress.known}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Due Today</div><div className="ca-stat-value">{progress.dueToday}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Reviewed Today</div><div className="ca-stat-value">{progress.reviewedToday}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Completion</div><div className="ca-stat-value">{progress.completionPercent}%</div></div>
        </div>
      )}

      {error && (
        <div className="ca-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" className="outline-btn" onClick={() => void loadHub()}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="ca-state-box">Loading flashcard decks…</div>
      ) : decks.length === 0 ? (
        <div className="ca-state-box">No published flashcard decks available yet.</div>
      ) : (
        <div className="ba-card-grid">
          {decks.map((d) => (
            <article className="panel affair-card" key={d.id}>
              <div className="affair-card-top">
                <span className="exam-pill"><Layers size={12} /> {d.deck_type}</span>
                <span className="ca-badge ca-badge--important">{d.difficulty}</span>
              </div>
              <h2>{d.deck_name}</h2>
              {d.description && <p>{d.description}</p>}
              <div className="ba-card-footer">
                <span>{d.card_count} card(s) · {d.known_count} known · {d.due_count} due</span>
                <button type="button" className="primary-btn" onClick={() => void openDeck(d)}>
                  Study Deck
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
