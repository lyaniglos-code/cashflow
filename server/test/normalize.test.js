import { describe, it, expect } from 'vitest';
import { normalizeAmount, normalizeDate } from '../src/routes/transactions.js';

describe('csv: normalizeAmount', () => {
  it('strips currency formatting', () => {
    expect(normalizeAmount('$1,234.50')).toBe(1234.5);
  });
  it('treats parentheses as negative', () => {
    expect(normalizeAmount('(500)')).toBe(-500);
  });
  it('handles plain negatives and integers', () => {
    expect(normalizeAmount('-42')).toBe(-42);
    expect(normalizeAmount('99')).toBe(99);
  });
  it('returns NaN for junk', () => {
    expect(Number.isNaN(normalizeAmount('abc'))).toBe(true);
    expect(Number.isNaN(normalizeAmount(null))).toBe(true);
  });
});

describe('csv: normalizeDate', () => {
  it('passes through ISO dates', () => {
    expect(normalizeDate('2026-06-15')).toBe('2026-06-15');
  });
  it('converts M/D/YYYY', () => {
    expect(normalizeDate('6/15/2026')).toBe('2026-06-15');
  });
  it('expands 2-digit years and pads', () => {
    expect(normalizeDate('06/05/26')).toBe('2026-06-05');
  });
  it('returns null for empty', () => {
    expect(normalizeDate('')).toBeNull();
  });
});
