import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../auth.js';
import { loadUserForecast, aiContext } from './forecast.js';
import { generateNarrative, generateRecommendations, explainShortfall, chatPlanner, aiEnabled } from '../anthropic.js';
import { computePlanImpact } from '../planning.js';

const router = Router();
router.use(requireAuth);

// Simple in-memory cache keyed by user + a hash of the financial context, so a
// dashboard reload doesn't re-spend tokens when the underlying data is unchanged.
const cache = new Map(); // key -> { value, expires }
const TTL_MS = 10 * 60 * 1000;

function ctxHash(ctx) {
  const h = crypto.createHash('sha1');
  h.update(JSON.stringify(ctx));
  return h.digest('hex').slice(0, 16);
}

async function cached(key, producer) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await producer();
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

// Evict expired entries periodically so the cache can't grow unbounded over the
// process lifetime. `unref()` keeps this timer from holding the process open.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expires <= now) cache.delete(k);
  }
}, TTL_MS).unref();

router.get('/status', (req, res) => {
  res.json({ aiEnabled: aiEnabled() });
});

router.get('/summary', async (req, res) => {
  const f = loadUserForecast(req.userId);
  const ctx = aiContext(f);
  const key = `summary:${req.userId}:${ctxHash(ctx)}`;
  try {
    const result = await cached(key, () => generateNarrative(ctx));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

router.get('/recommendations', async (req, res) => {
  const f = loadUserForecast(req.userId);
  const ctx = aiContext(f);
  const key = `recs:${req.userId}:${ctxHash(ctx)}`;
  try {
    const result = await cached(key, () => generateRecommendations(ctx));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Planning chatbot: clarifies recommendations and builds engine-grounded plans.
router.post('/chat', async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];
  const f = loadUserForecast(req.userId);
  const ctx = aiContext(f);
  // Reuse the cached recommendations so the assistant can reference them.
  try {
    const recKey = `recs:${req.userId}:${ctxHash(ctx)}`;
    const recResult = await cached(recKey, () => generateRecommendations(ctx));
    ctx.recommendations = recResult.items || [];
  } catch {
    ctx.recommendations = [];
  }
  const runImpact = (adjustments) => computePlanImpact(req.userId, adjustments, { horizonDays: 90 });
  try {
    const result = await chatPlanner(messages, ctx, runImpact);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

router.get('/shortfall', async (req, res) => {
  const f = loadUserForecast(req.userId);
  const ctx = aiContext(f);
  if (!ctx.shortfall) return res.json({ text: '', source: 'none' });
  const key = `shortfall:${req.userId}:${ctxHash(ctx)}`;
  try {
    const result = await cached(key, () => explainShortfall(ctx));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

export default router;
