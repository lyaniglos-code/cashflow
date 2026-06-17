// Pure timezone / quiet-hours helpers used by the notification engine. Kept
// dependency-free (no DB, no env) so they're easy to unit-test in isolation.

export function tzParts(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'America/New_York',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  let hour = parseInt(p.hour, 10);
  if (hour === 24) hour = 0;
  const offsetMin = (Date.UTC(+p.year, +p.month - 1, +p.day, hour, +p.minute, +p.second) - date.getTime()) / 60000;
  return { weekday: p.weekday, year: +p.year, month: +p.month, day: +p.day, hour, minute: +p.minute, offsetMin };
}

const hhmm = (s) => {
  const [h, m] = String(s || '0:0')
    .split(':')
    .map(Number);
  return { h: h || 0, m: m || 0 };
};
const minOfDay = (h, m) => h * 60 + m;

// True if `date` falls within the user's quiet-hours window (handles overnight
// windows like 21:00–08:00), evaluated in the user's timezone.
export function inQuietHours(user, date = new Date()) {
  const { hour, minute } = tzParts(date, user.timezone);
  const now = minOfDay(hour, minute);
  const s = hhmm(user.quiet_start || '21:00');
  const e = hhmm(user.quiet_end || '08:00');
  const start = minOfDay(s.h, s.m);
  const end = minOfDay(e.h, e.m);
  if (start === end) return false;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end; // overnight window
}

// The next moment (UTC Date) at which quiet hours end for this user.
export function nextAllowedTime(user, date = new Date()) {
  const e = hhmm(user.quiet_end || '08:00');
  const p = tzParts(date, user.timezone);
  const nowLocal = minOfDay(p.hour, p.minute);
  const target = minOfDay(e.h, e.m);
  let utc = Date.UTC(p.year, p.month - 1, p.day, e.h, e.m, 0) - p.offsetMin * 60000;
  if (nowLocal >= target) utc += 24 * 3600 * 1000; // quiet_end is tomorrow
  return new Date(utc);
}
