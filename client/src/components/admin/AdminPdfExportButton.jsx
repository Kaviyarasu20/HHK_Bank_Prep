// Place at: client/src/components/admin/AdminPdfExportButton.jsx
import { useState, useRef, useEffect } from "react";
import { FileDown, ChevronDown, BookOpenCheck, FileText, ShieldCheck } from "lucide-react";
import { exportQuestionsToPdf, isAdminUser } from "../../utils/exportQuestionsPdf";

/**
 * Admin-only PDF export dropdown button.
 * Automatically renders nothing if `currentUser` is not an authorized Admin.
 */
export function AdminPdfExportButton({
  questions = [],
  meta = {},
  currentUser = null,
  onError,
  disabled = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [localError, setLocalError] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutsideClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  // Strict defense-in-depth: never render this control for students/aspirants
  if (!isAdminUser(currentUser)) {
    return null;
  }

  async function handleExport(includeSolutions) {
    setMenuOpen(false);
    setLocalError("");
    setExporting(true);
    try {
      await exportQuestionsToPdf({
        questions,
        meta,
        currentUser,
        includeSolutions,
        includeWatermark: true,
        logoUrl: "/hhk-logo.png",
      });
    } catch (err) {
      const msg = err?.message || "Failed to export PDF.";
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setExporting(false);
    }
  }

  const isDisabled = disabled || exporting || !questions.length;

  return (
    <div ref={menuRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => setMenuOpen((prev) => !prev)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          height: "36px",
          padding: "0 13px",
          borderRadius: "8px",
          border: "1px solid #cfd6ec",
          background: isDisabled ? "#f3f4f6" : "#ffffff",
          color: isDisabled ? "#9ca3af" : "#102e61",
          fontWeight: 600,
          fontSize: "13px",
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
        title="Admin-only watermarked PDF download"
      >
        <FileDown size={15} />
        <span>{exporting ? "Preparing PDF..." : "Download PDF"}</span>
        <ChevronDown size={14} />
      </button>

      {menuOpen && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            minWidth: "250px",
            background: "#ffffff",
            border: "1px solid #e2e6f2",
            borderRadius: "10px",
            boxShadow: "0 14px 32px rgba(16, 46, 97, 0.14)",
            padding: "6px",
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#4f46e5",
              borderBottom: "1px solid #eef0f7",
              marginBottom: "4px",
            }}
          >
            <ShieldCheck size={13} />
            <span>ADMIN ONLY • WATERMARKED PDF</span>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleExport(true)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              border: 0,
              background: "transparent",
              borderRadius: "6px",
              textAlign: "left",
              fontSize: "13px",
              fontWeight: 600,
              color: "#1f2937",
              cursor: "pointer",
            }}
          >
            <BookOpenCheck size={15} color="#102e61" />
            <div>
              <div>Full Paper + Solutions</div>
              <div style={{ fontSize: "11px", fontWeight: 400, color: "#6b7280" }}>
                Questions, Answer Key &amp; Steps
              </div>
            </div>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleExport(false)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              border: 0,
              background: "transparent",
              borderRadius: "6px",
              textAlign: "left",
              fontSize: "13px",
              fontWeight: 600,
              color: "#1f2937",
              cursor: "pointer",
            }}
          >
            <FileText size={15} color="#102e61" />
            <div>
              <div>Question Paper Only</div>
              <div style={{ fontSize: "11px", fontWeight: 400, color: "#6b7280" }}>
                Clean printable test sheet
              </div>
            </div>
          </button>
        </div>
      )}

      {localError && (
        <div
          role="alert"
          style={{
            marginTop: "6px",
            fontSize: "12px",
            color: "#b91c1c",
          }}
        >
          {localError}
        </div>
      )}
    </div>
  );
}