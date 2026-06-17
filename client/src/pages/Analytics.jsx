import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import { money, pct } from '../components/format.js';
import {
  RevenueVsNetIncome,
  MarginCorridor,
  CashflowVsNetIncome,
  ExpenseDonut,
  BreakEven,
} from '../components/AnalyticsCharts.jsx';

function ChartCard({ title, why, stat, children, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">{title}</h3>
        {stat}
      </div>
      <p className="mb-3 text-xs leading-relaxed text-slate-400">{why}</p>
      {children}
    </div>
  );
}

function Stat({ label, tone = 'default' }) {
  const tones = {
    default: 'bg-white/5 text-slate-300',
    teal: 'bg-teal/15 text-teal-soft',
    red: 'bg-red-500/15 text-red-300',
    amber: 'bg-amber-500/15 text-amber-300',
  };
  return <span className={`chip ${tones[tone]}`}>{label}</span>;
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setData(await api.metrics());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Layout title="Financial Analytics">
        <div className="grid h-64 place-items-center text-slate-400">Crunching your numbers…</div>
      </Layout>
    );
  }

  const monthly = data?.monthly || [];
  const biz = data?.business?.name || 'Your business';

  if (monthly.length < 2) {
    return (
      <Layout title="Financial Analytics" subtitle="Not enough data yet">
        <div className="card mx-auto max-w-xl p-8 text-center">
          <div className="mb-3 text-4xl">📊</div>
          <h2 className="text-lg font-bold text-white">Need a bit more history</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
            These analytics need at least two months of transactions. Connect a bank, upload a CSV, or load demo data to
            see them.
          </p>
          <Link to="/upload" className="btn-primary mt-5 inline-flex">
            Add data →
          </Link>
        </div>
      </Layout>
    );
  }

  const last = monthly[monthly.length - 1];
  const be = data.breakEven;
  const donut = data.donut;
  const topCat = donut?.slices?.[0];
  const gap = be?.breakEvenRevenue != null ? be.breakEvenRevenue - be.monthlyRevenue : null;

  return (
    <Layout
      title="Financial Analytics"
      subtitle={`${biz} · ${data.transactionCount} transactions · ${monthly.length} months`}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {/* 1. Revenue vs Net Income — full width */}
        <ChartCard
          className="lg:col-span-2"
          title="Revenue vs Net Income"
          why="Exposes “profitless growth.” If revenue climbs but net income stays flat or falls, your expenses are growing too fast."
          stat={
            <div className="flex gap-2">
              <Stat label={`Rev ${money(last.revenue)}`} tone="teal" />
              <Stat label={`Net ${money(last.netIncome)}`} tone={last.netIncome >= 0 ? 'teal' : 'red'} />
            </div>
          }
        >
          <RevenueVsNetIncome monthly={monthly} />
        </ChartCard>

        {/* 2. Profit Margin Corridor */}
        <ChartCard
          title="Profit Margin Corridor"
          why="The efficiency of your business at each stage. A falling gross margin means production costs are up; a falling operating margin means overhead is too high."
          stat={
            <div className="flex gap-2">
              <Stat label={`Gross ${pct(last.grossMargin, 0)}`} tone="teal" />
              <Stat label={`Net ${pct(last.netMargin, 0)}`} tone={last.netMargin >= 0 ? 'default' : 'red'} />
            </div>
          }
        >
          <MarginCorridor monthly={monthly} />
        </ChartCard>

        {/* 3. Net Income vs Net Cash Flow */}
        <ChartCard
          title="Net Income vs Net Cash Flow"
          why="Paper profit vs the actual change in your bank balance. They diverge when cash moves for non-profit reasons — owner contributions, loans, or timing of receipts."
          stat={
            <Stat
              label={last.netCashFlow >= last.netIncome ? 'Cash ≥ profit' : 'Cash < profit'}
              tone={last.netCashFlow >= last.netIncome ? 'teal' : 'amber'}
            />
          }
        >
          <CashflowVsNetIncome monthly={monthly} />
        </ChartCard>

        {/* 4. Expense Breakout Donut */}
        <ChartCard
          title="Expense Breakout"
          why="Where every dollar of income goes. Catches “budget creep” by showing exactly which category is eating your net income."
          stat={topCat ? <Stat label={`${topCat.category} ${pct(topCat.pctOfIncome, 0)}`} tone="amber" /> : null}
        >
          <ExpenseDonut donut={donut} />
          <p className="mt-2 text-center text-xs text-slate-500">
            Expenses are {donut.income > 0 ? pct((donut.totalExpense / donut.income) * 100, 0) : '—'} of income over the
            last {donut.windowDays} days.
          </p>
        </ChartCard>

        {/* 5. Break-Even Analysis */}
        <ChartCard
          title="Break-Even Analysis"
          why="The monthly sales where total dollars in equals total costs. Below the crossover is a loss; above it is profit."
          stat={
            be?.breakEvenRevenue != null ? (
              <Stat
                label={be.aboveBreakEven ? 'Above break-even' : `${money(Math.abs(gap))} short`}
                tone={be.aboveBreakEven ? 'teal' : 'red'}
              />
            ) : null
          }
        >
          <BreakEven breakEven={be} />
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="text-slate-500">Break-even</div>
              <div className="tnum font-semibold text-white">
                {be?.breakEvenRevenue != null ? money(be.breakEvenRevenue) : '—'}/mo
              </div>
            </div>
            <div>
              <div className="text-slate-500">Your sales</div>
              <div className="tnum font-semibold text-white">{money(be?.monthlyRevenue || 0)}/mo</div>
            </div>
            <div>
              <div className="text-slate-500">Margin/$</div>
              <div className="tnum font-semibold text-white">{pct(be?.contributionMargin, 0)}</div>
            </div>
          </div>
        </ChartCard>
      </div>
    </Layout>
  );
}
