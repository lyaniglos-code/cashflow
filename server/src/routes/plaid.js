import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { encrypt } from '../crypto.js';
import { emitRefresh } from '../bus.js';
import { plaidEnabled, plaidClient, plaidEnv, syncItem } from '../plaid.js';

const router = Router();

const COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES || 'US').split(',').map((s) => s.trim());
const PRODUCTS = (process.env.PLAID_PRODUCTS || 'transactions').split(',').map((s) => s.trim());

function getConnection(userId) {
  return db.prepare('SELECT * FROM connections WHERE user_id = ? ORDER BY created_at DESC').get(userId);
}

// ---- Public webhook (no auth): Plaid calls this when new data is available. ----
router.post('/webhook', async (req, res) => {
  // Acknowledge fast; do the work after.
  res.json({ received: true });
  try {
    const { webhook_type, webhook_code, item_id } = req.body || {};
    if (webhook_type !== 'TRANSACTIONS') return;
    if (!['SYNC_UPDATES_AVAILABLE', 'DEFAULT_UPDATE', 'INITIAL_UPDATE', 'HISTORICAL_UPDATE'].includes(webhook_code))
      return;
    const conn = db.prepare('SELECT * FROM connections WHERE item_id = ?').get(item_id);
    if (conn) await syncItem(conn);
  } catch (err) {
    console.error('[plaid webhook]', err.message);
  }
});

router.use(requireAuth);

router.get('/status', (req, res) => {
  const conn = getConnection(req.userId);
  res.json({
    configured: plaidEnabled(),
    env: plaidEnv(),
    connected: Boolean(conn),
    institution: conn?.institution_name || null,
    lastSynced: conn?.last_synced_at || null,
  });
});

router.post('/link-token', async (req, res) => {
  if (!plaidEnabled())
    return res.status(400).json({ error: 'Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to .env.' });
  try {
    const resp = await plaidClient().linkTokenCreate({
      user: { client_user_id: req.userId },
      client_name: 'ForecastOS',
      products: PRODUCTS,
      country_codes: COUNTRY_CODES,
      language: 'en',
      ...(process.env.PLAID_WEBHOOK_URL ? { webhook: process.env.PLAID_WEBHOOK_URL } : {}),
    });
    res.json({ link_token: resp.data.link_token });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error_message || err.message });
  }
});

router.post('/exchange', async (req, res) => {
  if (!plaidEnabled()) return res.status(400).json({ error: 'Plaid is not configured.' });
  const { public_token, institution } = req.body || {};
  if (!public_token) return res.status(400).json({ error: 'public_token is required' });
  try {
    const resp = await plaidClient().itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = resp.data;
    // One bank per user for now: replace any existing connection.
    db.prepare('DELETE FROM connections WHERE user_id = ?').run(req.userId);
    const id = nanoid();
    db.prepare(
      `INSERT INTO connections (id, user_id, provider, access_token_enc, item_id, institution_name)
       VALUES (?, ?, 'plaid', ?, ?, ?)`
    ).run(id, req.userId, encrypt(access_token), item_id, (institution || 'Connected bank').slice(0, 120));
    const conn = db.prepare('SELECT * FROM connections WHERE id = ?').get(id);
    const counts = await syncItem(conn);
    res.json({ connected: true, institution: conn.institution_name, ...counts });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error_message || err.message });
  }
});

router.post('/sync', async (req, res) => {
  const conn = getConnection(req.userId);
  if (!conn) return res.status(400).json({ error: 'No bank connected' });
  try {
    const counts = await syncItem(conn);
    res.json({ ok: true, ...counts });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error_message || err.message });
  }
});

// Dev helper: drop a synthetic "live" transaction into the connected account so
// the live SSE pipeline is demoable locally without a public webhook URL.
router.post('/sandbox/simulate', (req, res) => {
  const conn = getConnection(req.userId);
  if (!conn) return res.status(400).json({ error: 'Connect a bank first' });
  const samples = [
    { description: 'Square POS deposit', amount: 1200, category: 'Income' },
    { description: 'Sysco supplier order', amount: -640, category: 'Food Costs' },
    { description: 'Stripe payout', amount: 850, category: 'Income' },
    { description: 'Utility autopay', amount: -180, category: 'Utilities' },
  ];
  const s = samples[Math.floor(Math.random() * samples.length)];
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    `INSERT INTO transactions (id, user_id, date, description, amount, category, source, external_id)
     VALUES (?, ?, ?, ?, ?, ?, 'plaid', ?)`
  ).run(nanoid(), req.userId, today, s.description, s.amount, s.category, `sim_${nanoid()}`);
  db.prepare("UPDATE connections SET last_synced_at = datetime('now') WHERE id = ?").run(conn.id);
  emitRefresh(req.userId, { source: 'sandbox-sim', added: 1 });
  res.json({ ok: true, transaction: { ...s, date: today } });
});

router.delete('/connection', async (req, res) => {
  const conn = getConnection(req.userId);
  if (!conn) return res.json({ ok: true });
  try {
    if (plaidEnabled()) {
      const { decrypt } = await import('../crypto.js');
      await plaidClient()
        .itemRemove({ access_token: decrypt(conn.access_token_enc) })
        .catch(() => {});
    }
  } catch {
    /* best effort */
  }
  db.prepare('DELETE FROM connections WHERE id = ?').run(conn.id);
  res.json({ ok: true });
});

export default router;
