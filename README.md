# HHK Banking Exam Preparation Platform

A modern, production-grade web application tailored for Indian banking recruitment examinations (IBPS, SBI, RBI, NABARD, and Other Financial Institutions). The platform provides a full student workspace (timed CBT mock tests, daily challenges, topic-wise practice, bookmarks, live milestones) alongside an administrative control centre (exam pattern configuration, question bank importing, student management, attempt grading, and audit logs).

> \[!TIP\]
> For the complete system architecture, data models, entity relationships, and API lifecycle maps, see [docs/ARCHITECTURE.md](https://www.google.com/search?q=docs/ARCHITECTURE.md).

## ⚡ Quick Run (Single Command)

To launch the entire application (both backend Express API and frontend Vite React app together):

```
npm run dev

```

* **Frontend Web App**: <http://localhost:5173>

* **Backend REST API**: <http://localhost:3001>

## What's New (Latest Release)

### 1. AI-Powered Current Affairs Question Generator & Practice Platform

* **Complete Legacy Replacement (`032_ai_ca_question_platform.sql`)**: Replaced legacy static current affairs articles/flashcards/capsules with a normalized AI-driven platform (`ca_source_batches`, `ca_extracted_events`, `ca_generated_questions`, `ca_practice_sets`, `ca_student_attempts`, `ca_pdf_exports`, `ca_trusted_sources`).

* **Backend-Only AI Integration (`caAiProvider.js`, `caAiEngineService.js`)**: Supports Gemini and OpenAI via environment variables with multi-model failover, strict schema validation, duplicate detection, and zero simulated fallbacks when disabled.

* **14 Banking Exam Question Formats & 6 Practice Set Presets**: Full Admin Studio (`AdminCaStudio.jsx`) with day-wise IST date filtering, topic-grouped Question Review, **Approve All Pending**, inline Question Editor (`PUT /questions/:id`), Manual Question Selection (`GET`/`PUT /practice-sets/:id/questions`), strict no-reuse tracking across sets (`used_in_set_ids`), and auto-archiving for duplicate topics.

* **Trusted Source RSS Fetch Pipeline (`caAutomationService.js`, `caStudioAdmin.js`)**: Fixed outbound SSRF URL validation unpacking (`validateOutboundFeedUrl`) and XML parser mapping (`parseFeedXml`), added per-source **Fetch Now** and **Delete** buttons, and added a live **Last Fetch Results** status box showing exact item counts or errors.

* **HHK-Branded A4 PDF Exports (`caPdfGeneratorService.js`)**: Pure Node.js PDF 1.4 generator embedding `client/public/hhk-logo.png` natively across 4 formats (`questions_only`, `answer_key`, `detailed_solutions`, `complete_booklet`).

### 2. AI-Based Reading Comprehension Question Generator & Atomic 5-Question Sets

* **Full Reading Comprehension AI Engine (`033_reading_comprehension_ai_module.sql`, `rcAiEngineService.js`, `readingComprehensionAdmin.js`)**:

  * Covers all **15 Reading Comprehension categories** (10 Subject + 5 Question-Focused), **10 banking exam question types**, **9 banking examinations**, **4 difficulty levels** (`Easy`, `Moderate`, `Hard`, `Expert`), and **3 passage lengths** (`Short`, `Medium`, `Long`).

  * Includes **Passage-Based Vocabulary** extraction (English meaning, **Tamil meaning**, synonym, antonym, pronunciation, example sentence, passage context), automated quality validation with auto-regeneration, and a **Guided 5-Step Independent Question Editor**.

  * Single-call combined passage + question generation (`generateRcPassageAndQuestionsWithAi`) with fast multi-model failover (`CA_AI_MAX_RETRIES=0` bug fixed in `caAiProvider.js`).

  * Admin **Practice PDF** (no answers) and **Answer & Explanations PDF** downloads (`rcPdfGeneratorService.js`).

* **Integrated into Topicwise Tests (`TopicwiseTestView.jsx`, `server/routes/admin.js`)**: Enabled 1-click AI auto-generation for **English Language → Reading Comprehension** directly inside **Create Topicwise Test** with RC Category and Passage Length selectors.

* **Atomic 5-Question Reading Comprehension Set Rule**: Reading Comprehension passages are generated strictly in **5-question passage sets** (`5, 10, 15, 20, 25, 30 Qs`) and enforced as indivisible sets on both backend (`assertCompleteRcPassageSets`) and frontend (**Exam-Wise Mock Tests** and **Topicwise Tests**)—preventing partial selection of individual questions from a passage.

* **Unified Student Test Flow**: Removed the standalone Student Reading Comprehension sidebar tab and student PDF download links so students attend Reading Comprehension sets inside **Mock tests → Topicwise Tests** using the standard CBT exam interface.

### 3. Exam-Wise & Topicwise Mock Test Management Upgrades

* **Complete Transactional Delete (`DELETE /api/admin/tests/:id` & `/api/admin/mock-tests/:id`)**: Added **Delete** buttons (with confirmation modal) to every Draft and Published **Exam-Wise** (`MockTestBuilderView.jsx`) and **Topicwise** (`TopicwiseTestView.jsx`) test set. Protects `payment_orders` integrity, prompts confirmation for tests with `test_attempts` (`?force=true`), cascades cleanup, logs to `audit_logs`, and keeps all original Question Bank questions intact.

* **Upgraded Exam-Wise Edit & Hierarchical Question Bank Picker (`MockTestBuilderView.jsx`, `AdminOverview.jsx`, `server/routes/admin.js`)**:

  * Extended `GET /api/admin/questions` with `stageId`, `subtopic`, `difficulty`, `used_in_sets`, and a 2,000-row stage limit (fixing the global 500-row truncation).

  * Organized Manual Question Selection by **Section Tabs → Collapsible Topic Groups → Subtopic Groups**, with Topic/Subtopic/Difficulty/Search filters, **Hide questions already used in other sets** toggle, **Show selected only** toggle, blueprint capacity enforcement, and atomic RC Set selection.

  * Cleaned up the **Examination** dropdown in Create Exam Wise Test to display clean exam names without `· published` / `· draft` suffixes, and fixed CSS flex-column scrolling on `.qb-topic-list`.

## What's New: Production Refactoring & Upgrades

 1. **Clean Production-Level Architecture**:

    * Distinct, decoupled layers: `client/` (Frontend SPA), `server/` (Node.js API), `shared/` (shared models/constants), `docs/` (specifications), `scripts/` (build/dev utilities), and `tests/` (integration test suites).

 2. **Pure JavaScript & JSX Transition**:

    * Converted 100% of frontend components from TypeScript to pure React 19 JSX (`.jsx`/`.js`).

    * Converted 100% of backend services and routes to pure Node.js ES Modules (`.js`).

    * Eliminated TypeScript compiler overhead (`tsc`) for instant server startups with native Node.js `--watch`.

 3. **Master Exam Catalogue (19 Exams Across 5 Categories)**:

    * **IBPS**: PO, CSA, SO, RRB PO, RRB Scale II, RRB Scale III, RRB Office Assistant (7)

    * **SBI**: PO, Clerk, SO (3)

    * **RBI**: Grade B, Assistant (2)

    * **NABARD**: Grade A, Grade B (2)

    * **Other Banks / Institutions**: IDBI, SIDBI, ECGC, EXIM, IIFCL (5)

 4. **Question Bank Auto-Mock Sync (20-Question Threshold)**:

    * Once an administrator uploads at least 20 published questions for an exam stage, the platform automatically generates and publishes a full dynamic mock test available to students.

 5. **Dynamic Option Shuffling**:

    * Answer choices (A, B, C, D) are randomly permuted on every student attempt, preventing pattern memorization while tracking the correct answer accurately on the backend.

 6. **Daily 1-Question Challenge**:

    * Daily question selector that tracks consecutive study days (streaks) and unlocks live milestone trophies.

 7. **Proctored CBT Exam Experience**:

    * **Single-Tab Lock**: BroadcastChannel detects duplicate tabs and automatically locks secondary sessions.

    * **Fullscreen Enforcement**: Alerts and auto-submits on repeated escape attempts.

    * **Mouse-Only Mode**: Prevents unauthorized keyboard shortcuts during tests.

    * **Dummy Camera Monitor**: Local webcam mirror providing simulated proctoring without recording or leaking student video.

 8. **DevTools Security & Code Concealment**:

    * Production Vite builds disable source maps (`sourcemap: false`) and block direct DevTools requests to source paths and configuration files.

 9. **Complete Banking Exam Syllabus & Dynamic Topic Dropdowns**:

    * Standardized hierarchy: **Exam → Subject → Topic → Subtopic → Difficulty Level → Questions**.

    * Built-in syllabus module covering 6 banking subjects and 118 topics (Quantitative Aptitude, Reasoning Ability, English Language, General Awareness, Banking & Financial Awareness, Computer Awareness).

    * Dynamic `<select>` dropdowns for topics and subtopics in the Question Bank with custom fallback and topic filtering.

10. **Enhanced Admin Metrics & Topic Drilling**:

* Admin dashboard displays Total Exams, Total Subjects, Total Topics, Total Questions (with Easy / Medium / Hard breakdown), Total Students, and Mock Tests Created.

* Students can select both topics and subtopics for focused practice sessions.

11. **Administrator Role & Access Management**:

* Dedicated "Role management" navigation view in the admin portal (`/admin/users`).

* Summary KPIs: Total Accounts, Administrators, Students, Active Accounts, Disabled Accounts.

* Interactive role filtering (`Admin`, `Student`), status filtering (`Active`, `Disabled`), and search.

* In-place role promotion/demotion (Student ↔ Administrator) and account activation controls.

* Built-in self-protection safeguards preventing accidental administrator self-lockout or self-demotion, backed by audit logging.

## Directory Structure

```
BANKING-PLATFORM/
├── client/                               # Frontend Single-Page Application (React 19, pure JSX)
│   ├── index.html                        # Application HTML entry point
│   ├── vite.config.js                    # Vite configuration (source blocking, API proxy, CSP)
│   ├── public/                           # Static brand logos (hhk-logo.png, hik-logo.png)
│   └── src/
│       ├── main.jsx                      # React entry mounting
│       ├── App.jsx                       # Root routing, toasts, tab lockout listener
│       ├── AuthPage.jsx                  # Sign-in, sign-up, forgot/reset password
│       ├── AdminOverview.jsx             # Admin dashboard landing
│       ├── AdminPanel.jsx                # Full administration portal
│       ├── StudentWorkspace.jsx          # Student preparation dashboard
│       ├── api/
│       │   └── client.js                 # Authenticated fetch wrapper
│       ├── components/
│       │   ├── common/                   # Field.jsx, ExamOptGroups.jsx
│       │   ├── auth/                     # AuthBrand, LoginForm, RegisterForm, etc.
│       │   ├── admin/                    # ExamSetupView, QuestionBankView, MockTestBuilderView, etc.
│       │   └── student/                  # TestRunner, PracticeRunner, DailyChallengeView, etc.
│       ├── styles/                       # Modular CSS stylesheets (admin, auth, student, etc.)
│       └── utils/
│           ├── examCategories.js         # Master banking category groupings
│           └── examLock.js               # Single-tab proctoring and fullscreen helpers
│
├── server/                               # Backend API (Node.js ES Modules, pure JS)
│   ├── index.js                          # Express app, Helmet, session store, static fallback
│   ├── db.js                             # pg.Pool connection with SSL and timeouts
│   ├── middleware.js                     # requireAuth, requireAdmin, Zod validator
│   ├── schemas.js                        # Request/response validation schemas
│   ├── migrate.js                        # SQL migration runner
│   ├── seed-admin.js                     # Administrator account bootstrapping
│   ├── migrations/                       # 001 through 033 SQL migrations
│   ├── routes/                           # admin.js, attempts.js, auth.js, content.js
│   └── services/                         # questionBankSync.js, questionSelection.js, milestones.js
│
├── shared/                               # Shared constants & logic between client and server
│   ├── constants.js                      # EXAM_CATEGORIES list
│   └── examCategories.js                 # groupExamsByCategory helper
│
├── docs/
│   └── ARCHITECTURE.md                   # Complete architectural guide & data flow map
│
├── scripts/
│   ├── build-web.mjs                     # Production client build runner
│   └── dev-protected.mjs                 # Protected dev server with hot reload & source blocking
│
├── tests/
│   └── verify_workflow.js                # Integration suite verifying all 6 platform workflows
│
├── .env, .env.example, .gitignore
├── docker-compose.yml
└── package.json

```

## Prerequisites

* **Node.js**: Version 20 or 22+ installed ([nodejs.org](https://nodejs.org/))

* **PostgreSQL**: PostgreSQL 15+ running locally (or via Docker Desktop)

## Quick Start & Setup

### 1. Install Dependencies

```
npm install

```

### 2. Configure Environment (`.env`)

Create your `.env` file from the example template:

```
Copy-Item .env.example .env

```

Open `.env` and configure your credentials:

```
# Database Configuration
POSTGRES_PASSWORD=your_postgres_password
DATABASE_URL=postgresql://postgres:your_postgres_password@localhost:5432/your_database_name
DATABASE_SSL=false

# Server & Session
PORT=3001
NODE_ENV=development
SESSION_SECRET=replace-with-at-least-32-random-characters
APP_URL=http://localhost:5173

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

> \[!NOTE\]
> If your database name contains spaces, URL-encode the space as `%20` (e.g. `postgresql://postgres:TIGER@localhost:5432/HHK%20Administrator`).

### 3. Setup the Database

Apply all SQL migrations and seed the initial administrator:

```
# Run all 33 database migrations (001 through 033)
npm run db:migrate

# Seed your default administrator account
npm run db:seed-admin

```

*(If using Docker Desktop for PostgreSQL instead of a local install, run `docker compose up -d postgres` before running `npm run db:migrate`)*.

## 🚀 How to Run the Project

### 1. Development Mode (All-in-One Command)

Starts both the backend Express API server and the Vite React frontend concurrently with live reloading:

```
npm run dev

```

| Component | URL | Description | 
| ----- | ----- | ----- | 
| **Frontend UI** | <http://localhost:5173> | Vite preview client with DevTools code-protection and `/api` proxy | 
| **Backend API** | <http://localhost:3001> | Express REST API connected to PostgreSQL with native `node --watch` | 

> \[!NOTE\]
> Backend changes automatically reload instantly with zero compilation delay. Frontend changes are automatically detected and rebuilt cleanly.

### 2. Running Services in Separate Terminals

If you prefer dedicated terminal sessions for separate log monitoring:

**Terminal 1 — Backend Express Server (Port 3001):**

```
npm run dev:server

```

**Terminal 2 — Frontend Client (Port 5173):**

```
npm run dev:client

```

### 3. Production Mode (Single Port 3001)

In production, Express serves both the pre-built, optimized client bundle and all API endpoints on a single port:

```
# Step 1: Ensure database schema is migrated
npm run db:migrate

# Step 2: Compile the frontend into client/dist/ (with sourcemap: false)
npm run build

# Step 3: Launch the unified production server
npm start

```

* **Production App**: <http://localhost:3001>

## Verification & Testing

The project includes an end-to-end workflow verification script that validates the core business rules inside an isolated, safe rollback transaction (zero test data pollution):

```
npm test

```

**Verifies:**

1. Master exam categorization logic in `shared/`.

2. PostgreSQL database connectivity.

3. Master exam count (all 19 exams across all 5 banking categories).

4. Question Bank 20-question threshold auto-mock test creator.

5. Dynamic option shuffler and answer strip validation.

6. Safe database transaction rollback.

## Available NPM Scripts

| Command | Description | 
| ----- | ----- | 
| `npm run dev` | **Starts both backend API and frontend client concurrently** | 
| `npm run dev:server` | Starts Express backend in native Node.js `--watch` mode (`port 3001`) | 
| `npm run dev:client` | Starts Vite protected development client (`port 5173`) | 
| `npm run build` | Builds optimized client bundle into `client/dist/` (no source maps) | 
| `npm run preview` | Previews the production client build locally | 
| `npm start` | Runs the production Express server serving API + static frontend | 
| `npm run db:migrate` | Applies all pending migrations from `server/migrations/` | 
| `npm run db:seed-admin` | Bootstraps the administrator account defined in `.env` | 
| `npm test` | Runs the integration and workflow test suite | 
