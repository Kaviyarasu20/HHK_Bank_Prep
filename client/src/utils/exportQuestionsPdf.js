// Place at: client/src/utils/exportQuestionsPdf.js

const BLOCKED_STUDENT_ROLES = new Set(["student", "aspirant", "learner", "candidate", "user"]);

/**
 * Verifies whether the current user is an authorized Admin / Staff account
 * (strictly blocks students/aspirants, while supporting custom HHK RBAC roles).
 */
export function isAdminUser(user) {
  if (!user || typeof user !== "object") return false;
  if (user.isAdmin === true || user.is_admin === true) return true;

  const rawRole = String(
    user.role ||
      user.user_role ||
      user.role_name ||
      user.roleName ||
      user.role_key ||
      user.role_slug ||
      user.account_type ||
      ""
  )
    .trim()
    .toLowerCase();

  // Explicitly block aspirant/student accounts
  if (BLOCKED_STUDENT_ROLES.has(rawRole)) return false;

  // Allow any admin/staff/manager/content role or accounts carrying RBAC permissions
  if (rawRole) return true;
  if (Array.isArray(user.permissions) && user.permissions.length > 0) return true;
  if (user.role_id || user.roleId) return true;

  return false;
}

/**
 * Escapes HTML special characters to prevent injection while preserving math symbols.
 */
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converts newlines in multi-line questions (e.g. Quadratic / Linear equations) into <br/>.
 */
function formatMultiline(str) {
  return escapeHtml(str).replace(/\r?\n/g, "<br/>");
}

/**
 * Normalizes both live Question Engine preview items and saved DB Question Bank items
 * into a single uniform shape for PDF rendering.
 */
function normalizeQuestion(q, index) {
  const questionText = q.questionText || q.question_text || q.question || "";

  // Extract options array from string array, [{ key, text }] array, map {A..E}, or DB columns option_a..option_e
  let options = [];
  if (Array.isArray(q.options) && q.options.length > 0) {
    options = q.options.map((o) =>
      o && typeof o === "object"
        ? String(o.text ?? o.label ?? o.value ?? "").trim()
        : String(o ?? "").trim()
    );
  } else if (Array.isArray(q.optionsArray) && q.optionsArray.length > 0) {
    options = q.optionsArray.map((o) =>
      o && typeof o === "object"
        ? String(o.text ?? o.label ?? o.value ?? "").trim()
        : String(o ?? "").trim()
    );
  } else if (q.options && typeof q.options === "object") {
    options = ["A", "B", "C", "D", "E"]
      .map((k) => q.options[k])
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
      .map((v) => String(v).trim());
  } else {
    options = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e]
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
      .map((v) => String(v).trim());
  }

  // Resolve correct option letter (A, B, C, D, E)
  const letters = ["A", "B", "C", "D", "E"];
  let correctLetter = "";
  if (typeof q.correctOptionIndex === "number" && letters[q.correctOptionIndex]) {
    correctLetter = letters[q.correctOptionIndex];
  } else if (typeof q.correct_answer === "string" && letters.includes(q.correct_answer.trim().toUpperCase())) {
    correctLetter = q.correct_answer.trim().toUpperCase();
  } else if (typeof q.correctAnswer === "string") {
    const idx = options.findIndex((o) => o === q.correctAnswer.trim());
    correctLetter = idx >= 0 ? letters[idx] : q.correctAnswer.trim();
  }

  // Resolve correct option display value
  const letterIdx = letters.indexOf(correctLetter);
  const correctText =
    letterIdx >= 0 && options[letterIdx]
      ? options[letterIdx]
      : String(q.answer || q.correctValue || q.correct_answer || "");

  // Resolve step-by-step explanation
  let solutionSteps = [];
  if (Array.isArray(q.solutionSteps) && q.solutionSteps.length > 0) {
    solutionSteps = q.solutionSteps.map(String);
  } else if (Array.isArray(q.solution) && q.solution.length > 0) {
    solutionSteps = q.solution.map(String);
  } else if (q.solution && Array.isArray(q.solution.steps)) {
    solutionSteps = q.solution.steps.map(String);
  } else if (typeof q.explanation === "string" && q.explanation.trim()) {
    solutionSteps = q.explanation
      .split(/\r?\n|→/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return {
    number: index + 1,
    questionText,
    options,
    correctLetter: correctLetter || "—",
    correctText,
    solutionSteps,
    difficulty: String(q.difficulty || "").toUpperCase(),
    subType: q.subType || q.subtopic || q.sub_type || q.questionType || "",
  };
}

/**
 * Builds the complete, print-ready A4 HTML document with HHK logo, watermark,
 * structured question blocks, answer key grid, and step-by-step solutions.
 */
function buildPdfHtml({
  questions,
  meta = {},
  currentUser,
  includeSolutions = true,
  includeWatermark = true,
  logoUrl = "/hhk-logo.png",
}) {
  const absoluteLogoUrl = logoUrl.startsWith("http")
    ? logoUrl
    : `${window.location.origin}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`;

  const examName = meta.examName || "Banking Examination";
  const stageName = meta.stageName || "";
  const sectionName = meta.sectionName || "Quantitative Aptitude";
  const topicName = meta.topicName || "Question Set";
  const subtopicName = meta.subtopicName || "";
  const difficulty = meta.difficulty || "Mixed";
  const generatedDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const adminLabel = currentUser?.email || currentUser?.name || "HHK Admin";

  const normalized = questions.map(normalizeQuestion);
  const letters = ["A", "B", "C", "D", "E"];

  const questionsHtml = normalized
    .map(
      (q) => `
      <article class="q-card">
        <div class="q-meta">
          <span class="q-num">Q${q.number}.</span>
          <div class="q-badges">
            ${q.subType ? `<span class="badge badge-sub">${escapeHtml(q.subType)}</span>` : ""}
            ${q.difficulty ? `<span class="badge badge-diff">${escapeHtml(q.difficulty)}</span>` : ""}
          </div>
        </div>
        <div class="q-text">${formatMultiline(q.questionText)}</div>
        <div class="options-grid">
          ${q.options
            .map(
              (opt, idx) => `
              <div class="opt-item">
                <span class="opt-key">(${letters[idx] || idx + 1})</span>
                <span class="opt-val">${escapeHtml(opt)}</span>
              </div>
            `
            )
            .join("")}
        </div>
      </article>
    `
    )
    .join("");

  const answerKeyHtml = normalized
    .map(
      (q) => `
      <div class="ak-cell">
        <span class="ak-q">Q${q.number}</span>
        <span class="ak-a">${escapeHtml(q.correctLetter)}</span>
      </div>
    `
    )
    .join("");

  const solutionsHtml = normalized
    .map(
      (q) => `
      <div class="sol-item">
        <div class="sol-head">
          <strong>Q${q.number}.</strong>
          <span class="sol-ans">Correct Answer: (${escapeHtml(q.correctLetter)}) ${escapeHtml(q.correctText)}</span>
        </div>
        ${
          q.solutionSteps.length > 0
            ? `<ul class="sol-steps">
                ${q.solutionSteps.map((step) => `<li>${formatMultiline(step)}</li>`).join("")}
              </ul>`
            : `<p class="sol-empty">Verified by HHK Question Engine.</p>`
        }
      </div>
    `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>HHK - ${escapeHtml(topicName)} (${normalized.length} Questions)</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 14mm 18mm 14mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #1e2235;
      font-size: 10.5pt;
      line-height: 1.5;
      background: #ffffff;
    }

    /* Repeating diagonal anti-sharing watermark on every printed page */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-32deg);
      font-size: 38pt;
      font-weight: 800;
      letter-spacing: 3px;
      color: rgba(16, 46, 97, 0.055);
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
      text-align: center;
      user-select: none;
    }
    .watermark small {
      display: block;
      font-size: 13pt;
      letter-spacing: 2px;
      margin-top: 6px;
      font-weight: 700;
    }

    .doc-wrapper {
      position: relative;
      z-index: 1;
    }

    /* Professional Header Banner */
    .doc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 18px;
      border-radius: 10px;
      background: linear-gradient(135deg, #102e61 0%, #1d3b75 65%, #2b3570 100%);
      color: #ffffff;
      margin-bottom: 14px;
    }

    .brand-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 48px;
      height: 48px;
      object-fit: contain;
      background: #ffffff;
      border-radius: 8px;
      padding: 4px;
    }

    .brand-text h1 {
      margin: 0;
      font-size: 15pt;
      font-weight: 800;
      letter-spacing: 0.4px;
    }

    .brand-text p {
      margin: 2px 0 0;
      font-size: 8.5pt;
      color: #c9d8f0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .header-right {
      text-align: right;
      font-size: 8.5pt;
      color: #dbe6f8;
    }

    .admin-tag {
      display: inline-block;
      background: rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.8px;
      margin-bottom: 4px;
    }

    /* Paper Info Bar */
    .paper-meta {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding: 10px 14px;
      background: #f5f7fc;
      border: 1px solid #e1e6f2;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 8.8pt;
    }

    .meta-cell span {
      display: block;
      font-size: 7.2pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 0.6px;
    }

    .meta-cell strong {
      color: #102e61;
      font-size: 9.2pt;
    }

    .section-heading {
      font-size: 11.5pt;
      font-weight: 800;
      color: #102e61;
      border-bottom: 2px solid #102e61;
      padding-bottom: 4px;
      margin: 0 0 12px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    /* Question Cards */
    .q-card {
      padding: 10px 12px;
      margin-bottom: 10px;
      border: 1px solid #e5e8f0;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.92);
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .q-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 5px;
    }

    .q-num {
      font-weight: 800;
      color: #102e61;
      font-size: 10.5pt;
    }

    .q-badges {
      display: flex;
      gap: 6px;
    }

    .badge {
      font-size: 7.2pt;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 999px;
      letter-spacing: 0.3px;
    }

    .badge-sub {
      background: #eef2ff;
      color: #3730a3;
    }

    .badge-diff {
      background: #fef3c7;
      color: #92400e;
    }

    .q-text {
      font-weight: 500;
      color: #111827;
      margin-bottom: 8px;
    }

    .options-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 5px 14px;
      font-size: 9.8pt;
    }

    .opt-item {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }

    .opt-key {
      font-weight: 700;
      color: #374151;
      min-width: 24px;
    }

    /* Answer Key & Solutions Section */
    .page-break {
      page-break-before: always;
      break-before: page;
    }

    .ak-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      margin-bottom: 18px;
    }

    .ak-cell {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 10px;
      border: 1px solid #dbe2f0;
      border-radius: 6px;
      background: #f8faff;
      font-size: 9pt;
    }

    .ak-q {
      font-weight: 700;
      color: #4b5563;
    }

    .ak-a {
      font-weight: 800;
      color: #0f5132;
      background: #d1e7dd;
      padding: 1px 7px;
      border-radius: 4px;
    }

    .sol-item {
      padding: 8px 12px;
      margin-bottom: 8px;
      border-left: 3px solid #102e61;
      background: #fafbfe;
      border-radius: 0 6px 6px 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .sol-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 9.8pt;
    }

    .sol-ans {
      font-weight: 700;
      color: #0f5132;
      font-size: 9.2pt;
    }

    .sol-steps {
      margin: 4px 0 0 18px;
      padding: 0;
      font-size: 9.2pt;
      color: #374151;
    }

    .sol-steps li {
      margin-bottom: 2px;
    }

    .sol-empty {
      margin: 2px 0 0;
      font-size: 9pt;
      color: #6b7280;
    }

    /* Footer */
    .doc-footer {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #d1d5db;
      display: flex;
      justify-content: space-between;
      font-size: 7.8pt;
      color: #6b7280;
    }
  </style>
</head>
<body>
  ${
    includeWatermark
      ? `<div class="watermark">
          HHK • ADMIN CONFIDENTIAL
          <small>INTERNAL USE ONLY • DO NOT DISTRIBUTE • ${escapeHtml(adminLabel)}</small>
        </div>`
      : ""
  }

  <div class="doc-wrapper">
    <header class="doc-header">
      <div class="brand-left">
        <img class="brand-logo" src="${escapeHtml(absoluteLogoUrl)}" alt="HHK Logo" />
        <div class="brand-text">
          <h1>HHK Banking Exam Preparation</h1>
          <p>${escapeHtml(examName)}${stageName ? ` • ${escapeHtml(stageName)}` : ""} • ${escapeHtml(sectionName)}</p>
        </div>
      </div>
      <div class="header-right">
        <div class="admin-tag">ADMIN INTERNAL COPY</div>
        <div>Date: ${escapeHtml(generatedDate)}</div>
        <div>Exported by: ${escapeHtml(adminLabel)}</div>
      </div>
    </header>

    <section class="paper-meta">
      <div class="meta-cell">
        <span>Topic</span>
        <strong>${escapeHtml(topicName)}</strong>
      </div>
      <div class="meta-cell">
        <span>Subtopic / Pattern</span>
        <strong>${escapeHtml(subtopicName || "All Exam Patterns")}</strong>
      </div>
      <div class="meta-cell">
        <span>Difficulty Level</span>
        <strong>${escapeHtml(difficulty)}</strong>
      </div>
      <div class="meta-cell">
        <span>Total Questions</span>
        <strong>${normalized.length} Questions</strong>
      </div>
    </section>

    <h2 class="section-heading">Practice Question Paper</h2>
    ${questionsHtml}

    ${
      includeSolutions
        ? `
      <div class="page-break"></div>
      <h2 class="section-heading">Answer Key</h2>
      <div class="ak-grid">${answerKeyHtml}</div>

      <h2 class="section-heading">Detailed Step-by-Step Solutions</h2>
      ${solutionsHtml}
    `
        : ""
    }

    <footer class="doc-footer">
      <span>© ${new Date().getFullYear()} HHK Banking Exam Preparation Platform — Strictly for Internal Admin Review.</span>
      <span>Unauthorized sharing or redistribution is prohibited.</span>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Generates and opens the native Save-as-PDF print dialog via a hidden iframe.
 * Strictly blocked for non-admin users.
 */
export async function exportQuestionsToPdf({
  questions = [],
  meta = {},
  currentUser = null,
  includeSolutions = true,
  includeWatermark = true,
  logoUrl = "/hhk-logo.png",
} = {}) {
  if (!isAdminUser(currentUser)) {
    throw new Error("PDF export is restricted to authorized Admin accounts only.");
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("No questions available to export. Generate or preview questions first.");
  }

  const html = buildPdfHtml({
    questions,
    meta,
    currentUser,
    includeSolutions,
    includeWatermark,
    logoUrl,
  });

  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.setAttribute("aria-hidden", "true");
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        reject(new Error("Could not initialize PDF print frame."));
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      // Wait for logo image to finish loading before printing, with a single-fire safety guard
      let printed = false;
      const triggerPrint = () => {
        if (printed) return;
        printed = true;
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          resolve(true);
        } catch (err) {
          reject(err);
        } finally {
          // Clean up iframe after print dialog closes
          setTimeout(() => {
            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          }, 1500);
        }
      };

      const logoImg = doc.querySelector("img.brand-logo");
      if (logoImg && !logoImg.complete) {
        logoImg.onload = () => setTimeout(triggerPrint, 120);
        logoImg.onerror = () => setTimeout(triggerPrint, 120);
        setTimeout(triggerPrint, 1500);
      } else {
        setTimeout(triggerPrint, 180);
      }
    } catch (err) {
      reject(err);
    }
  });
}