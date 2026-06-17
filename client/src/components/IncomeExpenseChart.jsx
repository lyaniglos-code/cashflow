import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { money } from './format.js';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-charcoal-800/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 font-semibold text-white">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {money(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function IncomeExpenseChart({ breakdown }) {
  const data = breakdown.slice(0, 8).map((c) => ({
    category: c.category,
    Income: c.income,
    Expense: c.expense,
  }));

  return (
    <div className="h-72 w-full lg:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis
            dataKey="category"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            stroke="#ffffff15"
            interval={0}
            angle={-20}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tickFormatter={(v) => money(v)}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            stroke="#ffffff15"
            width={64}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
          <Bar dataKey="Income" fill="#34d399" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Expense" fill="#f87171" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
