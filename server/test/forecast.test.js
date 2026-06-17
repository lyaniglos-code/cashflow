import { describe, it, expect } from 'vitest';
import {
  currentBalance,
  detectPatterns,
  projectForward,
  burnRate,
  trailingRevenue,
  computeRunway,
  categoryBreakdown,
} from '../src/forecast.js';

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

describe('forecast: currentBalance', () => {
  it('sums signed amounts', () => {
    const txns = [
      { date: daysAgo(1), description: 'a', amount: 1000, category: 'Income' },
      { date: daysAgo(2), description: 'b', amount: -250, category: 'Rent' },
    ];
    expect(currentBalance(txns)).toBe(750);
  });
});

describe('forecast: detectPatterns', () => {
  it('detects weekly and monthly recurrences, ignores sporadic & clustered items', () => {
    const txns = [];
    // weekly expense (13 occurrences, gap 7) -> weekly
    for (let i = 0; i <= 84; i += 7) txns.push({ date: daysAgo(i), description: 'Weekly supplier', amount: -700, category: 'Food Costs' });
    // monthly expense (4 occurrences, gap 30) -> monthly
    for (let i = 0; i <= 90; i += 30) txns.push({ date: daysAgo(i), description: 'Monthly rent', amount: -2000, category: 'Rent' });
    // sporadic income (2 occurrences, large gap) -> NOT a pattern
    txns.push({ date: daysAgo(3), description: 'Catering gig', amount: 5000, category: 'Catering Income' });
    txns.push({ date: daysAgo(50), description: 'Catering gig', amount: 5000, category: 'Catering Income' });
    // clustered 3-day "fake daily" -> must be excluded by the frequency gate
    for (let i = 0; i <= 2; i += 1) txns.push({ date: daysAgo(i), description: 'Blip charge', amount: -90, category: 'Misc' });

    const { patterns } = detectPatterns(txns);
    const byCadence = (c) => patterns.filter((p) => p.cadence === c);

    expect(byCadence('weekly').some((p) => p.label === 'Weekly supplier')).toBe(true);
    expect(byCadence('monthly').some((p) => p.label === 'Monthly rent')).toBe(true);
    expect(patterns.some((p) => p.label === 'Catering gig')).toBe(false); // sporadic
    expect(patterns.some((p) => p.label === 'Blip charge')).toBe(false); // frequency gate
    expect(byCadence('weekly')[0].type).toBe('expense');
  });
});

describe('forecast: projectForward', () => {
  it('projects 90 points and flags a shortfall when cash trends negative', () => {
    const txns = [{ date: daysAgo(150), description: 'Opening', amount: 20000, category: 'Owner Equity' }];
    // weekly burn, no income -> declining balance
    for (let i = 0; i <= 84; i += 7) txns.push({ date: daysAgo(i), description: 'Weekly burn', amount: -1500, category: 'Payroll' });

    const proj = projectForward(txns, { horizonDays: 90, threshold: 0 });
    expect(proj.points).toHaveLength(90);
    expect(proj.shortfall).toBeTruthy();
    expect(proj.shortfall.daysUntil).toBeGreaterThan(0);
    expect(proj.shortfall.projectedBalance).toBeLessThan(0);
  });

  it('reports no shortfall for a cash-positive business', () => {
    const txns = [];
    for (let i = 0; i <= 88; i += 1) txns.push({ date: daysAgo(i), description: 'Daily sales', amount: 500, category: 'POS Income' });
    for (let i = 0; i <= 84; i += 7) txns.push({ date: daysAgo(i), description: 'Weekly supplier', amount: -300, category: 'Food Costs' });
    const proj = projectForward(txns, { horizonDays: 90, threshold: 0 });
    expect(proj.shortfall).toBeNull();
  });
});

describe('forecast: KPIs', () => {
  it('burnRate is negative when spending exceeds income; revenue sums positives', () => {
    const txns = [];
    for (let i = 0; i <= 29; i += 1) txns.push({ date: daysAgo(i), description: 'sales', amount: 100, category: 'POS Income' });
    for (let i = 0; i <= 29; i += 1) txns.push({ date: daysAgo(i), description: 'spend', amount: -200, category: 'Rent' });
    expect(burnRate(txns)).toBeLessThan(0);
    expect(trailingRevenue(txns)).toBe(3000); // 30 * 100
  });

  it('computeRunway classifies growing / short / extrapolated', () => {
    expect(computeRunway({ balance: 1000, monthlyNet: 500 }).status).toBe('growing');
    expect(computeRunway({ balance: 1000, monthlyNet: -500, shortfall: { daysUntil: 20, deficitAmount: 1, projectedBalance: -1 } }).status).toBe('short');
    const r = computeRunway({ balance: 9000, threshold: 0, monthlyNet: -3000 });
    expect(r.days).toBe(90); // 9000 / (3000/30)
  });
});

describe('forecast: categoryBreakdown', () => {
  it('aggregates income and expense per category', () => {
    const txns = [
      { date: daysAgo(1), description: 'x', amount: 1000, category: 'POS Income' },
      { date: daysAgo(1), description: 'y', amount: -400, category: 'Rent' },
      { date: daysAgo(2), description: 'z', amount: -100, category: 'Rent' },
    ];
    const rows = categoryBreakdown(txns);
    const rent = rows.find((r) => r.category === 'Rent');
    expect(rent.expense).toBe(500);
  });
});
