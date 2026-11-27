import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  HelpCircle,
  Landmark,
  Layers,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  X,
} from "lucide-react";

const CATEGORY_FILTERS = [
  { id: "ALL", label: "All Examinations" },
  { id: "IBPS", label: "IBPS" },
  { id: "SBI", label: "SBI" },
  { id: "RBI", label: "RBI" },
  { id: "RRB", label: "Regional Rural Banks" },
  { id: "OTHER", label: "Other Banks & Institutions" },
];

const FEATURED_PRIORITY = [
  "IBPS PO",
  "SBI PO",
  "IBPS RRB PO",
  "RBI Grade B",
  "SBI Clerk",
  "IBPS CSA (Clerk)",
];

function isRrbExam(exam) {
  const hay = `${exam?.name || ""} ${exam?.code || ""} ${exam?.description || ""}`.toLowerCase();
  return hay.includes("rrb") || hay.includes("regional rural");
}

function matchesCategoryFilter(exam, filterId) {
  if (filterId === "ALL") return true;
  const cat = String(exam?.category || "").toUpperCase();
  const name = String(exam?.name || "").toUpperCase();
  if (filterId === "RRB") return isRrbExam(exam);
  if (filterId === "IBPS") return cat === "IBPS" || name.includes("IBPS");
  if (filterId === "SBI") return cat === "SBI" || name.includes("SBI");
  if (filterId === "RBI") return cat === "RBI" || name.includes("RBI");
  if (filterId === "OTHER") {
    const isMajor =
      cat === "IBPS" ||
      cat === "SBI" ||
      cat === "RBI" ||
      name.includes("IBPS") ||
      name.includes("SBI") ||
      name.includes("RBI");
    return !isMajor;
  }
  return true;
}

function getOrgMeta(exam) {
  if (isRrbExam(exam)) {
    return { label: "Regional Rural Banks", tone: "rrb", Icon: Building2 };
  }
  const cat = String(exam?.category || "").trim();
  const upper = cat.toUpperCase();
  if (upper === "IBPS") return { label: "IBPS", tone: "ibps", Icon: Landmark };
  if (upper === "SBI") return { label: "SBI", tone: "sbi", Icon: Shield };
  if (upper === "RBI") return { label: "RBI", tone: "rbi", Icon: Award };
  if (upper === "NABARD") return { label: "NABARD", tone: "other", Icon: BookOpen };
  return {
    label: cat || "Other Institutions",
    tone: "other",
    Icon: BookOpen,
  };
}

function formatDuration(seconds) {
  const mins = Math.round(Number(seconds || 0) / 60);
  if (mins <= 0) return null;
  if (mins < 60) return `${mins} mins`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${mins} mins`;
}

function computeStageStats(stage) {
  const sections = Array.isArray(stage?.sections) ? stage.sections : [];
  const totalQuestions = sections.reduce((sum, s) => sum + Number(s.question_count || 0), 0);
  const totalMarks = sections.reduce(
    (sum, s) => sum + Number(s.question_count || 0) * Number(s.marks_per_correct ?? 0),
    0,
  );
  const negValues = [
    ...new Set(
      sections
        .map((s) => Number(s.negative_marks))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
  return {
    sections,
    totalQuestions,
    totalMarks: Number(totalMarks.toFixed(2)),
    negativeMarks: negValues.length === 1 ? negValues[0] : negValues.length > 1 ? Math.max(...negValues) : 0,
    hasMultipleNeg: negValues.length > 1,
    durationMins: Math.round(Number(stage?.duration_seconds || 0) / 60),
  };
}

function computeExamSummary(exam, testCountMap) {
  const stages = Array.isArray(exam?.stages) ? exam.stages : [];
  const stageStats = stages.map((st) => ({ ...st, stats: computeStageStats(st) }));
  const totalQuestions = stageStats.reduce((sum, s) => sum + s.stats.totalQuestions, 0);
  const totalMarks = stageStats.reduce((sum, s) => sum + s.stats.totalMarks, 0);
  const totalMins = stageStats.reduce((sum, s) => sum + s.stats.durationMins, 0);
  const negSet = new Set();
  for (const s of stageStats) {
    if (s.stats.negativeMarks > 0) negSet.add(s.stats.negativeMarks);
  }
  const primaryNeg = negSet.size ? Math.min(...negSet) : 0;
  const publishedTests =
    Number(exam?.published_test_count ?? testCountMap.get(exam?.id) ?? 0);

  let isRecent = false;
  if (exam?.created_at) {
    const ageDays = (Date.now() - new Date(exam.created_at).getTime()) / (1000 * 60 * 60 * 24);
    isRecent = Number.isFinite(ageDays) && ageDays >= 0 && ageDays <= 30;
  }

  return {
    stages: stageStats,
    totalQuestions,
    totalMarks: Number(totalMarks.toFixed(2)),
    totalMins,
    primaryNeg,
    publishedTests,
    isRecent,
  };
}

export function ExaminationCatalogueView({
  exams = [],
  tests = [],
  loading = false,
  error = "",
  onRetry,
  onNavigateHome,
  onExploreExam,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [visibleLimit, setVisibleLimit] = useState(9);
  const [patternModalExam, setPatternModalExam] = useState(null);

  useEffect(() => {
    setVisibleLimit(9);
  }, [searchQuery, activeCategory]);

  // Close modal on Escape key
  useEffect(() => {
    if (!patternModalExam) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setPatternModalExam(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [patternModalExam]);

  const testCountByExam = useMemo(() => {
    const map = new Map();
    for (const t of tests) {
      if (t.exam_id) {
        map.set(t.exam_id, (map.get(t.exam_id) ?? 0) + 1);
      }
    }
    return map;
  }, [tests]);

  const enrichedExams = useMemo(
    () =>
      exams.map((exam) => ({
        exam,
        org: getOrgMeta(exam),
        summary: computeExamSummary(exam, testCountByExam),
      })),
    [exams, testCountByExam],
  );

  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const f of CATEGORY_FILTERS) {
      counts[f.id] = enrichedExams.filter((item) => matchesCategoryFilter(item.exam, f.id)).length;
    }
    return counts;
  }, [enrichedExams]);

  const filteredExams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedExams.filter(({ exam }) => {
      if (!matchesCategoryFilter(exam, activeCategory)) return false;
      if (!q) return true;
      const stageText = (exam.stages || [])
        .map((st) => `${st.name} ${(st.sections || []).map((s) => s.name).join(" ")}`)
        .join(" ");
      const hay = `${exam.name || ""} ${exam.code || ""} ${exam.category || ""} ${exam.description || ""} ${stageText}`.toLowerCase();
      return hay.includes(q);
    });
  }, [enrichedExams, activeCategory, searchQuery]);

  // Featured popular examinations (derived dynamically from real DB records)
  const featuredExams = useMemo(() => {
    if (activeCategory !== "ALL" || searchQuery.trim() || enrichedExams.length < 4) return [];
    const matched = [];
    for (const targetName of FEATURED_PRIORITY) {
      const found = enrichedExams.find(
        (item) => item.exam.name?.toLowerCase() === targetName.toLowerCase(),
      );
      if (found) matched.push(found);
      if (matched.length === 3) break;
    }
    if (matched.length < 3) {
      for (const item of enrichedExams) {
        if (!matched.some((m) => m.exam.id === item.exam.id)) {
          matched.push(item);
        }
        if (matched.length === 3) break;
      }
    }
    return matched;
  }, [enrichedExams, activeCategory, searchQuery]);

  const hasActiveFilters = activeCategory !== "ALL" || searchQuery.trim().length > 0;
  const visibleExams = filteredExams.slice(0, visibleLimit);
  const hasMore = filteredExams.length > visibleLimit;

  function resetFilters() {
    setSearchQuery("");
    setActiveCategory("ALL");
  }

  return (
    <section className="ec-page">
      {/* 1. PAGE HEADER & SEARCH */}
      <header className="ec-header">
        <nav className="ec-breadcrumb" aria-label="Breadcrumb">
          <button type="button" className="ec-breadcrumb-link" onClick={onNavigateHome}>
            Home
          </button>
          <ChevronRight size={14} className="ec-breadcrumb-sep" />
          <span aria-current="page">Examinations</span>
        </nav>

        <div className="ec-header-row">
          <div className="ec-header-copy">
            <div className="ec-eyebrow">EXAMINATION CATALOGUE</div>
            <div className="ec-title-line">
              <h1>Explore Banking Examinations</h1>
              {!loading && (
                <span className="ec-total-pill">
                  {exams.length} {exams.length === 1 ? "Examination" : "Examinations"}
                </span>
              )}
            </div>
            <p className="ec-subtitle">
              Prepare smarter with structured mock tests designed around actual banking examination patterns.
            </p>
          </div>

          <div className="ec-search-wrap">
            <Search size={17} className="ec-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="ec-search-input"
              aria-label="Search banking examinations"
              placeholder="Search IBPS PO, SBI Clerk, RRB PO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="ec-search-clear"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. CATEGORY FILTERS BAR */}
      <div className="ec-filters-bar">
        <div className="ec-filter-scroll" role="tablist" aria-label="Examination categories">
          {CATEGORY_FILTERS.map((cat) => {
            const count = categoryCounts[cat.id] ?? 0;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`ec-filter-pill ${isActive ? "active" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.label}</span>
                <span className="ec-filter-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="ec-filter-meta">
          <span className="ec-result-count">
            Showing <strong>{filteredExams.length}</strong> of <strong>{exams.length}</strong>{" "}
            {exams.length === 1 ? "examination" : "examinations"}
          </span>
          {hasActiveFilters && (
            <button type="button" className="ec-reset-btn" onClick={resetFilters}>
              <RotateCcw size={13} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* 3. ERROR STATE */}
      {error && (
        <div className="ec-state-card ec-error-card" role="alert">
          <div>
            <strong>Unable to load banking examinations</strong>
            <p>{error}</p>
          </div>
          {onRetry && (
            <button type="button" className="ec-btn-secondary" onClick={onRetry}>
              Try Again
            </button>
          )}
        </div>
      )}

      {/* 4. LOADING SKELETONS */}
      {loading && (
        <div className="ec-grid" aria-busy="true" aria-label="Loading examinations">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="ec-card ec-skeleton-card">
              <div className="ec-skel ec-skel-badge" />
              <div className="ec-skel ec-skel-title" />
              <div className="ec-skel ec-skel-text" />
              <div className="ec-skel ec-skel-box" />
              <div className="ec-skel ec-skel-box" />
              <div className="ec-skel-footer">
                <div className="ec-skel ec-skel-btn" />
                <div className="ec-skel ec-skel-btn" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. FEATURED EXAMINATIONS STRIP (when unfiltered & >= 4 exams) */}
      {!loading && !error && featuredExams.length > 0 && (
        <div className="ec-featured-strip">
          <div className="ec-featured-head">
            <Sparkles size={15} />
            <span>Popular Banking Examinations</span>
          </div>
          <div className="ec-featured-pills">
            {featuredExams.map(({ exam, summary }) => (
              <button
                key={exam.id}
                type="button"
                className="ec-featured-chip"
                onClick={() => onExploreExam?.(exam)}
              >
                <span className="ec-featured-name">{exam.name}</span>
                <span className="ec-featured-meta">
                  {summary.stages.length} {summary.stages.length === 1 ? "Stage" : "Stages"}
                  {summary.totalQuestions > 0 ? ` · ${summary.totalQuestions} Qs` : ""}
                </span>
                <ArrowRight size={13} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 6. EMPTY STATE */}
      {!loading && !error && filteredExams.length === 0 && (
        <div className="ec-state-card ec-empty-card">
          <div className="ec-empty-icon">
            <Search size={24} />
          </div>
          <h3>No matching examinations found</h3>
          <p>
            {searchQuery
              ? `We couldn't find any banking examinations matching "${searchQuery}".`
              : "No examinations are currently published under this category."}
          </p>
          {hasActiveFilters && (
            <button type="button" className="ec-btn-primary" onClick={resetFilters}>
              <RotateCcw size={14} /> Reset Filters &amp; Show All
            </button>
          )}
        </div>
      )}

      {/* 7. RESPONSIVE 3-COLUMN EXAMINATION GRID */}
      {!loading && !error && visibleExams.length > 0 && (
        <>
          <div className="ec-grid">
            {visibleExams.map(({ exam, org, summary }) => {
              const OrgIcon = org.Icon;
              const displayedStages = summary.stages.slice(0, 2);
              const hiddenStageCount = Math.max(0, summary.stages.length - 2);

              return (
                <article key={exam.id} className="ec-card">
                  {/* Card Header */}
                  <div className="ec-card-head">
                    <div className="ec-card-head-top">
                      <span className={`ec-org-badge ec-org-${org.tone}`}>
                        <OrgIcon size={13} />
                        {org.label}
                      </span>
                      <div className="ec-card-tags">
                        {summary.isRecent && (
                          <span className="ec-recent-badge">New</span>
                        )}
                        {summary.publishedTests > 0 && (
                          <span className="ec-tests-badge">
                            {summary.publishedTests} {summary.publishedTests === 1 ? "Mock" : "Mocks"}
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="ec-card-title">{exam.name}</h3>
                    {exam.description && (
                      <p className="ec-card-desc">{exam.description}</p>
                    )}
                  </div>

                  {/* Quick Metrics Strip */}
                  <div className="ec-metrics-strip">
                    <div className="ec-metric">
                      <Layers size={13} />
                      <span>
                        {summary.stages.length}{" "}
                        {summary.stages.length === 1 ? "Stage" : "Stages"}
                      </span>
                    </div>
                    {summary.totalQuestions > 0 && (
                      <div className="ec-metric">
                        <HelpCircle size={13} />
                        <span>{summary.totalQuestions} Qs</span>
                      </div>
                    )}
                    {summary.totalMarks > 0 && (
                      <div className="ec-metric">
                        <Award size={13} />
                        <span>{summary.totalMarks} Marks</span>
                      </div>
                    )}
                    {summary.primaryNeg > 0 && (
                      <div className="ec-metric">
                        <span>-{summary.primaryNeg} Neg</span>
                      </div>
                    )}
                  </div>

                  {/* Stage Breakdown */}
                  <div className="ec-stages-list">
                    {displayedStages.length > 0 ? (
                      displayedStages.map((stage) => {
                        const durLabel = formatDuration(stage.duration_seconds);
                        return (
                          <div key={stage.id} className="ec-stage-block">
                            <div className="ec-stage-head">
                              <strong className="ec-stage-name">{stage.name}</strong>
                              <div className="ec-stage-pills">
                                {durLabel && (
                                  <span className="ec-stage-stat">
                                    <Clock3 size={11} /> {durLabel}
                                  </span>
                                )}
                                {stage.stats.totalQuestions > 0 && (
                                  <span className="ec-stage-stat">
                                    {stage.stats.totalQuestions} Qs
                                  </span>
                                )}
                              </div>
                            </div>
                            {stage.stats.sections.length > 0 && (
                              <div className="ec-subject-chips">
                                {stage.stats.sections.map((sec) => (
                                  <span key={sec.id} className="ec-subject-chip">
                                    {sec.name}
                                    {Number(sec.question_count) > 0 && (
                                      <em>{sec.question_count}Q</em>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="ec-stage-empty">
                        Exam pattern details will appear once stages are configured.
                      </div>
                    )}

                    {hiddenStageCount > 0 && (
                      <button
                        type="button"
                        className="ec-more-stages-link"
                        onClick={() => setPatternModalExam({ exam, org, summary })}
                      >
                        +{hiddenStageCount} more {hiddenStageCount === 1 ? "stage" : "stages"} — View full pattern
                      </button>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="ec-card-footer">
                    <button
                      type="button"
                      className="ec-btn-primary"
                      onClick={() => onExploreExam?.(exam)}
                    >
                      <span>Explore Examination</span>
                      <ArrowRight size={15} />
                    </button>
                    <button
                      type="button"
                      className="ec-btn-secondary"
                      onClick={() => setPatternModalExam({ exam, org, summary })}
                    >
                      <FileText size={14} />
                      <span>View Exam Pattern</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {hasMore && (
            <div className="ec-load-more-wrap">
              <button
                type="button"
                className="ec-btn-secondary ec-load-more-btn"
                onClick={() => setVisibleLimit((prev) => prev + 9)}
              >
                Load More Examinations ({filteredExams.length - visibleLimit} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {/* 8. EXAM PATTERN DETAIL MODAL */}
      {patternModalExam && (
        <div
          className="ec-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ec-pattern-modal-title"
          onClick={() => setPatternModalExam(null)}
        >
          <div className="ec-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ec-modal-header">
              <div>
                <div className="ec-modal-badges">
                  <span className={`ec-org-badge ec-org-${patternModalExam.org.tone}`}>
                    {patternModalExam.org.label}
                  </span>
                  {patternModalExam.exam.pattern_cycle && (
                    <span className="ec-cycle-badge">
                      Cycle: {patternModalExam.exam.pattern_cycle}
                    </span>
                  )}
                </div>
                <h2 id="ec-pattern-modal-title">{patternModalExam.exam.name} — Exam Pattern</h2>
                {patternModalExam.exam.description && (
                  <p className="ec-modal-desc">{patternModalExam.exam.description}</p>
                )}
              </div>
              <button
                type="button"
                className="ec-modal-close"
                aria-label="Close exam pattern modal"
                onClick={() => setPatternModalExam(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="ec-modal-body">
              {patternModalExam.summary.stages.length > 0 ? (
                patternModalExam.summary.stages.map((stage) => (
                  <div key={stage.id} className="ec-modal-stage">
                    <div className="ec-modal-stage-head">
                      <div>
                        <h4>{stage.name}</h4>
                        <span className="ec-modal-stage-sub">
                          {formatDuration(stage.duration_seconds) || "Timed stage"}
                          {stage.stats.totalQuestions > 0 ? ` · ${stage.stats.totalQuestions} Questions` : ""}
                          {stage.stats.totalMarks > 0 ? ` · ${stage.stats.totalMarks} Marks` : ""}
                        </span>
                      </div>
                      {stage.stats.negativeMarks > 0 && (
                        <span className="ec-neg-pill">
                          Negative Marking: -{stage.stats.negativeMarks}
                        </span>
                      )}
                    </div>

                    {stage.stats.sections.length > 0 && (
                      <div className="ec-pattern-table-wrap">
                        <table className="ec-pattern-table">
                          <thead>
                            <tr>
                              <th>Subject / Section</th>
                              <th>Questions</th>
                              <th>Marks / Q</th>
                              <th>Negative</th>
                              <th>Section Timer</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stage.stats.sections.map((sec) => (
                              <tr key={sec.id}>
                                <td><strong>{sec.name}</strong></td>
                                <td>{sec.question_count ?? "—"}</td>
                                <td>{sec.marks_per_correct != null ? `+${Number(sec.marks_per_correct)}` : "—"}</td>
                                <td>{Number(sec.negative_marks) > 0 ? `-${Number(sec.negative_marks)}` : "None"}</td>
                                <td>{formatDuration(sec.duration_seconds) || "Combined"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="ec-stage-empty">
                  Detailed stage and section breakdown is not yet configured for this examination.
                </p>
              )}

              {patternModalExam.exam.pattern_source_url && (
                <a
                  className="ec-source-link"
                  href={patternModalExam.exam.pattern_source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={13} /> Official Notification / Pattern Reference
                </a>
              )}
            </div>

            <div className="ec-modal-footer">
              <button
                type="button"
                className="ec-btn-secondary"
                onClick={() => setPatternModalExam(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="ec-btn-primary"
                onClick={() => {
                  const target = patternModalExam.exam;
                  setPatternModalExam(null);
                  onExploreExam?.(target);
                }}
              >
                <span>Explore Mock Tests</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}