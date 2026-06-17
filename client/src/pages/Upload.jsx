import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import BankConnection from '../components/BankConnection.jsx';

const SAMPLE_CSV = `date,description,amount,category
2026-06-01,Square POS deposit,2450.00,POS Income
2026-06-01,Commercial lease - rent,-6800.00,Rent
2026-06-02,Sysco food order,-3100.00,Food Costs
2026-06-03,Catering event,2800.00,Catering Income`;

export default function Upload() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  async function onUpload(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Please choose a CSV file first.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.uploadCsv(form);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setConnecting(true);
    setError('');
    try {
      const res = await api.connectQuickBooks();
      setResult({ imported: res.imported, skipped: 0, source: 'quickbooks' });
      setTimeout(() => navigate('/'), 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Layout title="Import Data" subtitle="Upload a bank CSV or load demo data">
      <div className="mx-auto grid max-w-3xl gap-5">
        {/* Live bank (Plaid) */}
        <BankConnection onChange={() => {}} />

        {/* Mock QuickBooks */}
        <div className="card p-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-base font-bold text-white">⚡ Connect QuickBooks</h3>
              <p className="mt-1 text-sm text-slate-400">
                Instantly load a realistic 6-month restaurant dataset so you can explore every feature.
              </p>
            </div>
            <button className="btn-primary whitespace-nowrap" onClick={connect} disabled={connecting}>
              {connecting ? 'Connecting…' : 'Connect (demo)'}
            </button>
          </div>
        </div>

        {/* CSV upload */}
        <form onSubmit={onUpload} className="card p-6">
          <h3 className="text-base font-bold text-white">📥 Upload a CSV</h3>
          <p className="mt-1 text-sm text-slate-400">
            Required columns: <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-teal-soft">date</code>,{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-teal-soft">description</code>,{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-teal-soft">amount</code>,{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-teal-soft">category</code>. Positive amounts
            are income, negative are expenses.
          </p>

          <label
            className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/5 px-6 py-8 text-center transition hover:border-teal/40 hover:bg-teal/5"
            htmlFor="csv"
          >
            <div className="text-3xl">🗂️</div>
            <div className="mt-2 text-sm font-medium text-slate-200">{fileName || 'Click to choose a CSV file'}</div>
            <div className="mt-0.5 text-xs text-slate-500">Max 5 MB</div>
            <input
              id="csv"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name || '')}
            />
          </label>

          {error && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              Imported <strong>{result.imported}</strong> transactions
              {result.skipped ? `, skipped ${result.skipped}` : ''}.{' '}
              <button type="button" className="underline" onClick={() => navigate('/')}>
                View dashboard →
              </button>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Uploading…' : 'Upload & analyze'}
            </button>
          </div>

          <details className="mt-5">
            <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200">
              Show example CSV format
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-white/5 bg-charcoal-900/70 p-3 text-xs text-slate-300">
              {SAMPLE_CSV}
            </pre>
          </details>
        </form>
      </div>
    </Layout>
  );
}
