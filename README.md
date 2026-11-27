# HHK Banking Exam Preparation Platform

A modern, production-grade web application tailored for Indian banking recruitment examinations (IBPS, SBI, RBI, NABARD, and Other Financial Institutions). The platform provides a full student workspace (timed CBT mock tests, daily challenges, topic-wise practice, bookmarks, live milestones) alongside an administrative control center (exam pattern configuration, modular question engines, question bank importing, student management, attempt grading, and audit logs).

> [!TIP]
> For the complete system architecture, data models, entity relationships, and API lifecycle maps, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## ⚡ Quick Run (Single Command)

To launch the entire application (both backend Express API and frontend Vite React app together):

```powershell
npm run dev
```

- **Frontend Web App**: [http://localhost:5173](http://localhost:5173)
- **Backend REST API**: [http://localhost:3001](http://localhost:3001)

---

## What's New in V11 (Latest Release)

### 1. 100% Reasoning Ability Modular Question Engine (19/19 Topics Auto-Generate Ready)
- **Complete Deterministic Reasoning Suite (`server/question-engine/generators/reasoning/`)**: Built, solver-verified, and wired all **19/19** banking-exam Reasoning topics into `engineRouter.js`, `questionGenerator.js`, and `subjectGeneratorRegistry.js`:
  - **Core & Puzzle Engines**: Blood Relations, Seating Arrangement (Linear, Circular, Dual-Row, Uncertain), Floor-Based Puzzles, Multi-Family Puzzles (10 families), Syllogism, Inequality, Number Series, Data Sufficiency.
  - **Newly Added & Verified Engines**: Coding-Decoding, Direction & Distance, Order & Ranking, Alphanumeric Series, Letter Series, Input-Output, Logical Reasoning, Statement & Conclusion, Statement & Assumption, Cause & Effect, Analogy, and Classification.
- **Engine Quality Guarantees**: Strict 5-option banking format (`A`–`E`), balanced answer-key distribution, multi-subtype rotation on single-item loops, SHA-256 fingerprint deduplication, and full regression verification (`tests/verify_all_reasoning_topics.js`: 19/19 topics, 190/190 questions passing).

### 2. 100% English Language Modular Question Engine (13/13 Topics Auto-Generate Ready)
- **12 Deterministic Modular English Engines (`server/question-engine/generators/english/`)**:
  - Cloze Test, Error Detection, Sentence Correction, Fill in the Blanks, Para Jumbles, Sentence Rearrangement, Phrase Replacement, Vocabulary, Synonyms & Antonyms, Idioms & Phrases, Word Usage, and **Grammar** (5 subtopics: Active & Passive Voice, Direct & Indirect Speech, Tenses/Conditionals/Modals, Articles & Determiners, Prepositions/Conjunctions/Question Tags).
  - Verified end-to-end across all 12 modular topics (120/120 unique questions, balanced `A`–`E` keys, < 2 ms per 20-question batch).
- **Gemini AI Reading Comprehension Connected to Question Bank (`server/routes/admin.js`, `rcAiEngineService.js`)**:
  - Connected `generateRcPassageAndQuestionsWithAi` directly into `POST /api/admin/questions/generate` (atomic 5-question passage sets) and merged `"Reading Comprehension"` with `SUPPORTED_AUTO_TOPICS.english` in `GET /api/admin/questions/generate/topics` for full **13/13 English Language** coverage.

### 3. Research-Based Exam-Wise Question Selection, Zero-Timer-Mismatch Guard & Group-Aware Sequencing
- **15 Official 2026 Banking Exam Patterns (`server/exam-engine/examPatternCatalog.js`)**:
  - Separate Prelims & Mains blueprints covering **IBPS RRB Office Assistant (Clerk)**, **IBPS RRB Officer Scale I (PO)**, **IBPS Clerk (CSA)**, **IBPS PO**, **SBI Clerk**, **SBI PO**, **RBI Assistant**, and **RBI Grade B (Phase 1)** with historical-trend topic distributions and smart subject inference (including `Aptitude`, `Numerical Ability`, `Quantitative Aptitude`, `Reasoning & Computer Aptitude`, and custom section fallbacks).
- **Active Multi-Subject Registry (`server/exam-engine/subjectGeneratorRegistry.js`)**:
  - Activated **Quantitative Aptitude**, **Reasoning Ability**, and **English Language** in the centralized registry, enabling 1-click full Prelims mock test generation (e.g., 80/80 unique questions for IBPS RRB Office Assistant Prelims with 0 duplicates).
- **Interactive Admin Question Selection Editor (`client/src/components/admin/ExamQuestionSelectionSection.jsx`, `MockTestBuilderView.jsx`)**:
  - Automatically loads applicable subjects, research-based topic counts, trend ranges, and live published Question Bank stock per topic upon selecting any Exam + Stage.
  - Lets admins edit topic question counts, enable/disable individual topics or sections, adjust marks/negative marks/duration, auto-balance totals, **Save Custom Pattern** (`POST /api/admin/exam-engine/patterns`), **Restore Default** (`POST /api/admin/exam-engine/patterns/reset`), and generate strict Question Bank tests (`POST /api/admin/exam-engine/generate-from-bank` via `server/exam-engine/bankQuestionSelector.js`) with itemized per-topic shortage warnings and zero silent substitution of unrelated topics.
- **Zero Timer Mismatch on Publish (`server/services/mockTestValidation.js`, `server/routes/examEngine.js`)**:
  - Automatically aligns `mock_tests.duration_seconds` with `exam_sections` sectional timer sums during generation, UI edits, and publish validation, and surfaces clear publish block reasons directly under the Blueprint Progress badge in **Manage Exam Wise Tests**.
- **Group-Aware Consecutive Question Sequencing (`server/exam-engine/questionSequencer.js`)**:
  - Guarantees that all questions belonging to the same **Data Interpretation (DI)**, **Seating Arrangement**, **Floor/Box/Month/Date/Linear/Circular Puzzle**, **Reading Comprehension**, or **Cloze/Passage** set always appear **strictly consecutively** and in their **original internal order (`1, 2, 3, 4, 5`)**, while shuffling distinct sets and standalone questions at the atomic block level across `intelligentMockTestEngine.js`, `bankQuestionSelector.js`, and `questionSelection.js` (Prelims & Mains).

### 4. Phase 1 & Phase 2 Search Engine Optimization (SEO) & Public Landing Pages
- **Technical & On-Page SEO (`client/index.html`, `server/services/seoService.js`, `server/index.js`)**:
  - Upgraded `client/index.html` with full title/description metadata, canonical link, Open Graph & Twitter Card tags, Schema.org `EducationalOrganization` + `WebSite` JSON-LD, and a lightweight 37.9 KB `/favicon.png` (99.1% smaller than the original 4.2 MB icon).
  - Added `client/public/robots.txt`, dynamic `GET /robots.txt`, dynamic `GET /sitemap.xml` (core public routes + live PostgreSQL exam discovery), and server-side SPA meta-tag injection in Express (`server/index.js`) with automatic `noindex, nofollow` on `/admin/*`, `/api/*`, and authenticated workspaces.
- **Public SEO Exam Landing Pages & Clean URL Routing (`client/src/utils/publicRoutes.js`, `client/src/utils/seo.js`, `SeoLandingPage.jsx`, `PublicPortal.jsx`, `App.jsx`)**:
  - Added clean History API URL routing (`/` through `/exams`, `/mock-tests`, `/pricing`, `/exams/ibps-po`, `/exams/sbi-po`, `/banking-awareness`, `/current-affairs`, and legal/support routes) with crawlable `<a href>` links, dynamic `document.title`/canonical updates, and dedicated landing pages featuring exam-pattern tables, syllabus coverage, and `FAQPage` JSON-LD.

### 5. AI-Powered Current Affairs Question Generator & Practice Platform
- **Complete Legacy Replacement (`032_ai_ca_question_platform.sql`)**: Normalized AI-driven platform (`ca_source_batches`, `ca_extracted_events`, `ca_generated_questions`, `ca_practice_sets`, `ca_student_attempts`, `ca_pdf_exports`, `ca_trusted_sources`).
- **Backend-Only AI Integration (`caAiProvider.js`, `caAiEngineService.js`)**: Supports Gemini and OpenAI via environment variables with multi-model failover, strict schema validation, duplicate detection, and zero simulated fallbacks when disabled.
- **14 Banking Exam Question Formats & 6 Practice Set Presets**: Full Admin Studio (`AdminCaStudio.jsx`) with day-wise IST date filtering, topic-grouped Question Review, **Approve All Pending**, inline Question Editor, Manual Question Selection, strict no-reuse tracking (`used_in_set_ids`), and trusted RSS fetch pipeline (`caAutomationService.js`, `caStudioAdmin.js`).
- **HHK-Branded A4 PDF Exports (`caPdfGeneratorService.js`)**: Pure Node.js PDF 1.4 generator embedding `client/public/hhk-logo.png` natively across 4 formats (`questions_only`, `answer_key`, `detailed_solutions`, `complete_booklet`).

### 6. AI-Based Reading Comprehension & Atomic 5-Question Sets
- **Full Reading Comprehension AI Engine (`033_reading_comprehension_ai_module.sql`, `rcAiEngineService.js`, `readingComprehensionAdmin.js`)**: Covers all 15 RC categories, 10 banking exam question types, 9 banking examinations, 4 difficulty levels, 3 passage lengths, passage-based vocabulary (English & Tamil meanings), Guided 5-Step Editor, and Admin Practice/Answer PDF downloads (`rcPdfGeneratorService.js`).
- **Atomic 5-Question Passage Sets**: Enforced as indivisible 5-question sets across Exam-Wise and Topicwise Tests (`assertCompleteRcPassageSets`), integrated into the unified Student CBT exam interface.

### 7. Exam-Wise & Topicwise Mock Test Management Upgrades
- **Complete Transactional Delete (`DELETE /api/admin/tests/:id` & `/api/admin/mock-tests/:id`)**: Safe deletion with confirmation modal, `payment_orders` protection, `?force=true` guard for tests with attempts, audit logging, and Question Bank preservation.
- **Hierarchical Question Bank Picker (`MockTestBuilderView.jsx`, `AdminOverview.jsx`, `server/routes/admin.js`)**: Stage-scoped 2,000-row question loading organized by Section Tabs → Collapsible Topic Groups → Subtopic Groups, with `used_in_sets` filtering, capacity enforcement, and atomic RC Set selection.

---

## Core Platform Capabilities

1. **Clean Pure JS/JSX Production Architecture**: React 19 JSX (`client/`), Node.js ES Modules (`server/`), shared syllabus & exam models (`shared/`), SQL migrations (`server/migrations/`), and automated verification suites (`tests/`).
2. **Master Exam Catalogue (19 Exams Across 5 Categories)**: IBPS (7), SBI (3), RBI (2), NABARD (2), and Other Banks/Institutions (5).
3. **Complete Banking Syllabus**: 6 subjects and 118 topics with dynamic Exam → Subject → Topic → Subtopic → Difficulty hierarchy.
4. **Proctored CBT Exam Experience**: Single-tab BroadcastChannel lock, fullscreen enforcement, mouse-only mode, dynamic option shuffling, and local webcam monitor.
5. **DevTools Security & Code Concealment**: Production Vite builds disable source maps (`sourcemap: false`) and block direct source/config path requests.
6. **Administrator Role & Access Management**: Dedicated `/admin/users` view with role promotion/demotion, status toggles, self-lockout safeguards, and audit logs.

---

## Directory Structure

```text
BANKING-PLATFORM/
├── client/                               # Frontend Single-Page Application (React 19, pure JSX)
│   ├── index.html                        # SEO-enhanced HTML entry point + Schema.org JSON-LD
│   ├── vite.config.js                    # Vite configuration (source blocking, API proxy, CSP)
│   ├── public/                           # favicon.png, robots.txt, hhk-logo.png, hik-logo.png
│   └── src/
│       ├── main.jsx                      # React entry mounting
│       ├── App.jsx                       # Root routing, URL sync, toasts, tab lockout listener
│       ├── AuthPage.jsx                  # Sign-in, sign-up, forgot/reset password
│       ├── AdminOverview.jsx             # Admin dashboard landing
│       ├── AdminPanel.jsx                # Full administration portal
│       ├── StudentWorkspace.jsx          # Student preparation dashboard
│       ├── api/
│       │   └── client.js                 # Authenticated fetch wrapper
│       ├── components/
│       │   ├── common/                   # Field.jsx, FeedbackSystem.jsx
│       │   ├── auth/                     # AuthBrand, LoginForm, RegisterForm, etc.
│       │   ├── public/                   # PublicPortal, SeoLandingPage, LegalPages, etc.
│       │   ├── admin/                    # MockTestBuilderView, ExamQuestionSelectionSection, IntelligentExamCreatorPanel, etc.
│       │   └── student/                  # TestRunner, PracticeRunner, DailyChallengeView, etc.
│       ├── styles/                       # Modular CSS stylesheets
│       └── utils/
│           ├── examCategories.js         # Master banking category groupings
│           ├── examLock.js               # Single-tab proctoring and fullscreen helpers
│           ├── publicRoutes.js           # Clean URL routing & public SEO landing page definitions
│           └── seo.js                    # Client-side SPA document.title/meta/canonical sync
│
├── server/                               # Backend API (Node.js ES Modules, pure JS)
│   ├── index.js                          # Express app, Helmet, /robots.txt, /sitemap.xml, SPA meta injection
│   ├── db.js                             # pg.Pool connection with SSL and timeouts
│   ├── middleware.js                     # requireAuth, requireAdmin, Zod validator
│   ├── schemas.js                        # Request/response validation schemas
│   ├── migrate.js                        # SQL migration runner
│   ├── seed-admin.js                     # Administrator account bootstrapping
│   ├── migrations/                       # 001 through 033 SQL migrations
│   ├── exam-engine/                      # examPatternCatalog, subjectGeneratorRegistry, bankQuestionSelector, questionSequencer, intelligentMockTestEngine
│   ├── question-engine/                  # Core router/formatter/validator + Quant, Reasoning (19/19), English (12/12) generators
│   ├── routes/                           # admin.js, examEngine.js, attempts.js, auth.js, content.js, public.js, etc.
│   └── services/                         # questionGenerator.js, questionSelection.js, mockTestValidation.js, seoService.js, etc.
│
├── shared/                               # Shared constants, banking syllabus & exam category logic
├── docs/
│   └── ARCHITECTURE.md                   # Complete architectural guide & data flow map
├── scripts/
│   ├── build-web.mjs                     # Production client build runner
│   └── dev-protected.mjs                 # Protected dev server with hot reload & source blocking
├── tests/                                # Automated engine, SEO, sequencing & workflow verification suites
├── .env, .env.example, .gitignore
├── docker-compose.yml
└── package.json
```

---

## Prerequisites

- **Node.js**: Version 20 or 22+ installed ([nodejs.org](https://nodejs.org/))
- **PostgreSQL**: PostgreSQL 15+ running locally (or via Docker Desktop)

---

## Quick Start & Setup

### 1. Install Dependencies

```powershell
npm install
```

### 2. Configure Environment (`.env`)

Create your `.env` file from the example template:

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure your credentials:

```env
# Database Configuration
POSTGRES_PASSWORD=your_postgres_password
DATABASE_URL=postgresql://postgres:your_postgres_password@localhost:5432/your_database_name
DATABASE_SSL=false

# Server, Session & SEO Site URL
PORT=3001
NODE_ENV=development
SESSION_SECRET=replace-with-at-least-32-random-characters
APP_URL=http://localhost:5173
# Optional: set to your live domain in production for robots.txt, sitemap.xml & canonical URLs
PUBLIC_SITE_URL=

# Admin Account Seeding
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-admin-password-12-or-more-characters
ADMIN_FULL_NAME=HHK Administrator
ADMIN_MOBILE=+919876543210

# AI Question Generation (Current Affairs & Reading Comprehension)
CA_AI_ENABLED=true
CA_AI_PROVIDER=gemini
CA_AI_MODEL=gemini-3.5-flash,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.7-flash,gemini-3.8-flash
GEMINI_API_KEY=your_gemini_api_key
CA_AI_TIMEOUT_MS=60000
CA_AI_MAX_RETRIES=0

# SMTP Email (Optional - needed for password reset emails)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

> [!NOTE]
> If your database name contains spaces, URL-encode the space as `%20` (e.g. `postgresql://postgres:TIGER@localhost:5432/HHK%20Administrator`).

### 3. Setup the Database

Apply all SQL migrations and seed the initial administrator:

```powershell
# Run all 33 database migrations (001 through 033)
npm run db:migrate

# Seed your default administrator account
npm run db:seed-admin
```

*(If using Docker Desktop for PostgreSQL instead of a local install, run `docker compose up -d postgres` before running `npm run db:migrate`)*.

---

## 🚀 How to Run the Project

### 1. Development Mode (All-in-One Command)

Starts both the backend Express API server and the Vite React frontend concurrently with live reloading:

```powershell
npm run dev
```

| Component | URL | Description |
| :--- | :--- | :--- |
| **Frontend UI** | [http://localhost:5173](http://localhost:5173) | Vite preview client with DevTools code-protection and `/api` proxy |
| **Backend API** | [http://localhost:3001](http://localhost:3001) | Express REST API connected to PostgreSQL with native `node --watch` |

### 2. Running Services in Separate Terminals

**Terminal 1 — Backend Express Server (Port 3001):**
```powershell
npm run dev:server
```

**Terminal 2 — Frontend Client (Port 5173):**
```powershell
npm run dev:client
```

### 3. Production Mode (Single Port 3001)

In production, Express serves both the pre-built, optimized client bundle (with dynamic server-side SEO meta injection) and all API endpoints on a single port:

```powershell
npm run db:migrate
npm run build
npm start
```

- **Production App**: [http://localhost:3001](http://localhost:3001)

---

## Verification & Testing

Run the core integration workflow suite:

```powershell
npm test
```

Run the Question Engine, Exam-Wise Selection, Group Sequencing, and SEO verification suites:

```powershell
# Core Question Engine regression audit
node server/question-engine/tests/auditRefactoringRegression.js

# Reasoning (all 19 topics) & English Grammar verification
node tests/verify_all_reasoning_topics.js
node tests/verify_grammar_engine.js

# Exam-Wise Question Selection (15 official patterns + shortage warnings + 80/80 RRB OA Prelims)
node tests/verify_exam_wise_question_selection.js

# Group-Based Consecutive Question Sequencing (DI, Seating, Puzzles, Passages)
node tests/verify_group_question_sequencing.js

# Phase 1 & Phase 2 SEO verification (metadata, JSON-LD, robots.txt, sitemap.xml, clean URLs)
node tests/verify_seo_pack.js
node tests/verify_seo_landing_pages.js
```

---

## Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | **Starts both backend API and frontend client concurrently** |
| `npm run dev:server` | Starts Express backend in native Node.js `--watch` mode (`port 3001`) |
| `npm run dev:client` | Starts Vite protected development client (`port 5173`) |
| `npm run build` | Builds optimized client bundle into `client/dist/` (no source maps) |
| `npm run preview` | Previews the production client build locally |
| `npm start` | Runs the production Express server serving API + static frontend |
| `npm run db:migrate` | Applies all pending migrations from `server/migrations/` |
| `npm run db:seed-admin` | Bootstraps the administrator account defined in `.env` |
| `npm test` | Runs the integration and workflow test suite |
