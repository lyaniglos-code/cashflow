import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  Legend,
} from 'recharts';
import { money, shortDate, longDate } from './format.js';

function CustomTooltip({ active, payload, overlayLabel }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/10 bg-charcoal-800/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 font-semibold text-white">{longDate(p.date)}</div>
      <div className="text-teal-soft">Balance: {money(p.projectedBalance)}</div>
      {p.overlay != null && (
        <div className="text-teal-bright">
          {overlayLabel || 'With plan'}: {money(p.overlay)}
        </div>
      )}
      {p.income != null && <div className="text-emerald-400">Income: {money(p.income)}</div>}
      {p.expense != null && <div className="text-red-400">Expense: {money(p.expense)}</div>}
    </div>
  );
}

// `overlay`: optional array of { date, value } drawn as a second "with plan" line.
export default function ProjectionChart({ points, threshold = 0, shortfall, horizon, overlay, overlayLabel }) {
  const overlayByDate = overlay ? new Map(overlay.map((o) => [o.date, o.value])) : null;
  const data = points.slice(0, horizon).map((d) => ({
    ...d,
    overlay: overlayByDate ? overlayByDate.get(d.date) : undefined,
  }));
  const hasNegative = data.some((d) => d.projectedBalance < threshold);
  const shortfallPoint = shortfall && data.find((d) => d.date === shortfall.date) ? shortfall : null;

  return (
    <div className="h-72 w-full lg:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14E0C6" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#14E0C6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            stroke="#ffffff15"
            minTickGap={28}
          />
          <YAxis
            tickFormatter={(v) => money(v)}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            stroke="#ffffff15"
            width={64}
          />
          <Tooltip content={<CustomTooltip overlayLabel={overlayLabel} />} />
          {overlay && <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />}
          {(threshold !== 0 || hasNegative) && (
            <ReferenceLine
              y={threshold}
              stroke="#f87171"
              strokeDasharray="5 4"
              label={{
                value: `Threshold ${money(threshold)}`,
                fill: '#f87171',
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="projectedBalance"
            name="Current trajectory"
            stroke="#14E0C6"
            strokeWidth={2.5}
            fill="url(#balanceFill)"
            dot={false}
            activeDot={{ r: 4, fill: '#14E0C6' }}
          />
          {overlay && (
            <Line
              type="monotone"
              dataKey="overlay"
              name={overlayLabel || 'With plan'}
              stroke="#7defdc"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={false}
            />
          )}
          {shortfallPoint && (
            <ReferenceDot
              x={shortfallPoint.date}
              y={shortfallPoint.projectedBalance}
              r={6}
              fill="#ef4444"
              stroke="#fff"
              strokeWidth={1.5}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
