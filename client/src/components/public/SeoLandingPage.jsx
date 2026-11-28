import { useEffect } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, HelpCircle, Play, Target } from 'lucide-react';
import { getPathForPublicPage, SEO_LANDING_PAGES } from '../../utils/publicRoutes';

const RELATED_GUIDE_KEYS = [
  ['seo-ibps-po', 'IBPS PO Prep'],
  ['seo-sbi-po', 'SBI PO Prep'],
  ['seo-banking-awareness', 'Banking Awareness'],
  ['seo-current-affairs', 'Current Affairs'],
];

/**
 * Reusable SEO Landing Page for high-intent banking exam routes:
 * /exams/ibps-po, /exams/sbi-po, /banking-awareness, /current-affairs
 */
export function SeoLandingPage({ pageKey, onNavigate, onOpenAuth }) {
  const data = SEO_LANDING_PAGES[pageKey];

  // Inject route-specific FAQPage JSON-LD for rich Google search snippets
  useEffect(() => {
    if (!data || typeof document === 'undefined') return undefined;
    const scriptId = 'hhk-seo-faq-jsonld';
    let scriptEl = document.getElementById(scriptId);
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = scriptId;
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: data.faqs.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    };
    scriptEl.textContent = JSON.stringify(faqSchema);

    return () => {
      const existing = document.getElementById(scriptId);
      if (existing) existing.remove();
    };
  }, [data]);

  if (!data) return null;

  function handleLinkClick(e, targetKey) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(targetKey);
  }

  return (
    <article className="public-section" style={{ display: 'grid', gap: 24 }}>
      {/* Semantic Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555873' }}>
        <a
          href="/"
          onClick={(e) => handleLinkClick(e, 'home')}
          style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}
        >
          Home
        </a>
        <ChevronRight size={14} />
        <span>{data.eyebrow}</span>
      </nav>

      {/* Hero Section */}
      <section className="public-hero">
        <div>
          <div className="eyebrow">{data.eyebrow}</div>
          <h1>{data.h1}</h1>
          <p>{data.intro}</p>
          <div className="public-hero-actions">
            <a
              href={getPathForPublicPage('mock-tests')}
              className="primary-btn"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={(e) => handleLinkClick(e, 'mock-tests')}
            >
              <Play size={15} fill="currentColor" /> Browse CBT Mock Tests
            </a>
            <button type="button" className="ghost-btn" onClick={() => onOpenAuth('register')}>
              Create Free Account <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* Key Facts KPI Strip */}
      <section aria-label="Key exam highlights" className="payment-kpi-grid seo-kpi-grid">
        {data.kpis.map((kpi) => (
          <div key={kpi.label} className="payment-kpi-card">
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
          </div>
        ))}
      </section>

      {/* Exam Pattern / Weightage Table */}
      <section className="panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Target size={18} color="#4f46e5" />
          <h2 style={{ margin: 0, fontSize: 19 }}>Sectional Structure &amp; Exam Focus</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#555873' }}>
                <th style={{ padding: '10px 12px' }}>Section / Domain</th>
                <th style={{ padding: '10px 12px' }}>Prelims / Priority</th>
                <th style={{ padding: '10px 12px' }}>Mains / Key Scope</th>
              </tr>
            </thead>
            <tbody>
              {data.patternRows.map((row) => (
                <tr key={row.section} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.section}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{row.prelims}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{row.mains}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Syllabus & Topic Coverage Cards */}
      <section style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={18} color="#4f46e5" />
          <h2 style={{ margin: 0, fontSize: 19 }}>Syllabus Coverage on HHK</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {data.modules.map((mod) => (
            <div key={mod.title} className="panel" style={{ padding: 20 }}>
              <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>{mod.title}</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                {mod.topics.map((topic) => (
                  <li key={topic} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#374151' }}>
                    <CheckCircle2 size={15} color="#4f46e5" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{topic}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <HelpCircle size={18} color="#4f46e5" />
          <h2 style={{ margin: 0, fontSize: 19 }}>Frequently Asked Questions</h2>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {data.faqs.map((faq) => (
            <details
              key={faq.q}
              open
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: '12px 16px',
                background: '#fafbff',
              }}
            >
              <summary style={{ fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>{faq.q}</summary>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#4b5563', lineHeight: 1.6 }}>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Internal Cross-Links for Crawl Depth */}
      <section className="panel" style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>Explore More Banking Exam Guides</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {RELATED_GUIDE_KEYS.filter(([key]) => key !== pageKey).map(([key, label]) => (
            <a
              key={key}
              href={getPathForPublicPage(key)}
              className="ghost-btn"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={(e) => handleLinkClick(e, key)}
            >
              {label} <ArrowRight size={14} />
            </a>
          ))}
          <a
            href={getPathForPublicPage('exams')}
            className="ghost-btn"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={(e) => handleLinkClick(e, 'exams')}
          >
            Full Exam Catalogue <ArrowRight size={14} />
          </a>
        </div>
      </section>
    </article>
  );
}
