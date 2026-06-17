import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import StatCard from '../components/StatCard.jsx';
import { money, shortDate, longDate } from '../components/format.js';

let nextId = 1;

function ScenarioTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const date = payload[0]?.payload?.date;
  return (
    <div className="rounded-xl border border-white/10 bg-charcoal-800/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 font-semibold text-white">{longDate(date)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {money(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function ScenarioPlanner() {
  const [adjustments, setAdjustments] = useState([]);
  const [result, setResult] = useState(null);
  const [, setLoading] = useState(true);
  const [planTitle, setPlanTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef(null);

  const simulate = useCallback(async (adjs) => {
    const data = await api.simulate(adjs);
    setResult(data);
    setLoading(false);
  }, []);

  // Initial baseline + re-simulate (debounced) whenever adjustments change.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => simulate(adjustments), 250);
    return () => clearTimeout(debounceRef.current);
  }, [adjustments, simulate]);

  function addHire() {
    setAdjustments((a) => [...a, { id: nextId++, type: 'hire', monthlyAmount: 4000 }]);
  }
  function addContract() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setAdjustments((a) => [
      ...a,
      { id: nextId++, type: 'contract', amount: 15000, date: d.toISOString().slice(0, 10) },
    ]);
  }
  function addRecurring() {
    setAdjustments((a) => [...a, { id: nextId++, type: 'recurring', amount: -500, cadenceDays: 7 }]);
  }
  function update(id, patch) {
    setAdjustments((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function remove(id) {
    setAdjustments((a) => a.filter((x) => x.id !== id));
  }

  async function saveAsPlan() {
    if (!adjustments.length) return;
    setSaving(true);
    try {
      const cleaned = adjustments.map(({ id, ...rest }) => rest);
      await api.savePlan({
        title: planTitle.trim() || 'Scenario plan',
        rationale: 'Created in the Scenario Planner.',
        adjustments: cleaned,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  const baseShortfall = result?.baseline?.shortfall;
  const scenShortfall = result?.scenario?.shortfall;
  const delta = result ? result.scenario.endBalance - result.baseline.endBalance : 0;

  return (
    <Layout title="Scenario Planner" subtitle="Model what-if changes and see the 90-day impact in real time">
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        {/* Controls */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">Add a scenario</h3>
            <div className="grid grid-cols-1 gap-2">
              <button className="btn-ghost justify-start" onClick={addHire}>
                👤 Hire someone (monthly cost)
              </button>
              <button className="btn-ghost justify-start" onClick={addContract}>
                📜 Land a contract (one-off income)
              </button>
              <button className="btn-ghost justify-start" onClick={addRecurring}>
                🔁 Add a recurring change
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {adjustments.length === 0 && (
              <div className="card p-5 text-center text-sm text-slate-400">
                No scenarios yet. Add one above to see how it changes your projection.
              </div>
            )}
            {adjustments.map((adj) => (
              <div key={adj.id} className="card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold capitalize text-white">
                    {adj.type === 'hire' && '👤 New hire'}
                    {adj.type === 'contract' && '📜 New contract'}
                    {adj.type === 'recurring' && '🔁 Recurring change'}
                  </span>
                  <button onClick={() => remove(adj.id)} className="text-xs text-slate-400 hover:text-red-400">
                    Remove
                  </button>
                </div>

                {adj.type === 'hire' && (
                  <div>
                    <label className="label">Monthly salary cost</label>
                    <input
                      className="input"
                      type="number"
                      value={adj.monthlyAmount}
                      onChange={(e) => update(adj.id, { monthlyAmount: Number(e.target.value) })}
                    />
                  </div>
                )}

                {adj.type === 'contract' && (
                  <div className="space-y-2">
                    <div>
                      <label className="label">Contract value</label>
                      <input
                        className="input"
                        type="number"
                        value={adj.amount}
                        onChange={(e) => update(adj.id, { amount: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="label">Expected date</label>
                      <input
                        className="input"
                        type="date"
                        value={adj.date}
                        onChange={(e) => update(adj.id, { date: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {adj.type === 'recurring' && (
                  <div className="space-y-2">
                    <div>
                      <label className="label">Amount per occurrence (negative = expense)</label>
                      <input
                        className="input"
                        type="number"
                        value={adj.amount}
                        onChange={(e) => update(adj.id, { amount: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="label">Every N days</label>
                      <input
                        className="input"
                        type="number"
                        value={adj.cadenceDays}
                        onChange={(e) => update(adj.id, { cadenceDays: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Result */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard
              label="Baseline 90-day"
              value={result ? money(result.baseline.endBalance) : '—'}
              sub="No changes"
            />
            <StatCard
              label="Scenario 90-day"
              value={result ? money(result.scenario.endBalance) : '—'}
              tone={delta >= 0 ? 'positive' : 'negative'}
              sub={`${delta >= 0 ? '+' : ''}${money(delta)} vs baseline`}
            />
            <StatCard
              label="Scenario shortfall"
              value={scenShortfall ? `${scenShortfall.daysUntil}d` : 'None'}
              tone={scenShortfall ? 'negative' : 'positive'}
              sub={scenShortfall ? `${money(scenShortfall.deficitAmount)} deficit` : 'No crunch projected'}
            />
          </div>

          {/* Save the current scenario as a reusable Action Plan (works without AI). */}
          <div className="card flex flex-col items-stretch gap-2 p-4 sm:flex-row sm:items-center">
            <input
              className="input flex-1"
              placeholder="Name this plan, e.g. “Trim costs + catering push”"
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
            />
            <button
              className="btn-primary whitespace-nowrap"
              onClick={saveAsPlan}
              disabled={saving || adjustments.length === 0}
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save as Action Plan'}
            </button>
          </div>

          <div className="card p-5">
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-300">Baseline vs Scenario</h3>
            <p className="mb-3 text-xs text-slate-400">90-day projected cash balance</p>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result?.points || []} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
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
                  <Tooltip content={<ScenarioTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
                  {result && (result.threshold !== 0 || baseShortfall || scenShortfall) && (
                    <ReferenceLine y={result.threshold} stroke="#f87171" strokeDasharray="5 4" />
                  )}
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    name="Baseline"
                    stroke="#64748b"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="scenario"
                    name="Scenario"
                    stroke="#14E0C6"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
