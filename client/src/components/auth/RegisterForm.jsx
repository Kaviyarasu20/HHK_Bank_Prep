import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";

function RegisterForm({
  busy,
  error,
  notice,
  redirectTest,
  onSubmit,
  onNavigateLogin,
  onReturnToMockTests,
  onOpenLegal,
}) {
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpNotice, setOtpNotice] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function handleSendOtp() {
    setOtpError("");
    setOtpNotice("");
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setOtpError("Enter a valid email address first.");
      return;
    }
    setOtpBusy(true);
    try {
      const res = await fetch("/api/auth/send-register-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Could not send OTP.");
      setOtpSent(true);
      setResendIn(60);
      setOtpNotice(body?.message || "OTP sent to your email.");
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpBusy(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!otpSent || !/^\d{6}$/.test(otp.trim())) {
      setOtpError("Please verify your email with the 6-digit OTP first.");
      return;
    }
    if (!acceptedTerms) {
      setTermsError("Please agree to the Terms, Privacy Policy, and Refund Policy to register.");
      return;
    }
    setTermsError("");
    setOtpError("");
    onSubmit({
      fullName,
      mobile,
      email,
      otp: otp.trim(),
      password,
      passwordConfirmation,
      acceptedTerms: true,
    });
  }

  const activeError = otpError || termsError || error;
  const activeNotice = otpNotice || notice;

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      {onReturnToMockTests && (
        <button
          type="button"
          className="ghost-btn"
          onClick={onReturnToMockTests}
          style={{ alignSelf: "flex-start", marginBottom: 12 }}
        >
          <ArrowLeft size={15} /> Return to Mock Tests
        </button>
      )}

      <span className="auth-overline">WELCOME TO HHK</span>
      <h2>Create your student account</h2>
      <p>Start building a focused preparation routine.</p>

      {redirectTest && (
        <div className="auth-redirect-banner" role="status">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <Lock size={15} /> Create your HHK account to start this mock test.
          </div>
          {redirectTest.name && (
            <span style={{ fontSize: 12.5 }}>
              Selected test: <strong>{redirectTest.name}</strong> — you will be redirected automatically after registration.
            </span>
          )}
        </div>
      )}

      {activeError && (
        <div className="auth-error" role="alert">
          {activeError}
        </div>
      )}
      {activeNotice && (
        <div className="auth-notice" role="status">
          {activeNotice}
        </div>
      )}

      <label>
        Full name
        <input
          autoComplete="name"
          required
          minLength={2}
          maxLength={100}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </label>

      <label>
        Mobile number
        <input
          autoComplete="tel"
          required
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
        />
      </label>

      <label>
        Email address
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (otpSent) {
                setOtpSent(false);
                setOtp("");
                setOtpNotice("");
              }
            }}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className={otpBusy || resendIn > 0 ? "outline-btn" : "primary-btn"}
            disabled={otpBusy || resendIn > 0}
            onClick={handleSendOtp}
            style={{ whiteSpace: "nowrap", padding: "0 16px" }}
          >
            {otpBusy ? "Sending…" : resendIn > 0 ? `Resend (${resendIn}s)` : otpSent ? "Resend OTP" : "Send OTP"}
          </button>
        </div>
      </label>

      {otpSent && (
        <label>
          Email OTP (6 digits)
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="Enter 6-digit OTP from your email"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <small>Check your inbox (and Spam folder). Valid for 10 minutes.</small>
        </label>
      )}

      <label>
        Password
        <div className="auth-password-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <small>Use at least 6 characters.</small>
      </label>

      <label>
        Confirm password
        <div className="auth-password-wrapper">
          <input
            type={showPasswordConfirmation ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            maxLength={128}
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPasswordConfirmation((prev) => !prev)}
            aria-label={showPasswordConfirmation ? "Hide confirm password" : "Show confirm password"}
          >
            {showPasswordConfirmation ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>

      <div className="auth-terms-row">
        <input
          id="register-terms-checkbox"
          type="checkbox"
          className="auth-terms-checkbox"
          checked={acceptedTerms}
          onChange={(e) => {
            setAcceptedTerms(e.target.checked);
            if (e.target.checked) setTermsError("");
          }}
        />
        <label htmlFor="register-terms-checkbox" className="auth-terms-label">
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
        </label>
      </div>

      <button className="primary-btn auth-submit" disabled={busy}>
        {busy ? "Please wait…" : "Create account"}
      </button>

      <div className="auth-switch">
        Already have an account?{" "}
        <button type="button" onClick={onNavigateLogin}>
          Sign in
        </button>
      </div>

      <small className="auth-note">
        Your profile, attempts, and results are private to your account.
      </small>
    </form>
  );
}

export { RegisterForm };