import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from the project root (one level above server/).
dotenv.config({ path: join(__dirname, '..', '..', '.env') });
// Also allow a server-local .env as a fallback.
dotenv.config({ path: join(__dirname, '..', '.env') });

import express from 'express';
import 'express-async-errors'; // route handlers that reject now reach the central error handler
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { nanoid } from 'nanoid';
import db from './db.js';
import { hashPassword } from './auth.js';
import { generateRestaurantDataset } from './seed.js';
import { aiEnabled } from './anthropic.js';

import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import forecastRoutes from './routes/forecast.js';
import aiRoutes from './routes/ai.js';
import scenarioRoutes from './routes/scenarios.js';
import digestRoutes from './routes/digest.js';
import planRoutes from './routes/plans.js';
import plaidRoutes from './routes/plaid.js';
import streamRoutes from './routes/stream.js';
import metricsRoutes from './routes/metrics.js';
import smsRoutes from './routes/sms.js';
import { plaidEnabled } from './plaid.js';
import { twilioEnabled } from './twilio.js';
import { startCron } from './cron.js';

// In production, refuse to start with default/missing secrets.
function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;
  const weak = (v) => !v || v === 'dev-secret-change-me-in-production';
  const missing = [];
  if (weak(process.env.JWT_SECRET)) missing.push('JWT_SECRET');
  if (weak(process.env.ENCRYPTION_KEY)) missing.push('ENCRYPTION_KEY');
  if (missing.length) {
    console.error(`[FATAL] Set strong values for ${missing.join(', ')} before running in production.`);
    process.exit(1);
  }
}
assertProductionSecrets();

const app = express();

// Security headers (API/JSON server — no HTML, so CSP is unnecessary; allow the
// SPA to consume responses cross-origin).
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: permissive in dev; lock to a comma-separated CORS_ORIGIN allowlist in prod.
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : {}));

app.use(express.json({ limit: '2mb' }));

// Serve the built React SPA from the same origin (single-service production
// deploy). In dev there is no build (Vite serves on 5173), so this is a no-op.
const clientDist = join(__dirname, '..', '..', 'client', 'dist');
const serveClient = existsSync(join(clientDist, 'index.html'));
if (serveClient) app.use(express.static(clientDist));

// Rate limiters on abuse-prone endpoints: brute-forceable auth, and SMS code
// sends (which cost money on a live Twilio account).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — please try again in a few minutes.' },
});
const smsCodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification-code requests — please try again later.' },
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, aiEnabled: aiEnabled(), plaidEnabled: plaidEnabled() });
});

app.use('/api/auth', authLimiter);
app.use('/api/sms/send-code', smsCodeLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/digest', digestRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/plaid', plaidRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/sms', smsRoutes);

// 404 for unmatched API routes — always JSON, never an HTML page.
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// SPA fallback: any non-API GET returns index.html so client-side routes
// (e.g. /analytics) work on direct load / refresh.
if (serveClient) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// Central error handler: returns clean JSON and logs the stack server-side
// instead of leaking it to the client. Catches synchronous throws from route
// handlers (and anything passed to next(err)).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message || 'Request failed' });
});

// Last-resort process guards so one bad async path can't silently kill the
// server. In production you'd typically log to an APM and let the process
// manager (pm2/systemd/k8s) restart on uncaughtException.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// Seed a demo account with the restaurant dataset on first run, so the app is
// impressive out of the box. Login: demo@bistro.com / demo1234
function ensureDemoSeed() {
  const email = 'demo@bistro.com';
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const id = nanoid();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, business_name, business_type, industry_vertical, shortfall_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, email, hashPassword('demo1234'), 'The Corner Bistro', 'Restaurant', 'Food & Beverage', 2000);
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }
  const count = db.prepare('SELECT COUNT(*) AS c FROM transactions WHERE user_id = ?').get(user.id).c;
  if (count === 0) {
    const rows = generateRestaurantDataset({ months: 6 });
    const insert = db.prepare(
      `INSERT INTO transactions (id, user_id, date, description, amount, category, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const run = db.transaction((items) => {
      for (const t of items) insert.run(nanoid(), user.id, t.date, t.description, t.amount, t.category, t.source);
    });
    run(rows);
    console.log(`[seed] Loaded ${rows.length} demo transactions for ${email}`);
  }
}

ensureDemoSeed();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n  ForecastOS API running on http://localhost:${PORT}`);
  console.log(`  AI (Claude): ${aiEnabled() ? 'ENABLED' : 'DISABLED — using template fallback'}`);
  console.log(
    `  Plaid: ${plaidEnabled() ? `ENABLED (${process.env.PLAID_ENV || 'sandbox'})` : 'DISABLED — add PLAID_CLIENT_ID/SECRET to enable live bank data'}`
  );
  console.log(
    `  Twilio SMS: ${twilioEnabled() ? 'ENABLED' : 'SIMULATION — messages logged to console (add TWILIO_* to send real SMS)'}`
  );
  console.log(`  Demo login: demo@bistro.com / demo1234\n`);
  startCron();
});
