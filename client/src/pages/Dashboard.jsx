import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, streamUrl } from '../api.js';
import Layout from '../components/Layout.jsx';
import StatCard from '../components/StatCard.jsx';
import AlertCard from '../components/AlertCard.jsx';
import AIInsights from '../components/AIInsights.jsx';
import PlannerChat from '../components/PlannerChat.jsx';
import ActionPlans from '../components/ActionPlans.jsx';
import ProjectionChart from '../components/ProjectionChart.jsx';
import IncomeExpenseChart from '../components/IncomeExpenseChart.jsx';
import ConnectBank from '../components/ConnectBank.jsx';
import BankConnection from '../components/BankConnection.jsx';
import { money } from '../components/format.js';

const HORIZONS = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
];

function runwayDisplay(r) {
  if (!r) return { value: '—', sub: '', tone: 'default' };
  if (r.status === 'growing') return { value: 'Growing', sub: 'cash-positive', tone: 'positive' };
  if (r.days == null) return { value: 'Healthy', sub: 'no near-term risk', tone: 'positive' };
  const value = r.days >= 60 ? `${r.months} mo` : `${r.days} days`;
  return { value, sub: 'until low cash', tone: r.status === 'short' ? 'negative' : 'default' };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState(90);
  const [connecting, setConnecting] = useState(false);

  const [summary, setSummary] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [shortfallAi, setShortfallAi] = useState(null);
  const [aiLoading, setAiLoading] = useState(true);

  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null); // { id, title, points:[{date,value}] }
  const [plaidConfigured, setPlaidConfigured] = useState(false);
  const [liveFlash, setLiveFlash] = useState(false);
  const flashTimer = useRef(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.dashboard();
      setData(d);
      return d;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const { plans } = await api.listPlans();
      setPlans(plans);
    } catch {
      /* ignore */
    }
  }, []);

  const loadAi = useCallback(async (hasShortfall) => {
    setAiLoading(true);
    setSummary(null);
    setRecommendations(null);
    setShortfallAi(null);
    try {
      const [s, r] = await Promise.all([api.aiSummary(), api.aiRecommendations()]);
      setSummary(s);
      setRecommendations(r);
      if (hasShortfall) setShortfallAi(await api.aiShortfall());
    } catch {
      /* surfaced as empty panels */
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const d = await loadDashboard();
      if (d && d.transactionCount > 0) {
        loadAi(Boolean(d.shortfall));
        loadPlans();
      } else {
        setAiLoading(false);
      }
    })();
  }, [loadDashboard, loadAi, loadPlans]);

  // Live updates: refetch (quietly) when the server signals our data changed.
  const refetchLive = useCallback(async () => {
    try {
      const d = await api.dashboard();
      setData(d);
      const { plans } = await api.listPlans();
      setPlans(plans);
      setLiveFlash(true);
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setLiveFlash(false), 2600);
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    api
      .plaidStatus()
      .then((s) => setPlaidConfigured(s.configured))
      .catch(() => {});
    let es;
    try {
      es = new EventSource(streamUrl());
      es.addEventListener('refresh', () => refetchLive());
    } catch {
      /* EventSource unavailable */
    }
    return () => es && es.close();
  }, [refetchLive]);

  async function connect() {
    setConnecting(true);
    try {
      await api.connectQuickBooks();
      const d = await loadDashboard();
      if (d) {
        loadAi(Boolean(d.shortfall));
        loadPlans();
      }
    } finally {
      setConnecting(false);
    }
  }

  async function applyPlan(plan) {
    // Recompute against current data, then overlay the scenario line.
    try {
      const { impact } = await api.planImpact(plan.id);
      setActivePlan({
        id: plan.id,
        title: plan.title,
        points: impact.points.map((p) => ({ date: p.date, value: p.scenario })),
      });
    } catch {
      if (plan.impact?.points) {
        setActivePlan({
          id: plan.id,
          title: plan.title,
          points: plan.impact.points.map((p) => ({ date: p.date, value: p.scenario })),
        });
      }
    }
  }
  async function removePlan(id) {
    await api.deletePlan(id);
    if (activePlan?.id === id) setActivePlan(null);
    loadPlans();
  }

  if (loading && !data) {
    return (
      <Layout title="Dashboard">
        <div className="grid h-64 place-items-center text-slate-400">Loading your cash flow…</div>
      </Layout>
    );
  }

  // Empty state → onboarding
  if (data && data.transactionCount === 0) {
    return (
      <Layout title="Dashboard" subtitle="Let's get your forecast started">
        <div className="card mx-auto max-w-xl p-8 text-center">
          <div className="mb-3 text-4xl">📈</div>
          <h2 className="text-lg font-bold text-white">No data yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
            Set up your business in a guided 3-step flow, or load demo data to explore everything instantly.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link to="/onboarding" className="btn-primary">
              Set up my business →
            </Link>
            <button className="btn-ghost" onClick={connect} disabled={connecting}>
              {connecting ? 'Loading…' : '⚡ Load demo data'}
            </button>
          </div>
          <div className="mt-4 flex justify-center">
            <ConnectBank
              configured={plaidConfigured}
              variant="ghost"
              label="Connect a live bank"
              onConnected={async () => {
                const d = await loadDashboard();
                if (d) {
                  loadAi(Boolean(d.shortfall));
                  loadPlans();
                }
              }}
            />
          </div>
        </div>
      </Layout>
    );
  }

  const { currentBalance, shortfall, points, breakdown, threshold, patterns, kpis, business } = data;
  const bizName = business?.name || data.profile?.business_name || 'Your business';
  const rw = runwayDisplay(kpis?.runway);

  return (
    <Layout
      title="Cash Flow Dashboard"
      subtitle={`${bizName}${business?.type ? ` · ${business.type}` : ''} · ${data.transactionCount} transactions analyzed`}
      actions={
        <div className="hidden items-center gap-2 sm:flex">
          <button
            className="btn-ghost btn-sm"
            onClick={async () => {
              await api.clearTransactions();
              navigate('/onboarding');
            }}
            title="Clear data and walk through onboarding"
          >
            Start fresh
          </button>
          <button className="btn-ghost btn-sm" onClick={connect} disabled={connecting}>
            {connecting ? 'Refreshing…' : '↻ Demo data'}
          </button>
        </div>
      }
    >
      {liveFlash && (
        <div className="pointer-events-none fixed right-6 top-20 z-30 flex items-center gap-2 rounded-full border border-teal/30 bg-charcoal-800/95 px-3 py-1.5 text-xs font-semibold text-teal-soft shadow-glow">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" /> Updated live
        </div>
      )}
      <div className="space-y-5">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Cash Position"
            value={money(kpis?.cashPosition ?? currentBalance)}
            tone={(kpis?.cashPosition ?? currentBalance) >= 0 ? 'accent' : 'negative'}
            sub="in the bank today"
            icon="●"
          />
          <StatCard
            label="Burn Rate"
            value={`${money(kpis?.burnRate ?? 0)}/mo`}
            tone={(kpis?.burnRate ?? 0) >= 0 ? 'positive' : 'negative'}
            sub={(kpis?.burnRate ?? 0) >= 0 ? 'net cash gain' : 'avg net monthly'}
            icon="🔥"
          />
          <StatCard label="Revenue" value={money(kpis?.revenue ?? 0)} tone="muted" sub="last 30 days" icon="↗" />
          <StatCard label="Runway" value={rw.value} tone={rw.tone} sub={rw.sub} icon="🛬" />
        </div>

        {/* Shortfall alert */}
        {shortfall && (
          <AlertCard
            shortfall={shortfall}
            explanation={shortfallAi?.text}
            loadingExplanation={aiLoading && !shortfallAi}
            aiSource={shortfallAi?.source}
          />
        )}

        {/* Projection chart */}
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                {bizName} — Cash Flow Projection
              </h3>
              <p className="text-xs text-slate-400">
                Daily running balance{activePlan ? ` · overlay: ${activePlan.title}` : ' · from recurring patterns'}
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
              {HORIZONS.map((h) => (
                <button
                  key={h.value}
                  onClick={() => setHorizon(h.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    horizon === h.value ? 'bg-teal text-charcoal-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>
          <ProjectionChart
            points={points}
            threshold={threshold}
            shortfall={shortfall}
            horizon={horizon}
            overlay={activePlan ? activePlan.points : null}
            overlayLabel={activePlan ? activePlan.title : null}
          />
        </div>

        {/* Breakdown + AI summary */}
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-300">Income vs Expense</h3>
            <p className="mb-3 text-xs text-slate-400">{bizName}, by category · last 90 days</p>
            <IncomeExpenseChart breakdown={breakdown} />
          </div>
          <AIInsights summary={summary} recommendations={recommendations} loading={aiLoading} />
        </div>

        {/* Planner chat + action plans */}
        <div className="grid gap-5 lg:grid-cols-2">
          <PlannerChat onPlanSaved={loadPlans} />
          <ActionPlans
            plans={plans}
            activePlanId={activePlan?.id}
            onApply={applyPlan}
            onClear={() => setActivePlan(null)}
            onRemove={removePlan}
          />
        </div>

        {/* Live bank connection */}
        <BankConnection onChange={refetchLive} />

        {/* Recurring patterns */}
        {patterns?.length > 0 && (
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-300">
              Detected Recurring Patterns
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {patterns.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-200">{p.label}</div>
                    <div className="text-xs capitalize text-slate-400">
                      {p.cadence} · {p.category}
                    </div>
                  </div>
                  <div
                    className={`tnum ml-2 text-sm font-semibold ${p.type === 'income' ? 'text-teal' : 'text-red-400'}`}
                  >
                    {money(p.avgAmount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
