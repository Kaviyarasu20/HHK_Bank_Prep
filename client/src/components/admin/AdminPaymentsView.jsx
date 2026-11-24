import { useEffect, useState } from "react";
import {
  BarChart3,
  CreditCard,
  Download,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Sliders,
} from "lucide-react";
import {
  PAYMENT_STATUS_META,
  REFUND_STATUS_META,
  formatDateTime,
  formatINR,
} from "../../utils/paymentHelpers";

async function adminApi(path, init = {}) {
  const res = await fetch(`/api/admin${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Admin payment request failed.");
  return data;
}

export function AdminPaymentsView({ onToast }) {
  const [tab, setTab] = useState("overview"); // overview | transactions | tests | plans | refunds | settings
  const [busy, setBusy] = useState(false);

  // Overview & Reports
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState(null);

  // Transactions
  const [transactions, setTransactions] = useState([]);
  const [txPagination, setTxPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [txSearch, setTxSearch] = useState("");
  const [txStatus, setTxStatus] = useState("ALL");

  // Mock Test Pricing Config
  const [testConfigs, setTestConfigs] = useState([]);
  const [editingTest, setEditingTest] = useState(null);

  // Subscription Plans
  const [plans, setPlans] = useState([]);
  const [planForm, setPlanForm] = useState({
    id: "",
    code: "",
    name: "",
    description: "",
    durationDays: 30,
    priceRupees: 199,
    promoPriceRupees: "",
    promoValidUntil: "",
    accessScope: "ALL_TESTS",
    featuresText: "Full access to all mock tests\nDetailed scorecard & analytics",
    isActive: true,
    isFeatured: false,
    sortOrder: 0,
  });

  // Refunds & Inquiries
  const [refunds, setRefunds] = useState([]);
  const [inquiries, setInquiries] = useState([]);

  // Global Payment Settings
  const [settings, setSettings] = useState(null);
  const [gatewayStatus, setGatewayStatus] = useState(null);

  async function loadTab(currentTab = tab) {
    setBusy(true);
    try {
      if (currentTab === "overview") {
        const [d, r] = await Promise.all([
          adminApi("/payments/dashboard"),
          adminApi("/payments/reports"),
        ]);
        setStats(d.stats);
        setReports(r);
      } else if (currentTab === "transactions") {
        const qs = new URLSearchParams({
          page: String(txPagination.page),
          status: txStatus,
        });
        if (txSearch.trim()) qs.set("search", txSearch.trim());
        const res = await adminApi(`/payments/transactions?${qs}`);
        setTransactions(res.transactions ?? []);
        setTxPagination(res.pagination ?? { page: 1, totalPages: 1, total: 0 });
      } else if (currentTab === "tests") {
        const [tRes, pRes] = await Promise.all([
          adminApi("/payments/tests-config"),
          adminApi("/payments/plans"),
        ]);
        setTestConfigs(tRes.tests ?? []);
        setPlans(pRes.plans ?? []);
      } else if (currentTab === "plans") {
        const pRes = await adminApi("/payments/plans");
        setPlans(pRes.plans ?? []);
      } else if (currentTab === "refunds") {
        const [rfRes, inqRes] = await Promise.all([
          adminApi("/payments/refunds"),
          adminApi("/payments/inquiries"),
        ]);
        setRefunds(rfRes.refunds ?? []);
        setInquiries(inqRes.inquiries ?? []);
      } else if (currentTab === "settings") {
        const cfg = await adminApi("/payments/config");
        setSettings(cfg.settings);
        setGatewayStatus(cfg.gatewayStatus);
      }
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadTab(tab);
  }, [tab, txStatus]);

  async function saveTestConfig(e) {
    e.preventDefault();
    if (!editingTest) return;
    setBusy(true);
    try {
      const pricePaise =
        editingTest.accessType === "FREE"
          ? 0
          : Math.round(Number(editingTest.priceRupees || 0) * 100);
      await adminApi(`/payments/tests-config/${editingTest.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          accessType: editingTest.accessType,
          pricePaise,
          currency: "INR",
          accessDurationDays: editingTest.accessDurationDays ? Number(editingTest.accessDurationDays) : null,
          isVisible: Boolean(editingTest.isVisible),
          isPurchasable: Boolean(editingTest.isPurchasable),
          promotionalFreeUntil: editingTest.promotionalFreeUntil
            ? new Date(editingTest.promotionalFreeUntil).toISOString()
            : null,
          difficultyLabel: editingTest.difficultyLabel || "Moderate",
          eligiblePlanIds: editingTest.eligiblePlanIds || [],
        }),
      });
      onToast?.("Mock test access & pricing updated cleanly.", "success");
      setEditingTest(null);
      loadTab("tests");
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function savePlan(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        code: planForm.code.trim().toUpperCase(),
        name: planForm.name.trim(),
        description: planForm.description.trim(),
        durationDays: Number(planForm.durationDays),
        pricePaise: Math.round(Number(planForm.priceRupees || 0) * 100),
        promoPricePaise:
          planForm.promoPriceRupees !== "" && planForm.promoPriceRupees !== null
            ? Math.round(Number(planForm.promoPriceRupees) * 100)
            : null,
        promoValidUntil: planForm.promoValidUntil
          ? new Date(planForm.promoValidUntil).toISOString()
          : null,
        currency: "INR",
        accessScope: planForm.accessScope,
        features: planForm.featuresText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        isActive: Boolean(planForm.isActive),
        isFeatured: Boolean(planForm.isFeatured),
        sortOrder: Number(planForm.sortOrder || 0),
        mockTestIds: [],
      };
      if (planForm.id) {
        await adminApi(`/payments/plans/${planForm.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        onToast?.("Subscription plan updated.", "success");
      } else {
        await adminApi("/payments/plans", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onToast?.("Subscription plan created.", "success");
      }
      setPlanForm({
        id: "",
        code: "",
        name: "",
        description: "",
        durationDays: 30,
        priceRupees: 199,
        promoPriceRupees: "",
        promoValidUntil: "",
        accessScope: "ALL_TESTS",
        featuresText: "Full access to all mock tests\nDetailed scorecard & analytics",
        isActive: true,
        isFeatured: false,
        sortOrder: 0,
      });
      loadTab("plans");
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function reviewRefund(refundId, decision) {
    let rejectionReason = "";
    if (decision === "REJECTED") {
      rejectionReason = window.prompt("Enter rejection reason for the student:") || "";
      if (!rejectionReason.trim()) return;
    }
    try {
      const res = await adminApi(`/payments/refunds/${refundId}/review`, {
        method: "PATCH",
        body: JSON.stringify({ decision, rejectionReason }),
      });
      onToast?.(res.message || `Refund marked ${decision}.`, "success");
      loadTab("refunds");
    } catch (err) {
      onToast?.(err.message, "error");
    }
  }

  async function initiateRefund(refundId) {
    if (!window.confirm("Initiate real refund through Razorpay gateway for this approved request?")) return;
    try {
      const res = await adminApi(`/payments/refunds/${refundId}/initiate`, { method: "POST" });
      onToast?.(res.message || "Refund initiated.", "success");
      loadTab("refunds");
    } catch (err) {
      onToast?.(err.message, "error");
    }
  }

  async function syncRefund(refundId) {
    try {
      const res = await adminApi(`/payments/refunds/${refundId}/sync`, { method: "POST" });
      onToast?.(`Gateway refund status: ${res.gatewayStatus}`, "info");
      loadTab("refunds");
    } catch (err) {
      onToast?.(err.message, "error");
    }
  }

  async function saveGlobalSettings(e) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    try {
      await adminApi("/payments/config", {
        method: "PUT",
        body: JSON.stringify({
          gatewayEnabled: Boolean(settings.gateway_enabled),
          gatewayMode: settings.gateway_mode,
          currency: "INR",
          allowIndividualTestPurchase: Boolean(settings.allow_individual_test_purchase),
          allowSubscriptionPurchase: Boolean(settings.allow_subscription_purchase),
          taxEnabled: Boolean(settings.tax_enabled),
          taxRateBps: Number(settings.tax_rate_bps || 0),
          taxLabel: settings.tax_label || "GST",
          refundWindowDays: Number(settings.refund_window_days || 0),
          refundProcessingDays: settings.refund_processing_days || "5-7 business days",
          supportEmail: settings.support_email || "",
          supportPhone: settings.support_phone || "",
          businessName: settings.business_name || "HHK Banking Examination Preparation Platform",
          businessAddress: settings.business_address || "",
          policyVersion: settings.policy_version || "1.0",
        }),
      });
      onToast?.("Global payment configuration saved.", "success");
      loadTab("settings");
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mock-mode-tabs" style={{ marginBottom: 18, flexWrap: "wrap" }}>
        {[
          ["overview", "Revenue & KPIs", BarChart3],
          ["transactions", "Transactions", CreditCard],
          ["tests", "Test Pricing & Access", Sliders],
          ["plans", "Subscription Plans", Plus],
          ["refunds", "Refunds & Support", RotateCcw],
          ["settings", "Payment Config", Settings],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            className={`mock-mode-tab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {busy && <div className="admin-loading">Syncing payment data…</div>}

      {/* TAB 1: KPI OVERVIEW & REVENUE REPORTS */}
      {tab === "overview" && stats && (
        <>
          <div className="payment-kpi-grid">
            <div className="payment-kpi-card"><span>Successful Payments</span><strong>{stats.total_successful_payments}</strong></div>
            <div className="payment-kpi-card"><span>Gross Collections</span><strong>{formatINR(stats.gross_revenue_paise)}</strong></div>
            <div className="payment-kpi-card"><span>Total Refunds</span><strong>{formatINR(stats.total_refund_paise)}</strong></div>
            <div className="payment-kpi-card"><span>Net Collections</span><strong>{formatINR(stats.net_revenue_paise)}</strong></div>
            <div className="payment-kpi-card"><span>Today&apos;s Revenue</span><strong>{formatINR(stats.today_revenue_paise)}</strong></div>
            <div className="payment-kpi-card"><span>Monthly Revenue</span><strong>{formatINR(stats.monthly_revenue_paise)}</strong></div>
            <div className="payment-kpi-card"><span>Pending Transactions</span><strong>{stats.pending_transactions}</strong></div>
            <div className="payment-kpi-card"><span>Failed Transactions</span><strong>{stats.failed_transactions}</strong></div>
            <div className="payment-kpi-card"><span>Active Paid Subscriptions</span><strong>{stats.active_paid_subscriptions}</strong></div>
          </div>

          {reports && (
            <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
              <h2 style={{ marginBottom: 12 }}>Revenue Summary (Verified Collections Only)</h2>
              <div className="payment-table-wrap">
                <table className="payment-table">
                  <thead>
                    <tr><th>Period</th><th>Gross Collections</th><th>Net Collections</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Today (Daily)</td><td>{formatINR(reports.periods?.daily_gross_paise)}</td><td><strong>{formatINR(reports.periods?.daily_net_paise)}</strong></td></tr>
                    <tr><td>Last 7 Days (Weekly)</td><td>{formatINR(reports.periods?.weekly_gross_paise)}</td><td><strong>{formatINR(reports.periods?.weekly_net_paise)}</strong></td></tr>
                    <tr><td>This Month (Monthly)</td><td>{formatINR(reports.periods?.monthly_gross_paise)}</td><td><strong>{formatINR(reports.periods?.monthly_net_paise)}</strong></td></tr>
                    <tr><td>This Year (Yearly)</td><td>{formatINR(reports.periods?.yearly_gross_paise)}</td><td><strong>{formatINR(reports.periods?.yearly_net_paise)}</strong></td></tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ marginTop: 22, marginBottom: 10 }}>Plan &amp; Test-Wise Revenue</h3>
              {reports.planWise?.length ? (
                <div className="payment-table-wrap">
                  <table className="payment-table">
                    <thead>
                      <tr><th>Item</th><th>Type</th><th>Purchases</th><th>Gross</th><th>Refunded</th><th>Net</th></tr>
                    </thead>
                    <tbody>
                      {reports.planWise.map((p, idx) => (
                        <tr key={idx}>
                          <td><strong>{p.item_title}</strong></td>
                          <td>{p.item_type}</td>
                          <td>{p.purchase_count}</td>
                          <td>{formatINR(p.gross_paise)}</td>
                          <td>{formatINR(p.refunded_paise)}</td>
                          <td><strong>{formatINR(p.net_paise)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: "#5b5e75" }}>No verified purchases recorded yet.</p>
              )}
            </div>
          )}
        </>
      )}

      {/* TAB 2: TRANSACTION MANAGEMENT */}
      {tab === "transactions" && (
        <div className="panel" style={{ padding: 20 }}>
          <div className="payment-filters-bar">
            <input
              placeholder="Search student, email, Txn ID, Order #…"
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              style={{ minWidth: 260 }}
            />
            <select value={txStatus} onChange={(e) => setTxStatus(e.target.value)}>
              <option value="ALL">All Statuses</option>
              {Object.entries(PAYMENT_STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button type="button" className="primary-btn" onClick={() => loadTab("transactions")}>
              Search
            </button>
            <a
              className="ghost-btn"
              href={`/api/admin/payments/transactions/export?status=${encodeURIComponent(txStatus)}`}
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} /> Export CSV
            </a>
          </div>

          <div className="payment-table-wrap">
            <table className="payment-table">
              <thead>
                <tr>
                  <th>Order / Txn</th>
                  <th>Student</th>
                  <th>Item</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Refund</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const st = t.transaction_status || t.order_status;
                  const meta = PAYMENT_STATUS_META[st] || { label: st, tone: "neutral" };
                  return (
                    <tr key={t.order_id}>
                      <td>
                        <strong>{t.transaction_code || "—"}</strong>
                        <div style={{ fontSize: 12, color: "#6a6d85" }}>{t.order_number}</div>
                      </td>
                      <td>
                        <strong>{t.student_name}</strong>
                        <div style={{ fontSize: 12, color: "#6a6d85" }}>{t.student_email}</div>
                      </td>
                      <td>{t.item_title}</td>
                      <td><strong>{formatINR(t.total_amount_paise, t.currency)}</strong></td>
                      <td>{t.payment_method ? t.payment_method.toUpperCase() : "—"}</td>
                      <td><span className={`status-pill ${meta.tone}`}>{meta.label}</span></td>
                      <td>{t.refund_status || "—"}</td>
                      <td>{formatDateTime(t.verified_at || t.created_at)}</td>
                    </tr>
                  );
                })}
                {!transactions.length && (
                  <tr><td colSpan={8} style={{ color: "#5b5e75" }}>No transactions match the selected filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ADMIN-CONTROLLED MOCK TEST PRICING & ACCESS */}
      {tab === "tests" && (
        <div className="panel" style={{ padding: 20 }}>
          <h2 style={{ marginBottom: 6 }}>Individual Mock Test Access &amp; Pricing Configuration</h2>
          <p style={{ color: "#5b5e75", fontSize: 13.5, marginBottom: 16 }}>
            Dynamically switch any test between FREE, PAID, SUBSCRIPTION, or PROMOTIONAL without redeploying.
            Existing student entitlements and past transactions are strictly preserved.
          </p>

          <div className="payment-table-wrap">
            <table className="payment-table">
              <thead>
                <tr>
                  <th>Mock Test</th>
                  <th>Category</th>
                  <th>Access Type</th>
                  <th>Price</th>
                  <th>Visible</th>
                  <th>Active Buyers</th>
                  <th>Configure</th>
                </tr>
              </thead>
              <tbody>
                {testConfigs.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.name}</strong>
                      <div style={{ fontSize: 12, color: "#6a6d85" }}>{t.test_type} · {t.set_label}</div>
                    </td>
                    <td>{t.exam_name || `${t.subject} / ${t.topic}`}</td>
                    <td>
                      <span className={`access-badge ${t.access_type === "FREE" ? "free" : t.access_type === "SUBSCRIPTION" ? "subscription" : "paid"}`}>
                        {t.access_type}
                      </span>
                    </td>
                    <td><strong>{formatINR(t.price_paise, t.currency)}</strong></td>
                    <td>{t.is_visible ? "Public" : "Hidden"}</td>
                    <td>{t.active_purchasers}</td>
                    <td>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() =>
                          setEditingTest({
                            id: t.id,
                            name: t.name,
                            accessType: t.access_type || "FREE",
                            priceRupees: Number(t.price_paise || 0) / 100,
                            accessDurationDays: t.access_duration_days || "",
                            isVisible: Boolean(t.is_visible),
                            isPurchasable: Boolean(t.is_purchasable),
                            promotionalFreeUntil: t.promotional_free_until
                              ? new Date(t.promotional_free_until).toISOString().slice(0, 16)
                              : "",
                            difficultyLabel: t.difficulty_label || "Moderate",
                            eligiblePlanIds: t.eligible_plan_ids || [],
                          })
                        }
                      >
                        Edit Pricing
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingTest && (
            <div className="modal-backdrop" role="dialog" aria-modal="true">
              <form className="panel checkout-modal-card contact-form" onSubmit={saveTestConfig}>
                <div className="checkout-modal-head">
                  <div>
                    <span className="eyebrow">CONFIGURE MOCK TEST</span>
                    <h2>{editingTest.name}</h2>
                  </div>
                  <button type="button" className="icon-btn" onClick={() => setEditingTest(null)}>✕</button>
                </div>
                <div className="form-row-2">
                  <label>
                    Access Type
                    <select
                      value={editingTest.accessType}
                      onChange={(e) => setEditingTest({ ...editingTest, accessType: e.target.value })}
                    >
                      <option value="FREE">FREE (Login Required, ₹0)</option>
                      <option value="PAID">PAID (Individual Purchase or Plan)</option>
                      <option value="SUBSCRIPTION">SUBSCRIPTION ONLY</option>
                      <option value="PROMOTIONAL">PROMOTIONAL FREE</option>
                    </select>
                  </label>
                  <label>
                    Price (INR ₹)
                    <input
                      type="number"
                      min={0}
                      step="1"
                      disabled={editingTest.accessType === "FREE"}
                      value={editingTest.accessType === "FREE" ? 0 : editingTest.priceRupees}
                      onChange={(e) => setEditingTest({ ...editingTest, priceRupees: e.target.value })}
                    />
                  </label>
                </div>
                <div className="form-row-2">
                  <label>
                    Access Duration (days, blank = lifetime)
                    <input
                      type="number"
                      min={1}
                      placeholder="Lifetime"
                      value={editingTest.accessDurationDays}
                      onChange={(e) => setEditingTest({ ...editingTest, accessDurationDays: e.target.value })}
                    />
                  </label>
                  <label>
                    Difficulty Label
                    <select
                      value={editingTest.difficultyLabel}
                      onChange={(e) => setEditingTest({ ...editingTest, difficultyLabel: e.target.value })}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Hard">Hard</option>
                      <option value="Exam Level">Exam Level</option>
                    </select>
                  </label>
                </div>
                <label>
                  Promotional Free Until (optional)
                  <input
                    type="datetime-local"
                    value={editingTest.promotionalFreeUntil}
                    onChange={(e) => setEditingTest({ ...editingTest, promotionalFreeUntil: e.target.value })}
                  />
                </label>
                <div style={{ display: "flex", gap: 18 }}>
                  <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={editingTest.isVisible}
                      onChange={(e) => setEditingTest({ ...editingTest, isVisible: e.target.checked })}
                    />
                    Visible in Public Catalogue
                  </label>
                  <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={editingTest.isPurchasable}
                      onChange={(e) => setEditingTest({ ...editingTest, isPurchasable: e.target.checked })}
                    />
                    Allow Individual Purchase
                  </label>
                </div>
                <div className="checkout-modal-actions">
                  <button type="button" className="ghost-btn" onClick={() => setEditingTest(null)}>Cancel</button>
                  <button type="submit" className="primary-btn" disabled={busy}><Save size={15} /> Save Configuration</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SUBSCRIPTION PLAN MANAGEMENT */}
      {tab === "plans" && (
        <div style={{ display: "grid", gap: 20 }}>
          <form className="panel" style={{ padding: 22 }} onSubmit={savePlan}>
            <h2 style={{ marginBottom: 12 }}>{planForm.id ? "Edit Subscription Plan" : "Create Subscription Plan"}</h2>
            <div className="payment-form-grid">
              <label>
                Plan Code
                <input required placeholder="e.g. PRO_90" value={planForm.code} onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })} />
              </label>
              <label>
                Plan Name
                <input required placeholder="e.g. Standard 90 Days" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
              </label>
              <label>
                Duration (Days)
                <input type="number" required min={1} value={planForm.durationDays} onChange={(e) => setPlanForm({ ...planForm, durationDays: e.target.value })} />
              </label>
              <label>
                Price (INR ₹)
                <input type="number" required min={0} step="1" value={planForm.priceRupees} onChange={(e) => setPlanForm({ ...planForm, priceRupees: e.target.value })} />
              </label>
              <label>
                Promo Price (INR ₹, optional)
                <input type="number" min={0} step="1" value={planForm.promoPriceRupees} onChange={(e) => setPlanForm({ ...planForm, promoPriceRupees: e.target.value })} />
              </label>
              <label>
                Access Scope
                <select value={planForm.accessScope} onChange={(e) => setPlanForm({ ...planForm, accessScope: e.target.value })}>
                  <option value="ALL_TESTS">All Published Mock Tests</option>
                  <option value="SELECTED_TESTS">Selected Mock Tests Only</option>
                  <option value="LIMITED_COUNT">Limited Count Access</option>
                </select>
              </label>
            </div>
            <div className="form-row-2" style={{ marginTop: 12 }}>
              <label>
                Description
                <input value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
              </label>
              <label>
                Features (one per line)
                <textarea rows={3} value={planForm.featuresText} onChange={(e) => setPlanForm({ ...planForm, featuresText: e.target.value })} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={planForm.isActive} onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })} /> Active
              </label>
              <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={planForm.isFeatured} onChange={(e) => setPlanForm({ ...planForm, isFeatured: e.target.checked })} /> Highlight as Popular
              </label>
              <button type="submit" className="primary-btn" disabled={busy}>
                <Save size={15} /> {planForm.id ? "Update Plan" : "Create Plan"}
              </button>
            </div>
          </form>

          <div className="panel" style={{ padding: 20 }}>
            <h2 style={{ marginBottom: 12 }}>Configured Subscription Plans</h2>
            <div className="payment-table-wrap">
              <table className="payment-table">
                <thead>
                  <tr><th>Code</th><th>Name</th><th>Duration</th><th>Price</th><th>Scope</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id}>
                      <td><code>{p.code}</code></td>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.duration_days} days</td>
                      <td>{formatINR(p.price_paise, p.currency)}{p.promo_price_paise != null ? ` (Promo: ${formatINR(p.promo_price_paise, p.currency)})` : ""}</td>
                      <td>{p.access_scope}</td>
                      <td><span className={`status-pill ${p.is_active ? "success" : "neutral"}`}>{p.is_active ? "Active" : "Inactive"}</span></td>
                      <td>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() =>
                            setPlanForm({
                              id: p.id,
                              code: p.code,
                              name: p.name,
                              description: p.description || "",
                              durationDays: p.duration_days,
                              priceRupees: Number(p.price_paise) / 100,
                              promoPriceRupees: p.promo_price_paise != null ? Number(p.promo_price_paise) / 100 : "",
                              promoValidUntil: p.promo_valid_until ? new Date(p.promo_valid_until).toISOString().slice(0, 16) : "",
                              accessScope: p.access_scope,
                              featuresText: Array.isArray(p.features) ? p.features.join("\n") : "",
                              isActive: Boolean(p.is_active),
                              isFeatured: Boolean(p.is_featured),
                              sortOrder: p.sort_order || 0,
                            })
                          }
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!plans.length && <tr><td colSpan={7} style={{ color: "#5b5e75" }}>No subscription plans created yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: REFUND MANAGEMENT & SUPPORT INQUIRIES */}
      {tab === "refunds" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel" style={{ padding: 20 }}>
            <h2 style={{ marginBottom: 12 }}>Refund Requests</h2>
            <div className="payment-table-wrap">
              <table className="payment-table">
                <thead>
                  <tr><th>Student</th><th>Transaction / Item</th><th>Amount</th><th>Reason</th><th>Status</th><th>Gateway ID</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {refunds.map((r) => {
                    const meta = REFUND_STATUS_META[r.status] || { label: r.status, tone: "neutral" };
                    return (
                      <tr key={r.id}>
                        <td><strong>{r.student_name}</strong><div style={{ fontSize: 12, color: "#6a6d85" }}>{r.student_email}</div></td>
                        <td><strong>{r.transaction_code}</strong><div style={{ fontSize: 12, color: "#6a6d85" }}>{r.item_title}</div></td>
                        <td><strong>{formatINR(r.requested_amount_paise, r.currency)}</strong></td>
                        <td><div>{r.reason_category}</div><small style={{ color: "#5b5e75" }}>{r.reason_details}</small></td>
                        <td><span className={`status-pill ${meta.tone}`}>{meta.label}</span></td>
                        <td>{r.gateway_refund_id || "—"}</td>
                        <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {r.status === "REQUESTED" && (
                            <button type="button" className="ghost-btn" onClick={() => reviewRefund(r.id, "UNDER_REVIEW")}>Review</button>
                          )}
                          {["REQUESTED", "UNDER_REVIEW"].includes(r.status) && (
                            <>
                              <button type="button" className="primary-btn" onClick={() => reviewRefund(r.id, "APPROVED")}>Approve</button>
                              <button type="button" className="ghost-btn" onClick={() => reviewRefund(r.id, "REJECTED")}>Reject</button>
                            </>
                          )}
                          {["APPROVED", "FAILED"].includes(r.status) && !r.gateway_refund_id && (
                            <button type="button" className="primary-btn" onClick={() => initiateRefund(r.id)}>Initiate Razorpay Refund</button>
                          )}
                          {r.status === "REFUND_INITIATED" && (
                            <button type="button" className="ghost-btn" onClick={() => syncRefund(r.id)}>
                              <RefreshCw size={13} /> Sync Gateway Status
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!refunds.length && <tr><td colSpan={7} style={{ color: "#5b5e75" }}>No refund requests yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel" style={{ padding: 20 }}>
            <h2 style={{ marginBottom: 12 }}>Student Support &amp; Payment Inquiries</h2>
            <div className="payment-table-wrap">
              <table className="payment-table">
                <thead>
                  <tr><th>Date</th><th>Name / Email</th><th>Category</th><th>Txn ID</th><th>Subject &amp; Message</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {inquiries.map((inq) => (
                    <tr key={inq.id}>
                      <td>{formatDateTime(inq.created_at)}</td>
                      <td><strong>{inq.full_name}</strong><div style={{ fontSize: 12 }}>{inq.email}</div></td>
                      <td>{inq.category}</td>
                      <td>{inq.transaction_id || "—"}</td>
                      <td><strong>{inq.subject}</strong><div style={{ fontSize: 12, color: "#5b5e75" }}>{inq.message}</div></td>
                      <td><span className="status-pill info">{inq.status}</span></td>
                    </tr>
                  ))}
                  {!inquiries.length && <tr><td colSpan={6} style={{ color: "#5b5e75" }}>No support inquiries submitted yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: GLOBAL PAYMENT CONFIGURATION */}
      {tab === "settings" && settings && (
        <form className="panel" style={{ padding: 22 }} onSubmit={saveGlobalSettings}>
          <div className="payment-banner info" style={{ marginTop: 0, marginBottom: 18 }}>
            <ShieldCheck size={18} />
            <div>
              <strong>Server-Side Razorpay Credential Status (Secrets Never Exposed Here)</strong>
              <span>
                API Keys: {gatewayStatus?.isConfigured ? `Configured (${gatewayStatus.keyIdMasked}, ${gatewayStatus.detectedMode.toUpperCase()} mode)` : "Not Configured in server .env"} ·
                Webhook Secret: {gatewayStatus?.hasWebhookSecret ? "Configured" : "Not Configured"}
              </span>
            </div>
          </div>

          <div className="payment-form-grid">
            <label>
              Gateway Mode
              <select value={settings.gateway_mode} onChange={(e) => setSettings({ ...settings, gateway_mode: e.target.value })}>
                <option value="test">Test Mode (Sandbox)</option>
                <option value="live">Live Mode (Production)</option>
              </select>
            </label>
            <label>
              Tax Label
              <input value={settings.tax_label || "GST"} onChange={(e) => setSettings({ ...settings, tax_label: e.target.value })} />
            </label>
            <label>
              Tax Rate (basis points, e.g. 1800 = 18%)
              <input type="number" min={0} max={5000} value={settings.tax_rate_bps} onChange={(e) => setSettings({ ...settings, tax_rate_bps: e.target.value })} />
            </label>
            <label>
              Refund Window (Days)
              <input type="number" min={0} max={365} value={settings.refund_window_days} onChange={(e) => setSettings({ ...settings, refund_window_days: e.target.value })} />
            </label>
            <label>
              Refund Processing Timeline Text
              <input value={settings.refund_processing_days || ""} onChange={(e) => setSettings({ ...settings, refund_processing_days: e.target.value })} />
            </label>
            <label>
              Policy Version
              <input value={settings.policy_version || "1.0"} onChange={(e) => setSettings({ ...settings, policy_version: e.target.value })} />
            </label>
            <label>
              Official Support Email
              <input type="email" value={settings.support_email || ""} onChange={(e) => setSettings({ ...settings, support_email: e.target.value })} />
            </label>
            <label>
              Support Phone (optional)
              <input value={settings.support_phone || ""} onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })} />
            </label>
            <label>
              Business Name
              <input value={settings.business_name || ""} onChange={(e) => setSettings({ ...settings, business_name: e.target.value })} />
            </label>
            <label>
              Business Address (optional)
              <input value={settings.business_address || ""} onChange={(e) => setSettings({ ...settings, business_address: e.target.value })} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={Boolean(settings.gateway_enabled)} onChange={(e) => setSettings({ ...settings, gateway_enabled: e.target.checked })} /> Enable Online Payments
            </label>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={Boolean(settings.allow_individual_test_purchase)} onChange={(e) => setSettings({ ...settings, allow_individual_test_purchase: e.target.checked })} /> Allow Individual Test Purchases
            </label>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={Boolean(settings.allow_subscription_purchase)} onChange={(e) => setSettings({ ...settings, allow_subscription_purchase: e.target.checked })} /> Allow Subscription Purchases
            </label>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={Boolean(settings.tax_enabled)} onChange={(e) => setSettings({ ...settings, tax_enabled: e.target.checked })} /> Enable Tax Calculation
            </label>
          </div>

          <div style={{ marginTop: 18 }}>
            <button type="submit" className="primary-btn" disabled={busy}>
              <Save size={15} /> Save Global Payment Configuration
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
