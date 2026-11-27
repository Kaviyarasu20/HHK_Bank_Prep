/**
 * Lightweight client-side SEO metadata updater for HHK SPA navigation.
 * Keeps document.title, meta description, robots, and canonical URL synced
 * when switching views inside React.
 */

const DEFAULT_TITLE = 'HHK — Banking Exam Preparation Platform | IBPS, SBI, RRB & RBI Mock Tests';
const DEFAULT_DESCRIPTION =
  'Prepare for IBPS PO, IBPS Clerk, SBI PO, SBI Clerk, RRB, and RBI Grade B exams with real CBT mock tests, Quant, Reasoning, English, Banking Awareness, and daily Current Affairs.';

function upsertMeta(selector, createAttrs, content) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    for (const [k, v] of Object.entries(createAttrs)) {
      el.setAttribute(k, v);
    }
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function updatePageSeo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = null,
  noindex = false,
} = {}) {
  if (typeof document === 'undefined') return;

  document.title = title;
  upsertMeta('meta[name="description"]', { name: 'description' }, description);
  upsertMeta('meta[name="robots"]', { name: 'robots' }, noindex ? 'noindex, nofollow' : 'index, follow');
  upsertMeta('meta[property="og:title"]', { property: 'og:title' }, title);
  upsertMeta('meta[property="og:description"]', { property: 'og:description' }, description);
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, title);
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description);

  if (typeof window !== 'undefined') {
    const cleanPath = path || window.location.pathname || '/';
    const canonicalHref = `${window.location.origin}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalHref);
    upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalHref);
  }
}
