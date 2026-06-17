import { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { api } from '../api.js';

// "Connect a bank" button backed by Plaid Link. Fetches a link token on click,
// opens Plaid Link, and exchanges the public token on success.
export default function ConnectBank({ configured, onConnected, variant = 'primary', label = 'Connect a bank' }) {
  const [token, setToken] = useState(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSuccess = useCallback(
    async (publicToken, metadata) => {
      setBusy(true);
      setError('');
      try {
        await api.plaidExchange(publicToken, metadata?.institution?.name);
        onConnected?.();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    },
    [onConnected]
  );

  const { open, ready } = usePlaidLink({ token, onSuccess });

  useEffect(() => {
    if (autoOpen && ready && token) {
      open();
      setAutoOpen(false);
    }
  }, [autoOpen, ready, token, open]);

  async function start() {
    setError('');
    setBusy(true);
    try {
      const { link_token } = await api.plaidLinkToken();
      setToken(link_token);
      setAutoOpen(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
        Add <code className="text-amber-200">PLAID_CLIENT_ID</code> &{' '}
        <code className="text-amber-200">PLAID_SECRET</code> to <code className="text-amber-200">.env</code> to connect
        a live bank (free sandbox keys at dashboard.plaid.com).
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button className={variant === 'primary' ? 'btn-primary' : 'btn-ghost'} onClick={start} disabled={busy}>
        {busy ? 'Opening…' : `🏦 ${label}`}
      </button>
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}
