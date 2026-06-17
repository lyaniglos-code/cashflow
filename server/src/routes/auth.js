import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from '../auth.js';

const router = Router();

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    businessName: u.business_name,
    businessType: u.business_type,
    industryVertical: u.industry_vertical,
    shortfallThreshold: u.shortfall_threshold,
  };
}

router.post('/register', (req, res) => {
  const { email, password, businessName, businessType, industryVertical } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  const id = nanoid();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, business_name, business_type, industry_vertical, shortfall_threshold)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    email.toLowerCase(),
    hashPassword(password),
    businessName || '',
    businessType || '',
    industryVertical || '',
    0
  );
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

router.patch('/profile', requireAuth, (req, res) => {
  const { businessName, businessType, industryVertical, shortfallThreshold } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare(
    `UPDATE users SET business_name = ?, business_type = ?, industry_vertical = ?, shortfall_threshold = ? WHERE id = ?`
  ).run(
    businessName ?? user.business_name,
    businessType ?? user.business_type,
    industryVertical ?? user.industry_vertical,
    shortfallThreshold ?? user.shortfall_threshold,
    req.userId
  );
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ user: publicUser(updated) });
});

export default router;
