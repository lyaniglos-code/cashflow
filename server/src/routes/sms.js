import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { sendSms, twilioEnabled } from '../twilio.js';
import { sendTest } from '../notifications.js';

const router = Router();
router.use(requireAuth);

function normalizePhone(raw) {
  let s = String(raw || '').replace(/[\s()\-.]/g, '');
  if (!s) return null;
  if (!s.startsWith('+')) {
    // assume US/CA if 10 digits
    if (/^\d{10}$/.test(s)) s = '+1' + s;
    else if (/^1\d{10}$/.test(s)) s = '+' + s;
    else s = '+' + s;
  }
  return /^\+[1-9]\d{6,15}$/.test(s) ? s : null;
}

function smsSettings(u) {
  return {
    twilioConfigured: twilioEnabled(),
    phone: u.phone_number || '',
    phoneVerified: Boolean(u.phone_verified),
    smsOptIn: Boolean(u.sms_opt_in),
    alertShortfall: Boolean(u.alert_shortfall),
    alertWeeklyPulse: Boolean(u.alert_weekly_pulse),
    alertImprovement: Boolean(u.alert_improvement),
    quietStart: u.quiet_start || '21:00',
    quietEnd: u.quiet_end || '08:00',
    timezone: u.timezone || 'America/New_York',
    shortfallThreshold: u.shortfall_threshold ?? 0,
  };
}

router.get('/status', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json(smsSettings(u));
});

// Send a one-time verification code to the supplied phone.
router.post('/send-code', async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) return res.status(400).json({ error: 'Enter a valid phone number (e.g. +15551234567).' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET pending_phone = ?, verify_code = ?, verify_expires = ? WHERE id = ?').run(
    phone,
    code,
    expires,
    req.userId
  );
  const result = await sendSms(phone, `Your CashFlow verification code is ${code}. It expires in 10 minutes.`);
  // In simulation/testing (no live Twilio), return the code so the flow is
  // testable without a real handset. Remove/guard this in production.
  res.json({ sent: true, simulated: result.simulated, devCode: result.simulated ? code : undefined });
});

// Verify the code; on success store the phone, mark verified, opt in.
router.post('/verify', (req, res) => {
  const { code } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!u.verify_code || !u.pending_phone) return res.status(400).json({ error: 'Request a code first.' });
  if (new Date(u.verify_expires) < new Date())
    return res.status(400).json({ error: 'Code expired — request a new one.' });
  if (String(code).trim() !== u.verify_code) return res.status(400).json({ error: 'Incorrect code.' });
  db.prepare(
    `UPDATE users SET phone_number = ?, phone_verified = 1, sms_opt_in = 1, pending_phone = NULL, verify_code = NULL, verify_expires = NULL WHERE id = ?`
  ).run(u.pending_phone, req.userId);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json(smsSettings(updated));
});

// Update SMS preferences (toggles, quiet hours, timezone, threshold).
router.patch('/settings', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  const b = req.body || {};
  const bool = (v, fallback) => (v == null ? fallback : v ? 1 : 0);
  db.prepare(
    `UPDATE users SET sms_opt_in = ?, alert_shortfall = ?, alert_weekly_pulse = ?, alert_improvement = ?,
       quiet_start = ?, quiet_end = ?, timezone = ?, shortfall_threshold = ? WHERE id = ?`
  ).run(
    bool(b.smsOptIn, u.sms_opt_in),
    bool(b.alertShortfall, u.alert_shortfall),
    bool(b.alertWeeklyPulse, u.alert_weekly_pulse),
    bool(b.alertImprovement, u.alert_improvement),
    b.quietStart || u.quiet_start,
    b.quietEnd || u.quiet_end,
    b.timezone || u.timezone,
    b.shortfallThreshold != null ? Number(b.shortfallThreshold) : u.shortfall_threshold,
    req.userId
  );
  res.json(smsSettings(db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)));
});

// Remove the phone / disable SMS.
router.delete('/', (req, res) => {
  db.prepare(
    `UPDATE users SET phone_number = NULL, phone_verified = 0, sms_opt_in = 0, pending_phone = NULL, verify_code = NULL WHERE id = ?`
  ).run(req.userId);
  res.json(smsSettings(db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)));
});

// Fire a test alert of a given type immediately (bypasses cooldown/quiet hours).
router.post('/test', async (req, res) => {
  const { type } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!u.phone_number) return res.status(400).json({ error: 'Verify a phone number first.' });
  try {
    const result = await sendTest(u, type);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Recent notification history (handy for the UI + testing).
router.get('/log', (req, res) => {
  const rows = db
    .prepare(
      'SELECT alert_type, sent_at, message, status FROM notification_log WHERE user_id = ? ORDER BY sent_at DESC LIMIT 20'
    )
    .all(req.userId);
  res.json({ log: rows });
});

export default router;
