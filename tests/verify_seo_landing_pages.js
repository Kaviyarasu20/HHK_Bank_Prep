import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getPathForPublicPage,
  getSeoMetaForPublicPage,
  PUBLIC_ROUTE_MAP,
  resolvePublicPageFromPath,
  SEO_LANDING_PAGES,
} from '../client/src/utils/publicRoutes.js';
import {
  buildSitemapXml,
  injectSeoIntoHtml,
  resolveRouteSeo,
} from '../server/services/seoService.js';

const root = process.cwd();
const indexHtml = fs.readFileSync(path.join(root, 'client', 'index.html'), 'utf8');

console.log('=== 1. Verifying Clean URL <-> Page Key Round-Trips ===');
for (const [pageKey, routePath] of Object.entries(PUBLIC_ROUTE_MAP)) {
  assert.equal(resolvePublicPageFromPath(routePath), pageKey, `Path ${routePath} should resolve to ${pageKey}`);
  assert.equal(resolvePublicPageFromPath(`${routePath}/`), pageKey, `Trailing slash on ${routePath} should resolve to ${pageKey}`);
  assert.equal(getPathForPublicPage(pageKey), routePath, `Page ${pageKey} should map to ${routePath}`);
  const meta = getSeoMetaForPublicPage(pageKey);
  assert.ok(meta.title && meta.title.length >= 25, `Title too short for ${pageKey}`);
  assert.ok(meta.description && meta.description.length >= 60, `Description too short for ${pageKey}`);
}
assert.equal(resolvePublicPageFromPath('/unknown-path-xyz'), 'home', 'Unknown public path should safely fall back to home');
console.log(`All ${Object.keys(PUBLIC_ROUTE_MAP).length} public clean URLs verified.\n`);

console.log('=== 2. Verifying 4 Public SEO Landing Pages Content & Structure ===');
const requiredLandingKeys = ['seo-ibps-po', 'seo-sbi-po', 'seo-banking-awareness', 'seo-current-affairs'];
for (const key of requiredLandingKeys) {
  const lp = SEO_LANDING_PAGES[key];
  assert.ok(lp, `Missing landing page config: ${key}`);
  assert.ok(lp.h1 && lp.h1.length > 25, `${key}: missing H1`);
  assert.ok(lp.intro && lp.intro.length > 60, `${key}: missing intro`);
  assert.equal(lp.kpis.length, 4, `${key}: expected 4 KPIs`);
  assert.ok(lp.patternRows.length >= 4, `${key}: expected >= 4 pattern rows`);
  assert.equal(lp.modules.length, 3, `${key}: expected 3 syllabus modules`);
  assert.ok(lp.faqs.length >= 3, `${key}: expected >= 3 FAQs`);
}
console.log('All 4 SEO landing pages (IBPS PO, SBI PO, Banking Awareness, Current Affairs) passed.\n');

console.log('=== 3. Verifying Server-Side Meta Injection & Sitemap Alignment ===');
const origin = 'https://hhk.education';
const sitemap = buildSitemapXml(origin);
for (const routePath of ['/exams/ibps-po', '/exams/sbi-po', '/banking-awareness', '/current-affairs', '/exams', '/mock-tests', '/pricing']) {
  const seo = resolveRouteSeo(routePath, origin);
  assert.equal(seo.robots, 'index, follow', `${routePath} must be indexable`);
  assert.equal(seo.canonicalUrl, `${origin}${routePath}`, `${routePath} canonical mismatch`);
  const html = injectSeoIntoHtml(indexHtml, seo);
  assert.ok(html.includes(`<link rel="canonical" href="${origin}${routePath}" />`), `${routePath} canonical not injected`);
  assert.ok(sitemap.includes(`<loc>${origin}${routePath}</loc>`), `${routePath} missing from sitemap.xml`);
}

console.log('Server-side meta injection & sitemap alignment passed.\n');
console.log('ALL PHASE 2 SEO LANDING PAGES & CLEAN URL ROUTING CHECKS PASSED!');
