/**
 * Clean URL Routing & SEO Landing Page Definitions for HHK Public Portal.
 * Maps browser pathnames <-> PublicPortal page keys without external router dependencies.
 */

export const PUBLIC_ROUTE_MAP = {
  home: '/',
  exams: '/exams',
  'mock-tests': '/mock-tests',
  pricing: '/pricing',
  'seo-ibps-po': '/exams/ibps-po',
  'seo-sbi-po': '/exams/sbi-po',
  'seo-banking-awareness': '/banking-awareness',
  'seo-current-affairs': '/current-affairs',
  terms: '/terms',
  privacy: '/privacy',
  'refund-policy': '/refund-policy',
  contact: '/contact',
};

const PATH_TO_PAGE = Object.fromEntries(
  Object.entries(PUBLIC_ROUTE_MAP).map(([pageKey, routePath]) => [routePath, pageKey])
);

export function normalizePublicPath(pathname = '/') {
  const clean = String(pathname || '/').split('?')[0].split('#')[0].trim().toLowerCase();
  if (!clean || clean === '/') return '/';
  const withLead = clean.startsWith('/') ? clean : `/${clean}`;
  return withLead.length > 1 && withLead.endsWith('/') ? withLead.slice(0, -1) : withLead;
}

export function resolvePublicPageFromPath(pathname = '/') {
  const norm = normalizePublicPath(pathname);
  return PATH_TO_PAGE[norm] || 'home';
}

export function getPathForPublicPage(pageKey = 'home') {
  return PUBLIC_ROUTE_MAP[pageKey] || '/';
}

export const PUBLIC_PAGE_SEO = {
  home: {
    title: 'HHK — Banking Exam Preparation Platform | IBPS, SBI, RRB & RBI Mock Tests',
    description:
      'Prepare for IBPS PO, IBPS Clerk, SBI PO, SBI Clerk, RRB, and RBI Grade B exams with real CBT mock tests, Quant, Reasoning, English, Banking Awareness, and daily Current Affairs.',
  },
  exams: {
    title: 'Banking Examinations Catalogue — IBPS, SBI, RRB & RBI | HHK',
    description:
      'Explore complete banking exam syllabi, Prelims and Mains patterns, and topic-wise practice coverage for IBPS PO, SBI PO, Clerk, RRB, and RBI Grade B.',
  },
  'mock-tests': {
    title: 'Free Banking CBT Mock Tests — IBPS PO, SBI PO, Clerk & RRB | HHK',
    description:
      'Attempt realistic IBPS, SBI, RRB, and RBI Prelims & Mains CBT mock tests with sectional timing, negative marking, and instant percentile analytics.',
  },
  pricing: {
    title: 'HHK Banking Exam Test Series Plans & Pricing | HHK',
    description:
      'Compare affordable HHK subscription plans and mock test packs for IBPS, SBI, RRB, and RBI banking exams with instant activation via Razorpay.',
  },
  'seo-ibps-po': {
    title: 'IBPS PO Preparation — Prelims & Mains Mock Tests, Syllabus & Practice | HHK',
    description:
      'Complete IBPS PO Prelims and Mains exam preparation with syllabus-aligned Quantitative Aptitude, Reasoning Ability, English Language, and Banking Awareness practice.',
  },
  'seo-sbi-po': {
    title: 'SBI PO Preparation — High-Level Mains Puzzles, DI & CBT Mock Tests | HHK',
    description:
      'Master SBI PO Prelims and Mains with exam-grade Data Interpretation, Seating Arrangements, Reading Comprehension, and Banking Awareness tests.',
  },
  'seo-banking-awareness': {
    title: 'Banking & Financial Awareness Reference Hub — RBI, NPA, UPI & Basel | HHK',
    description:
      'Structured Banking Awareness notes and practice covering RBI Monetary Policy, Repo/CRR/SLR, NPA, Basel Norms, UPI, NEFT/RTGS, KYC/AML, and Priority Sector Lending.',
  },
  'seo-current-affairs': {
    title: 'Daily Banking & Economy Current Affairs for Bank Exams | HHK',
    description:
      'Exam-focused daily Current Affairs curated for IBPS, SBI, RRB, and RBI Mains with banking news, RBI updates, government schemes, and practice quizzes.',
  },
  terms: {
    title: 'Terms & Conditions | HHK Banking Exam Prep',
    description: 'Read the Terms and Conditions governing use of the HHK Banking Exam Preparation Platform.',
  },
  privacy: {
    title: 'Privacy Policy | HHK Banking Exam Prep',
    description: 'Learn how HHK Banking Exam Prep protects student accounts, test history, and payment information.',
  },
  'refund-policy': {
    title: 'Refund & Cancellation Policy | HHK Banking Exam Prep',
    description: 'Review HHK Banking Exam Prep refund and cancellation terms for mock tests and subscriptions.',
  },
  contact: {
    title: 'Contact & Student Support | HHK Banking Exam Prep',
    description: 'Reach HHK student support for help with banking mock tests, account access, or payments.',
  },
};

export function getSeoMetaForPublicPage(pageKey = 'home') {
  const meta = PUBLIC_PAGE_SEO[pageKey] || PUBLIC_PAGE_SEO.home;
  return {
    ...meta,
    path: getPathForPublicPage(pageKey),
  };
}

export const SEO_LANDING_PAGES = {
  'seo-ibps-po': {
    pageKey: 'seo-ibps-po',
    path: '/exams/ibps-po',
    eyebrow: 'IBPS PROBATIONARY OFFICER (CRP PO/MT)',
    h1: 'IBPS PO Prelims & Mains Preparation — Mock Tests, Pattern & Syllabus',
    intro:
      'Build speed for the 60-minute IBPS PO Prelims and master multi-variable Mains puzzles, Data Interpretation, Reading Comprehension, and Banking Awareness in a real computer-based test interface.',
    kpis: [
      { label: 'Selection Stages', value: 'Prelims + Mains + Interview' },
      { label: 'Prelims Structure', value: '100 Qs · 60 Mins' },
      { label: 'Mains Objective', value: '155 Qs · 180 Mins' },
      { label: 'Negative Marking', value: '0.25 Marks per Wrong' },
    ],
    patternRows: [
      { section: 'English Language', prelims: '30 Qs (20 mins)', mains: '35 Qs (40 mins)' },
      { section: 'Quantitative Aptitude / DI', prelims: '35 Qs (20 mins)', mains: '35 Qs (45 mins)' },
      { section: 'Reasoning & Computer Aptitude', prelims: '35 Qs (20 mins)', mains: '45 Qs (60 mins)' },
      { section: 'General / Economy / Banking Awareness', prelims: '—', mains: '40 Qs (35 mins)' },
    ],
    modules: [
      {
        title: 'Quantitative Aptitude & Data Interpretation',
        topics: ['Simplification & Approximation', 'Quadratic & Linear Equations', 'Number Series (Missing & Wrong)', 'Caselet, Table, Pie & Bar DI', 'Percentage, Profit-Loss, SI/CI, Time & Work'],
      },
      {
        title: 'Reasoning Ability (All 19 Topics)',
        topics: ['Floor & Box Puzzles', 'Linear & Circular Seating Arrangement', 'Syllogism & Coded Inequalities', 'Input-Output & Coding-Decoding', 'Blood Relations, Direction & Critical Reasoning'],
      },
      {
        title: 'English Language (All 13 Topics)',
        topics: ['Reading Comprehension', 'Cloze Test & Fill in the Blanks', 'Error Detection & Sentence Correction', 'Para Jumbles & Phrase Replacement', 'Vocabulary, Idioms & Grammar'],
      },
    ],
    faqs: [
      {
        q: 'Is there sectional timing in IBPS PO Prelims and Mains?',
        a: 'Yes. Both IBPS PO Prelims (20 minutes per section) and Mains (35 to 60 minutes per section) enforce strict sectional timers, which HHK replicates in its CBT mock test interface.',
      },
      {
        q: 'How much negative marking applies to IBPS PO objective tests?',
        a: 'One-fourth (0.25) of the marks assigned to a question are deducted for each incorrect answer, while unanswered questions carry zero penalty.',
      },
      {
        q: 'Are HHK IBPS PO practice questions aligned to the latest exam level?',
        a: 'Yes. HHK generates verified multi-subtype questions across Prelims and Mains difficulty tiers for Quant, Reasoning, and English, paired with Banking Awareness and Current Affairs.',
      },
    ],
  },
  'seo-sbi-po': {
    pageKey: 'seo-sbi-po',
    path: '/exams/sbi-po',
    eyebrow: 'STATE BANK OF INDIA PROBATIONARY OFFICER',
    h1: 'SBI PO Prelims & Mains Preparation — High-Level CBT Mock Tests & Syllabus',
    intro:
      'SBI PO demands strong conceptual depth under tight sectional clocks. Practice high-level Mains Data Analysis, variable-based Puzzles, inference-driven Reading Comprehension, and Financial Awareness.',
    kpis: [
      { label: 'Selection Stages', value: 'Prelims + Mains + Psychometric/GE-PI' },
      { label: 'Prelims Structure', value: '100 Qs · 60 Mins' },
      { label: 'Mains Objective', value: '155 Qs · 180 Mins' },
      { label: 'Descriptive Test', value: 'Letter & Essay · 30 Mins' },
    ],
    patternRows: [
      { section: 'English Language', prelims: '30 Qs (20 mins)', mains: '35 Qs (40 mins)' },
      { section: 'Quantitative Aptitude / Data Analysis', prelims: '35 Qs (20 mins)', mains: '30 Qs (45 mins)' },
      { section: 'Reasoning & Computer Aptitude', prelims: '35 Qs (20 mins)', mains: '40 Qs (50 mins)' },
      { section: 'General / Economy / Banking Awareness', prelims: '—', mains: '50 Qs (45 mins)' },
    ],
    modules: [
      {
        title: 'Mains Data Analysis & Arithmetic',
        topics: ['Multi-Graph & Missing Table DI', 'Arithmetic-Based Caselets', 'Probability, Permutation & Combination', 'Mixture, Alligation & Partnership', 'Data Sufficiency (2 & 3 Statements)'],
      },
      {
        title: 'High-Level Reasoning & Puzzles',
        topics: ['Uncertain Linear & Dual-Row Seating', 'Floor + Flat + Variable Puzzles', 'Machine Input-Output (Mains)', 'Statement, Assumption, Conclusion & Cause-Effect', 'Coded Blood Relations & Direction Sense'],
      },
      {
        title: 'Mains English & Banking Awareness',
        topics: ['Inference-Based Reading Comprehension', 'Double/Triple Fillers & Word Usage', 'Sentence Rearrangement & Grammar', 'RBI Circulars, Monetary Policy & Basel Norms', 'Last 6 Months Economy & Banking Current Affairs'],
      },
    ],
    faqs: [
      {
        q: 'How is SBI PO different from IBPS PO?',
        a: 'SBI PO typically features tougher Mains Data Analysis and multi-attribute Reasoning puzzles, no sectional cut-off in Prelims, and a higher weightage on General/Economy/Banking Awareness in Mains.',
      },
      {
        q: 'Does HHK include Mains-level puzzles and Reading Comprehension?',
        a: 'Yes. HHK includes dedicated Mains difficulty generators for Puzzles, Seating Arrangement, Data Interpretation, and AI-assisted Banking Reading Comprehension sets.',
      },
      {
        q: 'Can I browse mock test details before creating an account?',
        a: 'Yes. You can inspect exam catalogues, test structure, duration, and free vs paid plans on HHK before signing in to start a timed CBT attempt.',
      },
    ],
  },
  'seo-banking-awareness': {
    pageKey: 'seo-banking-awareness',
    path: '/banking-awareness',
    eyebrow: 'BANKING & FINANCIAL AWARENESS HUB',
    h1: 'Banking & Financial Awareness for IBPS, SBI, RRB & RBI Exams',
    intro:
      'Score high in the General & Financial Awareness section with structured coverage of Indian banking history, RBI Monetary Policy tools, digital payment rails, NPA classification, and regulatory bodies.',
    kpis: [
      { label: 'Core Domains', value: '34+ Banking Topics' },
      { label: 'Target Exams', value: 'IBPS · SBI · RRB · RBI' },
      { label: 'Scoring Edge', value: 'High Accuracy · Low Time' },
      { label: 'Coverage', value: 'Static + Policy Updates' },
    ],
    patternRows: [
      { section: 'RBI & Monetary Policy', prelims: 'Core Static', mains: 'Repo, Reverse Repo, CRR, SLR, MSF, Bank Rate' },
      { section: 'Regulators & DFIs', prelims: 'Core Static', mains: 'SEBI, NABARD, SIDBI, EXIM Bank, NHB, IRDAI, PFRDA' },
      { section: 'Digital Payments & NPCI', prelims: 'High Frequency', mains: 'UPI, NEFT, RTGS, IMPS, AEPS, BBPS, CBDC' },
      { section: 'Risk, Compliance & Credit', prelims: 'Mains Focus', mains: 'NPA Norms, Basel III, Priority Sector Lending, KYC/AML' },
    ],
    modules: [
      {
        title: 'Central Banking & Monetary Framework',
        topics: ['Structure & Functions of RBI', 'Monetary Policy Committee (MPC)', 'Repo, SDF, MSF, CRR & SLR', 'Open Market Operations & Liquidity Management'],
      },
      {
        title: 'Payment Systems & Banking Operations',
        topics: ['Types of Banks & Bank Accounts', 'Negotiable Instruments & Cheques', 'UPI, IMPS, NEFT & RTGS Settlement Rules', 'Financial Inclusion, Jan Dhan & Mudra'],
      },
      {
        title: 'Risk Management & Financial Regulators',
        topics: ['NPA Categories & Provisioning', 'Basel I, II & III Capital Adequacy', 'Priority Sector Lending (PSL) Targets', 'SEBI, NABARD, SIDBI, IRDAI & PFRDA Mandates'],
      },
    ],
    faqs: [
      {
        q: 'Why is Banking Awareness crucial for Bank Mains exams?',
        a: 'Unlike Quant or Reasoning puzzles that take several minutes per set, Banking Awareness questions can be answered in 15–20 seconds each, making them the fastest way to clear Mains cut-offs.',
      },
      {
        q: 'Which Banking Awareness topics appear most frequently in IBPS & SBI Mains?',
        a: 'RBI Monetary Policy instruments, NPCI/UPI updates, Priority Sector Lending norms, NPA/PCA framework, Basel III ratios, and recent RBI circulars consistently dominate Mains papers.',
      },
      {
        q: 'How should I combine Static Banking Awareness with Current Affairs?',
        a: 'Learn the static foundation (such as how CRR, SLR, and PSL work) first, then track monthly RBI policy changes and banking circulars in the Current Affairs section.',
      },
    ],
  },
  'seo-current-affairs': {
    pageKey: 'seo-current-affairs',
    path: '/current-affairs',
    eyebrow: 'DAILY BANKING & ECONOMY CURRENT AFFAIRS',
    h1: 'Daily Current Affairs for Banking Exams — RBI Updates, Economy & Schemes',
    intro:
      'Stay exam-ready without information overload. HHK curates daily banking, economy, RBI circulars, Union Budget highlights, government schemes, appointments, and awards tailored strictly for IBPS, SBI, RRB, and RBI Mains.',
    kpis: [
      { label: 'Focus Window', value: 'Last 4–6 Months' },
      { label: 'Primary Categories', value: 'Banking · Economy · Schemes' },
      { label: 'Practice Mode', value: 'Daily MCQs & GA Marathon' },
      { label: 'Exam Alignment', value: 'IBPS · SBI · RBI · NABARD' },
    ],
    patternRows: [
      { section: 'Banking & RBI Circulars', prelims: 'Priority 1', mains: 'MPC rates, penalties, digital lending, UPI limits' },
      { section: 'Economy, Budget & Survey', prelims: 'Priority 1', mains: 'GDP forecasts, fiscal deficit, inflation, PSU disinvestment' },
      { section: 'Government Schemes & MoUs', prelims: 'Priority 2', mains: 'Ministry, outlay, launch year, eligibility & targets' },
      { section: 'Appointments, Awards & Reports', prelims: 'Priority 2', mains: 'MD/CEO of banks, indices, summits & sports' },
    ],
    modules: [
      {
        title: 'Banking & Financial Current Affairs',
        topics: ['RBI Bi-Monthly Policy & Circulars', 'SEBI & IRDAI Regulatory Announcements', 'Bank Mergers, Partnerships & New Products', 'World Bank, IMF & ADB Loan Approvals'],
      },
      {
        title: 'National, Schemes & Economic Affairs',
        topics: ['Union Budget & Economic Survey Highlights', 'Central & State Welfare Schemes', 'GDP Growth Projections & CPI/WPI Data', 'Infrastructure & Green Energy Initiatives'],
      },
      {
        title: 'Revision & GA Marathon Practice',
        topics: ['Daily Current Affairs Quiz', 'Weekly & Monthly Consolidation', 'Exam-Weighted Statement-Based GA MCQs', 'Bookmarks for Last-Week Mains Revision'],
      },
    ],
    faqs: [
      {
        q: 'How many months of Current Affairs are required for IBPS PO and SBI PO Mains?',
        a: 'Most banking Mains questions come from the 4 to 6 months immediately preceding the exam date, with the highest concentration in the last 3 months.',
      },
      {
        q: 'What makes banking Current Affairs different from UPSC or SSC GK?',
        a: 'Banking exams heavily emphasize RBI guidelines, financial literacy, banking agreements, GDP/inflation figures, scheme outlays, and regulatory updates rather than pure history or geography.',
      },
      {
        q: 'Can I revise Current Affairs through timed quizzes on HHK?',
        a: 'Yes. Once logged in, you can practice daily Current Affairs MCQs and full GA Marathon sets directly inside your HHK student workspace.',
      },
    ],
  },
};
