import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  FileCheck2,
  Lock,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { formatINR } from "../../utils/paymentHelpers";
import { ExaminationCatalogueView } from "./ExaminationCatalogueView";
import { SeoLandingPage } from "./SeoLandingPage";
import {
  getPathForPublicPage,
  getSeoMetaForPublicPage,
  resolvePublicPageFromPath,
  SEO_LANDING_PAGES,
} from "../../utils/publicRoutes";
import { updatePageSeo } from "../../utils/seo";
import {
  ContactSupportPage,
  PrivacyPage,
  RefundPolicyPage,
  TermsPage,
} from "./LegalPages";

/**
 * Public HHK Website Portal — accessible WITHOUT login or registration.
 * Allows visitors to explore exams, syllabus subjects/topics, mock tests, pricing,
 * and legal/support pages. Clicking "Start Test" routes unauthenticated visitors
 * cleanly to Login/Register while preserving the intended testId.
 */
export function PublicPortal({
  initialPage = "home",
  onOpenAuth,
  onStartTestAsVisitor,
  onToast,
}) {
  const [page, setPage] = useState(() => {
    if (typeof window !== "undefined") {
      const fromUrl = resolvePublicPageFromPath(window.location.pathname);
      if (fromUrl !== "home") return fromUrl;
    }
    return initialPage;
  });
  const [overview, setOverview] = useState(null);
  const [exams, setExams] = useState([]);
  const [tests, setTests] = useState([]);
  const [plans, setPlans] = useState([]);
  const [config, setConfig] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [testTab, setTestTab] = useState("EXAM_WISE");
  const [accessFilter, setAccessFilter] = useState("ALL");
  const [examFilter, setExamFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [examsError, setExamsError] = useState("");

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  async function loadPublicPortalData() {
    setLoading(true);
    setExamsError("");
    try {
      const [ov, ex, ts, pl, cf] = await Promise.all([
        fetch("/api/public/overview").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/public/exams").then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load examinations.")))),
        fetch("/api/public/tests").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/public/plans").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/public/config").then((r) => (r.ok ? r.json() : null)),
      ]);
      setOverview(ov);
      setExams(ex?.exams ?? []);
      setTests(ts?.tests ?? []);
      setPlans(pl?.plans ?? []);
      setConfig(cf?.config ?? null);
    } catch (err) {
      setExamsError(err?.message || "Failed to fetch banking examinations. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPublicPortalData();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onPopState = () => {
      setSelectedTest(null);
      setPage(resolvePublicPageFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (selectedTest) {
      updatePageSeo({
        title: `${selectedTest.name} | HHK Banking Mock Test`,
        description:
          selectedTest.description ||
          "Timed computer-based banking examination mock test with real exam interface and performance analytics.",
        path: "/mock-tests",
      });
      return;
    }
    updatePageSeo(getSeoMetaForPublicPage(page));
  }, [page, selectedTest]);

  function navigate(nextPage) {
    setSelectedTest(null);
    setPage(nextPage);
    if (typeof window !== "undefined") {
      const targetPath = getPathForPublicPage(nextPage);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ page: nextPage }, "", targetPath);
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const syllabusSubjects = useMemo(() => {
    const raw = overview?.syllabus;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return Object.entries(raw).map(([name, topics]) => ({
      name,
      topics: Array.isArray(topics) ? topics : Object.keys(topics || {}),
    }));
  }, [overview]);

  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      const mode = t.test_type || "EXAM_WISE";
      if (mode !== testTab) return false;
      const isFree =
        t.access_type === "FREE" ||
        (t.promotional_free_until && new Date(t.promotional_free_until) > new Date());
      if (accessFilter === "FREE" && !isFree) return false;
      if (accessFilter === "PAID" && isFree) return false;
      if (testTab === "EXAM_WISE" && examFilter && t.exam_id !== examFilter) return false;
      if (testTab === "TOPIC_WISE" && subjectFilter && t.subject !== subjectFilter) return false;
      return true;
    });
  }, [tests, testTab, accessFilter, examFilter, subjectFilter]);

  const topicSubjects = useMemo(
    () =>
      [...new Set(tests.filter((t) => t.test_type === "TOPIC_WISE").map((t) => t.subject).filter(Boolean))].sort(),
    [tests],
  );

  function renderAccessBadge(t) {
    const isPromoFree =
      t.promotional_free_until && new Date(t.promotional_free_until) > new Date();
    if (t.access_type === "FREE" || isPromoFree) {
      return <span className="access-badge free">{isPromoFree ? "FREE PROMO" : "FREE"}</span>;
    }
    if (t.access_type === "SUBSCRIPTION") {
      return <span className="access-badge subscription">SUBSCRIPTION</span>;
    }
    return (
      <span className="access-badge paid">
        PAID · {formatINR(t.price_paise, t.currency)}
      </span>
    );
  }

  return (
    <div className="public-shell">
      {/* Public Top Navigation */}
      <header className="public-header">
        <div className="public-header-inner">
          <button type="button" className="public-brand" onClick={() => navigate("home")}>
            <img src="/logo.png" alt="HHK logo" />
            <span>HHK Banking Prep</span>
          </button>

          <nav className="public-nav" aria-label="Public navigation">
            {[
              ["home", "Home"],
              ["exams", "Exams"],
              ["mock-tests", "Mock Tests"],
              ["seo-banking-awareness", "Banking Hub"],
              ["seo-current-affairs", "Current Affairs"],
              ["pricing", "Pricing"],
              ["contact", "Support"],
            ].map(([key, label]) => (
              <a
                key={key}
                href={getPathForPublicPage(key)}
                className={`public-nav-link ${page === key && !selectedTest ? "active" : ""}`}
                style={{ textDecoration: "none" }}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  navigate(key);
                }}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="public-auth-actions">
            <button type="button" className="ghost-btn" onClick={() => onOpenAuth("login")}>
              Login
            </button>
            <button type="button" className="primary-btn" onClick={() => onOpenAuth("register")}>
              Create Account
            </button>
          </div>
        </div>
      </header>

      {/* Main Public Content */}
      <main className="public-main">
        {/* Selected Mock Test Detail Preview (before clicking Start Test) */}
        {selectedTest ? (
          <div className="public-legal-wrap">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setSelectedTest(null)}
              style={{ marginBottom: 16 }}
            >
              Return to Mock Tests
            </button>
            <div className="panel public-legal-card">
              <div className="test-card-badges" style={{ marginBottom: 10 }}>
                {renderAccessBadge(selectedTest)}
                <span className="exam-pill">
                  {selectedTest.test_type === "TOPIC_WISE"
                    ? `${selectedTest.subject} · ${selectedTest.topic}`
                    : `${selectedTest.exam_name || "Banking Exam"} · ${selectedTest.stage_name || "Mock"}`}
                </span>
                {selectedTest.set_label && <span className="set-badge">{selectedTest.set_label}</span>}
              </div>
              <h1>{selectedTest.name}</h1>
              <p style={{ color: "#555873", marginBottom: 18 }}>
                {selectedTest.description || "Timed computer-based banking examination mock test with real exam interface and performance analytics."}
              </p>

              <div className="payment-kpi-grid" style={{ marginBottom: 20 }}>
                <div className="payment-kpi-card">
                  <span>Duration</span>
                  <strong>{Math.max(1, Math.round((selectedTest.duration_seconds || 3600) / 60))} mins</strong>
                </div>
                <div className="payment-kpi-card">
                  <span>Total Questions</span>
                  <strong>{selectedTest.question_count || selectedTest.target_questions || "—"}</strong>
                </div>
                <div className="payment-kpi-card">
                  <span>Maximum Marks</span>
                  <strong>{selectedTest.max_marks || "—"}</strong>
                </div>
                <div className="payment-kpi-card">
                  <span>Difficulty</span>
                  <strong>{selectedTest.difficulty_label || "Moderate"}</strong>
                </div>
              </div>

              <div className="payment-banner info" style={{ marginBottom: 20 }}>
                <Lock size={18} />
                <div>
                  <strong>Login Required to Start Examination</strong>
                  <span>
                    Sign in or create a free HHK student account to start this test. You will be
                    returned directly to this mock test right after signing in.
                  </span>
                </div>
              </div>

              <div className="public-hero-actions">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => onStartTestAsVisitor(selectedTest)}
                >
                  <Play size={15} fill="currentColor" /> Start Test
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => navigate("pricing")}
                >
                  View Subscription Plans
                </button>
              </div>
            </div>
          </div>
        ) : page === "home" ? (
          <>
            <section className="public-hero">
              <div>
                <div className="eyebrow">HHK BANKING EXAMINATION PLATFORM</div>
                <h1>Prepare for IBPS, SBI, RBI &amp; NABARD exams with real CBT mock tests</h1>
                <p>
                  Explore our banking exam catalogue, Quantitative Aptitude, Reasoning, and English
                  topics, and free &amp; paid computer-based mock tests — no login required to browse.
                </p>
                <div className="public-hero-actions">
                  <button type="button" className="primary-btn" onClick={() => navigate("mock-tests")}>
                    Explore Mock Tests <ArrowRight size={16} />
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => navigate("pricing")}>
                    View Pricing &amp; Plans
                  </button>
                </div>
              </div>

              <div className="public-hero-stats">
                <div className="public-stat-tile">
                  <strong>{overview?.stats?.publishedExams ?? exams.length}</strong>
                  <span>Banking Examinations</span>
                </div>
                <div className="public-stat-tile">
                  <strong>{overview?.stats?.publishedTests ?? tests.length}</strong>
                  <span>Published Mock Tests</span>
                </div>
                <div className="public-stat-tile">
                  <strong>{overview?.stats?.freeTests ?? 0}</strong>
                  <span>Free Mock Tests</span>
                </div>
                <div className="public-stat-tile">
                  <strong>{overview?.stats?.activePlans ?? plans.length}</strong>
                  <span>Subscription Plans</span>
                </div>
              </div>
            </section>

            {/* Subjects & Topics Explorer */}
            <section className="public-section">
              <div className="public-section-head">
                <div>
                  <div className="eyebrow">SYLLABUS COVERAGE</div>
                  <h2>Explore Banking Exam Subjects &amp; Topics</h2>
                </div>
                <button type="button" className="ghost-btn" onClick={() => navigate("exams")}>
                  View All Exams <ArrowRight size={15} />
                </button>
              </div>
              <div className="public-card-grid">
                {syllabusSubjects.slice(0, 6).map((subj) => (
                  <div className="panel" key={subj.name} style={{ padding: 20 }}>
                    <h3 style={{ marginBottom: 8 }}>{subj.name}</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(subj.topics || []).slice(0, 8).map((topic) => (
                        <span key={typeof topic === "string" ? topic : topic.name} className="set-badge">
                          {typeof topic === "string" ? topic : topic.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Featured Mock Tests Preview */}
            <section className="public-section">
              <div className="public-section-head">
                <div>
                  <div className="eyebrow">FREE &amp; PAID MOCK TESTS</div>
                  <h2>Featured Computer-Based Mock Tests</h2>
                </div>
                <button type="button" className="ghost-btn" onClick={() => navigate("mock-tests")}>
                  Browse All Tests <ArrowRight size={15} />
                </button>
              </div>
              {loading ? (
                <div className="panel" style={{ padding: 24 }}>Loading available mock tests…</div>
              ) : tests.length ? (
                <div className="public-card-grid">
                  {tests.slice(0, 6).map((t) => (
                    <div className="panel public-test-card" key={t.id} style={{ padding: 20 }}>
                      <div>
                        <div className="test-card-badges" style={{ marginBottom: 8 }}>
                          {renderAccessBadge(t)}
                          {t.set_label && <span className="set-badge">{t.set_label}</span>}
                        </div>
                        <h3 style={{ marginBottom: 6 }}>{t.name}</h3>
                        <p style={{ fontSize: 13.5, color: "#5b5e75", marginBottom: 10 }}>
                          {t.description || "Timed computer-based banking mock test"}
                        </p>
                        <div style={{ fontSize: 13, color: "#5b5e75", display: "flex", gap: 12, flexWrap: "wrap" }}>
                          <span><Clock3 size={13} /> {Math.round((t.duration_seconds || 3600) / 60)}m</span>
                          <span><FileCheck2 size={13} /> {t.question_count || t.target_questions || 0} Qs</span>
                          <span>{t.difficulty_label || "Moderate"}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => setSelectedTest(t)}
                      >
                        View Details &amp; Start
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="panel" style={{ padding: 24 }}>
                  Published mock tests will appear here as soon as an administrator publishes them.
                </div>
              )}
            </section>
          </>
        ) : page === "exams" ? (
          <ExaminationCatalogueView
            exams={exams}
            tests={tests}
            loading={loading}
            error={examsError}
            onRetry={loadPublicPortalData}
            onNavigateHome={() => navigate("home")}
            onExploreExam={(ex) => {
              setTestTab("EXAM_WISE");
              setExamFilter(ex.id);
              navigate("mock-tests");
            }}
          />
        ) : page === "mock-tests" ? (
          <section className="public-section">
            <div className="public-section-head">
              <div>
                <div className="eyebrow">PUBLIC MOCK TEST DIRECTORY</div>
                <h1>Explore Free &amp; Paid Mock Tests</h1>
              </div>
              <div className="payment-filters-bar" style={{ marginBottom: 0 }}>
                <select value={accessFilter} onChange={(e) => setAccessFilter(e.target.value)} aria-label="Filter by free or paid">
                  <option value="ALL">All Access Types</option>
                  <option value="FREE">Free Tests Only</option>
                  <option value="PAID">Paid / Subscription Tests</option>
                </select>
                {testTab === "EXAM_WISE" ? (
                  <select value={examFilter} onChange={(e) => setExamFilter(e.target.value)} aria-label="Filter by exam">
                    <option value="">All Exams</option>
                    {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                ) : (
                  <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} aria-label="Filter by subject">
                    <option value="">All Subjects</option>
                    {topicSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="mock-mode-tabs" style={{ marginBottom: 18 }}>
              <button
                type="button"
                className={`mock-mode-tab ${testTab === "EXAM_WISE" ? "active" : ""}`}
                onClick={() => setTestTab("EXAM_WISE")}
              >
                <Target size={15} /> Exam Wise Mock Tests
              </button>
              <button
                type="button"
                className={`mock-mode-tab ${testTab === "TOPIC_WISE" ? "active" : ""}`}
                onClick={() => setTestTab("TOPIC_WISE")}
              >
                <BookOpen size={15} /> Topicwise Tests
              </button>
            </div>

            {filteredTests.length ? (
              <div className="public-card-grid">
                {filteredTests.map((t) => (
                  <div className="panel public-test-card" key={t.id} style={{ padding: 20 }}>
                    <div>
                      <div className="test-card-badges" style={{ marginBottom: 8 }}>
                        {renderAccessBadge(t)}
                        {t.set_label && <span className="set-badge">{t.set_label}</span>}
                      </div>
                      <h3 style={{ marginBottom: 6 }}>{t.name}</h3>
                      <p style={{ fontSize: 13.5, color: "#5b5e75", marginBottom: 10 }}>
                        {t.description || "Timed computer-based mock examination"}
                      </p>
                      <div style={{ fontSize: 13, color: "#5b5e75", display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <span><Clock3 size={13} /> {Math.round((t.duration_seconds || 3600) / 60)} mins</span>
                        <span><FileCheck2 size={13} /> {t.question_count || t.target_questions || 0} Qs</span>
                        <span>Max Marks: {t.max_marks || "—"}</span>
                        <span>{t.difficulty_label || "Moderate"}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="ghost-btn" onClick={() => setSelectedTest(t)}>
                        Details
                      </button>
                      <button
                        type="button"
                        className="primary-btn"
                        style={{ flex: 1 }}
                        onClick={() => onStartTestAsVisitor(t)}
                      >
                        <Play size={14} fill="currentColor" /> Start Test
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel" style={{ padding: 24 }}>
                No mock tests match your current filter.
              </div>
            )}
          </section>
        ) : page === "pricing" ? (
          <section className="public-section">
            <div className="public-section-head">
              <div>
                <div className="eyebrow">TRANSPARENT INR PRICING</div>
                <h1>Subscription Plans &amp; Pay-Per-Test Access</h1>
                <p style={{ color: "#5b5e75" }}>
                  Choose an all-access subscription plan or purchase individual paid mock tests directly.
                  All payments are securely verified through Razorpay.
                </p>
              </div>
            </div>

            {plans.length ? (
              <div className="pricing-grid">
                {plans.map((p) => {
                  const hasPromo =
                    p.promo_price_paise != null &&
                    (!p.promo_valid_until || new Date(p.promo_valid_until) > new Date());
                  return (
                    <div className={`panel pricing-card ${p.is_featured ? "featured" : ""}`} key={p.id}>
                      <div>
                        <div className="test-card-badges" style={{ marginBottom: 8 }}>
                          <span className="exam-pill">{p.duration_days} Days</span>
                          {p.is_featured && <span className="access-badge paid"><Sparkles size={12} /> Popular</span>}
                        </div>
                        <h2 style={{ marginBottom: 6 }}>{p.name}</h2>
                        <p style={{ fontSize: 13.5, color: "#5b5e75", marginBottom: 14 }}>
                          {p.description || "Structured banking exam mock test access."}
                        </p>
                        <div className="pricing-price">
                          {formatINR(hasPromo ? p.promo_price_paise : p.price_paise, p.currency)}
                          {hasPromo && (
                            <span className="pricing-strike">
                              {formatINR(p.price_paise, p.currency)}
                            </span>
                          )}
                        </div>
                        <ul className="pricing-features" style={{ marginTop: 14 }}>
                          {(Array.isArray(p.features) && p.features.length
                            ? p.features
                            : [
                                p.access_scope === "ALL_TESTS"
                                  ? "Unlimited access to all published mock tests"
                                  : `Access to included mock test sets`,
                                "Detailed scorecards & sectional analysis",
                                "Server-verified instant activation",
                              ]
                          ).map((feat, idx) => (
                            <li key={idx}><Check size={15} color="#6557dc" /> <span>{feat}</span></li>
                          ))}
                        </ul>
                      </div>
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => onOpenAuth("login")}
                      >
                        Login to Purchase
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="panel" style={{ padding: 24 }}>
                Subscription plans are configured by the HHK administrator. You can still browse free
                and individual paid mock tests on the Mock Tests page.
              </div>
            )}

            <div className="payment-banner info" style={{ marginTop: 22 }}>
              <ShieldCheck size={18} />
              <div>
                <strong>Safe &amp; Transparent Billing</strong>
                <span>
                  Review our{" "}
                  <button type="button" className="inline-link-btn" onClick={() => navigate("terms")}>Terms &amp; Conditions</button>,{" "}
                  <button type="button" className="inline-link-btn" onClick={() => navigate("privacy")}>Privacy Policy</button>, and{" "}
                  <button type="button" className="inline-link-btn" onClick={() => navigate("refund-policy")}>Refund &amp; Cancellation Policy</button>{" "}
                  before purchasing.
                </span>
              </div>
            </div>
          </section>
        ) : page === "terms" ? (
          <TermsPage config={config} onBack={() => navigate("home")} onNavigate={navigate} />
        ) : page === "privacy" ? (
          <PrivacyPage config={config} onBack={() => navigate("home")} onNavigate={navigate} />
        ) : page === "refund-policy" ? (
          <RefundPolicyPage config={config} onBack={() => navigate("home")} onNavigate={navigate} />
        ) : page === "contact" ? (
          <ContactSupportPage config={config} onBack={() => navigate("home")} onToast={onToast} />
        ) : SEO_LANDING_PAGES[page] ? (
          <SeoLandingPage pageKey={page} onNavigate={navigate} onOpenAuth={onOpenAuth} />
        ) : null}
      </main>

      {/* Public Footer with Mandatory Legal Links */}
      <footer className="public-footer">
        <div className="public-footer-inner">
          <div>
            <strong>{config?.businessName || "HHK Banking Examination Preparation Platform"}</strong>
            <div>Secure INR Payments via Razorpay · Built for Banking Exam Aspirants</div>
          </div>
          <div className="public-footer-links">
            {[
              ["seo-ibps-po", "IBPS PO Prep"],
              ["seo-sbi-po", "SBI PO Prep"],
              ["seo-banking-awareness", "Banking Awareness"],
              ["seo-current-affairs", "Current Affairs"],
              ["mock-tests", "Mock Tests"],
              ["pricing", "Pricing"],
              ["terms", "Terms & Conditions"],
              ["privacy", "Privacy Policy"],
              ["refund-policy", "Refund Policy"],
              ["contact", "Contact & Support"],
            ].map(([key, label]) => (
              <a
                key={key}
                href={getPathForPublicPage(key)}
                style={{ color: "inherit", textDecoration: "none", fontSize: 13 }}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  navigate(key);
                }}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
