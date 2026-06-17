import crypto from 'crypto';

// AES-256-GCM encryption for secrets at rest (Plaid access tokens).
// Key: ENCRYPTION_KEY (32-byte hex/base64 or any string -> hashed to 32 bytes),
// falling back to a SHA-256 of JWT_SECRET so the app works without extra config.
function getKey() {
  const raw = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
  return crypto.createHash('sha256').update(raw).digest(); // 32 bytes
}

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store iv:tag:ciphertext, all base64
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(payload) {
  const [ivB64, tagB64, dataB64] = String(payload).split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
