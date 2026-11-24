import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { categorizeOneLiner, ONE_LINER_CATEGORIES } from "../server/services/caOneLinerCategorizer.js";
import { detectDuplicateOneLiner } from "../server/services/caOneLinerDuplicateDetector.js";
import { validateOneLiner } from "../server/services/caOneLinerValidator.js";
import { generateOneLiners } from "../server/services/caOneLinerGenerator.js";
import { DECK_TYPES, FLASHCARD_TYPES } from "../server/services/caFlashcardCategorizer.js";
import { detectDuplicateFlashcard } from "../server/services/caFlashcardDuplicateDetector.js";
import { validateFlashcard } from "../server/services/caFlashcardValidator.js";
import { computeNextFlashcardReview } from "../server/services/caFlashcardReviewScheduler.js";
import { generateFlashcards } from "../server/services/caFlashcardGenerator.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  [FAIL] ${name}\n         ${err.stack || err.message}`);
  }
}

console.log("=== HHK Phase 7: One-Liner Digest & Flashcards — Automated Verification ===\n");

const SAMPLE_SRC =
  "On 9 October 2024, the Reserve Bank of India (RBI) kept the policy repo rate unchanged at 6.50% and shifted stance to neutral. The SDF rate remains 6.25%.";

await test("1. One-Liner generator, 18 categories, grounding validator & duplicate detector work end to end", async () => {
  assert.equal(ONE_LINER_CATEGORIES.length, 18);
  const cat = categorizeOneLiner({ factText: "RBI kept policy repo rate unchanged at 6.50%.", bankingRelevanceScore: 95 });
  assert.equal(cat.categoryName, "RBI and Monetary Policy");
  assert.equal(cat.studyPriority, "must_study");

  const out = await generateOneLiners({
    sourceTitle: "RBI MPC Review",
    sourceText: SAMPLE_SRC,
    sourceUrl: "https://rbi.org.in/pr/1",
    maxItems: 2,
    providerFn: async () => ({
      provider: "mock",
      model: "mock-v1",
      rawText: JSON.stringify({
        oneLiners: [
          {
            factText: "RBI Monetary Policy Committee kept the policy repo rate unchanged at 6.50% on 9 October 2024.",
            categoryName: "RBI and Monetary Policy",
            studyPriority: "must_study",
            bankingRelevanceScore: 95,
            examTags: ["IBPS PO", "SBI PO"],
          },
        ],
      }),
    }),
  });
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].publicationStatus, "draft");
  assert.equal(out.items[0].validationStatus, "passed");

  // Ungrounded number fails validation
  const bad = validateOneLiner({
    oneLiner: { factText: "RBI raised the policy repo rate sharply to 9.25% in October 2024." },
    sourceText: SAMPLE_SRC,
  });
  assert.equal(bad.status, "failed");

  // Duplicate detection
  const dup = detectDuplicateOneLiner(
    "RBI Monetary Policy Committee kept the policy repo rate unchanged at 6.50% on 9 October 2024.",
    [{ id: "1", fact_text: "RBI Monetary Policy Committee kept the policy repo rate unchanged at 6.50% on 9 October 2024." }],
  );
  assert.equal(dup.status, "exact_duplicate");
});

await test("2. Flashcard generator (8 card types, 6 deck types), validator & duplicate detector work end to end", async () => {
  assert.equal(FLASHCARD_TYPES.length, 8);
  assert.equal(DECK_TYPES.length, 6);

  const out = await generateFlashcards({
    sourceTitle: "RBI MPC Review",
    sourceText: SAMPLE_SRC,
    cardType: "rbi_monetary_policy",
    maxCards: 2,
    providerFn: async () => ({
      provider: "mock",
      model: "mock-v1",
      rawText: JSON.stringify({
        cards: [
          {
            frontText: "What was the RBI policy repo rate maintained at on 9 October 2024?",
            backText: "6.50%",
            explanation: "The RBI MPC retained the policy repo rate at 6.50% and shifted stance to neutral.",
            difficulty: "easy",
            examTags: ["SBI PO"],
          },
        ],
      }),
    }),
  });
  assert.equal(out.cards.length, 1);
  assert.equal(out.cards[0].publicationStatus, "draft");
  assert.equal(out.cards[0].validationStatus, "passed");

  // Answer repeating front fails validation
  const repeat = validateFlashcard({
    card: { frontText: "What is Repo Rate?", backText: "What is Repo Rate?" },
    sourceText: SAMPLE_SRC,
  });
  assert.equal(repeat.status, "failed");

  // Hallucinated number fails validation
  const wrongNum = validateFlashcard({
    card: { frontText: "What was the SDF rate on 9 October 2024?", backText: "8.75%" },
    sourceText: SAMPLE_SRC,
  });
  assert.equal(wrongNum.status, "failed");

  const dup = detectDuplicateFlashcard(
    { frontText: "What is CRR?", backText: "Cash Reserve Ratio" },
    [{ id: "2", front_text: "What is CRR?", back_text: "Cash Reserve Ratio" }],
  );
  assert.equal(dup.status, "exact_duplicate");
});

await test("3. Deterministic spaced-repetition scheduler computes intervals accurately for again, hard, good, easy", () => {
  const now = new Date("2026-11-24T00:00:00Z");

  const again = computeNextFlashcardReview({ response: "again", previousIntervalDays: 7, successfulReviews: 3, missedReviews: 0, now });
  assert.equal(again.nextIntervalDays, 0);
  assert.equal(again.successfulReviews, 0);
  assert.equal(again.missedReviews, 1);

  const hard = computeNextFlashcardReview({ response: "hard", previousIntervalDays: 0, now });
  assert.equal(hard.nextIntervalDays, 1);

  const good1 = computeNextFlashcardReview({ response: "good", previousIntervalDays: 0, now });
  assert.equal(good1.nextIntervalDays, 3);
  const good2 = computeNextFlashcardReview({ response: "good", previousIntervalDays: 3, now });
  assert.ok(good2.nextIntervalDays > 3);

  const easy1 = computeNextFlashcardReview({ response: "easy", previousIntervalDays: 0, now });
  assert.equal(easy1.nextIntervalDays, 7);
  const easy2 = computeNextFlashcardReview({ response: "easy", previousIntervalDays: 7, now });
  assert.ok(easy2.nextIntervalDays > 7);
});

await test("4. Migration 028, 4 mounted routers & student/admin UI integrations are complete", () => {
  const sql = fs.readFileSync(
    path.join(projectRoot, "server/migrations/028_current_affairs_revision_modules.sql"),
    "utf8",
  );
  for (const tbl of [
    "current_affairs_one_liners",
    "current_affairs_one_liner_reviews",
    "current_affairs_flashcard_decks",
    "current_affairs_flashcards",
    "current_affairs_flashcard_reviews",
    "current_affairs_flashcard_progress",
    "current_affairs_flashcard_bookmarks",
  ]) {
    assert.ok(sql.includes(tbl), `Migration 028 missing table: ${tbl}`);
  }

  const indexJs = fs.readFileSync(path.join(projectRoot, "server/index.js"), "utf8");
  for (const r of [
    "currentAffairsOneLinersStudentRouter",
    "currentAffairsOneLinersAdminRouter",
    "currentAffairsFlashcardsStudentRouter",
    "currentAffairsFlashcardsAdminRouter",
  ]) {
    assert.ok(indexJs.includes(r), `server/index.js missing mount: ${r}`);
  }

  const deckJsx = fs.readFileSync(
    path.join(projectRoot, "client/src/components/student/FlashcardDeck.jsx"),
    "utf8",
  );
  assert.ok(deckJsx.includes("ArrowRight") && deckJsx.includes("ArrowLeft") && deckJsx.includes('"Space"'));

  const stuCa = fs.readFileSync(path.join(projectRoot, "client/src/components/student/StudentCurrentAffairs.jsx"), "utf8");
  assert.ok(stuCa.includes("CurrentAffairsOneLiners") && stuCa.includes("CurrentAffairsFlashcards"));

  const admCa = fs.readFileSync(path.join(projectRoot, "client/src/components/admin/CurrentAffairsView.jsx"), "utf8");
  assert.ok(admCa.includes("CurrentAffairsOneLinerAdmin") && admCa.includes("CurrentAffairsFlashcardAdmin"));
});

console.log(`\n=== PHASE 7 SUMMARY: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
