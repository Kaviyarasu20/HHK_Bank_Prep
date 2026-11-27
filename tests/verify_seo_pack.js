import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildRobotsTxt,
  buildSitemapXml,
  injectSeoIntoHtml,
  PUBLIC_SEO_ROUTES,
  resolveRouteSeo,
  resolveSiteOrigin,
} from '../server/services/seoService.js';

const root = process.cwd();

console.log('=== 1. Verifying client/index.html SEO Metadata & JSON-LD ===');
const indexHtml = fs.readFileSync(path.join(root, 'client', 'index.html'), 'utf8');
assert.ok(indexHtml.includes('<title>HHK — Banking Exam Preparation Platform'), 'Missing rich title');
assert.ok(indexHtml.includes('name="description"'), 'Missing meta description');
assert.ok(indexHtml.includes('name="robots"'), 'Missing meta robots');
assert.ok(indexHtml.includes('rel="canonical"'), 'Missing canonical link');
assert.ok(indexHtml.includes('property="og:title"'), 'Missing og:title');
assert.ok(indexHtml.includes('property="og:description"'), 'Missing og:description');
assert.ok(indexHtml.includes('name="twitter:card"'), 'Missing twitter:card');
assert.ok(indexHtml.includes('href="/favicon.png"'), 'Favicon should point to /favicon.png');

const ldMatch = indexHtml.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i);
assert.ok(ldMatch, 'Missing JSON-LD script tag');
const ldJson = JSON.parse(ldMatch[1]);
assert.equal(ldJson['@context'], 'https://schema.org', 'Invalid Schema.org context');
assert.ok(Array.isArray(ldJson['@graph']) && ldJson['@graph'].length >= 2, 'Expected EducationalOrganization + WebSite in @graph');
console.log('client/index.html metadata & JSON-LD passed.\n');

console.log('=== 2. Verifying robots.txt & Lightweight Favicon ===');
const staticRobots = fs.readFileSync(path.join(root, 'client', 'public', 'robots.txt'), 'utf8');
assert.ok(staticRobots.includes('Disallow: /api/'), 'robots.txt must disallow /api/');
assert.ok(staticRobots.includes('Disallow: /admin/'), 'robots.txt must disallow /admin/');
assert.ok(staticRobots.includes('Sitemap:'), 'robots.txt must reference Sitemap');

const faviconPath = path.join(root, 'client', 'public', 'favicon.png');
assert.ok(fs.existsSync(faviconPath), 'client/public/favicon.png must exist');
const faviconSize = fs.statSync(faviconPath).size;
assert.ok(faviconSize > 500 && faviconSize < 100 * 1024, `Expected lightweight favicon (<100KB), got ${faviconSize} bytes`);
console.log(`robots.txt & favicon.png (${(faviconSize / 1024).toFixed(1)} KB) passed.\n`);

console.log('=== 3. Verifying Dynamic robots.txt, sitemap.xml & Server-Side Meta Injection ===');
const origin = 'https://hhk.education';
const dynamicRobots = buildRobotsTxt(origin);
assert.ok(dynamicRobots.includes('Sitemap: https://hhk.education/sitemap.xml'), 'Dynamic robots.txt missing absolute sitemap URL');

const sitemap = buildSitemapXml(origin, [
  { path: '/exams/custom-bank-exam', lastmod: '2026-11-27', changefreq: 'weekly', priority: '0.7' },
  { path: '/exams/ibps-po', lastmod: '2026-11-27' }, // duplicate should be deduped
]);
assert.ok(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Invalid XML header');
assert.ok(sitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'Missing urlset');
const urlCount = (sitemap.match(/<url>/g) || []).length;
assert.equal(urlCount, PUBLIC_SEO_ROUTES.length + 1, `Expected ${PUBLIC_SEO_ROUTES.length + 1} unique sitemap URLs, got ${urlCount}`);
assert.ok(sitemap.includes('<loc>https://hhk.education/exams/custom-bank-exam</loc>'), 'Dynamic entry missing from sitemap');

// Public route injection
const ibpsSeo = resolveRouteSeo('/exams/ibps-po/', origin);
assert.equal(ibpsSeo.robots, 'index, follow');
assert.equal(ibpsSeo.canonicalUrl, 'https://hhk.education/exams/ibps-po');
const injectedPublic = injectSeoIntoHtml(indexHtml, ibpsSeo);
assert.ok(injectedPublic.includes('<title>IBPS PO Preparation'), 'Route title not injected');
assert.ok(injectedPublic.includes('<link rel="canonical" href="https://hhk.education/exams/ibps-po" />'), 'Route canonical not injected');
assert.ok(injectedPublic.includes('<meta property="og:url" content="https://hhk.education/exams/ibps-po" />'), 'OG URL not injected');

// Admin noindex injection
const adminSeo = resolveRouteSeo('/admin/questions', origin);
assert.equal(adminSeo.isNoindex, true);
assert.equal(adminSeo.robots, 'noindex, nofollow');
const injectedAdmin = injectSeoIntoHtml(indexHtml, adminSeo);
assert.ok(injectedAdmin.includes('<meta name="robots" content="noindex, nofollow" />'), 'Admin route must inject noindex, nofollow');

// Origin resolver with request fallback
const prevPublic = process.env.PUBLIC_SITE_URL;
const prevApp = process.env.APP_URL;
delete process.env.PUBLIC_SITE_URL;
delete process.env.APP_URL;
const reqOrigin = resolveSiteOrigin({
  protocol: 'https',
  headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'prep.hhk.in' },
});
assert.equal(reqOrigin, 'https://prep.hhk.in');
if (prevPublic !== undefined) process.env.PUBLIC_SITE_URL = prevPublic;
if (prevApp !== undefined) process.env.APP_URL = prevApp;

console.log(`seoService verified (${urlCount} sitemap URLs, route injection & admin noindex passed).\n`);
console.log('ALL PHASE 1 SEO PACK CHECKS PASSED!');
