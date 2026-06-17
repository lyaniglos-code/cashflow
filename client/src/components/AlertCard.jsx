import { money, longDate } from './format.js';

export default function AlertCard({ shortfall, explanation, loadingExplanation, aiSource }) {
  if (!shortfall) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-950/60 to-charcoal-800/70 shadow-lg shadow-red-900/20">
      <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-5 py-3">
        <span className="text-lg">⚠️</span>
        <h3 className="text-sm font-bold uppercase tracking-wide text-red-300">Projected Cash Shortfall</h3>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-red-300/80">Days until shortfall</div>
          <div className="mt-1 text-3xl font-bold text-white">{shortfall.daysUntil}</div>
          <div className="text-xs text-slate-400">{longDate(shortfall.date)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-red-300/80">Projected low</div>
          <div className="mt-1 text-3xl font-bold text-red-400">
            {money(shortfall.lowestBalance ?? shortfall.projectedBalance)}
          </div>
          <div className="text-xs text-slate-400">
            {shortfall.lowestDate
              ? `bottoms out ${longDate(shortfall.lowestDate)}`
              : `vs. ${money(shortfall.threshold)} threshold`}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-red-300/80">Deepest deficit</div>
          <div className="mt-1 text-3xl font-bold text-red-400">{money(shortfall.deficitAmount)}</div>
          <div className="text-xs text-slate-400">below your {money(shortfall.threshold)} threshold</div>
        </div>
      </div>
      <div className="border-t border-red-500/20 px-5 py-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-300/80">
          <span>What this means</span>
          {aiSource === 'claude' && (
            <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-bold text-teal-soft">CLAUDE</span>
          )}
        </div>
        {loadingExplanation ? (
          <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
        ) : (
          <p className="text-sm leading-relaxed text-slate-200">{explanation || 'Analyzing your shortfall…'}</p>
        )}
      </div>
    </div>
  );
}
