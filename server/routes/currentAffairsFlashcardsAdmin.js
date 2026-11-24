import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import { DECK_TYPES, FLASHCARD_TYPES } from "../services/caFlashcardCategorizer.js";
import { computeFlashcardHash } from "../services/caFlashcardDuplicateDetector.js";
import { generateFlashcards } from "../services/caFlashcardGenerator.js";
import { normalizeExamCodesList } from "../services/caExamMapper.js";

export const currentAffairsFlashcardsAdminRouter = Router();
currentAffairsFlashcardsAdminRouter.use(requireAdmin);

const genLimiter = rateLimit({ windowMs: 60_000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false });

async function audit(actor, action, type, id, details = {}, ip) {
  await pool.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor, action, type, id, JSON.stringify(details), ip || null],
  );
}

currentAffairsFlashcardsAdminRouter.get("/statistics", async (_req, res) => {
  const [decks, cards] = await Promise.all([
    pool.query("SELECT count(*)::int AS total_decks FROM current_affairs_flashcard_decks"),
    pool.query(`
      SELECT
        count(*)::int AS total_cards,
        count(*) FILTER (WHERE publication_status = 'draft')::int AS pending_cards,
        count(*) FILTER (WHERE publication_status IN ('approved', 'published'))::int AS approved_cards,
        count(*) FILTER (WHERE publication_status = 'rejected')::int AS rejected_cards,
        count(*) FILTER (WHERE duplicate_status <> 'unique')::int AS duplicates
      FROM current_affairs_flashcards
    `),
  ]);
  const c = cards.rows[0] || {};
  res.json({
    success: true,
    cardTypes: FLASHCARD_TYPES,
    deckTypes: DECK_TYPES,
    stats: {
      totalDecks: decks.rows[0]?.total_decks ?? 0,
      totalCards: c.total_cards ?? 0,
      pendingCards: c.pending_cards ?? 0,
      approvedCards: c.approved_cards ?? 0,
      rejectedCards: c.rejected_cards ?? 0,
      duplicates: c.duplicates ?? 0,
    },
  });
});

// Decks CRUD
currentAffairsFlashcardsAdminRouter.get("/decks", async (_req, res) => {
  const rows = await pool.query(`
    SELECT d.*,
      count(f.id)::int AS total_cards,
      count(f.id) FILTER (WHERE f.publication_status = 'published')::int AS published_cards
    FROM current_affairs_flashcard_decks d
    LEFT JOIN current_affairs_flashcards f ON f.deck_id = d.id
    GROUP BY d.id
    ORDER BY d.updated_at DESC
  `);
  res.json({ success: true, decks: rows.rows });
});

const deckSchema = z.object({
  deckName: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1000).default(""),
  deckType: z.enum(DECK_TYPES).default("topic"),
  category: z.string().trim().max(100).default(""),
  topic: z.string().trim().max(120).default(""),
  examCode: z.string().trim().max(60).default(""),
  difficulty: z.enum(["easy", "moderate", "difficult"]).default("moderate"),
  publicationStatus: z.enum(["draft", "published", "archived"]).default("draft"),
});

currentAffairsFlashcardsAdminRouter.post("/decks", async (req, res) => {
  const input = deckSchema.parse(req.body);
  // Never publish an empty deck on creation
  const safeStatus = input.publicationStatus === "published" ? "draft" : input.publicationStatus;
  const row = await pool.query(
    `INSERT INTO current_affairs_flashcard_decks
       (deck_name, description, deck_type, category, topic, exam_code, difficulty, publication_status, created_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now()) RETURNING *`,
    [
      input.deckName, input.description, input.deckType, input.category,
      input.topic, input.examCode, input.difficulty, safeStatus, req.session.userId,
    ],
  );
  await audit(req.session.userId, "current_affairs.flashcard_deck.create", "current_affairs_flashcard_deck", row.rows[0].id, { name: input.deckName }, req.ip);
  res.status(201).json({ success: true, deck: row.rows[0] });
});

currentAffairsFlashcardsAdminRouter.put("/decks/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid deck ID." });
  const input = deckSchema.parse(req.body);
  if (input.publicationStatus === "published") {
    const cnt = await pool.query(
      "SELECT count(*)::int AS cnt FROM current_affairs_flashcards WHERE deck_id = $1 AND publication_status = 'published'",
      [req.params.id],
    );
    if ((cnt.rows[0]?.cnt ?? 0) === 0) {
      return res.status(400).json({ error: "Cannot publish an empty deck. Approve at least one flashcard in this deck first." });
    }
  }
  const row = await pool.query(
    `UPDATE current_affairs_flashcard_decks
     SET deck_name=$2, description=$3, deck_type=$4, category=$5, topic=$6,
         exam_code=$7, difficulty=$8, publication_status=$9, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      req.params.id, input.deckName, input.description, input.deckType, input.category,
      input.topic, input.examCode, input.difficulty, input.publicationStatus,
    ],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Deck not found." });
  await audit(req.session.userId, "current_affairs.flashcard_deck.update", "current_affairs_flashcard_deck", req.params.id, { status: input.publicationStatus }, req.ip);
  res.json({ success: true, deck: row.rows[0] });
});

// Generate Cards
async function generateCardsForArticle({ articleId, deckId, cardType, maxCards, actorId, ip }) {
  const artRes = await pool.query("SELECT * FROM current_affairs WHERE id = $1", [articleId]);
  if (!artRes.rowCount) throw Object.assign(new Error("Article not found."), { status: 404 });
  const article = artRes.rows[0];
  const existing = await pool.query(
    "SELECT id, front_text, back_text, content_hash FROM current_affairs_flashcards ORDER BY created_at DESC LIMIT 500",
  );
  const gen = await generateFlashcards({
    sourceTitle: article.title,
    sourceText: `${article.body}\n${article.static_gk || ""}`,
    sourceUrl: article.source_url || "",
    cardType,
    maxCards,
    existingCards: existing.rows,
  });

  const saved = [];
  for (const c of gen.cards) {
    const row = await pool.query(
      `INSERT INTO current_affairs_flashcards
         (deck_id, source_article_id, card_type, front_text, back_text, explanation,
          difficulty, category, topic, subtopic, exam_tags, study_priority, source_url,
          effective_date, content_hash, duplicate_status, validation_status, validation_errors,
          publication_status, created_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18::jsonb,'draft',$19,now())
       RETURNING *`,
      [
        deckId || null, article.id, c.cardType, c.frontText, c.backText, c.explanation,
        c.difficulty, c.category, c.topic, c.subtopic, JSON.stringify(c.examTags),
        c.studyPriority, c.sourceUrl, c.effectiveDate, c.contentHash,
        c.duplicateStatus, c.validationStatus, JSON.stringify(c.validationErrors), actorId,
      ],
    );
    saved.push(row.rows[0]);
  }
  await audit(actorId, "current_affairs.flashcard.generate", "current_affairs_flashcard", null, {
    articleId, generated: saved.length,
  }, ip);
  return saved;
}

currentAffairsFlashcardsAdminRouter.post("/generate", genLimiter, async (req, res) => {
  const input = z
    .object({
      articleId: z.string().uuid(),
      deckId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
      cardType: z.enum(FLASHCARD_TYPES).default("direct_fact"),
      maxCards: z.coerce.number().int().min(1).max(10).default(4),
    })
    .parse(req.body);
  const cards = await generateCardsForArticle({ ...input, actorId: req.session.userId, ip: req.ip });
  res.status(201).json({ success: true, cards });
});

currentAffairsFlashcardsAdminRouter.post("/generate-bulk", genLimiter, async (req, res) => {
  const input = z
    .object({
      articleIds: z.array(z.string().uuid()).min(1).max(10),
      deckId: z.string().uuid().optional(),
      cardType: z.enum(FLASHCARD_TYPES).default("direct_fact"),
      maxCards: z.coerce.number().int().min(1).max(5).default(3),
    })
    .parse(req.body);
  const outcomes = [];
  for (const articleId of [...new Set(input.articleIds)]) {
    try {
      const cards = await generateCardsForArticle({
        articleId, deckId: input.deckId, cardType: input.cardType, maxCards: input.maxCards,
        actorId: req.session.userId, ip: req.ip,
      });
      outcomes.push({ articleId, ok: true, count: cards.length });
    } catch (err) {
      outcomes.push({ articleId, ok: false, error: err.message });
    }
  }
  res.json({ success: true, outcomes });
});

// List, Edit, Approve, Reject Cards
currentAffairsFlashcardsAdminRouter.get("/", async (req, res) => {
  const status = req.query.status && req.query.status !== "all" ? String(req.query.status) : null;
  const deckId = req.query.deckId && isValidUuid(String(req.query.deckId)) ? String(req.query.deckId) : null;
  const rows = await pool.query(
    `SELECT f.*, d.deck_name
     FROM current_affairs_flashcards f
     LEFT JOIN current_affairs_flashcard_decks d ON d.id = f.deck_id
     WHERE ($1::text IS NULL OR f.publication_status = $1)
       AND ($2::uuid IS NULL OR f.deck_id = $2)
     ORDER BY f.updated_at DESC
     LIMIT 200`,
    [status, deckId],
  );
  res.json({ success: true, cards: rows.rows });
});

currentAffairsFlashcardsAdminRouter.put("/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid flashcard ID." });
  const input = z
    .object({
      deckId: z.string().uuid().nullable().optional().or(z.literal("").transform(() => null)),
      frontText: z.string().trim().min(8).max(300),
      backText: z.string().trim().min(2).max(600),
      explanation: z.string().trim().max(800).default(""),
      difficulty: z.enum(["easy", "moderate", "difficult"]).default("moderate"),
      topic: z.string().trim().max(120).default("Banking Awareness"),
      examTags: z.array(z.string().trim()).default([]),
    })
    .parse(req.body);

  const row = await pool.query(
    `UPDATE current_affairs_flashcards
     SET deck_id=$2, front_text=$3, back_text=$4, explanation=$5, difficulty=$6,
         topic=$7, exam_tags=$8::jsonb, content_hash=$9, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      req.params.id, input.deckId ?? null, input.frontText, input.backText, input.explanation,
      input.difficulty, input.topic, JSON.stringify(normalizeExamCodesList(input.examTags)),
      computeFlashcardHash(input.frontText, input.backText),
    ],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Flashcard not found." });
  await audit(req.session.userId, "current_affairs.flashcard.edit", "current_affairs_flashcard", req.params.id, {}, req.ip);
  res.json({ success: true, card: row.rows[0] });
});

currentAffairsFlashcardsAdminRouter.post("/:id/approve", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid flashcard ID." });
  const row = await pool.query(
    `UPDATE current_affairs_flashcards
     SET publication_status = 'published', verification_status = 'verified', updated_at = now()
     WHERE id = $1 AND validation_status <> 'failed'
     RETURNING *`,
    [req.params.id],
  );
  if (!row.rowCount) return res.status(400).json({ error: "Flashcard not found or failed validation." });
  await audit(req.session.userId, "current_affairs.flashcard.approve", "current_affairs_flashcard", req.params.id, {}, req.ip);
  res.json({ success: true, card: row.rows[0] });
});

currentAffairsFlashcardsAdminRouter.post("/:id/reject", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid flashcard ID." });
  const row = await pool.query(
    "UPDATE current_affairs_flashcards SET publication_status = 'rejected', updated_at = now() WHERE id = $1 RETURNING id",
    [req.params.id],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Flashcard not found." });
  await audit(req.session.userId, "current_affairs.flashcard.reject", "current_affairs_flashcard", req.params.id, {}, req.ip);
  res.json({ success: true, status: "rejected" });
});
