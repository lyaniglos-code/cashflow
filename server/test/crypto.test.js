import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../src/crypto.js';

describe('crypto: AES-256-GCM round trip', () => {
  it('decrypts what it encrypts', () => {
    const secret = 'access-sandbox-abc123-DEF456-token';
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encrypt('same input');
    const b = encrypt('same input');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same input');
    expect(decrypt(b)).toBe('same input');
  });

  it('handles unicode and long values', () => {
    const v = '💸 token with — unicode and a long tail '.repeat(20);
    expect(decrypt(encrypt(v))).toBe(v);
  });
});
