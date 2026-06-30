import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { emitRefresh } from '../bus.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(requireAuth);

// List transactions, newest first, optional ?limit and date range.
router.get('/', (req, res) => {
  const { from, to, limit } = req.query;
  let sql = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [req.userId];
  if (from) {
    sql += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date <= ?';
    params.push(to);
  }
  sql += ' ORDER BY date DESC, created_at DESC';
  if (limit) {
    sql += ' LIMIT ?';
    params.push(Number(limit));
  }
  const rows = db.prepare(sql).all(...params);
  res.json({ transactions: rows });
});

// Summary count + balance.
router.get('/summary', (req, res) => {
  const row = db
    .prepare('SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS balance FROM transactions WHERE user_id = ?')
    .get(req.userId);
  res.json({ count: row.count, balance: Math.round(row.balance * 100) / 100 });
});

export function normalizeAmount(raw) {
  if (raw == null) return NaN;
  const cleaned = String(raw)
    .replace(/[$,\s]/g, '')
    .replace(/[()]/g, (m) => (m === '(' ? '-' : ''));
  return Number(cleaned);
}

export function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // Accept YYYY-MM-DD directly.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Accept M/D/YYYY or MM/DD/YYYY.
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let [, mo, d, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);
  return null;
}

// Upload a CSV of bank transactions.
// Expected columns (header row, case-insensitive): date, description, amount, category
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name must be "file")' });
  let records;
  try {
    records = parse(req.file.buffer, {
      columns: (header) => header.map((h) => h.toLowerCase().trim()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err) {
    return res.status(400).json({ error: 'Could not parse CSV: ' + (err.message || 'unknown error') });
  }

  const insert = db.prepare(
    `INSERT INTO transactions (id, user_id, date, description, amount, category, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  let imported = 0;
  const errors = [];

  const run = db.transaction((rows) => {
    rows.forEach((r, idx) => {
      const date = normalizeDate(r.date);
      const amount = normalizeAmount(r.amount);
      const description = (r.description || '').trim();
      const category = (r.category || 'Uncategorized').trim() || 'Uncategorized';
      if (!date || isNaN(amount) || !description) {
        errors.push({ row: idx + 2, reason: 'Missing/invalid date, amount, or description' });
        return;
      }
      insert.run(nanoid(), req.userId, date, description, amount, category, 'csv');
      imported += 1;
    });
  });
  run(records);

  if (imported) emitRefresh(req.userId, { source: 'csv', added: imported });
  res.json({ imported, skipped: errors.length, errors: errors.slice(0, 10) });
});


// Add a single manual transaction.
router.post('/manual', (req, res) => {
  const { date, description, amount, category } = req.body || {};
  const d = normalizeDate(date);
  const amt = normalizeAmount(amount);
  if (!d || isNaN(amt) || !description) {
    return res.status(400).json({ error: 'date, description and amount are required' });
  }
  db.prepare(
    `INSERT INTO transactions (id, user_id, date, description, amount, category, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    nanoid(),
    req.userId,
    d,
    String(description).trim(),
    amt,
    (category || 'Uncategorized').trim() || 'Uncategorized',
    'manual'
  );
  emitRefresh(req.userId, { source: 'manual', added: 1 });
  res.json({ ok: true });
});

// Set the CURRENT cash position to a target amount. Implemented as a balancing
// "opening balance" entry dated ~6 months back: we compute a plug so that the
// sum of all transactions equals the entered amount. Call this AFTER adding
// recurring history so the stated cash-on-hand is exact. The dated-in-the-past
// entry keeps it out of the trailing-90-day detection window, so it sets the
// cushion without being mistaken for recurring income.
router.post('/opening-balance', (req, res) => {
  const target = Number(req.body?.amount);
  if (isNaN(target)) return res.status(400).json({ error: 'amount is required' });
  // Remove any prior opening-balance row, then sum everything else.
  db.prepare(`DELETE FROM transactions WHERE user_id = ? AND category = 'Owner Equity'`).run(req.userId);
  const { total } = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE user_id = ?')
    .get(req.userId);
  const plug = Math.round((target - total) * 100) / 100;
  const d = new Date();
  d.setDate(d.getDate() - 180);
  db.prepare(
    `INSERT INTO transactions (id, user_id, date, description, amount, category, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(nanoid(), req.userId, d.toISOString().slice(0, 10), 'Opening cash balance', plug, 'Owner Equity', 'manual');
  res.json({ ok: true, currentBalance: target });
});

// Expand a recurring income/expense definition into dated transactions across
// the trailing window, so the forecast engine detects the pattern and projects
// it forward. Body: { label, amount (signed), category, cadence, months }.
router.post('/recurring', (req, res) => {
  const { label, amount, category, cadence = 'monthly', months = 4 } = req.body || {};
  const amt = Number(amount);
  if (!label || isNaN(amt) || amt === 0) {
    return res.status(400).json({ error: 'label and a non-zero amount are required' });
  }
  const periodDays = cadence === 'weekly' ? 7 : cadence === 'biweekly' ? 14 : 30;
  const windowDays = Math.max(90, Math.round(months * 30));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const insert = db.prepare(
    `INSERT INTO transactions (id, user_id, date, description, amount, category, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  let count = 0;
  const run = db.transaction(() => {
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + periodDays)) {
      const date = d.toISOString().slice(0, 10);
      insert.run(
        nanoid(),
        req.userId,
        date,
        String(label).trim(),
        Math.round(amt * 100) / 100,
        (category || (amt >= 0 ? 'Income' : 'Expense')).trim(),
        'recurring'
      );
      count += 1;
    }
  });
  run();
  if (count) emitRefresh(req.userId, { source: 'recurring', added: count });
  res.json({ inserted: count, cadence, periodDays });
});

// Clear all transactions for the user.
router.delete('/', (req, res) => {
  const info = db.prepare('DELETE FROM transactions WHERE user_id = ?').run(req.userId);
  emitRefresh(req.userId, { source: 'clear' });
  res.json({ deleted: info.changes });
});

export default router;
