import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

console.log("=== HHK Phase 3: Modular Backend & Admin Control Center — Verification ===\n");

await test("1. Student & Admin CA routers exist and are mounted in server/index.js without duplicate routes", () => {
  const indexJs = fs.readFileSync(path.join(projectRoot, "server/index.js"), "utf8");
  assert.ok(indexJs.includes("currentAffairsStudentRouter"), "server/index.js must mount currentAffairsStudentRouter");
  assert.ok(indexJs.includes("currentAffairsAdminRouter"), "server/index.js must mount currentAffairsAdminRouter");

  const contentJs = fs.readFileSync(path.join(projectRoot, "server/routes/content.js"), "utf8");
  assert.ok(!contentJs.includes('"/current-affairs"'), "Duplicate student CA routes must be removed from content.js");

  const adminJs = fs.readFileSync(path.join(projectRoot, "server/routes/admin.js"), "utf8");
  assert.ok(!adminJs.includes('"/current-affairs"'), "Duplicate admin CA routes must be removed from admin.js");
});

await test("2. Student CA router defines all required endpoints in safe route order with pagination & UUID guards", () => {
  const stu = fs.readFileSync(path.join(projectRoot, "server/routes/currentAffairsStudent.js"), "utf8");
  const catPos = stu.indexOf('"/current-affairs/categories"');
  const quizPos = stu.indexOf('"/current-affairs/quiz/combined"');
  const detailPos = stu.indexOf('"/current-affairs/:id"');
  assert.ok(catPos > 0 && quizPos > 0 && detailPos > 0, "Missing required student CA routes");
  assert.ok(catPos < detailPos && quizPos < detailPos, "/categories and /quiz/combined must be registered before /:id");

  for (const snippet of [
    "requireAuth",
    "buildPaginationMeta",
    "hasNextPage",
    "hasPreviousPage",
    "isValidUuid(req.params.id)",
    "status = 'published'",
    "recordStudyDay",
    "syncMilestones",
  ]) {
    assert.ok(stu.includes(snippet), `currentAffairsStudent.js missing: ${snippet}`);
  }
});

await test("3. Admin CA router defines full Article, MCQ, Category CRUD, safe deletion, stats & audit logging", () => {
  const adm = fs.readFileSync(path.join(projectRoot, "server/routes/currentAffairsAdmin.js"), "utf8");
  const statsPos = adm.indexOf('"/current-affairs/stats"');
  const catPos = adm.indexOf('"/current-affairs/categories"');
  const detailPos = adm.indexOf('"/current-affairs/:id"');
  assert.ok(statsPos > 0 && catPos > 0 && detailPos > 0, "Missing required admin CA routes");
  assert.ok(statsPos < detailPos && catPos < detailPos, "/stats and /categories must be registered before /:id");

  for (const snippet of [
    "requireAdmin",
    'patch("/current-affairs/:id/status"',
    'delete("/current-affairs/:id"',
    'get("/current-affairs/:id/questions"',
    'put("/current-affairs/:id/questions/:questionId"',
    'delete("/current-affairs/:id/questions/:questionId"',
    'post("/current-affairs/categories"',
    'put("/current-affairs/categories/:categoryId"',
    'patch(\n  "/current-affairs/categories/:categoryId/active"',
    'delete("/current-affairs/categories/:categoryId"',
    "current_affairs.safe_archive",
    "student_records_preserved",
    "Cannot delete this question because",
    "Cannot delete category with",
    "safeSourceUrlSchema",
  ]) {
    assert.ok(adm.includes(snippet), `currentAffairsAdmin.js missing: ${snippet}`);
  }
});

await test("4. Migration 024 adds additive category metadata without altering existing category IDs", () => {
  const sql = fs.readFileSync(
    path.join(projectRoot, "server/migrations/024_current_affairs_categories_meta.sql"),
    "utf8",
  );
  for (const col of ["slug", "description", "icon", "sort_order", "is_active", "is_featured", "updated_at"]) {
    assert.ok(sql.includes(col), `Migration 024 missing column: ${col}`);
  }
  assert.ok(sql.includes("ADD COLUMN IF NOT EXISTS"), "Migration 024 must be additive and idempotent");
  assert.ok(!/DROP\s+TABLE|TRUNCATE/i.test(sql), "Migration 024 must not contain destructive SQL");
});

await test("5. StudentWorkspace eliminates duplicate /current-affairs fetch & separates category lifecycle", () => {
  const sw = fs.readFileSync(path.join(projectRoot, "client/src/StudentWorkspace.jsx"), "utf8");
  assert.ok(sw.includes("studentCaApi"), "StudentWorkspace must use centralized studentCaApi");
  assert.ok(!sw.includes('task = api("/current-affairs")'), "Duplicate /current-affairs fetch must be removed");
  assert.ok(sw.includes("affairReqSeqRef"), "StudentWorkspace must guard against stale/racing requests");
  assert.ok(sw.includes("AbortController"), "StudentWorkspace must abort superseded/unmounted requests");
});

await test("6. Admin Control Center fixes shared quiz state bug & uses centralized API client", () => {
  const view = fs.readFileSync(path.join(projectRoot, "client/src/components/admin/CurrentAffairsView.jsx"), "utf8");
  assert.ok(!view.includes('fetch("/api/admin/current-affairs'), "CurrentAffairsView must not use raw fetch()");
  assert.ok(view.includes("adminCaApi"), "CurrentAffairsView must use centralized adminCaApi");
  assert.ok(view.includes("CurrentAffairsQuestionPanel"), "CurrentAffairsView must render independent CurrentAffairsQuestionPanel");
  assert.ok(view.includes("beforeunload"), "CurrentAffairsView must warn on unsaved changes");

  const panel = fs.readFileSync(path.join(projectRoot, "client/src/components/admin/CurrentAffairsQuestionPanel.jsx"), "utf8");
  assert.ok(panel.includes("const [form, setForm] = useState(emptyQuestionForm)"), "Each article MCQ panel must maintain independent state");
  assert.ok(panel.includes("adminCaApi.updateQuestion"), "MCQ panel must support editing questions");
  assert.ok(panel.includes("adminCaApi.deleteQuestion"), "MCQ panel must support safe deletion");
});

await test("7. Dedicated current-affairs.css exists and is imported in styles/index.css", () => {
  const cssPath = path.join(projectRoot, "client/src/styles/current-affairs.css");
  assert.ok(fs.existsSync(cssPath), "client/src/styles/current-affairs.css must exist");
  const indexCss = fs.readFileSync(path.join(projectRoot, "client/src/styles/index.css"), "utf8");
  assert.ok(indexCss.includes("./current-affairs.css"), "styles/index.css must import ./current-affairs.css");
});

console.log(`\n=== PHASE 3 SUMMARY: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
