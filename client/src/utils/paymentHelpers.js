/**
 * Shared Payment, Formatting, Redirect & Razorpay Checkout Helpers
 */

export function formatINR(paise, currency = "INR") {
  const value = Number(paise || 0) / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `₹${value.toFixed(2)}`;
  }
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateOnly(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const PAYMENT_STATUS_META = {
  CREATED: { label: "Created", tone: "neutral" },
  PENDING: { label: "Pending", tone: "warning" },
  PROCESSING: { label: "Processing", tone: "info" },
  SUCCESSFUL: { label: "Successful", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  REFUND_INITIATED: { label: "Refund Initiated", tone: "info" },
  PARTIALLY_REFUNDED: { label: "Partially Refunded", tone: "warning" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
};

export const REFUND_STATUS_META = {
  REQUESTED: { label: "Requested", tone: "warning" },
  UNDER_REVIEW: { label: "Under Review", tone: "info" },
  APPROVED: { label: "Approved", tone: "info" },
  REJECTED: { label: "Rejected", tone: "danger" },
  REFUND_INITIATED: { label: "Refund Initiated", tone: "info" },
  REFUNDED: { label: "Refunded", tone: "success" },
  FAILED: { label: "Refund Failed", tone: "danger" },
};

let razorpayLoadPromise = null;
export function loadRazorpayScript() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayLoadPromise) return razorpayLoadPromise;
  razorpayLoadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayLoadPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return razorpayLoadPromise;
}

const REDIRECT_TEST_KEY = "hhk_pending_test_id";

export function savePendingTestRedirect(testId) {
  if (!testId) return;
  try {
    sessionStorage.setItem(REDIRECT_TEST_KEY, String(testId));
  } catch {}
}

export function getPendingTestRedirect() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get("redirectTest");
    if (fromQuery) return fromQuery;
    return sessionStorage.getItem(REDIRECT_TEST_KEY) || "";
  } catch {
    return "";
  }
}

export function clearPendingTestRedirect() {
  try {
    sessionStorage.removeItem(REDIRECT_TEST_KEY);
  } catch {}
}

function escapeHtml(val) {
  return String(val ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function openPrintableReceipt(receipt) {
  const win = window.open("", "_blank", "width=760,height=860");
  if (!win) return;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>HHK Payment Receipt - ${escapeHtml(receipt.receipt_number || receipt.order_number)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #20233a; margin: 36px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #6557dc; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 22px; font-weight: 800; color: #6557dc; }
    .meta { text-align: right; font-size: 13px; color: #5b5e73; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border-bottom: 1px solid #e6e7f0; padding: 10px 8px; text-align: left; font-size: 14px; }
    th { background: #f6f7fb; font-weight: 600; }
    .num { text-align: right; }
    .total-row td { font-weight: 700; font-size: 15px; border-top: 2px solid #20233a; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; background: #e8f8ef; color: #137333; font-weight: 600; font-size: 12px; }
    .footer { margin-top: 32px; font-size: 12px; color: #6c6f85; border-top: 1px solid #e6e7f0; padding-top: 12px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${escapeHtml(receipt.businessName || "HHK Banking Exam Platform")}</div>
      <div style="font-size:13px;color:#5b5e73;">${escapeHtml(receipt.businessAddress || "")}</div>
      <div style="font-size:13px;color:#5b5e73;">${escapeHtml(receipt.supportEmail || "")}</div>
    </div>
    <div class="meta">
      <div><strong>PAYMENT RECEIPT</strong></div>
      <div>Receipt #: ${escapeHtml(receipt.receipt_number || "—")}</div>
      <div>Order #: ${escapeHtml(receipt.order_number)}</div>
      <div>Date: ${escapeHtml(formatDateTime(receipt.verified_at || receipt.created_at))}</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <strong>Billed To:</strong><br/>
      ${escapeHtml(receipt.full_name)}<br/>
      ${escapeHtml(receipt.email)}<br/>
      ${escapeHtml(receipt.mobile || "")}
    </div>
    <div>
      <strong>Transaction Details:</strong><br/>
      Transaction ID: ${escapeHtml(receipt.transaction_code)}<br/>
      Gateway Payment ID: ${escapeHtml(receipt.gateway_payment_id || "—")}<br/>
      Payment Method: ${escapeHtml(receipt.payment_method ? receipt.payment_method.toUpperCase() : "Online")}<br/>
      Status: <span class="badge">${escapeHtml(receipt.status)}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Type</th>
        <th class="num">Amount (${escapeHtml(receipt.currency || "INR")})</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${escapeHtml(receipt.item_title)}</td>
        <td>${escapeHtml(receipt.item_type === "SUBSCRIPTION" ? "Subscription Plan" : "Mock Test")}</td>
        <td class="num">${escapeHtml(formatINR(receipt.base_amount_paise, receipt.currency))}</td>
      </tr>
      ${Number(receipt.tax_amount_paise) > 0 ? `<tr><td colspan="2">${escapeHtml(receipt.taxLabel || "Tax")}</td><td class="num">${escapeHtml(formatINR(receipt.tax_amount_paise, receipt.currency))}</td></tr>` : ""}
      <tr class="total-row">
        <td colspan="2">Total Paid</td>
        <td class="num">${escapeHtml(formatINR(receipt.total_amount_paise, receipt.currency))}</td>
      </tr>
      ${Number(receipt.refunded_amount_paise) > 0 ? `<tr><td colspan="2">Refunded Amount</td><td class="num">-${escapeHtml(formatINR(receipt.refunded_amount_paise, receipt.currency))}</td></tr>` : ""}
    </tbody>
  </table>

  <div class="footer">
    This is a computer-generated payment receipt from ${escapeHtml(receipt.businessName || "HHK")}. For payment or refund support, reference Transaction ID ${escapeHtml(receipt.transaction_code)}.
  </div>
  <div class="no-print" style="margin-top:20px;">
    <button onclick="window.print()" style="padding:10px 18px;background:#6557dc;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Print / Save as PDF</button>
  </div>
</body>
</html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
