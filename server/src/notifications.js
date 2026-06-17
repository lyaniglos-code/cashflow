import { nanoid } from 'nanoid';
import db from './db.js';
import { sendSms } from './twilio.js';
import { smsBlurb } from './anthropic.js';
import { loadUserForecast, aiContext } from './routes/forecast.js';
import { inQuietHours, nextAllowedTime, tzParts } from './time.js';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const link = (path = '/') => `${APP_URL}${path}`;

function money(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}
function shortDate(s) {
  if (!s) return '';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function hoursSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso.replace(' ', 'T') + 'Z').getTime()) / 3_600_000;
}

// ---------------- Logging / eligibility ----------------
function logNotification(user, type, projectionValue, message, status) {
  db.prepare(
    `INSERT INTO notification_log (id, user_id, alert_type, projection_value_at_send, message, status) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(nanoid(), user.id, type, projectionValue, message, status);
}
function lastSent(userId, type) {
  return db
    .prepare(
      `SELECT * FROM notification_log WHERE user_id = ? AND alert_type = ? AND status IN ('sent','simulated') ORDER BY sent_at DESC LIMIT 1`
    )
    .get(userId, type);
}
function getUser(userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}
export function messagingUsers() {
  return db
    .prepare(`SELECT * FROM users WHERE phone_verified = 1 AND sms_opt_in = 1 AND phone_number IS NOT NULL`)
    .all();
}

// Send now, or queue until quiet hours end. Real-time breaches pass bypassQuiet.
async function dispatch(user, type, projectionValue, body, { bypassQuiet = false } = {}) {
  if (!bypassQuiet && inQuietHours(user)) {
    const after = nextAllowedTime(user);
    db.prepare(
      `INSERT INTO queued_sms (id, user_id, alert_type, body, projection_value, send_after) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(nanoid(), user.id, type, body, projectionValue, after.toISOString());
    return { queued: true, sendAfter: after.toISOString(), body };
  }
  const res = await sendSms(user.phone_number, body);
  logNotification(user, type, projectionValue, body, res.error ? 'error' : res.simulated ? 'simulated' : 'sent');
  return { sent: true, simulated: res.simulated, body };
}

// ---------------- Alert checks ----------------

// 1. Shortfall: resend only if the deficit worsened ≥10% AND ≥48h since last.
export async function checkShortfall(user, { force = false } = {}) {
  if (!user.alert_shortfall && !force) return null;
  const f = loadUserForecast(user.id);
  if (!f.shortfall) return null;
  const deficit = f.shortfall.deficitAmount;
  if (!force) {
    const last = lastSent(user.id, 'shortfall');
    if (last) {
      if (hoursSince(last.sent_at) < 48) return null; // cooldown
      const prev = last.projection_value_at_send ?? 0;
      if (!(deficit >= prev * 1.1)) return null; // must worsen ≥10%
    }
  }
  const cause = await smsBlurb('shortfall_cause', aiContext(f));
  const body = `⚠ CashFlow Alert: Projected to be ${money(deficit)} short by ${shortDate(f.shortfall.date)} (${f.shortfall.daysUntil} days). Main cause: ${cause}. View: ${link('/')}`;
  return dispatch(user, 'shortfall', deficit, body);
}

// 3. Improvement: 30-day outlook improved ≥10% since the last check (24h cooldown).
export async function checkImprovement(user, { force = false } = {}) {
  if (!user.alert_improvement && !force) return null;
  const f = loadUserForecast(user.id);
  const current = f.deltas.d30.endBalance;
  const prev = user.last_projection_value;
  db.prepare('UPDATE users SET last_projection_value = ? WHERE id = ?').run(current, user.id);
  if (!force) {
    if (prev == null) return null; // first run only sets the baseline
    const improvement = current - prev;
    const base = Math.abs(prev) || 1;
    if (!(improvement > 0 && improvement >= base * 0.1)) return null;
    const last = lastSent(user.id, 'improvement');
    if (last && hoursSince(last.sent_at) < 24) return null;
    const body = `📈 Good news — your 30-day cash outlook just improved by ${money(improvement)}. Details: ${link('/')}`;
    return dispatch(user, 'improvement', current, body);
  }
  const body = `📈 Good news — your 30-day cash outlook just improved by ${money(Math.max(500, Math.abs(current) * 0.1))}. Details: ${link('/')}`;
  return dispatch(user, 'improvement', current, body, { bypassQuiet: true });
}

// 4. Real-time threshold breach: balance just crossed below threshold — send now.
export async function checkBreach(user, { force = false } = {}) {
  if (!user.alert_shortfall && !force) return null;
  const f = loadUserForecast(user.id);
  const cur = f.balance;
  const prev = user.last_balance;
  const threshold = user.shortfall_threshold || 0;
  db.prepare('UPDATE users SET last_balance = ? WHERE id = ?').run(cur, user.id);
  const crossed = prev != null && prev >= threshold && cur < threshold;
  if (!crossed && !force) return null;
  const body = `🔴 Your balance just dropped below ${money(threshold)}. Current balance: ${money(cur)}. View: ${link('/')}`;
  return dispatch(user, 'breach', cur, body, { bypassQuiet: true }); // always immediate
}

// 2. Weekly Pulse: Mon 8am local. Hourly cron calls this; it self-gates on time.
function lastWeekFlows(userId) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const rows = db.prepare('SELECT amount FROM transactions WHERE user_id = ? AND date >= ?').all(userId, since);
  let inAmt = 0;
  let outAmt = 0;
  for (const r of rows) r.amount >= 0 ? (inAmt += r.amount) : (outAmt += -r.amount);
  return { inAmt, outAmt };
}
export async function checkWeeklyPulse(user, { force = false } = {}) {
  if (!user.alert_weekly_pulse && !force) return null;
  if (!force) {
    const p = tzParts(new Date(), user.timezone);
    if (p.weekday !== 'Mon' || p.hour !== 8) return null; // only Monday 8am local
    const last = lastSent(user.id, 'weekly_pulse');
    if (last && hoursSince(last.sent_at) < 5 * 24) return null; // once per week
  }
  const f = loadUserForecast(user.id);
  const { inAmt, outAmt } = lastWeekFlows(user.id);
  const outlook = await smsBlurb('weekly_outlook', aiContext(f));
  const body = `Weekly Pulse: ${money(inAmt)} in, ${money(outAmt)} out last week. 30-day outlook: ${outlook}. Details: ${link('/')}`;
  return dispatch(user, 'weekly_pulse', f.deltas.d30.endBalance, body, { bypassQuiet: force });
}

// ---------------- Queue flush ----------------
export async function flushQueue() {
  const due = db
    .prepare('SELECT * FROM queued_sms WHERE send_after <= ? ORDER BY send_after ASC')
    .all(new Date().toISOString());
  for (const q of due) {
    const user = getUser(q.user_id);
    if (!user || !user.phone_verified || !user.sms_opt_in) {
      db.prepare('DELETE FROM queued_sms WHERE id = ?').run(q.id);
      continue;
    }
    if (inQuietHours(user)) {
      db.prepare('UPDATE queued_sms SET send_after = ? WHERE id = ?').run(nextAllowedTime(user).toISOString(), q.id);
      continue;
    }
    const res = await sendSms(user.phone_number, q.body);
    logNotification(
      user,
      q.alert_type,
      q.projection_value,
      q.body,
      res.error ? 'error' : res.simulated ? 'simulated' : 'sent'
    );
    db.prepare('DELETE FROM queued_sms WHERE id = ?').run(q.id);
  }
  return due.length;
}

// ---------------- Cron entry points ----------------
export async function runDailyChecks() {
  for (const user of messagingUsers()) {
    try {
      await checkShortfall(user);
      await checkImprovement(user);
    } catch (err) {
      console.error('[notify] daily check failed for', user.id, err.message);
    }
  }
}
export async function runHourlyChecks() {
  await flushQueue();
  for (const user of messagingUsers()) {
    try {
      await checkWeeklyPulse(user);
    } catch (err) {
      console.error('[notify] weekly pulse failed for', user.id, err.message);
    }
  }
}

// Real-time reactor: called on any user data change (new/synced transaction).
export async function handleDataChange(userId) {
  const user = getUser(userId);
  if (!user || !user.phone_verified || !user.sms_opt_in || !user.phone_number) return;
  try {
    await checkBreach(user); // immediate threshold breach
    await checkImprovement(user); // outlook improved after new income/scenario
  } catch (err) {
    console.error('[notify] data-change check failed for', userId, err.message);
  }
}

// Test helper: force-build and send a given alert type immediately (for the
// "Send test" buttons in Settings). Bypasses cooldowns and quiet hours.
export async function sendTest(user, type) {
  switch (type) {
    case 'shortfall':
      return forceShortfall(user);
    case 'weekly_pulse':
      return checkWeeklyPulse(user, { force: true });
    case 'improvement':
      return checkImprovement(user, { force: true });
    case 'breach':
      return forceBreach(user);
    default:
      throw new Error('Unknown alert type');
  }
}
async function forceShortfall(user) {
  const f = loadUserForecast(user.id);
  // Use a real shortfall if present, else the deepest projected dip as a sample.
  let deficit, date, days;
  if (f.shortfall) {
    deficit = f.shortfall.deficitAmount;
    date = f.shortfall.date;
    days = f.shortfall.daysUntil;
  } else {
    const low = f.points.reduce((m, p) => (p.projectedBalance < m.projectedBalance ? p : m), f.points[0]);
    deficit = Math.max(500, (user.shortfall_threshold || 0) - low.projectedBalance);
    date = low.date;
    days = Math.round((new Date(low.date) - new Date()) / 86400000);
  }
  const cause = await smsBlurb('shortfall_cause', aiContext(f));
  const body = `⚠ CashFlow Alert: Projected to be ${money(deficit)} short by ${shortDate(date)} (${days} days). Main cause: ${cause}. View: ${link('/')}`;
  return dispatch(user, 'shortfall', deficit, body, { bypassQuiet: true });
}
async function forceBreach(user) {
  const f = loadUserForecast(user.id);
  const body = `🔴 Your balance just dropped below ${money(user.shortfall_threshold || 0)}. Current balance: ${money(f.balance)}. View: ${link('/')}`;
  return dispatch(user, 'breach', f.balance, body, { bypassQuiet: true });
}
