import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';
import SmsAlerts from '../components/SmsAlerts.jsx';

export default function Settings() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    businessName: '',
    businessType: '',
    industryVertical: '',
    shortfallThreshold: 0,
  });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(null);

  useEffect(() => {
    if (user) {
      setForm({
        businessName: user.businessName || '',
        businessType: user.businessType || '',
        industryVertical: user.industryVertical || '',
        shortfallThreshold: user.shortfallThreshold ?? 0,
      });
    }
  }, [user]);

  useEffect(() => {
    api
      .aiStatus()
      .then((s) => setAiEnabled(s.aiEnabled))
      .catch(() => setAiEnabled(false));
  }, []);

  const set = (k) => (e) => {
    const v = k === 'shortfallThreshold' ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { user: updated } = await api.updateProfile(form);
      setUser(updated);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout title="Settings" subtitle="Business profile and alert preferences">
      <div className="mx-auto max-w-2xl space-y-5">
        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          <h3 className="text-base font-bold text-white">Business Profile</h3>
          <div>
            <label className="label">Business name</label>
            <input className="input" value={form.businessName} onChange={set('businessName')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Business type</label>
              <input className="input" value={form.businessType} onChange={set('businessType')} />
            </div>
            <div>
              <label className="label">Industry vertical</label>
              <input className="input" value={form.industryVertical} onChange={set('industryVertical')} />
            </div>
          </div>
          <div>
            <label className="label">Shortfall alert threshold ($)</label>
            <input
              className="input"
              type="number"
              value={form.shortfallThreshold}
              onChange={set('shortfallThreshold')}
            />
            <p className="mt-1 text-xs text-slate-500">
              You'll get a red alert when projected cash drops below this amount within 90 days. Also configurable under
              SMS Alerts. Default is $0.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <span className="text-sm text-emerald-400">✓ Saved</span>}
          </div>
        </form>

        <SmsAlerts />

        <div className="card p-6">
          <h3 className="text-base font-bold text-white">AI Engine</h3>
          <p className="mt-1 text-sm text-slate-400">
            Narratives and recommendations are generated with Claude (claude-sonnet-4-6).
          </p>
          <div className="mt-3 flex items-center gap-2">
            {aiEnabled == null ? (
              <span className="text-sm text-slate-400">Checking…</span>
            ) : aiEnabled ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-400">
                ● Claude API connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-400">
                ● Template fallback (no API key)
              </span>
            )}
          </div>
          {!aiEnabled && aiEnabled != null && (
            <p className="mt-3 text-xs text-slate-500">
              Add <code className="rounded bg-white/10 px-1.5 py-0.5 text-teal-soft">ANTHROPIC_API_KEY</code> to your{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-teal-soft">.env</code> file and restart to enable
              real Claude-generated insights. The app works fully without it.
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
