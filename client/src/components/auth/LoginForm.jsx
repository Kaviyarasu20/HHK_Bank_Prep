import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
import { TermsModal } from "./TermsModal";

function LoginForm({
  busy,
  error,
  notice,
  redirectTest,
  onSubmit,
  onNavigateRegister,
  onNavigateForgot,
  onReturnToMockTests,
  onOpenLegal,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [showTermsModal, setShowTermsModal] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!acceptedTerms) {
      setTermsError("Please agree to the Terms & Conditions to sign in.");
      return;
    }
    setTermsError("");
    onSubmit({ email, password, acceptedTerms: true });
  }

  const activeError = termsError || error;

  return (
    <>
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card-heading">
          <span className="auth-overline">WELCOME TO HHK</span>
          {onReturnToMockTests && (
            <button
              type="button"
              className="auth-return-link"
              onClick={onReturnToMockTests}
            >
              <ArrowLeft size={14} /> <span>Mock tests</span>
            </button>
          )}
        </div>
        <h2>Sign in to your account</h2>
        <p>Continue your banking exam preparation.</p>

        {redirectTest && (
          <div className="auth-redirect-banner" role="status">
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              <Lock size={15} /> Please log in to your HHK account to start this mock test.
            </div>
            {redirectTest.name && (
              <span style={{ fontSize: 12.5 }}>
                Selected test: <strong>{redirectTest.name}</strong> — you will be returned here right after login.
              </span>
            )}
          </div>
        )}

        {activeError && (
          <div className="auth-error" role="alert">
            {activeError}
          </div>
        )}
        {notice && (
          <div className="auth-notice" role="status">
            {notice}
          </div>
        )}

        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label>
          Password
          <div className="auth-password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              minLength={1}
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
        </label>

        <button
          className="auth-forgot"
          type="button"
          onClick={onNavigateForgot}
        >
          Forgot password?
        </button>

        <div className="auth-terms-row">
          <input
            id="login-terms-checkbox"
            type="checkbox"
            className="auth-terms-checkbox"
            checked={acceptedTerms}
            onChange={(e) => {
              setAcceptedTerms(e.target.checked);
              if (e.target.checked) setTermsError("");
            }}
          />
          <label htmlFor="login-terms-checkbox" className="auth-terms-label">
            I agree to the{" "}
            <button
              type="button"
              className="auth-terms-link"
              onClick={() => (onOpenLegal ? onOpenLegal("terms") : setShowTermsModal(true))}
            >
              Terms &amp; Conditions
            </button>
            {" & "}
            <button
              type="button"
              className="auth-terms-link"
              onClick={() => (onOpenLegal ? onOpenLegal("privacy") : setShowTermsModal(true))}
            >
              Privacy Policy
            </button>
          </label>
        </div>

        <button className="primary-btn auth-submit" disabled={busy}>
          {busy ? "Please wait\u2026" : "Sign in"}
        </button>

        <div className="auth-switch">
          New to HHK?{" "}
          <button type="button" onClick={onNavigateRegister}>
            Create an account
          </button>
        </div>

        <small className="auth-note">
          Your profile, attempts, and results are private to your account.
        </small>
      </form>

      <TermsModal
        open={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setAcceptedTerms(true);
          setTermsError("");
        }}
      />
    </>
  );
}

export { LoginForm };
