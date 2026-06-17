import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { computePlanImpact } from '../planning.js';

const router = Router();
router.use(requireAuth);

function serialize(row) {
  return {
    id: row.id,
    title: row.title,
    rationale: row.rationale,
    adjustments: JSON.parse(row.adjustments || '[]'),
    impact: JSON.parse(row.impact || '{}'),
    createdAt: row.created_at,
  };
}

// List saved action plans (newest first).
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json({ plans: rows.map(serialize) });
});

// Save a plan. The server recomputes the impact from the adjustments so a saved
// plan's projected numbers are always engine-grounded and current.
router.post('/', (req, res) => {
  const { title, rationale, adjustments } = req.body || {};
  if (!title || !Array.isArray(adjustments) || adjustments.length === 0) {
    return res.status(400).json({ error: 'title and at least one adjustment are required' });
  }
  const impact = computePlanImpact(req.userId, adjustments, { horizonDays: 90 });
  const id = nanoid();
  db.prepare(
    `INSERT INTO plans (id, user_id, title, rationale, adjustments, impact)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.userId,
    String(title).slice(0, 200),
    String(rationale || '').slice(0, 2000),
    JSON.stringify(adjustments),
    JSON.stringify(impact)
  );
  const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
  res.json({ plan: serialize(row) });
});

// Recompute a plan's impact against current data (used by "Apply" overlays).
router.get('/:id/impact', (req, res) => {
  const row = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Plan not found' });
  const impact = computePlanImpact(req.userId, JSON.parse(row.adjustments || '[]'), { horizonDays: 90 });
  res.json({ impact });
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM plans WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ deleted: info.changes });
});

export default router;
