export function money(n, { cents = false } = {}) {
  if (n == null || isNaN(n)) return '$0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })}`;
}

export function shortDate(s) {
  if (!s) return '';
  const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function longDate(s) {
  if (!s) return '';
  const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function pct(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return `${n.toFixed(d)}%`;
}

// "2026-06" -> "Jun '26"
export function monthLabel(m) {
  if (!m) return '';
  const d = new Date(`${m}-01T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', " '");
}
