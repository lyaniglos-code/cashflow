import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { computePlanImpact } from '../planning.js';

const router = Router();
router.use(requireAuth);

// Real-time what-if: run adjustments through the forecast engine and return
// baseline vs scenario for charting. Shares the exact engine the AI planner and
// saved Action Plans use, so numbers are consistent everywhere.
router.post('/simulate', (req, res) => {
  const { adjustments } = req.body || {};
  const impact = computePlanImpact(req.userId, adjustments || [], { horizonDays: 90 });
  res.json(impact);
});

export default router;
