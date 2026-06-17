import { describe, it, expect } from 'vitest';
import { inQuietHours, nextAllowedTime, tzParts } from '../src/time.js';

const user = (over = {}) => ({ timezone: 'UTC', quiet_start: '21:00', quiet_end: '08:00', ...over });

describe('time: inQuietHours (overnight window 21:00–08:00)', () => {
  it('is quiet late at night and early morning', () => {
    expect(inQuietHours(user(), new Date('2025-06-01T23:00:00Z'))).toBe(true);
    expect(inQuietHours(user(), new Date('2025-06-01T07:00:00Z'))).toBe(true);
  });
  it('is not quiet midday', () => {
    expect(inQuietHours(user(), new Date('2025-06-01T12:00:00Z'))).toBe(false);
  });
  it('treats quiet_end as exclusive', () => {
    expect(inQuietHours(user(), new Date('2025-06-01T08:00:00Z'))).toBe(false);
  });
});

describe('time: inQuietHours (same-day window 09:00–17:00)', () => {
  const u = user({ quiet_start: '09:00', quiet_end: '17:00' });
  it('is quiet within the window only', () => {
    expect(inQuietHours(u, new Date('2025-06-01T12:00:00Z'))).toBe(true);
    expect(inQuietHours(u, new Date('2025-06-01T18:00:00Z'))).toBe(false);
    expect(inQuietHours(u, new Date('2025-06-01T08:00:00Z'))).toBe(false);
  });
});

describe('time: nextAllowedTime', () => {
  it('returns quiet_end tomorrow when already past it', () => {
    const next = nextAllowedTime(user(), new Date('2025-06-01T23:00:00Z'));
    expect(next.toISOString()).toBe('2025-06-02T08:00:00.000Z');
  });
  it('returns quiet_end today when before it', () => {
    const next = nextAllowedTime(user(), new Date('2025-06-01T02:00:00Z'));
    expect(next.toISOString()).toBe('2025-06-01T08:00:00.000Z');
  });
});

describe('time: tzParts', () => {
  it('extracts weekday and hour in the target timezone', () => {
    const p = tzParts(new Date('2025-06-02T08:30:00Z'), 'UTC'); // a Monday
    expect(p.weekday).toBe('Mon');
    expect(p.hour).toBe(8);
    expect(p.minute).toBe(30);
  });
});
