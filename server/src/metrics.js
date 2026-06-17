// Derived financial metrics computed from a user's transactions (cash-basis).
// We can't see true accrual accounting (no invoices/AR-AP), so margins and the
// COGS/operating/financing split are derived from category heuristics. Amounts
// are signed: positive = income, negative = expense.

const DAY = 1000 * 60 * 60 * 24;
const round2 = (n) => Math.round(n * 100) / 100;
const round1 = (n) => Math.round(n * 10) / 10;

// Keyword buckets for classifying a transaction.
const FINANCING_KEYS = [
  'owner equity',
  'capital contribution',
  'opening cash',
  'loan',
  'investor',
  'dividend',
  'distribution',
  'owner draw',
];
const COGS_KEYS = [
  'food',
  'liquor',
  'beverage',
  'inventory',
  'produce',
  'dairy',
  'supplies',
  'materials',
  'merchandise',
  'cost of goods',
  'ingredient',
  'wholesale',
];
// Variable costs scale with sales; fixed costs don't.
const VARIABLE_KEYS = [
  ...COGS_KEYS,
  'merchant',
  'processing',
  'commission',
  'packaging',
  'shipping',
  'marketing',
  'ads',
];

function text(t) {
  return `${t.category || ''} ${t.description || ''}`.toLowerCase();
}
function classify(t) {
  const s = text(t);
  if (FINANCING_KEYS.some((k) => s.includes(k))) return 'financing';
  if (COGS_KEYS.some((k) => s.includes(k))) return 'cogs';
  return 'operating';
}
function isVariable(t) {
  const s = text(t);
  return VARIABLE_KEYS.some((k) => s.includes(k));
}

function parseDate(s) {
  return new Date(s + 'T00:00:00');
}
function monthKey(date) {
  return String(date).slice(0, 7); // YYYY-MM
}

// Monthly P&L-style series: revenue, COGS, operating overhead, gross/operating/
// net income, margins, and operating cash flow (operations only — excludes
// financing such as debt service and owner draws).
export function monthlySeries(transactions, { maxMonths = 24 } = {}) {
  const map = new Map();
  for (const t of transactions) {
    const m = monthKey(t.date);
    if (!map.has(m)) map.set(m, { month: m, revenue: 0, cogs: 0, operating: 0, financingOut: 0, financingIn: 0 });
    const row = map.get(m);
    const cls = classify(t);
    if (t.amount >= 0) {
      if (cls === 'financing') row.financingIn += t.amount;
      else row.revenue += t.amount;
    } else {
      const v = -t.amount;
      if (cls === 'financing') row.financingOut += v;
      else if (cls === 'cogs') row.cogs += v;
      else row.operating += v;
    }
  }

  let rows = [...map.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
  rows = rows.slice(-maxMonths);

  for (const r of rows) {
    r.revenue = round2(r.revenue);
    r.cogs = round2(r.cogs);
    r.operating = round2(r.operating);
    r.financingOut = round2(r.financingOut);
    r.financingIn = round2(r.financingIn);
    r.grossProfit = round2(r.revenue - r.cogs);
    r.operatingIncome = round2(r.grossProfit - r.operating); // = operating cash flow (ops only)
    r.operatingCashFlow = r.operatingIncome;
    r.netIncome = round2(r.operatingIncome - r.financingOut); // profit after debt service / financing
    // Actual change in the bank balance this month — includes financing flows
    // (owner contributions, loans). Diverges from profit when cash moves for
    // non-profit reasons.
    r.netCashFlow = round2(r.netIncome + r.financingIn);
    r.grossMargin = r.revenue > 0 ? round1((r.grossProfit / r.revenue) * 100) : null;
    r.operatingMargin = r.revenue > 0 ? round1((r.operatingIncome / r.revenue) * 100) : null;
    r.netMargin = r.revenue > 0 ? round1((r.netIncome / r.revenue) * 100) : null;
  }
  return rows;
}

// Expense breakdown over a trailing window, as a share of income (where every
// dollar of revenue goes), with a "Kept (net income)" slice for the remainder.
export function expenseDonut(transactions, { windowDays = 90, asOf = new Date() } = {}) {
  const cutoff = new Date(asOf.getTime() - windowDays * DAY);
  const recent = transactions.filter((t) => parseDate(t.date) >= cutoff);

  let income = 0;
  const byCat = new Map();
  for (const t of recent) {
    const cls = classify(t);
    if (cls === 'financing') continue; // exclude owner equity / loans from the operating picture
    if (t.amount >= 0) income += t.amount;
    else {
      const cat = t.category || 'Other';
      byCat.set(cat, (byCat.get(cat) || 0) + -t.amount);
    }
  }
  income = round2(income);

  let slices = [...byCat.entries()].map(([category, amount]) => ({
    category,
    amount: round2(amount),
    pctOfIncome: income > 0 ? round1((amount / income) * 100) : 0,
  }));
  slices.sort((a, b) => b.amount - a.amount);

  // Collapse the long tail into "Other".
  if (slices.length > 7) {
    const head = slices.slice(0, 6);
    const tail = slices.slice(6);
    const otherAmt = round2(tail.reduce((s, x) => s + x.amount, 0));
    head.push({ category: 'Other', amount: otherAmt, pctOfIncome: income > 0 ? round1((otherAmt / income) * 100) : 0 });
    slices = head;
  }

  const totalExpense = round2(slices.reduce((s, x) => s + x.amount, 0));
  const kept = round2(income - totalExpense);
  return { windowDays, income, totalExpense, kept, slices };
}

// Break-even: average monthly fixed cost, variable-cost ratio, contribution
// margin, and the revenue at which total cost = revenue.
export function breakEven(transactions, { windowDays = 180, asOf = new Date() } = {}) {
  const cutoff = new Date(asOf.getTime() - windowDays * DAY);
  const recent = transactions.filter((t) => parseDate(t.date) >= cutoff);

  let revenue = 0;
  let fixed = 0;
  let variable = 0;
  const months = new Set();
  for (const t of recent) {
    months.add(monthKey(t.date));
    const cls = classify(t);
    if (cls === 'financing') continue;
    if (t.amount >= 0) revenue += t.amount;
    else {
      const v = -t.amount;
      if (isVariable(t)) variable += v;
      else fixed += v;
    }
  }
  const n = Math.max(1, months.size);
  const monthlyRevenue = round2(revenue / n);
  const monthlyFixed = round2(fixed / n);
  const variableRatio = revenue > 0 ? variable / revenue : 0; // $ of variable cost per $ of revenue
  const contributionMargin = round1((1 - variableRatio) * 100);
  const breakEvenRevenue = 1 - variableRatio > 0 ? round2(monthlyFixed / (1 - variableRatio)) : null;

  return {
    monthlyRevenue,
    monthlyFixed,
    variableRatio: round2(variableRatio),
    contributionMargin, // %
    breakEvenRevenue,
    aboveBreakEven: breakEvenRevenue != null ? monthlyRevenue >= breakEvenRevenue : null,
  };
}

export function computeMetrics(transactions) {
  return {
    monthly: monthlySeries(transactions),
    donut: expenseDonut(transactions),
    breakEven: breakEven(transactions),
  };
}
