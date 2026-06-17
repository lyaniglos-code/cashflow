import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { computeMetrics } from '../metrics.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const user = db.prepare('SELECT business_name, business_type FROM users WHERE id = ?').get(req.userId);
  const transactions = db
    .prepare('SELECT date, description, amount, category FROM transactions WHERE user_id = ? ORDER BY date ASC')
    .all(req.userId);
  const metrics = computeMetrics(transactions);
  res.json({
    business: { name: user?.business_name || '', type: user?.business_type || '' },
    transactionCount: transactions.length,
    ...metrics,
  });
});

export default router;
