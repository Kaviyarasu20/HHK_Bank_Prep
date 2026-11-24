import { useEffect, useState } from "react";
import {
  Check,
  CreditCard,
  Download,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  PAYMENT_STATUS_META,
  REFUND_STATUS_META,
  formatDateOnly,
  formatDateTime,
  formatINR,
  openPrintableReceipt,
} from "../../utils/paymentHelpers";
import { CheckoutModal } from "./CheckoutModal";

export function StudentPaymentsView({
  mode = "history", // "purchases" | "history"
  onToast,
  onOpenLegal,
}) {
  const [tab, setTab] = useState(mode === "purchases" ? "purchases" : "history");
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState("");
  const [entitlements, setEntitlements] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundReason, setRefundReason] = useState("DUPLICATE_PAYMENT");
  const [refundDetails, setRefundDetails] = useState("");

  useEffect(() => {
    setTab(mode === "purchases" ? "purchases" : "history");
  }, [mode]);

  async function loadAll(pageNum = 1, statusVal = statusFilter) {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ page: String(pageNum), limit: "15" });
      if (statusVal) qs.set("status", statusVal);
      const [hRes, pRes, rRes, plRes] = await Promise.all([
        fetch(`/api/payments/history?${qs}`, { credentials: "include" }).then((r) => r.json()),
        fetch("/api/payments/purchases", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/payments/refunds", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/public/plans", { credentials: "include" }).then((r) => r.json()),
      ]);
      setHistory(hRes.transactions ?? []);
      setPagination(hRes.pagination ?? { page: 1, totalPages: 1, total: 0 });
      setEntitlements(pRes.entitlements ?? []);
      setSubscriptions(pRes.subscriptions ?? []);
      setRefunds(rRes.refunds ?? []);
      setPlans(plRes.plans ?? []);
    } catch (err) {
      onToast?.(err.message || "Failed to load payment records.", "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadAll(1, statusFilter);
  }, [statusFilter]);

  async function downloadReceipt(transactionId) {
    try {
      const res = await fetch(`/api/payments/transactions/${transactionId}/receipt`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not load receipt.");
      openPrintableReceipt(data.receipt);
    } catch (err) {
      onToast?.(err.message, "error");
    }
  }

  async function reconcileOrder(orderId) {
    try {
      const res = await fetch(`/api/payments/orders/${orderId}/reconcile`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Reconciliation failed.");
      onToast?.(`Order reconciled. Current status: ${data.status}`, "info");
      loadAll(pagination.page, statusFilter);
    } catch (err) {
      onToast?.(err.message, "error");
    }
  }

  async function submitRefundRequest(e) {
    e.preventDefault();
    if (!refundTarget) return;
    setBusy(true);
    try {
      const res = await fetch("/api/payments/refunds", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: refundTarget.transaction_id,
          reasonCategory: refundReason,
          reasonDetails: refundDetails,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not submit refund request.");
      onToast?.(data.message || "Refund request submitted.", "success");
      setRefundTarget(null);
      setRefundDetails("");
      loadAll(pagination.page, statusFilter);
    } catch (err) {
      onToast?.(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const activeSubscription = subscriptions.find(
    (s) => s.status === "ACTIVE" && new Date(s.expires_at) > new Date(),
  );

  return (
    <div>
      <div className="student-welcome">
        <div>
          <div className="eyebrow">BILLING &amp; ENTITLEMENTS</div>
          <h1>{tab === "purchases" ? "My Purchases & Subscription" : tab === "refunds" ? "My Refund Requests" : "Payment History"}</h1>
          <p>View your active subscription, purchased mock tests, verified receipts, and refund tracking.</p>
        </div>
      </div>

      <div className="mock-mode-tabs" style={{ marginBottom: 18 }}>
        <button type="button" className={`mock-mode-tab ${tab === "purchases" ? "active" : ""}`} onClick={() => setTab("purchases")}>
          <Sparkles size={15} /> Purchases &amp; Subscription
        </button>
        <button type="button" className={`mock-mode-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          <CreditCard size={15} /> Payment History ({pagination.total})
        </button>
        <button type="button" className={`mock-mode-tab ${tab === "refunds" ? "active" : ""}`} onClick={() => setTab("refunds")}>
          <RotateCcw size={15} /> Refunds ({refunds.length})
        </button>
      </div>

      {tab === "purchases" && (
        <>
          {/* Current Subscription Card */}
          <div className="panel" style={{ padding: 22, marginBottom: 20 }}>
            <div className="eyebrow">MY SUBSCRIPTION</div>
            {activeSubscription ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
                <div>
                  <h2 style={{ marginBottom: 4 }}>{activeSubscription.plan_name}</h2>
                  <p style={{ color: "#5b5e75", marginBottom: 6 }}>
                    Active from <strong>{formatDateOnly(activeSubscription.starts_at)}</strong> until{" "}
                    <strong>{formatDateOnly(activeSubscription.expires_at)}</strong>
                  </p>
                  <span className="status-pill success">ACTIVE</span>
                </div>
                <button type="button" className="ghost-btn" onClick={() => setTab("history")}>
                  View Billing Receipts
                </button>
              </div>
            ) : (
              <p style={{ color: "#5b5e75", marginBottom: 0 }}>
                You do not have an active subscription plan right now. Choose a plan below to unlock paid mock tests.
              </p>
            )}
          </div>

          {/* Available Subscription Plans */}
          {plans.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ marginBottom: 12 }}>Available Subscription Plans</h2>
              <div className="pricing-grid">
                {plans.map((p) => {
                  const hasPromo =
                    p.promo_price_paise != null &&
                    (!p.promo_valid_until || new Date(p.promo_valid_until) > new Date());
                  return (
                    <div className={`panel pricing-card ${p.is_featured ? "featured" : ""}`} key={p.id}>
                      <div>
                        <span className="exam-pill">{p.duration_days} Days</span>
                        <h3 style={{ margin: "10px 0 6px" }}>{p.name}</h3>
                        <p style={{ fontSize: 13.5, color: "#5b5e75" }}>{p.description}</p>
                        <div className="pricing-price" style={{ fontSize: 26, margin: "10px 0" }}>
                          {formatINR(hasPromo ? p.promo_price_paise : p.price_paise, p.currency)}
                          {hasPromo && <span className="pricing-strike">{formatINR(p.price_paise, p.currency)}</span>}
                        </div>
                        <ul className="pricing-features">
                          {(Array.isArray(p.features) ? p.features : []).map((f, i) => (
                            <li key={i}><Check size={14} color="#6557dc" /> <span>{f}</span></li>
                          ))}
                        </ul>
                      </div>
                      <button type="button" className="primary-btn" onClick={() => setCheckoutPlan(p)}>
                        {activeSubscription ? "Renew / Upgrade Plan" : "Subscribe Now"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Individual Purchased Mock Tests */}
          <div className="panel" style={{ padding: 22 }}>
            <h2 style={{ marginBottom: 12 }}>My Purchased Mock Tests</h2>
            {entitlements.length ? (
              <div className="payment-table-wrap">
                <table className="payment-table">
                  <thead>
                    <tr>
                      <th>Mock Test</th>
                      <th>Purchase Date</th>
                      <th>Amount</th>
                      <th>Access Validity</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entitlements.map((e) => (
                      <tr key={e.id}>
                        <td><strong>{e.test_name}</strong><div style={{ fontSize: 12, color: "#6a6d85" }}>{e.transaction_code || e.source}</div></td>
                        <td>{formatDateTime(e.granted_at)}</td>
                        <td>{e.total_amount_paise != null ? formatINR(e.total_amount_paise, e.currency) : "—"}</td>
                        <td>{e.expires_at ? `Until ${formatDateOnly(e.expires_at)}` : "Lifetime Access"}</td>
                        <td><span className={`status-pill ${e.status === "ACTIVE" ? "success" : "neutral"}`}>{e.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: "#5b5e75", marginBottom: 0 }}>No individual mock test purchases yet.</p>
            )}
          </div>
        </>
      )}

      {tab === "history" && (
        <div className="panel" style={{ padding: 20 }}>
          <div className="payment-filters-bar">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by payment status">
              <option value="">All Payment Statuses</option>
              {Object.entries(PAYMENT_STATUS_META).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
            <button type="button" className="ghost-btn" onClick={() => loadAll(pagination.page, statusFilter)} disabled={busy}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {history.length ? (
            <>
              <div className="payment-table-wrap">
                <table className="payment-table">
                  <thead>
                    <tr>
                      <th>Transaction / Order</th>
                      <th>Date</th>
                      <th>Plan / Test</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Refund</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => {
                      const effStatus = row.transaction_status || row.order_status;
                      const stMeta = PAYMENT_STATUS_META[effStatus] || { label: effStatus, tone: "neutral" };
                      const rfMeta = row.refund_status ? REFUND_STATUS_META[row.refund_status] : null;
                      return (
                        <tr key={row.order_id}>
                          <td>
                            <strong>{row.transaction_code || "Pending Txn"}</strong>
                            <div style={{ fontSize: 12, color: "#6a6d85" }}>{row.order_number}</div>
                          </td>
                          <td>{formatDateTime(row.verified_at || row.order_date)}</td>
                          <td>{row.item_title}</td>
                          <td><strong>{formatINR(row.total_amount_paise, row.currency)}</strong></td>
                          <td>{row.payment_method ? row.payment_method.toUpperCase() : "—"}</td>
                          <td><span className={`status-pill ${stMeta.tone}`}>{stMeta.label}</span></td>
                          <td>{rfMeta ? <span className={`status-pill ${rfMeta.tone}`}>{rfMeta.label}</span> : "—"}</td>
                          <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {row.transaction_id && ["SUCCESSFUL", "PARTIALLY_REFUNDED", "REFUNDED"].includes(effStatus) && (
                              <button type="button" className="ghost-btn" onClick={() => downloadReceipt(row.transaction_id)}>
                                <Download size={13} /> Receipt
                              </button>
                            )}
                            {row.transaction_id && ["SUCCESSFUL", "PARTIALLY_REFUNDED"].includes(effStatus) && !row.refund_status && (
                              <button type="button" className="ghost-btn" onClick={() => setRefundTarget(row)}>
                                Request Refund
                              </button>
                            )}
                            {["PENDING", "PROCESSING"].includes(effStatus) && (
                              <button type="button" className="ghost-btn" onClick={() => reconcileOrder(row.order_id)}>
                                <RefreshCw size={13} /> Verify
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {pagination.totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                  <span style={{ fontSize: 13, color: "#5b5e75" }}>
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="ghost-btn" disabled={pagination.page <= 1} onClick={() => loadAll(pagination.page - 1)}>
                      Previous
                    </button>
                    <button type="button" className="ghost-btn" disabled={pagination.page >= pagination.totalPages} onClick={() => loadAll(pagination.page + 1)}>
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "#5b5e75" }}>No payment transactions found.</p>
          )}
        </div>
      )}

      {tab === "refunds" && (
        <div className="panel" style={{ padding: 20 }}>
          {refunds.length ? (
            <div className="payment-table-wrap">
              <table className="payment-table">
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Item</th>
                    <th>Requested Amount</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Gateway Refund ID</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((r) => {
                    const meta = REFUND_STATUS_META[r.status] || { label: r.status, tone: "neutral" };
                    return (
                      <tr key={r.id}>
                        <td><strong>{r.transaction_code}</strong><div style={{ fontSize: 12, color: "#6a6d85" }}>{r.order_number}</div></td>
                        <td>{r.item_title}</td>
                        <td><strong>{formatINR(r.requested_amount_paise, r.currency)}</strong></td>
                        <td>
                          <div>{r.reason_category.replaceAll("_", " ")}</div>
                          {r.rejection_reason && <small style={{ color: "#b91c1c" }}>Rejected: {r.rejection_reason}</small>}
                        </td>
                        <td><span className={`status-pill ${meta.tone}`}>{meta.label}</span></td>
                        <td>{r.gateway_refund_id || "—"}</td>
                        <td>{formatDateTime(r.updated_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "#5b5e75", marginBottom: 0 }}>You have not submitted any refund requests.</p>
          )}
        </div>
      )}

      {/* Refund Request Modal */}
      {refundTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="panel checkout-modal-card contact-form" onSubmit={submitRefundRequest}>
            <div className="checkout-modal-head">
              <div>
                <span className="eyebrow">REFUND REQUEST</span>
                <h2>Request Refund</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setRefundTarget(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13.5, color: "#5b5e75" }}>
              Transaction <strong>{refundTarget.transaction_code}</strong> · {refundTarget.item_title} ({formatINR(refundTarget.total_amount_paise, refundTarget.currency)})
            </p>
            <label>
              Refund Reason
              <select value={refundReason} onChange={(e) => setRefundReason(e.target.value)}>
                <option value="DUPLICATE_PAYMENT">Duplicate Payment</option>
                <option value="FAILED_DEDUCTION">Failed Transaction Deduction</option>
                <option value="TECHNICAL_ISSUE">Technical / Access Issue</option>
                <option value="WRONG_PURCHASE">Accidental / Wrong Purchase</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label>
              Additional Information
              <textarea
                required
                minLength={5}
                rows={4}
                placeholder="Explain your refund request clearly..."
                value={refundDetails}
                onChange={(e) => setRefundDetails(e.target.value)}
              />
            </label>
            <div className="checkout-modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setRefundTarget(null)}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={busy}>Submit Refund Request</button>
            </div>
          </form>
        </div>
      )}

      <CheckoutModal
        open={Boolean(checkoutPlan)}
        itemType="SUBSCRIPTION"
        plan={checkoutPlan}
        onClose={() => setCheckoutPlan(null)}
        onSuccess={() => loadAll(1, statusFilter)}
        onOpenLegal={onOpenLegal}
        onToast={onToast}
      />
    </div>
  );
}
