// Shared planning utilities used by both the Scenario Planner and the AI
// chatbot. Converts high-level "what-if" adjustments into synthetic
// transactions and runs them through the real forecast engine so every
// projected impact is statistically grounded (never AI-estimated).

import { loadUserForecast } from './routes/forecast.js';

const DAY = 1000 * 60 * 60 * 24;
const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (d) => d.toISOString().slice(0, 10);

// Supported adjustment shapes:
//   { type: 'hire',     monthlyAmount }                  -> recurring monthly expense
//   { type: 'contract', amount, date }                   -> one-off income
//   { type: 'recurring', amount, cadenceDays }           -> generic recurring flow (signed)
//   { type: 'oneoff',   amount, date }                   -> generic one-off (signed)
export function buildInjections(adjustments, horizonDays = 90) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const injected = [];

  for (const adj of adjustments || []) {
    if (adj.type === 'hire') {
      const monthly = -Math.abs(Number(adj.monthlyAmount) || 0);
      for (let m = 1; m <= Math.ceil(horizonDays / 30); m++) {
        const d = new Date(today.getTime() + m * 30 * DAY);
        if ((d - today) / DAY <= horizonDays) injected.push({ date: fmt(d), amount: monthly });
      }
    } else if (adj.type === 'contract') {
      const amount = Math.abs(Number(adj.amount) || 0);
      const d = adj.date ? new Date(adj.date + 'T00:00:00') : new Date(today.getTime() + 30 * DAY);
      injected.push({ date: fmt(d), amount });
    } else if (adj.type === 'recurring') {
      const amount = Number(adj.amount) || 0;
      const cadence = Math.max(1, Number(adj.cadenceDays) || 30);
      for (let day = cadence; day <= horizonDays; day += cadence) {
        const d = new Date(today.getTime() + day * DAY);
        injected.push({ date: fmt(d), amount });
      }
    } else if (adj.type === 'oneoff') {
      const amount = Number(adj.amount) || 0;
      const d = adj.date ? new Date(adj.date + 'T00:00:00') : new Date(today.getTime() + 30 * DAY);
      injected.push({ date: fmt(d), amount });
    }
  }
  return injected;
}

// Run a set of adjustments through the forecast engine and return baseline vs
// scenario, merged charting points, and the headline 90-day delta.
export function computePlanImpact(userId, adjustments, { horizonDays = 90 } = {}) {
  const baseline = loadUserForecast(userId, { horizonDays });
  const injected = buildInjections(adjustments, horizonDays);
  const scenario = loadUserForecast(userId, { horizonDays, injected });

  const points = baseline.points.map((p, i) => ({
    date: p.date,
    baseline: p.projectedBalance,
    scenario: scenario.points[i] ? scenario.points[i].projectedBalance : p.projectedBalance,
  }));

  return {
    points,
    threshold: baseline.threshold,
    baseline: {
      endBalance: baseline.deltas.d90.endBalance,
      deltas: baseline.deltas,
      shortfall: baseline.shortfall,
    },
    scenario: {
      endBalance: scenario.deltas.d90.endBalance,
      deltas: scenario.deltas,
      shortfall: scenario.shortfall,
    },
    delta90: round2(scenario.deltas.d90.endBalance - baseline.deltas.d90.endBalance),
  };
}
