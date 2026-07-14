import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuthStore } from '../../lib/auth/authStore';
import { login } from '../../api/authApi';
import { ROLE_LANDING } from '../../constants/permissions';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { ROUTES } from '../../constants/routes';

const DEMO_USERS = [
  { u: 'admin',      p: 'admin123',   role: 'Admin'           },
  { u: 'officer',    p: 'officer123', role: 'Safety Officer'   },
  { u: 'supervisor', p: 'super123',   role: 'Site Supervisor'  },
  { u: 'ehs',        p: 'ehs123',     role: 'EHS Manager'      },
  { u: 'manager',    p: 'mgmt123',    role: 'Plant Management' },
];

export default function LoginPage() {
  const navigate   = useNavigate();
  const loginStore = useAuthStore(s => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) { setError('Please enter your username and password.'); return; }
    setError(''); setLoading(true);
    try {
      const { user, token } = await login(username, password);
      loginStore(user, token);
      navigate(ROLE_LANDING[user.role], { replace: true });
    } catch {
      setError('Invalid username or password');
    } finally { setLoading(false); }
  }

  return (
    <div>
      {/* Logo mark */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/10">
          <Shield className="w-7 h-7 text-accent" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xl font-bold text-text-primary leading-tight">PPE Monitoring</p>
          <p className="text-sm text-text-muted leading-tight">Industrial Safety Detection System</p>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome back</h1>
      <p className="text-base text-text-muted mb-8">Sign in to access your monitoring dashboard</p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          label="Username"
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          placeholder="Enter your username"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="Enter your password"
        />
        {error && (
          <div className="flex items-center gap-2 bg-status-danger/10 border border-status-danger/30 rounded-xl px-4 py-3">
            <span className="text-status-danger text-sm" role="alert">{error}</span>
          </div>
        )}
        <Button type="submit" loading={loading} className="w-full justify-center mt-2" size="lg">
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-text-muted mt-6">
        <Link to={ROUTES.FORGOT_PASSWORD} className="text-accent hover:underline transition-colors font-medium">
          Forgot your password?
        </Link>
      </p>

      {/* Demo credentials */}
      <div className="mt-8 p-5 bg-panel-alt rounded-2xl border border-border-soft">
        <p className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">
          Demo Accounts
        </p>
        <div className="grid grid-cols-1 gap-2">
          {DEMO_USERS.map(({ u, p, role }) => (
            <button
              key={u}
              type="button"
              onClick={() => { setUsername(u); setPassword(p); setError(''); }}
              className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-panel-hover transition-all duration-200 text-left border border-transparent hover:border-border-soft"
            >
              <span className="text-sm text-text-secondary font-mono font-medium">{u}</span>
              <span className="text-sm text-text-muted">{role}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
