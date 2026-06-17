import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from '../components/Logo.jsx';
import ConnectBank from '../components/ConnectBank.jsx';
import { money } from '../components/format.js';

const CATEGORY_HINTS = [
  'POS Income',
  'Service Revenue',
  'Catering Income',
  'Payroll',
  'Rent',
  'Food Costs',
  'Utilities',
  'Software',
  'Marketing',
  'Loan Payment',
];

// Map the current screen + chosen mode to a labeled progress stepper.
function stepperFor(screen, mode) {
  if (mode === 'bank') {
    const labels = ['Business', 'Connect bank', 'Finish'];
    return { labels, active: screen === 'finish' ? 2 : 1 };
  }
  if (mode === 'manual') {
    const labels = ['Business', 'Opening cash', 'Recurring money', 'Finish'];
    const active = { opening: 1, recurring: 2, finish: 3 }[screen] ?? 1;
    return { labels, active };
  }
  const labels = ['Business', 'Add data', 'Finish'];
  return { labels, active: screen === 'choose' ? 1 : 0 };
}

function Stepper({ labels, active }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition ${
              i < active
                ? 'bg-teal text-charcoal-950'
                : i === active
                  ? 'bg-teal/15 text-teal ring-1 ring-teal/40'
                  : 'bg-white/5 text-slate-500'
            }`}
          >
            {i < active ? '✓' : i + 1}
          </div>
          <span className={`hidden text-xs sm:inline ${i === active ? 'text-white' : 'text-slate-500'}`}>{label}</span>
          {i < labels.length - 1 && <span className="mx-1 h-px w-5 bg-white/10" />}
        </div>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [screen, setScreen] = useState('profile'); // profile | choose | opening | recurring | finish
  const [mode, setMode] = useState(null); // 'bank' | 'manual'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plaidConfigured, setPlaidConfigured] = useState(false);

  // Step 1 — profile
  const [profile, setProfile] = useState({
    businessName: user?.businessName || '',
    businessType: user?.businessType || '',
    industryVertical: user?.industryVertical || '',
    shortfallThreshold: user?.shortfallThreshold ?? 0,
  });

  // Manual: opening cash + recurring items
  const [opening, setOpening] = useState(5000);
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({ label: '', amount: '', direction: 'in', cadence: 'monthly', category: '' });

  useEffect(() => {
    api
      .plaidStatus()
      .then((s) => setPlaidConfigured(s.configured))
      .catch(() => {});
  }, []);

  const setP = (k) => (e) =>
    setProfile((p) => ({ ...p, [k]: k === 'shortfallThreshold' ? Number(e.target.value) : e.target.value }));
  const setD = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  async function saveProfileAndChoose() {
    setError('');
    setBusy(true);
    try {
      await api.updateProfile(profile);
      await refreshUser();
      setScreen('choose');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function chooseManual() {
    setMode('manual');
    setScreen('opening');
  }

  async function addItem() {
    const amt = Number(draft.amount);
    if (!draft.label.trim() || !amt) {
      setError('Add a label and a non-zero amount.');
      return;
    }
    setError('');
    setBusy(true);
    const signed = draft.direction === 'in' ? Math.abs(amt) : -Math.abs(amt);
    try {
      await api.addRecurring({
        label: draft.label.trim(),
        amount: signed,
        category: draft.category.trim() || (draft.direction === 'in' ? 'Income' : 'Expense'),
        cadence: draft.cadence,
        months: 4,
      });
      setItems((list) => [...list, { ...draft, amount: signed }]);
      setDraft({ label: '', amount: '', direction: draft.direction, cadence: draft.cadence, category: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function finishManual() {
    // Apply opening cash as a balancing plug AFTER recurring history exists.
    setBusy(true);
    setError('');
    try {
      await api.setOpeningBalance(Number(opening) || 0);
      setScreen('finish');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadDemo() {
    setBusy(true);
    try {
      await api.connectQuickBooks();
      navigate('/');
    } finally {
      setBusy(false);
    }
  }

  const { labels, active } = stepperFor(screen, mode);

  return (
    <div className="min-h-full px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-white">Let's set up your cash flow</h1>
        <p className="mt-1 text-center text-sm text-slate-400">A few details and you'll have a live 90-day forecast.</p>

        <div className="mt-7 card p-6">
          <Stepper labels={labels} active={active} />
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* PROFILE */}
          {screen === 'profile' && (
            <div className="space-y-4">
              <div>
                <label className="label">Business name</label>
                <input
                  className="input"
                  value={profile.businessName}
                  onChange={setP('businessName')}
                  placeholder="The Corner Bistro"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Business type</label>
                  <input
                    className="input"
                    value={profile.businessType}
                    onChange={setP('businessType')}
                    placeholder="Restaurant"
                  />
                </div>
                <div>
                  <label className="label">Industry</label>
                  <input
                    className="input"
                    value={profile.industryVertical}
                    onChange={setP('industryVertical')}
                    placeholder="Food & Beverage"
                  />
                </div>
              </div>
              <div>
                <label className="label">Low-cash alert threshold ($)</label>
                <input
                  className="input"
                  type="number"
                  value={profile.shortfallThreshold}
                  onChange={setP('shortfallThreshold')}
                />
                <p className="mt-1 text-xs text-slate-500">
                  We'll warn you when projected cash is set to drop below this.
                </p>
              </div>
            </div>
          )}

          {/* CHOOSE: connect a bank vs enter manually */}
          {screen === 'choose' && (
            <div className="space-y-4">
              <p className="text-center text-sm text-slate-400">How would you like to add your money data?</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Connect a bank */}
                <div className="flex flex-col rounded-2xl border border-teal/30 bg-teal/[0.05] p-5">
                  <div className="text-2xl">🏦</div>
                  <h3 className="mt-2 text-base font-bold text-white">Connect your bank</h3>
                  <p className="mt-1 flex-1 text-sm text-slate-400">
                    Link your account and we'll pull real transactions in automatically — the fastest, most accurate
                    option, with live updates.
                  </p>
                  <span className="chip mt-2 self-start bg-teal/15 text-teal-soft">Recommended</span>
                  <div className="mt-3">
                    <ConnectBank
                      configured={plaidConfigured}
                      label="Connect a bank"
                      onConnected={() => {
                        setMode('bank');
                        setScreen('finish');
                      }}
                    />
                  </div>
                </div>

                {/* Enter manually */}
                <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                  <div className="text-2xl">✍️</div>
                  <h3 className="mt-2 text-base font-bold text-white">Enter it manually</h3>
                  <p className="mt-1 flex-1 text-sm text-slate-400">
                    Tell us your opening cash and recurring income/expenses. Great if you'd rather not connect a bank.
                  </p>
                  <button className="btn-ghost mt-3" onClick={chooseManual}>
                    Enter manually →
                  </button>
                </div>
              </div>
              <p className="text-center text-xs text-slate-500">
                Just exploring?{' '}
                <button className="text-teal-soft hover:underline" onClick={loadDemo} disabled={busy}>
                  Load demo data
                </button>
              </p>
            </div>
          )}

          {/* MANUAL — opening cash */}
          {screen === 'opening' && (
            <div className="space-y-4">
              <div>
                <label className="label">How much cash is in the bank today?</label>
                <input className="input" type="number" value={opening} onChange={(e) => setOpening(e.target.value)} />
                <p className="mt-1 text-xs text-slate-500">
                  This sets your current cash position. You can refine it later with real transactions.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-center">
                <div className="text-xs uppercase tracking-wider text-slate-400">Starting cash position</div>
                <div className="tnum mt-1 text-2xl font-bold text-teal">{money(Number(opening) || 0)}</div>
              </div>
            </div>
          )}

          {/* MANUAL — recurring money */}
          {screen === 'recurring' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Add the income and expenses that repeat — payroll, rent, sales, supplier orders. These power your
                forecast.
              </p>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Label</label>
                    <input
                      className="input"
                      value={draft.label}
                      onChange={setD('label')}
                      placeholder="e.g. Payroll, Daily sales, Rent"
                    />
                  </div>
                  <div>
                    <label className="label">Direction</label>
                    <select className="input" value={draft.direction} onChange={setD('direction')}>
                      <option value="in">Money in (income)</option>
                      <option value="out">Money out (expense)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Amount ($)</label>
                    <input
                      className="input"
                      type="number"
                      value={draft.amount}
                      onChange={setD('amount')}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="label">How often</label>
                    <select className="input" value={draft.cadence} onChange={setD('cadence')}>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <input
                      className="input"
                      list="cat-hints"
                      value={draft.category}
                      onChange={setD('category')}
                      placeholder="Optional"
                    />
                    <datalist id="cat-hints">
                      {CATEGORY_HINTS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <button className="btn-ghost mt-3 w-full" onClick={addItem} disabled={busy}>
                  + Add this item
                </button>
              </div>

              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm"
                    >
                      <span className="text-slate-200">
                        {it.label} <span className="text-xs text-slate-500">· {it.cadence}</span>
                      </span>
                      <span className={`tnum font-semibold ${it.amount >= 0 ? 'text-teal' : 'text-red-400'}`}>
                        {money(it.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FINISH */}
          {screen === 'finish' && (
            <div className="space-y-4 text-center">
              <div className="text-4xl">🎉</div>
              <h2 className="text-lg font-bold text-white">You're all set</h2>
              <p className="mx-auto max-w-sm text-sm text-slate-400">
                {profile.businessName || 'Your business'} is ready.{' '}
                {mode === 'bank'
                  ? 'Your bank is connected — transactions will keep streaming in and your forecast updates live.'
                  : `We've built a 90-day forecast from your opening cash and ${items.length} recurring item${
                      items.length === 1 ? '' : 's'
                    }. You can connect a bank or add more data anytime from the Import page.`}
              </p>
            </div>
          )}

          {/* Footer nav */}
          <div className="mt-6 flex items-center justify-between">
            <button
              className="btn-ghost"
              onClick={() => {
                if (screen === 'profile') navigate('/');
                else if (screen === 'choose') setScreen('profile');
                else if (screen === 'opening') setScreen('choose');
                else if (screen === 'recurring') setScreen('opening');
                else if (screen === 'finish') setScreen(mode === 'bank' ? 'choose' : 'recurring');
              }}
              disabled={busy}
            >
              {screen === 'profile' ? 'Skip for now' : 'Back'}
            </button>

            {screen === 'profile' && (
              <button className="btn-primary" onClick={saveProfileAndChoose} disabled={busy}>
                {busy ? 'Saving…' : 'Continue'}
              </button>
            )}
            {screen === 'opening' && (
              <button className="btn-primary" onClick={() => setScreen('recurring')} disabled={busy}>
                Continue
              </button>
            )}
            {screen === 'recurring' && (
              <button className="btn-primary" onClick={finishManual} disabled={busy}>
                {busy ? 'Saving…' : 'Finish'}
              </button>
            )}
            {screen === 'finish' && (
              <button className="btn-primary" onClick={() => navigate('/')} disabled={busy}>
                Go to dashboard →
              </button>
            )}
            {screen === 'choose' && <span />}
          </div>
        </div>
      </div>
    </div>
  );
}
