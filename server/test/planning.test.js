import { describe, it, expect } from 'vitest';
import { buildInjections } from '../src/planning.js';

const iso = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

describe('planning: buildInjections', () => {
  it('expands a hire into recurring monthly expenses', () => {
    const inj = buildInjections([{ type: 'hire', monthlyAmount: 4000 }], 90);
    expect(inj).toHaveLength(3); // ~3 months in 90 days
    expect(inj.every((i) => i.amount === -4000)).toBe(true);
  });

  it('adds a one-off contract as positive income on the given date', () => {
    const date = iso(20);
    const inj = buildInjections([{ type: 'contract', amount: 9000, date }], 90);
    expect(inj).toHaveLength(1);
    expect(inj[0]).toEqual({ date, amount: 9000 });
  });

  it('expands a recurring change at the given cadence', () => {
    const inj = buildInjections([{ type: 'recurring', amount: -300, cadenceDays: 7 }], 90);
    expect(inj.length).toBeGreaterThanOrEqual(12);
    expect(inj.every((i) => i.amount === -300)).toBe(true);
  });

  it('passes a generic one-off through with its sign', () => {
    const date = iso(10);
    const inj = buildInjections([{ type: 'oneoff', amount: -500, date }], 90);
    expect(inj).toEqual([{ date, amount: -500 }]);
  });

  it('returns nothing for an empty adjustment list', () => {
    expect(buildInjections([], 90)).toEqual([]);
    expect(buildInjections(undefined, 90)).toEqual([]);
  });
});
