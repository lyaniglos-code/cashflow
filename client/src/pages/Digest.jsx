import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import { LogoMark } from '../components/Logo.jsx';
import { longDate } from '../components/format.js';

export default function Digest() {
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setDigest(await api.digest());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Layout title="Weekly Digest">
        <div className="grid h-64 place-items-center text-slate-400">Preparing this week's report…</div>
      </Layout>
    );
  }

  return (
    <Layout title="Weekly Digest" subtitle="Your cash flow report, in plain English">
      <div className="mx-auto max-w-2xl">
        {/* Email-style digest card */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-charcoal-800/80 shadow-xl">
          {/* Email header */}
          <div className="border-b border-white/10 bg-gradient-to-r from-teal/15 to-transparent px-6 py-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-soft">
              <span className="text-teal">
                <LogoMark size={16} />
              </span>
              <span>ForecastOS</span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">This Week's Cash Flow Report</h2>
            <p className="mt-1 text-sm text-slate-400">
              {digest.businessName || 'Your business'} · {longDate(digest.generatedAt.slice(0, 10))}
            </p>
          </div>

          {/* Body */}
          <div className="space-y-6 px-6 py-6">
            {digest.narrative && <p className="text-sm leading-relaxed text-slate-200">{digest.narrative}</p>}

            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Top 3 Insights</h3>
              <div className="space-y-3">
                {digest.insights.map((ins, i) => (
                  <div key={i} className="rounded-xl border border-white/5 bg-white/5 p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-teal/15 text-sm font-bold text-teal-soft">
                        {i + 1}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-white">{ins.title}</div>
                        <p className="mt-1 text-sm leading-relaxed text-slate-300">{ins.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {digest.recommendations?.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Recommended Actions</h3>
                <ul className="space-y-2">
                  {digest.recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-200">
                      <span className="text-teal-soft">→</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Email footer */}
          <div className="border-t border-white/10 bg-charcoal-900/50 px-6 py-4 text-center text-xs text-slate-500">
            Generated automatically from your last 90 days of transactions.
          </div>
        </div>
      </div>
    </Layout>
  );
}
