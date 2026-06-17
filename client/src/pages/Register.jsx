import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogoMark } from '../components/Logo.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    businessName: '',
    businessType: 'Restaurant',
    industryVertical: 'Food & Beverage',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/onboarding');
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
          <div className="mt-2 text-xl font-bold tracking-tight text-white">CashFlow</div>
          <div className="text-xs text-slate-400">Your business finances have a heartbeat.</div>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          <h1 className="text-lg font-bold text-white">Create your account</h1>
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div>
            <label className="label">Business name</label>
            <input
              className="input"
              value={form.businessName}
              onChange={set('businessName')}
              placeholder="The Corner Bistro"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Business type</label>
              <input
                className="input"
                value={form.businessType}
                onChange={set('businessType')}
                placeholder="Restaurant"
              />
            </div>
            <div>
              <label className="label">Industry</label>
              <input
                className="input"
                value={form.industryVertical}
                onChange={set('industryVertical')}
                placeholder="Food & Beverage"
              />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={set('password')}
              required
              minLength={6}
            />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
          <p className="text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-teal-soft hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
