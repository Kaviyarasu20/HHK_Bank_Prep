// Place at: client/src/components/auth/TermsModal.jsx
import { useEffect } from "react";
import { X } from "lucide-react";

function TermsModal({ open, onClose, onAccept }) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="auth-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hhk-terms-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="auth-modal">
        <div className="auth-modal-header">
          <div>
            <span className="auth-overline">HHK PLATFORM POLICY</span>
            <h3 id="hhk-terms-title">Terms &amp; Conditions</h3>
          </div>
          <button
            type="button"
            className="auth-modal-close"
            onClick={onClose}
            aria-label="Close Terms and Conditions"
          >
            <X size={18} />
          </button>
        </div>

        <div className="auth-modal-body">
          <p className="auth-modal-intro">
            Welcome to the <strong>HHK Banking Exam Preparation Platform</strong>. By signing in
            and using this platform, you agree to the following terms:
          </p>

          <section>
            <h4>1. Account Responsibility</h4>
            <p>
              Your account is intended for individual exam preparation only. You are responsible
              for keeping your login credentials confidential and for all activity performed under
              your account.
            </p>
          </section>

          <section>
            <h4>2. Permitted Use of Study Material</h4>
            <p>
              All mock tests, topicwise practice sets, question banks, and solutions provided on
              HHK are for personal educational use. Copying, scraping, redistributing, or
              commercially reselling platform content without permission is prohibited.
            </p>
          </section>

          <section>
            <h4>3. Fair Test Conduct</h4>
            <p>
              You agree not to interfere with platform security, attempt unauthorized access to
              administrative tools, or use automated scripts during timed mock examinations.
            </p>
          </section>

          <section>
            <h4>4. Privacy &amp; Performance Records</h4>
            <p>
              Your profile details, test attempts, scores, and performance analytics are kept
              private to your account and are used solely to deliver personalized practice and
              progress tracking.
            </p>
          </section>

          <section>
            <h4>5. Platform Updates</h4>
            <p>
              HHK may update exam blueprints, question sets, features, or these terms periodically
              to align with current banking examination standards. Continued use of the platform
              constitutes acceptance of the updated terms.
            </p>
          </section>
        </div>

        <div className="auth-modal-footer">
          <button type="button" className="auth-modal-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="primary-btn auth-modal-primary"
            onClick={() => {
              onAccept?.();
              onClose?.();
            }}
          >
            I Agree
          </button>
        </div>
      </div>
    </div>
  );
}

export { TermsModal };