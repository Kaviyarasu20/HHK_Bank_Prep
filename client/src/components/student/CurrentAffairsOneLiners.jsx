import { useCallback, useEffect, useState } from "react";
import { Bookmark, CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, RotateCcw } from "lucide-react";
import { studentOneLinersApi } from "../../api/currentAffairsRevision";
import { getSafeExternalUrl } from "../../utils/safeUrl";

const EXAM_OPTIONS = [
  "", "IBPS PO", "IBPS Clerk", "SBI PO", "SBI Clerk",
  "IBPS RRB PO", "IBPS RRB Office Assistant", "RBI Grade B", "NABARD Grade A",
];

export function CurrentAffairsOneLiners() {
  const [items, setItems] = useState([]);
  const [topics, setTopics] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });

  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  const [category, setCategory] = useState("");
  const [exam, setExam] = useState("");
  const [priority, setPriority] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    studentOneLinersApi
      .getTopics()
      .then((res) => setTopics(res.topics ?? []))
      .catch(() => {});
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await studentOneLinersApi.list({
        q,
        month,
        category,
        exam,
        priority,
        reviewStatus,
        bookmarked: bookmarkedOnly ? "true" : "",
        page,
        limit: 20,
      });
      setItems(res.items ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (err) {
      setError(err.message || "Failed to load one-liner digest.");
    } finally {
      setLoading(false);
    }
  }, [q, month, category, exam, priority, reviewStatus, bookmarkedOnly, page]);

  useEffect(() => {
    const t = setTimeout(() => void loadList(), q ? 200 : 0);
    return () => clearTimeout(t);
  }, [loadList, q]);

  async function handleReview(id, nextStatus) {
    try {
      const out = await studentOneLinersApi.setReviewStatus(id, nextStatus);
      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, review_status: out.review_status } : x)),
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBookmark(id, nextVal) {
    try {
      const out = await studentOneLinersApi.setBookmark(id, nextVal);
      setItems((prev) => {
        const mapped = prev.map((x) => (x.id === id ? { ...x, is_bookmarked: out.is_bookmarked } : x));
        return bookmarkedOnly ? mapped.filter((x) => x.is_bookmarked) : mapped;
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="student-welcome ca-header-bar">
        <div>
          <div className="eyebrow">RAPID REVISION</div>
          <h1>One-Liner Digest</h1>
          <p>Concise, verified banking &amp; current affairs facts organized for fast exam revision.</p>
        </div>
      </div>

      <div className="ca-admin-filters">
        <label className="form-field" style={{ margin: 0 }}>
          Search
          <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search RBI, schemes, appointments…" />
        </label>
        <label className="form-field" style={{ margin: 0 }}>
          Month
          <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} />
        </label>
        <label className="form-field" style={{ margin: 0 }}>
          Category
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {topics.map((t) => (
              <option key={t.category_name} value={t.category_name}>
                {t.category_name} ({t.fact_count})
              </option>
            ))}
          </select>
        </label>
        <label className="form-field" style={{ margin: 0 }}>
          Exam
          <select value={exam} onChange={(e) => { setExam(e.target.value); setPage(1); }}>
            {EXAM_OPTIONS.map((ex) => <option key={ex || "all"} value={ex}>{ex || "All exams"}</option>)}
          </select>
        </label>
        <label className="form-field" style={{ margin: 0 }}>
          Priority
          <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
            <option value="">All priorities</option>
            <option value="must_study">Must Study</option>
            <option value="important">Important</option>
            <option value="additional">Additional</option>
          </select>
        </label>
        <label className="form-field" style={{ margin: 0 }}>
          Revision Status
          <select value={reviewStatus} onChange={(e) => { setReviewStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="not_started">Unrevised</option>
            <option value="needs_revision">Needs Revision</option>
            <option value="revised">Revised</option>
          </select>
        </label>
        <button
          type="button"
          className={bookmarkedOnly ? "primary-btn" : "outline-btn"}
          onClick={() => { setBookmarkedOnly((v) => !v); setPage(1); }}
        >
          <Bookmark size={14} /> Saved
        </button>
      </div>

      {error && (
        <div className="ca-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" className="outline-btn" onClick={() => void loadList()}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="ca-state-box">Loading verified one-liners…</div>
      ) : items.length === 0 ? (
        <div className="ca-state-box">No published one-liners match your current filter.</div>
      ) : (
        items.map((item) => {
          const safeUrl = getSafeExternalUrl(item.source_url);
          return (
            <article className="panel affair-card" key={item.id}>
              <div className="affair-card-top">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="exam-pill">{item.category_name}</span>
                  <span className={`ca-badge ca-badge--${item.study_priority}`}>
                    {(item.study_priority || "important").replace("_", " ")}
                  </span>
                  {item.effective_date && (
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      Effective: {String(item.effective_date).slice(0, 10)}
                    </span>
                  )}
                </div>
                <div className="affair-card-actions">
                  <button
                    type="button"
                    className={item.review_status === "revised" ? "primary-btn" : "outline-btn"}
                    style={{ padding: "4px 9px", fontSize: 12 }}
                    onClick={() =>
                      void handleReview(
                        item.id,
                        item.review_status === "revised" ? "not_started" : "revised",
                      )
                    }
                  >
                    <CheckCircle2 size={13} /> {item.review_status === "revised" ? "Revised" : "Mark Revised"}
                  </button>
                  <button
                    type="button"
                    className={item.review_status === "needs_revision" ? "primary-btn" : "outline-btn"}
                    style={{ padding: "4px 9px", fontSize: 12 }}
                    onClick={() => void handleReview(item.id, "needs_revision")}
                  >
                    <RotateCcw size={13} /> Revisit
                  </button>
                  <button
                    type="button"
                    className={item.is_bookmarked ? "primary-btn" : "outline-btn"}
                    style={{ padding: "4px 9px", fontSize: 12 }}
                    onClick={() => void handleBookmark(item.id, !item.is_bookmarked)}
                  >
                    <Bookmark size={13} /> {item.is_bookmarked ? "Saved" : "Save"}
                  </button>
                </div>
              </div>

              <p style={{ marginTop: 10, fontSize: 15, color: "#0f172a", fontWeight: 600 }}>
                {item.fact_text}
              </p>
              {item.context && <p style={{ fontSize: 13.5, marginTop: 4 }}>{item.context}</p>}

              <div className="ba-card-footer">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(Array.isArray(item.exam_tags) ? item.exam_tags : []).map((ex) => (
                    <span className="ca-badge ca-badge--important" key={ex}>{ex}</span>
                  ))}
                </div>
                {safeUrl && (
                  <a href={safeUrl} target="_blank" rel="noopener noreferrer">
                    Official Source ↗
                  </a>
                )}
              </div>
            </article>
          );
        })
      )}

      {pagination.totalPages > 1 && (
        <div className="ca-pagination">
          <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} facts)</span>
          <div className="ca-pagination-actions">
            <button type="button" className="outline-btn" disabled={!pagination.hasPreviousPage} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft size={14} /> Previous
            </button>
            <button type="button" className="outline-btn" disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
