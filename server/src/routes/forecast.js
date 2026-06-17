import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import {
  projectForward,
  categoryBreakdown,
  horizonDeltas,
  burnRate,
  trailingRevenue,
  computeRunway,
} from '../forecast.js';

const router = Router();
router.use(requireAuth);

// Shared loader: pull a user's profile + transactions and run the projection.
// Reused by the AI, scenarios, and digest routes.
export function loadUserForecast(userId, { injected = [], horizonDays = 90 } = {}) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const transactions = db
    .prepare('SELECT date, description, amount, category FROM transactions WHERE user_id = ? ORDER BY date ASC')
    .all(userId);

  const threshold = user?.shortfall_threshold ?? 0;
  const projection = projectForward(transactions, { horizonDays, threshold, injected });
  const breakdown = categoryBreakdown(transactions);
  const deltas = horizonDeltas(projection.points);

  const profile = {
    business_name: user?.business_name || '',
    business_type: user?.business_type || '',
    industry_vertical: user?.industry_vertical || '',
  };

  // Headline KPIs.
  const monthlyBurn = burnRate(transactions);
  const revenue = trailingRevenue(transactions);
  const runway = computeRunway({
    balance: projection.startBalance,
    threshold,
    monthlyNet: monthlyBurn,
    shortfall: projection.shortfall,
    horizonDays,
  });
  const kpis = {
    cashPosition: projection.startBalance,
    burnRate: monthlyBurn, // signed: negative = burning cash, positive = net gaining
    revenue,
    runway,
  };

  return {
    profile,
    threshold,
    transactionCount: transactions.length,
    balance: projection.startBalance,
    points: projection.points,
    patterns: projection.patterns,
    breakdown,
    deltas,
    shortfall: projection.shortfall,
    kpis,
  };
}

// Build the compact context object the AI layer consumes.
export function aiContext(f) {
  return {
    profile: f.profile,
    balance: f.balance,
    deltas: f.deltas,
    breakdown: f.breakdown,
    patterns: f.patterns,
    shortfall: f.shortfall,
    kpis: f.kpis,
  };
}

router.get('/dashboard', (req, res) => {
  const f = loadUserForecast(req.userId);
  res.json({
    profile: f.profile,
    business: { name: f.profile.business_name, type: f.profile.business_type, industry: f.profile.industry_vertical },
    kpis: f.kpis,
    threshold: f.threshold,
    transactionCount: f.transactionCount,
    currentBalance: f.balance,
    points: f.points,
    patterns: f.patterns.map((p) => ({
      label: p.label,
      category: p.category,
      cadence: p.cadence,
      avgAmount: p.avgAmount,
      type: p.type,
      occurrences: p.occurrences,
    })),
    breakdown: f.breakdown,
    deltas: f.deltas,
    shortfall: f.shortfall,
  });
});

export default router;
