import { money } from './format.js';

function shortfallText(sf) {
  if (!sf) return 'no shortfall in 90d';
  return `shortfall in ${sf.daysUntil}d`;
}

export default function ActionPlans({ plans, activePlanId, onApply, onClear, onRemove }) {
  if (!plans?.length) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Action Plans</h3>
        <p className="mt-2 text-sm text-slate-400">
          No saved plans yet. Ask the assistant to build a plan, or save one from the{' '}
          <span className="text-teal-soft">Scenario Planner</span>. Saved plans show their real projected impact here
          and can be overlaid on the chart above.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Action Plans</h3>
        {activePlanId && (
          <button className="btn-ghost btn-sm" onClick={onClear}>
            Clear overlay
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((p) => {
          const imp = p.impact || {};
          const delta = imp.delta90 ?? 0;
          const active = p.id === activePlanId;
          const baseSf = imp.baseline?.shortfall;
          const scenSf = imp.scenario?.shortfall;
          const fixesShortfall = baseSf && !scenSf;
          return (
            <div
              key={p.id}
              className={`rounded-xl border p-4 transition ${
                active ? 'border-teal/40 bg-teal/[0.06] shadow-glow' : 'border-white/[0.06] bg-white/[0.03]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{p.title}</div>
                  {p.rationale && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{p.rationale}</p>}
                </div>
                <button
                  onClick={() => onRemove(p.id)}
                  className="flex-shrink-0 text-xs text-slate-500 hover:text-red-400"
                  title="Remove plan"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className={`tnum font-semibold ${delta >= 0 ? 'text-teal' : 'text-red-400'}`}>
                  {delta >= 0 ? '+' : ''}
                  {money(delta)} <span className="font-normal text-slate-400">90-day impact</span>
                </span>
                <span className="tnum text-slate-400">ends {money(imp.scenario?.endBalance ?? 0)}</span>
              </div>

              <div className="mt-1 text-xs">
                {fixesShortfall ? (
                  <span className="chip bg-teal/15 text-teal-soft">Removes shortfall</span>
                ) : scenSf ? (
                  <span className="text-slate-400">
                    {shortfallText(baseSf)} → {shortfallText(scenSf)}
                  </span>
                ) : (
                  <span className="text-slate-400">no shortfall projected</span>
                )}
              </div>

              <button
                className={`mt-3 w-full ${active ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                onClick={() => (active ? onClear() : onApply(p))}
              >
                {active ? 'Applied — viewing on chart' : 'Apply to chart'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
