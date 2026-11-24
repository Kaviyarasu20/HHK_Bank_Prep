import { executeAiCompletion, getAiConfig } from "./caAiProvider.js";

/**
 * Monthly Capsule Draft Generator & AI Assistant.
 * - Aggregates strictly APPROVED / PUBLISHED HHK content for a target year & month.
 * - Groups links into standard banking exam capsule sections without duplicating content text.
 * - Optional AI assistance (reusing Phase 5 caAiProvider.js) can suggest a concise
 *   capsule description and section introductions strictly as DRAFT content.
 * - Never auto-publishes and never fabricates facts, rates, limits, or appointments.
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatMonthYearTitle(year, month) {
  const name = MONTH_NAMES[Number(month) - 1] || `Month ${month}`;
  return `${name} ${year} Banking & Current Affairs Capsule`;
}

export async function gatherApprovedMonthlyCandidates({ year, month, dbPool } = {}) {
  const pool = dbPool || (await import("../db.js")).pool;
  const yr = Number(year);
  const mo = Number(month);
  if (!Number.isInteger(yr) || !Number.isInteger(mo) || mo < 1 || mo > 12) {
    throw new Error("Valid capsule year and month (1–12) are required.");
  }

  const startDate = `${yr}-${String(mo).padStart(2, "0")}-01`;
  const nextYear = mo === 12 ? yr + 1 : yr;
  const nextMonth = mo === 12 ? 1 : mo + 1;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const [articlesRes, oneLinersRes, flashcardsRes, mcqsRes, ratesRes] = await Promise.all([
    pool.query(
      `SELECT ca.id::text AS content_id, ca.title, c.name AS category,
              ca.source_url, ca.published_at::date AS effective_date
       FROM current_affairs ca
       LEFT JOIN current_affairs_categories c ON c.id = ca.category_id
       WHERE ca.status = 'published'
         AND ca.published_at >= $1::date
         AND ca.published_at < $2::date
       ORDER BY ca.published_at DESC
       LIMIT 60`,
      [startDate, endDate],
    ),
    pool.query(
      `SELECT id::text AS content_id, fact_text AS title, category_name AS category,
              source_url, COALESCE(important_date, effective_date, created_at::date) AS effective_date
       FROM current_affairs_one_liners
       WHERE publication_status = 'published'
         AND verification_status = 'approved'
         AND COALESCE(important_date, effective_date, created_at::date) >= $1::date
         AND COALESCE(important_date, effective_date, created_at::date) < $2::date
       ORDER BY important_date DESC NULLS LAST, created_at DESC
       LIMIT 80`,
      [startDate, endDate],
    ),
    pool.query(
      `SELECT id::text AS content_id, front_text AS title, category,
              source_url, COALESCE(effective_date, created_at::date) AS effective_date
       FROM current_affairs_flashcards
       WHERE publication_status = 'published'
         AND verification_status = 'approved'
         AND COALESCE(effective_date, created_at::date) >= $1::date
         AND COALESCE(effective_date, created_at::date) < $2::date
       ORDER BY created_at DESC
       LIMIT 60`,
      [startDate, endDate],
    ),
    pool.query(
      `SELECT id::text AS content_id, LEFT(question_text, 160) AS title, topic AS category,
              source_reference AS source_url, created_at::date AS effective_date
       FROM current_affairs_generated_questions
       WHERE review_status = 'approved'
         AND created_at >= $1::date
         AND created_at < $2::date
       ORDER BY created_at DESC
       LIMIT 60`,
      [startDate, endDate],
    ),
    pool.query(
      `SELECT id::text AS content_id, rate_name AS title, 'RBI Policy Rates' AS category,
              source_url, effective_date
       FROM banking_policy_rates
       WHERE status = 'published'
         AND effective_date >= $1::date
         AND effective_date < $2::date
       ORDER BY effective_date DESC NULLS LAST
       LIMIT 20`,
      [startDate, endDate],
    ),
  ]);

  return {
    articles: articlesRes.rows.map((r) => ({ ...r, content_type: "article" })),
    oneLiners: oneLinersRes.rows.map((r) => ({ ...r, content_type: "one_liner" })),
    flashcards: flashcardsRes.rows.map((r) => ({ ...r, content_type: "flashcard" })),
    mcqs: mcqsRes.rows.map((r) => ({ ...r, content_type: "mcq" })),
    bankingReferences: ratesRes.rows.map((r) => ({ ...r, content_type: "banking_reference" })),
  };
}

/**
 * Pure deterministic section organizer for a monthly capsule draft.
 */
export function buildCapsuleDraftPlan({ year, month, candidates }) {
  const sections = [];
  const pushSection = (title, categoryName, intro, items) => {
    if (!items || items.length === 0) return;
    sections.push({
      title,
      category_name: categoryName,
      introduction: intro,
      sort_order: sections.length + 1,
      links: items.map((item, idx) => ({
        content_type: item.content_type,
        content_id: item.content_id,
        source_url: item.source_url || null,
        effective_date: item.effective_date || null,
        sort_order: idx + 1,
      })),
    });
  };

  pushSection(
    "Key Current Affairs Highlights",
    "Current Affairs",
    "Approved current affairs articles published during this month.",
    candidates.articles || [],
  );
  pushSection(
    "Banking Awareness & Policy Updates",
    "Banking Awareness",
    "Verified banking reference updates effective during this month.",
    candidates.bankingReferences || [],
  );
  pushSection(
    "Rapid One-Liner Revision",
    "One-Liners",
    "Approved exam-oriented one-liner facts for fast recall.",
    candidates.oneLiners || [],
  );
  pushSection(
    "Practice MCQs",
    "MCQs",
    "Approved banking exam MCQs linked to this month's developments.",
    candidates.mcqs || [],
  );
  pushSection(
    "Active Recall Flashcards",
    "Flashcards",
    "Approved flashcards for spaced repetition.",
    candidates.flashcards || [],
  );

  const totalItems = sections.reduce((sum, s) => sum + s.links.length, 0);
  const estimatedReadMinutes = Math.max(5, Math.min(180, Math.round(totalItems * 1.5)));

  return {
    title: formatMonthYearTitle(year, month),
    description: `Curated monthly revision capsule linking ${totalItems} approved item(s) across ${sections.length} section(s).`,
    estimated_read_minutes: estimatedReadMinutes,
    sections,
  };
}

/**
 * Optional AI-assisted draft summary helper reusing Phase 5 caAiProvider.js.
 * Always returns draft-only text; safely falls back to deterministic summary if AI is disabled.
 */
export async function generateAiCapsuleDraftIntro({ year, month, sectionTitles = [], totalItems = 0, env = process.env }) {
  const cfg = getAiConfig(env);
  const fallback = {
    usedAi: false,
    description: `Structured monthly revision capsule for ${MONTH_NAMES[Number(month) - 1] || month} ${year} covering ${totalItems} approved item(s) across ${sectionTitles.length} section(s).`,
  };

  if (!cfg.enabled || !cfg.hasApiKey) {
    return fallback;
  }

  try {
    const systemPrompt =
      "You are an editorial assistant for an Indian banking exam platform. Write a concise, neutral 2-sentence overview for a monthly revision capsule using ONLY the provided section titles and item count. Do NOT invent any rates, numbers, facts, appointments, or events. Return JSON: {\"description\": \"...\"}.";
    const userPrompt = JSON.stringify({
      year,
      month: MONTH_NAMES[Number(month) - 1] || month,
      sectionTitles,
      totalItems,
    });

    const result = await executeAiCompletion({ systemPrompt, userPrompt, env });
    const parsed = JSON.parse(result.rawText || "{}");
    if (typeof parsed.description === "string" && parsed.description.trim().length >= 10) {
      return { usedAi: true, description: parsed.description.trim().slice(0, 600) };
    }
    return fallback;
  } catch {
    return fallback;
  }
}
