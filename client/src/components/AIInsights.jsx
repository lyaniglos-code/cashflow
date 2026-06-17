function SourceBadge({ source }) {
  if (source === 'claude') {
    return <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-bold text-teal-soft">CLAUDE</span>;
  }
  if (source === 'template') {
    return <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-400">AUTO</span>;
  }
  return null;
}

export default function AIInsights({ summary, recommendations, loading }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">AI Cash Flow Summary</h3>
        {!loading && summary && <SourceBadge source={summary.source} />}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-white/10" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-slate-200">{summary?.text}</p>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Recommended Actions</h4>
          {!loading && recommendations && <SourceBadge source={recommendations.source} />}
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-9 w-full animate-pulse rounded-lg bg-white/10" />
            <div className="h-9 w-full animate-pulse rounded-lg bg-white/10" />
            <div className="h-9 w-full animate-pulse rounded-lg bg-white/10" />
          </div>
        ) : (
          <ol className="space-y-2">
            {(recommendations?.items || []).map((rec, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2.5">
                <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-teal/15 text-xs font-bold text-teal-soft">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-slate-200">{rec}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
