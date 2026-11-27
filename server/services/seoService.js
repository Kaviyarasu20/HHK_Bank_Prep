/**
 * HHK Phase 1 SEO Service
 *
 * Provides:
 * - Site origin resolution (PUBLIC_SITE_URL / APP_URL / request host)
 * - Dynamic robots.txt generation
 * - Dynamic XML sitemap generation (core public routes + optional DB entries)
 * - Server-side HTML meta-tag injection for SPA routes & social link previews
 */

const DEFAULT_SITE_NAME = 'HHK Banking Exam Prep';

export const PUBLIC_SEO_ROUTES = [
  {
    path: '/',
    title: 'HHK — Banking Exam Preparation Platform | IBPS, SBI, RRB & RBI Mock Tests',
    description:
      'Prepare for IBPS PO, IBPS Clerk, SBI PO, SBI Clerk, RRB, and RBI Grade B exams with real CBT mock tests, Quant, Reasoning, English, Banking Awareness, and daily Current Affairs.',
    changefreq: 'daily',
    priority: '1.0',
  },
  {
    path: '/exams',
    title: 'Banking Examinations Catalogue — IBPS, SBI, RRB & RBI | HHK',
    description:
      'Explore complete banking exam syllabi, Prelims and Mains patterns, and topic-wise practice coverage for IBPS PO, SBI PO, Clerk, RRB, and RBI Grade B.',
    changefreq: 'weekly',
    priority: '0.9',
  },
  {
    path: '/pricing',
    title: 'HHK Banking Exam Test Series Plans & Pricing | HHK',
    description:
      'Compare affordable HHK subscription plans and mock test packs for IBPS, SBI, RRB, and RBI banking exams with instant activation via Razorpay.',
    changefreq: 'weekly',
    priority: '0.8',
  },
  {
    path: '/mock-tests',
    title: 'Free Banking CBT Mock Tests — IBPS PO, SBI PO, Clerk & RRB | HHK',
    description:
      'Attempt realistic IBPS, SBI, RRB, and RBI Prelims & Mains CBT mock tests with sectional timing, negative marking, and instant percentile analytics.',
    changefreq: 'daily',
    priority: '0.9',
  },
  {
    path: '/exams/ibps-po',
    title: 'IBPS PO Preparation — Prelims & Mains Mock Tests, Syllabus & Practice | HHK',
    description:
      'Complete IBPS PO Prelims and Mains exam preparation with syllabus-aligned Quantitative Aptitude, Reasoning Ability, English Language, and Banking Awareness practice.',
    changefreq: 'weekly',
    priority: '0.9',
  },
  {
    path: '/exams/ibps-clerk',
    title: 'IBPS Clerk Preparation — Speed Tests, Mock Exams & Topic Practice | HHK',
    description:
      'Boost accuracy and speed for IBPS Clerk Prelims and Mains with timed CBT mock tests, Simplification, Puzzles, Cloze Tests, and daily quizzes.',
    changefreq: 'weekly',
    priority: '0.8',
  },
  {
    path: '/exams/sbi-po',
    title: 'SBI PO Preparation — High-Level Mains Puzzles, DI & CBT Mock Tests | HHK',
    description:
      'Master SBI PO Prelims and Mains with exam-grade Data Interpretation, Seating Arrangements, Reading Comprehension, and Banking Awareness tests.',
    changefreq: 'weekly',
    priority: '0.9',
  },
  {
    path: '/exams/sbi-clerk',
    title: 'SBI Clerk Junior Associate Prep — Mock Tests & Sectional Practice | HHK',
    description:
      'Practice SBI Clerk Junior Associate Prelims and Mains questions across Quant, Reasoning, English, and General/Financial Awareness.',
    changefreq: 'weekly',
    priority: '0.8',
  },
  {
    path: '/exams/rrb-po',
    title: 'IBPS RRB PO & Office Assistant Prep — Mock Tests & Practice | HHK',
    description:
      'Prepare for IBPS RRB Officer Scale I and Office Assistant exams with focused Reasoning, Quantitative Aptitude, Computer Knowledge, and General Awareness.',
    changefreq: 'weekly',
    priority: '0.8',
  },
  {
    path: '/exams/rbi-grade-b',
    title: 'RBI Grade B Preparation — Phase 1 Quant, Reasoning, English & GA | HHK',
    description:
      'Targeted RBI Grade B preparation covering Monetary Policy, Banking & Financial Awareness, General Awareness, and Phase 1 CBT practice.',
    changefreq: 'weekly',
    priority: '0.8',
  },
  {
    path: '/banking-awareness',
    title: 'Banking & Financial Awareness Reference Hub — RBI, NPA, UPI & Basel | HHK',
    description:
      'Structured Banking Awareness notes and practice covering RBI Monetary Policy, Repo/CRR/SLR, NPA, Basel Norms, UPI, NEFT/RTGS, KYC/AML, and Priority Sector Lending.',
    changefreq: 'weekly',
    priority: '0.9',
  },
  {
    path: '/current-affairs',
    title: 'Daily Banking & Economy Current Affairs for Bank Exams | HHK',
    description:
      'Exam-focused daily Current Affairs curated for IBPS, SBI, RRB, and RBI Mains with banking news, RBI updates, government schemes, and practice quizzes.',
    changefreq: 'daily',
    priority: '0.9',
  },
  {
    path: '/quant-practice',
    title: 'Quantitative Aptitude for Bank Exams — DI, Arithmetic & Number Series | HHK',
    description:
      'Practice verified Quantitative Aptitude questions for banking exams including Simplification, Approximation, Quadratic Equations, Data Interpretation, and Arithmetic.',
    changefreq: 'weekly',
    priority: '0.8',
  },
  {
    path: '/reasoning-practice',
    title: 'Reasoning Ability for Bank Exams — Puzzles, Seating & Syllogism | HHK',
    description:
      'Solve banking-exam Reasoning questions across Floor Puzzles, Seating Arrangements, Syllogism, Inequalities, Blood Relations, Coding-Decoding, and Input-Output.',
    changefreq: 'weekly',
    priority: '0.8',
  },
  {
    path: '/english-practice',
    title: 'English Language for Bank Exams — RC, Cloze Test, Error Detection & Grammar | HHK',
    description:
      'Practice all 13 banking English topics including Reading Comprehension, Cloze Test, Error Detection, Para Jumbles, Phrase Replacement, Vocabulary, and Grammar.',
    changefreq: 'weekly',
    priority: '0.8',
  },
];

const NOINDEX_PREFIXES = [
  '/admin',
  '/api',
  '/auth',
  '/login',
  '/register',
  '/reset-password',
  '/dashboard',
  '/account',
  '/checkout',
  '/payment',
];

export function escapeHtmlAttr(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function normalizePathname(rawPath = '/') {
  const clean = String(rawPath || '/').split('?')[0].split('#')[0].trim();
  if (!clean || clean === '/') return '/';
  const withLead = clean.startsWith('/') ? clean : `/${clean}`;
  return withLead.length > 1 && withLead.endsWith('/') ? withLead.slice(0, -1) : withLead;
}

export function resolveSiteOrigin(req = null) {
  const configured = (process.env.PUBLIC_SITE_URL || process.env.APP_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  if (req) {
    const proto = (req.headers?.['x-forwarded-proto'] || req.protocol || 'http')
      .toString()
      .split(',')[0]
      .trim();
    const host = (req.headers?.['x-forwarded-host'] || req.get?.('host') || 'localhost:3001')
      .toString()
      .split(',')[0]
      .trim();
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return 'http://localhost:5173';
}

export function resolveRouteSeo(pathname = '/', origin = 'http://localhost:5173') {
  const cleanPath = normalizePathname(pathname);
  const cleanOrigin = String(origin || 'http://localhost:5173').replace(/\/+$/, '');
  const lower = cleanPath.toLowerCase();

  const isNoindex = NOINDEX_PREFIXES.some(
    (prefix) => lower === prefix || lower.startsWith(`${prefix}/`)
  );

  const matched = PUBLIC_SEO_ROUTES.find((r) => r.path === lower);
  const fallback = PUBLIC_SEO_ROUTES[0];

  const title = isNoindex
    ? `Workspace | ${DEFAULT_SITE_NAME}`
    : matched?.title || fallback.title;
  const description = matched?.description || fallback.description;
  const canonicalUrl = `${cleanOrigin}${cleanPath === '/' ? '/' : cleanPath}`;
  const ogImage = `${cleanOrigin}/favicon.png`;
  const robots = isNoindex ? 'noindex, nofollow' : 'index, follow';

  return {
    path: cleanPath,
    title,
    description,
    canonicalUrl,
    ogImage,
    robots,
    isNoindex,
  };
}

export function injectSeoIntoHtml(html, seo) {
  if (!html || typeof html !== 'string') return html;
  const safeTitle = escapeHtmlAttr(seo.title);
  const safeDesc = escapeHtmlAttr(seo.description);
  const safeCanonical = escapeHtmlAttr(seo.canonicalUrl);
  const safeImage = escapeHtmlAttr(seo.ogImage);
  const safeRobots = escapeHtmlAttr(seo.robots);

  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  out = out.replace(
    /<meta\s+name="description"[\s\S]*?\/?>/i,
    `<meta name="description" content="${safeDesc}" />`
  );
  out = out.replace(
    /<meta\s+name="robots"[\s\S]*?\/?>/i,
    `<meta name="robots" content="${safeRobots}" />`
  );
  out = out.replace(
    /<link\s+rel="canonical"[\s\S]*?\/?>/i,
    `<link rel="canonical" href="${safeCanonical}" />`
  );
  out = out.replace(
    /<meta\s+property="og:title"[\s\S]*?\/?>/i,
    `<meta property="og:title" content="${safeTitle}" />`
  );
  out = out.replace(
    /<meta\s+property="og:description"[\s\S]*?\/?>/i,
    `<meta property="og:description" content="${safeDesc}" />`
  );
  out = out.replace(
    /<meta\s+property="og:url"[\s\S]*?\/?>/i,
    `<meta property="og:url" content="${safeCanonical}" />`
  );
  out = out.replace(
    /<meta\s+property="og:image"[\s\S]*?\/?>/i,
    `<meta property="og:image" content="${safeImage}" />`
  );
  out = out.replace(
    /<meta\s+name="twitter:title"[\s\S]*?\/?>/i,
    `<meta name="twitter:title" content="${safeTitle}" />`
  );
  out = out.replace(
    /<meta\s+name="twitter:description"[\s\S]*?\/?>/i,
    `<meta name="twitter:description" content="${safeDesc}" />`
  );
  out = out.replace(
    /<meta\s+name="twitter:image"[\s\S]*?\/?>/i,
    `<meta name="twitter:image" content="${safeImage}" />`
  );
  return out;
}

export function buildRobotsTxt(origin = 'http://localhost:5173') {
  const cleanOrigin = String(origin || 'http://localhost:5173').replace(/\/+$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Disallow: /auth/',
    'Disallow: /dashboard/',
    'Disallow: /account/',
    'Disallow: /checkout/',
    '',
    `Sitemap: ${cleanOrigin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function buildSitemapXml(origin = 'http://localhost:5173', dynamicEntries = []) {
  const cleanOrigin = String(origin || 'http://localhost:5173').replace(/\/+$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set();
  const entries = [];

  for (const route of PUBLIC_SEO_ROUTES) {
    const loc = `${cleanOrigin}${route.path === '/' ? '/' : route.path}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    entries.push({
      loc,
      lastmod: route.lastmod || today,
      changefreq: route.changefreq || 'weekly',
      priority: route.priority || '0.8',
    });
  }

  for (const item of dynamicEntries || []) {
    if (!item?.path) continue;
    const cleanPath = normalizePathname(item.path);
    const loc = `${cleanOrigin}${cleanPath === '/' ? '/' : cleanPath}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    entries.push({
      loc,
      lastmod: item.lastmod || today,
      changefreq: item.changefreq || 'weekly',
      priority: item.priority || '0.7',
    });
  }

  const urlsXml = entries
    .map(
      (e) =>
        `  <url>\n` +
        `    <loc>${escapeXml(e.loc)}</loc>\n` +
        `    <lastmod>${escapeXml(e.lastmod)}</lastmod>\n` +
        `    <changefreq>${escapeXml(e.changefreq)}</changefreq>\n` +
        `    <priority>${escapeXml(e.priority)}</priority>\n` +
        `  </url>`
    )
    .join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urlsXml}\n` +
    `</urlset>\n`
  );
}

/**
 * Safely discovers optional dynamic public URLs from PostgreSQL (exams, published CA items)
 * without ever failing if the DB or optional tables are unavailable.
 */
export async function loadDynamicSitemapEntries(pool) {
  if (!pool || typeof pool.query !== 'function') return [];
  const entries = [];

  try {
    const examRes = await pool.query(
      `SELECT code, updated_at FROM exams WHERE COALESCE(is_active, true) = true ORDER BY code ASC LIMIT 50`
    );
    for (const row of examRes.rows || []) {
      const slug = String(row.code || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!slug) continue;
      entries.push({
        path: `/exams/${slug}`,
        lastmod: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : undefined,
        changefreq: 'weekly',
        priority: '0.8',
      });
    }
  } catch {
    // Graceful fallback if exams table differs or DB is offline
  }

  return entries;
}
