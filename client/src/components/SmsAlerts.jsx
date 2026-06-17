import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
  'Europe/London',
];

const ALERT_TESTS = [
  { type: 'shortfall', label: 'Shortfall' },
  { type: 'weekly_pulse', label: 'Weekly pulse' },
  { type: 'improvement', label: 'Improvement' },
  { type: 'breach', label: 'Threshold breach' },
];

function Toggle({ checked, onChange, label, desc, disabled }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        {desc && <div className="text-xs text-slate-500">{desc}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${checked ? 'bg-teal' : 'bg-white/15'} ${
          disabled ? 'cursor-not-allowed' : ''
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[1.4rem]' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}

export default function SmsAlerts() {
  const [s, setS] = useState(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'code'
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [testMsg, setTestMsg] = useState(null);
  const [log, setLog] = useState([]);

  const load = useCallback(async () => {
    const status = await api.smsStatus();
    setS(status);
    setPrefs({
      smsOptIn: status.smsOptIn,
      alertShortfall: status.alertShortfall,
      alertWeeklyPulse: status.alertWeeklyPulse,
      alertImprovement: status.alertImprovement,
      quietStart: status.quietStart,
      quietEnd: status.quietEnd,
      timezone: status.timezone,
      shortfallThreshold: status.shortfallThreshold,
    });
    if (status.phone) setPhone(status.phone);
  }, []);

  const loadLog = useCallback(async () => {
    try {
      setLog((await api.smsLog()).log || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load().catch(() => setS({ twilioConfigured: false }));
    loadLog();
  }, [load, loadLog]);

  async function sendCode() {
    setError('');
    setBusy('code');
    try {
      const r = await api.smsSendCode(phone);
      setDevCode(r.devCode || '');
      setStep('code');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }
  async function verify() {
    setError('');
    setBusy('verify');
    try {
      await api.smsVerify(code);
      setCode('');
      setDevCode('');
      setStep('phone');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }
  async function disconnect() {
    setBusy('disc');
    try {
      await api.smsDisconnect();
      setPhone('');
      await load();
    } finally {
      setBusy('');
    }
  }
  async function savePrefs() {
    setBusy('save');
    setSaved(false);
    try {
      const updated = await api.smsSettings(prefs);
      setS(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy('');
    }
  }
  async function runTest(type) {
    setBusy(`test-${type}`);
    setTestMsg(null);
    try {
      const r = await api.smsTest(type);
      setTestMsg({ type, body: r.body, queued: r.queued, simulated: r.simulated });
      loadLog();
    } catch (e) {
      setTestMsg({ type, error: e.message });
    } finally {
      setBusy('');
    }
  }

  const setPref = (k) => (v) => {
    setPrefs((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };

  if (!s || !prefs) return <div className="card p-6 text-sm text-slate-400">Loading SMS settings…</div>;

  return (
    <div className="card space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white">📱 SMS Alerts</h3>
        {s.phoneVerified && <span className="chip bg-teal/15 text-teal-soft">Verified</span>}
      </div>

      {!s.twilioConfigured && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Simulation mode — no Twilio credentials set. Messages are logged to the server console and the verification
          code is shown here. Add <code className="text-amber-200">TWILIO_*</code> to{' '}
          <code className="text-amber-200">.env</code> to send real texts.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {/* Phone verification */}
      {!s.phoneVerified ? (
        <div className="space-y-3">
          <div>
            <label className="label">Mobile number</label>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="+1 555 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <button className="btn-ghost whitespace-nowrap" onClick={sendCode} disabled={busy === 'code' || !phone}>
                {busy === 'code' ? 'Sending…' : 'Send code'}
              </button>
            </div>
          </div>
          {step === 'code' && (
            <div>
              <label className="label">Enter the 6-digit code</label>
              {devCode && (
                <div className="mb-2 rounded-lg border border-teal/30 bg-teal/[0.06] px-3 py-1.5 text-xs text-teal-soft">
                  Simulation code: <span className="tnum font-bold">{devCode}</span>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="input tnum"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
                  className="btn-primary whitespace-nowrap"
                  onClick={verify}
                  disabled={busy === 'verify' || code.length < 6}
                >
                  {busy === 'verify' ? 'Verifying…' : 'Verify'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
          <div>
            <div className="text-sm font-semibold text-white">{s.phone}</div>
            <div className="text-xs text-slate-400">Verified for alerts</div>
          </div>
          <button className="btn-ghost btn-sm text-red-300" onClick={disconnect} disabled={busy === 'disc'}>
            Remove
          </button>
        </div>
      )}

      {/* Preferences (active once verified) */}
      <div className={s.phoneVerified ? '' : 'pointer-events-none opacity-50'}>
        <div className="divide-y divide-white/[0.06]">
          <Toggle
            label="SMS alerts"
            desc="Master switch for all text alerts"
            checked={prefs.smsOptIn}
            onChange={setPref('smsOptIn')}
          />
          <Toggle
            label="Shortfall alerts"
            desc="When a cash shortfall is projected"
            checked={prefs.alertShortfall}
            onChange={setPref('alertShortfall')}
            disabled={!prefs.smsOptIn}
          />
          <Toggle
            label="Weekly pulse"
            desc="Monday 8am summary in your timezone"
            checked={prefs.alertWeeklyPulse}
            onChange={setPref('alertWeeklyPulse')}
            disabled={!prefs.smsOptIn}
          />
          <Toggle
            label="Improvement alerts"
            desc="When your outlook improves 10%+"
            checked={prefs.alertImprovement}
            onChange={setPref('alertImprovement')}
            disabled={!prefs.smsOptIn}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Low-cash threshold ($)</label>
            <input
              className="input"
              type="number"
              value={prefs.shortfallThreshold}
              onChange={(e) => setPref('shortfallThreshold')(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Timezone</label>
            <select className="input" value={prefs.timezone} onChange={(e) => setPref('timezone')(e.target.value)}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Quiet hours start</label>
            <input
              className="input"
              type="time"
              value={prefs.quietStart}
              onChange={(e) => setPref('quietStart')(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Quiet hours end</label>
            <input
              className="input"
              type="time"
              value={prefs.quietEnd}
              onChange={(e) => setPref('quietEnd')(e.target.value)}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Alerts generated during quiet hours are queued and sent when they end — except real-time threshold breaches,
          which always send immediately.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" onClick={savePrefs} disabled={busy === 'save'}>
            {busy === 'save' ? 'Saving…' : 'Save preferences'}
          </button>
          {saved && <span className="text-sm text-emerald-400">✓ Saved</span>}
        </div>
      </div>

      {/* Test buttons */}
      {s.phoneVerified && (
        <div className="border-t border-white/[0.06] pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Send a test alert</div>
          <div className="flex flex-wrap gap-2">
            {ALERT_TESTS.map((t) => (
              <button
                key={t.type}
                className="btn-ghost btn-sm"
                onClick={() => runTest(t.type)}
                disabled={busy === `test-${t.type}`}
              >
                {busy === `test-${t.type}` ? '…' : t.label}
              </button>
            ))}
          </div>
          {testMsg && (
            <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs">
              {testMsg.error ? (
                <span className="text-red-400">{testMsg.error}</span>
              ) : (
                <>
                  <span className="text-slate-300">{testMsg.body}</span>
                  <span className="mt-1 block text-slate-500">
                    {testMsg.queued
                      ? 'Queued (quiet hours)'
                      : testMsg.simulated
                        ? 'Sent (simulated — see server console)'
                        : 'Sent'}
                  </span>
                </>
              )}
            </div>
          )}
          {log.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Recent</div>
              <div className="space-y-1">
                {log.slice(0, 5).map((l, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="chip bg-white/5 text-slate-400">{l.alert_type}</span>
                    <span className="truncate">{l.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
