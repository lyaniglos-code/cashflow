import { Router } from 'express';
import { verifyToken } from '../auth.js';
import { onRefresh } from '../bus.js';

const router = Router();

// Server-Sent Events: the dashboard subscribes here and re-fetches whenever the
// user's data changes (e.g. a Plaid sync). Auth is via ?token= because the
// browser EventSource API can't set an Authorization header.
router.get('/', (req, res) => {
  const payload = verifyToken(req.query.token);
  if (!payload) return res.status(401).end();
  const userId = payload.sub;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: connected\ndata: {}\n\n`);

  const unsubscribe = onRefresh(userId, (data) => {
    res.write(`event: refresh\ndata: ${JSON.stringify(data || {})}\n\n`);
  });

  // Heartbeat so proxies and the browser keep the connection open.
  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

export default router;
