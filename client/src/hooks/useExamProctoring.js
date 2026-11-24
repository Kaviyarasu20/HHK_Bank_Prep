import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mouse-Only Exam Proctoring Hook
 * Fixes the bug where pressing a key showed "Keyboard access is disabled"
 * while leaving "Violations: 0/3" stuck at 0/3.
 */
export function useExamProctoring({
  enabled = true,
  maxViolations = 3,
  cooldownMs = 800,
  allowTextInputsForDescriptive = true,
  onMaxViolationsReached,
  onViolationRecorded,
}) {
  const [violationCount, setViolationCount] = useState(0);
  const [bannerMessage, setBannerMessage] = useState(
    "Keyboard access is disabled during the exam. Please use your mouse only."
  );
  const [lastViolation, setLastViolation] = useState(null);
  const [isLockedOut, setIsLockedOut] = useState(false);

  const countRef = useRef(0);
  const lastTimestampRef = useRef(0);

  const recordViolation = useCallback(
    (type, message, keyLabel = "") => {
      if (!enabled || countRef.current >= maxViolations) return;

      const now = Date.now();
      // Cooldown prevents holding down a key or OS screenshot chord (Win+Shift+S)
      // from burning all 3 violations in a single millisecond, while still
      // guaranteeing at least +1 violation is counted immediately.
      if (now - lastTimestampRef.current < cooldownMs) {
        return;
      }
      lastTimestampRef.current = now;

      const nextCount = Math.min(maxViolations, countRef.current + 1);
      countRef.current = nextCount;
      setViolationCount(nextCount);

      const entry = {
        id: `v-${now}`,
        type,
        message,
        keyLabel,
        count: nextCount,
        maxViolations,
        timestamp: new Date().toLocaleTimeString(),
      };
      setLastViolation(entry);
      setBannerMessage(message);
      onViolationRecorded?.(entry);

      if (nextCount >= maxViolations) {
        setIsLockedOut(true);
        setBannerMessage(
          `Maximum proctoring violations (${maxViolations}/${maxViolations}) reached. Auto-submitting exam...`
        );
        onMaxViolationsReached?.(entry);
      }
    },
    [enabled, maxViolations, cooldownMs, onMaxViolationsReached, onViolationRecorded]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      if (e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const tag = e.target?.tagName?.toLowerCase();
      const isDescriptiveEditor =
        allowTextInputsForDescriptive &&
        (tag === "textarea" || e.target?.dataset?.allowKeyboard === "true");

      if (isDescriptiveEditor) return;

      e.preventDefault();
      e.stopPropagation();

      const keyName = e.key === " " ? "Space" : e.key || e.code || "Key";
      recordViolation(
        "keyboard_disabled",
        `Keyboard access is disabled during the exam ("${keyName}" blocked). Please use your mouse only.`,
        keyName
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        recordViolation(
          "tab_switch",
          "Tab switching or minimizing the exam window is a proctoring violation.",
          "VisibilityHidden"
        );
      }
    };

    const handleCopyCutPaste = (e) => {
      e.preventDefault();
      recordViolation(
        "clipboard_blocked",
        "Copy, cut, and paste actions are disabled during the examination.",
        e.type
      );
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("copy", handleCopyCutPaste, { capture: true });
    window.addEventListener("cut", handleCopyCutPaste, { capture: true });
    window.addEventListener("paste", handleCopyCutPaste, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("copy", handleCopyCutPaste, { capture: true });
      window.removeEventListener("cut", handleCopyCutPaste, { capture: true });
      window.removeEventListener("paste", handleCopyCutPaste, { capture: true });
    };
  }, [enabled, allowTextInputsForDescriptive, recordViolation]);

  const resetViolations = useCallback(() => {
    countRef.current = 0;
    lastTimestampRef.current = 0;
    setViolationCount(0);
    setIsLockedOut(false);
    setLastViolation(null);
    setBannerMessage(
      "Keyboard access is disabled during the exam. Please use your mouse only."
    );
  }, []);

  return {
    violationCount,
    maxViolations,
    bannerMessage,
    lastViolation,
    isLockedOut,
    recordViolation,
    resetViolations,
  };
}
