import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogoMark } from '../components/Logo.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('demo@bistro.com');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="text-teal">
            <LogoMark size={42} />
          </span>
          <div className="mt-2 text-xl font-bold tracking-tight text-white">ForecastOS</div>
          <div className="text-xs text-slate-400">Your business finances have a heartbeat.</div>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          <h1 className="text-lg font-bold text-white">Welcome back</h1>
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-center text-xs text-slate-400">
            Demo account is pre-filled — just click <span className="font-semibold text-teal-soft">Sign in</span>.
          </div>
          <p className="text-center text-sm text-slate-400">
            No account?{' '}
            <Link to="/register" className="font-semibold text-teal-soft hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
