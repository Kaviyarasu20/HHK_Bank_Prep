import { CustomSelect } from "../common/CustomSelect.jsx";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Mail, Phone, ShieldCheck } from "lucide-react";

export function LegalPageShell({ title, eyebrow, updatedVersion, onBack, children }) {
  return (
    <div className="public-legal-wrap">
      {onBack && (
        <button type="button" className="ghost-btn" onClick={onBack} style={{ marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back
        </button>
      )}
      <article className="panel public-legal-card">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="legal-meta">
          Policy Version {updatedVersion || "1.0"} · Applies to all HHK Banking Examination Preparation Platform users.
        </p>
        <div className="legal-body">{children}</div>
      </article>
    </div>
  );
}

export function TermsPage({ config, onBack, onNavigate }) {
  const business = config?.businessName || "HHK Banking Examination Preparation Platform";
  return (
    <LegalPageShell title="Terms and Conditions" eyebrow="LEGAL AGREEMENT" updatedVersion={config?.policyVersion} onBack={onBack}>
      <section>
        <h2>1. User Account Responsibilities</h2>
        <p>
          You are responsible for maintaining the confidentiality of your {business} account credentials,
          mobile number, and email address. All mock test attempts, purchases, and account activities
          performed under your authenticated session are attributed to your account.
        </p>
      </section>
      <section>
        <h2>2. Student Registration Conditions</h2>
        <p>
          To attempt free or paid mock tests, purchase individual tests, or activate subscriptions,
          you must register with accurate personal details and accept these Terms, our{" "}
          <button type="button" className="inline-link-btn" onClick={() => onNavigate?.("privacy")}>Privacy Policy</button>,
          and our{" "}
          <button type="button" className="inline-link-btn" onClick={() => onNavigate?.("refund-policy")}>Refund and Cancellation Policy</button>.
          Account sharing or creating duplicate accounts to abuse promotional offers is prohibited.
        </p>
      </section>
      <section>
        <h2>3. Mock Test Usage Rules</h2>
        <p>
          Computer-based mock tests include proctoring safeguards such as single-tab session locking,
          fullscreen enforcement, and timed submissions. Attempting to bypass exam timers, scrape
          questions, or automate responses may result in automatic submission or account suspension.
        </p>
      </section>
      <section>
        <h2>4. Subscription and Plan Conditions</h2>
        <p>
          Subscription plans grant access to eligible mock tests for the duration displayed at checkout.
          Plan pricing, included tests, and promotional discounts are configured by {business} administrators
          and apply to future purchases without revoking already-paid active entitlements.
        </p>
      </section>
      <section>
        <h2>5. Payment Terms</h2>
        <p>
          All paid transactions are denominated in Indian Rupees (INR) and processed through our authorized
          third-party payment gateway (Razorpay). Access to paid mock tests or subscriptions is activated
          strictly after server-side payment signature and gateway verification.
        </p>
      </section>
      <section>
        <h2>6. Account Suspension and Termination</h2>
        <p>
          {business} reserves the right to suspend or terminate accounts that violate exam integrity rules,
          attempt payment fraud or chargeback abuse, or misuse platform APIs.
        </p>
      </section>
      <section>
        <h2>7. Intellectual Property Rights</h2>
        <p>
          All banking exam questions, explanations, test blueprints, software code, and branding on {business}
          are protected intellectual property. Reproducing, redistributing, or reselling test content without
          written permission is prohibited.
        </p>
      </section>
      <section>
        <h2>8. Prohibited Activities</h2>
        <p>
          Users may not attempt unauthorized access to administrative endpoints, other students' records,
          unreleased question banks, or payment verification workflows.
        </p>
      </section>
      <section>
        <h2>9. Limitation of Liability</h2>
        <p>
          {business} provides exam preparation tools on an "as-is" basis and does not guarantee selection
          in any banking recruitment examination. Liability for any verified payment dispute is limited
          to the amount paid for the affected transaction.
        </p>
      </section>
      <section>
        <h2>10. Changes to Terms</h2>
        <p>
          We may update these Terms periodically. Material updates increment the policy version and are
          recorded when you register or complete a new checkout.
        </p>
      </section>
    </LegalPageShell>
  );
}

export function PrivacyPage({ config, onBack, onNavigate }) {
  const business = config?.businessName || "HHK Banking Examination Preparation Platform";
  return (
    <LegalPageShell title="Privacy Policy" eyebrow="DATA PROTECTION" updatedVersion={config?.policyVersion} onBack={onBack}>
      <section>
        <h2>1. Information We Collect</h2>
        <p>
          When you register and use {business}, we collect your full name, email address, mobile number,
          target examination preference, test attempts, answers, performance analytics, support inquiries,
          and payment transaction metadata (order numbers, transaction IDs, amounts, status, and payment method).
        </p>
      </section>
      <section>
        <h2>2. How Personal &amp; Account Information Is Used</h2>
        <p>
          Your information is used to authenticate your account, deliver timed mock tests and score reports,
          verify purchases, activate subscriptions, process refund requests, prevent fraud, and respond to
          support inquiries.
        </p>
      </section>
      <section>
        <h2>3. Payment Information &amp; Third-Party Gateway Integration</h2>
        <p>
          Online payments are processed through Razorpay. Necessary checkout details (order ID, amount,
          and your name, email, and phone prefill) are shared with Razorpay to complete the transaction.{" "}
          <strong>{business} never collects, views, or stores your card numbers, CVV, UPI PINs, or banking passwords.</strong>
        </p>
      </section>
      <section>
        <h2>4. Data Storage &amp; Security</h2>
        <p>
          Account passwords are stored using bcrypt hashing. Sessions use HTTP-only secure cookies backed
          by PostgreSQL. Payment verifications and webhook events use HMAC-SHA256 cryptographic signature
          validation, role-based access controls, and server-side audit logging.
        </p>
      </section>
      <section>
        <h2>5. Cookies &amp; Session Storage</h2>
        <p>
          We use essential session cookies (<code>hhk.sid</code>) to keep you signed in and browser session
          storage to return you to your chosen mock test after login. We do not sell personal data to advertisers.
        </p>
      </section>
      <section>
        <h2>6. Data Retention</h2>
        <p>
          Account records, test attempts, and financial transaction logs are retained for as long as your
          account remains active and as required for accounting, tax, refund reconciliation, and legal compliance.
        </p>
      </section>
      <section>
        <h2>7. Your Privacy Rights &amp; Contact</h2>
        <p>
          You may review and update your profile details from your Student Dashboard or submit a data
          or privacy request via our{" "}
          <button type="button" className="inline-link-btn" onClick={() => onNavigate?.("contact")}>Contact &amp; Support</button>{" "}
          page{config?.supportEmail ? ` or by emailing ${config.supportEmail}` : ""}.
        </p>
      </section>
    </LegalPageShell>
  );
}

export function RefundPolicyPage({ config, onBack, onNavigate }) {
  const business = config?.businessName || "HHK Banking Examination Preparation Platform";
  const windowDays = config?.refundWindowDays ?? 7;
  const timeline = config?.refundProcessingDays || "5-7 business days";
  return (
    <LegalPageShell title="Refund and Cancellation Policy" eyebrow="BILLING & REFUNDS" updatedVersion={config?.policyVersion} onBack={onBack}>
      <section>
        <h2>1. Eligible Refund Situations</h2>
        <p>
          Students may submit a refund request within <strong>{windowDays} days</strong> of a verified
          purchase (configurable by {business} administration) for eligible situations including:
        </p>
        <ul>
          <li><strong>Duplicate Payment:</strong> If you were charged more than once for the same mock test or subscription plan.</li>
          <li><strong>Failed Transaction Deduction:</strong> If funds were debited from your bank/UPI/card but access was not activated after gateway reconciliation.</li>
          <li><strong>Verified Technical Failure:</strong> If a platform-side defect prevented you from accessing a purchased test and could not be resolved by support.</li>
        </ul>
      </section>
      <section>
        <h2>2. Failed &amp; Pending Transaction Handling</h2>
        <p>
          If a payment fails or is interrupted due to network loss, our backend automatically reconciles
          the transaction status with Razorpay before permitting a new charge. Auto-reversed bank debits
          are typically returned by your bank or Razorpay without requiring a manual refund.
        </p>
      </section>
      <section>
        <h2>3. Refund Request &amp; Approval Procedure</h2>
        <p>
          Log in to your Student Dashboard, open <strong>Payment History</strong>, and select{" "}
          <strong>Request Refund</strong> on the eligible transaction (or submit your Transaction ID on our{" "}
          <button type="button" className="inline-link-btn" onClick={() => onNavigate?.("contact")}>Contact &amp; Support</button> page).
          Requests follow a transparent workflow: <em>Requested → Under Review → Approved/Rejected → Refund Initiated → Refunded</em>.
        </p>
      </section>
      <section>
        <h2>4. Refund Processing Timelines</h2>
        <p>
          Once approved and initiated through Razorpay, refunds are credited back to the original payment
          method within approximately <strong>{timeline}</strong>, depending on your bank or card issuer.
          A refund is marked completed only after gateway confirmation.
        </p>
      </section>
      <section>
        <h2>5. Non-Refundable Purchases &amp; Subscription Cancellations</h2>
        <p>
          Where legally permissible, completed mock tests that have already been attempted/submitted or
          subscriptions substantially used beyond the configured review window may be ineligible for
          a refund. If a full refund is confirmed, the associated test entitlement or subscription access
          is revoked automatically.
        </p>
      </section>
    </LegalPageShell>
  );
}

export function ContactSupportPage({ config, user, onBack, onToast }) {
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [category, setCategory] = useState("PAYMENT");
  const [transactionId, setTransactionId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, category, transactionId, subject, message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not submit your inquiry.");
      setSubmitted(data.inquiry);
      setSubject("");
      setMessage("");
      setTransactionId("");
      onToast?.(data.message || "Support request submitted.", "success");
    } catch (err) {
      setError(err.message);
      onToast?.(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <LegalPageShell title="Contact and Support" eyebrow="STUDENT HELP DESK" updatedVersion={config?.policyVersion} onBack={onBack}>
      <div className="contact-grid">
        <div className="contact-info-card">
          <h3>Official Support Channels</h3>
          <p>
            Need help with a payment, failed transaction, refund request, or mock test access?
            Share your registered email and Transaction ID for faster resolution.
          </p>
          <div className="contact-channel">
            <Mail size={16} />
            <div>
              <strong>Support Email</strong>
              <span>{config?.supportEmail || "[Configure official support email in Admin Settings]"}</span>
            </div>
          </div>
          {config?.supportPhone && (
            <div className="contact-channel">
              <Phone size={16} />
              <div>
                <strong>Support Phone</strong>
                <span>{config.supportPhone}</span>
              </div>
            </div>
          )}
          <div className="contact-channel">
            <ShieldCheck size={16} />
            <div>
              <strong>Business Entity</strong>
              <span>{config?.businessName || "HHK Banking Examination Preparation Platform"}</span>
            </div>
          </div>
          {config?.businessAddress && (
            <p className="contact-address">{config.businessAddress}</p>
          )}
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <h3>Submit a Support Request</h3>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {submitted && (
            <div className="payment-banner success">
              <CheckCircle2 size={18} />
              <div>
                <strong>Inquiry Received</strong>
                <span>Reference ID: {submitted.id.slice(0, 8).toUpperCase()} · Status: {submitted.status}</span>
              </div>
            </div>
          )}
          <div className="form-row-2">
            <label>
              Full Name
              <input required minLength={2} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
            <label>
              Registered Account Email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>
          <div className="form-row-2">
            <label>
              Support Category
              <CustomSelect value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="PAYMENT">Payment Support</option>
                <option value="REFUND">Refund Support</option>
                <option value="TECHNICAL">Technical / Access Issue</option>
                <option value="EXAM_CONTENT">Mock Test / Exam Content</option>
                <option value="GENERAL">General Inquiry</option>
              </CustomSelect>
            </label>
            <label>
              Transaction / Order ID (optional)
              <input
                placeholder="e.g. HHK-TXN-... or pay_..."
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />
            </label>
          </div>
          <label>
            Subject
            <input required minLength={3} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label>
            Message
            <textarea
              required
              minLength={10}
              rows={4}
              placeholder="Describe your issue, payment date, or refund question..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? "Submitting…" : "Submit Support Request"}
          </button>
        </form>
      </div>
    </LegalPageShell>
  );
}
