import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Analytics from './pages/Analytics.jsx';
import Digest from './pages/Digest.jsx';
import ScenarioPlanner from './pages/ScenarioPlanner.jsx';
import Upload from './pages/Upload.jsx';
import Settings from './pages/Settings.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid h-full place-items-center text-slate-400">
        <div className="animate-pulse text-sm">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route
        path="/"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/onboarding"
        element={
          <Protected>
            <Onboarding />
          </Protected>
        }
      />
      <Route
        path="/analytics"
        element={
          <Protected>
            <Analytics />
          </Protected>
        }
      />
      <Route
        path="/digest"
        element={
          <Protected>
            <Digest />
          </Protected>
        }
      />
      <Route
        path="/scenarios"
        element={
          <Protected>
            <ScenarioPlanner />
          </Protected>
        }
      />
      <Route
        path="/upload"
        element={
          <Protected>
            <Upload />
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected>
            <Settings />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to={loading ? '/login' : '/'} replace />} />
    </Routes>
  );
}
