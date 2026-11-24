import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import { pool } from './db.js';
import { authRouter } from './routes/auth.js';
import { contentRouter } from './routes/content.js';
import { attemptRouter } from './routes/attempts.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';
import { paymentRouter } from './routes/payments.js';
import { adminPaymentRouter } from './routes/adminPayments.js';
import { examEngineRouter } from './routes/examEngine.js';
import { floorPuzzlesRouter } from './routes/floorPuzzles.js';
import { currentAffairsStudentRouter } from './routes/currentAffairsStudent.js';
import { currentAffairsAdminRouter } from './routes/currentAffairsAdmin.js';
import { bankingAwarenessStudentRouter } from './routes/bankingAwarenessStudent.js';
import { bankingAwarenessAdminRouter } from './routes/bankingAwarenessAdmin.js';
import { currentAffairsAiAdminRouter } from './routes/currentAffairsAiAdmin.js';
import { currentAffairsQuestionsAdminRouter } from './routes/currentAffairsQuestionsAdmin.js';
import { currentAffairsOneLinersStudentRouter } from './routes/currentAffairsOneLinersStudent.js';
import { currentAffairsOneLinersAdminRouter } from './routes/currentAffairsOneLinersAdmin.js';
import { currentAffairsFlashcardsStudentRouter } from './routes/currentAffairsFlashcardsStudent.js';
import { currentAffairsFlashcardsAdminRouter } from './routes/currentAffairsFlashcardsAdmin.js';
import { smartRevisionStudentRouter } from './routes/smartRevisionStudent.js';
import { monthlyCapsulesStudentRouter } from './routes/monthlyCapsulesStudent.js';
import { monthlyCapsulesAdminRouter } from './routes/monthlyCapsulesAdmin.js';
import { gaMarathonStudentRouter } from './routes/gaMarathonStudent.js';
import { gaMarathonAdminRouter } from './routes/gaMarathonAdmin.js';
import { platformAnalyticsAdminRouter } from './routes/platformAnalyticsAdmin.js';
import { studentPerformanceRouter } from './routes/studentPerformance.js';
import { evaluateReadiness, requestCorrelationMiddleware } from './services/requestMonitoring.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const production = process.env.NODE_ENV === 'production';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters.');
}

const PgStore = connectPgSimple(session);

// 1. Core security settings
app.disable('x-powered-by');
app.use(requestCorrelationMiddleware);
app.set('trust proxy', production ? 1 : false);

// 2. Comprehensive HTTP Security Headers via Helmet (with Razorpay Checkout allowlist)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
        connectSrc: [
          "'self'",
          'http://localhost:*',
          'ws://localhost:*',
          'ws://127.0.0.1:*',
          'https://api.razorpay.com',
          'https://lumberjack.razorpay.com',
          'https://checkout.razorpay.com',
        ],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", 'https://api.razorpay.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// 3. Permissions-Policy Header (allow Razorpay payment checkout iframe)
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com"), usb=()'
  );
  next();
});

// 4. Safe body size limits + rawBody capture for Razorpay webhook HMAC verification
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      if (req.originalUrl === '/api/payments/webhook') {
        req.rawBody = buf;
      }
    },
  })
);

// 5. Hardened Session Management
app.use(
  session({
    store: new PgStore({
      pool,
      tableName: 'user_sessions',
      createTableIfMissing: true,
      pruneSessionInterval: 15 * 60,
    }),
    name: 'hhk.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      path: '/',
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
    },
  })
);

// 6. Anti-CSRF Origin Verification on state-changing API requests (webhook uses HMAC signature instead)
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path === '/payments/webhook') return next();
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return next();
  try {
    const originHost = new URL(origin).host;
    const allowedHosts = new Set([
      req.get('host'),
      'localhost:5173',
      'localhost:3001',
      '127.0.0.1:5173',
      '127.0.0.1:3001',
    ]);
    if (process.env.APP_URL) {
      try {
        allowedHosts.add(new URL(process.env.APP_URL).host);
      } catch {}
    }
    if (allowedHosts.has(originHost)) return next();
    return res.status(403).json({ error: 'Cross-origin request blocked.' });
  } catch {
    return res.status(403).json({ error: 'Invalid origin header.' });
  }
});

// 7. Prevent caching of API responses + Global API Rate Limiter
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: 200,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  })
);

// 8. Health check
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'database_unavailable' });
  }
});

app.get('/api/ready', async (_req, res) => {
  const report = await evaluateReadiness({ dbPool: pool });
  res.status(report.status === 'ready' ? 200 : 503).json(report);
});

// 9. API Routes
app.use('/api/public', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api', paymentRouter);
app.use('/api/banking-awareness', bankingAwarenessStudentRouter);
app.use('/api/current-affairs/one-liners', currentAffairsOneLinersStudentRouter);
app.use('/api/current-affairs/flashcards', currentAffairsFlashcardsStudentRouter);
app.use('/api/smart-revision', smartRevisionStudentRouter);
app.use('/api/monthly-capsules', monthlyCapsulesStudentRouter);
app.use('/api/ga-marathon', gaMarathonStudentRouter);
app.use('/api/student/performance-analytics', studentPerformanceRouter);
app.use('/api', currentAffairsStudentRouter);
app.use('/api', contentRouter);
app.use('/api', attemptRouter);
app.use('/api/admin/exam-engine', examEngineRouter);
app.use('/api/admin', adminPaymentRouter);
app.use('/api/admin/banking-awareness', bankingAwarenessAdminRouter);
app.use('/api/admin/current-affairs/ai', currentAffairsAiAdminRouter);
app.use('/api/admin/current-affairs/questions', currentAffairsQuestionsAdminRouter);
app.use('/api/admin/current-affairs/one-liners', currentAffairsOneLinersAdminRouter);
app.use('/api/admin/current-affairs/flashcards', currentAffairsFlashcardsAdminRouter);
app.use('/api/admin/monthly-capsules', monthlyCapsulesAdminRouter);
app.use('/api/admin/ga-marathon', gaMarathonAdminRouter);
app.use('/api/admin/analytics', platformAnalyticsAdminRouter);
app.use('/api/admin', currentAffairsAdminRouter);
app.use('/api/admin', adminRouter);
app.use('/api/puzzles/floor', floorPuzzlesRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

// 10. Block any source/map exposure and serve compiled bundle
const blockedSourcePattern =
  /^\/(?:src\/|client\/|server\/|scripts\/|\.env|package(?:-lock)?\.json$|tsconfig[^/]*\.json$)|(?:\.map|\.tsx?|\.jsx)$/i;
app.use((req, res, next) => {
  if (blockedSourcePattern.test(req.path)) {
    return res.status(404).type('text/plain').send('Not Found');
  }
  next();
});

const clientDist = path.join(projectRoot, 'client', 'dist');
const rootDist = path.join(projectRoot, 'dist');
const distPath = fs.existsSync(clientDist) ? clientDist : rootDist;

if (production || fs.existsSync(path.join(distPath, 'index.html'))) {
  app.use(
    express.static(distPath, {
      index: false,
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store');
        }
      },
    })
  );
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(distPath, 'index.html'), error => {
      if (error) next(error);
    });
  });
}

// 11. Centralized Safe Error Handler
app.use((error, _req, res, _next) => {
  console.error(error?.stack ?? error);
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    });
  }
  if (error?.code === '23505') {
    return res.status(409).json({ error: 'A record with that unique value already exists.' });
  }
  if (error?.code === '23503') {
    return res.status(400).json({ error: 'A related record is invalid or in use.' });
  }
  if (error?.status && error.status < 500) {
    return res.status(error.status).json({ error: error.message });
  }
  res.status(500).json({ error: 'Something went wrong. Try again shortly.' });
});

app.listen(port, () => console.log(`HHK API listening on http://localhost:${port}`));
