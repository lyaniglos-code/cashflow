import { describe, it, expect } from 'vitest';
import { monthlySeries, breakEven, expenseDonut } from '../src/metrics.js';

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

describe('metrics: monthlySeries', () => {
  it('computes revenue/COGS/operating, margins, and net cash flow incl. financing', () => {
    const txns = [
      { date: '2025-01-05', description: 'POS deposit', amount: 10000, category: 'POS Income' },
      { date: '2025-01-10', description: 'Sysco food order', amount: -3000, category: 'Food Costs' },
      { date: '2025-01-12', description: 'Monthly rent', amount: -2000, category: 'Rent' },
      { date: '2025-01-15', description: 'Payroll', amount: -1000, category: 'Payroll' },
      { date: '2025-01-20', description: 'Owner capital contribution', amount: 5000, category: 'Owner Equity' },
    ];
    const rows = monthlySeries(txns);
    const jan = rows.find((r) => r.month === '2025-01');
    expect(jan.revenue).toBe(10000);
    expect(jan.cogs).toBe(3000);
    expect(jan.operating).toBe(3000); // rent + payroll
    expect(jan.grossProfit).toBe(7000);
    expect(jan.operatingIncome).toBe(4000);
    expect(jan.netIncome).toBe(4000);
    expect(jan.netCashFlow).toBe(9000); // + owner financing inflow
    expect(jan.grossMargin).toBe(70);
    expect(jan.operatingMargin).toBe(40);
    expect(jan.netMargin).toBe(40);
  });
});

describe('metrics: breakEven', () => {
  it('computes contribution margin and break-even revenue', () => {
    const txns = [
      { date: daysAgo(10), description: 'sales', amount: 10000, category: 'POS Income' },
      { date: daysAgo(10), description: 'food order', amount: -4000, category: 'Food Costs' }, // variable
      { date: daysAgo(10), description: 'rent', amount: -2000, category: 'Rent' }, // fixed
    ];
    const be = breakEven(txns);
    expect(be.variableRatio).toBeCloseTo(0.4, 5);
    expect(be.contributionMargin).toBe(60);
    expect(be.breakEvenRevenue).toBeCloseTo(3333.33, 1); // 2000 / 0.6
    expect(be.aboveBreakEven).toBe(true);
  });
});

describe('metrics: expenseDonut', () => {
  it('breaks expenses down as a share of income', () => {
    const txns = [
      { date: daysAgo(5), description: 'sales', amount: 10000, category: 'POS Income' },
      { date: daysAgo(5), description: 'food', amount: -3000, category: 'Food Costs' },
      { date: daysAgo(5), description: 'rent', amount: -2000, category: 'Rent' },
    ];
    const d = expenseDonut(txns);
    expect(d.income).toBe(10000);
    expect(d.totalExpense).toBe(5000);
    expect(d.kept).toBe(5000);
    const food = d.slices.find((s) => s.category === 'Food Costs');
    expect(food.pctOfIncome).toBe(30);
  });
});
