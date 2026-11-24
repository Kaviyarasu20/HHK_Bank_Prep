import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Cpu, FolderPlus, RefreshCw, XCircle } from "lucide-react";
import { adminCaApi } from "../../api/currentAffairs";
import { adminFlashcardsApi } from "../../api/currentAffairsRevision";
import { Field } from "../common/Field";

export function CurrentAffairsFlashcardAdmin({ onToast }) {
  const [stats, setStats] = useState(null);
  const [decks, setDecks] = useState([]);
  const [cards, setCards] = useState([]);
  const [articles, setArticles] = useState([]);

  const [deckName, setDeckName] = useState("");
  const [deckType, setDeckType] = useState("topic");
  const [articleId, setArticleId] = useState("");
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, dRes, cRes, aRes] = await Promise.all([
        adminFlashcardsApi.getStatistics(),
        adminFlashcardsApi.listDecks(),
        adminFlashcardsApi.listCards({ limit: 50 }),
        adminCaApi.listArticles({ limit: 25, page: 1 }),
      ]);
      setStats(sRes.stats ?? null);
      setDecks(dRes.decks ?? []);
      setCards(cRes.cards ?? []);
      setArticles(aRes.items ?? []);
      if (!articleId && aRes.items?.[0]?.id) setArticleId(aRes.items[0].id);
      if (!selectedDeckId && dRes.decks?.[0]?.id) setSelectedDeckId(dRes.decks[0].id);
    } catch (err) {
      onToast?.(err.message || "Failed to load Flashcard Admin.", "error");
    } finally {
      setLoading(false);
    }
  }, [articleId, selectedDeckId, onToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleCreateDeck(e) {
    e.preventDefault();
    if (deckName.trim().length < 3) return;
    setBusy(true);
    try {
      await adminFlashcardsApi.createDeck({ deckName: deckName.trim(), deckType });
      setDeckName("");
      onToast?.("Flashcard deck created as draft.", "success");
      await loadAll();
    } catch (err) {
      onToast?.(err.message || "Failed to create deck.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishDeck(d) {
    try {
      await adminFlashcardsApi.updateDeck(d.id, {
        deckName: d.deck_name,
        description: d.description || "",
        deckType: d.deck_type,
        category: d.category || "",
        topic: d.topic || "",
        examCode: d.exam_code || "",
        difficulty: d.difficulty || "moderate",
        publicationStatus: "published",
      });
      onToast?.(`Deck "${d.deck_name}" published.`, "success");
      await loadAll();
    } catch (err) {
      onToast?.(err.message || "Cannot publish deck.", "error");
    }
  }

  async function handleGenerateCards() {
    if (!articleId || busy) return;
    setBusy(true);
    try {
      const out = await adminFlashcardsApi.generate({
        articleId,
        deckId: selectedDeckId || undefined,
        cardType: "direct_fact",
        maxCards: 4,
      });
      onToast?.(`Generated ${out.cards?.length ?? 0} draft flashcard(s).`, "success");
      await loadAll();
    } catch (err) {
      onToast?.(err.message || "Flashcard generation failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {stats && (
        <div className="ca-stats-grid">
          <div className="ca-stat-card"><div className="ca-stat-label">Total Decks</div><div className="ca-stat-value">{stats.totalDecks}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Total Cards</div><div className="ca-stat-value">{stats.totalCards}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Pending Cards</div><div className="ca-stat-value">{stats.pendingCards}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Approved</div><div className="ca-stat-value">{stats.approvedCards}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Rejected</div><div className="ca-stat-value">{stats.rejectedCards}</div></div>
          <div className="ca-stat-card"><div className="ca-stat-label">Duplicates</div><div className="ca-stat-value">{stats.duplicates}</div></div>
        </div>
      )}

      <section className="panel admin-panel">
        <form onSubmit={handleCreateDeck} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Field label="New Flashcard Deck Name" value={deckName} onChange={setDeckName} />
          </div>
          <label className="form-field" style={{ margin: 0 }}>
            Deck Type
            <select value={deckType} onChange={(e) => setDeckType(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="topic">Topic-Wise</option>
              <option value="exam">Exam-Wise</option>
              <option value="must_study">Must Study</option>
            </select>
          </label>
          <button type="submit" className="primary-btn" disabled={busy || deckName.trim().length < 3}>
            <FolderPlus size={14} /> Create Deck
          </button>
        </form>

        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={articleId} onChange={(e) => setArticleId(e.target.value)} style={{ maxWidth: 300 }}>
            {articles.map((a) => <option key={a.id} value={a.id}>{a.title.slice(0, 65)}</option>)}
          </select>
          <select value={selectedDeckId} onChange={(e) => setSelectedDeckId(e.target.value)}>
            <option value="">No deck (unassigned)</option>
            {decks.map((d) => <option key={d.id} value={d.id}>{d.deck_name}</option>)}
          </select>
          <button type="button" className="primary-btn" disabled={busy || !articleId} onClick={() => void handleGenerateCards()}>
            <Cpu size={14} /> Generate Cards
          </button>
          <button type="button" className="outline-btn" onClick={() => void loadAll()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </section>

      <section className="panel admin-panel">
        <h2>Decks ({decks.length})</h2>
        {decks.map((d) => (
          <div className="ba-mini-row" key={d.id}>
            <div>
              <strong>{d.deck_name}</strong> ({d.deck_type}) · {d.published_cards}/{d.total_cards} published cards
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className={`ca-badge ca-badge--${d.publication_status}`}>{d.publication_status}</span>
              {d.publication_status !== "published" && (
                <button type="button" className="outline-btn" onClick={() => void handlePublishDeck(d)}>
                  Publish Deck
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="panel admin-panel">
        <h2>Flashcards ({cards.length})</h2>
        {loading ? (
          <div className="ca-state-box">Loading flashcards…</div>
        ) : cards.length === 0 ? (
          <div className="ca-state-box">No flashcards yet.</div>
        ) : (
          cards.map((c) => (
            <div className="ca-admin-article" key={c.id}>
              <div className="ca-admin-article-header">
                <div>
                  <div className="ca-admin-meta">
                    <span className={`ca-badge ca-badge--${c.publication_status === "published" ? "published" : "draft"}`}>
                      {c.publication_status}
                    </span>
                    <span>{c.card_type}</span>
                    {c.deck_name && <span>· Deck: {c.deck_name}</span>}
                  </div>
                  <strong>Q: {c.front_text}</strong>
                  <div style={{ fontSize: 13.5, color: "#166534", marginTop: 4 }}>A: {c.back_text}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {c.publication_status !== "published" && (
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={async () => {
                        try {
                          await adminFlashcardsApi.approveCard(c.id);
                          onToast?.("Flashcard approved.", "success");
                          await loadAll();
                        } catch (err) {
                          onToast?.(err.message, "error");
                        }
                      }}
                    >
                      <CheckCircle2 size={13} /> Approve
                    </button>
                  )}
                  {c.publication_status !== "rejected" && (
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={async () => {
                        await adminFlashcardsApi.rejectCard(c.id);
                        onToast?.("Flashcard rejected.", "success");
                        await loadAll();
                      }}
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
