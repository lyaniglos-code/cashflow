// Pure-JS cash flow forecasting engine. No AI here — deterministic pattern
// detection and forward projection. Amounts are signed (+income, -expense).

const DAY = 1000 * 60 * 60 * 24;

function parseDate(s) {
  const d = new Date(s + 'T00:00:00');
  return d;
}
function fmt(d) {
  return d.toISOString().slice(0, 10);
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Normalize a description into a recurrence key (strip numbers/punctuation).
function normalizeKey(desc, category) {
  const base = desc
    .toLowerCase()
    .replace(/[0-9]+/g, '')
    .replace(/[^a-z& ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${category}::${base}`;
}

// Detect recurring patterns from historical transactions.
// Groups by normalized description+category, then infers cadence from the
// median gap between occurrences.
export function detectPatterns(transactions, { windowDays = 90, asOf = new Date() } = {}) {
  const cutoff = new Date(asOf.getTime() - windowDays * DAY);
  const recent = transactions.filter((t) => parseDate(t.date) >= cutoff);

  const groups = new Map();
  for (const t of recent) {
    const key = normalizeKey(t.description, t.category);
    if (!groups.has(key)) {
      groups.set(key, { key, category: t.category, label: t.description, items: [] });
    }
    groups.get(key).items.push(t);
  }

  const patterns = [];
  for (const g of groups.values()) {
    const items = g.items.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    if (items.length < 2) continue; // need at least 2 to call it recurring

    const dates = items.map((t) => parseDate(t.date).getTime());
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / DAY);
    }
    const medianGap = median(gaps);
    const avgAmount = items.reduce((s, t) => s + t.amount, 0) / items.length;

    // Classify cadence.
    let cadence;
    let periodDays;
    if (medianGap >= 1 && medianGap <= 3) {
      cadence = 'daily';
      periodDays = median(gaps.filter((x) => x <= 3)) || 1;
    } else if (medianGap >= 5 && medianGap <= 9) {
      cadence = 'weekly';
      periodDays = 7;
    } else if (medianGap >= 11 && medianGap <= 18) {
      cadence = 'biweekly';
      periodDays = 14;
    } else if (medianGap >= 26 && medianGap <= 35) {
      cadence = 'monthly';
      periodDays = 30;
    } else {
      continue; // irregular — handled by the one-off baseline instead
    }

    // Frequency gate: only trust a cadence if the item actually occurred often
    // enough for that cadence over the window. This prevents a sporadic event
    // (e.g. occasional catering) that happens to cluster from being mistaken for
    // a daily/weekly pattern and projected forward at full amount every period.
    // Low-frequency items fall through to the averaged one-off baseline instead.
    const expectedOccurrences = windowDays / periodDays;
    if (items.length < Math.max(2, 0.4 * expectedOccurrences)) {
      continue;
    }

    const lastDate = parseDate(items[items.length - 1].date);
    patterns.push({
      key: g.key,
      label: g.label,
      category: g.category,
      cadence,
      periodDays,
      avgAmount: round2(avgAmount),
      occurrences: items.length,
      lastDate,
      type: avgAmount >= 0 ? 'income' : 'expense',
    });
  }

  // Identify which transactions were "explained" by a pattern so the rest can
  // be averaged into a daily noise baseline.
  const explainedKeys = new Set(patterns.map((p) => p.key));
  const unexplained = recent.filter((t) => !explainedKeys.has(normalizeKey(t.description, t.category)));
  const unexplainedTotal = unexplained.reduce((s, t) => s + t.amount, 0);
  const dailyBaseline = round2(unexplainedTotal / windowDays);

  return { patterns, dailyBaseline };
}

// Sum all historical transactions to get the current cash balance.
export function currentBalance(transactions) {
  return round2(transactions.reduce((s, t) => s + t.amount, 0));
}

// Project the daily running balance forward `horizonDays` days.
// Optionally inject synthetic transactions (for scenario planning).
export function projectForward(
  transactions,
  { horizonDays = 90, threshold = 0, asOf = new Date(), injected = [] } = {}
) {
  const startBalance = currentBalance(transactions);
  const { patterns, dailyBaseline } = detectPatterns(transactions, { asOf });

  const start = new Date(asOf);
  start.setHours(0, 0, 0, 0);

  // Pre-index injected (scenario) flows by date for quick lookup.
  const injectedByDate = new Map();
  for (const inj of injected) {
    const key = inj.date;
    if (!injectedByDate.has(key)) injectedByDate.set(key, []);
    injectedByDate.get(key).push(inj);
  }

  const points = [];
  let balance = startBalance;

  for (let i = 1; i <= horizonDays; i++) {
    const day = new Date(start.getTime() + i * DAY);
    const dayStr = fmt(day);
    const dow = day.getDay();
    const dom = day.getDate();

    let income = 0;
    let expense = 0;

    // Apply each recurring pattern that "fires" on this day.
    for (const p of patterns) {
      let fires = false;
      if (p.cadence === 'daily') {
        // POS-style daily income: assume operating most days.
        fires = true;
      } else if (p.cadence === 'weekly') {
        fires = dow === p.lastDate.getDay();
      } else if (p.cadence === 'biweekly') {
        const daysSinceLast = Math.round((day - p.lastDate) / DAY);
        fires = daysSinceLast > 0 && daysSinceLast % 14 === 0;
      } else if (p.cadence === 'monthly') {
        fires = dom === p.lastDate.getDate();
      }
      if (fires) {
        if (p.avgAmount >= 0) income += p.avgAmount;
        else expense += Math.abs(p.avgAmount);
      }
    }

    // Daily noise baseline (one-off averaged flow).
    if (dailyBaseline >= 0) income += dailyBaseline;
    else expense += Math.abs(dailyBaseline);

    // Scenario injections for this date.
    const injected = injectedByDate.get(dayStr) || [];
    for (const inj of injected) {
      if (inj.amount >= 0) income += inj.amount;
      else expense += Math.abs(inj.amount);
    }

    const net = income - expense;
    balance = round2(balance + net);

    points.push({
      date: dayStr,
      projectedBalance: balance,
      income: round2(income),
      expense: round2(expense),
      net: round2(net),
    });
  }

  // Shortfall detection: first day balance drops below threshold (the "when"),
  // plus the worst point in the horizon (the "how bad") — an owner cares about
  // both how soon trouble starts and how deep it gets.
  let shortfall = null;
  let firstCross = null;
  for (const pt of points) {
    if (pt.projectedBalance < threshold) {
      firstCross = pt;
      break;
    }
  }
  if (firstCross) {
    // Find the lowest projected balance from the first crossing onward.
    let lowest = firstCross;
    for (const pt of points) {
      if (parseDate(pt.date) >= parseDate(firstCross.date) && pt.projectedBalance < lowest.projectedBalance) {
        lowest = pt;
      }
    }
    const daysUntil = Math.round((parseDate(firstCross.date) - start) / DAY);
    shortfall = {
      date: firstCross.date,
      daysUntil,
      projectedBalance: round2(firstCross.projectedBalance),
      // Headline deficit = the deepest the balance goes below the threshold.
      deficitAmount: round2(threshold - lowest.projectedBalance),
      lowestBalance: round2(lowest.projectedBalance),
      lowestDate: lowest.date,
      threshold,
    };
  }

  return { startBalance, points, patterns, dailyBaseline, shortfall };
}

// Income vs expense breakdown by category over the trailing window.
export function categoryBreakdown(transactions, { windowDays = 90, asOf = new Date() } = {}) {
  const cutoff = new Date(asOf.getTime() - windowDays * DAY);
  const recent = transactions.filter((t) => parseDate(t.date) >= cutoff);
  const map = new Map();
  for (const t of recent) {
    if (!map.has(t.category)) map.set(t.category, { category: t.category, income: 0, expense: 0 });
    const row = map.get(t.category);
    if (t.amount >= 0) row.income += t.amount;
    else row.expense += Math.abs(t.amount);
  }
  return [...map.values()]
    .map((r) => ({ category: r.category, income: round2(r.income), expense: round2(r.expense) }))
    .sort((a, b) => b.income + b.expense - (a.income + a.expense));
}

// Average net cash flow per 30 days over the trailing window (negative = burning).
export function burnRate(transactions, { windowDays = 90, asOf = new Date() } = {}) {
  const cutoff = new Date(asOf.getTime() - windowDays * DAY);
  const recent = transactions.filter((t) => parseDate(t.date) >= cutoff);
  const net = recent.reduce((s, t) => s + t.amount, 0);
  return round2((net / windowDays) * 30);
}

// Total income (positive amounts) over the trailing window.
export function trailingRevenue(transactions, { windowDays = 30, asOf = new Date() } = {}) {
  const cutoff = new Date(asOf.getTime() - windowDays * DAY);
  return round2(
    transactions.filter((t) => parseDate(t.date) >= cutoff && t.amount > 0).reduce((s, t) => s + t.amount, 0)
  );
}

// Runway: how long until cash runs low.
// Prefers the projection's first threshold crossing; otherwise extrapolates from
// burn rate; "growing" when the business is net cash-positive.
export function computeRunway({ balance, threshold = 0, monthlyNet = 0, shortfall = null }) {
  if (shortfall) {
    return {
      days: shortfall.daysUntil,
      months: round2(shortfall.daysUntil / 30),
      status: shortfall.daysUntil <= 45 ? 'short' : 'ok',
    };
  }
  if (monthlyNet >= 0) {
    return { days: null, months: null, status: 'growing' };
  }
  // Net negative but no threshold breach within the horizon: extrapolate.
  const dailyBurn = -monthlyNet / 30;
  const days = dailyBurn > 0 ? Math.round((balance - threshold) / dailyBurn) : null;
  return {
    days,
    months: days != null ? round2(days / 30) : null,
    status: days != null && days <= 120 ? 'ok' : 'healthy',
  };
}

// Aggregate 30/60/90-day net deltas from a projection's points.
export function horizonDeltas(points) {
  const at = (n) => {
    const slice = points.slice(0, n);
    const net = slice.reduce((s, p) => s + p.net, 0);
    const endBalance = slice.length ? slice[slice.length - 1].projectedBalance : 0;
    return { net: round2(net), endBalance: round2(endBalance) };
  };
  return { d30: at(30), d60: at(60), d90: at(90) };
}
