import { lazy, Suspense, useEffect, useState } from "react";
import { ExamOptGroups } from "./utils/examCategories";
import { subscribeCompanionTabLock } from "./utils/examLock";
import { FeedbackProvider, useFeedback } from "./components/common/FeedbackSystem";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  BookOpen,
  Bookmark,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Receipt,
  Sparkles,
  Flame,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Target,
  Trophy,
  UserCheck,
  X
} from "lucide-react";

// ============================================================================
// 1. LAZY-LOADED CORE APPLICATION MODULES (Code-Splitting for Fast Initial Load)
// ============================================================================
const AdminPanel = lazy(() => import("./AdminPanel"));
const AdminOverview = lazy(() => import("./AdminOverview"));
const AuthPage = lazy(() => import("./AuthPage"));
const StudentWorkspace = lazy(() => import("./StudentWorkspace"));
import { PublicPortal } from "./components/public/PublicPortal";
import { TermsPage, PrivacyPage, RefundPolicyPage, ContactSupportPage } from "./components/public/LegalPages";
import { savePendingTestRedirect, getPendingTestRedirect, clearPendingTestRedirect } from "./utils/paymentHelpers";

// ============================================================================
// 2. NAVIGATION CONFIGURATIONS (Role-Specific Sidebar Menus)
// ============================================================================
// Student preparation sections: Dashboard, Tests, Practice, Streaks, Profile
const studentPages = [
  ["Overview", LayoutDashboard],
  ["Daily challenge", Flame],
  ["Practice", BookOpen],
  ["Bookmarks", Bookmark],
  ["Mock tests", Target],
  ["Purchases & Plans", Sparkles],
  ["Payment History", Receipt],
  ["Performance", Activity],
  ["Current affairs", CalendarDays],
  ["Leaderboard", Trophy],
  ["Achievements", ShieldCheck],
  ["Profile", Settings],
  ["Contact & Support", CircleHelp]
];

// Administrator control center: Setup, Questions, Mocks (Nested Accordion), Governance, Reports
const adminPages = [
  ["Admin dashboard", LayoutDashboard],
  ["Exam setup", Settings],
  ["Question bank", BookOpen],
  ["__MOCK_TEST_ACCORDION__", Target],
  ["Current affairs", CalendarDays],
  ["Payments & Pricing", CreditCard],
  ["Role management", UserCheck],
  ["Reports", ShieldCheck],
  ["Activity Logs", ShieldCheck]
];

const MOCK_TEST_NAV_SECTIONS = new Set([
  "Mock tests",
  "Create Exam Wise Test",
  "Manage Exam Wise Tests",
  "Create Topicwise Test",
  "Manage Topicwise Tests"
]);

// ============================================================================
// 3. MAIN APPLICATION ROOT SHELL
// ============================================================================
function AppShell() {
  // --------------------------------------------------------------------------
  // Core State Management
  // --------------------------------------------------------------------------
  const [user, setUser] = useState(null);               // Authenticated user object (id, email, fullName, role)
  const [loading, setLoading] = useState(true);           // Initial session verification loader
  const [active, setActive] = useState("Overview");       // Currently active navigation tab
  const [menuOpen, setMenuOpen] = useState(false);        // Mobile responsive sidebar toggle
  const [mockMenuOpen, setMockMenuOpen] = useState(true);
  const [examWiseMenuOpen, setExamWiseMenuOpen] = useState(true);
  const [topicwiseMenuOpen, setTopicwiseMenuOpen] = useState(true);
  const [lockedOutInfo, setLockedOutInfo] = useState(null); // Proctoring lockdown for duplicate browser tabs
  const [showAuth, setShowAuth] = useState(() => Boolean(new URLSearchParams(window.location.search).get("reset")));
  const [authMode, setAuthMode] = useState("login");
  const [publicPage, setPublicPage] = useState("home");
  const [redirectTest, setRedirectTest] = useState(null);
  const [autoOpenTestId, setAutoOpenTestId] = useState("");
  const [legalModalPage, setLegalModalPage] = useState("");
  const [publicConfig, setPublicConfig] = useState(null);

  // Unified Feedback Engine (Toast, Alert, ConfirmModal)
  const { toast, alert, confirm } = useFeedback();

  // --------------------------------------------------------------------------
  // Security: Single-Tab Lockdown Subscription (BroadcastChannel)
  // --------------------------------------------------------------------------
  useEffect(() => subscribeCompanionTabLock(setLockedOutInfo), []);
  useEffect(() => {
    fetch("/api/public/config").then((r) => (r.ok ? r.json() : null)).then((d) => setPublicConfig(d?.config ?? null)).catch(() => {});
  }, []);

  // --------------------------------------------------------------------------
  // Session Authentication: Check Active Cookie/Session with Backend
  // --------------------------------------------------------------------------
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (r) => (r.ok ? (await r.json()).user : null))
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // --------------------------------------------------------------------------
  // Universal Toast Dispatcher: Maps to Feedback Engine Toast Tiers
  // --------------------------------------------------------------------------
  function flash(message, type = "success") {
    if (!message) return;
    const text =
      typeof message === "object"
        ? message.message || message.error || JSON.stringify(message)
        : String(message);
    const toastType =
      typeof message === "object" && message.type ? message.type : type;

    if (toastType === "error") toast.error(text);
    else if (toastType === "warning") toast.warning(text);
    else if (toastType === "info") toast.info(text);
    else toast.success(text);
  }

  // --------------------------------------------------------------------------
  // User Sign-Out Handler
  // --------------------------------------------------------------------------
  async function signOut() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    }).catch(() => void 0);
    setUser(null);
    setShowAuth(false);
    setPublicPage("home");
    setActive("Overview");
    toast.info("You have been signed out successfully.");
  }

  // --------------------------------------------------------------------------
  // Screen 1: Exam Lockdown Screen (Prevents multiple tabs during mock tests)
  // --------------------------------------------------------------------------
  if (lockedOutInfo)
    return (
      <div className="cbt-locked-tab" role="alertdialog" aria-modal="true">
        <div className="panel">
          <span className="exam-pill">SINGLE-TAB EXAM LOCKDOWN</span>
          <h1>This companion tab has been locked</h1>
          <p>
            An active examination ({lockedOutInfo.testName}) is running in your
            primary browser tab. Other HHK tabs are automatically closed or
            locked to preserve exam integrity.
          </p>
          <button
            type="button"
            className="primary-btn"
            onClick={() => window.close()}
          >
            Close this tab
          </button>
        </div>
      </div>
    );

  // --------------------------------------------------------------------------
  // Screen 2: Initial App Session Loading Screen
  // --------------------------------------------------------------------------
  if (loading)
    return <div className="auth-loading">Loading your secure HHK workspace…</div>;

  // --------------------------------------------------------------------------
  // Screen 3: Unauthenticated State -> Render Authentication Flow (Login/Register)
  // --------------------------------------------------------------------------
  const legalOverlay = legalModalPage ? (
    <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ zIndex: 120 }}>
      <div style={{ width: "100%", maxWidth: 880, maxHeight: "90vh", overflowY: "auto" }}>
        {legalModalPage === "terms" && (
          <TermsPage config={publicConfig} onBack={() => setLegalModalPage("")} onNavigate={setLegalModalPage} />
        )}
        {legalModalPage === "privacy" && (
          <PrivacyPage config={publicConfig} onBack={() => setLegalModalPage("")} onNavigate={setLegalModalPage} />
        )}
        {legalModalPage === "refund-policy" && (
          <RefundPolicyPage config={publicConfig} onBack={() => setLegalModalPage("")} onNavigate={setLegalModalPage} />
        )}
        {legalModalPage === "contact" && (
          <ContactSupportPage config={publicConfig} user={user} onBack={() => setLegalModalPage("")} onToast={flash} />
        )}
      </div>
    </div>
  ) : null;

  if (!user) {
    if (!showAuth) {
      return (
        <>
          <PublicPortal
            initialPage={publicPage}
            onOpenAuth={(mode = "login") => {
              setRedirectTest(null);
              setAuthMode(mode);
              setShowAuth(true);
            }}
            onStartTestAsVisitor={(testObj) => {
              savePendingTestRedirect(testObj.id);
              setRedirectTest(testObj);
              setAuthMode("login");
              setShowAuth(true);
            }}
            onToast={flash}
          />
          {legalOverlay}
        </>
      );
    }
    return (
      <>
        <Suspense fallback={<div className="auth-loading">Loading HHK…</div>}>
          <AuthPage
            initialMode={authMode}
            redirectTest={redirectTest}
            onReturnToMockTests={() => {
              clearPendingTestRedirect();
              setRedirectTest(null);
              setPublicPage("mock-tests");
              setShowAuth(false);
            }}
            onOpenLegal={setLegalModalPage}
            onAuthenticated={(u) => {
              const targetTestId = redirectTest?.id || getPendingTestRedirect();
              clearPendingTestRedirect();
              setRedirectTest(null);
              setShowAuth(false);
              setUser(u);
              if (u.role === "admin") {
                setActive("Admin dashboard");
              } else if (targetTestId) {
                setAutoOpenTestId(targetTestId);
                setActive("Mock tests");
              } else {
                setActive("Overview");
              }
              flash(`Welcome back, ${u.fullName || u.email}!`, "success");
            }}
            onToast={flash}
          />
        </Suspense>
        {legalOverlay}
      </>
    );
  }

  // --------------------------------------------------------------------------
  // Screen 4: Authenticated Application Shell (Admin or Student Workspace)
  // --------------------------------------------------------------------------
  const pages = user.role === "admin" ? adminPages : studentPages;

  return (
    <div className="app-shell">
      {/* -------------------------------------------------------------------- */}
      {/* SIDEBAR NAVIGATION                                                    */}
      {/* -------------------------------------------------------------------- */}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        {/* App Logo & Brand Header */}
        <div className="brand">
          <img className="brand-logo" src="/logo.png" alt="HHK logo" />
          <span className="brand-name">HHK</span>
          <button
            className="mobile-close icon-btn"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Role Category Indicator */}
        <div className="workspace-label">
          {user.role === "admin" ? "ADMINISTRATION" : "STUDENT WORKSPACE"}
        </div>

        {/* Dynamic Nav Links (Filtered by Role) */}
        <nav
          className="main-nav"
          aria-label={user.role === "admin" ? "Admin navigation" : "Student navigation"}
        >
          {pages.map(([label, Icon]) => {
            if (label === "__MOCK_TEST_ACCORDION__") {
              const isMockActive = MOCK_TEST_NAV_SECTIONS.has(active);
              const isExamWiseActive =
                active === "Create Exam Wise Test" ||
                active === "Manage Exam Wise Tests" ||
                active === "Mock tests";
              const isTopicwiseActive =
                active === "Create Topicwise Test" ||
                active === "Manage Topicwise Tests";

              return (
                <div key="mock-test-accordion" className="nav-accordion">
                  <button
                    type="button"
                    className={`nav-link nav-accordion-trigger ${isMockActive ? "active-parent" : ""}`}
                    aria-expanded={mockMenuOpen}
                    onClick={() => setMockMenuOpen((v) => !v)}
                  >
                    <Target size={18} />
                    <span>Mock Test</span>
                    {mockMenuOpen ? (
                      <ChevronDown size={15} className="nav-chevron" />
                    ) : (
                      <ChevronRight size={15} className="nav-chevron" />
                    )}
                  </button>

                  {mockMenuOpen && (
                    <div className="nav-sub-group">
                      {/* Sub-Dropdown 1: Exam Wise Test */}
                      <button
                        type="button"
                        className={`nav-sub-trigger ${isExamWiseActive ? "active-parent" : ""}`}
                        aria-expanded={examWiseMenuOpen}
                        onClick={() => setExamWiseMenuOpen((v) => !v)}
                      >
                        <span>Exam Wise Test</span>
                        {examWiseMenuOpen ? (
                          <ChevronDown size={14} className="nav-chevron" />
                        ) : (
                          <ChevronRight size={14} className="nav-chevron" />
                        )}
                      </button>
                      {examWiseMenuOpen && (
                        <div className="nav-leaf-group">
                          <button
                            type="button"
                            className={`nav-leaf-link ${active === "Create Exam Wise Test" ? "active" : ""}`}
                            onClick={() => {
                              setActive("Create Exam Wise Test");
                              setMenuOpen(false);
                            }}
                          >
                            Create Exam Wise Test
                          </button>
                          <button
                            type="button"
                            className={`nav-leaf-link ${active === "Manage Exam Wise Tests" || active === "Mock tests" ? "active" : ""}`}
                            onClick={() => {
                              setActive("Manage Exam Wise Tests");
                              setMenuOpen(false);
                            }}
                          >
                            Manage Exam Wise Tests
                          </button>
                        </div>
                      )}

                      {/* Sub-Dropdown 2: Topicwise Test */}
                      <button
                        type="button"
                        className={`nav-sub-trigger ${isTopicwiseActive ? "active-parent" : ""}`}
                        aria-expanded={topicwiseMenuOpen}
                        onClick={() => setTopicwiseMenuOpen((v) => !v)}
                      >
                        <span>Topicwise Test</span>
                        {topicwiseMenuOpen ? (
                          <ChevronDown size={14} className="nav-chevron" />
                        ) : (
                          <ChevronRight size={14} className="nav-chevron" />
                        )}
                      </button>
                      {topicwiseMenuOpen && (
                        <div className="nav-leaf-group">
                          <button
                            type="button"
                            className={`nav-leaf-link ${active === "Create Topicwise Test" ? "active" : ""}`}
                            onClick={() => {
                              setActive("Create Topicwise Test");
                              setMenuOpen(false);
                            }}
                          >
                            Create Topicwise Test
                          </button>
                          <button
                            type="button"
                            className={`nav-leaf-link ${active === "Manage Topicwise Tests" ? "active" : ""}`}
                            onClick={() => {
                              setActive("Manage Topicwise Tests");
                              setMenuOpen(false);
                            }}
                          >
                            Manage Topicwise Tests
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={label}
                className={`nav-link ${active === label ? "active" : ""}`}
                onClick={() => {
                  setActive(label);
                  setMenuOpen(false);
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Student-Exclusive Sidebar Widgets (Target Exam Selector & Daily Streak) */}
        {user.role === "student" && (
          <>
            <div className="side-separator" />
            <div className="workspace-label">YOUR PREPARATION</div>
            <TargetExamSelector onToast={flash} />
            <div className="side-separator" />
            <SidebarStreak
              userId={user.id}
              onOpenAchievements={() => {
                setActive("Achievements");
                setMenuOpen(false);
              }}
            />
          </>
        )}

        {/* Bottom User Profile Card & Sign-Out Button */}
        <div className="sidebar-bottom">
          <button className="profile-row" onClick={signOut}>
            <div className="avatar">
              {(user.fullName || user.email || "U")
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div className="profile-copy">
              <strong>{user.fullName || "User"}</strong>
              <span>
                {user.role === "admin"
                  ? "Administrator · Sign out"
                  : "Student · Sign out"}
              </span>
            </div>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop Overlay */}
      {menuOpen && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MAIN CONTENT AREA & TOPBAR                                            */}
      {/* -------------------------------------------------------------------- */}
      <main className="main-area">
        {/* Top Header Bar: Mobile Hamburger, Breadcrumb, Top Actions */}
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-btn"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>HHK</span>
            <ChevronRight size={15} />
            <strong>{active}</strong>
          </div>

          <div className="top-actions">
            {/* Alert demonstration on Bell click */}
            <button
              className="icon-btn notification-btn"
              onClick={() => alert.warning("Banking Exam Update", "2026 examination syllabus and pattern models are fully synchronized.")}
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
            <div className="top-divider" />
            {/* Open Contact & Support on Help click */}
            <button
              className="help-btn"
              onClick={() => {
                if (user.role === "student") setActive("Contact & Support");
                else setLegalModalPage("contact");
              }}
            >
              <CircleHelp size={17} /> Help
            </button>
          </div>
        </header>

        {/* Workspace Views (Lazy Loaded Router) */}
        <div className="content">
          <Suspense
            fallback={<div className="auth-loading">Loading your workspace…</div>}
          >
            {user.role === "admin" && active === "Exam setup" ? (
              <AdminPanel
                section="Exam setup"
                onToast={flash}
                onAlert={alert.show}
                onConfirmModal={confirm}
                onNavigate={setActive}
              />
            ) : user.role === "admin" && active === "Question bank" ? (
              <AdminPanel
                section="Question bank"
                onToast={flash}
                onAlert={alert.show}
                onConfirmModal={confirm}
                onNavigate={setActive}
              />
            ) : user.role === "admin" ? (
              <AdminOverview
                section={active}
                onNavigate={setActive}
                onToast={flash}
                onAlert={alert.show}
                onConfirmModal={confirm}
              />
            ) : active === "Contact & Support" ? (
              <ContactSupportPage
                config={publicConfig}
                user={user}
                onBack={() => setActive("Overview")}
                onToast={flash}
              />
            ) : (
              <StudentWorkspace
                section={active}
                user={user}
                autoOpenTestId={autoOpenTestId}
                onClearAutoOpenTest={() => setAutoOpenTestId("")}
                onOpenLegal={setLegalModalPage}
                onNavigate={setActive}
                onToast={flash}
                onAlert={alert.show}
                onConfirmModal={confirm}
              />
            )}
          </Suspense>
        </div>
      </main>
      {legalOverlay}
    </div>
  );
}

// ============================================================================
// 4. MAIN APPLICATION ROOT WRAPPER (With Unified Feedback Provider)
// ============================================================================
export default function App() {
  return (
    <FeedbackProvider>
      <AppShell />
    </FeedbackProvider>
  );
}

// ============================================================================
// 5. TARGET EXAM SELECTOR WIDGET (Sidebar Component for Students)
// ============================================================================
// Allows students to select their primary target exam (e.g. IBPS PO, SBI Clerk)
function TargetExamSelector({ onToast }) {
  const [exams, setExams] = useState([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Fetch available exams catalogue and current user target exam profile
    Promise.all([
      fetch("/api/exams").then((r) => r.json()),
      fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json())
    ])
      .then(([e, m]) => {
        setExams(e.exams ?? []);
        setSelected(m.profile?.target_exam_id ?? "");
      })
      .catch(() => setError("Exam list unavailable"));

    // Listen to custom window sync events across components
    const onSync = (event) => {
      const next = event.detail ?? "";
      setSelected(next);
    };
    window.addEventListener("hhk:target-exam-updated", onSync);
    return () => window.removeEventListener("hhk:target-exam-updated", onSync);
  }, []);

  // Persist target exam selection to database
  async function change(id) {
    setSelected(id);
    try {
      const current = await fetch("/api/auth/me", {
        credentials: "include"
      }).then((r) => r.json());
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: current.user.fullName,
          mobile: current.user.mobile,
          targetExamId: id || null
        })
      });
      if (!response.ok) throw new Error();
      window.dispatchEvent(
        new CustomEvent("hhk:target-exam-updated", { detail: id })
      );
      onToast("Target examination saved.", "success");
    } catch {
      setError("Could not save target examination.");
      onToast("Could not save target examination.", "error");
    }
  }

  return (
    <div className="target-card">
      <div className="target-card-top">
        <span className="tiny-label">TARGET EXAM</span>
        <ChevronDown size={15} />
      </div>
      <select
        value={selected}
        onChange={(e) => change(e.target.value)}
        aria-label="Target examination"
      >
        <option value="">Choose target exam</option>
        <ExamOptGroups
          exams={exams}
          getKey={(e) => e.id}
          getValue={(e) => e.id}
          getLabel={(e) => e.name}
        />
      </select>
      <div className="target-date">
        <CalendarDays size={14} />
        {exams.length
          ? `${exams.length} banking exams available`
          : "No active exams in catalogue"}
      </div>
      {error && <small className="target-error">{error}</small>}
    </div>
  );
}

// ============================================================================
// 6. SIDEBAR STREAK WIDGET (Student Daily Practice Motivation Tracker)
// ============================================================================
// Polls and displays consecutive active study days with streak flames
function SidebarStreak({ userId, onOpenAchievements }) {
  const [streak, setStreak] = useState(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetch("/api/achievements", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active && d?.streak) setStreak(d.streak);
        })
        .catch(() => void 0);
    };
    load();

    // Auto-refresh streak periodically when tab is active
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 3e4);

    window.addEventListener("hhk:activity-updated", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("hhk:activity-updated", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [userId]);

  const days = streak?.currentDays ?? 0;
  const status = streak?.status ?? "inactive";
  const title =
    status === "active_today"
      ? `${days}-day streak active`
      : days > 0
      ? `Keep your ${days}-day streak`
      : "Start your daily streak";
  const subtitle =
    status === "active_today"
      ? `${streak?.todayQuestions ?? 0} solved today · View milestones`
      : days > 0
      ? "Solve 1 question today to extend"
      : "Solve a question to ignite today";

  return (
    <button
      type="button"
      className={`student-streak ${status}`}
      onClick={onOpenAchievements}
      title="Open live streaks and achievements"
    >
      <span>
        <Flame size={17} fill="currentColor" />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
    </button>
  );
}