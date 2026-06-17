import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { loadUserForecast, aiContext } from './forecast.js';
import { generateRecommendations, generateNarrative } from '../anthropic.js';

const router = Router();
router.use(requireAuth);

function money(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

// Weekly digest: top-3 plain-English insights for an email-style report.
router.get('/', async (req, res) => {
  const f = loadUserForecast(req.userId);
  const ctx = aiContext(f);

  // Build 3 data-driven insight headlines (deterministic), then let the AI
  // recommendations enrich the body.
  const insights = [];

  insights.push({
    title: 'Cash position',
    body: `You're holding ${money(f.balance)} in cash today. Over the next 30 days the projection shows a net change of ${money(f.deltas.d30.net)}, ending near ${money(f.deltas.d30.endBalance)}.`,
  });

  if (f.shortfall) {
    insights.push({
      title: 'Heads up: projected shortfall',
      body: `Cash is projected to drop below your ${money(f.threshold)} threshold on ${f.shortfall.date} — that's ${f.shortfall.daysUntil} days out, a deficit of ${money(f.shortfall.deficitAmount)}. Plan a buffer before then.`,
    });
  } else {
    const topIncome = [...f.breakdown].sort((a, b) => b.income - a.income)[0];
    insights.push({
      title: 'No shortfall on the horizon',
      body: `No cash crunch is projected in the next 90 days. Your strongest income source is ${topIncome ? topIncome.category : 'sales'} — consider routing surplus into a reserve.`,
    });
  }

  const topExpense = [...f.breakdown].sort((a, b) => b.expense - a.expense)[0];
  if (topExpense) {
    insights.push({
      title: 'Biggest cost to watch',
      body: `${topExpense.category} is your largest expense category at ${money(topExpense.expense)} over the last 90 days. A small reduction here has an outsized effect on cash.`,
    });
  }

  // Enrich with AI narrative + recommendations (graceful fallback inside).
  let narrative = null;
  let recommendations = [];
  try {
    const n = await generateNarrative(ctx);
    narrative = n.text;
  } catch {
    /* ignore — narrative optional */
  }
  try {
    const r = await generateRecommendations(ctx);
    recommendations = r.items || [];
  } catch {
    /* ignore — recs optional */
  }

  res.json({
    generatedAt: new Date().toISOString(),
    businessName: f.profile.business_name,
    insights: insights.slice(0, 3),
    narrative,
    recommendations,
  });
});

export default router;
