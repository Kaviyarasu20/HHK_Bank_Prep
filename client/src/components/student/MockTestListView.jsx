import { CustomSelect } from "../common/CustomSelect.jsx";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Clock3, Layers, Play, Target } from "lucide-react";
import { ExamOptGroups } from "../../utils/examCategories";
import { formatINR } from "../../utils/paymentHelpers";

function MockTestListView({
  tests,
  exams,
  examFilter,
  setExamFilter,
  busy,
  onStartAttempt
}) {
  const [activeTab, setActiveTab] = useState("EXAM_WISE");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");

  const examWiseTests = useMemo(
    () =>
      tests
        .filter((t) => (t.test_type || "EXAM_WISE") === "EXAM_WISE")
        .filter((t) => (!examFilter ? true : t.exam_id === examFilter)),
    [tests, examFilter]
  );

  const allTopicwiseTests = useMemo(
    () => tests.filter((t) => t.test_type === "TOPIC_WISE"),
    [tests]
  );

  const topicwiseSubjects = useMemo(
    () => [...new Set(allTopicwiseTests.map((t) => t.subject).filter(Boolean))].sort(),
    [allTopicwiseTests]
  );

  const topicwiseTopics = useMemo(
    () =>
      [
        ...new Set(
          allTopicwiseTests
            .filter((t) => (!subjectFilter ? true : t.subject === subjectFilter))
            .map((t) => t.topic)
            .filter(Boolean)
        ),
      ].sort(),
    [allTopicwiseTests, subjectFilter]
  );

  const visibleTopicwiseTests = useMemo(
    () =>
      allTopicwiseTests.filter((t) => {
        if (subjectFilter && t.subject !== subjectFilter) return false;
        if (topicFilter && t.topic !== topicFilter) return false;
        return true;
      }),
    [allTopicwiseTests, subjectFilter, topicFilter]
  );

  const groupedTopicwise = useMemo(() => {
    const map = new Map();
    for (const t of visibleTopicwiseTests) {
      const key = `${t.subject || "General"}|||${t.topic || "General"}`;
      if (!map.has(key)) {
        map.set(key, {
          subject: t.subject || "General",
          topic: t.topic || "General",
          sets: [],
        });
      }
      map.get(key).sets.push(t);
    }
    return [...map.values()].map((g) => ({
      ...g,
      sets: g.sets.sort((a, b) => Number(a.set_number || 0) - Number(b.set_number || 0)),
    }));
  }, [visibleTopicwiseTests]);


  const renderPriceBadge = (t) => {
    const isPromoFree = t.promotional_free_until && new Date(t.promotional_free_until) > new Date();
    if (t.access_type === "FREE" || isPromoFree) {
      return <span className="access-badge free">{isPromoFree ? "FREE PROMO" : "FREE"}</span>;
    }
    if (t.has_access) {
      return <span className="access-badge unlocked">UNLOCKED</span>;
    }
    if (t.access_type === "SUBSCRIPTION") {
      return <span className="access-badge subscription">SUBSCRIPTION</span>;
    }
    return <span className="access-badge paid">PAID · {formatINR(t.price_paise, t.currency)}</span>;
  };

  const totalExamWise = useMemo(
    () => tests.filter((t) => (t.test_type || "EXAM_WISE") === "EXAM_WISE").length,
    [tests]
  );

  return (
    <>
      <div className="student-welcome">
        <div>
          <div className="eyebrow">COMPUTER-BASED MOCKS</div>
          <h1>Choose a mock test</h1>
          <p>
            Attempt full-length Exam Wise blueprints or focused single-topic timed sets.
          </p>
        </div>

        {activeTab === "EXAM_WISE" && exams.length > 0 && (
          <CustomSelect
            className="period-select"
            aria-label="Filter mock tests by exam"
            value={examFilter}
            onChange={(e) => setExamFilter(e.target.value)}
          >
            <option value="">All exams ({exams.length})</option>
            <ExamOptGroups
              exams={exams}
              getKey={(e) => e.id}
              getValue={(e) => e.id}
              getLabel={(e) => e.name}
            />
          </CustomSelect>
        )}
      </div>

      {/* Mode Tabs: Exam Wise Mock Tests vs Topicwise Tests */}
      <div className="mock-mode-tabs" role="tablist" aria-label="Mock test modes">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "EXAM_WISE"}
          className={`mock-mode-tab ${activeTab === "EXAM_WISE" ? "active" : ""}`}
          onClick={() => setActiveTab("EXAM_WISE")}
        >
          <Target size={16} />
          Exam Wise Mock Tests
          <span className="mock-tab-count">{totalExamWise}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "TOPIC_WISE"}
          className={`mock-mode-tab ${activeTab === "TOPIC_WISE" ? "active" : ""}`}
          onClick={() => setActiveTab("TOPIC_WISE")}
        >
          <BookOpen size={16} />
          Topicwise Tests
          <span className="mock-tab-count">{allTopicwiseTests.length}</span>
        </button>
      </div>

      {activeTab === "EXAM_WISE" ? (
        examWiseTests.length ? (
          examWiseTests.map((t) => (
            <div className="panel test-card" key={t.id}>
              <div>
                <div className="test-card-badges">
                  <span className="exam-pill">
                    {t.exam_name} · {t.stage_name}
                  </span>
                  {t.set_label && <span className="set-badge">{t.set_label}</span>}
                  {renderPriceBadge(t)}
                </div>
                <h2>{t.name}</h2>
                <p>{t.description || "Timed computer-based mock test"}</p>
                <span>
                  <Clock3 size={14} /> {Math.round(t.duration_seconds / 60)} minutes
                  {Number(t.question_count) > 0 ? ` · ${t.question_count} questions` : ""}
                </span>
                {t.pattern_cycle && (
                  <span className="pattern-cycle-label">
                    Pattern cycle: {t.pattern_cycle}
                  </span>
                )}
                {t.pattern_source_url && (
                  <a
                    className="pattern-source-link"
                    href={t.pattern_source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View official recruitment notice <ArrowRight size={13} />
                  </a>
                )}
              </div>
              <button
                className="primary-btn"
                disabled={busy}
                onClick={() => onStartAttempt(t.id)}
              >
                <Play size={14} fill="currentColor" /> Instructions &amp; start
              </button>
            </div>
          ))
        ) : (
          <div className="panel empty-questions">
            <strong>No published Exam Wise tests available</strong>
            <span>
              Full-length Exam Wise sets will appear here once an administrator publishes them.
            </span>
          </div>
        )
      ) : (
        <>
          {/* Topicwise Subject & Topic Filter Bar */}
          <div className="panel topicwise-student-filters">
            <label>
              Subject
              <CustomSelect
                value={subjectFilter}
                onChange={(e) => {
                  setSubjectFilter(e.target.value);
                  setTopicFilter("");
                }}
              >
                <option value="">All Subjects ({topicwiseSubjects.length})</option>
                {topicwiseSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </CustomSelect>
            </label>

            <label>
              Topic
              <CustomSelect
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
              >
                <option value="">All Topics ({topicwiseTopics.length})</option>
                {topicwiseTopics.map((top) => (
                  <option key={top} value={top}>
                    {top}
                  </option>
                ))}
              </CustomSelect>
            </label>
          </div>

          {groupedTopicwise.length > 0 ? (
            <div className="student-topic-groups">
              {groupedTopicwise.map((group) => (
                <div
                  key={`${group.subject}-${group.topic}`}
                  className="panel student-topic-group-card"
                >
                  <div className="student-topic-group-head">
                    <div>
                      <span className="exam-pill">
                        <Layers size={12} /> {group.subject}
                      </span>
                      <h2>{group.topic}</h2>
                    </div>
                    <span className="student-set-count">
                      {group.sets.length} published set{group.sets.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="student-topic-sets-grid">
                    {group.sets.map((t) => (
                      <div key={t.id} className="student-topic-set-card">
                        <div className="student-topic-set-top">
                          <span className="set-badge">{t.set_label || `Set ${t.set_number || 1}`}</span>
                          <span className="topic-qs-pill">
                            {Number(t.question_count || t.target_questions || 0)} Qs
                          </span>
                        </div>
                        <h3>{t.name}</h3>
                        <p>{t.description || `Focused single-topic timed drill on ${t.topic}.`}</p>
                        <div className="student-topic-set-meta">
                          <span>
                            <Clock3 size={13} /> {Math.round(t.duration_seconds / 60)} min
                          </span>
                          <span>
                            +{Number(t.marks_per_question ?? 1)} / -{Number(t.negative_marks ?? 0.25)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={busy}
                          onClick={() => onStartAttempt(t.id)}
                        >
                          <Play size={14} fill="currentColor" /> Start Test
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel empty-questions">
              <strong>No published Topicwise tests match this selection</strong>
              <span>
                Topicwise practice sets will appear here once an administrator publishes them.
              </span>
            </div>
          )}
        </>
      )}
    </>
  );
}

export { MockTestListView };
