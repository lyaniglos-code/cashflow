import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { money, pct, monthLabel } from './format.js';

const TEAL = '#14E0C6';
const TEAL_SOFT = '#7defdc';
const AMBER = '#fbbf24';
const RED = '#f87171';
const SLATE = '#64748b';
const DONUT_COLORS = ['#14E0C6', '#2ff4da', '#0fb8a3', '#f87171', '#fbbf24', '#a78bfa', '#60a5fa', '#94a3b8'];

function Panel({ children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-charcoal-800/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {children}
    </div>
  );
}

const axisTick = { fill: '#94a3b8', fontSize: 11 };
const axisStroke = '#ffffff15';

// ---------- 1. Revenue vs Net Income ----------
export function RevenueVsNetIncome({ monthly }) {
  function TT({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
      <Panel>
        <div className="mb-1 font-semibold text-white">{monthLabel(label)}</div>
        {payload.map((p) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {money(p.value)}
          </div>
        ))}
      </Panel>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={monthly} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} stroke={axisStroke} minTickGap={16} />
          <YAxis tickFormatter={(v) => money(v)} tick={axisTick} stroke={axisStroke} width={62} />
          <ReferenceLine y={0} stroke="#ffffff22" />
          <Tooltip content={<TT />} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
          <Line type="monotone" dataKey="revenue" name="Revenue" stroke={TEAL} strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="netIncome" name="Net income" stroke={AMBER} strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- 2. Profit Margin Corridor ----------
export function MarginCorridor({ monthly }) {
  function TT({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
      <Panel>
        <div className="mb-1 font-semibold text-white">{monthLabel(label)}</div>
        {payload.map((p) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {pct(p.value, 1)}
          </div>
        ))}
      </Panel>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={monthly} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} stroke={axisStroke} minTickGap={16} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={axisTick} stroke={axisStroke} width={48} />
          <ReferenceLine y={0} stroke="#f8717155" strokeDasharray="4 4" />
          <Tooltip content={<TT />} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
          <Line
            type="monotone"
            dataKey="grossMargin"
            name="Gross"
            stroke={TEAL_SOFT}
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="operatingMargin"
            name="Operating"
            stroke={TEAL}
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="netMargin"
            name="Net"
            stroke={AMBER}
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- 3. Net Income vs Net Cash Flow ----------
export function CashflowVsNetIncome({ monthly }) {
  function TT({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
      <Panel>
        <div className="mb-1 font-semibold text-white">{monthLabel(label)}</div>
        {payload.map((p) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {money(p.value)}
          </div>
        ))}
      </Panel>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={monthly} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} stroke={axisStroke} minTickGap={16} />
          <YAxis tickFormatter={(v) => money(v)} tick={axisTick} stroke={axisStroke} width={62} />
          <ReferenceLine y={0} stroke="#ffffff22" />
          <Tooltip content={<TT />} cursor={{ fill: '#ffffff08' }} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
          <Bar dataKey="netIncome" name="Net income" fill={AMBER} radius={[3, 3, 0, 0]} />
          <Bar dataKey="netCashFlow" name="Net cash flow" fill={TEAL} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- 4. Expense Breakout Donut ----------
export function ExpenseDonut({ donut }) {
  const slices = donut?.slices || [];
  const total = donut?.totalExpense || 0;
  function TT({ active, payload }) {
    if (!active || !payload?.length) return null;
    const p = payload[0];
    return (
      <Panel>
        <div className="font-semibold text-white">{p.name}</div>
        <div style={{ color: p.payload.fill }}>
          {money(p.value)} · {pct(p.payload.pctOfIncome, 1)} of income
        </div>
      </Panel>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="relative h-56 w-full sm:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((s, i) => (
                <Cell key={s.category} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<TT />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Expenses</div>
          <div className="tnum text-lg font-bold text-white">{money(total)}</div>
          <div className="text-[10px] text-slate-500">last {donut?.windowDays || 90}d</div>
        </div>
      </div>
      <div className="w-full space-y-1.5 sm:w-1/2">
        {slices.map((s, i) => (
          <div key={s.category} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
              />
              <span className="truncate text-slate-300">{s.category}</span>
            </span>
            <span className="tnum flex-shrink-0 text-slate-400">{pct(s.pctOfIncome, 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- 5. Break-Even Analysis ----------
export function BreakEven({ breakEven }) {
  const F = breakEven?.monthlyFixed || 0;
  const v = breakEven?.variableRatio || 0;
  const be = breakEven?.breakEvenRevenue;
  const cur = breakEven?.monthlyRevenue || 0;

  const xMax = Math.max(be || 0, cur, 1) * 1.6;
  const steps = 24;
  const data = Array.from({ length: steps + 1 }, (_, i) => {
    const x = (xMax / steps) * i;
    return { x: Math.round(x), revenue: Math.round(x), totalCost: Math.round(F + v * x) };
  });

  function TT({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
      <Panel>
        <div className="mb-1 font-semibold text-white">Sales {money(label)}/mo</div>
        {payload.map((p) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {money(p.value)}
          </div>
        ))}
      </Panel>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, Math.round(xMax)]}
            tickFormatter={(v2) => money(v2)}
            tick={axisTick}
            stroke={axisStroke}
            minTickGap={28}
          />
          <YAxis tickFormatter={(v2) => money(v2)} tick={axisTick} stroke={axisStroke} width={62} />
          <Tooltip content={<TT />} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
          <Line type="monotone" dataKey="revenue" name="Revenue" stroke={TEAL} strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="totalCost" name="Total cost" stroke={RED} strokeWidth={2.5} dot={false} />
          {be != null && cur > 0 && (
            <ReferenceLine
              x={Math.round(cur)}
              stroke={SLATE}
              strokeDasharray="4 4"
              label={{ value: 'You', fill: '#94a3b8', fontSize: 10, position: 'top' }}
            />
          )}
          {be != null && (
            <ReferenceDot x={Math.round(be)} y={Math.round(be)} r={6} fill={AMBER} stroke="#fff" strokeWidth={1.5} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
