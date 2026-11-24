import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { formatINR, loadRazorpayScript } from "../../utils/paymentHelpers";

/**
 * Secure Razorpay Checkout Modal for Individual Mock Tests & Subscription Plans.
 * Strictly trusts backend-calculated order totals and backend signature verification.
 */
export function CheckoutModal({
  open,
  itemType, // "MOCK_TEST" | "SUBSCRIPTION"
  test = null,
  plan = null,
  eligiblePlans = [],
  onClose,
  onSuccess,
  onOpenLegal,
  onToast,
}) {
  const [selectedMode, setSelectedMode] = useState(itemType);
  const [selectedPlan, setSelectedPlan] = useState(plan);
  const [config, setConfig] = useState(null);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [phase, setPhase] = useState("review"); // review | creating | checkout | verifying | success | failed | cancelled | pending
  const [statusMessage, setStatusMessage] = useState("");
  const [orderData, setOrderData] = useState(null);
  const [verifiedTx, setVerifiedTx] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedMode(itemType);
    setSelectedPlan(plan || eligiblePlans?.[0] || null);
    setPhase("review");
    setStatusMessage("");
    setOrderData(null);
    setVerifiedTx(null);
    setAcceptedPolicies(false);
    setIdempotencyKey(`hhk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);

    fetch("/api/public/config", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConfig(d?.config ?? null))
      .catch(() => {});
  }, [open, itemType, test?.id, plan?.id]);

  if (!open) return null;

  const isSub = selectedMode === "SUBSCRIPTION";
  const activePlan = isSub ? selectedPlan || plan : null;
  const activePricePaise = isSub
    ? activePlan?.promo_price_paise != null &&
      (!activePlan.promo_valid_until || new Date(activePlan.promo_valid_until) > new Date())
      ? Number(activePlan.promo_price_paise)
      : Number(activePlan?.price_paise || 0)
    : Number(test?.price_paise || 0);
  const taxPaise = config?.taxEnabled
    ? Math.round((activePricePaise * Number(config.taxRateBps || 0)) / 10000)
    : 0;
  const totalPaise = activePricePaise + taxPaise;

  async function startCheckout() {
    if (!acceptedPolicies) {
      setStatusMessage("Please accept the Terms, Privacy Policy, and Refund Policy to continue.");
      return;
    }
    setPhase("creating");
    setStatusMessage("Creating secure payment order…");
    try {
      const payload = {
        itemType: selectedMode,
        mockTestId: selectedMode === "MOCK_TEST" ? test.id : undefined,
        planId: selectedMode === "SUBSCRIPTION" ? activePlan.id : undefined,
        idempotencyKey,
        acceptedPolicies: true,
      };
      const res = await fetch("/api/payments/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.code === "ALREADY_PAID_RECONCILED") {
          setPhase("success");
          setStatusMessage(data.error);
          onToast?.(data.error, "success");
          onSuccess?.(data);
          return;
        }
        if (data?.code === "PAYMENT_IN_PROGRESS") {
          setPhase("pending");
          setOrderData(data.order || null);
          setStatusMessage(data.error);
          return;
        }
        throw new Error(data?.error || "Could not create payment order.");
      }

      setOrderData(data.order);
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error("Unable to load Razorpay Checkout script. Please check your internet connection.");
      }

      setPhase("checkout");
      setStatusMessage("Waiting for Razorpay payment completion…");

      const rzp = new window.Razorpay({
        key: data.checkout.keyId,
        amount: data.checkout.amountPaise,
        currency: data.checkout.currency,
        name: data.checkout.name || "HHK Banking Exam Platform",
        description: data.checkout.description,
        order_id: data.checkout.razorpayOrderId,
        prefill: data.checkout.prefill,
        theme: { color: "#6557dc" },
        modal: {
          ondismiss: async () => {
            setPhase("verifying");
            setStatusMessage("Checking payment status…");
            try {
              const cancelRes = await fetch(`/api/payments/orders/${data.order.id}/status`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "cancelled", reason: "Checkout window closed by student." }),
              });
              const cancelData = await cancelRes.json().catch(() => null);
              if (cancelData?.status === "SUCCESSFUL") {
                setPhase("success");
                setStatusMessage(cancelData.message);
                onToast?.(cancelData.message, "success");
                onSuccess?.(cancelData);
              } else {
                setPhase("cancelled");
                setStatusMessage(cancelData?.message || "Checkout was cancelled.");
              }
            } catch {
              setPhase("cancelled");
              setStatusMessage("Checkout was cancelled. You can safely try again.");
            }
          },
        },
        handler: async (response) => {
          setPhase("verifying");
          setStatusMessage("Payment verification in progress on HHK server…");
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: data.order.id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json().catch(() => null);
            if (!verifyRes.ok) {
              throw new Error(verifyData?.error || "Payment verification failed.");
            }
            setVerifiedTx(verifyData.transaction);
            setPhase("success");
            setStatusMessage(verifyData.message || "Payment verified and access activated!");
            onToast?.("Payment verified! Your access is now active.", "success");
            onSuccess?.(verifyData);
          } catch (err) {
            setPhase("failed");
            setStatusMessage(err.message);
            onToast?.(err.message, "error");
          }
        },
      });

      rzp.on("payment.failed", async (resp) => {
        setPhase("verifying");
        setStatusMessage("Recording payment status and verifying with gateway…");
        try {
          const failRes = await fetch(`/api/payments/orders/${data.order.id}/status`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "failed",
              reason: resp?.error?.description || resp?.error?.reason || "Payment failed.",
              gatewayPaymentId: resp?.error?.metadata?.payment_id || undefined,
            }),
          });
          const failData = await failRes.json().catch(() => null);
          if (failData?.status === "SUCCESSFUL") {
            setPhase("success");
            setStatusMessage(failData.message);
            onSuccess?.(failData);
          } else {
            setPhase("failed");
            setStatusMessage(
              resp?.error?.description ||
                failData?.message ||
                "Payment failed. You can start a fresh attempt safely.",
            );
          }
        } catch {
          setPhase("failed");
          setStatusMessage("Payment failed. Please check Payment History before retrying.");
        }
      });

      rzp.open();
    } catch (err) {
      setPhase("failed");
      setStatusMessage(err.message);
      onToast?.(err.message, "error");
    }
  }

  async function reconcilePending() {
    if (!orderData?.id) return;
    setPhase("verifying");
    setStatusMessage("Reconciling order status with Razorpay…");
    try {
      const res = await fetch(`/api/payments/orders/${orderData.id}/reconcile`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.status === "SUCCESSFUL") {
        setPhase("success");
        setVerifiedTx(data.transaction);
        setStatusMessage("Payment confirmed! Your access is now active.");
        onSuccess?.(data);
      } else {
        setPhase("pending");
        setStatusMessage(`Current gateway status: ${data.status}.`);
      }
    } catch (err) {
      setPhase("failed");
      setStatusMessage(err.message);
    }
  }

  function resetForNewAttempt() {
    setIdempotencyKey(`hhk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
    setPhase("review");
    setStatusMessage("");
    setOrderData(null);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Secure Checkout">
      <div className="panel checkout-modal-card">
        <div className="checkout-modal-head">
          <div>
            <span className="eyebrow">SECURE RAZORPAY CHECKOUT</span>
            <h2>{isSub ? activePlan?.name || "Subscription Plan" : test?.name || "Mock Test Access"}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close checkout">
            <X size={18} />
          </button>
        </div>

        {/* Option switcher if student came from a paid mock test and eligible plans exist */}
        {itemType === "MOCK_TEST" && test && eligiblePlans.length > 0 && phase === "review" && (
          <div className="checkout-option-tabs">
            {test.is_purchasable && test.access_type !== "SUBSCRIPTION" && (
              <button
                type="button"
                className={`mock-mode-tab ${selectedMode === "MOCK_TEST" ? "active" : ""}`}
                onClick={() => setSelectedMode("MOCK_TEST")}
              >
                Buy Single Test ({formatINR(test.price_paise, test.currency)})
              </button>
            )}
            <button
              type="button"
              className={`mock-mode-tab ${selectedMode === "SUBSCRIPTION" ? "active" : ""}`}
              onClick={() => {
                setSelectedMode("SUBSCRIPTION");
                if (!selectedPlan && eligiblePlans[0]) setSelectedPlan(eligiblePlans[0]);
              }}
            >
              Unlock with Subscription Plan
            </button>
          </div>
        )}

        {selectedMode === "SUBSCRIPTION" && eligiblePlans.length > 1 && phase === "review" && (
          <div className="checkout-plan-picker">
            {eligiblePlans.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`checkout-plan-chip ${activePlan?.id === p.id ? "selected" : ""}`}
                onClick={() => setSelectedPlan(p)}
              >
                <strong>{p.name}</strong>
                <span>{p.duration_days} days · {formatINR(p.promo_price_paise ?? p.price_paise, p.currency)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Order Price Summary */}
        <div className="checkout-summary-box">
          <div className="checkout-summary-row">
            <span>Item</span>
            <strong>{isSub ? `${activePlan?.name} (${activePlan?.duration_days} days)` : test?.name}</strong>
          </div>
          <div className="checkout-summary-row">
            <span>Base Price</span>
            <span>{formatINR(activePricePaise, config?.currency || "INR")}</span>
          </div>
          {config?.taxEnabled && taxPaise > 0 && (
            <div className="checkout-summary-row">
              <span>{config.taxLabel || "GST"} ({(config.taxRateBps / 100).toFixed(2)}%)</span>
              <span>{formatINR(taxPaise, config?.currency || "INR")}</span>
            </div>
          )}
          <div className="checkout-summary-row total">
            <span>Total Payable</span>
            <strong>{formatINR(totalPaise, config?.currency || "INR")}</strong>
          </div>
        </div>

        {/* Status Feedback Banners */}
        {phase === "creating" || phase === "verifying" || phase === "checkout" ? (
          <div className="payment-banner info">
            <Loader2 size={18} className="spin" />
            <div>
              <strong>{phase === "verifying" ? "Verifying Transaction" : "Processing"}</strong>
              <span>{statusMessage}</span>
            </div>
          </div>
        ) : null}

        {phase === "success" && (
          <div className="payment-banner success">
            <CheckCircle2 size={18} />
            <div>
              <strong>Payment Confirmed</strong>
              <span>
                {statusMessage}
                {verifiedTx?.transaction_code ? ` (Txn: ${verifiedTx.transaction_code})` : ""}
              </span>
            </div>
          </div>
        )}

        {(phase === "failed" || phase === "cancelled" || phase === "pending") && (
          <div className={`payment-banner ${phase === "failed" ? "danger" : "warning"}`}>
            <AlertCircle size={18} />
            <div>
              <strong>
                {phase === "cancelled"
                  ? "Checkout Cancelled"
                  : phase === "pending"
                  ? "Payment Pending Verification"
                  : "Payment Not Completed"}
              </strong>
              <span>{statusMessage}</span>
            </div>
          </div>
        )}

        {/* Policy Acceptance Checkbox */}
        {phase === "review" && (
          <div className="auth-terms-row" style={{ marginTop: 14 }}>
            <input
              id="checkout-policy-accept"
              type="checkbox"
              className="auth-terms-checkbox"
              checked={acceptedPolicies}
              onChange={(e) => {
                setAcceptedPolicies(e.target.checked);
                if (e.target.checked) setStatusMessage("");
              }}
            />
            <label htmlFor="checkout-policy-accept" className="auth-terms-label">
              I agree to the{" "}
              <button type="button" className="auth-terms-link" onClick={() => onOpenLegal?.("terms")}>
                Terms &amp; Conditions
              </button>
              ,{" "}
              <button type="button" className="auth-terms-link" onClick={() => onOpenLegal?.("privacy")}>
                Privacy Policy
              </button>
              , and{" "}
              <button type="button" className="auth-terms-link" onClick={() => onOpenLegal?.("refund-policy")}>
                Refund Policy
              </button>
              .
            </label>
          </div>
        )}

        {statusMessage && phase === "review" && (
          <div className="auth-error" role="alert" style={{ marginTop: 10 }}>
            {statusMessage}
          </div>
        )}

        <div className="checkout-modal-actions">
          {phase === "review" && (
            <>
              <button type="button" className="ghost-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={!config?.gatewayEnabled || totalPaise <= 0}
                onClick={startCheckout}
              >
                <CreditCard size={16} /> Pay {formatINR(totalPaise, config?.currency || "INR")} Securely
              </button>
            </>
          )}
          {phase === "success" && (
            <button type="button" className="primary-btn" onClick={onClose}>
              Continue to Mock Tests
            </button>
          )}
          {(phase === "failed" || phase === "cancelled") && (
            <>
              <button type="button" className="ghost-btn" onClick={onClose}>
                Close
              </button>
              <button type="button" className="primary-btn" onClick={resetForNewAttempt}>
                <RefreshCw size={15} /> Try New Payment Attempt
              </button>
            </>
          )}
          {phase === "pending" && (
            <>
              <button type="button" className="ghost-btn" onClick={onClose}>
                Close
              </button>
              <button type="button" className="primary-btn" onClick={reconcilePending}>
                <RefreshCw size={15} /> Verify Payment Status
              </button>
            </>
          )}
        </div>

        <div className="checkout-trust-row">
          <span><Lock size={13} /> 256-bit Encrypted Razorpay Checkout</span>
          <span><ShieldCheck size={13} /> Server-Verified Activation · No Card Data Stored</span>
        </div>
      </div>
    </div>
  );
}
