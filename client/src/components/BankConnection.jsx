import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import ConnectBank from './ConnectBank.jsx';

function timeAgo(iso) {
  if (!iso) return 'never';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function BankConnection({ onChange }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      setStatus(await api.plaidStatus());
    } catch {
      setStatus({ configured: false, connected: false });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(name, fn) {
    setBusy(name);
    try {
      await fn();
      await load();
      onChange?.();
    } finally {
      setBusy('');
    }
  }

  if (!status) {
    return <div className="card p-5 text-sm text-slate-400">Checking bank connection…</div>;
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Live Bank Connection</h3>
        {status.connected && (
          <span className="chip bg-teal/15 text-teal-soft">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" /> Live
          </span>
        )}
      </div>

      {!status.connected ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Link your bank to stream real transactions in and get live predictions.
            {status.env && status.configured ? ` (${status.env} mode)` : ''}
          </p>
          <ConnectBank configured={status.configured} onConnected={() => act('connect', async () => {})} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
            <div>
              <div className="text-sm font-semibold text-white">{status.institution}</div>
              <div className="text-xs text-slate-400">Last synced {timeAgo(status.lastSynced)}</div>
            </div>
            <span className="text-xl">🏦</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost btn-sm" onClick={() => act('sync', api.plaidSync)} disabled={busy === 'sync'}>
              {busy === 'sync' ? 'Syncing…' : '↻ Sync now'}
            </button>
            <button
              className="btn-ghost btn-sm text-red-300"
              onClick={() => act('disc', api.plaidDisconnect)}
              disabled={busy === 'disc'}
            >
              Disconnect
            </button>
          </div>
          <p className="text-xs text-slate-500">
            New transactions push to your dashboard live as your bank reports them. Use Sync now to pull the latest
            immediately.
          </p>
        </div>
      )}
    </div>
  );
}
